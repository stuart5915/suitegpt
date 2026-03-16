// Inclawbate — Daily Council Post
// Cron: runs daily at 9 AM UTC
// Posts CLAWS stats, task status, and plans to council Telegram group
// Also formats a copy-pasteable tweet

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const COUNCIL_CHAT_ID = process.env.INCLAWBATE_COUNCIL_CHAT_ID;
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_CONTRACT = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const TREASURY_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const BASE_RPC = 'https://mainnet.base.org';

// ── Helpers ──

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMsg(chatId, text) {
    if (!BOT_TOKEN || !chatId) return;
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
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true })
        });
    }
}

// ── Data Fetchers ──

async function fetchClawsPrice() {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
        if (!res.ok) return null;
        const data = await res.json();
        const pair = data?.pairs?.[0];
        if (!pair) return null;
        return {
            price: parseFloat(pair.priceUsd) || 0,
            change24h: pair.priceChange?.h24 ?? 0,
            volume24h: pair.volume?.h24 ?? 0,
            liquidity: pair.liquidity?.usd ?? 0,
            mcap: pair.marketCap ?? 0,
            fdv: pair.fdv ?? 0
        };
    } catch (e) {
        return null;
    }
}

async function fetchStakingBalance() {
    try {
        const addr = STAKING_CONTRACT.replace('0x', '').toLowerCase();
        const data = '0x70a08231000000000000000000000000' + addr;
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{ to: CLAWS_ADDRESS, data }, 'latest'],
                id: 1
            })
        });
        const result = await res.json();
        return parseInt(result.result, 16) / 1e18;
    } catch (e) {
        return null;
    }
}

async function fetchTreasuryValue(clawsPrice) {
    try {
        // Fetch ETH balance + exchange rate and all token balances in parallel
        const [addrRes, tokensRes] = await Promise.all([
            fetch(`https://base.blockscout.com/api/v2/addresses/${TREASURY_WALLET}`).then(r => r.json()),
            fetch(`https://base.blockscout.com/api/v2/addresses/${TREASURY_WALLET}/token-balances`).then(r => r.json())
        ]);

        // ETH value
        const ethBal = parseInt(addrRes.coin_balance || '0', 10) / 1e18;
        const ethPrice = parseFloat(addrRes.exchange_rate) || 0;
        let total = ethBal * ethPrice;

        // Token values — sum everything Blockscout already priced
        const tokens = Array.isArray(tokensRes) ? tokensRes : [];
        for (const t of tokens) {
            // Use Blockscout's USD value if available
            if (t.value && t.token) {
                const bal = parseInt(t.value, 10) / Math.pow(10, parseInt(t.token.decimals) || 18);
                const usd = parseFloat(t.token.exchange_rate);
                if (usd > 0) {
                    total += bal * usd;
                } else if (t.token.address?.toLowerCase() === CLAWS_ADDRESS.toLowerCase() && clawsPrice > 0) {
                    // Use DexScreener price for CLAWS
                    total += bal * clawsPrice;
                }
                // USDC — 1:1
                if (t.token.symbol === 'USDC' || t.token.symbol === 'USDbC') {
                    total += bal;
                }
            }
        }

        return Math.round(total);
    } catch (e) {
        console.error('Treasury fetch error:', e);
        return null;
    }
}

async function fetchTasks() {
    const [doneRes, currentRes, todoRes] = await Promise.all([
        supabase.from('team_state').select('content').eq('category', 'done').order('created_at', { ascending: false }).limit(5),
        supabase.from('team_state').select('content').eq('category', 'current').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'todo').order('created_at', { ascending: true }).limit(5)
    ]);
    return {
        done: (doneRes.data || []).map(r => r.content),
        current: (currentRes.data || []).map(r => r.content),
        todo: (todoRes.data || []).map(r => r.content)
    };
}

// ── Formatters ──

function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
}

function formatUsd(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
}

function getDateStr() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

