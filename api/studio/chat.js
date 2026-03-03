// Build Studio chat API — orchestrates Claude code generation + credits + session persistence
// GET ?session_id=xxx → load session + messages
// GET (no params) → list user's sessions
// POST { session_id?, message } → generate code, save messages, deduct credit

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../inclawbate/x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0x612abfe54269515f0cc63b4a12fee32d48889ff2'
];
const FREE_HANDLES = ['artstu'];

const MODEL_TIERS = {
    fast:     { model: 'claude-haiku-4-5-20251001',  credits: 10,  label: 'Fast',     maxTokens: 8192  },
    standard: { model: 'claude-sonnet-4-5-20250929', credits: 35,  label: 'Standard', maxTokens: 16384 },
    pro:      { model: 'claude-opus-4-6-20250214',   credits: 150, label: 'Pro',      maxTokens: 32000 }
};

// Per-token costs in USD (from Anthropic pricing)
const TOKEN_PRICING = {
    'claude-haiku-4-5-20251001':  { input: 0.80 / 1e6, output: 4.00 / 1e6 },
    'claude-sonnet-4-5-20250929': { input: 3.00 / 1e6, output: 15.00 / 1e6 },
    'claude-opus-4-6-20250214':   { input: 15.00 / 1e6, output: 75.00 / 1e6 }
};
const USD_PER_CREDIT = 0.005;
const COST_MARGIN = 1.3; // 30% margin over raw API cost

function calcActualCredits(model, inputTokens, outputTokens) {
    const pricing = TOKEN_PRICING[model];
    if (!pricing) return 0;
    const rawUsd = (inputTokens * pricing.input) + (outputTokens * pricing.output);
    return Math.ceil((rawUsd * COST_MARGIN) / USD_PER_CREDIT);
}

const SYSTEM_PROMPT = `You are a expert web developer AI. The user will describe a website, app, or page they want built. You generate complete, self-contained HTML files.

Rules:
- Output a COMPLETE HTML file wrapped in \`\`\`html code blocks
- Include ALL CSS inline in a <style> tag — no external stylesheets except Google Fonts
- Include ALL JavaScript inline in a <script> tag — no external dependencies
- Make it mobile-responsive by default
- Use a dark theme by default (dark background, light text) unless the user specifies otherwise
- Make it visually polished — use gradients, shadows, spacing, modern typography
- Every response MUST include the full updated HTML file, never partial snippets
- If the user asks for a change, output the ENTIRE file with that change applied
- Use semantic HTML5 elements
- Add smooth animations and transitions where appropriate
- Ensure accessibility basics (alt tags, aria labels, contrast)
- You may use CDN-hosted libraries (Chart.js, Three.js, Leaflet, etc.) via <script src="..."> when the user's request benefits from them

Output format: Always wrap your HTML in a single \`\`\`html code block. You may include a brief explanation before the code block, but the code block is required.

## Available SDKs (auto-injected into every published app)

### CLAWS SDK — window.CLAWS
Handles crypto payments via CLAWS token on Base chain.
- CLAWS.pay(amount, recipientAddress) → sends CLAWS tokens, returns tx hash
- CLAWS.balance() → returns user's CLAWS balance (number)
- CLAWS.tipCreator(amount?) → sends CLAWS to the app creator (default 10)
- CLAWS.gate(amount, callback) → paywall: user pays, then callback(err, txHash)
- CLAWS.creatorWallet → the app creator's wallet address
- CLAWS.appId → the app's unique ID

### AppDB SDK — window.AppDB
Persistent key-value database for every app. Data survives page reloads and tab closes.
Two scopes: user-scoped (private to each visitor) and global (shared across all visitors).

User-scoped (private per visitor):
- await AppDB.get(key) → returns stored value or null
- await AppDB.set(key, value) → stores any JSON-serializable value
- await AppDB.delete(key) → removes a key
- await AppDB.list() → returns [{key, value}, ...] of all user keys

Global (shared across all visitors of this app):
- await AppDB.getGlobal(key) → returns globally stored value or null
- await AppDB.setGlobal(key, value) → stores value visible to all users
- await AppDB.deleteGlobal(key) → removes a global key
- await AppDB.listGlobal() → returns [{key, value}, ...] of all global keys

Usage guidelines:
- Use global scope for leaderboards, polls, guestbooks, shared counters, public data
- Use user scope for personal settings, saved progress, user profiles, private notes
- Values can be any JSON type: strings, numbers, objects, arrays
- Max 100KB per value, 1000 keys per scope
- All methods are async — always use await`;

