// Inclawbate — Staking-as-a-Service (On-Chain Multi-Pool Staking)

(function() {
'use strict';

// ══════════════════════════════════════
// POOL CONFIG
// ══════════════════════════════════════

var POOLS = {
    claws: {
        name: 'CLAWS',
        ticker: 'CLAWS',
        token: '0x7ca47B141639B893C6782823C0b219f872056379',
        staking: '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40',
        decimals: 18,
        logo: '/inclawbate/assets/clawslogo.jpg',
        color: 'hsl(172, 50%, 42%)',
        colorDim: 'hsla(172, 50%, 42%, 0.12)',
        glow: 'hsla(172, 50%, 42%, 0.18)',
        description: 'The next chapter. Stake CLAWS, earn CLAWS. No lock. No tiers.',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x7ca47B141639B893C6782823C0b219f872056379&chain=base',
        chartLink: 'https://dexscreener.com/base/0x7ca47B141639B893C6782823C0b219f872056379',
        featured: true,
        category: 'ubi',
        auditLink: '/audit/clawnch-rewards'
    },
    inclawnch: {
        name: 'inCLAWNCH',
        ticker: 'INCLAWNCH',
        token: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        staking: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
        decimals: 18,
        logo: '/inclawbate/assets/logo-circle.jpg',
        color: 'hsl(172, 32%, 48%)',
        colorDim: 'hsla(172, 32%, 48%, 0.12)',
        glow: 'hsla(172, 32%, 48%, 0.18)',
        description: 'Stake INCLAWNCH, earn rewards.',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0xB0b6e0E9da530f68D713cC03a813B506205aC808&chain=base',
        chartLink: 'https://dexscreener.com/base/0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        featured: false,
        category: 'inclawbator',
        auditLink: '/audit/clawnch-rewards',
        retired: true
    },
    s4h: {
        name: 'Salvation 4 Humanity',
        ticker: 'S4H',
        token: '0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07',
        rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        rewardTicker: 'CLAWS',
        staking: '0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D',
        decimals: 18,
        logo: '/salvation4humanity/assets/s4hlogo.png',
        color: 'hsl(35, 38%, 38%)',
        colorDim: 'hsla(35, 38%, 38%, 0.12)',
        glow: 'hsla(35, 38%, 38%, 0.18)',
        description: 'AI-powered online church community. Stake S4H, earn CLAWS rewards.',
        website: 'https://salvation4humanity.com',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07&chain=base',
        chartLink: 'https://dexscreener.com/base/0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07',
        featured: false,
        category: 'inclawbator',
        auditLink: '/audit/clawnch-rewards'
    },
    clawnch: {
        name: 'CLAWNCH',
        ticker: 'CLAWNCH',
        token: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
        rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        rewardTicker: 'INCLAWNCH',
        staking: '0xAda0e738F0E4DEb4e2C0B83d6836DE953f2e57b9',
        decimals: 18,
        logo: '/inclawbate/assets/clawnchlogo.jpg',
        color: 'hsl(32, 50%, 50%)',
        colorDim: 'hsla(32, 50%, 50%, 0.12)',
        glow: 'hsla(32, 50%, 50%, 0.18)',
        description: 'Stake CLAWNCH, earn INCLAWNCH rewards.',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be&chain=base',
        chartLink: 'https://dexscreener.com/base/0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
        featured: false,
        category: 'inclawbator',
        auditLink: '/audit/clawnch-rewards'
    },
    clawnstr: {
        name: 'ClawnStrategy',
        ticker: 'CLAWNSTR',
        token: '0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1',
        staking: '0x9f7cD1C3e4526937736629a400acBdcA50836848',
        decimals: 18,
        logo: '/inclawbate/assets/clawnstr-logo.jpg',
        color: 'hsl(0, 68%, 42%)',
        colorDim: 'hsla(0, 68%, 42%, 0.12)',
        glow: 'hsla(0, 68%, 42%, 0.18)',
        description: 'Web4 AI strategic treasury company.',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1&chain=base',
        chartLink: 'https://dexscreener.com/base/0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1',
        featured: false,
        category: 'inclawbator'
    },
    bv7x: {
        name: 'BitVault Signal',
        ticker: 'BV7X',
        token: '0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC',
        staking: '0x65Aec0C9fd455822F1cC0e3De7965B106d182017',
        decimals: 18,
        logo: '/inclawbate/assets/bv7x-logo.jpg',
        color: 'hsl(220, 70%, 50%)',
        colorDim: 'hsla(220, 70%, 50%, 0.12)',
        glow: 'hsla(220, 70%, 50%, 0.18)',
        description: 'Autonomous AI agent delivering Bitcoin and macro analysis with skin in the game. Stake BV7X, earn BV7X.',
        website: 'https://bv7x.ai',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC&chain=base',
        chartLink: 'https://dexscreener.com/base/0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC',
        featured: false,
        category: 'inclawbator',
        auditLink: '/audit/clawnch-rewards'
    }
};

// Coming soon pools (displayed as preview cards, not functional)
var COMING_SOON = [
    {
        name: 'MirrorMind',
        ticker: 'MIRROR',
        logo: '',
        color: 'hsl(280, 60%, 55%)',
        colorDim: 'hsla(280, 60%, 55%, 0.12)',
        glow: 'hsla(280, 60%, 55%, 0.18)',
        description: 'Wellness brand powering mindful living. Trading fees buy CLAWS and flow back to stakers.',
        platform: 'mirrormind.life',
        category: 'inclawbator'
    }
];

var POOL_KEYS = Object.keys(POOLS);

// ══════════════════════════════════════
// CONTRACT SELECTORS (InclawnchStaking — same for all pools)
// ══════════════════════════════════════

var SEL = {
    // User actions
    stake:            '0xa694fc3a', // stake(uint256)
    unstake:          '0x2e17de78', // unstake(uint256)
    claim:            '0x4e71d92d', // claim()
    claimAndRestake:  '0xf755d8c3', // claimAndRestake()
    exit:             '0xe9fad8ee', // exit()
    // View functions
    balanceOf:        '0x70a08231', // balanceOf(address)
    earned:           '0x008cc262', // earned(address)
    totalStaked:      '0x817b1cd2', // totalStaked()
    stakerCount:      '0xdff69787', // stakerCount()
    rewardRate:       '0x7b0a47ee', // rewardRate()
    periodEnd:        '0x506ec095', // periodEnd()
    rewardPoolBalance:'0x7a5c08ae', // rewardPoolBalance()
    // ERC20
    approve:          '0x095ea7b3', // approve(address,uint256)
    allowance:        '0xdd62ed3e', // allowance(address,address)
    // Admin
    depositRewards:   '0xbdd071fb', // depositRewards(uint256, uint256)
    admin:            '0xf851a440', // admin()
    paused:           '0x5c975abb', // paused()
    totalDeposited:   '0x1f4c74fd', // totalRewardsDeposited()
    totalClaimed:     '0xa34b0f76', // totalRewardsClaimed()
};

var BALANCE_SELECTOR = '0x70a08231';
var BASE_CHAIN_ID = '0x2105';
var MAX_UINT256 = '0x' + 'f'.repeat(64);

// Pool creation modal constants
var STAKING_FACTORY = '0x7AE0768D9F36088fB967e530A8F4A3936b40B621';
var CLAWS_ADDR = '0x7ca47B141639B893C6782823C0b219f872056379';
var DEPLOY_PAID_SEL = '0x82123c96'; // deployPaid(address,address)

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════

function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }
function pad32(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function toHex(n) { return '0x' + BigInt(n).toString(16); }
function toWei(amount) { return BigInt(Math.floor(amount)) * BigInt('1000000000000000000'); }
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}
var fmt = function(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); };
function fmtUsd(n) {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 10000) return '$' + (n / 1000).toFixed(0) + 'K';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    if (n >= 0.01) return '$' + n.toFixed(2);
    return '$0.00';
}

// ══════════════════════════════════════
// RPC INFRASTRUCTURE
// ══════════════════════════════════════

var BASE_RPCS = [
    'https://mainnet.base.org',
    'https://1rpc.io/base',
    'https://base-mainnet.public.blastapi.io',
    'https://base.drpc.org'
];

async function rpcFetch(body) {
    for (var i = 0; i < BASE_RPCS.length; i++) {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function() { controller.abort(); }, 5000);
            var res = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeout);
            var json = await res.json();
            if (json.error) continue;
            if (Array.isArray(json)) {
                var fails = 0;
                for (var j = 0; j < json.length; j++) {
                    if (!json[j].result || json[j].error) fails++;
                }
                if (fails > json.length / 2) continue;
            }
            return json;
        } catch (e) { continue; }
    }
    return null;
}

async function contractRead(to, data) {
    var json = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: to, data: data }, 'latest'] });
    return (json && json.result) || '0x0';
}

async function contractReadBatch(calls) {
    var batch = calls.map(function(c, i) {
        return { jsonrpc: '2.0', id: i + 1, method: 'eth_call',
            params: [{ to: c.to, data: c.data }, 'latest'] };
    });
    var json = await rpcFetch(batch);
    if (!json || !Array.isArray(json)) {
        return calls.map(function() { return '0x0'; });
    }
    json.sort(function(a, b) { return a.id - b.id; });
    return json.map(function(r) { return r.result || '0x0'; });
}

