const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = 'telegram_messages';
const TELEGRAM_API = 'https://api.telegram.org/bot';

function supaFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return getMessages(req, res);
  if (req.method === 'POST') return sendMessage(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getMessages(req, res) {
  try {
    const since = parseInt(req.query.since) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    let query = `${TABLE}?select=*&order=timestamp.desc&limit=${limit}`;
    if (since) query += `&timestamp=gt.${since}`;

    const resp = await supaFetch(query);
    const rows = await resp.json();

    const messages = (rows || []).map(r => ({
      id: r.message_id,
      text: r.text,
      from: { id: r.from_id, name: r.from_name, username: r.from_username },
      replyTo: r.reply_to_id ? { id: r.reply_to_id, text: r.reply_to_text, name: r.reply_to_name } : null,
      timestamp: r.timestamp,
      edited: r.edited,
    })).reverse();

    return res.status(200).json({ ok: true, messages });
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch messages' });
  }
}

async function sendMessage(req, res) {
  try {
    const token = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return res.status(500).json({ ok: false, error: 'Bot not configured' });
    }

    const { text, senderName, replyToId } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Text is required' });
    }
    if (text.length > 1000) {
      return res.status(400).json({ ok: false, error: 'Text too long (max 1000)' });
    }

    const displayName = (senderName || 'Anonymous').replace(/[<>&]/g, '');
    const formatted = `<b>${displayName}</b> (via ClawsNet):\n${text.trim().replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}`;

    const body = {
      chat_id: chatId,
      text: formatted,
      parse_mode: 'HTML',
    };
    if (replyToId) body.reply_to_message_id = replyToId;

    const resp = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!data.ok) {
      console.error('Telegram send error:', data);
      return res.status(502).json({ ok: false, error: 'Telegram rejected the message' });
    }

    return res.status(200).json({ ok: true, messageId: data.result?.message_id });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send message' });
  }
}
