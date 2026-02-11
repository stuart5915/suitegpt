// Inclawbate — Notification Helper
// Sends Telegram messages to humans who have connected their account

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;

// Escape HTML special chars for Telegram HTML parse mode
export function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notifyHuman(telegramChatId, text) {
    if (!BOT_TOKEN || !telegramChatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        // Silent fail — don't block API response for notification failure
    }
}
