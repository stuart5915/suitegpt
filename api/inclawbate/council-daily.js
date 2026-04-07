// Inclawbate — Daily Council Post
// Cron: runs daily at 9 AM UTC (7 AM EST)
// Posts CLAWS stats to council Telegram group

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;

const COUNCIL_CHAT_ID = process.env.INCLAWBATE_COUNCIL_CHAT_ID;
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const VOTE_STAKING_CONTRACT = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';
const BASE_RPC = 'https://mainnet.base.org'; // used by voter balance refresh
const BUCKET_LABELS = {
    'reinvest': 'Reinvest Vault',
    'staking': 'CLAWS Stakers',
    'philanthropy': 'Philanthropy'
};
const BUCKET_IDS = Object.keys(BUCKET_LABELS);

// ── Helpers ──

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendPhoto(chatId, photoUrl) {
    if (!BOT_TOKEN || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, photo: photoUrl })
        });
    } catch (e) {
        console.error('Failed to send daily image:', e);
    }
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
        // Use GeckoTerminal — DexScreener misses the main V2 CLAWS/WETH pool
        const res = await fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/' + CLAWS_ADDRESS + '/pools?page=1');
        if (!res.ok) throw new Error('GeckoTerminal failed');
        const json = await res.json();
        const pools = json?.data || [];
        if (pools.length === 0) throw new Error('No pools found');

        // Find the pool with the highest liquidity (the real one)
        let bestPool = null;
        let bestLiq = 0;
        let totalLiquidity = 0;
        let totalVolume = 0;
        for (const pool of pools) {
            const attrs = pool.attributes || {};
            const liq = parseFloat(attrs.reserve_in_usd) || 0;
            const vol = parseFloat(attrs.volume_usd?.h24) || 0;
            totalLiquidity += liq;
            totalVolume += vol;
            if (liq > bestLiq) { bestLiq = liq; bestPool = attrs; }
        }

        const price = parseFloat(bestPool?.base_token_price_usd) || 0;
        const change24h = parseFloat(bestPool?.price_change_percentage?.h24) || 0;
        const fdv = price * TOTAL_SUPPLY;

        return {
            price,
            change24h,
            volume24h: totalVolume,
            liquidity: totalLiquidity,
            mcap: fdv,
            fdv
        };
    } catch (e) {
        // Fallback to DexScreener
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
        } catch (e2) {
            return null;
        }
    }
}

const TOTAL_SUPPLY = 100e9; // 100B CLAWS

