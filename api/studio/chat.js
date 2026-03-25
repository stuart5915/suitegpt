// Build Studio chat API — orchestrates Claude code generation + credits + session persistence
// GET ?session_id=xxx → load session + messages
// GET (no params) → list user's sessions
// POST { session_id?, message } → generate code, save messages, deduct credit

export const config = { maxDuration: 300 };

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../inclawbate/x-callback.js';
// Angel free pass removed — only admin wallet gets free access

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FREE_CREDIT_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'  // inclawbate.base.eth
];
// Only admin wallet is free — no handles, no angel pass

const MODEL_TIERS = {
    gemini:   { provider: 'gemini',    model: 'gemini-2.5-flash',          credits: 0,   label: 'Gemini Flash', maxTokens: 65536 },
    llama:    { provider: 'groq',      model: 'llama-3.3-70b-versatile',   credits: 0,   label: 'Llama 70B',    maxTokens: 8192  },
    kimi:     { provider: 'moonshot',   model: 'moonshot-v1-128k',           credits: 0,   label: 'Kimi',         maxTokens: 16384 },
    fast:     { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', credits: 10,  label: 'Haiku',        maxTokens: 16384 },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6',         credits: 50,  label: 'Sonnet',       maxTokens: 64000 },
    pro:      { provider: 'anthropic', model: 'claude-opus-4-6',           credits: 100, label: 'Opus',         maxTokens: 64000 }
};

const USD_PER_CREDIT = 0.005;

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
- COMPLETENESS IS MANDATORY: Every app must be fully complete and functional on first render. Never output a skeleton, placeholder, empty container, or "TODO" section. If the user asks for a chess game, the board must have all 32 pieces rendered. If they ask for a dashboard, it must have real data displayed. If they ask for a form, every field must work. Output WORKING code, not scaffolding
- If the user says the current code is broken, missing features, or not working — regenerate the COMPLETE working version from scratch. Do not try to patch broken code. Start fresh and get it right
- INTERACTIVITY IS MANDATORY: Buttons must have click handlers. Forms must work. Games must be playable with full logic (click-to-select, valid moves, turn switching, win detection). Do NOT generate static/display-only output
- SCOPE BUG PREVENTION: If you use onclick="functionName()" in HTML, that function MUST be defined in the global scope (not inside DOMContentLoaded, not inside an IIFE, not inside another function). Either define functions at the top level of your <script> tag, or use addEventListener instead of onclick attributes. This is the #1 cause of "X is not defined" errors
- SELF-TEST: Before outputting, mentally trace the user flow end-to-end. If any step would fail (missing function, empty render, broken handler), fix it before outputting
- If the change is large or the edit blocks would affect >40% of the code, output the FULL file wrapped in \`\`\`html instead of edit blocks

Output format: Always wrap your HTML in a single \`\`\`html code block. You may include a brief explanation before the code block, but the code block is required.

## Available SDKs (auto-injected — do NOT add script tags for these)
These SDKs are automatically loaded into every app. Do NOT include \`<script src="...sdk.js">\` tags — just call the APIs directly in your code.
IMPORTANT: If a user's prompt does NOT require persistence, payments, or multiplayer, do NOT use these SDKs. Use plain localStorage for simple apps like todo lists.

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
- All methods are async — always use await

### Realtime SDK — window.Realtime
Multiplayer for any app. Players in the same app see each other in real time.

- await Realtime.connect(roomName?) — join a room (default: 'lobby')
- Realtime.send(event, data) — broadcast to all players
- Realtime.on(event, callback) — receive: callback(data, senderId)
  Register listeners BEFORE calling connect()
- Realtime.onJoin(cb) / onLeave(cb) — player join/leave callbacks
- Realtime.getPlayers() — [{id, ...state}] of online players
- Realtime.setMyState(state) — update your presence (e.g. {name, x, y, score})
- Realtime.me.id — your unique player ID
- Realtime.disconnect() — leave room

Pattern: register on() listeners first, then await connect(), then send().
Messages are ephemeral (not saved). Use AppDB for persistent data.`;