function buildTelegramPost(claws, staked, tasks, treasury) {
    const date = getDateStr();
    let msg = `🦞 <b>CLAWS Daily | ${date}</b>\n\n`;

    // Stats
    msg += `<b>📊 CLAWS Stats</b>\n`;
    if (claws) {
        const arrow = claws.change24h >= 0 ? '↑' : '↓';
        msg += `Price: $${claws.price < 0.0001 ? claws.price.toExponential(2) : claws.price.toFixed(6)}\n`;
        msg += `24h: ${arrow} ${Math.abs(claws.change24h).toFixed(1)}% | Vol: ${formatUsd(claws.volume24h)}\n`;
        msg += `LP: ${formatUsd(claws.liquidity)} | MCap: ${formatUsd(claws.mcap)}\n`;
    } else {
        msg += `<i>Price data unavailable</i>\n`;
    }

    if (staked) {
        const pct = (staked / 100e9 * 100).toFixed(1);
        msg += `Staked: ${formatNum(staked)} (${pct}%)\n`;
    }

    // Treasury
    if (treasury !== null) {
        msg += `\n<b>🏦 Treasury</b>\n`;
        msg += `Total: ${formatUsd(treasury)}\n`;
    }

    // Done
    if (tasks.done.length) {
        msg += `\n<b>✅ Done</b>\n`;
        tasks.done.forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    // Building
    if (tasks.current.length) {
        msg += `\n<b>🔨 Building</b>\n`;
        tasks.current.forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    // Coming up
    if (tasks.todo.length) {
        msg += `\n<b>📋 Coming Up</b>\n`;
        tasks.todo.slice(0, 5).forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    if (!tasks.done.length && !tasks.current.length && !tasks.todo.length) {
        msg += `\n<i>No tasks logged. Use /add to add items.</i>\n`;
    }

    msg += `\n🔗 inclawbate.com`;

    return msg;
}

function buildTweet(claws, staked, tasks, treasury) {
    const date = getDateStr();
    let tweet = `🦞 CLAWS Daily | ${date}\n\n`;

    if (claws) {
        const arrow = claws.change24h >= 0 ? '↑' : '↓';
        tweet += `💰 $${claws.price < 0.0001 ? claws.price.toExponential(2) : claws.price.toFixed(6)}`;
        tweet += ` (${arrow}${Math.abs(claws.change24h).toFixed(1)}%)\n`;
    }

    if (staked) {
        tweet += `🔒 ${formatNum(staked)} staked (${(staked / 100e9 * 100).toFixed(1)}%)\n`;
    }

    if (treasury !== null) {
        tweet += `🏦 Treasury: ${formatUsd(treasury)}\n`;
    }

    tweet += `\n`;

    if (tasks.done.length) {
        tweet += `✅ ${tasks.done[0]}\n`;
    }
    if (tasks.current.length) {
        tweet += `🔨 ${tasks.current[0]}\n`;
    }
    if (tasks.todo.length) {
        tweet += `📋 ${tasks.todo[0]}\n`;
    }

    tweet += `\ninclawbate.com`;

    return tweet;
}

// ── Main Handler ──

export default async function handler(req, res) {
    // Allow both cron (GET) and manual trigger (POST with auth)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!COUNCIL_CHAT_ID) {
        return res.status(500).json({ error: 'INCLAWBATE_COUNCIL_CHAT_ID not set' });
    }

    try {
        // Fetch all data in parallel
        const [claws, staked, tasks] = await Promise.all([
            fetchClawsPrice(),
            fetchStakingBalance(),
            fetchTasks()
        ]);

        // Treasury needs CLAWS price, so fetch after
        const treasury = await fetchTreasuryValue(claws?.price || 0);

        // Build messages
        const telegramPost = buildTelegramPost(claws, staked, tasks, treasury);
        const tweet = buildTweet(claws, staked, tasks, treasury);

        // Post to council group
        await sendMsg(COUNCIL_CHAT_ID, telegramPost);

        // Post the tweet version as a reply-friendly followup
        await sendMsg(COUNCIL_CHAT_ID, `📋 <b>Copy-paste for X:</b>\n\n<code>${esc(tweet)}</code>`);

        return res.status(200).json({
            ok: true,
            telegram: telegramPost,
            tweet,
            data: {
                claws,
                staked: staked ? formatNum(staked) : null,
                treasury,
                tasks
            }
        });
    } catch (err) {
        console.error('Council daily error:', err);
        return res.status(500).json({ error: err.message });
    }
}
