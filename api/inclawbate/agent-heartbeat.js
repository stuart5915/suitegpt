// Inclawbator AI Agent Heartbeat — Cron (every 30 min)
// Finds active agents that are due, generates a tweet via Claude Haiku, posts to X.
// Self-funding: 1 credit per post, goes dormant when broke.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DAILY_POST_CAP = 40; // global cap across all agents (X Basic tier safety)

// ── Tweet generation ──

const PILLARS = [
    'community', 'utility', 'staking', 'milestones',
    'degen culture', 'memes', 'market vibes', 'ecosystem growth'
];

async function generateTweet(project) {
    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];

    const systemPrompt = `You are an AI agent for $${project.token_symbol} (${project.token_name}). You tweet from @inclawbate on behalf of this project.

${project.agent_persona ? 'Personality: ' + project.agent_persona : ''}
${project.description ? 'Project: ' + project.description : ''}
${project.website_url ? 'Website: ' + project.website_url : ''}

Rules:
- Under 280 characters (STRICT — count carefully)
- Mention $${project.token_symbol} naturally
- No hashtags
- No "excited to announce" or any corporate speak
- No em dashes
- No quotation marks around the tweet
- Output ONLY the tweet text, nothing else
- Be creative, varied, and authentic`;

    const userMessage = `Today's content angle: ${pillar}

Write a tweet:`;

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
            messages: [{ role: 'user', content: userMessage }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Claude API error');
    }

    return (data.content?.[0]?.text || '').trim();
}

// ── X OAuth 1.0a posting (reused from post-to-x.js) ──

async function postTweet(text) {
    const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
        throw new Error('X API credentials not configured');
    }

    const oauth = {
        oauth_consumer_key: X_API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: X_ACCESS_TOKEN,
        oauth_version: '1.0'
    };

    const url = 'https://api.twitter.com/2/tweets';

    const paramString = Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
        .join('&');

    const signatureBase = [
        'POST',
        encodeURIComponent(url),
        encodeURIComponent(paramString)
    ].join('&');

    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
    oauth.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
        .join(', ');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || data.title || 'X API post failed');
    }

    return data.data?.id || null;
}

// ── Main handler ──

export default async function handler(req, res) {
    // Verify cron auth
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    try {
        // Check global daily post count (last 24h across all agents)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentPosts } = await supabase
            .from('inclawbator_agent_posts')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo)
            .eq('status', 'posted');

        if ((recentPosts || 0) >= DAILY_POST_CAP) {
            return res.status(200).json({ message: 'Daily post cap reached', cap: DAILY_POST_CAP });
        }

        // Find agents that are due
        const { data: projects, error: queryErr } = await supabase
            .from('inclawbator_projects')
            .select('*')
            .eq('agent_enabled', true)
            .eq('agent_status', 'active')
            .eq('status', 'active')
            .gt('agent_credits', 0);

        if (queryErr) throw queryErr;
        if (!projects || projects.length === 0) {
            return res.status(200).json({ message: 'No active agents' });
        }

        const now = Date.now();
        let posted = 0;
        let dormant = 0;
        const errors = [];

        for (const project of projects) {
            // Check if we've hit the daily cap during this run
            if ((recentPosts || 0) + posted >= DAILY_POST_CAP) break;

            // Check if enough time has passed since last post
            const intervalMs = (24 * 60 * 60 * 1000) / (project.agent_posts_per_day || 4);
            const lastPost = project.agent_last_post_at ? new Date(project.agent_last_post_at).getTime() : 0;

            if (now - lastPost < intervalMs) continue; // not due yet

            // Deduct 1 credit atomically
            const { data: newBalance } = await supabase.rpc('deduct_agent_credit', {
                p_project_id: project.id,
                p_amount: 1
            });

            if (newBalance === -1) {
                // Insufficient credits — go dormant
                await supabase
                    .from('inclawbator_projects')
                    .update({ agent_status: 'dormant' })
                    .eq('id', project.id);
                dormant++;
                continue;
            }

            try {
                // Generate tweet
                const tweetText = await generateTweet(project);
                if (!tweetText || tweetText.length > 280) {
                    throw new Error('Generated tweet invalid or too long');
                }

                // Post to X
                const tweetId = await postTweet(tweetText);

                // Record post
                await supabase
                    .from('inclawbator_agent_posts')
                    .insert({
                        project_id: project.id,
                        tweet_text: tweetText,
                        tweet_id: tweetId,
                        credits_cost: 1,
                        status: 'posted'
                    });

                // Update project
                await supabase
                    .from('inclawbator_projects')
                    .update({
                        agent_last_post_at: new Date().toISOString(),
                        agent_total_posts: (project.agent_total_posts || 0) + 1
                    })
                    .eq('id', project.id);

                posted++;

            } catch (postErr) {
                // Record failed post
                await supabase
                    .from('inclawbator_agent_posts')
                    .insert({
                        project_id: project.id,
                        tweet_text: postErr.message || 'Generation failed',
                        credits_cost: 1,
                        status: 'failed',
                        error_message: postErr.message
                    });

                // Refund the credit on failure
                await supabase.rpc('add_agent_credits', {
                    p_project_id: project.id,
                    p_amount: 1
                });

                errors.push(`${project.token_symbol}: ${postErr.message}`);
            }
        }

        return res.status(200).json({
            posted,
            dormant,
            agents_checked: projects.length,
            ...(errors.length ? { errors } : {})
        });

    } catch (e) {
        console.error('Agent heartbeat error:', e);
        return res.status(500).json({ error: e.message || 'Internal server error' });
    }
}
