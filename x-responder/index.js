// Inclawbator X Responder — Railway persistent service
// Polls @inclawbator mentions every 15s, replies via agent-chat
// Uses OAuth 1.0a for X API

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import http from 'http';

// ── Config ──

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_CHAT_URL = 'https://www.inclawbate.app/api/inclawbate/agent-chat';
const MENTION_STATE_KEY = 'inclawbator_mentions';
const MENTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const POLL_INTERVAL = 15_000; // 15s
const MAX_PER_RUN = 5;

const X_API_KEY = process.env.INCLAWBATOR_X_API_KEY || process.env.X_API_KEY;
const X_API_SECRET = process.env.INCLAWBATOR_X_API_SECRET || process.env.X_API_SECRET;
const X_ACCESS_TOKEN = process.env.INCLAWBATOR_X_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
const X_ACCESS_SECRET = process.env.INCLAWBATOR_X_ACCESS_SECRET || process.env.X_ACCESS_SECRET;

let ownUserId = null;
let mentionsProcessed = 0;
let lastError = null;
const processedMentionIds = new Set();

// ── OAuth 1.0a ──

function oauthHeader(method, url, queryParams = {}) {
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

// ── Resolve @inclawbator user ID ──

async function resolveOwnUserId() {
  if (ownUserId) return ownUserId;

  const { data } = await supabase
    .from('x_relay_state')
    .select('x_user_id')
    .eq('x_handle', 'inclawbator')
    .single();
  if (data?.x_user_id) { ownUserId = data.x_user_id; return ownUserId; }

  const url = 'https://api.twitter.com/2/users/me';
  const resp = await fetch(url, { headers: { 'Authorization': oauthHeader('GET', url) } });
  const json = await resp.json();
  ownUserId = json.data?.id || null;
  return ownUserId;
}

// ── Agent chat ──

async function getAgentReply(text, context, sessionId) {
  const cleaned = text.replace(/@inclawbator\b/gi, '').replace(/@inclawbate\b/gi, '').trim();
  const message = cleaned || 'What can you do?';
  const walletMatch = message.match(/0x[a-fA-F0-9]{40}/);

  const body = {
    message: `[${context}]: ${message}`,
    session_id: sessionId,
  };
  if (walletMatch) body.wallet = walletMatch[0];

  const resp = await fetch(AGENT_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  return data.reply || '';
}

// ── Post reply tweet ──

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

// ── Log to @inclawbator feed channel ──

const FEED_BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const FEED_CHANNEL = '@inclawbator';

function escFeed(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function logToFeed(authorUsername, mentionText, replyText, replyTweetId) {
  if (!FEED_BOT_TOKEN) { console.warn('logToFeed: skipped — no INCLAWBATE_TELEGRAM_BOT_TOKEN'); return; }

  let text = `🐦 <b>X REPLY</b> · <b>@${escFeed(authorUsername)}</b>\n\n`;
  text += `<b>Mention:</b> ${escFeed((mentionText || '').slice(0, 300))}\n\n`;
  text += `<b>Reply:</b> ${escFeed((replyText || '').slice(0, 500))}`;
  if (replyTweetId) text += `\n\n🔗 https://x.com/inclawbator/status/${replyTweetId}`;

  if (text.length > 4000) text = text.slice(0, 3997) + '...';

  try {
    const res = await fetch(`https://api.telegram.org/bot${FEED_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: FEED_CHANNEL, text, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: true })
    });
    const data = await res.json();
    if (!data.ok) console.error('Feed log failed:', data.description);
  } catch (e) {
    console.error('Feed log error:', e.message);
  }
}

// ── Log reply ──

async function logMentionReply(mentionId, mentionText, author, replyText, status, replyTweetId, errorMessage) {
  await supabase.from('agent_replies').insert({
    project_id: null,
    mention_tweet_id: mentionId,
    mention_text: (mentionText || '').slice(0, 500),
    mention_author: author || null,
    reply_tweet_id: replyTweetId || null,
    reply_text: (replyText || '').slice(0, 500),
    status,
    error_message: errorMessage || null
  });
}

// ── Check if tweet is actually directed at the bot ──

function shouldReply(tweet) {
  const text = tweet.text || '';

  // Strip all @mentions and emojis to get the actual content
  const cleanText = text.replace(/@\w+/g, '').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();

  // Skip if there's basically no real text content (just @mentions, emojis, or very short reactions)
  if (cleanText.length < 15) {
    // Exception: if it contains a question mark, still reply
    if (!cleanText.includes('?')) {
      console.log(`Skipping (too short/reaction): "${text.slice(0, 80)}"`);
      return false;
    }
  }

  // Check if @inclawbator is a direct mention (at or near the start, after other @mentions)
  // e.g., "@inclawbator build me an app" → direct
  // e.g., "Exactly what @inclawbator is doing!" → conversational
  const textBeforeBot = text.slice(0, text.search(/@inclawbator/i)).replace(/@\w+\s*/g, '').trim();
  if (textBeforeBot.length > 5) {
    // There's real text before @inclawbator → conversational mention, not directed at the bot
    // Only reply if there's a question directed at the bot
    if (!cleanText.includes('?')) {
      console.log(`Skipping (conversational mention): "${text.slice(0, 80)}"`);
      return false;
    }
  }

  // Skip simple reactions/agreements to the bot's own tweets
  const reactionPatterns = /^(nice|cool|true|exactly|facts|based|agreed|yep|yes|no|lol|lmao|haha|wow|love it|great|good|as it should|this is the way|for sure|absolutely|right|word|damn|dope|fire|lit|amazing|awesome|interesting|noted|thanks|thank you|gm|gn|lfg|wagmi|fax|real|fr|w\b|huge|massive|big|lets go|let's go)[\s.!,]*$/i;
  if (reactionPatterns.test(cleanText)) {
    console.log(`Skipping (reaction): "${text.slice(0, 80)}"`);
    return false;
  }

  return true;
}

// ── Per-user rate limiting ──
const userCooldowns = new Map(); // username → last reply timestamp
const userDailyCounts = new Map(); // username → { date, count }
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between replies to same user
const MAX_REPLIES_PER_DAY = 5; // max replies to any single user per day
const MAX_THREAD_REPLIES = 3; // max replies in same conversation thread
const threadReplyCounts = new Map(); // conversation_id → count

function isRateLimited(username, conversationId) {
  const now = Date.now();
  const key = (username || '').toLowerCase();

  // Cooldown check
  const lastReply = userCooldowns.get(key);
  if (lastReply && (now - lastReply) < COOLDOWN_MS) {
    console.log(`Rate limited (cooldown): @${username} — ${Math.round((COOLDOWN_MS - (now - lastReply)) / 1000)}s remaining`);
    return true;
  }

  // Daily limit check
  const today = new Date().toISOString().slice(0, 10);
  const daily = userDailyCounts.get(key);
  if (daily && daily.date === today && daily.count >= MAX_REPLIES_PER_DAY) {
    console.log(`Rate limited (daily max): @${username} — ${daily.count}/${MAX_REPLIES_PER_DAY} today`);
    return true;
  }

  // Thread depth check
  if (conversationId) {
    const threadCount = threadReplyCounts.get(conversationId) || 0;
    if (threadCount >= MAX_THREAD_REPLIES) {
      console.log(`Rate limited (thread depth): conversation ${conversationId} — ${threadCount}/${MAX_THREAD_REPLIES} replies`);
      return true;
    }
  }

  return false;
}

function recordReply(username, conversationId) {
  const now = Date.now();
  const key = (username || '').toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  userCooldowns.set(key, now);

  const daily = userDailyCounts.get(key);
  if (daily && daily.date === today) {
    daily.count++;
  } else {
    userDailyCounts.set(key, { date: today, count: 1 });
  }

  if (conversationId) {
    threadReplyCounts.set(conversationId, (threadReplyCounts.get(conversationId) || 0) + 1);
  }

  // Clean up old entries periodically
  if (userCooldowns.size > 500) {
    for (const [k, v] of userCooldowns) {
      if (now - v > COOLDOWN_MS * 2) userCooldowns.delete(k);
    }
  }
}

// ── Process a mention ──

async function handleMention(tweet, authors) {
  const authorUsername = authors[tweet.author_id] || null;

  // Skip self-mentions, parent account, and known bots that cause loops
  const skipUsers = ['inclawbator', 'inclawbate', 'butler_agent', 'flaunchybot'];
  if (skipUsers.includes(authorUsername?.toLowerCase())) return;

  // Skip if rate limited (cooldown, daily max, or thread depth)
  if (isRateLimited(authorUsername, tweet.conversation_id)) return;

  // Skip if already processed (in-memory dedup)
  if (processedMentionIds.has(tweet.id)) return;
  processedMentionIds.add(tweet.id);

  // Skip old mentions
  if (tweet.created_at && (Date.now() - new Date(tweet.created_at).getTime()) > MENTION_MAX_AGE_MS) return;

  // Skip conversational mentions, reactions, and non-directed tweets
  if (!shouldReply(tweet)) return;

  // Skip if already replied (DB dedup)
  const { data: existing } = await supabase
    .from('agent_replies')
    .select('id')
    .eq('mention_tweet_id', tweet.id)
    .limit(1);
  if (existing?.length > 0) return;

  console.log(`Replying to @${authorUsername}: ${tweet.text?.slice(0, 80)}`);

  try {
    const reply = await getAgentReply(tweet.text, `X mention from @${authorUsername}`, `x_mention_${authorUsername}`);
    const prefix = `@${authorUsername} `;
    const maxLen = 280 - prefix.length;

    let replyText = reply;

    // Strip crypto addresses and blockchain URLs (X blocks them for 7 days after token regen)
    const hasAddresses = /0x[a-fA-F0-9]{8,}/.test(replyText) || /(?:basescan|clanker|etherscan)/i.test(replyText);
    replyText = replyText.replace(/`?0x[a-fA-F0-9]{8,}`?/g, '');
    replyText = replyText.replace(/(?:https?:\/\/)?(?:www\.)?(?:basescan\.org|clanker\.world|etherscan\.io)[^\s)"\n]*/g, '');
    // Clean up orphaned URL fragments (e.g. "https://www." left after domain stripped)
    replyText = replyText.replace(/https?:\/\/(?:www\.)?\s/g, ' ');
    replyText = replyText.replace(/https?:\/\/(?:www\.)?$/gm, '');
    // Remove any bullet/list line whose value is now empty or near-empty after stripping
    replyText = replyText.replace(/^[•\-\*]\s+[^:\n]*:\s*\S{0,5}\s*$/gm, '');
    // Remove any standalone label line with no value
    replyText = replyText.replace(/^[A-Za-z ]+:\s*$/gm, '');
    // Collapse extra blank lines and trim
    replyText = replyText.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();

    // Build contextual link suffix (added AFTER truncation so it doesn't get cut)
    let detailsSuffix = '';
    if (hasAddresses) {
      const isStaking = /stak/i.test(replyText);
      const isToken = /token|deploy|launch|clanker/i.test(replyText);
      const contextUrl = isStaking ? 'https://inclawbate.app/stake'
        : isToken ? 'https://inclawbate.app/tokens'
        : 'https://inclawbate.app';
      detailsSuffix = `\n\n${contextUrl}`;
    }

    // Truncate to 280 chars (minus @username prefix and details suffix)
    const truncMaxLen = maxLen - detailsSuffix.length;
    if (replyText.length > truncMaxLen) {
      const truncated = replyText.slice(0, truncMaxLen);
      const lastPara = truncated.lastIndexOf('\n\n');
      const lastSentence = truncated.lastIndexOf('. ');
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastPara > truncMaxLen * 0.4) {
        replyText = truncated.slice(0, lastPara);
      } else if (lastSentence > truncMaxLen * 0.4) {
        replyText = truncated.slice(0, lastSentence + 1);
      } else if (lastSpace > truncMaxLen * 0.4) {
        replyText = truncated.slice(0, lastSpace) + '...';
      } else {
        replyText = truncated.slice(0, truncMaxLen - 3) + '...';
      }
    }
    replyText = prefix + replyText + detailsSuffix;

    const tweetId = await postReply(replyText, tweet.id);
    await logMentionReply(tweet.id, tweet.text, authorUsername, replyText, 'posted', tweetId);
    logToFeed(authorUsername, tweet.text, replyText, tweetId).catch(() => {});
    recordReply(authorUsername, tweet.conversation_id);
    mentionsProcessed++;
    console.log(`Replied to @${authorUsername} (tweet ${tweetId})`);
  } catch (e) {
    await logMentionReply(tweet.id, tweet.text, authorUsername, '', 'failed', null, e.message);
    console.error(`Failed to reply to @${authorUsername}:`, e.message);
    lastError = e.message;
  }

  // Keep Set from growing forever
  if (processedMentionIds.size > 500) {
    const arr = [...processedMentionIds];
    arr.splice(0, arr.length - 200);
    processedMentionIds.clear();
    arr.forEach(id => processedMentionIds.add(id));
  }
}

// ── Poll mentions ──

async function pollMentions() {
  try {
    const userId = await resolveOwnUserId();
    if (!userId) return;

    const { data: stateRow } = await supabase
      .from('x_relay_state')
      .select('last_tweet_id')
      .eq('x_handle', MENTION_STATE_KEY)
      .single();
    const sinceId = stateRow?.last_tweet_id || null;

    const url = 'https://api.twitter.com/2/users/' + userId + '/mentions';
    const params = {
      max_results: '10',
      'tweet.fields': 'created_at,author_id,conversation_id,in_reply_to_user_id',
      expansions: 'author_id',
      'user.fields': 'username'
    };
    if (sinceId) params.since_id = sinceId;

    const fullUrl = url + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(fullUrl, { headers: { 'Authorization': oauthHeader('GET', url, params) } });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error(`Mention poll failed ${resp.status}:`, err.detail || err.title || '');
      return;
    }
    const data = await resp.json();

    if (data.meta?.newest_id) {
      await supabase.from('x_relay_state').upsert({
        x_handle: MENTION_STATE_KEY,
        last_tweet_id: data.meta.newest_id,
        last_checked_at: new Date().toISOString()
      }, { onConflict: 'x_handle' });
    }

    const authors = {};
    (data.includes?.users || []).forEach(u => { authors[u.id] = u.username; });

    for (const tweet of (data.data || []).slice(0, MAX_PER_RUN)) {
      await handleMention(tweet, authors);
    }
  } catch (e) {
    console.error('Mention poll error:', e.message);
    lastError = e.message;
  }
}

// ── Health check server ──

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (req.url === '/health') {
    res.end(JSON.stringify({
      status: 'ok',
      mentions_processed: mentionsProcessed,
      last_error: lastError,
      telegram_feed: FEED_BOT_TOKEN ? 'configured' : 'MISSING — set INCLAWBATE_TELEGRAM_BOT_TOKEN',
      uptime: Math.floor(process.uptime())
    }));
  } else {
    res.end(JSON.stringify({ service: 'inclawbator-x-responder', live: true }));
  }
});

// ── Startup ──

async function start() {
  console.log('Inclawbator X Responder starting...');
  console.log(`Telegram feed: ${FEED_BOT_TOKEN ? 'configured → ' + FEED_CHANNEL : '⚠️ MISSING — replies will NOT be sent to Telegram'}`);

  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    console.error('Missing X API credentials — exiting');
    process.exit(1);
  }

  server.listen(PORT, () => console.log(`Health check on :${PORT}`));

  await resolveOwnUserId();
  console.log(`Own user ID: ${ownUserId}`);

  // Seed: mark all existing mentions as processed so we don't re-reply after deploys
  try {
    const url = 'https://api.twitter.com/2/users/' + ownUserId + '/mentions';
    const params = {
      max_results: '100',
      'tweet.fields': 'created_at,author_id',
      expansions: 'author_id',
      'user.fields': 'username'
    };
    const fullUrl = url + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(fullUrl, { headers: { 'Authorization': oauthHeader('GET', url, params) } });
    if (resp.ok) {
      const data = await resp.json();
      (data.data || []).forEach(t => processedMentionIds.add(t.id));
      if (data.meta?.newest_id) {
        await supabase.from('x_relay_state').upsert({
          x_handle: MENTION_STATE_KEY,
          last_tweet_id: data.meta.newest_id,
          last_checked_at: new Date().toISOString()
        }, { onConflict: 'x_handle' });
      }
      console.log(`Seeded ${(data.data || []).length} existing mentions as processed`);
    }
  } catch (e) {
    console.error('Mention seed error:', e.message);
  }

  // Poll mentions every 15s
  console.log('Polling mentions every 15s');
  setInterval(pollMentions, POLL_INTERVAL);
}

start();
