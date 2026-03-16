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

// ── /state — shows focus + active projects + numbered backlog ──

async function handleState(chatId) {
    const [focusRes, incubationRes, responsibilityRes, todoRes, doneRes] = await Promise.all([
        supabase.from('team_state').select('*').eq('category', 'current').order('created_at', { ascending: true }),
        supabase.from('team_state').select('*').eq('category', 'incubation').order('created_at', { ascending: true }),
        supabase.from('team_state').select('*').eq('category', 'responsibility').order('created_at', { ascending: true }),
        supabase.from('team_state').select('*').eq('category', 'todo').order('created_at', { ascending: true }),
        supabase.from('team_state').select('*').eq('category', 'done').order('created_at', { ascending: false }).limit(5)
    ]);

    const focus = focusRes.data || [];
    const incubations = incubationRes.data || [];
    const responsibilities = responsibilityRes.data || [];
    const todos = todoRes.data || [];
    const done = doneRes.data || [];

    let msg = '🦞 <b>INCLAWBATE STATE</b>\n';
    msg += '<i>inclawbate.com/state</i>\n';

    if (focus.length) {
        msg += `\n🔥 <b>FOCUS (${focus.length})</b>\n`;
        focus.forEach(c => { msg += `→ ${esc(c.content)}\n`; });
    }

    if (incubations.length) {
        msg += `\n🦞 <b>INCUBATIONS (${incubations.length})</b>\n`;
        incubations.forEach((a, i) => { msg += `${i + 1}. ${esc(a.content)}\n`; });
    }

    if (responsibilities.length) {
        msg += `\n👥 <b>RESPONSIBILITIES</b>\n`;
        responsibilities.forEach(r => { msg += `• ${esc(r.content)}\n`; });
    }

    if (todos.length) {
        msg += `\n📋 <b>BACKLOG (${todos.length})</b>\n`;
        todos.forEach((t, i) => { msg += `${i + 1}. ${esc(t.content)}\n`; });
    }

    if (done.length) {
        msg += `\n✅ <b>RECENTLY DONE</b>\n`;
        done.forEach(d => { msg += `• ${esc(d.content)}\n`; });
    }

    if (!focus.length && !incubations.length && !todos.length) {
        msg += '\n<i>Nothing tracked. /add something</i>\n';
    }

    await sendMsg(chatId, msg);
}

// ── /incubation — add/show incubation projects (admin only) ──

async function handleIncubation(chatId, username, args) {
    if (!isAdmin(username)) return;

    if (!args) {
        const { data } = await supabase
            .from('team_state')
            .select('*')
            .eq('category', 'incubation')
            .order('created_at', { ascending: true });

        if (data && data.length) {
            let msg = '🦞 <b>INCUBATIONS:</b>\n';
            data.forEach((a, i) => { msg += `${i + 1}. ${esc(a.content)}\n`; });
            await sendMsg(chatId, msg);
        } else {
            await sendMsg(chatId, '<i>No incubations. /incubation Project Name to add one</i>');
        }
        return;
    }

    // Add directly as incubation
    const { error } = await supabase.from('team_state').insert({ category: 'incubation', content: args, author: username });
    if (error) { await sendMsg(chatId, '❌ ' + esc(error.message)); return; }
    await sendMsg(chatId, `🦞 <b>Incubation added:</b> ${esc(args)}`);
}

// ── /duty — add/show responsibilities (admin only) ──