async function sendTxAndWait(provider, from, to, data, statusEl, statusMsg) {
    try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
    } catch (switchErr) {
        if (switchErr.code === 4902) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
            });
        }
    }
    if (statusEl && statusMsg) {
        statusEl.textContent = statusMsg;
        statusEl.className = 'pool-status';
    }
    var txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: from, to: to, data: data }]
    });
    if (statusEl) statusEl.textContent = 'Confirming transaction...';
    for (var i = 0; i < 90; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        var receipt = await provider.request({
            method: 'eth_getTransactionReceipt', params: [txHash]
        });
        if (receipt) {
            if (receipt.status !== '0x1') throw new Error('Transaction reverted');
            return txHash;
        }
    }
    throw new Error('Transaction timed out');
}

// ══════════════════════════════════════
// MODAL + TOAST
// ══════════════════════════════════════

function stakeModal(opts) {
    return new Promise(function(resolve) {
        var overlay = document.getElementById('stakeModalOverlay');
        var iconEl = document.getElementById('stakeModalIcon');
        var titleEl = document.getElementById('stakeModalTitle');
        var msgEl = document.getElementById('stakeModalMsg');
        var actionsEl = document.getElementById('stakeModalActions');

        iconEl.textContent = opts.icon || '';
        titleEl.textContent = opts.title || '';
        msgEl.textContent = opts.msg || '';
        actionsEl.innerHTML = '';

        function close(result) {
            overlay.classList.remove('visible');
            resolve(result);
        }

        if (opts.cancelLabel !== false) {
            var cancelBtn = document.createElement('button');
            cancelBtn.className = 'stake-modal-btn';
            cancelBtn.textContent = opts.cancelLabel || 'Cancel';
            cancelBtn.onclick = function() { close(false); };
            actionsEl.appendChild(cancelBtn);
        }

        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'stake-modal-btn ' + (opts.confirmClass || 'stake-modal-btn--confirm');
        confirmBtn.textContent = opts.confirmLabel || 'Confirm';
        confirmBtn.onclick = function() { close(true); };
        actionsEl.appendChild(confirmBtn);

        overlay.onclick = function(e) { if (e.target === overlay) close(false); };
        overlay.classList.add('visible');
    });
}

