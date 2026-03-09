// Inclawbate — Telegram CEO Bot Webhook
// Handles team coordination commands in groups + profile linking in DMs
// POST /api/inclawbate/telegram-webhook — called by Telegram Bot API

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = 'StuartDeFi'; // Only admin can /update, /vision-set, etc.

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMsg(chatId, text) {
    if (!BOT_TOKEN) return;
    // Telegram limits messages to 4096 chars
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

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
}

// ── Command Handlers ──

async function handleState(chatId) {
    // Status line
    const { data: stateEntry } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'state')
        .order('created_at', { ascending: false })
        .limit(1);

    // All todos
    const { data: todos } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .order('created_at', { ascending: true });

    // Recently done
    const { data: done } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'done')
        .order('created_at', { ascending: false })
        .limit(5);

    // Notes
    const { data: notes } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'note')
        .order('created_at', { ascending: false })
        .limit(3);

    let msg = '🦞 <b>INCLAWBATE</b>\n\n';

    // Status
    if (stateEntry && stateEntry[0]) {
        msg += `${esc(stateEntry[0].content)}\n\n`;
    } else {
        msg += '<i>No status set. Use /status to set one.</i>\n\n';
    }

    // Todo list
    if (todos && todos.length) {
        msg += '<b>Todo:</b>\n';
        todos.forEach(t => { msg += `☐ ${esc(t.content)}\n`; });
    } else {
        msg += '<i>No todos yet. Use /add to add stuff.</i>\n';
    }
    msg += '\n';

    // Done
    if (done && done.length) {
        msg += '<b>Done:</b>\n';
        done.forEach(d => { msg += `☑ ${esc(d.content)}\n`; });
    }

    // Notes
    if (notes && notes.length) {
        msg += '\n<b>Notes:</b>\n';
        notes.forEach(n => { msg += `💬 ${esc(n.content)}\n`; });
    }

    msg += '\n🔗 inclawbate.com';
    await sendMsg(chatId, msg);
}

async function handleVision(chatId) {
    // Check for custom vision in DB first
    const { data } = await supabase
        .from('team_state')
        .select('content')
        .eq('category', 'vision')
        .order('created_at', { ascending: false })
        .limit(1);

    let msg = '🦞 <b>INCLAWBATE — Vision</b>\n\n';
    if (data && data[0]) {
        msg += esc(data[0].content);
    } else {
        msg += 'Building a <b>self-sustaining, autonomous ecosystem</b> that:\n\n';
        msg += '1. <b>Generates revenue</b> — DeFi yields, platform fees, agent services, apps\n';
        msg += '2. <b>Rewards participants</b> — CLAWS stakers earn a share\n';
        msg += '3. <b>Funds philanthropy</b> — surplus goes to S4H and beyond\n\n';
        msg += 'End goal: a fully autonomous system that provides tools, incubation, and value — while permanently directing energy toward good.\n\n';
        msg += '<i>"A jittering ball of goodness."</i>';
    }
    msg += '\n\n🔗 inclawbate.com';
    await sendMsg(chatId, msg);
}

async function handleTodo(chatId) {
    const { data } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .order('created_at', { ascending: true });

    let msg = '🦞 <b>Todo</b>\n\n';

    if (!data || !data.length) {
        msg += '<i>Nothing on the list. Use /add to add stuff.</i>';
    } else {
        data.forEach(t => { msg += `☐ ${esc(t.content)}\n`; });
    }

    await sendMsg(chatId, msg);
}

async function handleScan(chatId, query) {
    if (!query) {
        await sendMsg(chatId, '🔍 Usage: /scan &lt;keyword&gt;\n\nSearches all updates for a topic.');
        return;
    }

    const { data } = await supabase
        .from('team_state')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);

    let msg = `🔍 <b>Results for "${esc(query)}"</b>\n\n`;
    if (!data || !data.length) {
        msg += '<i>No matches found.</i>';
    } else {
        data.forEach(r => {
            msg += `• [${esc(r.category)}] ${esc(r.content).slice(0, 150)} <i>(${timeAgo(r.created_at)} by ${esc(r.author || '?')})</i>\n\n`;
        });
    }

    await sendMsg(chatId, msg);
}

