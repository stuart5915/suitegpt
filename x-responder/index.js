// Inclawbator X Responder — Railway persistent service
// Filtered Stream for @inclawbator mentions (instant) + DM polling (every 60s)
// Uses OAuth 1.0a for posting, Bearer for stream

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
const DM_STATE_KEY = 'inclawbator_dms';
const MENTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DM_POLL_INTERVAL = 60_000; // 60s (15 req/15min limit)
const MAX_PER_RUN = 5;

const X_API_KEY = process.env.INCLAWBATOR_X_API_KEY || process.env.X_API_KEY;
const X_API_SECRET = process.env.INCLAWBATOR_X_API_SECRET || process.env.X_API_SECRET;
const X_ACCESS_TOKEN = process.env.INCLAWBATOR_X_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
const X_ACCESS_SECRET = process.env.INCLAWBATOR_X_ACCESS_SECRET || process.env.X_ACCESS_SECRET;
const X_BEARER_TOKEN = process.env.INCLAWBATOR_X_BEARER_TOKEN || process.env.X_BEARER_TOKEN;

let ownUserId = null;
let streamRetryDelay = 1000;
let mentionsProcessed = 0;
let dmsProcessed = 0;
let streamConnected = false;
let lastError = null;
const processedDmIds = new Set(); // prevent double-replies within session
const processedMentionIds = new Set(); // prevent double-replies from stream + polling overlap
const activeConversationUsers = new Set(); // users who directly mentioned @inclawbator

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

// ── Send DM ──

