// Generate an AI reply to a tweet using Claude Sonnet
// Called by the Inclawbate Chrome extension
// Supports JWT auth (dashboard) or API key auth (extension)
// Deducts 1 credit per generation

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || /^chrome-extension:\/\//.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Dual auth: try JWT first, then API key
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
        return res.status(401).json({ error: 'Authentication required. Provide a JWT token or X-API-Key header.' });
    }

    // Check credits before generating
    const { data: profile } = await supabase
        .from('human_profiles')
        .select('credits')
        .eq('id', profileId)
        .single();

    if (!profile || profile.credits <= 0) {
        return res.status(402).json({
            error: 'No credits remaining. Deposit $CLAWNCH at inclawbate.com/dashboard to get more.',
            credits: 0
        });
    }

    const { ANTHROPIC_API_KEY } = process.env;
    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    try {
        const { tweetText, tweetAuthor, threadContext, parameters } = req.body;

        if (!tweetText) {
            return res.status(400).json({ error: 'tweetText is required' });
        }

        const {
            tone = 'casual',
            persona = '',
            goals = '',
            topics = '',
            maxLength = 280,
            style = ''
        } = parameters || {};

        const systemPrompt = `You are a ghostwriter generating X/Twitter replies for a human user. Write a reply to the tweet below.

Rules:
- Reply MUST be under ${maxLength} characters (hard limit)
- Write as the user, not as an AI — natural, human voice
- No hashtags unless explicitly requested
- No emojis unless the tone calls for it
- Match the energy and context of the tweet
- Be conversational, not corporate
- If the tweet is a question, answer it. If it's an opinion, engage with it. If it's a joke, riff on it.
- Output ONLY the reply text, nothing else — no quotes, no explanation

${persona ? `User persona: ${persona}` : ''}
${goals ? `User goals for replies: ${goals}` : ''}
${topics ? `Topics the user cares about: ${topics}` : ''}
${style ? `Additional style notes: ${style}` : ''}
Tone: ${tone}`;

        const userMessage = `${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Tweet by @${tweetAuthor || 'unknown'}:\n"${tweetText}"

Write a reply:`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Failed to generate reply'
            });
        }

        const reply = data.content?.[0]?.text?.trim() || '';

        // Deduct 1 credit
        const { data: newBalance } = await supabase
            .rpc('deduct_inclawbate_credit', { profile_id: profileId });

        // Increment lifetime reply counter (for leaderboard)
        await supabase.rpc('increment_inclawbator_replies', { profile_id: profileId });

        const creditsRemaining = newBalance >= 0 ? newBalance : 0;

        return res.status(200).json({ reply, credits_remaining: creditsRemaining });

    } catch (error) {
        console.error('Generate reply error:', error);
        return res.status(500).json({ error: 'Failed to generate reply' });
    }
}
