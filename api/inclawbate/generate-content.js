// Generate AI tweet drafts for the content calendar
// POST /api/inclawbate/generate-content
// Deducts 25 credits per generation (Sonnet)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
// Angel free pass removed — only admin wallet gets free access

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const FREE_CREDIT_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'  // inclawbate.base.eth
];
const CREDIT_COST = 50; // Sonnet-tier

const SYSTEM_PROMPTS = {
    artstu: `You are ghostwriting tweets for @artstu — a builder in AI + crypto, founder of inclawbate, based in Canada.

Voice: casual, authentic, sometimes provocative. Talks like a real person, not a brand. First person. Short punchy sentences.

Rules:
- Under 280 characters (STRICT — count carefully)
- No hashtags
- No "excited to announce" or any corporate speak
- No em dashes
- No quotation marks around the tweet
- Output ONLY the tweet text, nothing else`,

    inclawbate: `You are ghostwriting tweets for @inclawbate — an AI agent platform where agents incubate humans. Lobster brand on Base chain.

Voice: playful, crypto-native, community-driven. Can use lobster emoji. Personality over announcements.

Rules:
- Under 280 characters (STRICT — count carefully)
- Minimal hashtags (0-1 max)
- No "excited to announce" or corporate speak
- No em dashes
- No quotation marks around the tweet
- Output ONLY the tweet text, nothing else`
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Auth — JWT or API key
    let profileId = null;
    const user = authenticateRequest(req);
    if (user) {
        profileId = user.sub;
    } else {
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            const { data } = await supabase
                .from('human_profiles')
                .select('id')
                .eq('api_key', apiKey)
                .single();
            if (data) profileId = data.id;
        }
    }

    if (!profileId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    // Credit check
    const { data: profile } = await supabase
        .from('human_profiles')
        .select('id, credits, wallet_address, x_handle')
        .eq('id', profileId)
        .single();

    const isAdmin = FREE_CREDIT_WALLETS.includes(profile?.wallet_address?.toLowerCase());

    if (!isAdmin) {
        if ((profile?.credits || 0) < CREDIT_COST) {
            return res.status(402).json({ error: 'Insufficient credits.', credits: profile?.credits || 0 });
        }
    }

    const { account, pillar, context } = req.body || {};

    if (!account || !pillar) {
        return res.status(400).json({ error: 'Missing account or pillar' });
    }

    const systemPrompt = SYSTEM_PROMPTS[account];
    if (!systemPrompt) {
        return res.status(400).json({ error: 'Invalid account. Use "artstu" or "inclawbate".' });
    }

    const userMessage = `Today's content pillar: ${pillar}
Prompt: ${context || pillar}

Write a tweet:`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 400,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Failed to generate draft'
            });
        }

        const draft = data.content?.[0]?.text || '';

        // Deduct credits
        let creditsRemaining = profile?.credits || 0;
        if (!isAdmin) {
            creditsRemaining = creditsRemaining - CREDIT_COST;
            await supabase.from('human_profiles')
                .update({ credits: creditsRemaining })
                .eq('id', profile.id);
        }

        return res.status(200).json({ draft: draft.trim(), credits: creditsRemaining });

    } catch (err) {
        console.error('generate-content error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
