// Inclawbator AI Agent Heartbeat — Cron (every 15 min)
// Finds active agents that are due, generates a tweet via Claude Haiku, posts to X.
// If project has its own X account connected (OAuth 2.0), posts there.
// Otherwise falls back to shared @inclawbator account (OAuth 1.0a).
// Credits deducted from project owner's human_profiles.credits (same pool as build).
// Cost: 10 credits per post (same as Haiku in build studio).

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DAILY_POST_CAP = 40; // global cap across all agents
const SHARED_DAILY_CAP = 12; // max posts/day on shared @inclawbator account
const CREDIT_COST = 10; // base cost same as Haiku in build studio

// Admin wallets that bypass credit checks
const FREE_CREDIT_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'  // inclawbate.base.eth
];

// ── Tweet generation ──

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
- Under 280 characters (STRICT — count carefully)
${symbol ? '- Mention $' + symbol + ' naturally' : '- Mention the project name naturally'}
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

// ── Owner credit helpers ──

async function getOwnerProfile(creatorWallet) {
    if (!creatorWallet) return null;
    const wallet = creatorWallet.toLowerCase();

    const { data } = await supabase
        .from('human_profiles')
        .select('id, credits, wallet_address, x_handle')
        .eq('wallet_address', wallet)
        .single();

    return data || null;
}

function isAdmin(profile) {
    return FREE_CREDIT_WALLETS.includes(profile?.wallet_address?.toLowerCase());
}

async function deductOwnerCredits(profileId, amount) {
    // Atomic deduction: only succeeds if credits >= amount
    const { data, error } = await supabase.rpc('deduct_credits', {
        p_profile_id: profileId,
        p_amount: amount
    });
    // If the RPC doesn't exist, fall back to manual update
    if (error) {
        const { data: profile } = await supabase
            .from('human_profiles')
            .select('credits')
            .eq('id', profileId)
            .single();
        if (!profile || (profile.credits || 0) < amount) return -1;
        const newBal = (profile.credits || 0) - amount;
        await supabase
            .from('human_profiles')
            .update({ credits: newBal })
            .eq('id', profileId);
        return newBal;
    }
    return data;
}

async function refundOwnerCredits(profileId, amount) {
    const { data: profile } = await supabase
        .from('human_profiles')
        .select('credits')
        .eq('id', profileId)
        .single();
    if (!profile) return;
    await supabase
        .from('human_profiles')
        .update({ credits: (profile.credits || 0) + amount })
        .eq('id', profileId);
}

// ── OAuth 2.0 token refresh ──

async function refreshOAuth2Token(refreshToken) {
    if (!X_CLIENT_ID || !X_CLIENT_SECRET || !refreshToken) return null;
    const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: X_CLIENT_ID
        }).toString()
    });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) return null;
    return data;
}

// ── Post via project's own X account (OAuth 2.0 Bearer) ──

async function postTweetOAuth2(text, accessToken) {
    const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    // Token expired — caller should refresh and retry
    if (response.status === 401) {
        return { expired: true };
    }

    if (!response.ok) {
        throw new Error(data.detail || data.title || 'X API post failed');
    }

    return { tweetId: data.data?.id || null };
}

// ── Post via shared @inclawbator account (OAuth 1.0a fallback) ──

