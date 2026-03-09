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
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        chunks.push(remaining.slice(0, 4000));
        remaining = remaining.slice(4000);
    }
    for (const chunk of chunks) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true })
        });
    }
}

function isAdmin(username) {
    return username && username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

// ── /state — shows everything ──

async function handleState(chatId) {
    const { data: todos } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .order('created_at', { ascending: true });

    const { data: done } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'done')
        .order('created_at', { ascending: false })
        .limit(10);

    let msg = '🦞 <b>INCLAWBATE</b>\n\n';

    if (todos && todos.length) {
        todos.forEach(t => { msg += `☐ ${esc(t.content)}\n`; });
    } else {
        msg += '<i>Nothing on the list. Use /add to add stuff.</i>\n';
    }

    if (done && done.length) {
        msg += '\n<b>Done:</b>\n';
        done.forEach(d => { msg += `☑ ${esc(d.content)}\n`; });
    }

    await sendMsg(chatId, msg);
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

    let msg = '';
    items.forEach(i => { msg += `☐ ${esc(i)}\n`; });
    await sendMsg(chatId, msg);
}

// ── /done — check something off (admin only) ──

async function handleDone(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can check things off.');
        return;
    }
    if (!args) {
        await sendMsg(chatId, '/done some matching text');
        return;
    }

    const { data } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .ilike('content', `%${args}%`)
        .limit(1);

    if (!data || !data.length) {
        await sendMsg(chatId, `❌ No match for "${esc(args)}"`);
        return;
    }

    await supabase.from('team_state').delete().eq('id', data[0].id);
    await supabase.from('team_state').insert({ category: 'done', content: data[0].content, author: username });
    await sendMsg(chatId, `☑ ${esc(data[0].content)}`);
}

// ── /remove — delete something (admin only) ──

async function handleRemove(chatId, username, args) {
    if (!isAdmin(username)) return;
    if (!args) { await sendMsg(chatId, '/remove some matching text'); return; }

    const { data } = await supabase
        .from('team_state')
        .select('*')
        .ilike('content', `%${args}%`)
        .limit(1);

    if (!data || !data.length) { await sendMsg(chatId, `❌ No match`); return; }
    await supabase.from('team_state').delete().eq('id', data[0].id);
    await sendMsg(chatId, `🗑 ${esc(data[0].content)}`);
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
        } else if (cmd === 'help') {
            await sendMsg(chatId,
                '🦞 <b>Inclawbate Bot</b>\n\n' +
                '/state — See the list\n' +
                '/add thing — Add to list\n' +
                '/done thing — Check it off\n' +
                '/remove thing — Delete it'
            );
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: true });
    }
}
