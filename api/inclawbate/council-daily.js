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
const VOTE_STAKING_CONTRACT = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';
const TREASURY_WALLET_RAW = '91B5C0D07859CFeAfEB67d9694121CD741F049bd'; // no 0x prefix, for calldata
const BASE_RPC = 'https://mainnet.base.org';
const BUCKET_LABELS = {
    'reinvest': 'Reinvest', 'buy-claws': 'Buy', 'claws-lp': 'LP',
    'staking': 'Staking', 'ecosystem': 'Ecosystem', 'grants': 'Grants',
    'philanthropy': 'Giving', 'council-comp': 'Council'
};
const BUCKET_IDS = Object.keys(BUCKET_LABELS);

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

const LP_POOL = '0xAc89E3dc50Cb062C9B6f9e7F4f41e5Eb103a203F';
const TOTAL_SUPPLY = 100e9; // 100B CLAWS

async function fetchClawsBalanceOf(contractAddr) {
    try {
        const addr = contractAddr.replace('0x', '').toLowerCase();
        const data = '0x70a08231000000000000000000000000' + addr;
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: CLAWS_ADDRESS, data }, 'latest'], id: 1 })
        });
        const result = await res.json();
        return parseInt(result.result, 16) / 1e18;
    } catch (e) {
        return 0;
    }
}

async function fetchStakingAndLP() {
    const [staked, inLP] = await Promise.all([
        fetchClawsBalanceOf(STAKING_CONTRACT),
        fetchClawsBalanceOf(LP_POOL)
    ]);
    return {
        staked,
        inLP,
        stakedPct: (staked / TOTAL_SUPPLY * 100).toFixed(1),
        lpPct: (inLP / TOTAL_SUPPLY * 100).toFixed(1),
        lockedPct: ((staked + inLP) / TOTAL_SUPPLY * 100).toFixed(1)
    };
}

async function fetchTreasuryStaking() {
    // Read Stuart's staked CLAWS + unclaimed rewards from staking contract
    try {
        const calldata = (selector) => selector + '000000000000000000000000' + TREASURY_WALLET_RAW.toLowerCase();
        const rpcCall = (data) => fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: STAKING_CONTRACT, data }, 'latest'], id: 1 })
        }).then(r => r.json()).then(r => parseInt(r.result, 16) / 1e18).catch(() => 0);

        const [staked, earned] = await Promise.all([
            rpcCall(calldata('0x70a08231')),  // balanceOf(address)
            rpcCall(calldata('0x008cc262'))    // earned(address)
        ]);
        return { staked: Math.round(staked), earned: Math.round(earned) };
    } catch (e) {
        return null;
    }
}

// Treasury = LP TVL + staked CLAWS value + earned rewards value

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

// ── Voter Balance Refresh + Synthesis ──

async function getClawsBalance(address) {
    const paddedAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');
    const data = '0x70a08231' + paddedAddr;
    const rpc = (to) => fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 })
    }).then(r => r.json()).then(r => BigInt(r.result || '0x0')).catch(() => BigInt(0));

    const [wallet, staked] = await Promise.all([rpc(CLAWS_ADDRESS), rpc(VOTE_STAKING_CONTRACT)]);
    return (wallet + staked).toString();
}

async function refreshVoterBalances() {
    try {
        const { data: voters } = await supabase
            .from('allocation_votes')
            .select('wallet_address, claws_balance');
        if (!voters || voters.length === 0) return;

        // Refresh balances in batches of 5 to avoid RPC rate limits
        for (let i = 0; i < voters.length; i += 5) {
            const batch = voters.slice(i, i + 5);
            const updated = await Promise.all(batch.map(async (v) => {
                const bal = await getClawsBalance(v.wallet_address);
                return { wallet_address: v.wallet_address, claws_balance: bal };
            }));
            for (const u of updated) {
                if (u.claws_balance !== voters.find(v => v.wallet_address === u.wallet_address)?.claws_balance) {
                    await supabase.from('allocation_votes')
                        .update({ claws_balance: u.claws_balance })
                        .eq('wallet_address', u.wallet_address);
                }
            }
        }
    } catch (e) { console.error('Voter balance refresh error:', e); }
}