const SYSTEM_PROMPT_EDIT = `You are an expert web developer AI editing an existing HTML app.

Rules:
- Output ONLY search/replace edit blocks — NEVER the full file
- Each block replaces an exact section of the existing code
- You may output multiple blocks per response
- SEARCH text must match the existing code EXACTLY (copy lines verbatim)
- Keep edits minimal — only the lines that change, plus 1-2 surrounding lines for uniqueness
- For deletions, leave REPLACE empty
- For insertions, SEARCH the lines where new code goes after, include them + new code in REPLACE
- If the change is so large it affects >60% of the file, output a full \`\`\`html block instead

Format:
<<<<<<< SEARCH
exact lines from existing code
=======
replacement lines
>>>>>>> REPLACE

You may include a brief explanation before/between edit blocks.

## Available SDKs (auto-injected into every published app)

### CLAWS SDK — window.CLAWS
Handles crypto payments via CLAWS token on Base chain.
- CLAWS.pay(amount, recipientAddress) → sends CLAWS tokens, returns tx hash
- CLAWS.balance() → returns user's CLAWS balance (number)
- CLAWS.tipCreator(amount?) → sends CLAWS to the app creator (default 10)
- CLAWS.gate(amount, callback) → paywall: user pays, then callback(err, txHash)
- CLAWS.creatorWallet → the app creator's wallet address
- CLAWS.appId → the app's unique ID

### AppDB SDK — window.AppDB
Persistent key-value database for every app. Data survives page reloads and tab closes.
Two scopes: user-scoped (private to each visitor) and global (shared across all visitors).

User-scoped (private per visitor):
- await AppDB.get(key) → returns stored value or null
- await AppDB.set(key, value) → stores any JSON-serializable value
- await AppDB.delete(key) → removes a key
- await AppDB.list() → returns [{key, value}, ...] of all user keys

Global (shared across all visitors of this app):
- await AppDB.getGlobal(key) → returns globally stored value or null
- await AppDB.setGlobal(key, value) → stores value visible to all users
- await AppDB.deleteGlobal(key) → removes a global key
- await AppDB.listGlobal() → returns [{key, value}, ...] of all global keys

Usage guidelines:
- Use global scope for leaderboards, polls, guestbooks, shared counters, public data
- Use user scope for personal settings, saved progress, user profiles, private notes
- Values can be any JSON type: strings, numbers, objects, arrays
- Max 100KB per value, 1000 keys per scope
- All methods are async — always use await`;

function setCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function authenticate(req) {
    // Try JWT first
    const user = authenticateRequest(req);
    if (user) return user.sub;

    // Fall back to API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
        const { data } = await supabase
            .from('human_profiles')
            .select('id')
            .eq('api_key', apiKey)
            .single();
        if (data) return data.id;
    }
    return null;
}

async function getProfile(profileId) {
    const { data } = await supabase
        .from('human_profiles')
        .select('credits, wallet_address, x_handle')
        .eq('id', profileId)
        .single();
    return data;
}

function isAdmin(profile) {
    return ADMIN_WALLETS.includes(profile?.wallet_address?.toLowerCase())
        || FREE_HANDLES.includes(profile?.x_handle?.toLowerCase());
}

