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
    // Get latest state entries
    const { data: entries } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'state')
        .order('created_at', { ascending: false })
        .limit(1);

    const { data: priorities } = await supabase
        .from('team_state')
        .select('*')
        .eq('category', 'priority')
        .order('created_at', { ascending: false })
        .limit(5);

    const { data: recent } = await supabase
        .from('team_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    let msg = '🦞 <b>INCLAWBATE — Current State</b>\n\n';

    if (entries && entries[0]) {
        msg += `<b>Status:</b>\n${esc(entries[0].content)}\n<i>${timeAgo(entries[0].created_at)}</i>\n\n`;
    } else {
        msg += '<i>No state set yet. Admin can use /update state &lt;text&gt;</i>\n\n';
    }

    if (priorities && priorities.length) {
        msg += '<b>Current Priorities:</b>\n';
        priorities.forEach((p, i) => {
            msg += `${i + 1}. ${esc(p.content)} <i>(${timeAgo(p.created_at)})</i>\n`;
        });
        msg += '\n';
    }

    if (recent && recent.length) {
        msg += '<b>Recent Updates:</b>\n';
        recent.forEach(r => {
            msg += `• [${esc(r.category)}] ${esc(r.content).slice(0, 120)} <i>(${timeAgo(r.created_at)})</i>\n`;
        });
    }

    msg += '\n🔗 inclawbate.com/dashboard';
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

async function handleTasks(chatId) {
    const { data } = await supabase
        .from('team_state')
        .select('*')
        .in('category', ['task', 'priority'])
        .order('created_at', { ascending: false })
        .limit(15);

    let msg = '🦞 <b>INCLAWBATE — Tasks & Priorities</b>\n\n';

    if (!data || !data.length) {
        msg += '<i>No tasks logged yet. Admin can use /update task &lt;text&gt;</i>';
    } else {
        data.forEach((t, i) => {
            const tag = t.category === 'priority' ? '🔴' : '📋';
            msg += `${tag} ${esc(t.content)} <i>(${timeAgo(t.created_at)})</i>\n`;
        });
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

async function handleUpdate(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can post updates.');
        return;
    }

    // Parse: /update <category> <content>
    // Categories: state, priority, task, note, ship, blocker
    const validCategories = ['state', 'priority', 'task', 'note', 'ship', 'blocker', 'vision'];
    const parts = args.split(/\s+/);
    let category = parts[0]?.toLowerCase();
    let content;

    if (validCategories.includes(category)) {
        content = parts.slice(1).join(' ');
    } else {
        // Default to 'note' if no category specified
        category = 'note';
        content = args;
    }

    if (!content) {
        await sendMsg(chatId,
            '📝 <b>Usage:</b> /update &lt;category&gt; &lt;text&gt;\n\n' +
            '<b>Categories:</b> state, priority, task, note, ship, blocker, vision\n\n' +
            '<b>Examples:</b>\n' +
            '/update state Coinbase Commerce integration in progress\n' +
            '/update priority Ship fiat on-ramp by March 31\n' +
            '/update ship Wallet selector modal shipped\n' +
            '/update blocker Waiting on Coinbase API approval'
        );
        return;
    }

    const { error } = await supabase
        .from('team_state')
        .insert({ category, content, author: username });

    if (error) {
        await sendMsg(chatId, '❌ Failed to save: ' + esc(error.message));
        return;
    }

    const emoji = { state: '📊', priority: '🔴', task: '📋', note: '📝', ship: '🚀', blocker: '🚧', vision: '🌟' };
    await sendMsg(chatId, `${emoji[category] || '✅'} <b>${esc(category).toUpperCase()}</b> logged.\n\n${esc(content)}`);
}

async function handleBulk(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can bulk import.');
        return;
    }

    // Parse: /bulk <category>\n- item 1\n- item 2\n...
    // Or: /bulk task\nitem 1\nitem 2\n...
    const lines = args.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
        await sendMsg(chatId,
            '📦 <b>Bulk Import</b>\n\n' +
            '<b>Usage:</b>\n/bulk task\n- Coinbase Commerce integration\n- Automated LP manager\n- App reward pools\n\n' +
            'Or:\n/bulk priority\nShip fiat by March 31\n50 apps goal\n\n' +
            'Categories: task, priority, note, blocker, ship'
        );
        return;
    }

    const validCategories = ['state', 'priority', 'task', 'note', 'ship', 'blocker', 'vision'];
    const category = lines[0].toLowerCase();
    if (!validCategories.includes(category)) {
        await sendMsg(chatId, `❌ Unknown category "${esc(lines[0])}". Use: ${validCategories.join(', ')}`);
        return;
    }

    const items = lines.slice(1).map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    if (!items.length) {
        await sendMsg(chatId, '❌ No items found. Put each item on a new line.');
        return;
    }

    const rows = items.map(content => ({ category, content, author: username }));
    const { error } = await supabase.from('team_state').insert(rows);

    if (error) {
        await sendMsg(chatId, '❌ Failed: ' + esc(error.message));
        return;
    }

    let msg = `📦 <b>${items.length} ${category}(s) imported:</b>\n\n`;
    items.forEach((item, i) => { msg += `${i + 1}. ${esc(item)}\n`; });
    await sendMsg(chatId, msg);
}