function stakeToast(msg, type) {
    var container = document.getElementById('stakeToastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'stake-toast' + (type ? ' stake-toast--' + type : '');
    var icon = type === 'error' ? '\u26A0\uFE0F' : type === 'success' ? '\u2705' : '\u2139\uFE0F';
    toast.innerHTML = '<span class="stake-toast-icon">' + icon + '</span><span>' + msg + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
}

// ══════════════════════════════════════
// PRICE FETCHING
// ══════════════════════════════════════

var poolPrices = {}; // ticker -> USD price

function bestPrice(dexRes, tokenAddr) {
    if (!dexRes || !dexRes.pairs) return 0;
    var candidates = dexRes.pairs.filter(function(p) {
        return p.baseToken && p.baseToken.address &&
            p.baseToken.address.toLowerCase() === tokenAddr.toLowerCase() &&
            parseFloat(p.priceUsd) > 0;
    });
    if (candidates.length === 0) return 0;
    candidates.sort(function(a, b) {
        return (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0);
    });
    return parseFloat(candidates[0].priceUsd) || 0;
}

async function fetchAllPrices() {
    // Deduplicate token addresses across pools (staking + reward tokens)
    var tokenAddrs = [];
    var seen = {};
    POOL_KEYS.forEach(function(key) {
        var addr = POOLS[key].token.toLowerCase();
        if (!seen[addr]) {
            seen[addr] = true;
            tokenAddrs.push(POOLS[key].token);
        }
        if (POOLS[key].rewardToken) {
            var rAddr = POOLS[key].rewardToken.toLowerCase();
            if (!seen[rAddr]) {
                seen[rAddr] = true;
                tokenAddrs.push(POOLS[key].rewardToken);
            }
        }
    });

    var promises = tokenAddrs.map(function(addr) {
        return fetch('https://api.dexscreener.com/latest/dex/tokens/' + addr)
            .then(function(r) { return r.json(); }).catch(function() { return null; });
    });

    var results = await Promise.all(promises);

    // Build address → price lookup
    var addrPrices = {};
    for (var i = 0; i < tokenAddrs.length; i++) {
        addrPrices[tokenAddrs[i].toLowerCase()] = bestPrice(results[i], tokenAddrs[i]);
    }

    // Apply to pools
    POOL_KEYS.forEach(function(key) {
        poolPrices[key] = addrPrices[POOLS[key].token.toLowerCase()] || 0;
        if (POOLS[key].rewardToken) {
            poolPrices[key + '_reward'] = addrPrices[POOLS[key].rewardToken.toLowerCase()] || 0;
        }
    });
}

// ══════════════════════════════════════
// READ ALL POOL STATS (single batch)
// ══════════════════════════════════════

var poolStats = {}; // key -> { totalStaked, stakerCount, rewardRate, periodEnd, rewardPool }
var rewardsTickInterval = null;
var rewardsTickStart = 0;  // timestamp when we last fetched rewardPool

async function fetchAllPoolStats() {
    var calls = [];
    POOL_KEYS.forEach(function(key) {
        var staking = POOLS[key].staking;
        calls.push({ to: staking, data: SEL.totalStaked });
        calls.push({ to: staking, data: SEL.stakerCount });
        calls.push({ to: staking, data: SEL.rewardRate });
        calls.push({ to: staking, data: SEL.periodEnd });
        calls.push({ to: staking, data: SEL.rewardPoolBalance });
    });

    var results = await contractReadBatch(calls);

    for (var i = 0; i < POOL_KEYS.length; i++) {
        var base = i * 5;
        // Skip update if all 5 results are '0x0' (RPC failure — not real data)
        var allFailed = results[base] === '0x0' && results[base+1] === '0x0' && results[base+2] === '0x0' && results[base+3] === '0x0' && results[base+4] === '0x0';
        if (allFailed && poolStats[POOL_KEYS[i]]) continue;

        var totalStaked = fromWei(results[base]);
        var stakerCount = Number(BigInt(results[base + 1] || '0x0'));
        var rewardRate = fromWei(results[base + 2]);
        var periodEnd = Number(BigInt(results[base + 3] || '0x0'));
        var rewardPool = fromWei(results[base + 4]);
        var apy = 0;
        if (totalStaked > 0 && rewardRate > 0) {
            var rawApy = (rewardRate * 86400 * 365 / totalStaked) * 100;
            // For dual-token pools, adjust APY by price ratio (reward value / stake value)
            var pk = POOL_KEYS[i];
            if (POOLS[pk].rewardToken && poolPrices[pk] > 0 && poolPrices[pk + '_reward'] > 0) {
                apy = rawApy * (poolPrices[pk + '_reward'] / poolPrices[pk]);
            } else {
                apy = rawApy;
            }
        }
        poolStats[POOL_KEYS[i]] = {
            totalStaked: totalStaked,
            stakerCount: stakerCount,
            rewardRate: rewardRate,
            periodEnd: periodEnd,
            rewardPool: rewardPool,
            apy: apy
        };
    }
}

// ══════════════════════════════════════
// URL ROUTING
// ══════════════════════════════════════

function getCurrentPool() {
    var path = window.location.pathname.replace(/\/$/, '');
    var parts = path.split('/');
    // /stake/ticker/admin → parts = ['', 'stake', 'ticker', 'admin']
    if (parts.length >= 4 && parts[1] === 'stake' && parts[3] === 'admin') {
        var ticker = parts[2].toLowerCase();
        if (POOLS[ticker]) return 'admin:' + ticker;
        return 'not_found';
    }
    // /stake/ticker → parts = ['', 'stake', 'ticker']
    if (parts.length >= 3 && parts[1] === 'stake' && parts[2]) {
        var ticker = parts[2].toLowerCase();
        if (POOLS[ticker]) return POOLS[ticker];
        return 'not_found';
    }
    return null; // overview
}

// ══════════════════════════════════════
// OVERVIEW RENDERING
// ══════════════════════════════════════

function buildPoolRow(key, pool, rank) {
    var stats = poolStats[key] || {};
    var price = poolPrices[key] || 0;
    var tvl = (stats.totalStaked || 0) * price;
    var apy = stats.apy || 0;
    var stakers = stats.stakerCount || 0;

    var apyStr = pool.retired ? '0%' : (apy ? Math.round(apy).toLocaleString('en-US') + '%' : '--');
    var tvlStr = tvl > 0 ? fmtUsd(tvl) : '--';
    var stakersStr = stakers > 0 ? stakers.toLocaleString('en-US') : '--';

    var retiredBadge = pool.retired ? '<span class="stk-badge stk-badge--ended">Ended</span>' : '';
    var btnText = pool.retired ? 'Unstake' : 'Stake';
    var btnClass = pool.retired ? 'stk-action-btn ended' : 'stk-action-btn';

    var logoHtml = pool.logo
        ? '<img class="stk-logo" src="' + pool.logo + '" alt="' + pool.name + '" onerror="this.style.display=\'none\'">'
        : '<div class="stk-logo-placeholder" style="background:' + pool.color + '">' + pool.ticker.charAt(0) + '</div>';

    var rowClass = pool.featured ? ' featured-row' : '';

    return { tvl: tvl, apy: apy, stakers: stakers, html:
        '<tr class="stk-row' + rowClass + '" data-key="' + key + '" style="border-left-color:' + pool.color + '">' +
            '<td><span class="stk-rank">' + rank + '</span></td>' +
            '<td><div class="stk-name-cell">' + logoHtml +
                '<span class="stk-name">' + pool.name + '<span class="stk-symbol">$' + pool.ticker + '</span>' + retiredBadge + '</span>' +
            '</div></td>' +
            '<td><span class="stk-apy' + (apy > 0 ? ' positive' : '') + '">' + apyStr + '</span></td>' +
            '<td><span class="stk-tvl">' + tvlStr + '</span></td>' +
            '<td><span class="stk-stakers">' + stakersStr + '</span></td>' +
            '<td class="stk-action"><button class="' + btnClass + '">' + btnText + '</button></td>' +
        '</tr>'
    };
}

function buildComingSoonRow(pool, rank) {
    var logoHtml = pool.logo
        ? '<img class="stk-logo" src="' + pool.logo + '" alt="' + pool.name + '" onerror="this.style.display=\'none\'">'
        : '<div class="stk-logo-placeholder" style="background:' + pool.color + '">' + pool.ticker.charAt(0) + '</div>';

    return '<tr class="coming-soon-row">' +
        '<td><span class="stk-rank">' + rank + '</span></td>' +
        '<td><div class="stk-name-cell">' + logoHtml +
            '<span class="stk-name">' + pool.name + '<span class="stk-symbol">$' + pool.ticker + '</span>' +
            '<span class="stk-badge stk-badge--coming">Coming Soon</span></span>' +
        '</div></td>' +
        '<td><span class="stk-apy">--</span></td>' +
        '<td><span class="stk-tvl">--</span></td>' +
        '<td><span class="stk-stakers">--</span></td>' +
        '<td class="stk-action"></td>' +
    '</tr>';
}

function renderOverview() {
    var container = document.getElementById('stakeTableContainer');
    if (!container) return;

    // Read current filter + sort
    var activeFilter = 'all';
    var activeTab = document.querySelector('#stakeFilters .lp-filter-tab.active');
    if (activeTab) activeFilter = activeTab.dataset.filter;
    var sortEl = document.getElementById('stakeSort');
    var sortBy = sortEl ? sortEl.value : 'tvl';

    // Filter pools
    var filtered = POOL_KEYS.filter(function(key) {
        if (activeFilter === 'all') return true;
        return POOLS[key].category === activeFilter;
    });

    // Sort: featured first, then by selected metric
    filtered.sort(function(a, b) {
        if (POOLS[a].featured && !POOLS[b].featured) return -1;
        if (!POOLS[a].featured && POOLS[b].featured) return 1;
        var sa = poolStats[a] || {}, sb = poolStats[b] || {};
        if (sortBy === 'apy') return (sb.apy || 0) - (sa.apy || 0);
        if (sortBy === 'stakers') return (sb.stakerCount || 0) - (sa.stakerCount || 0);
        // default: tvl
        var tvlA = (sa.totalStaked || 0) * (poolPrices[a] || 0);
        var tvlB = (sb.totalStaked || 0) * (poolPrices[b] || 0);
        return tvlB - tvlA;
    });

    var totalTvl = 0;
    var rowsHtml = '';
    var rank = 1;

    filtered.forEach(function(key) {
        var result = buildPoolRow(key, POOLS[key], rank);
        totalTvl += result.tvl;
        rowsHtml += result.html;
        rank++;
    });

    // Coming soon rows at bottom (only show if filter matches)
    COMING_SOON.forEach(function(pool) {
        if (activeFilter !== 'all' && pool.category !== activeFilter) return;
        rowsHtml += buildComingSoonRow(pool, rank);
        rank++;
    });

    container.innerHTML =
        '<table class="stake-table">' +
            '<thead><tr>' +
                '<th>#</th>' +
                '<th class="col-name">Token</th>' +
                '<th class="col-apy">APY</th>' +
                '<th class="col-tvl">TVL</th>' +
                '<th class="col-stakers">Stakers</th>' +
                '<th class="col-action">Action</th>' +
            '</tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
        '</table>';

    // Update header stats
    document.getElementById('overviewTvl').textContent = totalTvl > 0 ? fmtUsd(totalTvl) : '--';
    document.getElementById('overviewPoolCount').textContent = POOL_KEYS.length + ' pool' + (POOL_KEYS.length !== 1 ? 's' : '');

    // Wire row click handlers (pushState navigation)
    container.querySelectorAll('.stk-row').forEach(function(row) {
        row.addEventListener('click', function(e) {
            // Don't navigate if clicking the action button
            if (e.target.closest('.stk-action-btn')) {
                e.preventDefault();
                var key = row.dataset.key;
                history.pushState(null, '', '/stake/' + key);
                routeApp();
                return;
            }
            var key = row.dataset.key;
            history.pushState(null, '', '/stake/' + key);
            routeApp();
        });
    });
}

// ══════════════════════════════════════
// POOL PAGE RENDERING
// ══════════════════════════════════════

var currentPoolKey = null;
var walletAddr = null;
var walletBalance = 0;

window.addClawsToWallet = async function() {
    var provider = window.ethereum || (window.phantom && window.phantom.ethereum) || (window.WalletKit && window.WalletKit.getProvider());
    if (!provider) { alert('No wallet detected. Please install MetaMask or another wallet.'); return; }
    try {
        await provider.request({
            method: 'wallet_watchAsset',
            params: { type: 'ERC20', options: {
                address: '0x7ca47B141639B893C6782823C0b219f872056379',
                symbol: 'CLAWS',
                decimals: 18,
                image: 'https://inclawbate.com/inclawbate/assets/clawslogo.jpg'
            }}
        });
    } catch (e) { console.log('User rejected or error:', e); }
};

function getProvider() {
    if (window.WalletKit && window.WalletKit.isConnected()) {
        return window.WalletKit.getProvider();
    }
    return window.ethereum || (window.phantom && window.phantom.ethereum) || null;
}

function renderPoolPage(pool, key) {
    currentPoolKey = key;

    // Set CSS variables
    var page = document.getElementById('stakePool');
    page.style.setProperty('--pool-accent', pool.color);
    page.style.setProperty('--pool-accent-dim', pool.colorDim);
    page.style.setProperty('--pool-glow', pool.glow);

    // Header
    document.getElementById('poolLogo').src = pool.logo;
    document.getElementById('poolLogo').alt = pool.name;
    document.getElementById('poolName').textContent = pool.name;
    document.getElementById('poolDesc').textContent = pool.description;

    // Stats
    var stats = poolStats[key] || {};
    var price = poolPrices[key] || 0;
    document.getElementById('poolApy').textContent = pool.retired ? '0%' : (stats.apy ? Math.round(stats.apy).toLocaleString('en-US') + '%' : '--');
    document.getElementById('poolTotalStaked').textContent = stats.totalStaked ? fmt(stats.totalStaked) : '--';
    document.getElementById('poolStakers').textContent = stats.stakerCount !== undefined ? stats.stakerCount.toLocaleString('en-US') : '--';
    document.getElementById('poolRewardsLeft').textContent = stats.rewardPool ? fmt(stats.rewardPool) : '--';
    if (stats.rewardRate > 0 && stats.rewardPool > 0) startRewardsTick(key);

    // Website banner
    var websiteBanner = document.getElementById('poolWebsiteBanner');
    if (pool.website) {
        if (!websiteBanner) {
            websiteBanner = document.createElement('a');
            websiteBanner.id = 'poolWebsiteBanner';
            websiteBanner.className = 'pool-website-banner';
            var descEl2 = document.getElementById('poolDesc');
            descEl2.parentNode.insertBefore(websiteBanner, descEl2.nextSibling);
        }
        websiteBanner.href = pool.website;
        websiteBanner.target = '_blank';
        websiteBanner.rel = 'noopener';
        websiteBanner.style.display = 'flex';
        websiteBanner.style.setProperty('--pool-accent', pool.color);
        websiteBanner.innerHTML =
            '<span class="pool-website-banner-dot"></span>' +
            '<span class="pool-website-banner-text">Visit <strong>' + pool.website.replace('https://', '') + '</strong></span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>';
    } else if (websiteBanner) {
        websiteBanner.style.display = 'none';
    }

    // Links
    var linksHtml = '';
    if (pool.website) {
        linksHtml += '<a href="' + pool.website + '" target="_blank" rel="noopener" class="pool-link pool-link--website">&#127760; Website</a>';
    }
    if (pool.buyLink) {
        linksHtml += '<a href="' + pool.buyLink + '" target="_blank" rel="noopener" class="pool-link">Buy ' + pool.ticker + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    }
    if (pool.chartLink) {
        linksHtml += '<a href="' + pool.chartLink + '" target="_blank" rel="noopener" class="pool-link">Chart <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    }
    if (pool.token) {
        linksHtml += '<a href="https://www.clanker.world/clanker/' + pool.token + '" target="_blank" rel="noopener" class="pool-link">Clanker <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    }
    linksHtml += '<a href="https://basescan.org/address/' + pool.staking + '" target="_blank" rel="noopener" class="pool-link">Contract <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    if (pool.auditLink) {
        linksHtml += '<a href="' + pool.auditLink + '" target="_blank" rel="noopener" class="pool-link pool-link--audit">&#128737; Audit Report</a>';
    }
    if (key === 'claws') {
        linksHtml += '<a href="/angel" class="pool-link pool-link--nft">&#128140; Angel NFT</a>';
    }
    document.getElementById('poolLinks').innerHTML = linksHtml;

    // Coming soon — disable staking
    if (pool.comingSoon) {
        document.getElementById('poolConnectBtn').textContent = 'Staking Coming Soon';
        document.getElementById('poolConnectBtn').classList.remove('connected');
        document.getElementById('poolConnectBtn').disabled = true;
        document.getElementById('poolConnectBtn').style.opacity = '0.5';
        document.getElementById('poolConnectBtn').style.cursor = 'not-allowed';
        document.getElementById('poolStakeSection').classList.remove('visible');
        document.getElementById('poolPositionSection').classList.remove('visible');
        document.getElementById('poolDesc').textContent = pool.description + ' Staking opens soon — stay tuned.';
        return;
    }

    // Retired pool — show migration notice, allow unstake only
    if (pool.retired) {
        var migrateNotice = document.getElementById('poolRetiredNotice');
        if (!migrateNotice) {
            migrateNotice = document.createElement('div');
            migrateNotice.id = 'poolRetiredNotice';
            migrateNotice.className = 'pool-retired-notice';
            var descEl = document.getElementById('poolDesc');
            descEl.parentNode.insertBefore(migrateNotice, descEl.nextSibling);
        }
        migrateNotice.style.display = 'block';
        var clawsAddr = '0x7ca47B141639B893C6782823C0b219f872056379';
        migrateNotice.innerHTML =
            '<div class="retired-notice-title">This pool has ended</div>' +
            '<p>Rewards for this pool have stopped and migrated to <strong>CLAWS</strong>.</p>' +
            '<p>If you have tokens staked here, connect your wallet below to unstake them. Then head to the CLAWS pool to stake and start earning again.</p>' +
            '<div class="retired-notice-actions">' +
                '<button onclick="addClawsToWallet()" class="pool-retired-add-btn">&#129438; Add $CLAWS to Wallet</button>' +
                '<a href="/stake/claws" class="pool-retired-cta">Go to CLAWS Staking &rarr;</a>' +
            '</div>';
    }
    // Hide retired notice for non-retired pools
    if (!pool.retired) {
        var existingNotice = document.getElementById('poolRetiredNotice');
        if (existingNotice) existingNotice.style.display = 'none';
    }

    // Reset wallet state
    document.getElementById('poolConnectBtn').textContent = 'Connect Wallet';
    document.getElementById('poolConnectBtn').classList.remove('connected');
    document.getElementById('poolConnectBtn').disabled = false;
    document.getElementById('poolConnectBtn').style.opacity = '';
    document.getElementById('poolConnectBtn').style.cursor = '';
    document.getElementById('poolStakeSection').classList.remove('visible');
    document.getElementById('poolPositionSection').classList.remove('visible');
    document.getElementById('poolStakeStatus').textContent = '';
    document.getElementById('poolStakeInput').value = '';
    document.getElementById('poolSlider').value = 0;
    document.getElementById('poolHint').textContent = '';

    // Dual-token: hide compound button, update earned label
    var compoundBtn = document.getElementById('posCompoundBtn');
    var earnedLabel = document.getElementById('posEarnedLabel');
    if (pool.rewardToken) {
        compoundBtn.style.display = 'none';
        if (earnedLabel) earnedLabel.textContent = pool.rewardTicker + ' Earned';
    } else {
        compoundBtn.style.display = '';
        if (earnedLabel) earnedLabel.textContent = 'Earned';
    }

    // Check if wallet already connected
    if (walletAddr) {
        onPoolWalletConnected(walletAddr, pool, key);
    }
}

// ══════════════════════════════════════
// WALLET CONNECTION
// ══════════════════════════════════════

async function connectPoolWallet() {
    if (walletAddr) return walletAddr;

    // Wait for late-loading wallets (Base Wallet EIP-6963)
    if (!window.ethereum && window._awaitProvider) await window._awaitProvider();

    var eth = null;
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var providers = window._eip6963Providers || [];

    // Auto-connect: mobile inside wallet browser, or desktop with 1 provider / legacy
    if (isMobile && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (!isMobile && providers.length === 1) {
        eth = providers[0].provider;
    } else if (!isMobile && providers.length === 0 && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (window.showWalletSelector) {
        eth = await window.showWalletSelector();
    }

    if (!eth) return null;

    try {
        var accounts = await eth.request({ method: 'eth_requestAccounts' });
        var addr = accounts[0];
        try {
            await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await eth.request({
                    method: 'wallet_addEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
                });
            }
        }
        walletAddr = addr;
        try { localStorage.setItem('_stake_wallet', addr); } catch (e) {}
        if (currentPoolKey && POOLS[currentPoolKey]) {
            onPoolWalletConnected(addr, POOLS[currentPoolKey], currentPoolKey);
        }
        return addr;
    } catch (err) {
        var msg = err.message || 'Connection failed';
        if (msg.indexOf('not been authorized') !== -1 || msg.indexOf('User rejected') !== -1 || err.code === 4001) {
            msg = 'Wallet rejected connection. Please approve the request in your wallet.';
        }
        if (err.code !== 4001) stakeToast(msg, 'error');
        return null;
    }
}

function disconnectPoolWallet() {
    walletAddr = null;
    walletBalance = 0;
    try { localStorage.removeItem('_stake_wallet'); } catch (e) {}
    if (window.WalletKit && window.WalletKit.isConnected()) window.WalletKit.disconnect();

    var btn = document.getElementById('poolConnectBtn');
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    document.getElementById('poolStakeSection').classList.remove('visible');
    document.getElementById('poolPositionSection').classList.remove('visible');
}

async function onPoolWalletConnected(addr, pool, key) {
    var btn = document.getElementById('poolConnectBtn');
    btn.textContent = '\u2713 ' + shortAddr(addr);
    btn.classList.add('connected');

    // Show stake form
    document.getElementById('poolStakeSection').classList.add('visible');

    // Fetch wallet balance + position
    await fetchPoolUserData(addr, pool, key);
}

async function fetchPoolUserData(addr, pool, key) {
    var addrPadded = pad32(addr);
    var results = await contractReadBatch([
        { to: pool.token, data: BALANCE_SELECTOR + addrPadded },
        { to: pool.staking, data: SEL.balanceOf + addrPadded },
        { to: pool.staking, data: SEL.earned + addrPadded },
    ]);

    walletBalance = fromWei(results[0]);
    var stakedAmount = fromWei(results[1]);
    var earnedAmount = fromWei(results[2]);
    var price = poolPrices[key] || 0;
    var earnedTicker = pool.rewardTicker || pool.ticker;

    // Update balance display
    document.getElementById('poolWalletBal').textContent = fmt(walletBalance) + ' ' + pool.ticker;

    // Update position
    if (stakedAmount > 0 || earnedAmount > 0) {
        document.getElementById('poolPositionSection').classList.add('visible');
        var stakedUsd = price > 0 ? ' <span class="usd">(' + fmtUsd(stakedAmount * price) + ')</span>' : '';
        document.getElementById('posStaked').innerHTML = fmt(stakedAmount) + ' ' + pool.ticker + stakedUsd;
        document.getElementById('posEarned').innerHTML = fmt(earnedAmount) + ' ' + earnedTicker;
    } else {
        document.getElementById('poolPositionSection').classList.remove('visible');
    }

    // Also refresh stats
    await refreshPoolStats(key);
}

async function refreshPoolStats(key) {
    var pool = POOLS[key];
    var results = await contractReadBatch([
        { to: pool.staking, data: SEL.totalStaked },
        { to: pool.staking, data: SEL.stakerCount },
        { to: pool.staking, data: SEL.rewardRate },
        { to: pool.staking, data: SEL.periodEnd },
        { to: pool.staking, data: SEL.rewardPoolBalance },
    ]);

    // Skip update if all results are '0x0' (RPC failure) and we have existing data
    var allFailed = results[0] === '0x0' && results[1] === '0x0' && results[2] === '0x0' && results[3] === '0x0' && results[4] === '0x0';
    if (allFailed && poolStats[key]) return;

    var totalStaked = fromWei(results[0]);
    var stakerCount = Number(BigInt(results[1] || '0x0'));
    var rewardRate = fromWei(results[2]);
    var rewardPool = fromWei(results[4]);
    var rawApy = totalStaked > 0 && rewardRate > 0 ? (rewardRate * 86400 * 365 / totalStaked) * 100 : 0;
    var apy = rawApy;
    if (rawApy > 0 && POOLS[key].rewardToken && poolPrices[key] > 0 && poolPrices[key + '_reward'] > 0) {
        apy = rawApy * (poolPrices[key + '_reward'] / poolPrices[key]);
    }

    poolStats[key] = { totalStaked: totalStaked, stakerCount: stakerCount, rewardRate: rewardRate, periodEnd: Number(BigInt(results[3] || '0x0')), rewardPool: rewardPool, apy: apy };

    document.getElementById('poolApy').textContent = POOLS[key].retired ? '0%' : (apy > 0 ? Math.round(apy).toLocaleString('en-US') + '%' : '--');
    document.getElementById('poolTotalStaked').textContent = totalStaked > 0 ? fmt(totalStaked) : '--';
    document.getElementById('poolStakers').textContent = stakerCount > 0 ? stakerCount.toLocaleString('en-US') : '--';
    updateRewardsLeftDisplay(key);
    startRewardsTick(key);
}

function updateRewardsLeftDisplay(key) {
    var stats = poolStats[key];
    if (!stats) return;
    var now = Math.floor(Date.now() / 1000);
    var elapsed = Math.max(0, now - rewardsTickStart);
    // If period has ended, rewards stop draining
    if (stats.periodEnd > 0 && now >= stats.periodEnd) {
        elapsed = Math.max(0, stats.periodEnd - rewardsTickStart);
    }
    var drained = stats.rewardRate * elapsed;
    var remaining = Math.max(0, stats.rewardPool - drained);
    document.getElementById('poolRewardsLeft').textContent = remaining > 0 ? fmt(remaining) : '0';
}

function startRewardsTick(key) {
    if (rewardsTickInterval) clearInterval(rewardsTickInterval);
    rewardsTickStart = Math.floor(Date.now() / 1000);
    var stats = poolStats[key];
    if (!stats || stats.rewardRate <= 0 || stats.rewardPool <= 0) return;
    rewardsTickInterval = setInterval(function() {
        updateRewardsLeftDisplay(key);
    }, 1000);
}

// ══════════════════════════════════════
// STAKING ACTIONS
// ══════════════════════════════════════

async function doPoolStake() {
    if (!walletAddr || !currentPoolKey) return;
    var pool = POOLS[currentPoolKey];
    var input = document.getElementById('poolStakeInput');
    var amount = parseInt(input.value.replace(/[.,]/g, '')) || 0;
    if (amount <= 0) return;

    var confirmed = await stakeModal({
        icon: '\u26A0\uFE0F',
        title: 'Stake ' + pool.ticker,
        msg: 'Stake ' + fmt(amount) + ' ' + pool.ticker + ' in the on-chain contract. You can unstake anytime. You\'ll need to approve the contract first.',
        confirmLabel: 'Approve & Stake',
        cancelLabel: 'Cancel',
        confirmClass: 'stake-modal-btn--confirm'
    });
    if (!confirmed) return;

    var btn = document.getElementById('poolStakeBtn');
    var status = document.getElementById('poolStakeStatus');
    btn.disabled = true;
    btn.textContent = 'Staking...';

    var provider = getProvider();
    if (!provider) {
        status.textContent = 'No wallet connected';
        status.className = 'pool-status error';
        btn.disabled = false;
        btn.textContent = 'Stake';
        return;
    }

    var amountWei = toWei(amount);

    try {
        // Check allowance
        status.textContent = 'Checking approval...';
        status.className = 'pool-status';

        var allowanceData = SEL.allowance + pad32(walletAddr) + pad32(pool.staking);
        var allowanceRes = await provider.request({
            method: 'eth_call',
            params: [{ to: pool.token, data: allowanceData }, 'latest']
        });
        var currentAllowance = BigInt(allowanceRes || '0x0');

        // Approve if needed
        if (currentAllowance < amountWei) {
            status.textContent = 'Requesting token approval...';
            var approveData = SEL.approve + pad32(pool.staking) + pad32(MAX_UINT256);
            await sendTxAndWait(provider, walletAddr, pool.token, approveData, status, 'Approving contract...');
        }

        // Stake
        var stakeData = SEL.stake + pad32(toHex(amountWei));
        var txHash = await sendTxAndWait(provider, walletAddr, pool.staking, stakeData, status, 'Staking ' + fmt(amount) + ' ' + pool.ticker + '...');

        status.innerHTML = 'Staked ' + fmt(amount) + ' ' + pool.ticker + '! <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--pool-accent);text-decoration:underline;">View tx</a>';
        status.className = 'pool-status success';
        stakeToast('Staked ' + fmt(amount) + ' ' + pool.ticker, 'success');

        // Refresh — delay to let public RPCs catch up to latest block
        input.value = '';
        document.getElementById('poolSlider').value = 0;
        document.getElementById('poolHint').textContent = '';
        await new Promise(function(r) { setTimeout(r, 3000); });
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
        // Retry once more after 5s in case first read was stale
        setTimeout(function() { fetchPoolUserData(walletAddr, pool, currentPoolKey); }, 5000);
    } catch (err) {
        status.textContent = err.message || 'Stake failed';
        status.className = 'pool-status error';
    }

    btn.disabled = false;
    btn.textContent = 'Stake';
}

async function doPoolClaim(compound) {
    if (!walletAddr || !currentPoolKey) return;
    var pool = POOLS[currentPoolKey];
    var provider = getProvider();
    if (!provider) return;

    // No compound for dual-token pools
    if (compound && pool.rewardToken) return;

    var earnedTicker = pool.rewardTicker || pool.ticker;

    var earnedRes = await contractRead(pool.staking, SEL.earned + pad32(walletAddr));
    var earnedAmount = fromWei(earnedRes);
    if (earnedAmount < 1) {
        stakeToast('No rewards to claim yet', 'error');
        return;
    }

    var action = compound ? 'Compound' : 'Claim';
    var confirmed = await stakeModal({
        icon: compound ? '\uD83C\uDF31' : '\uD83E\uDD9E',
        title: action + ' Rewards',
        msg: action + ' ' + fmt(Math.round(earnedAmount)) + ' ' + earnedTicker + (compound ? ' (adds to your staked balance)' : ' (sends to your wallet)') + '?',
        confirmLabel: action,
        confirmClass: 'stake-modal-btn--confirm'
    });
    if (!confirmed) return;

    var claimBtn = compound ? document.getElementById('posCompoundBtn') : document.getElementById('posClaimBtn');
    var status = document.getElementById('poolStakeStatus');
    if (claimBtn) { claimBtn.disabled = true; claimBtn.textContent = (compound ? 'Compounding...' : 'Claiming...'); }

    try {
        var selector = compound ? SEL.claimAndRestake : SEL.claim;
        var txHash = await sendTxAndWait(provider, walletAddr, pool.staking, selector, status, 'Confirm in wallet...');
        status.innerHTML = (compound ? 'Compounded ' : 'Claimed ') + fmt(Math.round(earnedAmount)) + ' ' + earnedTicker + ' <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--pool-accent);text-decoration:underline;">View tx</a>';
        status.className = 'pool-status success';
        stakeToast((compound ? 'Compounded ' : 'Claimed ') + fmt(Math.round(earnedAmount)) + ' ' + earnedTicker, 'success');
        await new Promise(function(r) { setTimeout(r, 3000); });
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
        setTimeout(function() { fetchPoolUserData(walletAddr, pool, currentPoolKey); }, 5000);
    } catch (err) {
        if (status) { status.textContent = err.message || (action + ' failed'); status.className = 'pool-status error'; }
        stakeToast(err.message || (action + ' failed'), 'error');
    }
    if (claimBtn) { claimBtn.disabled = false; claimBtn.textContent = compound ? 'Compound' : 'Claim'; }
}

async function doPoolUnstake() {
    if (!walletAddr || !currentPoolKey) return;
    var pool = POOLS[currentPoolKey];
    var provider = getProvider();
    if (!provider) return;

    var addrPadded = pad32(walletAddr);
    var [balRes, earnedRes] = await contractReadBatch([
        { to: pool.staking, data: SEL.balanceOf + addrPadded },
        { to: pool.staking, data: SEL.earned + addrPadded },
    ]);
    var stakedAmount = fromWei(balRes);
    var earnedAmount = fromWei(earnedRes);

    if (BigInt(balRes || '0x0') === 0n) {
        stakeToast('Nothing staked', 'error');
        return;
    }

    var rewardsNote = earnedAmount >= 1 ? ' + ' + fmt(Math.round(earnedAmount)) + ' rewards' : '';
    var confirmed = await stakeModal({
        icon: '\uD83E\uDD9E',
        title: 'Unstake ' + pool.ticker,
        msg: 'Withdraw ' + fmt(Math.round(stakedAmount)) + ' ' + pool.ticker + rewardsNote + '? Everything goes directly to your wallet.',
        confirmLabel: 'Unstake & Claim',
        confirmClass: 'stake-modal-btn--confirm'
    });
    if (!confirmed) return;

    var unstakeBtn = document.getElementById('posUnstakeBtn');
    var status = document.getElementById('poolStakeStatus');
    if (unstakeBtn) { unstakeBtn.disabled = true; unstakeBtn.textContent = 'Unstaking...'; }

    try {
        var txHash = await sendTxAndWait(provider, walletAddr, pool.staking, SEL.exit, status, 'Confirm in wallet...');
        status.innerHTML = 'Unstaked ' + fmt(Math.round(stakedAmount)) + ' ' + pool.ticker + rewardsNote + ' <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--pool-accent);text-decoration:underline;">View tx</a>';
        status.className = 'pool-status success';
        stakeToast('Unstaked ' + fmt(Math.round(stakedAmount)) + ' ' + pool.ticker + rewardsNote, 'success');
        await new Promise(function(r) { setTimeout(r, 3000); });
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
        setTimeout(function() { fetchPoolUserData(walletAddr, pool, currentPoolKey); }, 5000);
    } catch (err) {
        if (status) { status.textContent = err.message || 'Unstake failed'; status.className = 'pool-status error'; }
        stakeToast(err.message || 'Unstake failed', 'error');
    }
    if (unstakeBtn) { unstakeBtn.disabled = false; unstakeBtn.textContent = 'Unstake All'; }
}

// ══════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════

var adminPoolKey = null;

function renderAdminPage(pool, key) {
    adminPoolKey = key;

    // Set CSS variables
    var adminEl = document.getElementById('stakeAdmin');
    adminEl.style.setProperty('--pool-accent', pool.color);
    adminEl.style.setProperty('--pool-accent-dim', pool.colorDim);
    adminEl.style.setProperty('--pool-glow', pool.glow);

    // Header
    document.getElementById('adminLogo').src = pool.logo;
    document.getElementById('adminLogo').alt = pool.name;
    document.getElementById('adminPoolName').textContent = pool.name;

    // Back link
    document.getElementById('adminBack').href = '/stake/' + key;

    // Reset state
    var btn = document.getElementById('adminConnectBtn');
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    document.getElementById('adminDenied').textContent = '';
    document.getElementById('adminPanel').classList.remove('visible');
    document.getElementById('adminDepositInput').value = '';
    document.getElementById('adminDepositStatus').textContent = '';
    document.getElementById('adminDepositBtn').disabled = true;
    setAdminEndFromDays(30); // default to 30 days out

    // If wallet already connected, try admin check
    if (walletAddr) {
        checkAdminAccess(walletAddr, pool, key);
    }
}

async function checkAdminAccess(addr, pool, key) {
    var btn = document.getElementById('adminConnectBtn');
    var denied = document.getElementById('adminDenied');

    btn.textContent = 'Checking...';
    btn.classList.add('connected');

    try {
        // Read contract's admin() on-chain
        var adminResult = await contractRead(pool.staking, SEL.admin);
        // admin() returns an address — last 40 hex chars
        var contractAdmin = '0x' + adminResult.slice(-40).toLowerCase();
        var connectedAddr = addr.toLowerCase();

        if (contractAdmin === connectedAddr) {
            btn.textContent = '\u2713 ' + shortAddr(addr);
            denied.textContent = '';
            document.getElementById('adminPanel').classList.add('visible');
            fetchAdminStats(pool, key);
        } else {
            btn.textContent = '\u2713 ' + shortAddr(addr);
            denied.textContent = 'Access denied. Only the contract admin can manage this pool.';
            document.getElementById('adminPanel').classList.remove('visible');
        }
    } catch (err) {
        btn.textContent = '\u2713 ' + shortAddr(addr);
        denied.textContent = 'Failed to verify admin access.';
    }
}

async function connectAdminWallet() {
    // Wait for late-loading wallets
    if (!window.ethereum && window._awaitProvider) await window._awaitProvider();

    var eth = null;
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var providers = window._eip6963Providers || [];

    // Auto-connect: mobile inside wallet browser, or desktop with 1 provider / legacy
    if (isMobile && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (!isMobile && providers.length === 1) {
        eth = providers[0].provider;
    } else if (!isMobile && providers.length === 0 && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (window.showWalletSelector) {
        eth = await window.showWalletSelector();
    }

    if (!eth) return;

    try {
        var accounts = await eth.request({ method: 'eth_requestAccounts' });
        var addr = accounts[0];
        try {
            await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await eth.request({
                    method: 'wallet_addEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
                });
            }
        }
        walletAddr = addr;
        try { localStorage.setItem('_stake_wallet', addr); } catch (e) {}

        if (adminPoolKey && POOLS[adminPoolKey]) {
            checkAdminAccess(addr, POOLS[adminPoolKey], adminPoolKey);
        }
    } catch (err) {
        var msg = err.message || 'Connection failed';
        if (err.code === 4001) msg = '';
        document.getElementById('adminDenied').textContent = msg;
    }
}

async function fetchAdminStats(pool, key) {
    var results = await contractReadBatch([
        { to: pool.staking, data: SEL.rewardRate },
        { to: pool.staking, data: SEL.periodEnd },
        { to: pool.staking, data: SEL.rewardPoolBalance },
        { to: pool.staking, data: SEL.totalDeposited },
        { to: pool.staking, data: SEL.totalClaimed },
        { to: pool.staking, data: SEL.paused },
    ]);

    var rewardRate = fromWei(results[0]);
    var periodEnd = Number(BigInt(results[1] || '0x0'));
    var rewardsLeft = fromWei(results[2]);
    var totalDeposited = fromWei(results[3]);
    var totalClaimed = fromWei(results[4]);
    var isPaused = BigInt(results[5] || '0x0') !== 0n;

    // Reward rate as tokens/day
    var tokensPerDay = rewardRate * 86400;
    document.getElementById('adminRewardRate').textContent = fmt(tokensPerDay) + ' / day';

    // Period end
    if (periodEnd > 0) {
        var endDate = new Date(periodEnd * 1000);
        var now = Date.now();
        if (periodEnd * 1000 > now) {
            var daysLeft = Math.ceil((periodEnd * 1000 - now) / 86400000);
            document.getElementById('adminPeriodEnd').textContent = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' (' + daysLeft + 'd left)';
        } else {
            document.getElementById('adminPeriodEnd').textContent = 'Ended ' + endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    } else {
        document.getElementById('adminPeriodEnd').textContent = 'Not started';
    }

    var rewardTicker = pool.rewardTicker || pool.ticker;
    document.getElementById('adminRewardsLeft').textContent = fmt(rewardsLeft) + ' ' + rewardTicker;
    document.getElementById('adminTotalDeposited').textContent = fmt(totalDeposited) + ' ' + rewardTicker;
    document.getElementById('adminTotalClaimed').textContent = fmt(totalClaimed) + ' ' + rewardTicker;

    var pausedEl = document.getElementById('adminPaused');
    pausedEl.textContent = isPaused ? 'Yes' : 'No';
    pausedEl.className = 'admin-stat-value ' + (isPaused ? 'paused-yes' : 'paused-no');
}

function getAdminDurationSec() {
    var dateVal = document.getElementById('adminEndDate').value;
    var timeVal = document.getElementById('adminEndTime').value || '12:00';
    if (!dateVal) return 0;
    var endMs = new Date(dateVal + 'T' + timeVal).getTime();
    var nowMs = Date.now();
    return Math.max(0, Math.floor((endMs - nowMs) / 1000));
}

function formatDurationLabel(sec) {
    var days = Math.floor(sec / 86400);
    var hours = Math.floor((sec % 86400) / 3600);
    if (days > 0 && hours > 0) return days + 'd ' + hours + 'h';
    if (days > 0) return days + ' day' + (days !== 1 ? 's' : '');
    return hours + ' hour' + (hours !== 1 ? 's' : '');
}

function updateAdminDurationPreview() {
    var preview = document.getElementById('adminDurationPreview');
    var sec = getAdminDurationSec();
    if (sec < 60) {
        preview.innerHTML = '';
        return;
    }
    preview.innerHTML = 'Duration: <span class="dur-value">' + formatDurationLabel(sec) + '</span>';
}

function setAdminEndFromDays(days) {
    var end = new Date(Date.now() + days * 86400000);
    var y = end.getFullYear();
    var m = String(end.getMonth() + 1).padStart(2, '0');
    var d = String(end.getDate()).padStart(2, '0');
    document.getElementById('adminEndDate').value = y + '-' + m + '-' + d;
    document.getElementById('adminEndTime').value = '12:00';
    updateAdminDurationPreview();
    updateAdminDepositBtn();
}

function updateAdminDepositBtn() {
    var amount = parseInt((document.getElementById('adminDepositInput').value || '').replace(/[.,]/g, '')) || 0;
    var sec = getAdminDurationSec();
    document.getElementById('adminDepositBtn').disabled = amount <= 0 || sec < 3600;
}

async function doDepositRewards() {
    if (!walletAddr || !adminPoolKey) return;
    var pool = POOLS[adminPoolKey];
    var input = document.getElementById('adminDepositInput');
    var amount = parseInt(input.value.replace(/[.,]/g, '')) || 0;
    if (amount <= 0) return;

    var durationSec = getAdminDurationSec();
    if (durationSec < 3600) {
        stakeToast('Pick an end date at least 1 hour from now', 'error');
        return;
    }
    var durationLabel = formatDurationLabel(durationSec);

    // For dual-token pools, deposit reward token (e.g. INCLAWNCH), not staking token
    var depositTokenAddr = pool.rewardToken || pool.token;
    var depositTicker = pool.rewardTicker || pool.ticker;

    var confirmed = await stakeModal({
        icon: '\u26A0\uFE0F',
        title: 'Deposit Rewards',
        msg: 'Deposit ' + fmt(amount) + ' ' + depositTicker + ' as rewards over ' + durationLabel + '. This will set the reward rate and period end.',
        confirmLabel: 'Approve & Deposit',
        cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    var btn = document.getElementById('adminDepositBtn');
    var status = document.getElementById('adminDepositStatus');
    btn.disabled = true;
    btn.textContent = 'Depositing...';

    var provider = getProvider();
    if (!provider) {
        status.textContent = 'No wallet connected';
        status.className = 'pool-status error';
        btn.disabled = false;
        btn.textContent = 'Deposit Rewards';
        return;
    }

    var amountWei = toWei(amount);

    try {
        // Check allowance on reward token (or staking token for single-token pools)
        status.textContent = 'Checking approval...';
        status.className = 'pool-status';

        var allowanceData = SEL.allowance + pad32(walletAddr) + pad32(pool.staking);
        var allowanceRes = await provider.request({
            method: 'eth_call',
            params: [{ to: depositTokenAddr, data: allowanceData }, 'latest']
        });
        var currentAllowance = BigInt(allowanceRes || '0x0');

        if (currentAllowance < amountWei) {
            status.textContent = 'Requesting token approval...';
            var approveData = SEL.approve + pad32(pool.staking) + pad32(MAX_UINT256);
            await sendTxAndWait(provider, walletAddr, depositTokenAddr, approveData, status, 'Approving contract...');
        }

        // depositRewards(uint256 amount, uint256 duration)
        var depositData = SEL.depositRewards + pad32(toHex(amountWei)) + pad32(toHex(durationSec));
        var txHash = await sendTxAndWait(provider, walletAddr, pool.staking, depositData, status, 'Depositing ' + fmt(amount) + ' ' + depositTicker + '...');

        status.innerHTML = 'Deposited ' + fmt(amount) + ' ' + depositTicker + ' over ' + durationLabel + '! <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--pool-accent);text-decoration:underline;">View tx</a>';
        status.className = 'pool-status success';
        stakeToast('Deposited ' + fmt(amount) + ' ' + depositTicker + ' rewards', 'success');

        input.value = '';
        btn.disabled = true;
        await new Promise(function(r) { setTimeout(r, 3000); });
        fetchAdminStats(pool, adminPoolKey);
    } catch (err) {
        status.textContent = err.message || 'Deposit failed';
        status.className = 'pool-status error';
    }

    btn.disabled = false;
    btn.textContent = 'Deposit Rewards';
}

// ══════════════════════════════════════
// INPUT HELPERS
// ══════════════════════════════════════

function getInputAmount() {
    var input = document.getElementById('poolStakeInput');
    if (!input) return 0;
    return parseInt(input.value.replace(/[.,]/g, '')) || 0;
}

function setInputAmount(amount) {
    var input = document.getElementById('poolStakeInput');
    if (!input) return;
    input.value = Math.floor(amount).toLocaleString('en-US');
    updateHint();
    updateSliderFromInput();
    updatePctButtons();
}

function updateHint() {
    var hint = document.getElementById('poolHint');
    var stakeBtn = document.getElementById('poolStakeBtn');
    var amount = getInputAmount();
    var price = currentPoolKey ? (poolPrices[currentPoolKey] || 0) : 0;
    if (price > 0 && amount > 0) {
        hint.textContent = '~' + fmtUsd(amount * price);
    } else {
        hint.textContent = '';
    }
    stakeBtn.disabled = amount <= 0 || !walletAddr;
}

function updateSliderFromInput() {
    var slider = document.getElementById('poolSlider');
    if (walletBalance <= 0) { slider.value = 0; return; }
    var amount = getInputAmount();
    slider.value = Math.min(100, Math.round((amount / walletBalance) * 100));
}

function updatePctButtons() {
    var amount = getInputAmount();
    var pct = walletBalance > 0 ? Math.round((amount / walletBalance) * 100) : 0;
    document.querySelectorAll('.pool-pct-btn').forEach(function(btn) {
        var btnPct = parseInt(btn.getAttribute('data-pct'));
        btn.classList.toggle('active', pct === btnPct);
    });
}

// ══════════════════════════════════════
// WIRE UP EVENT LISTENERS
// ══════════════════════════════════════

function wirePoolEvents() {
    // Connect button
    document.getElementById('poolConnectBtn').addEventListener('click', function() {
        if (walletAddr) {
            disconnectPoolWallet();
        } else {
            connectPoolWallet();
        }
    });

    // Back link
    document.getElementById('poolBack').addEventListener('click', function(e) {
        e.preventDefault();
        history.pushState(null, '', '/stake');
        routeApp();
    });

    // MAX button
    document.getElementById('poolMaxBtn').addEventListener('click', function() {
        setInputAmount(walletBalance);
    });

    // Input formatting
    var input = document.getElementById('poolStakeInput');
    input.addEventListener('input', function() {
        var raw = input.value.replace(/[^0-9]/g, '');
        var num = parseInt(raw) || 0;
        if (num > 0) {
            input.value = num.toLocaleString('en-US');
        }
        updateHint();
        updateSliderFromInput();
        updatePctButtons();
    });

    // Percent buttons
    document.querySelectorAll('.pool-pct-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var pct = parseInt(btn.getAttribute('data-pct'));
            setInputAmount(walletBalance * pct / 100);
        });
    });

    // Slider
    document.getElementById('poolSlider').addEventListener('input', function() {
        var pct = parseInt(this.value);
        var amount = Math.floor(walletBalance * pct / 100);
        var inputEl = document.getElementById('poolStakeInput');
        if (amount > 0) {
            inputEl.value = amount.toLocaleString('en-US');
        } else {
            inputEl.value = '';
        }
        updateHint();
        updatePctButtons();
    });

    // Stake button
    document.getElementById('poolStakeBtn').addEventListener('click', doPoolStake);

    // Position action buttons
    document.getElementById('posClaimBtn').addEventListener('click', function() { doPoolClaim(false); });
    document.getElementById('posCompoundBtn').addEventListener('click', function() { doPoolClaim(true); });
    document.getElementById('posUnstakeBtn').addEventListener('click', doPoolUnstake);

    // ── Admin panel events ──
    document.getElementById('adminConnectBtn').addEventListener('click', function() {
        if (walletAddr && adminPoolKey) {
            // Already connected — disconnect
            walletAddr = null;
            try { localStorage.removeItem('_stake_wallet'); } catch (e) {}
            var btn = document.getElementById('adminConnectBtn');
            btn.textContent = 'Connect Wallet';
            btn.classList.remove('connected');
            document.getElementById('adminDenied').textContent = '';
            document.getElementById('adminPanel').classList.remove('visible');
        } else {
            connectAdminWallet();
        }
    });

    document.getElementById('adminBack').addEventListener('click', function(e) {
        e.preventDefault();
        var key = adminPoolKey || 'inclawnch';
        history.pushState(null, '', '/stake/' + key);
        routeApp();
    });

    // Admin deposit input — enable/disable button
    var adminInput = document.getElementById('adminDepositInput');
    adminInput.addEventListener('input', function() {
        var raw = adminInput.value.replace(/[^0-9]/g, '');
        var num = parseInt(raw) || 0;
        if (num > 0) {
            adminInput.value = num.toLocaleString('en-US');
        }
        updateAdminDepositBtn();
    });

    // Date/time pickers
    document.getElementById('adminEndDate').addEventListener('change', function() {
        updateAdminDurationPreview();
        updateAdminDepositBtn();
    });
    document.getElementById('adminEndTime').addEventListener('change', function() {
        updateAdminDurationPreview();
        updateAdminDepositBtn();
    });

    // Quick duration buttons
    document.querySelectorAll('.admin-quick-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setAdminEndFromDays(parseInt(btn.getAttribute('data-days')));
        });
    });

    document.getElementById('adminDepositBtn').addEventListener('click', doDepositRewards);
}

// ══════════════════════════════════════
// APP ROUTER
// ══════════════════════════════════════

function routeApp() {
    var overviewEl = document.getElementById('stakeOverview');
    var poolEl = document.getElementById('stakePool');
    var notFoundEl = document.getElementById('stakeNotFound');
    var adminEl = document.getElementById('stakeAdmin');

    overviewEl.style.display = 'none';
    poolEl.classList.remove('visible');
    notFoundEl.style.display = 'none';
    adminEl.classList.remove('visible');

    var pool = getCurrentPool();

    if (pool === null) {
        // Overview
        overviewEl.style.display = '';
        renderOverview();
        document.title = 'Stake \u2014 Inclawbate';
    } else if (pool === 'not_found') {
        notFoundEl.style.display = '';
        document.title = 'Pool Not Found \u2014 Inclawbate';
    } else if (typeof pool === 'string' && pool.indexOf('admin:') === 0) {
        // Admin panel
        var key = pool.split(':')[1];
        adminEl.classList.add('visible');
        renderAdminPage(POOLS[key], key);
        document.title = POOLS[key].name + ' Admin \u2014 Inclawbate';
    } else {
        // Individual pool
        var key = window.location.pathname.split('/')[2].toLowerCase();
        poolEl.classList.add('visible');
        renderPoolPage(pool, key);
        document.title = pool.name + ' Staking \u2014 Inclawbate';
    }
}

// ══════════════════════════════════════
// POOL CREATION MODAL
// ══════════════════════════════════════

var poolModalTokensCache = null;
var poolModalDeploying = false;

function openPoolModal() {
    var overlay = document.getElementById('poolModalOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    // Reset state
    document.getElementById('poolModalLoading').classList.remove('hidden');
    document.getElementById('poolModalNoTokens').classList.add('hidden');
    document.getElementById('poolModalForm').classList.add('hidden');
    document.getElementById('poolModalStatus').textContent = '';
    poolModalTokensCache = null;
    loadPoolModalTokens();
}

function closePoolModal() {
    var overlay = document.getElementById('poolModalOverlay');
    if (overlay) overlay.classList.remove('visible');
}

async function loadPoolModalTokens() {
    var loading = document.getElementById('poolModalLoading');
    var noTokens = document.getElementById('poolModalNoTokens');
    var form = document.getElementById('poolModalForm');
    var select = document.getElementById('poolModalSelect');

    // Connect wallet if needed
    var provider = getProvider();
    if (!provider || !walletAddr) {
        try {
            var accounts = await (provider || window.ethereum).request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                walletAddr = accounts[0];
                provider = getProvider();
            }
        } catch (e) {}
    }
    if (!walletAddr) {
        loading.classList.add('hidden');
        noTokens.classList.remove('hidden');
        noTokens.querySelector('p').textContent = 'Connect your wallet first.';
        return;
    }

    loading.classList.remove('hidden');
    noTokens.classList.add('hidden');
    form.classList.add('hidden');

    try {
        var res = await fetch('/api/inclawbate/inclawbator?wallet=' + encodeURIComponent(walletAddr.toLowerCase()));
        var data = await res.json();
        var projects = (data.projects || []).filter(function(p) {
            return p.token_address && p.status === 'active' && !p.staking_address;
        });
        poolModalTokensCache = projects;

        loading.classList.add('hidden');

        if (projects.length === 0) {
            noTokens.classList.remove('hidden');
            noTokens.querySelector('p').textContent = "You don't have any tokens without a staking pool.";
            return;
        }

        form.classList.remove('hidden');
        select.innerHTML = '<option value="">Choose a token...</option>';
        projects.forEach(function(p) {
            var opt = document.createElement('option');
            opt.value = p.token_address;
            opt.textContent = (p.token_name || 'Unknown') + ' ($' + (p.token_symbol || '???') + ')';
            opt.dataset.name = p.token_name || '';
            opt.dataset.symbol = p.token_symbol || '';
            select.appendChild(opt);
        });

        select.onchange = function() {
            var preview = document.getElementById('poolModalPreview');
            var sel = select.options[select.selectedIndex];
            if (select.value && sel.dataset.name) {
                document.getElementById('poolModalTokenName').textContent = sel.dataset.name;
                document.getElementById('poolModalTokenSymbol').textContent = '$' + sel.dataset.symbol;
                document.getElementById('poolModalIcon').textContent = (sel.dataset.symbol || '?')[0];
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
            }
        };
    } catch (e) {
        loading.textContent = 'Failed to load tokens.';
    }
}

function parsePoolDeployed(receipt) {
    if (!receipt || !receipt.logs) return null;
    for (var i = 0; i < receipt.logs.length; i++) {
        var log = receipt.logs[i];
        if (log.address && STAKING_FACTORY &&
            log.address.toLowerCase() === STAKING_FACTORY.toLowerCase() &&
            log.topics && log.topics.length >= 2) {
            return '0x' + log.topics[1].slice(26);
        }
    }
    return null;
}

async function handlePoolModalDeploy() {
    if (poolModalDeploying) return;

    var select = document.getElementById('poolModalSelect');
    var tokenAddress = select ? select.value : '';
    var desc = document.getElementById('poolModalDesc').value.trim();
    var tokenName = document.getElementById('poolModalTokenName').textContent;
    var tokenSymbol = document.getElementById('poolModalTokenSymbol').textContent.replace('$', '');

    if (!tokenAddress || tokenAddress.length !== 42) { stakeToast('Select a token first', 'error'); return; }
    if (!tokenName || tokenName === '--') { stakeToast('Select a token first', 'error'); return; }

    var provider = getProvider();
    if (!provider || !walletAddr) { stakeToast('Connect wallet first', 'error'); return; }

    poolModalDeploying = true;
    var btn = document.getElementById('poolModalDeployBtn');
    var status = document.getElementById('poolModalStatus');
    btn.disabled = true;
    btn.textContent = 'Deploying staking pool...';
    status.textContent = 'Confirm in wallet...';

    try {
        // Switch to Base
        try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
                });
            }
        }

        // Deploy
        var deployData = DEPLOY_PAID_SEL + pad32(tokenAddress) + pad32(CLAWS_ADDR);
        var txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddr, to: STAKING_FACTORY, data: deployData }]
        });

        status.textContent = 'Confirming transaction...';

        // Wait for receipt
        var receipt = null;
        for (var i = 0; i < 90; i++) {
            await new Promise(function(r) { setTimeout(r, 2000); });
            receipt = await provider.request({
                method: 'eth_getTransactionReceipt', params: [txHash]
            });
            if (receipt) {
                if (receipt.status !== '0x1') throw new Error('Transaction reverted');
                break;
            }
        }
        if (!receipt) throw new Error('Transaction timed out');

        var stakingPool = parsePoolDeployed(receipt);
        if (!stakingPool) throw new Error('Could not find staking pool address in receipt');

        status.textContent = 'Linking staking pool...';

        // Register via API
        var existingProject = poolModalTokensCache ? poolModalTokensCache.find(function(p) { return p.token_address === tokenAddress; }) : null;
        if (existingProject && existingProject.id) {
            await fetch('/api/inclawbate/inclawbator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update-staking',
                    project_id: existingProject.id,
                    staking_address: stakingPool,
                    staking_deploy_tx: txHash
                })
            });
        } else {
            var regResp = await fetch('/api/inclawbate/inclawbator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register',
                    token_address: tokenAddress,
                    token_name: tokenName,
                    token_symbol: tokenSymbol,
                    description: desc,
                    fee_split_bps: 10000,
                    tier: 'partner',
                    creator_wallet: walletAddr
                })
            });
            var regData = await regResp.json();
            if (regData.project) {
                await fetch('/api/inclawbate/inclawbator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update-staking',
                        project_id: regData.project.id,
                        staking_address: stakingPool,
                        staking_deploy_tx: txHash
                    })
                });
            }
        }

        poolModalDeploying = false;
        closePoolModal();
        stakeToast('Staking pool deployed!', 'success');

        // Refresh pools data
        try {
            var resp = await fetch('/api/inclawbate/inclawbator');
            if (resp.ok) {
                var freshData = await resp.json();
                (freshData.projects || []).forEach(function(p) {
                    if (!p.staking_address || !p.token_address) return;
                    var key = p.token_symbol.toLowerCase();
                    if (POOLS[key]) return;
                    POOLS[key] = {
                        name: p.token_name, ticker: p.token_symbol, token: p.token_address,
                        rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808', rewardTicker: 'CLAWS',
                        staking: p.staking_address, decimals: 18, logo: p.logo_url || '',
                        color: p.color || 'hsl(172, 32%, 48%)', colorDim: p.color_dim || 'hsla(172, 32%, 48%, 0.12)',
                        glow: p.glow || 'hsla(172, 32%, 48%, 0.18)', description: p.description || '',
                        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base',
                        chartLink: 'https://dexscreener.com/base/' + p.token_address,
                        featured: false, category: 'inclawbator', dynamic: true
                    };
                });
                POOL_KEYS = Object.keys(POOLS);
            }
        } catch (e) {}

        await fetchAllPoolStats().catch(function() {});
        renderOverview();

    } catch (e) {
        poolModalDeploying = false;
        btn.disabled = false;
        btn.textContent = 'Deploy Pool';
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            status.textContent = 'Transaction rejected';
        } else {
            status.textContent = 'Deploy failed: ' + (e.message || 'Unknown error');
        }
    }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

