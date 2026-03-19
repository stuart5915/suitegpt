// Inclawbate — Notification Helper
// Sends Telegram messages to humans who have connected their account

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;

// Escape HTML special chars for Telegram HTML parse mode
export function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notifyHuman(telegramChatId, text) {
    if (!BOT_TOKEN) { console.warn('notifyHuman: no INCLAWBATE_TELEGRAM_BOT_TOKEN'); return; }
    if (!telegramChatId) { console.warn('notifyHuman: no chat ID'); return; }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: telegramChatId,
            text,
            parse_mode: 'HTML'
        })
    });
    const data = await res.json();
    if (!data.ok) {
        console.error('Telegram API error:', data.description, '| chat_id:', telegramChatId);
    }
}
