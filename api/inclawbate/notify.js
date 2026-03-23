// Inclawbate — Notification Helper
// Sends Telegram messages to humans who have connected their account

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const FEED_CHANNEL = '@inclawbator';

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

// Log Inclawbator interactions to the @inclawbator feed channel
export async function logToFeed({ source, user, message, reply, tool, extra }) {
    if (!BOT_TOKEN) return;

    const emojis = { website: '🌐', x: '🐦', telegram: '💬' };
    const emoji = emojis[source] || '📡';
    const userStr = user ? ` · <b>${escHtml(user)}</b>` : '';

    let text = `${emoji} <b>${escHtml((source || 'unknown').toUpperCase())}</b>${userStr}\n\n`;
    text += `<b>User:</b> ${escHtml((message || '').slice(0, 300))}\n\n`;
    text += `<b>Inclawbator:</b> ${escHtml((reply || '').slice(0, 500))}`;
    if (tool) text += `\n\n🔧 <code>${escHtml(tool)}</code>`;
    if (extra) text += `\n${extra}`;

    if (text.length > 4000) text = text.slice(0, 3997) + '...';

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: FEED_CHANNEL,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true
            })
        });
    } catch (e) {
        console.error('logToFeed error:', e.message);
    }
}