async function postTweetShared(text) {
    const X_API_KEY = process.env.INCLAWBATOR_X_API_KEY;
    const X_API_SECRET = process.env.INCLAWBATOR_X_API_SECRET;
    const X_ACCESS_TOKEN = process.env.INCLAWBATOR_X_ACCESS_TOKEN;
    const X_ACCESS_SECRET = process.env.INCLAWBATOR_X_ACCESS_SECRET;
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
        throw new Error('INCLAWBATOR X API credentials not configured');
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

// ── Post tweet: try project's own account first, fall back to shared ──

async function postTweet(text, project) {
    const hasOwnX = project.x_access_token && project.x_refresh_token;

    if (hasOwnX) {
        // Try posting with project's token
        let result = await postTweetOAuth2(text, project.x_access_token);

        if (result.expired) {
            // Refresh the token and retry
            const newTokens = await refreshOAuth2Token(project.x_refresh_token);
            if (newTokens) {
                // Save refreshed tokens
                await supabase
                    .from('projects')
                    .update({
                        x_access_token: newTokens.access_token,
                        x_refresh_token: newTokens.refresh_token || project.x_refresh_token
                    })
                    .eq('id', project.id);

                result = await postTweetOAuth2(text, newTokens.access_token);
            }
        }

        if (!result.expired) {
            return { tweetId: result.tweetId, posted_via: project.x_handle ? '@' + project.x_handle : 'own_account' };
        }

        // Token refresh failed — fall through to shared account
    }

    // Fall back to shared @inclawbator
    const tweetId = await postTweetShared(text);
    return { tweetId, posted_via: '@inclawbator' };
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
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const now = Date.now();

        // Find all active agents
        const { data: projects, error: queryErr } = await supabase
            .from('projects')
            .select('*')
            .eq('agent_enabled', true)
            .eq('agent_status', 'active');

        if (queryErr) throw queryErr;
        if (!projects || projects.length === 0) {
            return res.status(200).json({ message: 'No active agents' });
        }

        // Split into two tracks: own X account vs shared @inclawbator
        const ownXProjects = [];
        const sharedProjects = [];

        for (const p of projects) {
            const hasOwnX = p.x_access_token && p.x_refresh_token;
            if (hasOwnX) {
                ownXProjects.push(p);
            } else {
                sharedProjects.push(p);
            }
        }

        // Count today's shared @inclawbator posts
        const { count: sharedPostsToday } = await supabase
            .from('project_agent_posts')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo)
            .eq('status', 'posted')
            .eq('posted_via', '@inclawbator');

        // Count total posts today
        const { count: totalPostsToday } = await supabase
            .from('project_agent_posts')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo)
            .eq('status', 'posted');

        if ((totalPostsToday || 0) >= DAILY_POST_CAP) {
            return res.status(200).json({ message: 'Daily post cap reached', cap: DAILY_POST_CAP });
        }

        let posted = 0;
        let dormant = 0;
        const errors = [];
        const sharedSlotsRemaining = SHARED_DAILY_CAP - (sharedPostsToday || 0);

        // ── TRACK 1: Own X account projects — process normally, no slot limits ──
        for (const project of ownXProjects) {
            if ((totalPostsToday || 0) + posted >= DAILY_POST_CAP) break;

            const intervalMs = (24 * 60 * 60 * 1000) / (project.agent_posts_per_day || 2);
            const lastPost = project.agent_last_post_at ? new Date(project.agent_last_post_at).getTime() : 0;
            if (now - lastPost < intervalMs) continue;

            const result = await processAgentPost(project, errors);
            if (result === 'posted') posted++;
            else if (result === 'dormant') dormant++;
        }

        // ── TRACK 2: Scheduled @inclawbator slots (calendar bookings) ──
        let scheduledPosted = 0;
        const { data: dueSlots } = await supabase
            .from('agent_schedule')
            .select('*, projects(*)')
            .eq('status', 'scheduled')
            .lte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true });

        for (const slot of (dueSlots || [])) {
            if ((totalPostsToday || 0) + posted >= DAILY_POST_CAP) break;

            const project = slot.projects;
            if (!project) {
                await supabase.from('agent_schedule').update({ status: 'failed' }).eq('id', slot.id);
                continue;
            }

            try {
                // Override persona with slot-specific settings
                const slotPersona = [];
                if (slot.tone && slot.tone !== 'default') slotPersona.push('Tone: ' + slot.tone);
                if (slot.content_angle) slotPersona.push('Topics: ' + slot.content_angle);
                if (slot.catchphrase) slotPersona.push('Catchphrase: ' + slot.catchphrase);

                const projectWithPersona = {
                    ...project,
                    agent_persona: slotPersona.length ? slotPersona.join(' | ') : project.agent_persona,
                    // Force shared account context — scheduled slots always post via @inclawbator
                    x_access_token: null,
                    x_refresh_token: null
                };

                const tweetText = await generateTweet(projectWithPersona);
                if (!tweetText || tweetText.length > 280) {
                    throw new Error('Generated tweet invalid or too long');
                }

                // Post to shared @inclawbator
                const tweetId = await postTweetShared(tweetText);

                // Mark slot as posted
                await supabase
                    .from('agent_schedule')
                    .update({ status: 'posted', tweet_text: tweetText, tweet_id: tweetId })
                    .eq('id', slot.id);

                // Also log in project_agent_posts
                await supabase
                    .from('project_agent_posts')
                    .insert({
                        project_id: project.id,
                        tweet_text: tweetText,
                        tweet_id: tweetId,
                        credits_cost: slot.credits_cost || CREDIT_COST,
                        status: 'posted',
                        posted_via: '@inclawbator'
                    });

                await supabase
                    .from('projects')
                    .update({ agent_total_posts: (project.agent_total_posts || 0) + 1 })
                    .eq('id', project.id);

                posted++;
                scheduledPosted++;

            } catch (postErr) {
                await supabase
                    .from('agent_schedule')
                    .update({ status: 'failed', tweet_text: postErr.message })
                    .eq('id', slot.id);

                // Refund credits on failure
                if (!FREE_CREDIT_WALLETS.includes(slot.booked_by_wallet)) {
                    const bookerProfile = await getOwnerProfile(slot.booked_by_wallet);
                    if (bookerProfile) {
                        await refundOwnerCredits(bookerProfile.id, slot.credits_cost || CREDIT_COST);
                    }
                }

                errors.push(`${project.name}: ${postErr.message}`);
            }
        }

        return res.status(200).json({
            posted,
            dormant,
            scheduled_posted: scheduledPosted,
            agents_checked: (projects || []).length,
            credit_cost: CREDIT_COST,
            ...(errors.length ? { errors } : {})
        });

    } catch (e) {
        console.error('Agent heartbeat error:', e);
        return res.status(500).json({ error: e.message || 'Internal server error' });
    }
}