async function handleDone(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can mark tasks done.');
        return;
    }

    if (!args) {
        await sendMsg(chatId,
            '✅ <b>Usage:</b> /done &lt;search text&gt;\n\n' +
            'Marks the matching task/priority as shipped.\n\n' +
            'Example: /done Coinbase Commerce'
        );
        return;
    }

    // Find the matching entry
    const { data } = await supabase
        .from('team_state')
        .select('*')
        .in('category', ['task', 'priority', 'blocker'])
        .ilike('content', `%${args}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!data || !data.length) {
        await sendMsg(chatId, `❌ No task found matching "${esc(args)}"`);
        return;
    }

    const entry = data[0];

    // Delete the old entry and log a "ship" entry
    await supabase.from('team_state').delete().eq('id', entry.id);
    await supabase.from('team_state').insert({
        category: 'ship',
        content: entry.content,
        author: username
    });

    await sendMsg(chatId, `🚀 <b>SHIPPED:</b> ${esc(entry.content)}`);
}

async function handleClear(chatId, username, args) {
    if (!isAdmin(username)) {
        await sendMsg(chatId, '🔒 Only the admin can clear.');
        return;
    }

    const validCategories = ['state', 'priority', 'task', 'note', 'ship', 'blocker', 'vision', 'all'];
    const category = args.toLowerCase();

    if (!category || !validCategories.includes(category)) {
        await sendMsg(chatId,
            '🗑️ <b>Usage:</b> /clear &lt;category&gt;\n\n' +
            'Categories: task, priority, note, ship, blocker, vision, all\n\n' +
            '⚠️ This deletes all entries in that category.'
        );
        return;
    }

    let query = supabase.from('team_state').delete();
    if (category !== 'all') query = query.eq('category', category);
    // Need a filter for delete — use created_at is not null (always true)
    query = query.not('id', 'is', null);

    const { error, count } = await query;
    if (error) {
        await sendMsg(chatId, '❌ Failed: ' + esc(error.message));
        return;
    }

    await sendMsg(chatId, `🗑️ Cleared all <b>${category}</b> entries.`);
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
        '🦞 <b>Inclawbate CEO Bot</b>\n\n' +
        '<b>Everyone:</b>\n' +
        '/state — Current state, priorities, recent updates\n' +
        '/vision — The Inclawbate vision\n' +
        '/tasks — Current tasks & priorities\n' +
        '/scan &lt;keyword&gt; — Search all updates\n' +
        '/links — Key links & token addresses\n' +
        '/help — This message\n\n' +
        '<b>Admin only:</b>\n' +
        '/update &lt;category&gt; &lt;text&gt; — Log an update\n' +
        '/bulk &lt;category&gt; — Bulk import (one per line)\n' +
        '/done &lt;search text&gt; — Mark a task as shipped\n' +
        '/clear &lt;category&gt; — Wipe a category\n' +
        '  Categories: state, priority, task, note, ship, blocker, vision\n\n' +
        '<b>DM only:</b>\n' +
        '/start &lt;handle&gt; — Connect your Inclawbate profile'
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
            case 'vision':
                await handleVision(chatId);
                break;
            case 'tasks':
                await handleTasks(chatId);
                break;
            case 'scan':
                await handleScan(chatId, args);
                break;
            case 'update':
                await handleUpdate(chatId, username, args);
                break;
            case 'bulk':
                await handleBulk(chatId, username, args);
                break;
            case 'done':
                await handleDone(chatId, username, args);
                break;
            case 'clear':
                await handleClear(chatId, username, args);
                break;
            case 'links':
                await handleLinks(chatId);
                break;
            case 'help':
                await handleHelp(chatId);
                break;
            default:
                // Only respond to unknown commands in DMs, stay quiet in groups
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
