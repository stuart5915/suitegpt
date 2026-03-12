// Inclawbate — Agent Auto-Reply Heartbeat (cron every 15 min)
// For each agent with auto_reply enabled:
//   1. Poll X mentions since last seen
//   2. Generate reply via Claude Haiku
//   3. Post reply to X
//   4. Log in agent_replies table

import { createClient } from '@supabase/supabase-js';
import { TONE_DESCRIPTIONS, DEFAULT_TOPICS } from './_agent-utils.js';
import { refreshAccessToken } from './x-connect-project.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_REPLIES_PER_RUN = 3;     // max replies per heartbeat run (spread them out)
const DEFAULT_DAILY_LIMIT = 10;    // default daily reply cap
const MENTION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // ignore mentions older than 12h

// ── Count today's replies for an agent ──

async function getRepliesUsedToday(projectId) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
        .from('agent_replies')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'posted')
        .gte('created_at', startOfDay.toISOString());
    return count || 0;
}

// ── Fetch mentions for a user ──

async function fetchMentions(xUserId, sinceId, accessToken) {
    const params = new URLSearchParams({
        max_results: '10',
        'tweet.fields': 'created_at,author_id,conversation_id,in_reply_to_user_id',
        expansions: 'author_id',
        'user.fields': 'username'
    });
    if (sinceId) params.set('since_id', sinceId);

    const resp = await fetch(
        `https://api.twitter.com/2/users/${xUserId}/mentions?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (resp.status === 401) return { expired: true };
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || err.title || `Mentions API ${resp.status}`);
    }

    const data = await resp.json();
    // Build author lookup
    const authors = {};
    (data.includes?.users || []).forEach(u => { authors[u.id] = u.username; });

    return {
        tweets: (data.data || []).map(t => ({
            id: t.id,
            text: t.text,
            author_id: t.author_id,
            author_username: authors[t.author_id] || null,
            created_at: t.created_at,
            conversation_id: t.conversation_id
        })),
        newest_id: data.meta?.newest_id || null
    };
}

// ── Generate a reply using Claude Haiku ──

async function generateReply(mention, project) {
    const tone = project.agent_tone || 'chill';
    const toneDesc = TONE_DESCRIPTIONS[tone] || 'Natural, authentic, conversational.';
    const symbol = project.token_symbol;
    const projectName = project.name || 'this project';
    const tokenRef = symbol ? `$${symbol}` : projectName;

    const systemPrompt = `You are an AI agent for ${tokenRef}. You tweet as @${project.x_handle || 'this account'}.

Tone: ${toneDesc}
${project.agent_catchphrase ? 'Signature style: ' + project.agent_catchphrase : ''}
${project.description ? 'Project: ' + project.description : ''}

You received a mention on X from @${mention.author_username || 'someone'}. Write a reply.

Rules:
- Under 240 characters (STRICT)
- Reply naturally — acknowledge what they said
- Stay in character
- Don't be overly promotional or salesy
- No hashtags, no em dashes
- Don't repeat their message back to them
- If it's spam, trolling, or nonsensical, reply briefly and move on
- If they ask a genuine question about the project, answer helpfully
- Output ONLY the reply text, nothing else`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Their tweet:\n"${mention.text}"\n\nWrite your reply:` }]
        })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Claude API error');

    let text = (data.content?.[0]?.text || '').trim();
    // Remove quotes if Claude wrapped it
    if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    return text;
}

// ── Post a reply to X ──

async function postReply(text, mentionTweetId, accessToken) {
    const resp = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text,
            reply: { in_reply_to_tweet_id: mentionTweetId }
        })
    });

    if (resp.status === 401) return { expired: true };
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || err.title || `Post reply failed ${resp.status}`);
    }

    const data = await resp.json();
    return { tweetId: data.data?.id || null };
}

// ── Process one agent ──

