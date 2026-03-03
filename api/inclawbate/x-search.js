// X Search — Backend API
// POST /api/inclawbate/x-search
// Actions: search, like, unlike, retweet, reply, ai-reply

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

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ADMIN_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0xa00e81ecedd4d007965997c6cc64d9372bec397e',
    '0x612abfe54269515f0cc63b4a12fee32d48889ff2'
];
const FREE_HANDLES = ['artstu'];

// In-memory search cache (query hash → { results, timestamp })
const searchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Authenticate
    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const profileId = user.sub;

    // Fetch profile (credits, tokens)
    const { data: profile } = await supabase
        .from('human_profiles')
        .select('id, credits, x_access_token, x_refresh_token, x_id, x_handle, wallet_address')
        .eq('id', profileId)
        .single();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const isAdmin = ADMIN_WALLETS.includes(profile.wallet_address?.toLowerCase())
        || FREE_HANDLES.includes(profile.x_handle?.toLowerCase());

    const { action } = req.body;

    switch (action) {
        case 'search': return handleSearch(req, res, profile, isAdmin);
        case 'like': return handleLike(req, res, profile);
        case 'unlike': return handleUnlike(req, res, profile);
        case 'retweet': return handleRetweet(req, res, profile);
        case 'reply': return handleReply(req, res, profile);
        case 'ai-reply': return handleAiReply(req, res, profile, isAdmin);
        default: return res.status(400).json({ error: 'Invalid action' });
    }
}

// ── Search ──
async function handleSearch(req, res, profile, isAdmin) {
    const { query, time_range, verified_only, has_media, exclude_replies, exclude_retweets, max_results } = req.body;

    if (!query || !query.trim()) return res.status(400).json({ error: 'Query is required' });

    if (!X_BEARER_TOKEN) return res.status(500).json({ error: 'X API not configured' });

    // Build full query
    let fullQuery = query.trim();
    if (exclude_replies) fullQuery += ' -is:reply';
    if (exclude_retweets) fullQuery += ' -is:retweet';
    if (verified_only) fullQuery += ' is:verified';
    if (has_media) fullQuery += ' has:media';
    fullQuery += ' lang:en';

    // Check cache
    const cacheKey = fullQuery + '|' + (time_range || '24h');
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({ tweets: cached.results, credits: profile.credits, cached: true });
    }

    // Deduct 1 credit (unless admin)
    let creditsRemaining = profile.credits || 0;
    if (!isAdmin) {
        if (creditsRemaining <= 0) {
            return res.status(402).json({ error: 'No credits remaining. Buy more at inclawbate.com/deposit', credits: 0 });
        }
        const { data: newBalance } = await supabase.rpc('deduct_inclawbate_credit', { profile_id: profile.id });
        creditsRemaining = newBalance >= 0 ? newBalance : 0;
    }

    // Time range → start_time
    const now = new Date();
    const timeMap = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    const hoursBack = timeMap[time_range] || 24;
    const startTime = new Date(now.getTime() - hoursBack * 3600000).toISOString();

    // Call X API
    const params = new URLSearchParams({
        query: fullQuery,
        max_results: String(Math.min(parseInt(max_results) || 100, 100)),
        start_time: startTime,
        'tweet.fields': 'created_at,public_metrics,author_id',
        'user.fields': 'name,username,profile_image_url,verified,public_metrics',
        expansions: 'author_id'
    });

    try {
        const xRes = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
            headers: { 'Authorization': 'Bearer ' + X_BEARER_TOKEN }
        });

        if (!xRes.ok) {
            const xErr = await xRes.json().catch(() => ({}));
            console.error('X API search error:', xRes.status, xErr);
            return res.status(xRes.status === 429 ? 429 : 502).json({
                error: xRes.status === 429 ? 'Rate limited. Try again in a minute.' : 'X API search failed',
                credits: creditsRemaining
            });
        }

        const xData = await xRes.json();
        const tweets = xData.data || [];
        const users = xData.includes?.users || [];

        // Map user data onto tweets
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });

        const enriched = tweets.map(t => ({
            ...t,
            author: userMap[t.author_id] || {}
        }));

        // Cache results
        searchCache.set(cacheKey, { results: enriched, timestamp: Date.now() });

        // Clean old cache entries
        if (searchCache.size > 100) {
            for (const [k, v] of searchCache) {
                if (Date.now() - v.timestamp > CACHE_TTL) searchCache.delete(k);
            }
        }

        return res.status(200).json({ tweets: enriched, credits: creditsRemaining });
    } catch (err) {
        console.error('X search error:', err);
        return res.status(500).json({ error: 'Search failed', credits: creditsRemaining });
    }
}

// ── Token refresh helper ──
async function getUserToken(profile) {
    let token = profile.x_access_token;
    if (!token) return null;

    // Try the existing token first — if it fails with 401, refresh
    return token;
}