// ── Process a single agent post (shared between both tracks) ──

async function processAgentPost(project, errors) {
    const ownerProfile = await getOwnerProfile(project.creator_wallet);
    if (!ownerProfile) {
        errors.push(`${project.name}: No owner profile found`);
        return 'skip';
    }

    const adminBypass = isAdmin(ownerProfile);

    // Total cost = base + bid (bid only applies to shared @inclawbator posts)
    const hasOwnX = project.x_access_token && project.x_refresh_token;
    const bidCost = hasOwnX ? 0 : (project.agent_bid || 0);
    const totalCost = CREDIT_COST + bidCost;

    // Check credits
    if (!adminBypass && (ownerProfile.credits || 0) < totalCost) {
        await supabase
            .from('projects')
            .update({ agent_status: 'dormant' })
            .eq('id', project.id);
        return 'dormant';
    }

    // Deduct credits
    if (!adminBypass) {
        const newBal = await deductOwnerCredits(ownerProfile.id, totalCost);
        if (newBal === -1) {
            await supabase
                .from('projects')
                .update({ agent_status: 'dormant' })
                .eq('id', project.id);
            return 'dormant';
        }
    }

    try {
        const tweetText = await generateTweet(project);
        if (!tweetText || tweetText.length > 280) {
            throw new Error('Generated tweet invalid or too long');
        }

        const { tweetId, posted_via } = await postTweet(tweetText, project);

        await supabase
            .from('project_agent_posts')
            .insert({
                project_id: project.id,
                tweet_text: tweetText,
                tweet_id: tweetId,
                credits_cost: totalCost,
                status: 'posted',
                posted_via: posted_via || '@inclawbator'
            });

        await supabase
            .from('projects')
            .update({
                agent_last_post_at: new Date().toISOString(),
                agent_total_posts: (project.agent_total_posts || 0) + 1
            })
            .eq('id', project.id);

        return 'posted';

    } catch (postErr) {
        await supabase
            .from('project_agent_posts')
            .insert({
                project_id: project.id,
                tweet_text: postErr.message || 'Generation failed',
                credits_cost: totalCost,
                status: 'failed',
                error_message: postErr.message
            });

        if (!adminBypass) {
            await refundOwnerCredits(ownerProfile.id, totalCost);
        }

        errors.push(`${project.token_symbol || project.name}: ${postErr.message}`);
        return 'error';
    }
}