async function processAgent(project, errors) {
    if (!project.agent_x_user_id) {
        errors.push(`${project.name}: No X user ID stored — reconnect X`);
        return 0;
    }

    // Check daily limit
    const dailyLimit = project.agent_reply_limit || DEFAULT_DAILY_LIMIT;
    const usedToday = await getRepliesUsedToday(project.id);
    const remaining = dailyLimit - usedToday;
    if (remaining <= 0) return 0; // daily cap reached

    let accessToken = project.x_access_token;
    let replied = 0;
    const maxThisRun = Math.min(MAX_REPLIES_PER_RUN, remaining);

    // Fetch mentions
    let mentionResult;
    try {
        mentionResult = await fetchMentions(project.agent_x_user_id, project.agent_last_mention_id, accessToken);
    } catch (e) {
        errors.push(`${project.name}: ${e.message}`);
        return 0;
    }

    // Handle expired token
    if (mentionResult.expired) {
        const newTokens = await refreshAccessToken(project.x_refresh_token);
        if (!newTokens) {
            errors.push(`${project.name}: Token expired, refresh failed`);
            return 0;
        }
        accessToken = newTokens.access_token;
        await supabase.from('projects').update({
            x_access_token: newTokens.access_token,
            x_refresh_token: newTokens.refresh_token || project.x_refresh_token
        }).eq('id', project.id);

        try {
            mentionResult = await fetchMentions(project.agent_x_user_id, project.agent_last_mention_id, accessToken);
        } catch (e) {
            errors.push(`${project.name}: ${e.message}`);
            return 0;
        }
    }

    const mentions = mentionResult.tweets || [];
    if (!mentions.length) return 0;

    // Update last mention ID (even if we skip all — so we don't re-process)
    if (mentionResult.newest_id) {
        await supabase.from('projects').update({
            agent_last_mention_id: mentionResult.newest_id
        }).eq('id', project.id);
    }

    // Process each mention (newest first, limit per run + daily cap)
    const now = Date.now();
    for (const mention of mentions.slice(0, maxThisRun)) {
        // Skip self-mentions
        if (mention.author_username && mention.author_username.toLowerCase() === (project.x_handle || '').toLowerCase()) {
            await logReply(project.id, mention, '', 'skipped', 'Self-mention');
            continue;
        }

        // Skip old mentions (>24h)
        if (mention.created_at && (now - new Date(mention.created_at).getTime()) > MENTION_MAX_AGE_MS) {
            await logReply(project.id, mention, '', 'skipped', 'Too old');
            continue;
        }

        // Check if we already replied to this mention
        const { data: existing } = await supabase
            .from('agent_replies')
            .select('id')
            .eq('mention_tweet_id', mention.id)
            .limit(1);
        if (existing && existing.length > 0) continue;

        try {
            // Generate reply
            const replyText = await generateReply(mention, project);
            if (!replyText || replyText.length > 280) {
                await logReply(project.id, mention, replyText || '', 'failed', 'Reply too long or empty');
                continue;
            }

            // Post reply
            let postResult = await postReply(replyText, mention.id, accessToken);

            // Handle token expiry on post
            if (postResult.expired) {
                const newTokens = await refreshAccessToken(project.x_refresh_token);
                if (newTokens) {
                    accessToken = newTokens.access_token;
                    await supabase.from('projects').update({
                        x_access_token: newTokens.access_token,
                        x_refresh_token: newTokens.refresh_token || project.x_refresh_token
                    }).eq('id', project.id);
                    postResult = await postReply(replyText, mention.id, accessToken);
                }
                if (postResult.expired) {
                    await logReply(project.id, mention, replyText, 'failed', 'Token expired');
                    break;
                }
            }

            await logReply(project.id, mention, replyText, 'posted', null, postResult.tweetId);
            replied++;

        } catch (e) {
            await logReply(project.id, mention, '', 'failed', e.message);
            errors.push(`${project.name}: Reply failed — ${e.message}`);
        }
    }

    return replied;
}

async function logReply(projectId, mention, replyText, status, errorMessage, replyTweetId) {
    await supabase.from('agent_replies').insert({
        project_id: projectId,
        mention_tweet_id: mention.id,
        mention_text: (mention.text || '').slice(0, 500),
        mention_author: mention.author_username || null,
        reply_tweet_id: replyTweetId || null,
        reply_text: replyText || '',
        status,
        error_message: errorMessage || null
    });
}

// ── Main handler ──

export default async function handler(req, res) {
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    try {
        // Find agents with auto-reply enabled + X connected
        const { data: projects, error: queryErr } = await supabase
            .from('projects')
            .select('*')
            .eq('agent_enabled', true)
            .eq('agent_auto_reply', true)
            .not('x_access_token', 'is', null);

        if (queryErr) throw queryErr;
        if (!projects || !projects.length) {
            return res.status(200).json({ message: 'No agents with auto-reply enabled' });
        }

        let totalReplied = 0;
        const errors = [];

        for (const project of projects) {
            const count = await processAgent(project, errors);
            totalReplied += count;
        }

        return res.status(200).json({
            replied: totalReplied,
            agents_checked: projects.length,
            ...(errors.length ? { errors } : {})
        });

    } catch (e) {
        console.error('Reply heartbeat error:', e);
        return res.status(500).json({ error: e.message || 'Internal error' });
    }
}