function extractHtml(text) {
    // Try closed code block first, then fallback for truncated responses
    const match = text.match(/```html\s*([\s\S]*?)```/);
    if (match) return match[1].trim();
    const truncated = text.match(/```html\s*([\s\S]+)/);
    return truncated ? truncated[1].trim() : null;
}

function hasEditBlocks(text) {
    return text.includes('<<<<<<< SEARCH');
}

function parseEditBlocks(text) {
    const blocks = [];
    // Normalize \r\n to \n before parsing
    const normalized = text.replace(/\r\n/g, '\n');
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
        blocks.push({ search: match[1], replace: match[2] });
    }
    return blocks;
}

function applyEdits(code, blocks) {
    const errors = [];
    let applied = 0;
    // Normalize \r\n in existing code for consistent matching
    code = code.replace(/\r\n/g, '\n');
    for (let i = 0; i < blocks.length; i++) {
        const { search, replace } = blocks[i];
        // Try exact match first
        const idx = code.indexOf(search);
        if (idx !== -1) {
            code = code.slice(0, idx) + replace + code.slice(idx + search.length);
            applied++;
            continue;
        }
        // Fallback: normalize trailing whitespace per line
        const normSearch = search.split('\n').map(l => l.trimEnd()).join('\n');
        const normCode = code.split('\n').map(l => l.trimEnd()).join('\n');
        const normIdx = normCode.indexOf(normSearch);
        if (normIdx !== -1) {
            const linesBefore = normCode.slice(0, normIdx).split('\n').length - 1;
            const origLines = code.split('\n');
            let origStart = 0;
            for (let j = 0; j < linesBefore; j++) origStart += origLines[j].length + 1;
            const searchLineCount = search.split('\n').length;
            let origEnd = origStart;
            for (let j = linesBefore; j < linesBefore + searchLineCount; j++) {
                origEnd += (origLines[j]?.length || 0) + 1;
            }
            origEnd--;
            code = code.slice(0, origStart) + replace + code.slice(origEnd);
            applied++;
            continue;
        }
        errors.push('Block ' + (i + 1) + ': no match for SEARCH text');
    }
    return { code, errors, applied };
}

function autoTitle(message) {
    // Take first 50 chars, clean up
    const clean = message.replace(/\n/g, ' ').trim();
    return clean.length > 50 ? clean.slice(0, 50) + '...' : clean;
}

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── Auth ──
    const profileId = await authenticate(req);
    if (!profileId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    // ── GET: estimate or list sessions or load one ──
    if (req.method === 'GET') {
        const { session_id, estimate, model, code_length } = req.query;

        if (estimate === 'true') {
            const { is_edit } = req.query;
            const tierKey = model || 'fast';
            const tier = MODEL_TIERS[tierKey] || MODEL_TIERS.fast;
            const codeLen = parseInt(code_length) || 0;
            // Rough token estimate: code chars / 3.5 + system prompt (~1500) for input
            // Edit mode outputs ~3000 tokens (search/replace blocks), full mode ~12000
            const estInputTokens = Math.ceil(codeLen / 3.5) + 1500;
            const estOutputTokens = is_edit === 'true' ? 3000 : 12000;
            const estimatedCredits = calcActualCredits(tier.model, estInputTokens, estOutputTokens);
            const surcharge = Math.max(0, estimatedCredits - tier.credits);
            return res.json({
                base_credits: tier.credits,
                estimated_surcharge: surcharge,
                estimated_credits: tier.credits + surcharge
            });
        }

        if (session_id) {
            // Load single session + messages
            const { data: session } = await supabase
                .from('build_sessions')
                .select('*')
                .eq('id', session_id)
                .eq('profile_id', profileId)
                .single();

            if (!session) return res.status(404).json({ error: 'Session not found.' });

            const { data: messages } = await supabase
                .from('build_messages')
                .select('id, role, content, code, created_at')
                .eq('session_id', session_id)
                .order('created_at', { ascending: true });

            return res.json({ session, messages: messages || [] });
        }

        // List all sessions for user
        const { data: sessions } = await supabase
            .from('build_sessions')
            .select('id, title, slug, published_at, created_at, updated_at')
            .eq('profile_id', profileId)
            .order('updated_at', { ascending: false });

        return res.json({ sessions: sessions || [] });
    }

    // ── POST: chat + generate code ──
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const profile = await getProfile(profileId);
    const admin = isAdmin(profile);

    // Resolve model tier
    const tierKey = req.body?.model || 'fast';
    const tier = MODEL_TIERS[tierKey] || MODEL_TIERS.fast;

    // Credit check
    if (!admin && (!profile || profile.credits < tier.credits)) {
        return res.status(402).json({
            error: 'Not enough credits. ' + tier.label + ' requires ' + tier.credits + ' credits.',
            credits: profile?.credits || 0
        });
    }

    const { ANTHROPIC_API_KEY } = process.env;
    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured.' });
    }

    // Deduct credits BEFORE calling Claude so users can't skip payment
    let creditsRemaining = profile?.credits || 0;
    if (!admin) {
        const { data: updated, error: creditErr } = await supabase
            .from('human_profiles')
            .update({ credits: profile.credits - tier.credits })
            .eq('id', profileId)
            .gte('credits', tier.credits)
            .select('credits')
            .single();

        if (creditErr || !updated) {
            return res.status(402).json({
                error: 'Failed to deduct credits.',
                credits: profile?.credits || 0
            });
        }
        creditsRemaining = updated.credits;
    }

    try {
        const { session_id, message, current_code } = req.body;

        if (!message || !message.trim()) {
            // Refund — no work done
            if (!admin) {
                await supabase.from('human_profiles')
                    .update({ credits: creditsRemaining + tier.credits })
                    .eq('id', profileId);
            }
            return res.status(400).json({ error: 'Message is required.' });
        }

        let sessionId = session_id;
        let sessionTitle = '';

        // Create new session if needed
        if (!sessionId) {
            const title = autoTitle(message);
            const { data: newSession, error: sessErr } = await supabase
                .from('build_sessions')
                .insert({ profile_id: profileId, title })
                .select('id, title')
                .single();

            if (sessErr) throw sessErr;
            sessionId = newSession.id;
            sessionTitle = newSession.title;
        } else {
            // Verify ownership and load current_code for edit mode
            const { data: existing } = await supabase
                .from('build_sessions')
                .select('id, title, current_code')
                .eq('id', sessionId)
                .eq('profile_id', profileId)
                .single();

            if (!existing) return res.status(404).json({ error: 'Session not found.' });
            sessionTitle = existing.title;
            // Use session's stored code if available
            if (existing.current_code && !current_code) {
                req.body._session_code = existing.current_code;
            }
        }

        // Determine edit mode — do we have existing code to edit?
        let existingCode = req.body._session_code || null;
        if (!existingCode && current_code) existingCode = current_code;
        const isEditMode = !!existingCode;

        // Fetch last 20 messages for context
        const { data: history } = await supabase
            .from('build_messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(20);

        const contextMessages = (history || []).reverse().map(m => ({
            role: m.role,
            content: m.content
        }));

        // Context injection depends on edit mode
        if (contextMessages.length === 0 && existingCode) {
            const MAX_CODE = 40000;
            const trimmedCode = existingCode.length > MAX_CODE
                ? existingCode.slice(0, MAX_CODE) + '\n<!-- ... code truncated for context -->'
                : existingCode;
            if (isEditMode) {
                contextMessages.push({
                    role: 'user',
                    content: 'Here is the current app code:\n\n```html\n' + trimmedCode + '\n```\n\nTell me what to change and I\'ll provide search/replace edit blocks.'
                });
                contextMessages.push({
                    role: 'assistant',
                    content: 'I can see your app. Tell me what you\'d like to change and I\'ll provide minimal search/replace edit blocks.'
                });
            } else {
                contextMessages.push({
                    role: 'user',
                    content: 'Here is my existing app code:\n\n```html\n' + trimmedCode + '\n```\n\nI want to make a change to it.'
                });
                contextMessages.push({
                    role: 'assistant',
                    content: 'I can see your app. Tell me what you\'d like to change and I\'ll output the complete updated HTML file.'
                });
            }
        } else if (isEditMode && contextMessages.length > 0) {
            // Always re-inject current code in edit mode so Claude can write accurate SEARCH blocks
            // Input tokens are cheap; failed edits from stale context are expensive
            const MAX_CODE = 40000;
            const trimmedCode = existingCode.length > MAX_CODE
                ? existingCode.slice(0, MAX_CODE) + '\n<!-- ... code truncated for context -->'
                : existingCode;
            contextMessages.push({
                role: 'user',
                content: 'For reference, here is the current app code:\n\n```html\n' + trimmedCode + '\n```'
            });
            contextMessages.push({
                role: 'assistant',
                content: 'Got it, I have the current code. What would you like to change?'
            });
        }

        // Add current user message
        contextMessages.push({ role: 'user', content: message });

        // Choose prompt and max_tokens based on edit mode
        const systemPrompt = isEditMode ? SYSTEM_PROMPT_EDIT : SYSTEM_PROMPT;
        const editMaxTokens = { fast: 4096, standard: 6000, pro: 8192 };
        const maxTokens = isEditMode ? (editMaxTokens[tierKey] || 4096) : tier.maxTokens;

        // Call Claude with streaming to avoid Vercel 60s timeout
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: tier.model,
                max_tokens: maxTokens,
                stream: true,
                system: systemPrompt,
                messages: contextMessages
            })
        });

        if (!response.ok) {
            let errMsg = 'Failed to generate code.';
            try { const errData = await response.json(); errMsg = errData.error?.message || errMsg; } catch (e) {}
            console.error('Anthropic error:', response.status, errMsg);
            if (!admin) {
                await supabase.from('human_profiles')
                    .update({ credits: creditsRemaining + tier.credits })
                    .eq('id', profileId);
            }
            return res.status(response.status).json({
                error: errMsg,
                credits_remaining: creditsRemaining + tier.credits
            });
        }

        // Set up SSE streaming to client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send session info immediately so client can track it
        res.write('data: ' + JSON.stringify({ type: 'session', session_id: sessionId, title: sessionTitle }) + '\n\n');

        // Read the SSE stream from Anthropic
        let assistantText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') continue;

                try {
                    const event = JSON.parse(payload);

                    if (event.type === 'content_block_delta' && event.delta?.text) {
                        assistantText += event.delta.text;
                        // Forward text chunk to client
                        res.write('data: ' + JSON.stringify({ type: 'delta', text: event.delta.text }) + '\n\n');
                    } else if (event.type === 'message_delta' && event.usage) {
                        outputTokens = event.usage.output_tokens || 0;
                    } else if (event.type === 'message_start' && event.message?.usage) {
                        inputTokens = event.message.usage.input_tokens || 0;
                    }
                } catch (e) { /* skip unparseable lines */ }
            }
        }

        let code = null;
        if (isEditMode) {
            // Fallback: Claude sent a full HTML file despite edit mode (large changes)
            const fullHtml = extractHtml(assistantText);
            if (fullHtml) {
                code = fullHtml;
            } else if (hasEditBlocks(assistantText)) {
                const blocks = parseEditBlocks(assistantText);
                if (blocks.length === 0) {
                    console.warn('Edit blocks detected but regex parsed 0 blocks');
                } else {
                    const result = applyEdits(existingCode, blocks);
                    if (result.applied > 0) {
                        code = result.code;
                    }
                    if (result.errors.length > 0) {
                        console.warn('Edit block failures (' + result.applied + '/' + blocks.length + ' applied):', result.errors);
                    }
                }
            }
        } else {
            code = extractHtml(assistantText);
        }
        const tokensUsed = inputTokens + outputTokens;

        // Calculate token-based surcharge
        let surcharge = 0;
        if (!admin) {
            const actualCredits = calcActualCredits(tier.model, inputTokens, outputTokens);
            if (actualCredits > tier.credits) {
                surcharge = actualCredits - tier.credits;
                const canDeduct = Math.min(surcharge, creditsRemaining);
                if (canDeduct > 0) {
                    const { data: updated } = await supabase
                        .from('human_profiles')
                        .update({ credits: creditsRemaining - canDeduct })
                        .eq('id', profileId)
                        .select('credits')
                        .single();
                    if (updated) creditsRemaining = updated.credits;
                }
                if (surcharge > canDeduct) {
                    console.warn(`Credit shortfall: user ${profileId} owes ${surcharge - canDeduct} credits (surcharge=${surcharge}, available=${canDeduct})`);
                }
            }
        }

        // Save messages to DB
        await supabase.from('build_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: message,
            tokens_used: 0,
            credits_charged: 0
        });

        await supabase.from('build_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: assistantText,
            code: code,
            tokens_used: tokensUsed,
            credits_charged: admin ? 0 : tier.credits + surcharge
        });

        if (code) {
            await supabase
                .from('build_sessions')
                .update({ current_code: code, updated_at: new Date().toISOString() })
                .eq('id', sessionId);
        } else {
            await supabase
                .from('build_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId);
        }

        // Send final event with metadata
        res.write('data: ' + JSON.stringify({
            type: 'done',
            code: code,
            credits_remaining: creditsRemaining,
            tier_used: tierKey,
            credits_charged: admin ? 0 : tier.credits + surcharge,
            surcharge: surcharge
        }) + '\n\n');

        return res.end();

    } catch (error) {
        console.error('Build studio error:', error);
        return res.status(500).json({ error: 'Failed to generate. Please try again.' });
    }
}
