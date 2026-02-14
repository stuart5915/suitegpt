// X → Telegram Channel Relay
// Cron: polls X API for new tweets from @artstu and @inclawbate,
// formats them, and sends to the @inclawbate Telegram channel.
// Runs every 1 minute via Vercel Cron.
// Uses OAuth 1.0a (free tier doesn't support Bearer for reads).

import { createClient } from '@supabase/supabase-js';
import { escHtml } from './notify.js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL = '@inclawbate';

const X_API_BASE = 'https://api.twitter.com/2';

// Build OAuth 1.0a Authorization header for GET requests
function oauthHeader(method, url, queryParams = {}) {
    const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

    const oauth = {
        oauth_consumer_key: X_API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: X_ACCESS_TOKEN,
        oauth_version: '1.0'
    };

    // Combine oauth params + query params for signature
    const allParams = { ...oauth, ...queryParams };
    const paramString = Object.keys(allParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&');

    const signatureBase = [
        method,
        encodeURIComponent(url),
        encodeURIComponent(paramString)
    ].join('&');

    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    oauth.oauth_signature = signature;

    return 'OAuth ' + Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
        .join(', ');
}

export default async function handler(req, res) {
    // Verify cron auth
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { X_API_KEY, X_ACCESS_TOKEN } = process.env;
    if (!X_API_KEY || !X_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'X API credentials not configured' });
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
        const errors = [];

        for (const account of accounts) {
            // Resolve user ID if missing
            if (!account.x_user_id) {
                const userId = await resolveUserId(account.x_handle);
                if (!userId) {
                    errors.push(`Could not resolve @${account.x_handle}`);
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

                if (!newestId || BigInt(tweet.id) > BigInt(newestId)) {
                    newestId = tweet.id;
                }
            }

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
            accounts_checked: accounts.length,
            ...(errors.length ? { errors } : {})
        });

    } catch (e) {
        console.error('X relay error:', e);
        return res.status(500).json({ error: e.message || 'Internal server error' });
    }
}

// Resolve X handle → numeric user ID
async function resolveUserId(handle) {
    try {
        const url = `${X_API_BASE}/users/by/username/${handle}`;
        const auth = oauthHeader('GET', url);

        const resp = await fetch(url, {
            headers: { 'Authorization': auth }
        });

        if (!resp.ok) {
            const body = await resp.text();
            console.error(`X API /users/by/username/${handle}: ${resp.status} ${body}`);
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
        const url = `${X_API_BASE}/users/${userId}/tweets`;
        const queryParams = {
            'tweet.fields': 'created_at,in_reply_to_user_id,referenced_tweets',
            'max_results': '10'
        };
        if (sinceId) queryParams['since_id'] = sinceId;

        const auth = oauthHeader('GET', url, queryParams);
        const qs = new URLSearchParams(queryParams).toString();

        const resp = await fetch(`${url}?${qs}`, {
            headers: { 'Authorization': auth }
        });

        if (!resp.ok) {
            const body = await resp.text();
            console.error(`X API /users/${userId}/tweets: ${resp.status} ${body}`);
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
