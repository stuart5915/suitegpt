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
const TREASURY_FUNDING_RATE = 100; // $/day — update when funding changes

async function rpcRead(to, data) {
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 })
        });
        const result = await res.json();
        if (result.error || !result.result) return 0;
        return Number(BigInt(result.result)) / 1e18;
    } catch (e) {
        return 0;
    }
}

function clawsBalanceOfData(addr) {
    return '0x70a08231000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function storageRead(contract, slot) {
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

async function fetchStakingAndLP() {
    // Sequential RPC calls to avoid Base public RPC rate limit
    // CLAWS.balanceOf(stakingContract) = total CLAWS in contract (staked + rewards pool)
    const contractTotal = await rpcRead(CLAWS_ADDRESS, clawsBalanceOfData(STAKING_CONTRACT));
    await delay(200);
    // Storage slot 6 = _totalSupply = total staked by users (Synthetix StakingRewards layout)
    const userStaked = await storageRead(STAKING_CONTRACT, '0x6');
    await delay(200);
    const inLP = await rpcRead(CLAWS_ADDRESS, clawsBalanceOfData(LP_POOL));
    await delay(200);
    const rewardRate = await rpcRead(STAKING_CONTRACT, '0x7b0a47ee');  // rewardRate()

    const rewardsPool = contractTotal - userStaked;
    const dailyRewards = rewardRate * 86400;
    const apy = userStaked > 0 ? (dailyRewards * 365 / userStaked * 100) : 0;

    return {
        staked: userStaked,
        rewardsPool: rewardsPool > 0 ? rewardsPool : 0,
        inLP,
        dailyRewards,
        apy,
        stakedPct: (userStaked / TOTAL_SUPPLY * 100).toFixed(1),
        lpPct: (inLP / TOTAL_SUPPLY * 100).toFixed(1),
        lockedPct: ((contractTotal + inLP) / TOTAL_SUPPLY * 100).toFixed(1)
    };
}

const TREASURY_WALLET = '0x' + TREASURY_WALLET_RAW;
const BASIS_VAULT_VALUE = 0; // $USD — hardcoded until Basis Vault is deployed, then read on-chain

async function fetchTreasury(clawsPrice) {
    try {
        // 1. ETH balance of treasury wallet
        const ethBalRes = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [TREASURY_WALLET, 'latest'], id: 1 })
        }).then(r => r.json());
        const ethBalance = (ethBalRes.error || !ethBalRes.result) ? 0 : Number(BigInt(ethBalRes.result)) / 1e18;
        await delay(200);

        // 2. ETH price from DexScreener (WETH on Base)
        let ethPrice = 0;
        try {
            const ethRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006');
            const ethData = await ethRes.json();
            const topPair = ethData.pairs?.find(p => p.chainId === 'base' && p.quoteToken?.symbol === 'USDbC') || ethData.pairs?.[0];
            ethPrice = topPair ? parseFloat(topPair.priceUsd || 0) : 0;
        } catch (e) { /* ETH price unavailable */ }
        await delay(200);

        // 3. CLAWS in treasury wallet
        await delay(300);
        const walletClaws = await rpcRead(CLAWS_ADDRESS, clawsBalanceOfData(TREASURY_WALLET_RAW));
        await delay(300);

        // 4. Treasury staked position
        const stakedClaws = await rpcRead(STAKING_CONTRACT, clawsBalanceOfData(TREASURY_WALLET_RAW));

        // 5. Unclaimed rewards: earned(treasuryWallet)
        await delay(500);
        const earnedCalldata = '0x008cc262000000000000000000000000' + TREASURY_WALLET_RAW.toLowerCase();
        let unclaimedClaws = await rpcRead(STAKING_CONTRACT, earnedCalldata);
        // Retry once if rate-limited
        if (unclaimedClaws === 0) {
            await delay(500);
            unclaimedClaws = await rpcRead(STAKING_CONTRACT, earnedCalldata);
        }

        const ethValue = ethBalance * ethPrice;
        const totalClaws = walletClaws + stakedClaws + unclaimedClaws;

        return {
            ethBalance,
            ethPrice,
            ethValue: Math.round(ethValue),
            basisVault: BASIS_VAULT_VALUE,
            walletClaws,
            stakedClaws,
            unclaimedClaws,
            totalClaws,
            totalClawsValue: totalClaws * clawsPrice,
        };
    } catch (e) {
        return null;
    }
}

// Treasury = LP TVL + staked CLAWS value + earned rewards value

