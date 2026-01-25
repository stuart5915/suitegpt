// Telegram Bot Webhook Handler for SUITEHubBot
// Handles /start login command and sends Web App login button

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = 'https://suitegpt.app';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const update = req.body;

        // Handle /start command
        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const user = update.message.from;

            if (text.startsWith('/start')) {
                const param = text.split(' ')[1] || '';

                if (param === 'login' || param === '') {
                    // Send login button with Web App
                    await sendLoginMessage(chatId, user);
                }
            }
        }

        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function sendLoginMessage(chatId, user) {
    const message = {
        chat_id: chatId,
        text: `Hey ${user.first_name}! 👋\n\nTap the button below to login to SuiteGPT:`,
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🚀 Open SuiteGPT',
                    web_app: { url: WEBAPP_URL }
                }
            ]]
        }
    };

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Telegram API error:', error);
    }
}
