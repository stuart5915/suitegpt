// Inclawbator Telegram Bot — Webhook handler
// Receives TG messages, routes through agent-chat, replies in Telegram
// POST from Telegram webhook → process → sendMessage back

const BOT_TOKEN = process.env.INCLAWBATOR_BOT_TOKEN;
const AGENT_CHAT_URL = 'https://inclawbate.com/api/inclawbate/agent-chat';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

// Tools that reference on-site UI — rephrase for Telegram context
const SITE_TOOLS = new Set([
    'launch_token_info', 'configure_token_launch', 'disperse_tokens',
    'create_agent_info', 'deploy_staking'
]);

function addSiteNote(reply, toolName) {
    if (SITE_TOOLS.has(toolName) && !reply.includes('inclawbate.com')) {
        return reply + '\n\nHead to inclawbate.com to complete this action.';
    }
    return reply;
}

export default async function handler(req, res) {
    // GET = webhook verification / setup check
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Inclawbator TG bot webhook active' });
    }

    if (req.method !== 'POST') return res.status(405).end();
    if (!BOT_TOKEN) return res.status(500).json({ error: 'INCLAWBATOR_BOT_TOKEN not set' });

    const update = req.body;

    // Handle /start command
    if (update.message?.text === '/start') {
        await sendTG(update.message.chat.id,
            "Hey! I'm the Inclawbator 🦞\n\n" +
            "I can help you:\n" +
            "• Launch tokens on Base or Solana\n" +
            "• Check token prices & analytics\n" +
            "• View staking stats & APY\n" +
            "• Deploy staking pools\n" +
            "• Hire the Council for design, dev, marketing\n" +
            "• Book promotions on @inclawbate\n" +
            "• Get full incubation services\n\n" +
            "Just tell me what you need — no commands required. Talk naturally!"
        );
        return res.status(200).json({ ok: true });
    }

    // Handle regular text messages
    const msg = update.message;
    if (!msg?.text) return res.status(200).json({ ok: true }); // ignore non-text (stickers, photos, etc.)

    const chatId = msg.chat.id;
    const userText = msg.text;
    const sessionId = `tg_${chatId}`; // persistent session per TG user

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
                wallet: null // TG users don't have wallets connected (yet)
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
