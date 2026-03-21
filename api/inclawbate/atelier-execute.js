// Atelier AI marketplace integration — polls orders, processes via agent-chat, delivers results
// GET = cron poll (every 5 min), POST = webhook fallback
// Multi-turn: if agent needs more info, sends a message and waits for buyer reply

const ATELIER_API_KEY = process.env.ATELIER_API_KEY;
const ATELIER_BASE = 'https://atelierai.xyz/api';
const AGENT_CHAT_URL = 'https://inclawbate.app/api/inclawbate/agent-chat';
const AGENT_ID = 'ext_1774038874649_trg5h8e9i';

// ── Service prompt mapping (covers all 11 Atelier services) ──
const SERVICE_PROMPTS = {
  'token launch':     'I want to launch a token on Base via Clanker.',
  'full incubation':  'I want full incubation — token launch, staking pool, marketing agent, promo, analytics, and Council support.',
  'incubation':       'I want full incubation — token launch, staking pool, marketing agent, promo, analytics, and Council support.',
  'staking pool':     'I want to deploy a staking pool for my token.',
  'hire':             'I want to hire the Inclawbate Council for help with a project.',
  'council':          'I want to hire the Inclawbate Council for help with a project.',
  'health check':     'Run a health check on my project.',
  'marketing agent':  'I want to create an AI marketing agent that auto-posts to X.',
  'airdrop':          'I want to airdrop/distribute tokens to multiple wallets.',
  'analytics':        'Show me token analytics (price, volume, liquidity).',
  'ecosystem':        'Tell me about the Inclawbate ecosystem — what is CLAWS, how does staking work, what can I do here.',
  'book promo':       'I want to book a promo on the @inclawbate X account.',
  'promo':            'I want to book a promo on the @inclawbate X account.',
  'staking stats':    'Show me staking stats — APY, TVL, total stakers.',
};

// ── Extract structured data from brief text ──
function parseBrief(text) {
  if (!text) return {};
  const data = {};
  const wallets = text.match(/0x[a-fA-F0-9]{40}/g);
  if (wallets) {
    data.wallet = wallets[0];
    if (wallets.length > 1) data.extra_wallets = wallets.slice(1);
  }
  const tokenMatch = text.match(/(?:name|token)[:\s]+([A-Za-z0-9 ]+?)[\s]*(?:\(|\/|\|)[\s]*([A-Z0-9]{2,10})/i);
  if (tokenMatch) {
    data.token_name = tokenMatch[1].trim();
    data.token_symbol = tokenMatch[2].trim();
  }
  const handleMatch = text.match(/@[A-Za-z0-9_]{1,30}/);
  if (handleMatch) data.contact = handleMatch[0];
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) data.email = emailMatch[0];
  return data;
}

function matchService(serviceTitle) {
  const lower = (serviceTitle || '').toLowerCase();
  for (const [key, prompt] of Object.entries(SERVICE_PROMPTS)) {
    if (lower.includes(key)) return prompt;
  }
  return '';
}