async function fetchTasks() {
    const [doneRes, focusRes, incubationRes, responsibilityRes, todoRes] = await Promise.all([
        supabase.from('team_state').select('content').eq('category', 'done').order('created_at', { ascending: false }).limit(5),
        supabase.from('team_state').select('content').eq('category', 'current').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'incubation').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'responsibility').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'todo').order('created_at', { ascending: true })
    ]);
    return {
        done: (doneRes.data || []).map(r => r.content),
        focus: (focusRes.data || []).map(r => r.content),
        incubations: (incubationRes.data || []).map(r => r.content),
        responsibilities: (responsibilityRes.data || []).map(r => r.content),
        backlog: (todoRes.data || []).map(r => r.content)
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

    const wallet = await rpc(CLAWS_ADDRESS);
    await delay(200);
    const staked = await rpc(VOTE_STAKING_CONTRACT);
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
    const COUNCIL_ROW_KEY = 'council';
    try {
        const { data: allRows } = await supabase
            .from('allocation_votes')
            .select('wallet_address, weights, claws_balance');
        if (!allRows || allRows.length === 0) return null;

        // Separate council row from community votes
        const councilRow = allRows.find(v => v.wallet_address === COUNCIL_ROW_KEY);
        const council = councilRow
            ? BUCKET_IDS.map(id => councilRow.weights[id] || 0)
            : null;
        const communityVotes = allRows.filter(v => v.wallet_address !== COUNCIL_ROW_KEY);

        if (communityVotes.length === 0 && !council) return null;

        // Community synthesis (token-weighted, excludes council row)
        let totalWeight = BigInt(0);
        const weightedSums = BUCKET_IDS.map(() => BigInt(0));

        for (const vote of communityVotes) {
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
            return { community: adjusted, council, voterCount: communityVotes.length };
        }
        return { community: synthesis, council, voterCount: communityVotes.length };
    } catch (e) {
        return null;
    }
}

// ── Treasury Snapshots ──

async function saveSnapshot(claws, supply, treasuryData, voterCount) {
    try {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from('treasury_snapshots').upsert({
            snapshot_date: today,
            claws_price: claws?.price || 0,
            change_24h: claws?.change24h || 0,
            volume_24h: claws?.volume24h || 0,
            liquidity: claws?.liquidity || 0,
            mcap: claws?.mcap || 0,
            staked_amount: supply?.staked || 0,
            staked_pct: parseFloat(supply?.stakedPct) || 0,
            lp_amount: supply?.inLP || 0,
            lp_pct: parseFloat(supply?.lpPct) || 0,
            total_locked_pct: parseFloat(supply?.lockedPct) || 0,
            treasury_total: treasuryData?.total || 0,
            lp_value: treasuryData?.clawsLp || 0,
            staked_value: treasuryData?.ethValue || 0,
            earned_value: treasuryData?.basisVault || 0,
            voter_count: voterCount || 0
        }, { onConflict: 'snapshot_date' });
    } catch (e) { console.error('Snapshot save error:', e); }
}

async function fetchYesterdaySnapshot() {
    try {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const { data } = await supabase
            .from('treasury_snapshots')
            .select('*')
            .eq('snapshot_date', yesterday)
            .single();
        return data || null;
    } catch (e) { return null; }
}

