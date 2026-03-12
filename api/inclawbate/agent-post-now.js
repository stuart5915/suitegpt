// Inclawbate — Post Now (trigger a single agent post on demand)
// POST { project_id } — generates a tweet and posts it immediately

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500',
];

// ── Tweet generation (same as heartbeat) ──

const TONE_DESCRIPTIONS = {
    hype: 'High energy, bullish, uses exclamation marks. Excited but not cringey.',
    chill: 'Laid back, casual, lowercase vibes. Calm and collected.',
    degen: 'Crypto native, uses slang (gm, ser, lfg, ngmi), meme-aware.',
    professional: 'Informative, clean, data-driven. No slang.',
    meme: 'Funny, ironic, shitpost energy. Absurdist humor.'
};

const DEFAULT_TOPICS = ['community', 'utility', 'staking', 'milestones', 'memes', 'market vibes'];

function parsePersona(persona) {
    const result = { tone: '', topics: [], catchphrase: '' };
    if (!persona) return result;
    const toneMatch = persona.match(/Tone:\s*(\w+)/i);
    if (toneMatch) result.tone = toneMatch[1].toLowerCase();
    const topicMatch = persona.match(/Topics:\s*([^|]+)/i);
    if (topicMatch) result.topics = topicMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const catchMatch = persona.match(/Catchphrase:\s*(.+)/i);
    if (catchMatch) result.catchphrase = catchMatch[1].trim();
    return result;
}

async function generateTweet(project) {
    const persona = parsePersona(project.agent_persona);
    const topics = persona.topics.length ? persona.topics : DEFAULT_TOPICS;
    const pillar = topics[Math.floor(Math.random() * topics.length)];
    const toneDesc = TONE_DESCRIPTIONS[persona.tone] || 'Natural, authentic, conversational.';

    const hasOwnX = project.x_access_token && project.x_refresh_token;
    const accountNote = hasOwnX && project.x_handle
        ? `You tweet as @${project.x_handle}.`
        : `You tweet from @inclawbator on behalf of this project.`;

    const symbol = project.token_symbol;
    const projectName = project.name || 'this project';
    const tokenRef = symbol ? `$${symbol}` : projectName;

    const systemPrompt = `You are an AI agent for ${tokenRef}${symbol ? ' (' + projectName + ')' : ''}. ${accountNote}

Tone: ${toneDesc}
${persona.catchphrase ? 'Signature style: ' + persona.catchphrase : ''}
${project.description ? 'Project: ' + project.description : ''}
${project.website_url ? 'Website: ' + project.website_url : ''}

Rules:
- Under 260 characters (STRICT — leave room for the bot tag at the end)
${symbol ? '- Mention $' + symbol + ' naturally' : '- Mention the project name naturally'}
- No hashtags
- No "excited to announce" or any corporate speak
- No em dashes
- No quotation marks around the tweet
- NEVER say "buy", "invest", "financial advice", "guaranteed returns", or "not financial advice"
- No price predictions or promises of gains
- Output ONLY the tweet text, nothing else
- Be creative, varied, and authentic`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Today's content angle: ${pillar}\n\nWrite a tweet:` }]
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Claude API error');

    let text = (data.content?.[0]?.text || '').trim();
    const tag = '\n\n\ud83e\udd16 via @inclawbator AI';
    if (text.length + tag.length <= 280) text += tag;
    return text;
}

// ── Posting helpers (same as heartbeat) ──

async function refreshOAuth2Token(refreshToken) {
    if (!X_CLIENT_ID || !X_CLIENT_SECRET || !refreshToken) return null;
    const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: X_CLIENT_ID }).toString()
    });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) return null;
    return data;
}

async function postTweetOAuth2(text, accessToken) {
    const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    const data = await response.json();
    if (response.status === 401) return { expired: true };
    if (!response.ok) throw new Error(data.detail || data.title || 'X API post failed');
    return { tweetId: data.data?.id || null };
}

async function postTweet(text, project) {
    const hasOwnX = project.x_access_token && project.x_refresh_token;
    if (!hasOwnX) throw new Error('No X account connected');

    let result = await postTweetOAuth2(text, project.x_access_token);

    if (result.expired) {
        const newTokens = await refreshOAuth2Token(project.x_refresh_token);
        if (newTokens) {
            await supabase.from('projects').update({
                x_access_token: newTokens.access_token,
                x_refresh_token: newTokens.refresh_token || project.x_refresh_token
            }).eq('id', project.id);
            result = await postTweetOAuth2(text, newTokens.access_token);
        }
    }

    if (result.expired) throw new Error('X token expired and refresh failed. Reconnect X.');
    return { tweetId: result.tweetId, posted_via: project.x_handle ? '@' + project.x_handle : 'own_account' };
}

// ── Handler ──

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const { project_id } = req.body || {};
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Fetch project
    const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single();

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Verify ownership
    const userWallet = (user.wallet_address || '').toLowerCase();
    const isOwner = project.creator_profile_id === user.sub ||
        (userWallet && project.creator_wallet === userWallet);
    if (!isOwner) return res.status(403).json({ error: 'Not your project' });

    if (!project.agent_enabled) return res.status(400).json({ error: 'Agent not enabled on this project' });
    if (!project.x_access_token) return res.status(400).json({ error: 'No X account connected. Connect X first.' });

    try {
        // Generate tweet
        const tweetText = await generateTweet(project);
        if (!tweetText || tweetText.length > 280) {
            throw new Error('Generated tweet too long or empty');
        }

        // Post it
        const { tweetId, posted_via } = await postTweet(tweetText, project);

        // Log it
        await supabase.from('project_agent_posts').insert({
            project_id: project.id,
            tweet_text: tweetText,
            tweet_id: tweetId,
            credits_cost: 0,
            status: 'posted',
            posted_via: posted_via || 'own_account'
        });

        // Update project stats
        await supabase.from('projects').update({
            agent_last_post_at: new Date().toISOString(),
            agent_total_posts: (project.agent_total_posts || 0) + 1
        }).eq('id', project.id);

        return res.status(200).json({
            success: true,
            tweet_text: tweetText,
            tweet_id: tweetId,
            posted_via,
            tweet_url: tweetId && project.x_handle
                ? `https://x.com/${project.x_handle}/status/${tweetId}`
                : null
        });

    } catch (e) {
        // Log the failure
        await supabase.from('project_agent_posts').insert({
            project_id: project.id,
            tweet_text: e.message || 'Post failed',
            credits_cost: 0,
            status: 'failed',
            error_message: e.message
        });

        return res.status(500).json({ error: e.message || 'Failed to post' });
    }
}