async function handleAdd(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can add items.');
        return;
    }

    if (!args) {
        await sendMsg(chatId, '📝 <b>Usage:</b> /add Do the thing\n\nAdds to the todo list.');
        return;
    }

    // Support multiple items separated by newlines
    const items = args.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    const rows = items.map(content => ({ category: 'todo', content, author: username }));

    const { error } = await supabase.from('team_state').insert(rows);
    if (error) {
        await sendMsg(chatId, '❌ Failed: ' + esc(error.message));
        return;
    }

    if (items.length === 1) {
        await sendMsg(chatId, `☐ ${esc(items[0])}`);
    } else {
        let msg = `☐ <b>${items.length} items added:</b>\n`;
        items.forEach(i => { msg += `☐ ${esc(i)}\n`; });
        await sendMsg(chatId, msg);
    }
}

async function handleNote(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can add notes.');
        return;
    }
    if (!args) {
        await sendMsg(chatId, '💬 <b>Usage:</b> /note Some thought or context');
        return;
    }

    const { error } = await supabase.from('team_state').insert({ category: 'note', content: args, author: username });
    if (error) {
        await sendMsg(chatId, '❌ Failed: ' + esc(error.message));
        return;
    }
    await sendMsg(chatId, `💬 ${esc(args)}`);
}

async function handleStatus(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can set status.');
        return;
    }
    if (!args) {
        await sendMsg(chatId, '📊 <b>Usage:</b> /status Working on fiat on-ramp');
        return;
    }

    const { error } = await supabase.from('team_state').insert({ category: 'state', content: args, author: username });
    if (error) {
        await sendMsg(chatId, '❌ Failed: ' + esc(error.message));
        return;
    }
    await sendMsg(chatId, `📊 Status updated.`);
}

async function handleDone(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can mark things done.');
        return;
    }

    if (!args) {
        await sendMsg(chatId, '☑ <b>Usage:</b> /done Coinbase Commerce\n\nMarks the matching todo as done.');
        return;
    }

    const { data } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'todo')
        .ilike('content', `%${args}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!data || !data.length) {
        await sendMsg(chatId, `❌ No todo found matching "${esc(args)}"`);
        return;
    }

    const entry = data[0];
    await supabase.from('team_state').delete().eq('id', entry.id);
    await supabase.from('team_state').insert({ category: 'done', content: entry.content, author: username });

    await sendMsg(chatId, `☑ ${esc(entry.content)}`);
}

async function handleRemove(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can remove items.');
        return;
    }

    if (!args) {
        await sendMsg(chatId, '🗑️ <b>Usage:</b> /remove some text\n\nDeletes the matching item.');
        return;
    }

    const { data } = await supabase
        .from('team_state')
        .select('*')
        .ilike('content', `%${args}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!data || !data.length) {
        await sendMsg(chatId, `❌ Nothing found matching "${esc(args)}"`);
        return;
    }

    await supabase.from('team_state').delete().eq('id', data[0].id);
    await sendMsg(chatId, `🗑️ Removed: ${esc(data[0].content)}`);
}

async function handleClear(chatId, username) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can clear.');
        return;
    }

    await supabase.from('team_state').delete().not('id', 'is', null);
    await sendMsg(chatId, '🗑️ Everything cleared.');
}

async function handleLinks(chatId) {
    await sendMsg(chatId,
        '🦞 <b>INCLAWBATE — Links</b>\n\n' +
        '🌐 <a href="https://inclawbate.com">Platform</a>\n' +
        '🏗️ <a href="https://inclawbate.com/build">Build Studio</a>\n' +
        '🚀 <a href="https://inclawbate.com/inclawbator">Inclawbator</a>\n' +
        '📊 <a href="https://inclawbate.com/dashboard">Dashboard</a>\n' +
        '🥩 <a href="https://inclawbate.com/stake">Staking</a>\n' +
        '🎮 <a href="https://agentscape.app">AgentScape</a>\n' +
        '❤️ <a href="https://salvation4humanity.com">S4H</a>\n\n' +
        '<b>Tokens:</b>\n' +
        '🦀 CLAWS: <code>0x7ca47B141639B893C6782823C0b219f872056379</code>\n' +
        '📜 INCLAWNCH: <code>0xB0b6e0E9da530f68D713cC03a813B506205aC808</code>\n' +
        '🙏 S4H: <code>0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07</code>\n\n' +
        '<b>Socials:</b>\n' +
        '🐦 <a href="https://x.com/inclawbate">X</a> · 📱 <a href="https://t.me/inclawbate">Telegram</a>'
    );
}