function calcChange(current, previous) {
    if (!previous || !current) return null;
    const diff = current - previous;
    const pct = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : null;
    return { diff, pct };
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

function formatPrice(p) {
    if (p >= 1) return '$' + p.toFixed(2);
    if (p >= 0.01) return '$' + p.toFixed(4);
    // For tiny prices, show as $0.0₅113 style (subscript zero count)
    const s = p.toFixed(18).replace(/0+$/, '');
    const match = s.match(/^0\.(0+)/);
    if (match) {
        const zeros = match[1].length;
        const sig = s.slice(2 + zeros, 2 + zeros + 3);
        return '$0.0' + String.fromCharCode(0x2080 + zeros) + sig;
    }
    return '$' + p.toFixed(6);
}

function formatDelta(change) {
    if (!change) return '';
    const arrow = change.diff >= 0 ? '↑' : '↓';
    const val = formatUsd(Math.abs(change.diff));
    return ` (${arrow}${val}${change.pct ? ', ' + (change.diff >= 0 ? '+' : '') + change.pct + '%' : ''})`;
}

function getDateStr() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

function buildTelegramPost(claws, supply, tasks, treasury, allocation, yesterday) {
    const date = getDateStr();
    let msg = `🦞 <b>CLAWS Daily | ${date}</b>\n`;
    msg += `<a href="https://www.inclawbate.com/how-it-works">Treasury allocation is governed by the CLAWS Council. Holders vote at inclawbate.com/state</a>\n\n`;

    // Stats
    msg += `<b>📊 CLAWS Stats</b>\n`;
    if (claws) {
        const arrow = claws.change24h >= 0 ? '📈' : '📉';
        msg += `Price: ${formatPrice(claws.price)}\n`;
        msg += `${arrow} ${claws.change24h >= 0 ? '+' : ''}${Number(claws.change24h).toFixed(1)}% today | ${formatUsd(claws.volume24h)} volume\n`;
        msg += `Liquidity: ${formatUsd(claws.liquidity)} | MCap: ${formatUsd(claws.mcap)}\n`;
    } else {
        msg += `<i>Price data unavailable</i>\n`;
    }

    if (supply) {
        const price = claws?.price || 0;
        const treasuryWallet = treasury?.walletClaws || 0;
        const accounted = supply.staked + supply.rewardsPool + supply.inLP + treasuryWallet;
        const circulating = Math.max(TOTAL_SUPPLY - accounted, 0);
        const circulatingPct = (circulating / TOTAL_SUPPLY * 100).toFixed(1);
        const rewardsPct = (supply.rewardsPool / TOTAL_SUPPLY * 100).toFixed(1);
        const treasuryPct = (treasuryWallet / TOTAL_SUPPLY * 100).toFixed(1);

        msg += `\n<b>🔒 Supply Breakdown (100B)</b>\n`;
        msg += `Staked: ${formatNum(supply.staked)} (${supply.stakedPct}%)`;
        if (price > 0) msg += ` ≈ ${formatUsd(supply.staked * price)}`;
        msg += `\n`;
        if (supply.rewardsPool > 0) {
            msg += `Rewards Pool: ${formatNum(supply.rewardsPool)} (${rewardsPct}%)`;
            if (price > 0) msg += ` ≈ ${formatUsd(supply.rewardsPool * price)}`;
            msg += `\n`;
        }
        msg += `In LP: ${formatNum(supply.inLP)} (${supply.lpPct}%)`;
        if (price > 0) msg += ` ≈ ${formatUsd(supply.inLP * price)}`;
        msg += `\n`;
        if (treasuryWallet > 0) {
            msg += `Treasury Wallet: ${formatNum(treasuryWallet)} (${treasuryPct}%)`;
            if (price > 0) msg += ` ≈ ${formatUsd(treasuryWallet * price)}`;
            msg += `\n`;
        }
        msg += `Circulating: ${formatNum(circulating)} (${circulatingPct}%)\n`;
        msg += `Total Locked: ${supply.lockedPct}%\n`;
        if (supply.apy > 0) {
            msg += `\n<b>💰 Staking</b>\n`;
            msg += `APY: ${supply.apy.toFixed(1)}%\n`;
            msg += `Daily Rewards: ${formatNum(supply.dailyRewards)} CLAWS`;
            if (price > 0) msg += ` ≈ ${formatUsd(supply.dailyRewards * price)}`;
            msg += `\nStake: https://www.inclawbate.com/stake/claws\n`;
        }
    }

    // Treasury breakdown
    if (treasury?.total) {
        const treasuryChange = calcChange(treasury.total, yesterday?.treasury_total);
        msg += `\n<b>🏦 Treasury</b> ${formatUsd(treasury.total)}${formatDelta(treasuryChange)}\n`;
        if (treasury.totalClaws > 0) {
            msg += `CLAWS: ${formatNum(treasury.totalClaws)} (${formatUsd(treasury.totalClawsValue)})\n`;
            msg += `  Wallet: ${formatNum(treasury.walletClaws)} · Staked: ${formatNum(treasury.stakedClaws)} · Unclaimed: ${formatNum(treasury.unclaimedClaws)}\n`;
        }
        msg += `CLAWS/ETH LP: ${formatUsd(treasury.clawsLp)}\n`;
        if (treasury.ethBalance > 0) {
            msg += `ETH: ${treasury.ethBalance.toFixed(4)} (${formatUsd(treasury.ethValue)})\n`;
        }
        if (treasury.basisVault > 0) {
            msg += `Basis Vault: ${formatUsd(treasury.basisVault)}\n`;
        }
    }

    // Allocation — council vs community
    if (allocation) {
        if (allocation.council) {
            msg += `\n<b>⚖️ Council Allocation</b> <i>(active)</i>\n`;
            msg += BUCKET_IDS.map((id, i) => `${BUCKET_LABELS[id]} ${allocation.council[i]}%`).join(' · ') + `\n`;
        }
        msg += `\n<b>🗳 Community</b> (${allocation.voterCount} vote${allocation.voterCount !== 1 ? 's' : ''})\n`;
        msg += BUCKET_IDS.map((id, i) => `${BUCKET_LABELS[id]} ${allocation.community[i]}%`).join(' · ') + `\n`;
        msg += `<a href="https://www.inclawbate.com/how-it-works">Vote: inclawbate.com/how-it-works</a>\n`;
    }

    // Focus / Incubations / Backlog
    if (tasks.done.length) {
        msg += `\n<b>✅ Done</b>\n`;
        tasks.done.forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    if (tasks.focus.length) {
        msg += `\n<b>🔥 Focus</b>\n`;
        tasks.focus.forEach(t => { msg += `→ ${esc(t)}\n`; });
    }

    if (tasks.incubations.length) {
        msg += `\n<b>🦞 Incubations</b> (${tasks.incubations.length})\n`;
        tasks.incubations.forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    if (tasks.responsibilities.length) {
        msg += `\n<b>👥 Responsibilities</b>\n`;
        tasks.responsibilities.forEach(t => { msg += `• ${esc(t)}\n`; });
    }

    if (tasks.backlog.length) {
        msg += `\n📋 ${tasks.backlog.length} in backlog\n`;
    }

    msg += `<i>Full state: inclawbate.com/state</i>\n`;

    msg += `\n🔗 inclawbate.com`;

    return msg;
}

function buildTweet(claws, supply, tasks, treasury, allocation, yesterday) {
    const date = getDateStr();
    const price = claws?.price || 0;
    let tweet = `🦞 CLAWS Daily | ${date}\n\n`;

    // Price
    if (claws) {
        tweet += `💰 ${formatPrice(claws.price)}\n`;
    }

    // Staking — the money shot
    if (supply) {
        tweet += `\n📊 Staking Rewards\n`;
        tweet += `Current Rate: ${formatNum(supply.dailyRewards)} CLAWS/day\n`;
        if (price > 0) {
            const annualUsd = supply.dailyRewards * 365 * price;
            tweet += `~${formatUsd(annualUsd)} USD/year in rewards\n`;
        }
        tweet += `Value Staked: ~${formatUsd(supply.staked * price)}\n`;
        if (supply.apy > 0) tweet += `APY: ${supply.apy.toFixed(0)}%\n`;
        tweet += `\n🔒 ${supply.lockedPct}% out of circulation\n`;
    }

    // Incubations — count only
    if (tasks.incubations.length) {
        tweet += `🦞 ${tasks.incubations.length} active incubations\n`;
    }

    tweet += `\ninclawbate.com/how-it-works`;

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
        // Fetch non-RPC data in parallel first
        const [claws, tasks, allocation] = await Promise.all([
            fetchClawsPrice(),
            fetchTasks(),
            fetchAllocationSynthesis()
        ]);

        // RPC calls sequentially to avoid Base RPC rate limits
        const supply = await fetchStakingAndLP();
        const clawsPrice = claws?.price || 0;
        const treasuryRaw = await fetchTreasury(clawsPrice);

        // Refresh voter balances last (lower priority, most RPC-heavy)
        await refreshVoterBalances();

        // Treasury breakdown
        const lpValue = claws?.liquidity || 0;
        const ethValue = treasuryRaw?.ethValue || 0;
        const basisVault = treasuryRaw?.basisVault || 0;
        const clawsHeldValue = treasuryRaw?.totalClawsValue || 0;
        const treasuryTotal = Math.round(lpValue + ethValue + basisVault + clawsHeldValue) || null;

        const treasuryData = {
            total: treasuryTotal,
            clawsLp: Math.round(lpValue),
            ethBalance: treasuryRaw?.ethBalance || 0,
            ethPrice: treasuryRaw?.ethPrice || 0,
            ethValue: Math.round(ethValue),
            basisVault,
            walletClaws: treasuryRaw?.walletClaws || 0,
            stakedClaws: treasuryRaw?.stakedClaws || 0,
            unclaimedClaws: treasuryRaw?.unclaimedClaws || 0,
            totalClaws: treasuryRaw?.totalClaws || 0,
            totalClawsValue: treasuryRaw?.totalClawsValue || 0,
        };

        // Fetch yesterday's snapshot for day-over-day comparison
        const yesterday = await fetchYesterdaySnapshot();

        // Save today's snapshot
        await saveSnapshot(claws, supply, treasuryData, allocation?.voterCount);

        // Build messages
        const telegramPost = buildTelegramPost(claws, supply, tasks, treasuryData, allocation, yesterday);
        const tweet = buildTweet(claws, supply, tasks, treasuryData, allocation, yesterday);

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
                treasury: treasuryData,
                allocation,
                tasks
            }
        });
    } catch (err) {
        console.error('Council daily error:', err);
        return res.status(500).json({ error: err.message });
    }
}