async function sendDM(conversationId, text) {
  const url = `https://api.twitter.com/2/dm_conversations/${conversationId}/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || err.title || `Send DM ${resp.status}`);
  }
  return resp.json();
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

// ══════════════════════════════════════════════
//  FILTERED STREAM — Mentions (instant)
// ══════════════════════════════════════════════

async function setupStreamRules() {
  const rulesUrl = 'https://api.twitter.com/2/tweets/search/stream/rules';
  const headers = { 'Authorization': `Bearer ${X_BEARER_TOKEN}`, 'Content-Type': 'application/json' };

  // Get existing rules
  const existing = await fetch(rulesUrl, { headers });
  const existingData = await existing.json();

  // Delete existing rules if any
  if (existingData.data?.length) {
    await fetch(rulesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ delete: { ids: existingData.data.map(r => r.id) } })
    });
  }

  // Add rule for @inclawbator mentions
  const resp = await fetch(rulesUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ add: [{ value: '@inclawbator', tag: 'mentions' }] })
  });

  const result = await resp.json();
  if (result.errors?.length) {
    console.error('Stream rule errors:', result.errors);
  }
  console.log('Stream rules set:', result.data?.length || 0, 'rules active');
}

async function connectStream() {
  const url = 'https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at,author_id,conversation_id,in_reply_to_user_id&expansions=author_id&user.fields=username';

  console.log('Connecting to filtered stream...');

  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${X_BEARER_TOKEN}` }
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Stream connect failed ${resp.status}: ${err}`);
    }

    streamConnected = true;
    streamRetryDelay = 1000;
    console.log('Stream connected — listening for @inclawbator mentions');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream ended');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // heartbeat
        try {
          const tweet = JSON.parse(trimmed);
          if (tweet.data) {
            handleStreamTweet(tweet);
          }
        } catch (e) {
          // not valid JSON, skip
        }
      }
    }
  } catch (e) {
    console.error('Stream error:', e.message);
    lastError = e.message;
  }

  // Reconnect with backoff
  streamConnected = false;
  console.log(`Stream disconnected. Reconnecting in ${streamRetryDelay / 1000}s...`);
  setTimeout(connectStream, streamRetryDelay);
  streamRetryDelay = Math.min(streamRetryDelay * 2, 300_000); // max 5 min
}

async function handleStreamTweet(payload) {
  const tweet = payload.data;
  const authors = {};
  (payload.includes?.users || []).forEach(u => { authors[u.id] = u.username; });

  const authorUsername = authors[tweet.author_id] || null;

  // Skip self-mentions
  if (authorUsername?.toLowerCase() === 'inclawbator') return;

  // Skip if already processed or currently being processed
  if (processedMentionIds.has(tweet.id)) return;
  processedMentionIds.add(tweet.id);

  // Skip old mentions
  if (tweet.created_at && (Date.now() - new Date(tweet.created_at).getTime()) > MENTION_MAX_AGE_MS) return;

  // Filter out random commenters on @inclawbator's posts.
  // conversation_id === tweet.id means it's a NEW conversation (direct mention).
  // conversation_id !== tweet.id means it's a reply in an existing thread.
  const isNewConversation = tweet.conversation_id === tweet.id;

  if (isNewConversation) {
    // Direct mention — mark user as having an active conversation
    if (authorUsername) activeConversationUsers.add(authorUsername.toLowerCase());
  } else {
    // Reply in existing thread — only respond if this user started a conversation with us
    if (!activeConversationUsers.has(authorUsername?.toLowerCase())) {
      console.log(`Skipping thread comment from @${authorUsername} — not in active conversation`);
      return;
    }
  }

  // Skip if already replied (DB check)
  const { data: existing } = await supabase
    .from('agent_replies')
    .select('id')
    .eq('mention_tweet_id', tweet.id)
    .limit(1);
  if (existing?.length > 0) return;

  console.log(`Mention from @${authorUsername}: ${tweet.text?.slice(0, 80)}`);

  try {
    const reply = await getAgentReply(tweet.text, `X mention from @${authorUsername}`, `x_mention_${authorUsername}`);
    const prefix = `@${authorUsername} `;
    const maxLen = 280 - prefix.length;

    let replyText = reply;

    // Strip crypto addresses (X blocks them for 7 days after token regen)
    // Remove addresses and basescan/clanker URLs, then add one contextual link at the end
    const hasAddresses = /0x[a-fA-F0-9]{8,}/.test(replyText);
    replyText = replyText.replace(/`?0x[a-fA-F0-9]{8,}`?/g, '');
    replyText = replyText.replace(/https?:\/\/(basescan\.org|clanker\.world)[^\s)"]*/g, '');
    // Clean up leftover artifacts: empty labels, double spaces, orphaned punctuation
    replyText = replyText.replace(/(?:Contract|Pool|Admin|Tx|Stake|Earn|Token):\s*\n/gi, '');
    replyText = replyText.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();
    // Add contextual link at the end if we stripped addresses
    if (hasAddresses) {
      const isStaking = /stak/i.test(replyText);
      const isDashboard = /dashboard|admin|reward|deposit/i.test(replyText);
      const isToken = /token|deploy|launch/i.test(replyText);
      const contextUrl = isStaking ? 'https://inclawbate.app/stake'
        : isDashboard ? 'https://inclawbate.app/dashboard'
        : isToken ? 'https://inclawbate.app/tokens'
        : 'https://inclawbate.app';
      replyText += `\n\nView details: ${contextUrl}`;
    }

    if (replyText.length > maxLen) {
      const truncated = replyText.slice(0, maxLen - 3);
      const lastSentence = truncated.lastIndexOf('. ');
      replyText = lastSentence > maxLen * 0.4
        ? truncated.slice(0, lastSentence + 1)
        : truncated + '...';
    }
    replyText = prefix + replyText;

    const tweetId = await postReply(replyText, tweet.id);
    await logMentionReply(tweet.id, tweet.text, authorUsername, replyText, 'posted', tweetId);
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

// ══════════════════════════════════════════════
//  DM POLLING (every 60s)
// ══════════════════════════════════════════════

async function getLastEventId() {
  const { data } = await supabase
    .from('x_relay_state')
    .select('last_tweet_id')
    .eq('x_handle', DM_STATE_KEY)
    .single();
  return data?.last_tweet_id || null;
}

async function saveLastEventId(eventId) {
  await supabase.from('x_relay_state').upsert({
    x_handle: DM_STATE_KEY,
    last_tweet_id: eventId,
    last_checked_at: new Date().toISOString()
  }, { onConflict: 'x_handle' });
}

async function pollDMs() {
  try {
    const userId = await resolveOwnUserId();
    if (!userId) { console.error('Could not resolve own user ID'); return; }

    const url = 'https://api.twitter.com/2/dm_events';
    const params = {
      max_results: '20',
      'dm_event.fields': 'created_at,dm_conversation_id,sender_id,text',
      event_types: 'MessageCreate'
    };

    const fullUrl = url + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(fullUrl, { headers: { 'Authorization': oauthHeader('GET', url, params) } });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || err.title || `DM API ${resp.status}`);
    }

    const dmData = await resp.json();
    const events = dmData.data || [];
    if (!events.length) return;

    const lastEventId = await getLastEventId();

    const newMessages = events.filter(e => {
      if (e.sender_id === userId) return false;
      if (processedDmIds.has(e.id)) return false;
      if (lastEventId && BigInt(e.id) <= BigInt(lastEventId)) return false;
      return true;
    });

    // Save newest event ID immediately to prevent re-processing on next poll
    const newestId = events[0]?.id;
    if (newestId) await saveLastEventId(newestId);

    if (!newMessages.length) return;

    const toProcess = newMessages.reverse().slice(0, MAX_PER_RUN);

    for (const dm of toProcess) {
      processedDmIds.add(dm.id);
      try {
        const replyText = await getAgentReply(dm.text || '', `X DM`, `x_dm_${dm.sender_id}`);
        const truncated = replyText.length > 4000 ? replyText.slice(0, 4000) + '...' : replyText;
        await sendDM(dm.dm_conversation_id, truncated);
        dmsProcessed++;
        console.log(`DM replied to ${dm.sender_id}`);
      } catch (e) {
        console.error(`DM reply failed for ${dm.sender_id}:`, e.message);
        lastError = e.message;
      }
    }

    // Keep processedDmIds from growing forever
    if (processedDmIds.size > 500) {
      const arr = [...processedDmIds];
      arr.splice(0, arr.length - 200);
      processedDmIds.clear();
      arr.forEach(id => processedDmIds.add(id));
    }
  } catch (e) {
    console.error('DM poll error:', e.message);
    lastError = e.message;
  }
}

// ══════════════════════════════════════════════
//  HEALTH CHECK SERVER
// ══════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      stream: streamConnected,
      mentions_processed: mentionsProcessed,
      dms_processed: dmsProcessed,
      last_error: lastError,
      uptime: Math.floor(process.uptime())
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'inclawbator-x-responder', live: true }));
  }
});

// ══════════════════════════════════════════════
//  STARTUP
// ══════════════════════════════════════════════

async function start() {
  console.log('Inclawbator X Responder starting...');

  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    console.error('Missing X API credentials — exiting');
    process.exit(1);
  }

  if (!X_BEARER_TOKEN) {
    console.error('Missing X_BEARER_TOKEN — stream will not work, falling back to polling mentions');
  }

  server.listen(PORT, () => console.log(`Health check on :${PORT}`));

  // Resolve own user ID upfront (needed for comment filtering)
  await resolveOwnUserId();
  console.log(`Own user ID: ${ownUserId}`);

  // Start stream for mentions + polling fallback
  if (X_BEARER_TOKEN) {
    await setupStreamRules();
    connectStream(); // runs forever with auto-reconnect
  }
  // Always poll mentions as fallback (handles stream downtime + reconnects)
  console.log('Polling mentions every 15s (fallback for stream gaps)');
  pollMentionsFallback(); // initial run
  setInterval(pollMentionsFallback, 15_000);

  // DM polling disabled for now — enable once mention system is stable
  // To re-enable: uncomment the lines below
  // console.log('Polling DMs every 60s');
  // setInterval(pollDMs, DM_POLL_INTERVAL);
  console.log('DM polling disabled');
}

// Fallback mention polling (if stream unavailable)
async function pollMentionsFallback() {
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

    if (!resp.ok) return;
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
      // reuse stream handler logic
      await handleStreamTweet({ data: tweet, includes: { users: data.includes?.users || [] } });
    }
  } catch (e) {
    console.error('Mention poll error:', e.message);
    lastError = e.message;
  }
}

start();