async function handleHelp(chatId) {
    await sendMsg(chatId,
        '🦞 <b>Inclawbate Bot</b>\n\n' +
        '/state — What\'s going on\n' +
        '/todo — The todo list\n' +
        '/vision — Why we\'re doing this\n' +
        '/scan &lt;keyword&gt; — Search\n' +
        '/links — Links & tokens\n\n' +
        '<b>Admin:</b>\n' +
        '/add Thing to do — Add to todo (multi-line ok)\n' +
        '/done Some text — Mark it done\n' +
        '/note Some thought — Add a note\n' +
        '/status New status — Set the status line\n' +
        '/remove Some text — Delete an item\n' +
        '/clear — Wipe everything'
    );
}

// ── Original /start handler (DM only) ──

async function handleStart(chatId, handle) {
    if (!handle) {
        await sendMsg(chatId,
            '🦞 <b>Welcome to Inclawbate!</b>\n\n' +
            'To connect your profile, go to your profile on inclawbate.com and click "Connect Telegram".\n\n' +
            'Or send: /start yourxhandle'
        );
        return;
    }

    const { data: profile, error } = await supabase
        .from('human_profiles')
        .select('id, x_handle, x_name')
        .eq('x_handle', handle.toLowerCase())
        .single();

    if (error || !profile) {
        await sendMsg(chatId,
            `❌ No profile found for @${esc(handle)}. Make sure you've created your profile at inclawbate.com first.`
        );
        return;
    }

    const { error: updateErr } = await supabase
        .from('human_profiles')
        .update({ telegram_chat_id: String(chatId) })
        .eq('id', profile.id);

    if (updateErr) {
        await sendMsg(chatId, '❌ Something went wrong. Try again.');
        return;
    }

    await sendMsg(chatId,
        `✅ <b>Connected!</b>\n\nYou'll now get notified here when an agent hires you or sends a message.\n\nProfile: inclawbate.com/u/${esc(profile.x_handle)}`
    );
}

// ── Main Handler ──

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const update = req.body;
        const message = update?.message;
        if (!message || !message.text) return res.status(200).json({ ok: true });

        const chatId = message.chat.id;
        const chatType = message.chat.type;
        const username = message.from?.username || '';
        const text = message.text.trim();

        // Strip @botname suffix from commands (e.g. /state@inclawbate_bot)
        const cmdMatch = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)?/);
        if (!cmdMatch) return res.status(200).json({ ok: true });

        const cmd = cmdMatch[1].toLowerCase();
        const args = (cmdMatch[2] || '').trim();

        // DM-only commands
        if (chatType === 'private' && cmd === 'start') {
            await handleStart(chatId, args.split(/\s+/)[0]);
            return res.status(200).json({ ok: true });
        }

        // Commands that work everywhere (groups + DMs)
        switch (cmd) {
            case 'state':
                await handleState(chatId);
                break;
            case 'todo':
            case 'tasks':
                await handleTodo(chatId);
                break;
            case 'vision':
                await handleVision(chatId);
                break;
            case 'scan':
                await handleScan(chatId, args);
                break;
            case 'add':
                await handleAdd(chatId, username, args);
                break;
            case 'done':
                await handleDone(chatId, username, args);
                break;
            case 'note':
                await handleNote(chatId, username, args);
                break;
            case 'status':
                await handleStatus(chatId, username, args);
                break;
            case 'remove':
                await handleRemove(chatId, username, args);
                break;
            case 'clear':
                await handleClear(chatId, username);
                break;
            case 'links':
                await handleLinks(chatId);
                break;
            case 'help':
                await handleHelp(chatId);
                break;
            default:
                if (chatType === 'private') {
                    await handleHelp(chatId);
                }
                break;
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: true }); // Always 200 so Telegram doesn't retry
    }
}