async function refreshUserToken(profile) {
    if (!profile.x_refresh_token || !X_CLIENT_ID || !X_CLIENT_SECRET) return null;

    try {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: profile.x_refresh_token,
            client_id: X_CLIENT_ID
        });

        const creds = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
        const res = await fetch('https://api.x.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + creds
            },
            body: params.toString()
        });

        if (!res.ok) return null;
        const data = await res.json();

        // Update tokens in DB
        await supabase
            .from('human_profiles')
            .update({
                x_access_token: data.access_token,
                x_refresh_token: data.refresh_token || profile.x_refresh_token
            })
            .eq('id', profile.id);

        return data.access_token;
    } catch (e) {
        console.error('Token refresh failed:', e);
        return null;
    }
}

// Helper: make X API call with auto-retry on 401 (token refresh)
async function xUserRequest(profile, method, url, body) {
    let token = await getUserToken(profile);
    if (!token) return { ok: false, status: 401, error: 'No X access token. Please re-connect your X account.' };

    let xRes = await fetch(url, {
        method,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    // If 401, try refreshing token
    if (xRes.status === 401) {
        token = await refreshUserToken(profile);
        if (!token) return { ok: false, status: 401, error: 'X token expired. Please re-connect your X account at /launch' };

        xRes = await fetch(url, {
            method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });
    }

    const data = await xRes.json().catch(() => ({}));
    return { ok: xRes.ok, status: xRes.status, data };
}

// ── Like ──
async function handleLike(req, res, profile) {
    const { tweet_id } = req.body;
    if (!tweet_id) return res.status(400).json({ error: 'tweet_id required' });

    const result = await xUserRequest(profile, 'POST', `https://api.x.com/2/users/${profile.x_id}/likes`, { tweet_id });
    if (!result.ok) return res.status(result.status).json({ error: result.error || 'Like failed' });
    return res.status(200).json({ success: true, liked: result.data?.data?.liked });
}

// ── Unlike ──
async function handleUnlike(req, res, profile) {
    const { tweet_id } = req.body;
    if (!tweet_id) return res.status(400).json({ error: 'tweet_id required' });

    const result = await xUserRequest(profile, 'DELETE', `https://api.x.com/2/users/${profile.x_id}/likes/${tweet_id}`);
    if (!result.ok) return res.status(result.status).json({ error: result.error || 'Unlike failed' });
    return res.status(200).json({ success: true });
}

// ── Retweet ──
async function handleRetweet(req, res, profile) {
    const { tweet_id } = req.body;
    if (!tweet_id) return res.status(400).json({ error: 'tweet_id required' });

    const result = await xUserRequest(profile, 'POST', `https://api.x.com/2/users/${profile.x_id}/retweets`, { tweet_id });
    if (!result.ok) return res.status(result.status).json({ error: result.error || 'Retweet failed' });
    return res.status(200).json({ success: true, retweeted: result.data?.data?.retweeted });
}

// ── Reply ──
async function handleReply(req, res, profile) {
    const { tweet_id, text } = req.body;
    if (!tweet_id || !text?.trim()) return res.status(400).json({ error: 'tweet_id and text required' });
    if (text.length > 280) return res.status(400).json({ error: 'Reply exceeds 280 characters' });

    const result = await xUserRequest(profile, 'POST', 'https://api.x.com/2/tweets', {
        text: text.trim(),
        reply: { in_reply_to_tweet_id: tweet_id }
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error || 'Reply failed' });
    return res.status(200).json({ success: true, tweet_id: result.data?.data?.id });
}

// ── AI Reply ──
async function handleAiReply(req, res, profile, isAdmin) {
    const { tweet_id, tweet_text, author_handle } = req.body;
    if (!tweet_text) return res.status(400).json({ error: 'tweet_text required' });

    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured' });

    // Deduct 1 credit
    let creditsRemaining = profile.credits || 0;
    if (!isAdmin) {
        if (creditsRemaining <= 0) {
            return res.status(402).json({ error: 'No credits remaining.', credits: 0 });
        }
        const { data: newBalance } = await supabase.rpc('deduct_inclawbate_credit', { profile_id: profile.id });
        creditsRemaining = newBalance >= 0 ? newBalance : 0;
    }

    const systemPrompt = `You are a ghostwriter generating X/Twitter replies. Write a reply to the tweet below.

Rules:
- Reply MUST be under 280 characters (hard limit)
- Write as the user, not as an AI — natural, human voice
- No hashtags unless the tweet uses them
- Be conversational, not corporate
- If it's a question, answer it. If it's an opinion, engage thoughtfully. If it's a joke, riff on it.
- Output ONLY the reply text, nothing else
Tone: casual, friendly`;

    const userMessage = `Tweet by @${author_handle || 'unknown'}:\n"${tweet_text}"\n\nWrite a reply:`;

    try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
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

        const aiData = await aiRes.json();
        if (!aiRes.ok) {
            console.error('Anthropic error:', aiData);
            return res.status(502).json({ error: 'AI generation failed', credits: creditsRemaining });
        }

        const reply = aiData.content?.[0]?.text?.trim() || '';
        return res.status(200).json({ reply, credits: creditsRemaining });
    } catch (err) {
        console.error('AI reply error:', err);
        return res.status(500).json({ error: 'AI generation failed', credits: creditsRemaining });
    }
}
