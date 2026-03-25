// Inclawbate — Telegram Bot
// 3 commands: /state, /add, /done
// POST /api/inclawbate/telegram-webhook

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAMES = ['StuartDeFi', 'FreefoRaLLey'];

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
    return username && ADMIN_USERNAMES.some(a => a.toLowerCase() === username.toLowerCase());
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
    msg += '<i>inclawbate.app/claws</i>\n';

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
    await sendMsg(chatId, `✅ Connected! inclawbate.app/u/${esc(profile.x_handle)}`);
}

// ── /research — daily marketing research prompt anyone can grab ──

const RESEARCH_PROMPT = `You are a marketing researcher for Inclawbate (inclawbate.app) — an incubator that helps ANYONE build and launch projects. We've helped golf equipment manufacturers, churches, app creators, token launchers, and everything in between. Our motto: "Anyone Can Build."

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

// ── /marketingpovs — all marketing perspectives ──

const MARKETING_POVS = [
    { num: 1, emoji: '🔨', name: 'THE BUILDER', angle: 'Anyone can build. No code needed. AI does the work.', target: 'Non-technical people, small biz, creators' },
    { num: 2, emoji: '🚀', name: 'THE LAUNCHER', angle: 'Launch a token with real infrastructure, not just a meme.', target: 'Token creators, memecoin degens' },
    { num: 3, emoji: '💰', name: 'THE YIELD MACHINE', angle: 'Everything you touch earns. Stake, play, build — it all compounds.', target: 'DeFi users, yield farmers' },
    { num: 4, emoji: '🃏', name: 'THE GAME', angle: 'Play poker against AI. Real money. Real strategy.', target: 'Poker players, crypto gamers' },
    { num: 5, emoji: '💼', name: 'THE GIG ECONOMY', angle: 'Get hired on-chain. Build your portfolio. Earn crypto.', target: 'Freelancers, devs, designers' },
    { num: 6, emoji: '🏛️', name: 'THE DAO', angle: 'Community-governed treasury. Your CLAWS = your vote.', target: 'Governance enthusiasts, holders' },
    { num: 7, emoji: '🤖', name: 'THE AI ARMY', angle: 'AI agents that work 24/7 — tweeting, building, playing, growing.', target: 'Tech enthusiasts, AI believers' },
    { num: 8, emoji: '♾️', name: 'THE PERPETUAL ENGINE', angle: 'A system that outlives everyone. Unstoppable. Forever.', target: 'Philosophical crypto thinkers' },
    { num: 9, emoji: '✊', name: "THE PEOPLE'S PLATFORM", angle: 'No VC. No gatekeepers. Built by people, for people.', target: 'Anti-establishment, indie builders' },
    { num: 10, emoji: '🧰', name: 'THE TOOLKIT', angle: '50+ free tools for builders, devs, and creators.', target: 'Developers, SEO people, creators' },
    { num: 11, emoji: '🕊️', name: 'THE PHILANTHROPIST', angle: 'Crypto that gives back. Real impact. Real giving.', target: 'Faith communities, impact investors' },
    { num: 12, emoji: '🌱', name: 'THE MISSION', angle: 'Love God. Love Others. Build technology that helps humans flourish.', target: 'Faith communities, purpose-driven builders' },
    { num: 13, emoji: '🥚', name: 'THE INCUBATOR', angle: 'Submit your idea. We build everything. You just show up.', target: 'First-time founders, non-crypto people' },
    { num: 14, emoji: '🔄', name: 'THE SELF-FUNDING LOOP', angle: 'Revenue feeds growth feeds revenue. The loop runs itself.', target: 'Crypto analysts, business-minded' },
    { num: 15, emoji: '🌐', name: 'WEB3 SIMPLIFIED', angle: "Crypto is complicated. We made it simple.", target: 'Normies, web2 people, students' },
];

async function handleMarketingPovs(chatId, args) {
    // If a number is given, show detail for that perspective
    const num = parseInt(args, 10);
    if (!isNaN(num) && num >= 1 && num <= MARKETING_POVS.length) {
        const p = MARKETING_POVS[num - 1];
        let msg = `${p.emoji} <b>${p.name}</b>\n\n`;
        msg += `<b>Angle:</b> ${esc(p.angle)}\n`;
        msg += `<b>Target:</b> ${esc(p.target)}\n\n`;
        msg += `📖 Full details: inclawbate.app/tools\n`;
        msg += `\n<i>Use /marketingpovs to see all perspectives</i>`;
        await sendMsg(chatId, msg);
        return;
    }

    let msg = '🦞 <b>MARKETING PERSPECTIVES</b>\n';
    msg += '<i>15 angles Inclawbate can market from</i>\n\n';

    for (const p of MARKETING_POVS) {
        msg += `${p.emoji} <b>${p.num}. ${p.name}</b>\n`;
        msg += `${esc(p.angle)}\n`;
        msg += `<i>→ ${esc(p.target)}</i>\n\n`;
    }

    msg += '<b>HIGH CONVERSION:</b> #1 Builder, #4 Game, #3 Yield, #10 Toolkit\n';
    msg += '<b>HIGH ENGAGEMENT:</b> #12 Brand, #9 People, #8 Engine, #6 DAO\n';
    msg += '<b>HIGH TRUST:</b> #14 Loop, #11 Philanthropist, #5 Gig\n\n';
    msg += '<i>/marketingpovs 4 — view one in detail</i>';

    await sendMsg(chatId, msg);
}

// ── /brand — visual identity reference ──

async function handleBrand(chatId) {
    let msg = '🌱 <b>INCLAWBATE BRAND</b>\n\n';

    msg += '<b>Mission:</b> Love God and Love Others\n';
    msg += '<b>Tagline:</b> "Anyone Can Build. Everyone Gets Paid."\n\n';

    msg += '<b>🧑 Visual Identity — Human-Centered</b>\n';
    msg += '• REAL HUMANS are the focal point of ALL visuals\n';
    msg += '• Style: editorial photography, warm natural light, golden hour\n';
    msg += '• Settings: kitchens, offices, churches, parks, mission fields\n';
    msg += '• Show people: building apps, checking rewards, coordinating missions, flourishing\n';
    msg += '• The lobster is a BRAND MARK only — favicon, sticker, icon accent\n\n';

    msg += '<b>🎯 Color Palette</b>\n';
    msg += '• Coral: #e87955 (primary accent, warmth)\n';
    msg += '• Indigo: #6366f1 (links, UI, tech accent)\n';
    msg += '• Warm Green: #4ade80 (growth, success)\n';
    msg += '• Soft Teal: #2dd4bf (trust, stability)\n';
    msg += '• Warm White: #faf8f5 (light backgrounds)\n\n';

    msg += '<b>✅ Always:</b> warm natural light, real humans, real-world settings, editorial feel, hope and dignity\n';
    msg += '<b>❌ Never:</b> dark/neon backgrounds, 3D cartoon renders, lobster as main subject, stock poses, cold vibes\n\n';

    msg += '📖 Full spec: inclawbate/BRAND_ARCHETYPE.md';

    await sendMsg(chatId, msg);
}

// ── /narrative — story world, settings, people ──

async function handleNarrative(chatId) {
    let msg = '🌱 <b>INCLAWBATE NARRATIVE</b>\n\n';

    msg += '<b>🌍 The World: Real Life</b>\n';
    msg += 'Real humans in real settings — where people live, work, worship, build, and serve.\n\n';

    msg += '<b>📍 Settings</b>\n';
    msg += '🏠 Kitchen Table — personal use, family finances, FoodVitals\n';
    msg += '💻 Builder\'s Desk — creating apps, shipping, building\n';
    msg += '🏛️ Community Center — council meetings, governance, collaboration\n';
    msg += '🌍 Mission Field — philanthropy, S4H, resource coordination\n';
    msg += '🌳 Park / Outdoors — passive income, peace of mind\n';
    msg += '🔧 Workshop — team building, incubation, prototyping\n';
    msg += '🏠 Living Room — evening gatherings, community vibes\n';
    msg += '⛪ Church — faith integration, coordinating giving\n\n';

    msg += '<b>🧑 People We Show</b>\n';
    msg += '👩‍💻 First-Time Builder — empowerment moment\n';
    msg += '👨‍👩‍👧 The Parent — financial security, real utility\n';
    msg += '🌍 Mission Coordinator — philanthropy in action\n';
    msg += '🤝 Council Member — thoughtful stewardship\n';
    msg += '👥 The Team — collaboration, shared mission\n';
    msg += '😌 The Staker — passive income, peace\n\n';

    msg += '<b>🎭 Mood Tags</b>\n';
    msg += '#stewardship #empowered #peace #together #impact #build #morning #gratitude #faith #generational\n\n';

    msg += '📖 Full bible: inclawbate/NARRATIVE.md';

    await sendMsg(chatId, msg);
}

// ── /telos — mission, tokens, and how they relate ──

async function handleTelos(chatId) {
    let msg = '🦞 <b>INCLAWBATE TELOS</b>\n\n';

    msg += '<b>Mission</b>\n';
    msg += 'A self-sustaining, decentralized engine that generates, manages, and distributes value to the right places — forever.\n\n';

    msg += '<b>🪙 Tokens</b>\n\n';

    msg += '<b>$CLAWS</b> — THE Inclawbate token\n';
    msg += '• 100B fixed supply, no mint function\n';
    msg += '• ~68B committed to staking (staked + reward pool)\n';
    msg += '• Governance: holders vote on treasury allocation\n';
    msg += '• Staking rewards drain over 722 days (until 2028)\n';
    msg += '• CA: <code>0x7ca47B141639B893C6782823C0b219f872056379</code>\n\n';

    msg += '<b>$INCLAWNCH</b> — Legacy token (predecessor)\n';
    msg += '• CLAWS replaced INCLAWNCH as the main token\n';
    msg += '• INCLAWNCH still exists but is not the primary token\n';
    msg += '• CA: <code>0xB0b6e0E9da530f68D713cC03a813B506205aC808</code>\n\n';

    msg += '<b>$S4H</b> — Salvation 4 Humanity\n';
    msg += '• Incubation project — its own token, its own mission\n';
    msg += '• Stake S4H to earn INCLAWNCH (powered by Inclawbate)\n';
    msg += '• Not replacing CLAWS — S4H is a separate community\n';
    msg += '• CA: <code>0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07</code>\n\n';

    msg += '<b>How they relate</b>\n';
    msg += '• INCLAWNCH → CLAWS (replaced as main token)\n';
    msg += '• CLAWS = Inclawbate governance + staking + treasury\n';
    msg += '• S4H = independent incubation, connected via staking rewards\n';
    msg += '• Both can coexist — CLAWS governs Inclawbate, S4H serves its own community\n\n';

    msg += '<b>The Engine</b>\n';
    msg += 'Telos → Memory → Code → Value → Council → repeat forever\n';
    msg += 'Revenue from products funds treasury, council allocates, builders build more. The flywheel.\n\n';

    msg += '🔗 inclawbate.app/claws';

    await sendMsg(chatId, msg);
}

// ── /treasury — treasury + allocation overview ──

const BASE_RPC = 'https://mainnet.base.org';
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_CONTRACT = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const LP_POOL = '0xAc89E3dc50Cb062C9B6f9e7F4f41e5Eb103a203F';
const TREASURY_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const TOTAL_SUPPLY = 100e9;
const DAILY_FUNDING = 100;
const BUCKET_LABELS = {
    'reinvest': 'Reinvest', 'buy-claws': 'Buy CLAWS', 'claws-lp': 'LP',
    'staking': 'Staking', 'ecosystem': 'Ecosystem', 'grants': 'Grants',
    'philanthropy': 'Giving', 'council-comp': 'Council'
};

const tDelay = (ms) => new Promise(r => setTimeout(r, ms));

async function rpc(to, data) {
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 })
        });
        const result = await res.json();
        if (result.error || !result.result) return 0;
        return Number(BigInt(result.result)) / 1e18;
    } catch (e) { return 0; }
}

async function storageSlot(contract, slot) {
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getStorageAt', params: [contract, slot, 'latest'], id: 1 })
        });
        const result = await res.json();
        if (result.error || !result.result) return 0;
        return Number(BigInt(result.result)) / 1e18;
    } catch (e) { return 0; }
}

function balData(addr) {
    return '0x70a08231000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

function fmtB(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
}

function fmtUsd(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 0.01) return '$' + n.toFixed(2);
    if (n > 0) return '$' + n.toPrecision(3);
    return '$0';
}

function fmtPrice(n) {
    if (n >= 1) return '$' + n.toFixed(4);
    if (n >= 0.001) return '$' + n.toFixed(6);
    if (n > 0) {
        // For very small prices, show enough decimals to get 3 sig figs
        var s = n.toFixed(20);
        var m = s.match(/^0\.(0+)/);
        var zeros = m ? m[1].length : 0;
        return '$' + n.toFixed(zeros + 3);
    }
    return '$0';
}

async function handleTreasury(chatId) {
    try {
        // 1. CLAWS price
        let price = 0, mcap = 0, liquidity = 0;
        try {
            const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
            const data = await res.json();
            const pair = data?.pairs?.[0];
            if (pair) {
                price = parseFloat(pair.priceUsd) || 0;
                mcap = pair.marketCap || 0;
                liquidity = pair.liquidity?.usd || 0;
            }
        } catch (e) {}

        // 2. Staking data (sequential to avoid rate limit)
        const contractTotal = await rpc(CLAWS_ADDRESS, balData(STAKING_CONTRACT));
        await tDelay(200);
        const userStaked = await storageSlot(STAKING_CONTRACT, '0x6');
        await tDelay(200);
        const inLP = await rpc(CLAWS_ADDRESS, balData(LP_POOL));
        await tDelay(200);
        const rewardRate = await rpc(STAKING_CONTRACT, '0x7b0a47ee');
        const rewardsPool = Math.max(contractTotal - userStaked, 0);
        const dailyRewards = rewardRate * 86400;
        const apy = userStaked > 0 ? (dailyRewards * 365 / userStaked * 100) : 0;

        // 3. CLAWS holdings of inclawbate.base.eth — do early before rate limit kicks in
        const treasuryRaw = TREASURY_WALLET.replace('0x', '').toLowerCase();
        await tDelay(300);
        const walletClaws = await rpc(CLAWS_ADDRESS, balData(TREASURY_WALLET));
        await tDelay(300);
        const stakedClaws = await rpc(STAKING_CONTRACT, balData(TREASURY_WALLET));
        await tDelay(300);
        const earnedData = '0x008cc262000000000000000000000000' + treasuryRaw;
        let unclaimedClaws = await rpc(STAKING_CONTRACT, earnedData);
        if (unclaimedClaws === 0) {
            await tDelay(500);
            unclaimedClaws = await rpc(STAKING_CONTRACT, earnedData);
        }
        const totalClaws = walletClaws + stakedClaws + unclaimedClaws;

        // 4. ETH balance + price (less critical, can tolerate rate limit)
        let ethBalance = 0, ethPrice = 0;
        await tDelay(300);
        try {
            const ethBalRes = await fetch(BASE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [TREASURY_WALLET, 'latest'], id: 1 })
            }).then(r => r.json());
            ethBalance = (ethBalRes.error || !ethBalRes.result) ? 0 : Number(BigInt(ethBalRes.result)) / 1e18;
        } catch (e) {}
        try {
            const ethRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006');
            const ethData = await ethRes.json();
            const topPair = ethData.pairs?.find(p => p.chainId === 'base' && p.quoteToken?.symbol === 'USDbC') || ethData.pairs?.[0];
            ethPrice = topPair ? parseFloat(topPair.priceUsd || 0) : 0;
        } catch (e) {}

        // 5. Council allocation
        let councilWeights = null;
        try {
            const host = 'www.inclawbate.app';
            const allocRes = await fetch(`https://${host}/api/inclawbate/allocation-vote`);
            const allocData = await allocRes.json();
            if (allocData.council) councilWeights = allocData.council;
        } catch (e) {}

        // Build message
        const ethValue = ethBalance * ethPrice;
        const stakedValue = userStaked * price;
        const lpValue = liquidity;
        const totalClawsValue = totalClaws * price;
        const treasuryTotal = lpValue + ethValue + totalClawsValue;

        let msg = '🏦 <b>TREASURY STATUS</b> ' + fmtUsd(treasuryTotal) + '\n\n';

        msg += '💰 <b>CLAWS Token</b>\n';
        msg += `Price: ${fmtPrice(price)}\n`;
        msg += `Market Cap: ${fmtUsd(mcap)}\n`;
        msg += `Liquidity: ${fmtUsd(liquidity)}\n\n`;

        const accounted = userStaked + rewardsPool + inLP + walletClaws;
        const circulating = Math.max(TOTAL_SUPPLY - accounted, 0);

        msg += '📊 <b>Supply Breakdown (100B)</b>\n';
        msg += `Staked: ${fmtB(userStaked)} (${(userStaked / TOTAL_SUPPLY * 100).toFixed(1)}%) ≈ ${fmtUsd(stakedValue)}\n`;
        msg += `Rewards Pool: ${fmtB(rewardsPool)} (${(rewardsPool / TOTAL_SUPPLY * 100).toFixed(1)}%)\n`;
        msg += `In LP: ${fmtB(inLP)} (${(inLP / TOTAL_SUPPLY * 100).toFixed(1)}%)\n`;
        if (walletClaws > 0) msg += `Treasury Wallet: ${fmtB(walletClaws)} (${(walletClaws / TOTAL_SUPPLY * 100).toFixed(1)}%)\n`;
        msg += `Circulating: ${fmtB(circulating)} (${(circulating / TOTAL_SUPPLY * 100).toFixed(1)}%)\n\n`;

        msg += '📈 <b>Staking</b>\n';
        msg += `APY: ${apy.toFixed(1)}%\n`;
        msg += `Daily Rewards: ${fmtB(dailyRewards)} CLAWS\n`;
        msg += `🔗 inclawbate.app/stake/claws\n\n`;

        msg += '🏛️ <b>Treasury Holdings</b>\n';
        if (totalClaws > 0) {
            msg += `CLAWS: ${fmtB(totalClaws)} (${fmtUsd(totalClawsValue)})\n`;
            msg += `  Wallet: ${fmtB(walletClaws)} · Staked: ${fmtB(stakedClaws)} · Unclaimed: ${fmtB(unclaimedClaws)}\n`;
        }
        msg += `CLAWS/ETH LP: ${fmtUsd(lpValue)}\n`;
        msg += `ETH: ${ethBalance.toFixed(4)} (${fmtUsd(ethValue)})\n`;
        msg += `Funding Rate: $${DAILY_FUNDING}/day\n\n`;

        msg += '⚖️ <b>Council Allocation ($' + DAILY_FUNDING + '/day)</b>\n';
        if (councilWeights) {
            for (const id of Object.keys(BUCKET_LABELS)) {
                const pct = councilWeights[id] || 0;
                if (pct === 0) continue;
                const dollars = (DAILY_FUNDING * pct / 100).toFixed(2);
                msg += `${BUCKET_LABELS[id]}: ${pct}% ($${dollars})\n`;
            }
        } else {
            msg += '<i>No council allocation set yet</i>\n';
        }

        msg += '\n🔗 <a href="https://www.inclawbate.app/claws">Full State → inclawbate.app/claws</a>';

        await sendMsg(chatId, msg);
    } catch (err) {
        await sendMsg(chatId, '❌ Error fetching treasury: ' + esc(err.message));
    }
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
        } else if (cmd === 'marketingpovs') {
            await handleMarketingPovs(chatId, args);
        } else if (cmd === 'research') {
            await handleResearch(chatId);
        } else if (cmd === 'brand') {
            await handleBrand(chatId);
        } else if (cmd === 'narrative') {
            await handleNarrative(chatId);
        } else if (cmd === 'telos') {
            await handleTelos(chatId);
        } else if (cmd === 'treasury') {
            await handleTreasury(chatId);
        } else if (cmd === 'daily') {
            if (!isAdmin(username)) { await sendMsg(chatId, '🔒 Admin only.'); }
            else {
                await sendMsg(chatId, '⏳ Generating daily post...');
                try {
                    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.inclawbate.app';
                    const protocol = host.includes('localhost') ? 'http' : 'https';
                    const r = await fetch(`${protocol}://${host}/api/inclawbate/council-daily`, { method: 'POST' });
                    if (r.ok) await sendMsg(chatId, '✅ Daily post sent!');
                    else await sendMsg(chatId, '❌ Failed: ' + (await r.text()).slice(0, 200));
                } catch (e) { await sendMsg(chatId, '❌ ' + esc(e.message)); }
            }
        } else if (cmd === 'devdaily') {
            if (!isAdmin(username)) { await sendMsg(chatId, '🔒 Admin only.'); }
            else {
                await sendMsg(chatId, '⏳ Generating dev daily...');
                try {
                    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.inclawbate.app';
                    const protocol = host.includes('localhost') ? 'http' : 'https';
                    const r = await fetch(`${protocol}://${host}/api/inclawbate/dev-daily`, { method: 'POST' });
                    const result = await r.json();
                    if (r.ok && result.post) {
                        await sendMsg(chatId, result.post);
                        if (result.tweet) {
                            await sendMsg(chatId, '📋 <b>Copy for X:</b>\n\n' + esc(result.tweet));
                        }
                    } else {
                        await sendMsg(chatId, '❌ ' + (result.error || 'Failed'));
                    }
                } catch (e) { await sendMsg(chatId, '❌ ' + esc(e.message)); }
            }
        } else if (cmd === 'chatinfo') {
            const threadId = message.message_thread_id || 'none';
            await sendMsg(chatId, '🆔 Chat ID: <code>' + chatId + '</code>\nThread ID: <code>' + threadId + '</code>');
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
                '<b>Treasury & Governance</b>\n' +
                '/treasury — Treasury status + allocation\n' +
                '/telos — Mission, tokens, how they relate\n\n' +
                '<b>Marketing & Brand</b>\n' +
                '/marketingpovs — All 15 marketing angles\n' +
                '/marketingpovs 4 — View one in detail\n' +
                '/research — Daily research prompt\n' +
                '/brand — Visual identity, mascot, colors\n' +
                '/narrative — Story world, locations, characters\n\n' +
                '<b>Council</b>\n' +
                '/daily — Post daily CLAWS update (admin)\n\n' +
                '<b>Builder</b>\n' +
                '/devdaily — AI-grouped commit summary (admin)\n\n' +
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
