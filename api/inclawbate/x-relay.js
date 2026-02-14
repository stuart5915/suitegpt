// X → Telegram Channel Relay
// Cron: polls X API for new tweets from @artstu and @inclawbate,
// formats them, and sends to the @inclawbate Telegram channel.
// Runs every 5 minutes via Vercel Cron.

import { createClient } from '@supabase/supabase-js';
import { escHtml } from './notify.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL = '@inclawbate';

const X_API_BASE = 'https://api.twitter.com/2';

export default async function handler(req, res) {
    // Verify cron auth
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!X_BEARER_TOKEN) {
        return res.status(500).json({ error: 'X_BEARER_TOKEN not configured' });
    }

    try {
        // Load relay state for all accounts
        const { data: accounts, error: stateErr } = await supabase
            .from('x_relay_state')
            .select('*');

        if (stateErr) throw stateErr;
        if (!accounts || accounts.length === 0) {
            return res.status(200).json({ success: true, message: 'No accounts configured' });
        }

        let totalFound = 0;
        let totalSent = 0;

        for (const account of accounts) {
            // Resolve user ID if missing
            if (!account.x_user_id) {
                const userId = await resolveUserId(account.x_handle);
                if (!userId) {
                    console.error(`Could not resolve user ID for @${account.x_handle}`);
                    continue;
                }
                await supabase
                    .from('x_relay_state')
                    .update({ x_user_id: userId })
                    .eq('x_handle', account.x_handle);
                account.x_user_id = userId;
            }

            // Fetch new tweets
            const tweets = await fetchTweets(account.x_user_id, account.last_tweet_id);
            if (!tweets || tweets.length === 0) {
                // Update last_checked even if no tweets
                await supabase
                    .from('x_relay_state')
                    .update({ last_checked_at: new Date().toISOString() })
                    .eq('x_handle', account.x_handle);
                continue;
            }

            totalFound += tweets.length;

            // Process oldest first so we send in chronological order
            const sorted = tweets.sort((a, b) => BigInt(a.id) - BigInt(b.id));

            let newestId = account.last_tweet_id;

            for (const tweet of sorted) {
                const sent = await sendToTelegram(account.x_handle, tweet);
                if (sent) totalSent++;

                // Track newest ID
                if (!newestId || BigInt(tweet.id) > BigInt(newestId)) {
                    newestId = tweet.id;
                }
            }

            // Update state with newest tweet ID
            await supabase
                .from('x_relay_state')
                .update({
                    last_tweet_id: newestId,
                    last_checked_at: new Date().toISOString()
                })
                .eq('x_handle', account.x_handle);
        }

        return res.status(200).json({
            success: true,
            tweets_found: totalFound,
            messages_sent: totalSent,
            accounts_checked: accounts.length
        });

    } catch (e) {
        console.error('X relay error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Resolve X handle → numeric user ID
async function resolveUserId(handle) {
    try {
        const resp = await fetch(`${X_API_BASE}/users/by/username/${handle}`, {
            headers: { 'Authorization': `Bearer ${X_BEARER_TOKEN}` }
        });
        if (!resp.ok) {
            console.error(`X API /users/by/username/${handle}: ${resp.status}`);
            return null;
        }
        const json = await resp.json();
        return json.data?.id || null;
    } catch (e) {
        console.error('resolveUserId error:', e);
        return null;
    }
}

// Fetch recent tweets from a user since a given tweet ID
async function fetchTweets(userId, sinceId) {
    try {
        const params = new URLSearchParams({
            'tweet.fields': 'created_at,in_reply_to_user_id,referenced_tweets',
            'max_results': '10'
        });
        if (sinceId) params.set('since_id', sinceId);

        const resp = await fetch(`${X_API_BASE}/users/${userId}/tweets?${params}`, {
            headers: { 'Authorization': `Bearer ${X_BEARER_TOKEN}` }
        });

        if (!resp.ok) {
            console.error(`X API /users/${userId}/tweets: ${resp.status}`);
            return null;
        }

        const json = await resp.json();
        return json.data || [];
    } catch (e) {
        console.error('fetchTweets error:', e);
        return null;
    }
}

// Format a tweet and send to the Telegram channel
async function sendToTelegram(handle, tweet) {
    if (!TELEGRAM_BOT_TOKEN) return false;

    const isReply = tweet.referenced_tweets?.some(r => r.type === 'replied_to');
    const prefix = isReply ? `\u{1F4AC} <b>${escHtml('@' + handle)}</b> replied:` : `\u{1F4E2} <b>${escHtml('@' + handle)}</b>`;
    const link = `https://x.com/${handle}/status/${tweet.id}`;
    const text = `${prefix}\n\n${escHtml(tweet.text)}\n\n\u{1F517} <a href="${link}">View on X</a>`;

    try {
        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHANNEL,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: false
            })
        });

        if (!resp.ok) {
            const err = await resp.text();
            console.error('Telegram sendMessage error:', err);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Telegram send error:', e);
        return false;
    }
}