const SYSTEM_PROMPT_EDIT = `You are an expert web developer AI editing an existing HTML app.

Rules:
- Output ONLY search/replace edit blocks — NEVER the full file
- Each block replaces an exact section of the existing code
- You may output multiple blocks per response
- SEARCH text must match the existing code EXACTLY (copy lines verbatim)
- Keep edits minimal — only the lines that change, plus 1-2 surrounding lines for uniqueness
- For deletions, leave REPLACE empty
- For insertions, SEARCH the lines where new code goes after, include them + new code in REPLACE
- If the change is large or affects >40% of the file, output a full \`\`\`html block instead
- NEVER remove or break existing working functionality when making edits
- For games: always preserve the board rendering, pieces, and game logic when editing. If the board is empty/broken, output a full \`\`\`html block with a complete working game instead of trying to patch it

Format:
<<<<<<< SEARCH
exact lines from existing code
=======
replacement lines
>>>>>>> REPLACE

You may include a brief explanation before/between edit blocks.

## Available SDKs (auto-injected — do NOT add script tags for these)
These SDKs are automatically loaded. Do NOT include \`<script src="...sdk.js">\` tags — just use the APIs directly.
IMPORTANT: If the app does NOT need persistence, payments, or multiplayer, do NOT use these SDKs. Use plain localStorage for simple apps.

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
- All methods are async — always use await

### Realtime SDK — window.Realtime
Multiplayer for any app. Players in the same app see each other in real time.

- await Realtime.connect(roomName?) — join a room (default: 'lobby')
- Realtime.send(event, data) — broadcast to all players
- Realtime.on(event, callback) — receive: callback(data, senderId)
  Register listeners BEFORE calling connect()
- Realtime.onJoin(cb) / onLeave(cb) — player join/leave callbacks
- Realtime.getPlayers() — [{id, ...state}] of online players
- Realtime.setMyState(state) — update your presence (e.g. {name, x, y, score})
- Realtime.me.id — your unique player ID
- Realtime.disconnect() — leave room

Pattern: register on() listeners first, then await connect(), then send().
Messages are ephemeral (not saved). Use AppDB for persistent data.`;

function setCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

async function isAdmin(profile) {
    if (FREE_CREDIT_WALLETS.includes(profile?.wallet_address?.toLowerCase())) return true;
    return false;
}

function injectErrorHandler(html) {
    var script = '<script>\n' +
        '(function(){\n' +
        '  var errs=[];\n' +
        '  window.onerror=function(msg,src,line,col,err){\n' +
        '    errs.push({message:msg,line:line,col:col,stack:err&&err.stack||""});\n' +
        '    if(window.parent!==window)window.parent.postMessage({type:"studio-error",errors:errs},"*");\n' +
        '  };\n' +
        '  window.addEventListener("unhandledrejection",function(e){\n' +
        '    errs.push({message:String(e.reason),line:0});\n' +
        '    if(window.parent!==window)window.parent.postMessage({type:"studio-error",errors:errs},"*");\n' +
        '  });\n' +
        '  window.addEventListener("load",function(){\n' +
        '    setTimeout(function(){\n' +
        '      if(errs.length>0&&window.parent!==window){\n' +
        '        window.parent.postMessage({type:"studio-error",errors:errs},"*");\n' +
        '      }\n' +
        '      // Blank page detection: check if body has visible content\n' +
        '      var body=document.body;\n' +
        '      if(body&&window.parent!==window){\n' +
        '        var text=(body.innerText||"").trim();\n' +
        '        var hasCanvas=body.querySelector("canvas,svg,img,video,iframe");\n' +
        '        var h=body.scrollHeight;\n' +
        '        if(!text&&!hasCanvas&&h<50){\n' +
        '          window.parent.postMessage({type:"studio-error",errors:[{message:"Page appears blank — no visible content rendered",line:0,blank:true}]},"*");\n' +
        '        }\n' +
        '      }\n' +
        '    },2000);\n' +
        '  });\n' +
        '})();\n' +
        '<\/script>';
    if (html.includes('<head>')) return html.replace('<head>', '<head>' + script);
    if (html.includes('<html>')) return html.replace('<html>', '<html><head>' + script + '</head>');
    return script + html;
}