async function fetchAllocationSynthesis() {
    try {
        const { data: votes } = await supabase
            .from('allocation_votes')
            .select('weights, claws_balance');
        if (!votes || votes.length === 0) return null;

        let totalWeight = BigInt(0);
        const weightedSums = BUCKET_IDS.map(() => BigInt(0));

        for (const vote of votes) {
            const bal = BigInt(vote.claws_balance || '0');
            const weight = bal > BigInt(0) ? bal : BigInt(1);
            totalWeight += weight;
            BUCKET_IDS.forEach((id, i) => {
                weightedSums[i] += BigInt(vote.weights[id] || 0) * weight;
            });
        }

        const synthesis = BUCKET_IDS.map((_, i) =>
            totalWeight > BigInt(0) ? Number(weightedSums[i] / totalWeight) : 0
        );
        // Normalize to 100
        const synthTotal = synthesis.reduce((a, b) => a + b, 0);
        if (synthTotal > 0 && synthTotal !== 100) {
            const scale = 100 / synthTotal;
            const adjusted = synthesis.map(v => Math.round(v * scale));
            const adjTotal = adjusted.reduce((a, b) => a + b, 0);
            if (adjTotal !== 100) adjusted[0] += (100 - adjTotal);
            return { buckets: adjusted, voterCount: votes.length };
        }
        return { buckets: synthesis, voterCount: votes.length };
    } catch (e) {
        return null;
    }
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

function buildTelegramPost(claws, supply, tasks, treasury, allocation) {
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

    if (supply) {
        msg += `Staked: ${formatNum(supply.staked)} (${supply.stakedPct}%)\n`;
        msg += `In LP: ${formatNum(supply.inLP)} (${supply.lpPct}%)\n`;
        msg += `🔒 Total Locked: ${supply.lockedPct}%\n`;
    }

    // Treasury
    if (treasury?.total) {
        msg += `\n<b>🏦 Treasury</b> ${formatUsd(treasury.total)}\n`;
        msg += `LP: ${formatUsd(treasury.lp)}`;
        if (treasury.staked > 0) msg += ` | Staked: ${formatUsd(treasury.staked)}`;
        if (treasury.earned > 0) msg += ` | Earned: ${formatUsd(treasury.earned)}`;
        msg += `\n`;
    }

    // Allocation synthesis
    if (allocation) {
        msg += `\n<b>🗳 Allocation</b> (${allocation.voterCount} vote${allocation.voterCount !== 1 ? 's' : ''})\n`;
        const parts = BUCKET_IDS.map((id, i) => `${BUCKET_LABELS[id]} ${allocation.buckets[i]}%`);
        msg += parts.join(' · ') + `\n`;
        msg += `<i>Vote: inclawbate.com/how-it-works</i>\n`;
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

function buildTweet(claws, supply, tasks, treasury, allocation) {
    const date = getDateStr();
    let tweet = `🦞 CLAWS Daily | ${date}\n\n`;

    if (claws) {
        const arrow = claws.change24h >= 0 ? '↑' : '↓';
        tweet += `💰 $${claws.price < 0.0001 ? claws.price.toExponential(2) : claws.price.toFixed(6)}`;
        tweet += ` (${arrow}${Math.abs(claws.change24h).toFixed(1)}%)\n`;
    }

    if (supply) {
        tweet += `🔒 ${supply.lockedPct}% locked (${supply.stakedPct}% staked + ${supply.lpPct}% LP)\n`;
    }

    if (treasury?.total) {
        tweet += `🏦 Treasury: ${formatUsd(treasury.total)}\n`;
    }

    if (allocation) {
        // Top 3 allocations for tweet brevity
        const ranked = BUCKET_IDS.map((id, i) => ({ label: BUCKET_LABELS[id], pct: allocation.buckets[i] }))
            .sort((a, b) => b.pct - a.pct).slice(0, 3);
        tweet += `🗳 ${ranked.map(r => r.label + ' ' + r.pct + '%').join(' · ')} (${allocation.voterCount} votes)\n`;
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
        // Refresh voter balances first (catches transfer gaming)
        await refreshVoterBalances();

        // Fetch all data in parallel
        const [claws, supply, tasks, treasuryStaking, allocation] = await Promise.all([
            fetchClawsPrice(),
            fetchStakingAndLP(),
            fetchTasks(),
            fetchTreasuryStaking(),
            fetchAllocationSynthesis()
        ]);

        // Treasury = LP TVL + staked CLAWS value + earned rewards value
        const clawsPrice = claws?.price || 0;
        const lpValue = claws?.liquidity || 0;
        const stakedValue = treasuryStaking ? treasuryStaking.staked * clawsPrice : 0;
        const earnedValue = treasuryStaking ? treasuryStaking.earned * clawsPrice : 0;
        const treasury = Math.round(lpValue + stakedValue + earnedValue) || null;

        // Build messages
        const treasuryData = { total: treasury, lp: Math.round(lpValue), staked: Math.round(stakedValue), earned: Math.round(earnedValue) };
        const telegramPost = buildTelegramPost(claws, supply, tasks, treasuryData, allocation);
        const tweet = buildTweet(claws, supply, tasks, treasuryData, allocation);

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
                supply,
                treasury,
                allocation,
                tasks
            }
        });
    } catch (err) {
        console.error('Council daily error:', err);
        return res.status(500).json({ error: err.message });
    }
}
