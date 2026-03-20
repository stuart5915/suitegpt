const ATELIER_API_KEY = process.env.ATELIER_API_KEY;
const ATELIER_BASE = 'https://atelierai.xyz/api';
const AGENT_CHAT_URL = 'https://inclawbate.app/api/inclawbate/agent-chat';
const AGENT_ID = 'ext_1774038874649_trg5h8e9i';

// Map service titles to natural language prompts for the Inclawbator
const SERVICE_PROMPTS = {
  'token launch': 'I want to launch a token. Here are the details: ',
  'staking pool': 'I want to deploy a staking pool. Here are the details: ',
  'hire council': 'I want to hire the Council for help. Here are the details: ',
  'health check': 'Run a health check on my project. Here are the details: ',
  'marketing agent': 'I want to create an AI marketing agent. Here are the details: ',
  'airdrop': 'I want to airdrop tokens. Here are the details: ',
  'analytics': 'Show me token analytics. Here are the details: ',
};

function matchService(serviceTitle) {
  const lower = (serviceTitle || '').toLowerCase();
  for (const [key, prompt] of Object.entries(SERVICE_PROMPTS)) {
    if (lower.includes(key)) return prompt;
  }
  return '';
}

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
  return atelierFetch(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

async function deliverOrder(orderId, content) {
  return atelierFetch(`/orders/${orderId}/deliver`, {
    method: 'POST',
    body: JSON.stringify({
      deliverable_url: `https://inclawbate.app`,
      deliverable_media_type: 'text',
      message: content,
    }),
  });
}

async function sendMessage(orderId, content) {
  return atelierFetch(`/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
}

async function processOrder(order) {
  const { id: orderId, brief, service } = order;
  const serviceTitle = service?.title || '';
  const promptPrefix = matchService(serviceTitle);
  const message = promptPrefix + (brief || 'Help me with my project');
  const sessionId = `atelier_${orderId}`;

  try {
    // Call the Inclawbator agent-chat API
    const chatRes = await fetch(AGENT_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    const chatData = await chatRes.json();
    const response = chatData.response || chatData.message || 'The Inclawbator processed your request. Visit https://inclawbate.app for more details.';

    // Send the response as a message on the order
    await sendMessage(orderId, response);

    // Deliver the order
    await deliverOrder(orderId, response);

    return { success: true, orderId };
  } catch (err) {
    await sendMessage(orderId, `Error processing your request: ${err.message}. Please try again or visit https://inclawbate.app directly.`);
    return { success: false, orderId, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = poll for orders and process them (called by cron or manually)
  if (req.method === 'GET') {
    try {
      const ordersRes = await atelierFetch(`/agents/${AGENT_ID}/orders?status=paid,in_progress`);
      const orders = ordersRes.data || ordersRes || [];

      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(200).json({ success: true, message: 'No pending orders', orders: [] });
      }

      const results = [];
      for (const order of orders) {
        const result = await processOrder(order);
        results.push(result);
      }

      return res.status(200).json({ success: true, processed: results });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST = webhook from Atelier (if they support push notifications)
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // If it's a direct order execution request
      if (body && body.order_id && body.brief) {
        const result = await processOrder({
          id: body.order_id,
          brief: body.brief,
          service: body.service || {},
        });
        return res.status(200).json(result);
      }

      // If it's an order object
      if (body && body.id && body.brief) {
        const result = await processOrder(body);
        return res.status(200).json(result);
      }

      return res.status(200).json({ success: true, message: 'Received' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
