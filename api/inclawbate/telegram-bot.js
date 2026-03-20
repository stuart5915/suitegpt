// Inclawbator Telegram Bot — Webhook handler
// Receives TG messages, routes through agent-chat, replies in Telegram
// POST from Telegram webhook → process → sendMessage back

const BOT_TOKEN = process.env.INCLAWBATOR_BOT_TOKEN;
const AGENT_CHAT_URL = 'https://inclawbate.com/api/inclawbate/agent-chat';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Command shortcuts — translated to natural language for agent-chat ──
const COMMANDS = {
    '/launch':    'I want to launch a token',
    '/stake':     'Show me how to deploy a staking pool',
    '/airdrop':   'I want to airdrop tokens to multiple wallets',
    '/promo':     'I want to promote my project on the @inclawbate X account',
    '/agent':     'How do I create an AI marketing agent for X?',
    '/health':    'Run a health check on my project',
    '/hire':      'I need to hire the Council for help',
    '/analytics': 'Show me token analytics',
    '/staking':   'Show me CLAWS staking stats',
    '/ecosystem': 'What is Inclawbate?',
    '/incubate':  'Tell me about full incubation services',
    '/help':      null // handled separately
};

// Send a message via Telegram Bot API
async function sendTG(chatId, text, opts = {}) {
    const body = {
        chat_id: chatId,
        text: text.slice(0, 4096), // TG limit
        parse_mode: 'Markdown',
        ...opts
    };
    const res = await fetch(`${TG_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
        // Retry without Markdown if parse fails
        if (data.description?.includes('parse')) {
            body.parse_mode = undefined;
            await fetch(`${TG_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } else {
            console.error('TG sendMessage error:', data.description);
        }
    }
    return data;
}

// Send "typing..." indicator
async function sendTyping(chatId) {
    await fetch(`${TG_API}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    });
}

// Tools that reference on-site UI — add link for Telegram context
const SITE_TOOLS = new Set([
    'launch_token_info', 'configure_token_launch', 'disperse_tokens',
    'create_agent_info', 'deploy_staking'
]);

function addSiteNote(reply, toolName) {
    if (SITE_TOOLS.has(toolName) && !reply.includes('inclawbate.com')) {
        return reply + '\n\n🌐 Head to inclawbate.com to complete this action.';
    }
    return reply;
}

const START_MSG =
    "Hey! I'm the Inclawbator 🦞\n\n" +
    "I'm the AI gateway to the Inclawbate ecosystem. Talk to me naturally, or use commands:\n\n" +
    "🚀 *Launch*\n" +
    "/launch — Launch a token on Base or Solana\n" +
    "/stake — Deploy a staking pool\n" +
    "/airdrop — Distribute tokens to wallets\n\n" +
    "📈 *Grow*\n" +
    "/promo — Book promotion on @inclawbate\n" +
    "/agent — Create an AI marketing agent\n" +
    "/health — Run a project health check\n" +
    "/hire — Hire the Council (design, dev, marketing)\n\n" +
    "📊 *Monitor*\n" +
    "/analytics — Token price & volume\n" +
    "/staking — CLAWS staking stats & APY\n" +
    "/ecosystem — What is Inclawbate?\n" +
    "/incubate — Full incubation services\n\n" +
    "Or just tell me what you need — I understand plain English!";

export default async function handler(req, res) {
    // GET = webhook verification / setup check
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Inclawbator TG bot webhook active' });
    }

    if (req.method !== 'POST') return res.status(405).end();
    if (!BOT_TOKEN) return res.status(500).json({ error: 'INCLAWBATOR_BOT_TOKEN not set' });

    const update = req.body;
    const msg = update.message;
    if (!msg?.text) return res.status(200).json({ ok: true }); // ignore non-text

    const chatId = msg.chat.id;
    const rawText = msg.text.trim();
    const sessionId = `tg_${chatId}`;

    // /start and /help — show menu
    if (rawText === '/start' || rawText === '/help') {
        await sendTG(chatId, START_MSG);
        return res.status(200).json({ ok: true });
    }

    // Map commands to natural language prompts
    const cmd = rawText.split(' ')[0].toLowerCase();
    const cmdExtra = rawText.slice(cmd.length).trim();
    let userText = rawText;

    if (COMMANDS[cmd] !== undefined) {
        // Append any extra text the user typed after the command
        userText = COMMANDS[cmd] + (cmdExtra ? '. ' + cmdExtra : '');
    }

    // Show typing indicator
    await sendTyping(chatId);

    try {
        // Call agent-chat API
        const agentRes = await fetch(AGENT_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userText,
                session_id: sessionId,
                wallet: null
            })
        });

        const agentData = await agentRes.json();
        let reply = agentData.reply || "Sorry, I couldn't process that. Try again!";

        // Add site link for tools that need the website
        if (agentData.function_called) {
            reply = addSiteNote(reply, agentData.function_called);
        }

        await sendTG(chatId, reply);
    } catch (err) {
        console.error('Inclawbator TG bot error:', err);
        await sendTG(chatId, "Something went wrong on my end. Try again in a moment!");
    }

    return res.status(200).json({ ok: true });
}