// ── Atelier API helpers ──
async function atelierFetch(path, options = {}) {
  const res = await fetch(`${ATELIER_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ATELIER_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res.json();
}

async function updateOrderStatus(orderId, status) {
  try {
    return await atelierFetch(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    console.error(`Failed to update order ${orderId} status to ${status}:`, e.message);
  }
}

async function deliverOrder(orderId, content, url) {
  return atelierFetch(`/orders/${orderId}/deliver`, {
    method: 'POST',
    body: JSON.stringify({
      deliverable_url: url || 'https://inclawbate.app',
      deliverable_media_type: 'text',
      message: content.slice(0, 2000),
    }),
  });
}

async function sendMessage(orderId, content) {
  return atelierFetch(`/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
}

async function getMessages(orderId) {
  return atelierFetch(`/orders/${orderId}/messages`);
}

// ── Call the Inclawbator agent-chat ──
async function callAgentChat(message, sessionId, wallet) {
  const body = { message, session_id: sessionId };
  if (wallet) body.wallet = wallet;
  const chatRes = await fetch(AGENT_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return chatRes.json();
}

// ── Extract a meaningful deliverable URL from the response ──
function extractDeliverableUrl(reply, functionCalled) {
  if (!reply) return 'https://inclawbate.app';
  const urls = reply.match(/https?:\/\/[^\s)>\]]+/g) || [];

  if (functionCalled === 'deploy_token') {
    return urls.find(u => u.includes('basescan')) || urls.find(u => u.includes('dexscreener')) || 'https://inclawbate.app';
  }
  if (functionCalled === 'deploy_staking') {
    return urls.find(u => u.includes('basescan')) || 'https://inclawbate.app/dashboard';
  }
  if (functionCalled === 'get_token_analytics') {
    return urls.find(u => u.includes('dexscreener')) || 'https://inclawbate.app';
  }

  const SERVICE_URLS = {
    'create_agent_info': 'https://inclawbate.app/schedule',
    'get_ecosystem_info': 'https://inclawbate.app',
    'get_incubation_info': 'https://inclawbate.app/inclawbator',
    'book_promo': 'https://inclawbate.app',
    'get_staking_stats': 'https://inclawbate.app/stake',
    'disperse_tokens': 'https://inclawbate.app/dashboard',
    'health_check': 'https://inclawbate.app',
    'hire_inclawbator': 'https://inclawbate.app/inclawbator',
  };
  return SERVICE_URLS[functionCalled] || urls[0] || 'https://inclawbate.app';
}

// ── Build a chat prompt from order context ──
function buildPrompt(serviceTitle, brief, extraContext) {
  const prefix = matchService(serviceTitle);
  const briefData = parseBrief(brief);
  // Merge any extra parsed data (e.g. from buyer replies)
  const merged = { ...briefData, ...extraContext };

  let message = prefix;
  if (brief) message += ' ' + brief;
  if (merged.wallet) message += '\n\n[User wallet: ' + merged.wallet + ']';
  if (merged.contact) message += '\n[Contact: ' + merged.contact + ']';
  if (merged.email) message += '\n[Email: ' + merged.email + ']';
  return message.trim() || 'Help me with my project';
}

// ── Process a newly paid order ──
async function processNewOrder(order) {
  const { id: orderId, brief, service } = order;
  const serviceTitle = service?.title || '';

  // 1. Mark as in_progress so buyer sees we picked it up
  await updateOrderStatus(orderId, 'in_progress');

  // 2. Call agent-chat
  const message = buildPrompt(serviceTitle, brief);
  const briefData = parseBrief(brief);
  const sessionId = `atelier_${orderId}`;
  const chatData = await callAgentChat(message, sessionId, briefData.wallet);

  const reply = chatData.reply || 'The Inclawbator is processing your request. Visit https://inclawbate.app for details.';
  const functionCalled = chatData.function_called;

  if (functionCalled) {
    // Tool was executed — deliver the result
    const url = extractDeliverableUrl(reply, functionCalled);
    await sendMessage(orderId, reply);
    await deliverOrder(orderId, reply, url);
    return { success: true, orderId, status: 'delivered', function: functionCalled };
  } else {
    // Agent needs more info — send message, wait for buyer reply
    await sendMessage(orderId, reply);
    return { success: true, orderId, status: 'awaiting_reply' };
  }
}