const BASIS_VAULT_VALUE = 0; // $USD — hardcoded until Basis Vault is deployed, then read on-chain
const ANGEL_NFT_SLUG = 'inclawbate-angel';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchAngelFloorPrice() {
    // Scrape floor price from OpenSea collection page (no API key needed)
    try {
        const res = await fetch(`https://opensea.io/collection/${ANGEL_NFT_SLUG}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' }
        });
        if (!res.ok) return null;
        const html = await res.text();
        // Extract floor price from embedded JSON: "floorPrice":{"pricePerItem":{"token":{"unit":X.X
        const match = html.match(/"floorPrice":\{"pricePerItem":\{"token":\{"unit":([0-9.]+)/);
        if (match) {
            return { floorPrice: parseFloat(match[1]), floorCurrency: 'ETH' };
        }
        return null;
    } catch (e) { return null; }
}

// ── Cached Chain Data ──
// Reads staking, angel, and treasury data from Supabase cache
// (populated every 4 hours by /api/inclawbate/cache-chain-data)

async function fetchChainDataCache() {
    try {
        const { data, error } = await supabase
            .from('platform_settings')
            .select('value, updated_at')
            .eq('key', 'chain_data_cache')
            .single();
        if (error || !data) return null;
        const cache = JSON.parse(data.value);
        // Reject cache older than 12 hours
        const age = Date.now() - new Date(cache.updated_at).getTime();
        if (age > 12 * 60 * 60 * 1000) return null;
        return cache;
    } catch (e) {
        return null;
    }
}

function cachedStakingToSupply(staking) {
    if (!staking) return null;
    return {
        staked: staking.staked,
        rewardsPool: staking.rewardsPool,
        inLP: staking.inLP,
        dailyRewards: staking.dailyRewards,
        apy: staking.apy,
        stakedPct: staking.stakedPct,
        lpPct: staking.lpPct,
        lockedPct: staking.lockedPct
    };
}

function cachedTreasuryToRaw(treasury, clawsPrice) {
    if (!treasury) return null;
    const totalClaws = treasury.walletClaws + treasury.stakedClaws + treasury.unclaimedClaws;
    return {
        ethBalance: treasury.ethBalance,
        ethPrice: treasury.ethPrice,
        ethValue: Math.round(treasury.ethBalance * treasury.ethPrice),
        basisVault: BASIS_VAULT_VALUE,
        walletClaws: treasury.walletClaws,
        stakedClaws: treasury.stakedClaws,
        unclaimedClaws: treasury.unclaimedClaws,
        totalClaws,
        totalClawsValue: totalClaws * clawsPrice,
    };
}

// Treasury = LP TVL + staked CLAWS value + earned rewards value

async function fetchTasks() {
    const [doneRes, focusRes, incubationRes, responsibilityRes, todoRes, campaignRes, expenseRes] = await Promise.all([
        supabase.from('team_state').select('content').eq('category', 'done').order('created_at', { ascending: false }).limit(5),
        supabase.from('team_state').select('content').eq('category', 'current').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content, author').eq('category', 'incubation').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content, author').eq('category', 'responsibility').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'todo').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'campaign').order('created_at', { ascending: true }),
        supabase.from('team_state').select('content').eq('category', 'expense').order('created_at', { ascending: true })
    ]);
    return {
        done: (doneRes.data || []).map(r => r.content),
        focus: (focusRes.data || []).map(r => r.content),
        incubations: (incubationRes.data || []).map(r => ({ content: r.content, author: r.author })),
        responsibilities: (responsibilityRes.data || []).map(r => ({ content: r.content, author: r.author })),
        backlog: (todoRes.data || []).map(r => r.content),
        campaigns: (campaignRes.data || []).map(r => r.content),
        expenses: (expenseRes.data || []).map(r => r.content)
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

        // Separate council row and admin/treasury wallet from community votes
        const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
        const councilRow = allRows.find(v => v.wallet_address === COUNCIL_ROW_KEY);
        const council = councilRow
            ? BUCKET_IDS.map(id => councilRow.weights[id] || 0)
            : null;
        const communityVotes = allRows.filter(v =>
            v.wallet_address !== COUNCIL_ROW_KEY &&
            v.wallet_address.toLowerCase() !== ADMIN_WALLET
        );

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
    // Suppress misleading deltas — swings over 30% are almost always data glitches
    // (stale cache, failed API call returning 0, etc.), not real treasury moves
    if (pct !== null && Math.abs(parseFloat(pct)) > 30) return null;
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

// Plain version for image (no Unicode subscripts — fonts can't render them)
function formatPricePlain(p) {
    if (p >= 1) return '$' + p.toFixed(2);
    if (p >= 0.01) return '$' + p.toFixed(4);
    const s = p.toFixed(18).replace(/0+$/, '');
    const match = s.match(/^0\.(0+)/);
    if (match) {
        const zeros = match[1].length;
        const sig = s.slice(2 + zeros, 2 + zeros + 3);
        return '$0.0(' + zeros + ')' + sig;
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

async function fetchApiStats() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
            .from('api_daily_stats')
            .select('*')
            .eq('stat_date', today)
            .single();
        return data || { total_requests: 0, agent_chat: 0, build_app: 0, token_launches: 0, staking_actions: 0, wallet_connects: 0 };
    } catch (e) {
        return { total_requests: 0, agent_chat: 0, build_app: 0, token_launches: 0, staking_actions: 0, wallet_connects: 0 };
    }
}

function buildTelegramPost(claws, supply, tasks, treasury, allocation, yesterday, stakerCount, angelStats, apiStats) {
    const date = getDateStr();
    const price = claws?.price || 0;

    // ── Always-visible header (compact) ──
    let msg = `🦞 <b>CLAWS Daily | ${date}</b>\n`;
    msg += `<a href="https://www.inclawbate.app/claws">inclawbate.app/claws</a>\n\n`;

    if (claws) {
        const arrow = claws.change24h >= 0 ? '📈' : '📉';
        msg += `💰 ${formatPrice(claws.price)} ${arrow} ${claws.change24h >= 0 ? '+' : ''}${Number(claws.change24h).toFixed(1)}% · Vol ${formatUsd(claws.volume24h)}\n`;
    }
    if (treasury?.total) {
        const treasuryChange = calcChange(treasury.total, yesterday?.treasury_total);
        msg += `🏦 Treasury ${formatUsd(treasury.total)}${formatDelta(treasuryChange)}\n`;
    }
    if (supply) {
        msg += `🔒 ${supply.lockedPct}% locked`;
        if (supply.apy > 0) msg += ` · ${supply.apy.toFixed(0)}% APY`;
        if (stakerCount > 0) msg += ` · ${stakerCount} stakers`;
        msg += `\n`;
    }
    // ── Expandable: Supply & Staking ──
    if (supply) {
        const treasuryWallet = treasury?.walletClaws || 0;
        const angelLocked = angelStats?.rewardsRemaining || 0;
        const accounted = supply.staked + supply.rewardsPool + supply.inLP + treasuryWallet + angelLocked;
        const circulating = Math.max(TOTAL_SUPPLY - accounted, 0);
        const circulatingPct = (circulating / TOTAL_SUPPLY * 100).toFixed(1);
        const rewardsPct = (supply.rewardsPool / TOTAL_SUPPLY * 100).toFixed(1);
        const treasuryPct = (treasuryWallet / TOTAL_SUPPLY * 100).toFixed(1);

        msg += `\n<blockquote expandable>`;
        msg += `<b>📊 Supply &amp; Staking</b>\n\n`;
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
            msg += `Treasury: ${formatNum(treasuryWallet)} (${treasuryPct}%)`;
            if (price > 0) msg += ` ≈ ${formatUsd(treasuryWallet * price)}`;
            msg += `\n`;
        }
        msg += `Circulating: ${formatNum(circulating)} (${circulatingPct}%)\n`;
        if (supply.apy > 0) {
            msg += `\nAPY: ${supply.apy.toFixed(1)}%\n`;
            msg += `Daily: ${formatNum(supply.dailyRewards)} CLAWS`;
            if (price > 0) msg += ` ≈ ${formatUsd(supply.dailyRewards * price)}`;
            msg += `\nStake: inclawbate.app/stake/claws`;
        }
        msg += `</blockquote>`;
    }

    // ── Expandable: Angel NFT ──
    if (angelStats) {
        msg += `\n<blockquote expandable>`;
        msg += `<b>😇 Angel NFT Rewards</b>\n\n`;
        msg += `Rate: ${formatNum(angelStats.dailyRewards)} CLAWS/day`;
        if (price > 0) msg += ` ≈ ${formatUsd(angelStats.dailyRewards * price)}/day`;
        msg += `\n`;
        if (price > 0) {
            msg += `Annual: ~${formatUsd(angelStats.dailyRewards * 365 * price)}\n`;
        }
        if (angelStats.floorPrice != null) {
            msg += `Floor: ${angelStats.floorPrice} ${angelStats.floorCurrency}\n`;
            const ethPr = treasury?.ethPrice || 0;
            const floorUsd = angelStats.floorPrice * ethPr;
            if (floorUsd > 0 && price > 0 && angelStats.holders > 0) {
                const perHolderDaily = angelStats.dailyRewards / angelStats.holders;
                const angelApy = (perHolderDaily * 365 * price / floorUsd * 100);
                msg += `APY: ${angelApy.toFixed(1)}%\n`;
            }
        }
        if (angelStats.holders > 0) msg += `Holders: ${angelStats.holders}\n`;
        if (angelStats.totalClaimed > 0) msg += `Claimed: ${formatNum(angelStats.totalClaimed)} CLAWS\n`;
        msg += `Remaining: ${formatNum(angelStats.rewardsRemaining)} CLAWS`;
        msg += `</blockquote>`;
    }

    // ── Expandable: Treasury ──
    if (treasury?.total) {
        msg += `\n<blockquote expandable>`;
        msg += `<b>🏦 Treasury Breakdown</b>\n\n`;
        if (treasury.totalClaws > 0) {
            msg += `CLAWS: ${formatNum(treasury.totalClaws)} (${formatUsd(treasury.totalClawsValue)})\n`;
            msg += `  Wallet: ${formatNum(treasury.walletClaws)} · Staked: ${formatNum(treasury.stakedClaws)} · Unclaimed: ${formatNum(treasury.unclaimedClaws)}\n`;
        }
        msg += `CLAWS/ETH LP: ${formatUsd(treasury.clawsLp)}`;
        if (treasury.ethBalance > 0) {
            msg += `\nETH: ${treasury.ethBalance.toFixed(4)}`;
            if (treasury.dailyEthAdd > 0) msg += ` (+${treasury.dailyEthAdd.toFixed(4)}/day)`;
        }
        if (treasury.basisVault > 0) msg += `\nBasis Vault: ${formatUsd(treasury.basisVault)}`;
        msg += `</blockquote>`;
    }

    // ── Expandable: Community Votes ──
    if (allocation) {
        msg += `\n<blockquote expandable>`;
        msg += `<b>🗳 Community Votes</b> (${allocation.voterCount} voter${allocation.voterCount !== 1 ? 's' : ''})\n\n`;
        BUCKET_IDS.forEach((id, i) => {
            if (allocation.community[i] > 0) msg += `${BUCKET_LABELS[id]}: ${allocation.community[i]}%\n`;
        });
        msg += `\nVote: inclawbate.app/claws`;
        msg += `</blockquote>`;
    }

    // ── Platform Activity ──
    if (apiStats && apiStats.total_requests > 0) {
        msg += `\n📡 <b>Platform Activity</b>\n`;
        msg += `   ${apiStats.total_requests} API requests\n`;
        if (apiStats.agent_chat > 0) msg += `   ${apiStats.agent_chat} Inclawbator chats\n`;
        if (apiStats.build_app > 0) msg += `   ${apiStats.build_app} apps built\n`;
        if (apiStats.token_launches > 0) msg += `   ${apiStats.token_launches} token launches\n`;
        if (apiStats.staking_actions > 0) msg += `   ${apiStats.staking_actions} staking queries\n`;
        if (apiStats.wallet_connects > 0) msg += `   ${apiStats.wallet_connects} wallet connects\n`;
    }

    // ── Expandable: State ──
    const hasState = tasks.done.length || tasks.focus.length || tasks.incubations.length || tasks.backlog.length;
    if (hasState) {
        msg += `\n<blockquote expandable>`;
        msg += `<b>📋 State</b>\n\n`;

        if (tasks.done.length) {
            msg += `✅ Done\n`;
            tasks.done.forEach(t => { msg += `• ${esc(t)}\n`; });
            msg += `\n`;
        }
        if (tasks.focus.length) {
            msg += `🔥 Focus\n`;
            tasks.focus.forEach(t => { msg += `→ ${esc(t)}\n`; });
            msg += `\n`;
        }
        if (tasks.backlog.length) {
            msg += `📋 ${tasks.backlog.length} in backlog`;
        }
        msg += `</blockquote>`;
    }

    // ── Expandable: Team & Expenses ──
    const hasTeam = tasks.responsibilities.length || tasks.expenses.length || tasks.campaigns.length;
    if (hasTeam) {
        msg += `\n<blockquote expandable>`;
        msg += `<b>👥 Team &amp; Expenses</b>\n\n`;

        if (tasks.responsibilities.length) {
            const byPerson = {};
            for (const r of tasks.responsibilities) {
                const person = r.author || 'unassigned';
                if (!byPerson[person]) byPerson[person] = [];
                const task = r.content.replace(/\s*-\s*@\w+$/i, '').trim();
                byPerson[person].push(task);
            }
            for (const [person, items] of Object.entries(byPerson)) {
                msg += `<b>${esc(person)}</b>\n`;
                items.forEach(t => { msg += `  • ${esc(t)}\n`; });
            }
            msg += `\n`;
        }

        if (tasks.expenses.length) {
            msg += `💸 Monthly Expenses\n`;
            tasks.expenses.forEach(e => { msg += `• ${esc(e)}\n`; });
            msg += `\n`;
        }

        if (tasks.campaigns.length) {
            msg += `📣 Campaigns\n`;
            tasks.campaigns.forEach(c => { msg += `• ${esc(c)}\n`; });
        }
        msg += `</blockquote>`;
    }

    msg += `\n🔗 inclawbate.app`;

    return msg;
}

function buildTweet(claws, supply, tasks, treasury, allocation, yesterday, stakerCount, angelStats) {
    const date = getDateStr();
    const price = claws?.price || 0;
    let tweet = `🦞 $CLAWS Daily | ${date}\n`;

    // Price
    if (claws) {
        tweet += `💰 ${formatPrice(claws.price)}\n`;
    }

    // Treasury + incubations + link (top block)
    tweet += `\n`;
    if (treasury?.total) {
        tweet += `🏦 Treasury: ${formatUsd(treasury.total)}\n`;
    }
    tweet += `https://www.inclawbate.app/claws\n`;

    // Staking
    tweet += `\n📊 Staking Rewards\n`;
    if (supply) {
        tweet += `Current Rate: ${formatNum(supply.dailyRewards)} $CLAWS/day\n`;
        if (price > 0) {
            const annualUsd = supply.dailyRewards * 365 * price;
            tweet += `~${formatUsd(annualUsd)} USD/year in rewards\n`;
        }
        tweet += `Value Staked: ~${formatUsd(supply.staked * price)}\n`;
        if (supply.apy > 0) tweet += `APY: ${supply.apy.toFixed(0)}%\n`;
        if (stakerCount > 0) tweet += `Stakers: ${stakerCount}\n`;
        tweet += `🔒 ${supply.lockedPct}% $CLAWS out of circulation\n`;
    }
    tweet += `https://www.inclawbate.app/stake/claws\n`;

    // Angel NFT Rewards
    if (angelStats) {
        tweet += `\n😇 Angel NFT Rewards\n`;
        tweet += `Current Rate: ${formatNum(angelStats.dailyRewards)} $CLAWS/day\n`;
        if (price > 0) {
            const angelAnnualUsd = angelStats.dailyRewards * 365 * price;
            tweet += `~${formatUsd(angelAnnualUsd)} USD/year in rewards\n`;
        }
        if (angelStats.floorPrice != null) {
            tweet += `NFT Floor: ${angelStats.floorPrice} ${angelStats.floorCurrency}\n`;
            const ethPr = treasury?.ethPrice || 0;
            const floorUsd = angelStats.floorPrice * ethPr;
            if (floorUsd > 0 && price > 0 && angelStats.holders > 0) {
                const perHolderDaily = angelStats.dailyRewards / angelStats.holders;
                const angelApy = (perHolderDaily * 365 * price / floorUsd * 100);
                tweet += `APY: ${angelApy.toFixed(0)}%\n`;
            }
        }
        if (angelStats.holders > 0) tweet += `Holders: ${angelStats.holders}\n`;
        tweet += `opensea.io/collection/inclawbate-angel\n`;
    }

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
        // Fetch non-RPC data + chain data cache in parallel
        const [claws, tasks, allocation, chainCache, angelFloor, apiStats] = await Promise.all([
            fetchClawsPrice(),
            fetchTasks(),
            fetchAllocationSynthesis(),
            fetchChainDataCache(),
            fetchAngelFloorPrice(),
            fetchApiStats()
        ]);

        const clawsPrice = claws?.price || 0;

        // Use cached chain data (populated every 4h by cache-chain-data cron)
        const supply = cachedStakingToSupply(chainCache?.staking);
        const stakerCount = chainCache?.staking?.stakerCount || 0;
        const treasuryRaw = cachedTreasuryToRaw(chainCache?.treasury, clawsPrice);
        const angelStats = chainCache?.angel || null;
        if (angelStats) {
            angelStats.floorPrice = angelFloor?.floorPrice ?? null;
            angelStats.floorCurrency = angelFloor?.floorCurrency ?? 'ETH';
        }

        // Treasury breakdown
        const lpValue = claws?.liquidity || 0;
        const basisVault = treasuryRaw?.basisVault || 0;
        const clawsHeldValue = treasuryRaw?.totalClawsValue || 0;

        // Synthetic ETH treasury: starts at 2 ETH on Mar 18 2026, +$100/day in ETH
        const TREASURY_ETH_START = 2; // ETH
        const TREASURY_ETH_START_DATE = new Date('2026-03-18T00:00:00-04:00');
        const TREASURY_DAILY_USD = 100;
        const ethPrice = treasuryRaw?.ethPrice || 0;
        const daysSinceStart = Math.max(0, Math.floor((Date.now() - TREASURY_ETH_START_DATE.getTime()) / 86400000));
        const dailyEthAdd = ethPrice > 0 ? TREASURY_DAILY_USD / ethPrice : 0;
        const addedEth = dailyEthAdd * daysSinceStart;
        const syntheticEthBalance = TREASURY_ETH_START + addedEth;
        const syntheticEthValue = syntheticEthBalance * ethPrice;

        const treasuryTotal = Math.round(lpValue + syntheticEthValue + basisVault + clawsHeldValue) || null;

        const treasuryData = {
            total: treasuryTotal,
            clawsLp: Math.round(lpValue),
            ethBalance: syntheticEthBalance,
            ethPrice,
            ethValue: Math.round(syntheticEthValue),
            dailyEthAdd,
            basisVault,
            walletClaws: treasuryRaw?.walletClaws || 0,
            stakedClaws: treasuryRaw?.stakedClaws || 0,
            unclaimedClaws: treasuryRaw?.unclaimedClaws || 0,
            totalClaws: treasuryRaw?.totalClaws || 0,
            totalClawsValue: treasuryRaw?.totalClawsValue || 0,
        };

        // Fetch yesterday's snapshot for delta comparisons
        const yesterday = await fetchYesterdaySnapshot();

        // Save today's snapshot
        await saveSnapshot(claws, supply, treasuryData, allocation?.voterCount);

        // Build messages
        const date = getDateStr();
        const telegramPost = buildTelegramPost(claws, supply, tasks, treasuryData, allocation, yesterday, stakerCount, angelStats, apiStats);
        const tweet = buildTweet(claws, supply, tasks, treasuryData, allocation, yesterday, stakerCount, angelStats);

        // Generate and send daily stats image
        const treasuryChange = calcChange(treasuryData?.total, yesterday?.treasury_total);
        const imageParams = new URLSearchParams({
            date,
            price: claws ? formatPricePlain(claws.price) : '—',
            change: String(claws?.change24h || 0),
            // Treasury breakdown
            treasury: treasuryData?.total ? formatUsd(treasuryData.total) : '—',
            treasuryDelta: treasuryChange ? ((treasuryChange.diff >= 0 ? '+' : '') + treasuryChange.pct + '%') : '',
            treasuryLp: treasuryData?.clawsLp ? formatUsd(treasuryData.clawsLp) : '—',
            treasuryEth: treasuryData?.ethBalance ? treasuryData.ethBalance.toFixed(2) + ' ETH' : '—',
            treasuryEthDaily: treasuryData?.dailyEthAdd ? '+' + treasuryData.dailyEthAdd.toFixed(4) + '/day' : '',
            treasuryClaws: treasuryData?.totalClaws ? formatNum(treasuryData.totalClaws) + ' CLAWS' : '—',
            incubations: String(tasks.incubations.length),
            // Staking in CLAWS terms
            stakingTotal: supply ? formatNum(supply.staked) + ' CLAWS' : '—',
            stakingRate: supply ? formatNum(supply.dailyRewards) + ' CLAWS/day' : '—',
            stakingAnnual: supply ? formatNum(supply.dailyRewards * 365) + ' CLAWS/yr' : '—',
            stakingApy: supply?.apy > 0 ? supply.apy.toFixed(0) : '—',
            stakers: String(stakerCount || 0),
            locked: supply?.lockedPct || '—',
            // Angel in CLAWS terms
            angelRate: angelStats ? formatNum(angelStats.dailyRewards) + ' CLAWS/day' : '—',
            angelAnnual: angelStats ? formatNum(angelStats.dailyRewards * 365) + ' CLAWS/yr' : '—',
            angelFloor: angelStats?.floorPrice != null ? angelStats.floorPrice + ' ' + angelStats.floorCurrency : '—',
            angelHolders: angelStats?.holders > 0 ? String(angelStats.holders) : '—',
            angelApy: (() => {
                if (!angelStats || !angelStats.floorPrice || !angelStats.holders || clawsPrice <= 0) return '—';
                const ethPr = treasuryData?.ethPrice || 0;
                const floorUsd = angelStats.floorPrice * ethPr;
                if (floorUsd <= 0) return '—';
                const perHolderDaily = angelStats.dailyRewards / angelStats.holders;
                return (perHolderDaily * 365 * clawsPrice / floorUsd * 100).toFixed(0);
            })(),
            // Community vote synthesis
            voteCount: allocation?.voterCount ? String(allocation.voterCount) : '0',
            votes: allocation?.community ? BUCKET_IDS.map((id, i) =>
                allocation.community[i] > 0 ? BUCKET_LABELS[id] + ' ' + allocation.community[i] + '%' : ''
            ).filter(Boolean).join(' / ') : '',
        });
        imageParams.set('_t', Date.now()); // cache-bust so TG always fetches fresh
        const imageUrl = `https://www.inclawbate.app/api/inclawbate/daily-image?${imageParams}`;
        await sendPhoto(COUNCIL_CHAT_ID, imageUrl);

        // Post text to council group
        await sendMsg(COUNCIL_CHAT_ID, telegramPost);

        // Provide copy-paste tweet for manual X posting
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