async function init() {
    // Load dynamic Inclawbator pools from API
    try {
        var resp = await fetch('/api/inclawbate/inclawbator');
        if (resp.ok) {
            var data = await resp.json();
            (data.projects || []).forEach(function(p) {
                if (!p.staking_address || !p.token_address) return;
                var key = p.token_symbol.toLowerCase();
                if (POOLS[key]) return; // don't overwrite hardcoded pools
                POOLS[key] = {
                    name: p.token_name,
                    ticker: p.token_symbol,
                    token: p.token_address,
                    rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
                    rewardTicker: 'CLAWS',
                    staking: p.staking_address,
                    decimals: 18,
                    logo: p.logo_url || '',
                    color: p.color || 'hsl(172, 32%, 48%)',
                    colorDim: p.color_dim || 'hsla(172, 32%, 48%, 0.12)',
                    glow: p.glow || 'hsla(172, 32%, 48%, 0.18)',
                    description: p.description || '',
                    buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base',
                    chartLink: 'https://dexscreener.com/base/' + p.token_address,
                    featured: false,
                    category: 'inclawbator',
                    dynamic: true
                };
            });
            POOL_KEYS = Object.keys(POOLS);
        }
    } catch (e) { /* Inclawbator API unavailable, proceed with hardcoded pools */ }

    wirePoolEvents();

    // Filter tabs
    document.querySelectorAll('#stakeFilters .lp-filter-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#stakeFilters .lp-filter-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            renderOverview();
        });
    });
    // Sort dropdown
    var sortSelect = document.getElementById('stakeSort');
    if (sortSelect) sortSelect.addEventListener('change', function() { renderOverview(); });

    // Pool creation modal
    var poolModalBtn = document.getElementById('openPoolModalBtn');
    if (poolModalBtn) poolModalBtn.addEventListener('click', openPoolModal);
    var poolModalCloseBtn = document.getElementById('poolModalClose');
    if (poolModalCloseBtn) poolModalCloseBtn.addEventListener('click', closePoolModal);
    var poolModalOverlay = document.getElementById('poolModalOverlay');
    if (poolModalOverlay) poolModalOverlay.addEventListener('click', function(e) {
        if (e.target === poolModalOverlay) closePoolModal();
    });
    var poolModalDeployBtn = document.getElementById('poolModalDeployBtn');
    if (poolModalDeployBtn) poolModalDeployBtn.addEventListener('click', handlePoolModalDeploy);

    // Listen for popstate
    window.addEventListener('popstate', routeApp);

    // Listen for WalletKit connect
    if (window.WalletKit) {
        window.WalletKit.on('connect', function(info) {
            if (info && info.address) {
                walletAddr = info.address;
                try { localStorage.setItem('_stake_wallet', info.address); } catch (e) {}
                if (currentPoolKey && POOLS[currentPoolKey]) {
                    onPoolWalletConnected(info.address, POOLS[currentPoolKey], currentPoolKey);
                }
            }
        });
    }

    // Auto-reconnect saved wallet (wait for late-loading wallets)
    if (!window.ethereum && window._awaitProvider) await window._awaitProvider();
    try {
        var saved = localStorage.getItem('_stake_wallet');
        if (saved && window.ethereum) {
            var accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === saved.toLowerCase()) {
                walletAddr = accounts[0];
            }
        }
    } catch (e) {}

    // Fetch prices + stats in parallel, then route
    await Promise.all([fetchAllPrices(), fetchAllPoolStats()]).catch(function() {});
    routeApp();

    // Refresh stats every 60s
    setInterval(function() {
        fetchAllPoolStats().then(function() {
            // If on overview, re-render
            if (getCurrentPool() === null) renderOverview();
        });
    }, 60000);

    // Refresh prices every 5 min
    setInterval(fetchAllPrices, 300000);
}

init();

})();