// ── Check an in_progress order for new buyer messages ──
async function processInProgressOrder(order) {
  const { id: orderId, brief, service } = order;
  const serviceTitle = service?.title || '';

  // Get the message thread
  const messagesRes = await getMessages(orderId);
  const messages = Array.isArray(messagesRes.data) ? messagesRes.data
    : Array.isArray(messagesRes) ? messagesRes : [];

  if (messages.length === 0) {
    return { success: true, orderId, status: 'no_messages' };
  }

  // Sort by timestamp (newest last)
  messages.sort((a, b) => new Date(a.created_at || a.timestamp || 0) - new Date(b.created_at || b.timestamp || 0));
  const lastMsg = messages[messages.length - 1];

  // Figure out if last message is from the buyer or from us
  // Atelier may use sender, role, from, or sender_type — check all
  const senderField = lastMsg.sender || lastMsg.role || lastMsg.from || lastMsg.sender_type || '';
  const isFromAgent = typeof senderField === 'string' &&
    (senderField.toLowerCase().includes('agent') || senderField.toLowerCase().includes('provider'));

  if (isFromAgent) {
    // Last message is ours — still waiting for buyer
    // If it's been >48 hours, deliver a fallback so the order doesn't hang forever
    const msgTime = new Date(lastMsg.created_at || lastMsg.timestamp || 0).getTime();
    const hoursAgo = (Date.now() - msgTime) / (1000 * 60 * 60);
    if (hoursAgo > 48) {
      const fallback = "It looks like I didn't hear back, so I'm closing this out. You can always come back or visit https://inclawbate.app to get started anytime!";
      await sendMessage(orderId, fallback);
      await deliverOrder(orderId, fallback, 'https://inclawbate.app');
      return { success: true, orderId, status: 'delivered_timeout' };
    }
    return { success: true, orderId, status: 'waiting_for_buyer' };
  }

  // Buyer replied — continue the conversation
  const buyerReply = lastMsg.content || lastMsg.message || lastMsg.text || '';
  const replyData = parseBrief(buyerReply);
  const briefData = parseBrief(brief);

  // Rebuild context: service prompt + original brief + buyer's new reply
  let message = buildPrompt(serviceTitle, brief, replyData);
  message += '\n\nThe user just replied with: ' + buyerReply;

  const sessionId = `atelier_${orderId}`;
  const wallet = replyData.wallet || briefData.wallet;
  const chatData = await callAgentChat(message, sessionId, wallet);

  const reply = chatData.reply || 'Thanks for the info! Visit https://inclawbate.app for details.';
  const functionCalled = chatData.function_called;

  if (functionCalled) {
    const url = extractDeliverableUrl(reply, functionCalled);
    await sendMessage(orderId, reply);
    await deliverOrder(orderId, reply, url);
    return { success: true, orderId, status: 'delivered', function: functionCalled };
  } else {
    // Still needs more info
    await sendMessage(orderId, reply);
    return { success: true, orderId, status: 'awaiting_reply' };
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = cron poll — process all paid + in_progress orders
  if (req.method === 'GET') {
    if (!ATELIER_API_KEY) {
      return res.status(200).json({ success: false, error: 'ATELIER_API_KEY not set' });
    }
    try {
      const ordersRes = await atelierFetch(`/agents/${AGENT_ID}/orders?status=paid,in_progress`);
      const orders = ordersRes.data || ordersRes || [];

      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(200).json({ success: true, message: 'No pending orders', orders: [] });
      }

      const results = [];
      for (const order of orders) {
        try {
          if (order.status === 'paid') {
            results.push(await processNewOrder(order));
          } else if (order.status === 'in_progress') {
            results.push(await processInProgressOrder(order));
          }
        } catch (err) {
          console.error(`Error processing order ${order.id}:`, err.message);
          // Try to message the buyer about the error
          try { await sendMessage(order.id, `Something went wrong processing your request. Please try again or visit https://inclawbate.app directly.`); } catch (_) {}
          results.push({ success: false, orderId: order.id, error: err.message });
        }
      }

      return res.status(200).json({ success: true, processed: results });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST = webhook fallback (if Atelier pushes orders to us)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body && (body.order_id || body.id) && body.brief) {
        const order = {
          id: body.order_id || body.id,
          brief: body.brief,
          service: body.service || {},
          status: body.status || 'paid',
        };
        const result = order.status === 'in_progress'
          ? await processInProgressOrder(order)
          : await processNewOrder(order);
        return res.status(200).json(result);
      }
      return res.status(200).json({ success: true, message: 'Received' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