async function handleDuty(chatId, username, args) {
    if (!isAdmin(username)) return;

    if (!args) {
        const { data } = await supabase
            .from('team_state')
            .select('*')
            .eq('category', 'responsibility')
            .order('created_at', { ascending: true });

        if (data && data.length) {
            let msg = '👥 <b>RESPONSIBILITIES:</b>\n';
            data.forEach((r, i) => { msg += `${i + 1}. ${esc(r.content)}\n`; });
            await sendMsg(chatId, msg);
        } else {
            await sendMsg(chatId, '<i>No responsibilities. /duty Daily X posts — Stu</i>');
        }
        return;
    }

    const { error } = await supabase.from('team_state').insert({ category: 'responsibility', content: args, author: username });
    if (error) { await sendMsg(chatId, '❌ ' + esc(error.message)); return; }
    await sendMsg(chatId, `👥 <b>Responsibility added:</b> ${esc(args)}`);
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

// ── /research — daily marketing research prompt anyone can grab ──

const RESEARCH_PROMPT = `You are a marketing researcher for Inclawbate (inclawbate.com) — an incubator that helps ANYONE build and launch projects. We've helped golf equipment manufacturers, churches, app creators, token launchers, and everything in between. Our motto: "Anyone Can Build."

Daily research report:

1. Who needs help building? — Search Reddit, X, Facebook groups, forums for people saying "I have an idea but don't know how to build it", "looking for a developer", "need a website for my business", "how do I launch a product". Find real people we could reach out to.

2. Small business and creator trends — What tools, platforms, or movements are growing? No-code, AI tools, creator economy, small business struggles, side hustles — what are people talking about today?

3. Outreach opportunities — Any communities, events, podcasts, or groups where we should introduce Inclawbate? Think local business groups, startup communities, church networks, maker spaces, NOT just crypto.

4. Content ideas — 3 posts showing real examples of what Inclawbate can build (websites, apps, stores, tokens, communities). Relatable to normal people, not crypto jargon.

5. Partnership leads — Any platforms, influencers, or organizations serving underserved builders (small towns, non-technical founders, creators) we should connect with?

Bullets, no fluff. Actionable today.`;

async function handleResearch(chatId) {
    await sendMsg(chatId,
        '🔬 <b>Daily Research Prompt</b>\n\n' +
        'Copy the prompt below and paste it into any AI tool. Drop the results back here!\n\n' +
        '<code>' + esc(RESEARCH_PROMPT) + '</code>\n\n' +
        '🔗 <a href="https://claude.ai/new">Claude</a>  |  <a href="https://gemini.google.com/app">Gemini</a>  |  <a href="https://grok.com/">Grok</a>'
    );
}

// ── Store message in telegram_messages table for ClawsNet bridge ──

async function storeMessage(update) {
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return;
    try {
        const row = {
            message_id: msg.message_id,
            text: msg.text,
            from_id: msg.from?.id,
            from_name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' '),
            from_username: msg.from?.username || null,
            reply_to_id: msg.reply_to_message?.message_id || null,
            reply_to_text: msg.reply_to_message?.text?.slice(0, 200) || null,
            reply_to_name: msg.reply_to_message ? [msg.reply_to_message.from?.first_name, msg.reply_to_message.from?.last_name].filter(Boolean).join(' ') : null,
            timestamp: msg.date * 1000,
            edited: !!update.edited_message,
        };
        if (update.edited_message) {
            await supabase.from('telegram_messages').upsert(row, { onConflict: 'message_id' });
        } else {
            await supabase.from('telegram_messages').insert(row);
        }
    } catch (e) { /* silent — don't break bot commands */ }
}

// ── Main ──

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        // Store every message for ClawsNet bridge
        await storeMessage(req.body);

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
        } else if (cmd === 'incubation') {
            await handleIncubation(chatId, username, args);
        } else if (cmd === 'duty') {
            await handleDuty(chatId, username, args);
        } else if (cmd === 'research') {
            await handleResearch(chatId);
        } else if (cmd === 'daily') {
            if (!isAdmin(username)) { await sendMsg(chatId, '🔒 Admin only.'); }
            else {
                await sendMsg(chatId, '⏳ Generating daily post...');
                try {
                    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.inclawbate.com';
                    const protocol = host.includes('localhost') ? 'http' : 'https';
                    const r = await fetch(`${protocol}://${host}/api/inclawbate/council-daily`, { method: 'POST' });
                    if (r.ok) await sendMsg(chatId, '✅ Daily post sent!');
                    else await sendMsg(chatId, '❌ Failed: ' + (await r.text()).slice(0, 200));
                } catch (e) { await sendMsg(chatId, '❌ ' + esc(e.message)); }
            }
        } else if (cmd === 'myid') {
            await sendMsg(chatId, '🆔 Your chat ID: <code>' + chatId + '</code>');
        } else if (cmd === 'help') {
            await sendMsg(chatId,
                '🦞 <b>Inclawbate Bot</b>\n\n' +
                '<b>Tasks</b>\n' +
                '/state — Full state\n' +
                '/current 3 — Set focus item\n' +
                '/current clear — Clear focus\n' +
                '/add thing — Add to backlog\n' +
                '/done 1 — Check off by number\n' +
                '/remove 2 — Delete by number\n\n' +
                '<b>Projects</b>\n' +
                '/incubation Name — Add incubation\n' +
                '/duty Task — Owner — Add responsibility\n\n' +
                '<b>Marketing</b>\n' +
                '/research — Daily research prompt\n\n' +
                '<b>Council</b>\n' +
                '/daily — Post daily CLAWS update (admin)\n\n' +
                '<b>Other</b>\n' +
                '/start yourxhandle — Link your X profile (DM)\n' +
                '/myid — Get your chat ID\n' +
                '/help — This message'
            );
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: true });
    }
}
