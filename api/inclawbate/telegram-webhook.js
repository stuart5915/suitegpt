// Inclawbate — Telegram Bot
// 3 commands: /state, /add, /done
// POST /api/inclawbate/telegram-webhook

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = 'StuartDeFi';

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMsg(chatId, text) {
    if (!BOT_TOKEN) return;
    // Split on newlines to avoid cutting HTML tags
    const lines = text.split('\n');
    const chunks = [];
    let current = '';
    for (const line of lines) {
        if (current.length + line.length + 1 > 4000) {
            chunks.push(current);
            current = '';
        }
        current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        if (!resp.ok) {
            const err = await resp.text();
            console.error('TG sendMessage error:', err);
        }
    }
}

function isAdmin(username) {
    return username && username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

// ── /state — shows current focus + numbered todos ──

async function handleState(chatId) {
    const { data: current } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'current')
        .order('created_at', { ascending: true });

    const { data: todos } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .order('created_at', { ascending: true });

    let msg = '🦞 <b>INCLAWBATE</b>\n';

    if (current && current.length) {
        msg += `\n🔥 <b>CURRENT:</b>\n`;
        current.forEach(c => { msg += `→ ${esc(c.content)}\n`; });
    }

    if (todos && todos.length) {
        msg += `\n<b>TODO (${todos.length}):</b>\n`;
        todos.forEach((t, i) => { msg += `<b>${i + 1}.</b> ${esc(t.content)}\n`; });
    } else {
        msg += '\n<i>List is empty. /add something</i>\n';
    }

    await sendMsg(chatId, msg);
}

// ── /current — set or show what you're working on (admin only) ──

async function handleCurrent(chatId, username, args) {
    if (!isAdmin(username)) return;

    // No args = just show current
    if (!args) {
        const { data } = await supabase
            .from('team_state')
            .select('*')
            .eq('category', 'current')
            .order('created_at', { ascending: true });

        if (data && data.length) {
            let msg = '🔥 <b>CURRENT:</b>\n';
            data.forEach(c => { msg += `→ ${esc(c.content)}\n`; });
            await sendMsg(chatId, msg);
        } else {
            await sendMsg(chatId, '<i>No current task. /current 3 to set one from /state</i>');
        }
        return;
    }

    // "clear" removes all current tasks
    if (args.toLowerCase() === 'clear') {
        await supabase.from('team_state').delete().eq('category', 'current');
        await sendMsg(chatId, '🔥 Current cleared.');
        return;
    }

    // Find the todo by number or text
    const item = await findTodo(args);
    if (!item) {
        await sendMsg(chatId, `❌ No match for "${esc(args)}"`);
        return;
    }

    // Add to current (don't replace)
    await supabase.from('team_state').insert({ category: 'current', content: item.content, author: username });
    await sendMsg(chatId, `🔥 <b>Added to current:</b> ${esc(item.content)}`);
}

// ── /add — add to list (admin only, multi-line ok) ──

async function handleAdd(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can add items.');
        return;
    }
    if (!args) {
        await sendMsg(chatId, '/add Do the thing');
        return;
    }

    const items = args.split('\n').map(l => l.replace(/^[-•*☐]\s*/, '').trim()).filter(Boolean);
    const rows = items.map(content => ({ category: 'todo', content, author: username }));

    const { error } = await supabase.from('team_state').insert(rows);
    if (error) { await sendMsg(chatId, '❌ ' + esc(error.message)); return; }

    let msg = `<b>Added${items.length > 1 ? ' ' + items.length + ' items' : ''}:</b>\n`;
    items.forEach(i => { msg += `☐ ${esc(i)}\n`; });
    await sendMsg(chatId, msg);
}

// ── find a todo by number (from /state) or text match ──

async function findTodo(args) {
    const num = parseInt(args, 10);

    // If it's a number, get the Nth todo (1-indexed)
    if (!isNaN(num) && num > 0 && String(num) === args.trim()) {
        const { data } = await supabase
            .from('team_state')
            .select('*')
            .eq('category', 'todo')
            .order('created_at', { ascending: true });

        if (data && data[num - 1]) return data[num - 1];
        return null;
    }

    // Otherwise fuzzy text match
    const { data } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .ilike('content', `%${args}%`)
        .limit(1);

    return (data && data[0]) || null;
}

// ── /done — check something off by number or text (admin only) ──

async function handleDone(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can check things off.');
        return;
    }
    if (!args) {
        await sendMsg(chatId, '/done 1  (use number from /state)');
        return;
    }

    const item = await findTodo(args);
    if (!item) {
        await sendMsg(chatId, `❌ No match for "${esc(args)}"`);
        return;
    }

    await supabase.from('team_state').delete().eq('id', item.id);
    await supabase.from('team_state').insert({ category: 'done', content: item.content, author: username });
    await sendMsg(chatId, `✅ <b>Done:</b> ${esc(item.content)}`);
}

// ── /remove — delete by number or text (admin only) ──

async function handleRemove(chatId, username, args) {
    if (!isAdmin(username)) return;
    if (!args) { await sendMsg(chatId, '/remove 1  (use number from /state)'); return; }

    const item = await findTodo(args);
    if (!item) { await sendMsg(chatId, `❌ No match`); return; }
    await supabase.from('team_state').delete().eq('id', item.id);
    await sendMsg(chatId, `🗑 ${esc(item.content)}`);
}

// ── /start — link profile (DM only) ──

async function handleStart(chatId, handle) {
    if (!handle) {
        await sendMsg(chatId, '🦞 Send /start yourxhandle to connect your Inclawbate profile.');
        return;
    }

    const { data: profile, error } = await supabase
        .from('human_profiles')
        .select('id, x_handle')
        .eq('x_handle', handle.toLowerCase())
        .single();

    if (error || !profile) {
        await sendMsg(chatId, `❌ No profile for @${esc(handle)}`);
        return;
    }

    await supabase.from('human_profiles').update({ telegram_chat_id: String(chatId) }).eq('id', profile.id);
    await sendMsg(chatId, `✅ Connected! inclawbate.com/u/${esc(profile.x_handle)}`);
}

// ── Main ──

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const message = req.body?.message;
        if (!message || !message.text) return res.status(200).json({ ok: true });

        const chatId = message.chat.id;
        const chatType = message.chat.type;
        const username = message.from?.username || '';
        const text = message.text.trim();

        const cmdMatch = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)?/);
        if (!cmdMatch) return res.status(200).json({ ok: true });

        const cmd = cmdMatch[1].toLowerCase();
        const args = (cmdMatch[2] || '').trim();

        if (chatType === 'private' && cmd === 'start') {
            await handleStart(chatId, args.split(/\s+/)[0]);
        } else if (cmd === 'state') {
            await handleState(chatId);
        } else if (cmd === 'add') {
            await handleAdd(chatId, username, args);
        } else if (cmd === 'done') {
            await handleDone(chatId, username, args);
        } else if (cmd === 'remove') {
            await handleRemove(chatId, username, args);
        } else if (cmd === 'current') {
            await handleCurrent(chatId, username, args);
        } else if (cmd === 'help') {
            await sendMsg(chatId,
                '🦞 <b>Inclawbate Bot</b>\n\n' +
                '/state — See numbered list\n' +
                '/current 3 — Set current task\n' +
                '/add thing — Add to list\n' +
                '/done 1 — Check off by number\n' +
                '/remove 2 — Delete by number'
            );
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: true });
    }
}
