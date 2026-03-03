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

const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const FREE_HANDLES = ['artstu'];

const MODEL_TIERS = {
    fast:     { model: 'claude-haiku-4-5-20251001',  credits: 5,  label: 'Fast' },
    standard: { model: 'claude-sonnet-4-5-20250929', credits: 15, label: 'Standard' },
    pro:      { model: 'claude-opus-4-6-20250214',   credits: 40, label: 'Pro' }
};

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

Output format: Always wrap your HTML in a single \`\`\`html code block. You may include a brief explanation before the code block, but the code block is required.`;

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
    return profile?.wallet_address?.toLowerCase() === ADMIN_WALLET
        || FREE_HANDLES.includes(profile?.x_handle?.toLowerCase());
}

function extractHtml(text) {
    const match = text.match(/```html\s*([\s\S]*?)```/);
    return match ? match[1].trim() : null;
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

    // ── GET: list sessions or load one ──
    if (req.method === 'GET') {
        const { session_id } = req.query;

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

    try {
        const { session_id, message } = req.body;

        if (!message || !message.trim()) {
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
            // Verify ownership
            const { data: existing } = await supabase
                .from('build_sessions')
                .select('id, title')
                .eq('id', sessionId)
                .eq('profile_id', profileId)
                .single();

            if (!existing) return res.status(404).json({ error: 'Session not found.' });
            sessionTitle = existing.title;
        }

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

        // Add current user message
        contextMessages.push({ role: 'user', content: message });

        // Call Claude
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: tier.model,
                max_tokens: 8000,
                system: SYSTEM_PROMPT,
                messages: contextMessages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Failed to generate code.'
            });
        }

        const assistantText = data.content?.[0]?.text || '';
        const code = extractHtml(assistantText);
        const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

        // Save user message
        await supabase.from('build_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: message,
            tokens_used: 0,
            credits_charged: 0
        });

        // Save assistant message
        await supabase.from('build_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: assistantText,
            code: code,
            tokens_used: tokensUsed,
            credits_charged: admin ? 0 : tier.credits
        });

        // Update session with latest code
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

        // Deduct credits based on tier
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
                creditsRemaining = 0;
            } else {
                creditsRemaining = updated.credits;
            }
        }

        return res.json({
            session_id: sessionId,
            title: sessionTitle,
            message: assistantText,
            code: code,
            credits_remaining: creditsRemaining,
            tier_used: tierKey,
            credits_charged: admin ? 0 : tier.credits
        });

    } catch (error) {
        console.error('Build studio error:', error);
        return res.status(500).json({ error: 'Failed to generate. Please try again.' });
    }
}
