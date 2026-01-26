// Telegram notification when new governance proposal is created
// Called by Supabase Database Webhook on proposals INSERT

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID; // Your personal Telegram chat ID

export default async function handler(req, res) {
    // Allow POST from Supabase webhook
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Optional: Verify webhook secret
    const webhookSecret = req.headers['x-webhook-secret'];
    if (process.env.SUPABASE_WEBHOOK_SECRET && webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { type, table, record, old_record } = req.body;

        // Only handle INSERT on proposals table
        if (type !== 'INSERT' || table !== 'proposals') {
            return res.status(200).json({ ok: true, skipped: true });
        }

        const proposal = record;

        // Build notification message
        const message = `🏛️ *New Governance Proposal!*

*Title:* ${escapeMarkdown(proposal.title)}
*Category:* ${proposal.category || 'feature'}
*Author:* ${escapeMarkdown(proposal.author_name || 'Anonymous')}

${escapeMarkdown(truncate(proposal.description, 200))}

[View Proposal](https://www.getsuite.app/factory.html)`;

        // Send to admin
        if (ADMIN_CHAT_ID) {
            await sendTelegramMessage(ADMIN_CHAT_ID, message);
        }

        res.status(200).json({ ok: true, notified: true });
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
}

async function sendTelegramMessage(chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Telegram API error:', error);
        throw new Error('Failed to send Telegram message');
    }

    return response.json();
}

function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
