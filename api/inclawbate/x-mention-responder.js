// Inclawbator X Mention Responder — cron every 5 min
// Polls @inclawbate mentions, routes through agent-chat, replies on X
// Uses OAuth 1.0a (shared @inclawbate account credentials)

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_CHAT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/inclawbate/agent-chat`
  : 'https://www.inclawbate.app/api/inclawbate/agent-chat';

const MAX_REPLIES_PER_RUN = 5;
const MENTION_MAX_AGE_MS = 6 * 60 * 60 * 1000; // ignore mentions older than 6h
const STATE_KEY = 'inclawbator_mentions'; // key in x_relay_state table

// ── OAuth 1.0a signature for X API ──

function oauthHeader(method, url, queryParams = {}) {
  const X_API_KEY = process.env.INCLAWBATE_X_API_KEY || process.env.X_API_KEY;
  const X_API_SECRET = process.env.INCLAWBATE_X_API_SECRET || process.env.X_API_SECRET;
  const X_ACCESS_TOKEN = process.env.INCLAWBATE_X_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
  const X_ACCESS_SECRET = process.env.INCLAWBATE_X_ACCESS_SECRET || process.env.X_ACCESS_SECRET;
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };

  const allParams = { ...oauth, ...queryParams };
  const paramString = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const signatureBase = [method, encodeURIComponent(url), encodeURIComponent(paramString)].join('&');
  const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  return 'OAuth ' + Object.keys(oauth).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
    .join(', ');
}

// ── Resolve @inclawbate user ID ──

async function getInclawbateUserId() {
  // Check x_relay_state first
  const { data } = await supabase
    .from('x_relay_state')
    .select('x_user_id')
    .eq('x_handle', 'inclawbate')
    .single();
  if (data?.x_user_id) return data.x_user_id;

  // Resolve via API
  const url = 'https://api.twitter.com/2/users/by/username/inclawbate';
  const resp = await fetch(url, { headers: { 'Authorization': oauthHeader('GET', url) } });
  const json = await resp.json();
  return json.data?.id || null;
}

// ── Fetch mentions ──

async function fetchMentions(userId, sinceId) {
  const url = 'https://api.twitter.com/2/users/' + userId + '/mentions';
  const params = {
    max_results: '10',
    'tweet.fields': 'created_at,author_id,conversation_id',
    expansions: 'author_id',
    'user.fields': 'username'
  };
  if (sinceId) params.since_id = sinceId;

  const fullUrl = url + '?' + new URLSearchParams(params).toString();
  const resp = await fetch(fullUrl, { headers: { 'Authorization': oauthHeader('GET', url, params) } });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || err.title || `Mentions API ${resp.status}`);
  }

  const data = await resp.json();
  const authors = {};
  (data.includes?.users || []).forEach(u => { authors[u.id] = u.username; });

  return {
    tweets: (data.data || []).map(t => ({
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      author_username: authors[t.author_id] || null,
      created_at: t.created_at
    })),
    newest_id: data.meta?.newest_id || null
  };
}

// ── Post reply via OAuth 1.0a ──

async function postReply(text, mentionTweetId) {
  const url = 'https://api.twitter.com/2/tweets';
  const body = { text, reply: { in_reply_to_tweet_id: mentionTweetId } };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || err.title || `Post reply ${resp.status}`);
  }

  const data = await resp.json();
  return data.data?.id || null;
}

// ── Route mention through agent-chat ──

async function getAgentReply(mentionText, authorUsername) {
  // Strip @inclawbate from the message and clean up
  const cleaned = mentionText.replace(/@inclawbate\b/gi, '').trim();
  const message = cleaned || 'What can you do?';

  // Extract wallet if present
  const walletMatch = message.match(/0x[a-fA-F0-9]{40}/);

  const body = {
    message: `[X mention from @${authorUsername}]: ${message}`,
    session_id: `x_mention_${authorUsername}`,
  };
  if (walletMatch) body.wallet = walletMatch[0];

  const resp = await fetch(AGENT_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  let reply = data.reply || '';

  // Truncate for X (280 char limit) — keep it under 270 to leave room for @mention
  const prefix = `@${authorUsername} `;
  const maxLen = 280 - prefix.length;

  if (reply.length > maxLen) {
    // Try to cut at a sentence boundary
    const truncated = reply.slice(0, maxLen - 3);
    const lastSentence = truncated.lastIndexOf('. ');
    reply = lastSentence > maxLen * 0.4
      ? truncated.slice(0, lastSentence + 1)
      : truncated + '...';
  }

  return prefix + reply;
}

// ── Load/save last mention ID ──

async function getLastMentionId() {
  const { data } = await supabase
    .from('x_relay_state')
    .select('last_tweet_id')
    .eq('x_handle', STATE_KEY)
    .single();
  return data?.last_tweet_id || null;
}

async function saveLastMentionId(mentionId) {
  await supabase.from('x_relay_state').upsert({
    x_handle: STATE_KEY,
    last_tweet_id: mentionId,
    last_checked_at: new Date().toISOString()
  }, { onConflict: 'x_handle' });
}

// ── Log reply ──

async function logMentionReply(mention, replyText, status, replyTweetId, errorMessage) {
  await supabase.from('agent_replies').insert({
    project_id: null,
    mention_tweet_id: mention.id,
    mention_text: (mention.text || '').slice(0, 500),
    mention_author: mention.author_username || null,
    reply_tweet_id: replyTweetId || null,
    reply_text: (replyText || '').slice(0, 500),
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

  const X_API_KEY = process.env.INCLAWBATE_X_API_KEY || process.env.X_API_KEY;
  const X_ACCESS_TOKEN = process.env.INCLAWBATE_X_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    return res.status(200).json({ error: 'X API credentials not configured' });
  }

  try {
    const userId = await getInclawbateUserId();
    if (!userId) {
      return res.status(200).json({ error: 'Could not resolve @inclawbate user ID' });
    }

    const sinceId = await getLastMentionId();
    const mentionResult = await fetchMentions(userId, sinceId);
    const mentions = mentionResult.tweets || [];

    if (mentionResult.newest_id) {
      await saveLastMentionId(mentionResult.newest_id);
    }

    if (!mentions.length) {
      return res.status(200).json({ success: true, message: 'No new mentions', checked: true });
    }

    let replied = 0;
    const errors = [];
    const now = Date.now();

    for (const mention of mentions.slice(0, MAX_REPLIES_PER_RUN)) {
      // Skip self-mentions
      if (mention.author_username?.toLowerCase() === 'inclawbate') {
        await logMentionReply(mention, '', 'skipped', null, 'Self-mention');
        continue;
      }

      // Skip old mentions
      if (mention.created_at && (now - new Date(mention.created_at).getTime()) > MENTION_MAX_AGE_MS) {
        await logMentionReply(mention, '', 'skipped', null, 'Too old');
        continue;
      }

      // Skip if already replied
      const { data: existing } = await supabase
        .from('agent_replies')
        .select('id')
        .eq('mention_tweet_id', mention.id)
        .limit(1);
      if (existing?.length > 0) continue;

      try {
        // Get reply from agent-chat
        const replyText = await getAgentReply(mention.text, mention.author_username);

        if (!replyText || replyText.length > 280) {
          await logMentionReply(mention, replyText || '', 'failed', null, 'Reply too long or empty');
          continue;
        }

        // Post to X
        const tweetId = await postReply(replyText, mention.id);
        await logMentionReply(mention, replyText, 'posted', tweetId);
        replied++;

      } catch (e) {
        await logMentionReply(mention, '', 'failed', null, e.message);
        errors.push(`@${mention.author_username}: ${e.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      mentions_found: mentions.length,
      replied,
      ...(errors.length ? { errors } : {})
    });

  } catch (e) {
    console.error('X mention responder error:', e);
    return res.status(500).json({ error: e.message });
  }
}