function extractHtml(text) {
    // Try ```html block first (Claude standard)
    const match = text.match(/```html\s*([\s\S]*?)```/);
    if (match) return match[1].trim();
    // Try generic ``` block that contains HTML
    const generic = text.match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);
    if (generic) return generic[1].trim();
    const generic2 = text.match(/```\s*(<html[\s\S]*?)```/i);
    if (generic2) return generic2[1].trim();
    // Truncated ```html (no closing ```)
    const truncated = text.match(/```html\s*([\s\S]+)/);
    if (truncated) return truncated[1].trim();
    // Truncated generic ``` with HTML
    const truncGen = text.match(/```\s*(<!DOCTYPE[\s\S]+)/i);
    if (truncGen) return truncGen[1].trim();
    // Raw HTML without code fences (some models do this)
    const rawHtml = text.match(/(<!DOCTYPE\s+html[\s\S]*<\/html>)/i);
    if (rawHtml) return rawHtml[1].trim();
    return null;
}

function hasEditBlocks(text) {
    return /&lt;{4,8} SEARCH|<{4,8} SEARCH/.test(text);
}

function parseEditBlocks(text) {
    const blocks = [];
    // Normalize \r\n to \n before parsing
    const normalized = text.replace(/\r\n/g, '\n');
    const regex = /<{4,8} SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>{4,8} REPLACE/g;
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

    // Allow anonymous POST (building) if platform setting permits
    if (!profileId) {
        if (req.method === 'POST') {
            // Check platform setting
            const { data: setting } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'allow_anonymous_publish')
                .maybeSingle();
            if (setting && setting.value === 'false') {
                return res.status(401).json({ error: 'Anonymous building is currently disabled. Please log in.' });
            }
            // Fall through to POST handler with profileId = null
        } else {
            return res.status(401).json({ error: 'Authentication required.' });
        }
    }

    // ── GET: estimate or list sessions or load one ──
    if (req.method === 'GET') {
        const { session_id, estimate, model, code_length } = req.query;

        if (estimate === 'true') {
            const tierKey = model || 'fast';
            const tier = MODEL_TIERS[tierKey] || MODEL_TIERS.fast;
            return res.json({
                base_credits: tier.credits,
                estimated_surcharge: 0,
                estimated_credits: tier.credits
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
            .select('id, title, slug, published_at, created_at, updated_at, current_code')
            .eq('profile_id', profileId)
            .order('updated_at', { ascending: false });

        // Include code for preview thumbnails (cap at 50KB per session, first 20 only)
        const sessionsWithPreview = (sessions || []).map((s, i) => ({
            id: s.id,
            title: s.title,
            slug: s.slug,
            published_at: s.published_at,
            created_at: s.created_at,
            updated_at: s.updated_at,
            has_code: !!s.current_code,
            current_code: (i < 20 && s.current_code && s.current_code.length < 50000) ? s.current_code : null
        }));

        return res.json({ sessions: sessionsWithPreview });
    }

    // ── DELETE: remove a session ──
    if (req.method === 'DELETE') {
        const { session_id } = req.query;
        if (!session_id) return res.status(400).json({ error: 'session_id required' });

        // Verify ownership
        const { data: existing } = await supabase
            .from('build_sessions')
            .select('id')
            .eq('id', session_id)
            .eq('profile_id', profileId)
            .single();

        if (!existing) return res.status(404).json({ error: 'Session not found.' });

        // Delete messages first, then session
        await supabase.from('build_messages').delete().eq('session_id', session_id);
        await supabase.from('build_sessions').delete().eq('id', session_id);

        return res.json({ ok: true });
    }

    // ── POST: chat + generate code ──
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const profile = profileId ? await getProfile(profileId) : null;
    const admin = await isAdmin(profile);
    const anonymous = !profileId;

    // Resolve model tier
    const tierKey = req.body?.model || 'gemini';
    const tier = MODEL_TIERS[tierKey] || MODEL_TIERS.gemini;

    let creditsRemaining = profile?.credits || 0;

    // Credit gating — paid models require credits. Only admin (inclawbate.base.eth) is free.
    if (tier.credits > 0 && !admin) {
        if (anonymous) {
            return res.status(401).json({ error: 'Log in to use ' + tier.label + '. Or try a free model like Gemini Flash.' });
        }
        if (creditsRemaining < tier.credits) {
            return res.status(402).json({ error: 'Not enough credits for ' + tier.label + '. You need ' + tier.credits + ' credits.', credits_remaining: creditsRemaining });
        }
        await supabase.from('human_profiles')
            .update({ credits: creditsRemaining - tier.credits })
            .eq('id', profileId);
        creditsRemaining = creditsRemaining - tier.credits;
    }

    // Validate provider API keys
    const { ANTHROPIC_API_KEY, GEMINI_API_KEY, MOONSHOT_API_KEY } = process.env;
    // Support both GROQ_API_KEY (singular) and GROQ_API_KEYS (plural, comma-separated)
    const GROQ_API_KEY = process.env.GROQ_API_KEY || (process.env.GROQ_API_KEYS || '').split(',')[0]?.trim() || '';
    const providerKeys = { anthropic: ANTHROPIC_API_KEY, gemini: GEMINI_API_KEY, groq: GROQ_API_KEY, moonshot: MOONSHOT_API_KEY };
    if (!providerKeys[tier.provider]) {
        return res.status(500).json({ error: tier.label + ' is not configured. Try a different model.' });
    }

    // Hoisted for access in catch block (partial save on error)
    let sessionId = null;
    let assistantText = '';
    const message = req.body?.message;

    try {
        const { session_id, current_code } = req.body;

        if (!message || !message.trim()) {
            // Refund — no work done
            if (!anonymous && !admin) {
                await supabase.from('human_profiles')
                    .update({ credits: creditsRemaining + tier.credits })
                    .eq('id', profileId);
            }
            return res.status(400).json({ error: 'Message is required.' });
        }

        sessionId = session_id;
        let sessionTitle = '';

        // Skip session persistence for anonymous users
        if (anonymous) {
            sessionId = null;
            sessionTitle = autoTitle(message);
        } else if (!sessionId) {
            // Create new session if needed
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
        // Prefer client-sent current_code (always up-to-date), fall back to DB
        let existingCode = current_code || req.body._session_code || null;
        // Determine if we should use edit mode or full regeneration
        // Force full-file mode when:
        // - Long prompts (>1500 chars) — likely "build from scratch"
        // - Auto-fix messages (code has errors, patching broken code makes it worse)
        // - User is asking for something fundamental that should exist (e.g. "add the pieces", "make it work")
        const isAutoFix = /fix these errors|runtime.*errors|blank page|renders? a blank|corrected HTML|output was truncated|code is incomplete|missing closing tags/i.test(message);
        const isFundamentalAsk = /add the .*(pieces|board|grid|cells|items|content|elements|layout)|make it (work|functional|playable|interactive)|it('s| is) (broken|empty|blank|not working)/i.test(message);
        // Only Sonnet and Opus are reliable enough for search/replace edit mode — Haiku is too weak
        const supportsEditMode = tier.provider === 'anthropic' && selectedModel !== 'fast';
        const isEditMode = supportsEditMode && !!existingCode && message.length < 1500 && !isAutoFix && !isFundamentalAsk;

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
        } else if (existingCode && contextMessages.length > 0) {
            // Always re-inject current code so Claude can see what it's working with
            // This is critical for auto-fix (full regen mode) AND edit mode
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
                content: isEditMode
                    ? 'Got it, I have the current code. What would you like to change?'
                    : 'Got it, I have the current code. I\'ll output the complete updated HTML file with your changes.'
            });
        }

        // Add current user message
        contextMessages.push({ role: 'user', content: message });

        // Choose prompt and max_tokens based on edit mode
        const systemPrompt = isEditMode ? SYSTEM_PROMPT_EDIT : SYSTEM_PROMPT;
        const editMaxTokens = { fast: 8192, standard: 32000, pro: 32000 };
        const maxTokens = isEditMode ? (editMaxTokens[tierKey] || 4096) : tier.maxTokens;

        // ── Build provider-specific request ──
        let response;
        const provider = tier.provider;

        if (provider === 'anthropic') {
            response = await fetch('https://api.anthropic.com/v1/messages', {
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
        } else if (provider === 'gemini') {
            // Convert messages to Gemini format
            const geminiContents = contextMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }));
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${tier.model}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: geminiContents,
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        generationConfig: { maxOutputTokens: maxTokens }
                    })
                }
            );
        } else if (provider === 'groq' || provider === 'moonshot') {
            // OpenAI-compatible format (Groq + Moonshot/Kimi)
            const apiUrl = provider === 'groq'
                ? 'https://api.groq.com/openai/v1/chat/completions'
                : 'https://api.moonshot.ai/v1/chat/completions';
            const apiKey = provider === 'groq' ? GROQ_API_KEY : MOONSHOT_API_KEY;
            const openaiMessages = [
                { role: 'system', content: systemPrompt },
                ...contextMessages.map(m => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                }))
            ];
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: tier.model,
                    messages: openaiMessages,
                    max_tokens: maxTokens,
                    stream: true
                })
            });
        }

        if (!response.ok) {
            let errMsg = 'Failed to generate code.';
            try { const errData = await response.json(); errMsg = errData.error?.message || errMsg; } catch (e) {}
            console.error(provider + ' error:', response.status, errMsg);
            // Refund credits if Opus
            if (tier.credits > 0 && !admin && !anonymous) {
                await supabase.from('human_profiles')
                    .update({ credits: creditsRemaining + tier.credits })
                    .eq('id', profileId);
                creditsRemaining += tier.credits;
            }
            let userMsg = errMsg;
            if (response.status === 429 || /credit balance|rate limit|overloaded/i.test(errMsg)) {
                userMsg = 'AI service is temporarily unavailable. Please try again in a moment.';
            }
            return res.status(503).json({
                error: userMsg,
                credits_remaining: creditsRemaining
            });
        }

        // Set up SSE streaming to client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send session info immediately so client can track it
        res.write('data: ' + JSON.stringify({ type: 'session', session_id: sessionId, title: sessionTitle }) + '\n\n');

        // Read the SSE stream from provider
        assistantText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let geminiAccumulated = ''; // Track accumulated text for Gemini (in case it returns full text instead of deltas)

        // Keep-alive: send SSE comment every 15s to prevent proxy/CDN timeouts
        const keepAlive = setInterval(() => {
            try { res.write(': keepalive\n\n'); } catch (e) {}
        }, 15000);

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
                    let deltaText = null;

                    if (provider === 'anthropic') {
                        if (event.type === 'content_block_delta' && event.delta?.text) {
                            deltaText = event.delta.text;
                        } else if (event.type === 'message_delta' && event.usage) {
                            outputTokens = event.usage.output_tokens || 0;
                        } else if (event.type === 'message_start' && event.message?.usage) {
                            inputTokens = event.message.usage.input_tokens || 0;
                        }
                    } else if (provider === 'gemini') {
                        const chunkText = event.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (chunkText) {
                            // Gemini may return accumulated or delta text — handle both
                            if (chunkText.startsWith(geminiAccumulated) && geminiAccumulated.length > 0) {
                                deltaText = chunkText.slice(geminiAccumulated.length);
                            } else {
                                deltaText = chunkText;
                            }
                            geminiAccumulated += deltaText;
                        }
                    } else {
                        // OpenAI-compatible (Groq, DeepSeek)
                        const chunk = event.choices?.[0]?.delta?.content;
                        if (chunk) deltaText = chunk;
                    }

                    if (deltaText) {
                        assistantText += deltaText;
                        res.write('data: ' + JSON.stringify({ type: 'delta', text: deltaText }) + '\n\n');
                    }
                } catch (e) { /* skip unparseable lines */ }
            }
        }

        clearInterval(keepAlive);

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
                    // Edit blocks detected but couldn't parse — keep existing code
                    code = existingCode;
                } else {
                    const result = applyEdits(existingCode, blocks);
                    if (result.applied > 0) {
                        code = result.code;
                    } else {
                        // All blocks failed to match — keep existing code unchanged
                        console.warn('All edit blocks failed, preserving existing code');
                        code = existingCode;
                    }
                    if (result.errors.length > 0) {
                        console.warn('Edit block failures (' + result.applied + '/' + blocks.length + ' applied):', result.errors);
                    }
                }
            } else {
                // Edit mode but no code block and no edit blocks — keep existing code
                code = existingCode;
            }
        } else {
            code = extractHtml(assistantText);
        }
        const tokensUsed = inputTokens + outputTokens;

        // Inject error handler into generated code for auto-error detection
        if (code) {
            code = injectErrorHandler(code);
        }

        // Save messages to DB (skip for anonymous)
        if (sessionId) {
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
                credits_charged: admin ? 0 : tier.credits
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
        }

        // Send final event with metadata
        res.write('data: ' + JSON.stringify({
            type: 'done',
            code: code,
            credits_remaining: creditsRemaining,
            tier_used: tierKey,
            credits_charged: admin ? 0 : tier.credits,
            surcharge: 0
        }) + '\n\n');

        return res.end();

    } catch (error) {
        if (typeof keepAlive !== 'undefined') clearInterval(keepAlive);
        console.error('Build studio error:', error);

        // Attempt to save partial work if we have a session and any streamed text
        if (sessionId && assistantText && assistantText.length > 50) {
            try {
                const partialCode = extractHtml(assistantText);
                await supabase.from('build_messages').insert([
                    { session_id: sessionId, role: 'user', content: message, tokens_used: 0, credits_charged: 0 },
                    { session_id: sessionId, role: 'assistant', content: assistantText, code: partialCode, tokens_used: 0, credits_charged: 0 }
                ]);
                if (partialCode) {
                    await supabase.from('build_sessions')
                        .update({ current_code: partialCode, updated_at: new Date().toISOString() })
                        .eq('id', sessionId);
                }
                console.log('Saved partial result for session', sessionId, 'code:', !!partialCode);
            } catch (saveErr) {
                console.error('Failed to save partial result:', saveErr);
            }
        }

        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to generate. Please try again.' });
        }
        try { res.end(); } catch (e) {}
    }
}
