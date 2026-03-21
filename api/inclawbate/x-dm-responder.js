// Inclawbator X DM Responder — cron every 5 min
// Polls @inclawbate DMs, routes through agent-chat, replies via DM
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

const MAX_DMS_PER_RUN = 5;
const STATE_KEY = 'inclawbator_dms';

// ── OAuth 1.0a signature ──

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

// ── Get @inclawbate's own user ID ──

async function getOwnUserId() {
  const { data } = await supabase
    .from('x_relay_state')
    .select('x_user_id')
    .eq('x_handle', 'inclawbate')
    .single();
  if (data?.x_user_id) return data.x_user_id;

  const url = 'https://api.twitter.com/2/users/me';
  const resp = await fetch(url, { headers: { 'Authorization': oauthHeader('GET', url) } });
  const json = await resp.json();
  return json.data?.id || null;
}

// ── Fetch DM events ──

async function fetchDMEvents() {
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
    throw new Error(err.detail || err.title || `DM events API ${resp.status}`);
  }

  return resp.json();
}

// ── Send a DM ──

async function sendDM(conversationId, text) {
  const url = `https://api.twitter.com/2/dm_conversations/${conversationId}/messages`;
  const body = { text };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || err.title || `Send DM ${resp.status}`);
  }

  return resp.json();
}

// ── Route DM through agent-chat ──

async function getAgentReply(dmText, senderId) {
  const walletMatch = dmText.match(/0x[a-fA-F0-9]{40}/);

  const body = {
    message: dmText,
    session_id: `x_dm_${senderId}`,
  };
  if (walletMatch) body.wallet = walletMatch[0];

  const resp = await fetch(AGENT_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  return data.reply || "I'm the Inclawbator! Visit inclawbate.app to get started.";
}

// ── Load/save last processed DM event ID ──

async function getLastEventId() {
  const { data } = await supabase
    .from('x_relay_state')
    .select('last_tweet_id')
    .eq('x_handle', STATE_KEY)
    .single();
  return data?.last_tweet_id || null;
}

async function saveLastEventId(eventId) {
  await supabase.from('x_relay_state').upsert({
    x_handle: STATE_KEY,
    last_tweet_id: eventId,
    last_checked_at: new Date().toISOString()
  }, { onConflict: 'x_handle' });
}

// ── Main handler ──

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { X_API_KEY, X_ACCESS_TOKEN } = process.env;
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    return res.status(200).json({ error: 'X API credentials not configured' });
  }

  try {
    const ownUserId = await getOwnUserId();
    if (!ownUserId) {
      return res.status(200).json({ error: 'Could not resolve own user ID' });
    }

    const lastEventId = await getLastEventId();
    const dmData = await fetchDMEvents();
    const events = dmData.data || [];

    if (!events.length) {
      return res.status(200).json({ success: true, message: 'No DM events' });
    }

    // Filter: only messages FROM others (not from us), newer than lastEventId
    const newMessages = events.filter(e => {
      if (e.sender_id === ownUserId) return false; // skip our own messages
      if (lastEventId && e.id <= lastEventId) return false; // already processed
      return true;
    });

    // Save newest event ID (even if all are ours — so we don't re-process)
    const newestId = events[0]?.id;
    if (newestId) await saveLastEventId(newestId);

    if (!newMessages.length) {
      return res.status(200).json({ success: true, message: 'No new incoming DMs' });
    }

    let replied = 0;
    const errors = [];

    // Process oldest first, limit per run
    const toProcess = newMessages.reverse().slice(0, MAX_DMS_PER_RUN);

    for (const dm of toProcess) {
      try {
        const replyText = await getAgentReply(dm.text || '', dm.sender_id);

        // DMs have no character limit like tweets, but keep it reasonable
        const truncated = replyText.length > 4000 ? replyText.slice(0, 4000) + '...' : replyText;

        await sendDM(dm.dm_conversation_id, truncated);
        replied++;

      } catch (e) {
        errors.push(`DM from ${dm.sender_id}: ${e.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      new_dms: newMessages.length,
      replied,
      ...(errors.length ? { errors } : {})
    });

  } catch (e) {
    console.error('X DM responder error:', e);
    return res.status(500).json({ error: e.message });
  }
}
