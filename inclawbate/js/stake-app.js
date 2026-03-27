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
        rewardTicker: 'INCLAWNCH',
        staking: '0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D',
        decimals: 18,
        logo: '/salvation4humanity/assets/s4hlogo.png',
        color: 'hsl(35, 38%, 38%)',
        colorDim: 'hsla(35, 38%, 38%, 0.12)',
        glow: 'hsla(35, 38%, 38%, 0.18)',
        description: 'AI-powered online church community. Stake S4H, earn INCLAWNCH rewards.',
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
    },
    pokerai: {
        name: 'PokerAI',
        ticker: 'POKERAI',
        token: '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07',
        rewardToken: '0x7ca47B141639B893C6782823C0b219f872056379',
        rewardTicker: 'CLAWS',
        staking: 'DEPLOY_ADDRESS_HERE',
        decimals: 18,
        logo: '/inclawbate/assets/pokerai-logo.png',
        color: 'hsl(263, 70%, 58%)',
        colorDim: 'hsla(263, 70%, 58%, 0.12)',
        glow: 'hsla(263, 70%, 58%, 0.18)',
        description: 'Stake POKERAI, earn CLAWS rewards. Play poker. Get rewarded.',
        website: 'https://pokerai.app',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07&chain=base',
        chartLink: 'https://dexscreener.com/base/0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07',
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
function safeBigInt(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0n;
    try { return BigInt(hex); } catch (e) { return 0n; }
}
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    try { return Number(BigInt(hex)) / 1e18; } catch (e) { return 0; }
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
    'https://base-mainnet.public.blastapi.io',
    'https://base.meowrpc.com',
    'https://base-rpc.publicnode.com'
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

function safeHex(val) { return (!val || val === '0x') ? '0x0' : val; }

async function contractRead(to, data) {
    var json = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: to, data: data }, 'latest'] });
    return safeHex(json && json.result);
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
    return json.map(function(r) { return safeHex(r.result); });
}

async function sendTxAndWait(provider, from, to, data, statusEl, statusMsg) {
    try {
        await Promise.race([
            provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] }),
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('switch_timeout')); }, 10000);
            })
        ]);
    } catch (switchErr) {
        if (switchErr.code === 4902) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
            });
        } else if (switchErr.message === 'switch_timeout') {
            throw new Error('Wallet not responding. Please disconnect and reconnect.');
        }
        // Ignore other switch errors — wallet may not support it or is already on Base
    }
    if (statusEl && statusMsg) {
        statusEl.textContent = statusMsg;
        statusEl.className = 'pool-status';
    }
    var txHash;
    try {
        txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: from, to: to, data: data }]
        });
    } catch (txErr) {
        // Detect stale WalletConnect session errors
        var errMsg = (txErr.message || '').toLowerCase();
        if (errMsg.indexOf('session') !== -1 || errMsg.indexOf('disconnect') !== -1 ||
            errMsg.indexOf('no matching key') !== -1 || errMsg.indexOf('expired') !== -1) {
            throw new Error('Wallet session expired. Please disconnect and reconnect.');
        }
        throw txErr;
    }
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

function stakeToast(msg, type, duration) {
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
    }, duration || 4000);
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

    // Batch DexScreener requests in groups of 5 to avoid rate limiting
    var results = [];
    for (var batch = 0; batch < tokenAddrs.length; batch += 5) {
        var chunk = tokenAddrs.slice(batch, batch + 5);
        var batchResults = await Promise.all(chunk.map(function(addr) {
            return fetch('https://api.dexscreener.com/latest/dex/tokens/' + addr)
                .then(function(r) { return r.json(); }).catch(function() { return null; });
        }));
        results = results.concat(batchResults);
        if (batch + 5 < tokenAddrs.length) await new Promise(function(r) { setTimeout(r, 500); });
    }

    // Build address → price lookup
    var addrPrices = {};
    for (var i = 0; i < tokenAddrs.length; i++) {
        addrPrices[tokenAddrs[i].toLowerCase()] = bestPrice(results[i], tokenAddrs[i]);
    }

    // Skip GeckoTerminal fallback — causes CORS + rate limit issues with many pools

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
        var stakerCount = Number(safeBigInt(results[base + 1]));
        var rewardRate = fromWei(results[base + 2]);
        var periodEnd = Number(safeBigInt(results[base + 3]));
        var rewardPool = fromWei(results[base + 4]);
        var apy = 0;
        var now = Math.floor(Date.now() / 1000);
        if (totalStaked > 0 && rewardRate > 0 && rewardPool > 0 && periodEnd > now) {
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
    var earnTicker = pool.rewardTicker || pool.ticker;
    var earnTag = pool.retired ? '' : '<span class="stk-earn-tag">Earn $' + earnTicker + '</span>';

    return { tvl: tvl, apy: apy, stakers: stakers, html:
        '<tr class="stk-row' + rowClass + '" data-key="' + key + '" style="border-left-color:' + pool.color + '">' +
            '<td><span class="stk-rank">' + rank + '</span></td>' +
            '<td><div class="stk-name-cell">' + logoHtml +
                '<div class="stk-name-wrap"><span class="stk-name">' + pool.name + '<span class="stk-symbol">$' + pool.ticker + '</span>' + retiredBadge + '</span>' + earnTag + '</div>' +
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
            '<div class="stk-name-wrap"><span class="stk-name">' + pool.name + '<span class="stk-symbol">$' + pool.ticker + '</span>' +
            '<span class="stk-badge stk-badge--coming">Coming Soon</span></span></div>' +
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

    // Read current sort
    var activeFilter = 'all';
    var activeOpt = document.querySelector('#stakeSortDropdown .stake-sort-option.active');
    var sortBy = activeOpt ? activeOpt.dataset.sort : 'tvl';

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

    // Wire row click handlers (inline expand)
    container.querySelectorAll('.stk-row').forEach(function(row) {
        row.addEventListener('click', function(e) {
            if (e.target.closest('.stk-action-btn')) e.preventDefault();
            var key = row.dataset.key;
            if (row.classList.contains('expanded')) {
                collapseAnyRow();
                history.pushState(null, '', '/stake');
                document.title = 'Stake \u2014 Inclawbate';
            } else {
                history.pushState(null, '', '/stake/' + key);
                expandRow(key);
                document.title = POOLS[key].name + ' Staking \u2014 Inclawbate';
            }
        });
    });
}

// ══════════════════════════════════════
// INLINE EXPAND / COLLAPSE
// ══════════════════════════════════════

function expandRow(key) {
    var pool = POOLS[key];
    if (!pool) return;
    var row = document.querySelector('.stk-row[data-key="' + key + '"]');
    if (!row) return;

    collapseAnyRow(); // close any other expansion

    // Create expansion row after the clicked row
    var expRow = document.createElement('tr');
    expRow.className = 'stk-expand-row';
    expRow.innerHTML = '<td colspan="6"><div class="stk-expand-cell"></div></td>';
    row.after(expRow);
    row.classList.add('expanded');

    // Move #stakePool into the expansion cell
    var poolEl = document.getElementById('stakePool');
    expRow.querySelector('.stk-expand-cell').appendChild(poolEl);
    poolEl.classList.add('visible');

    // Hide back link and powered footer (not needed inline)
    document.getElementById('poolBack').style.display = 'none';
    var powered = document.querySelector('.pool-powered');
    if (powered) powered.style.display = 'none';

    // Render pool content using existing function
    renderPoolPage(pool, key);

    // Scroll into view
    expRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function collapseAnyRow() {
    var expRow = document.querySelector('.stk-expand-row');
    if (!expRow) return;

    var poolEl = document.getElementById('stakePool');
    poolEl.classList.remove('visible');
    // Move back to original parent
    document.querySelector('.stake-page').appendChild(poolEl);

    // Restore hidden elements
    document.getElementById('poolBack').style.display = '';
    var powered = document.querySelector('.pool-powered');
    if (powered) powered.style.display = '';

    var expandedRow = document.querySelector('.stk-row.expanded');
    if (expandedRow) expandedRow.classList.remove('expanded');
    expRow.remove();
    currentPoolKey = null;
}

// ══════════════════════════════════════
// POOL PAGE RENDERING
// ══════════════════════════════════════

var currentPoolKey = null;
var walletAddr = null;
var walletBalance = 0;

window.addTokenToWallet = async function(address, symbol, decimals, image) {
    var provider = window.ethereum || (window.phantom && window.phantom.ethereum) || (window.WalletKit && window.WalletKit.getProvider());
    if (!provider) { alert('No wallet detected. Please install MetaMask or another wallet.'); return; }
    try {
        await provider.request({
            method: 'wallet_watchAsset',
            params: { type: 'ERC20', options: {
                address: address,
                symbol: symbol,
                decimals: decimals || 18,
                image: image || ''
            }}
        });
    } catch (e) { console.log('User rejected or error:', e); }
};

// Legacy alias
window.addClawsToWallet = function() {
    window.addTokenToWallet('0x7ca47B141639B893C6782823C0b219f872056379', 'CLAWS', 18, 'https://inclawbate.app/inclawbate/assets/clawslogo.jpg');
};

var _connectedProvider = null; // stores the provider used during successful connection

function getProvider() {
    // Always prefer the provider that was actually used to connect
    if (_connectedProvider) return _connectedProvider;
    // Privy embedded wallet provider (set by connectPoolWallet)
    if (window._privyProvider) return window._privyProvider;
    // WalletKit — ONLY if actively connected (stale providers cause "no wallet" errors)
    if (window.WalletKit && window.WalletKit.isConnected()) {
        return window.WalletKit.getProvider();
    }
    return window.ethereum || (window.phantom && window.phantom.ethereum) || null;
}

// Validate provider can actually sign transactions
async function ensureProvider() {
    var provider = getProvider();
    if (!provider) {
        stakeToast('No wallet connected. Please connect your wallet.', 'error');
        return null;
    }
    // WalletConnect providers don't reliably respond to eth_accounts —
    // they can return empty even on a valid session. If WalletKit has
    // an address, trust it and let transaction-level timeouts catch
    // truly broken sessions.
    if (window.WalletKit && window.WalletKit.isConnected()) {
        return provider;
    }
    // For browser extensions, validate with eth_accounts
    try {
        var accounts = await Promise.race([
            provider.request({ method: 'eth_accounts' }),
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('timeout')); }, 5000);
            })
        ]);
        if (!accounts || accounts.length === 0) {
            stakeToast('No wallet connected. Please connect your wallet.', 'error');
            return null;
        }
    } catch (e) {
        stakeToast('Wallet connection error. Please reconnect.', 'error');
        return null;
    }
    return provider;
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
    // Copy CA button
    if (pool.token) {
        linksHtml += '<button class="pool-link pool-link--copy" data-ca="' + pool.token + '">Copy CA</button>';
    }
    // Add token to wallet button
    if (pool.token) {
        var logoUrl = pool.logo ? (pool.logo.startsWith('http') ? pool.logo : 'https://inclawbate.app' + pool.logo) : '';
        linksHtml += '<button onclick="addTokenToWallet(\'' + pool.token + '\',\'' + pool.ticker + '\',18,\'' + logoUrl + '\')" class="pool-link pool-link--wallet">&#128176; Add $' + pool.ticker + ' to Wallet</button>';
    }
    document.getElementById('poolLinks').innerHTML = linksHtml;

    // Copy CA click handler
    var copyBtn = document.querySelector('.pool-link--copy');
    if (copyBtn) copyBtn.addEventListener('click', function() {
        var ca = this.getAttribute('data-ca');
        navigator.clipboard.writeText(ca).then(function() {
            copyBtn.textContent = 'Copied!';
            setTimeout(function() { copyBtn.textContent = 'Copy CA'; }, 1500);
        });
    });

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

    // Check if WalletKit already has an address (WalletConnect session)
    if (window.WalletKit) {
        var wkAddr = window.WalletKit.getAddress();
        var wkProvider = window.WalletKit.getProvider();
        if (wkAddr && wkProvider) {
            walletAddr = wkAddr;
            _connectedProvider = wkProvider;
            try { localStorage.setItem('_stake_wallet', wkAddr); } catch (e) {}
            if (currentPoolKey && POOLS[currentPoolKey]) {
                onPoolWalletConnected(wkAddr, POOLS[currentPoolKey], currentPoolKey);
            }
            return wkAddr;
        }
    }

    // Try Privy embedded wallet first (email/OAuth login users)
    if (window.PrivyAuth && window.PrivyAuth.getEthereumProvider) {
        try {
            var privyProvider = await window.PrivyAuth.getEthereumProvider();
            if (privyProvider && typeof privyProvider.request === 'function') {
                window._privyProvider = privyProvider;
                _connectedProvider = privyProvider;
                var privyAccounts = await privyProvider.request({ method: 'eth_accounts' });
                if (privyAccounts && privyAccounts.length > 0) {
                    walletAddr = privyAccounts[0];
                    try { localStorage.setItem('_stake_wallet', walletAddr); } catch (e) {}
                    if (currentPoolKey && POOLS[currentPoolKey]) {
                        onPoolWalletConnected(walletAddr, POOLS[currentPoolKey], currentPoolKey);
                    }
                    return walletAddr;
                }
            }
        } catch (privyErr) {
            console.log('[Stake] Privy provider fallthrough:', privyErr.message);
        }
    }

    // Wait for late-loading wallets (Base Wallet EIP-6963)
    if (!window.ethereum && window._awaitProvider) await window._awaitProvider();

    var eth = null;
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var providers = window._eip6963Providers || [];

    // Mobile inside wallet browser: auto-connect the injected provider directly.
    // Showing the selector here is wrong — it shows deep links/install links for wallets
    // the user is already inside. The 0-balance toast below handles wrong-account cases.
    if (isMobile && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (!isMobile && providers.length === 1) {
        eth = providers[0].provider;
    } else if (!isMobile && providers.length === 0 && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (window.showWalletSelector) {
        var selected = await window.showWalletSelector();
        if (selected && selected.provider) eth = selected.provider;
        else if (selected && selected.address) {
            // Privy email/OAuth login — address only, no provider needed for connect
            walletAddr = selected.address;
            try { localStorage.setItem('_stake_wallet', selected.address); } catch (e) {}
            if (currentPoolKey && POOLS[currentPoolKey]) {
                onPoolWalletConnected(selected.address, POOLS[currentPoolKey], currentPoolKey);
            }
            return selected.address;
        }
    }

    // Last resort: open WalletKit modal if no provider found
    if (!eth && window.WalletKit) {
        window.WalletKit.open();
        return null;
    }

    if (!eth || typeof eth.request !== 'function') return null;

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
        _connectedProvider = eth; // remember which provider actually worked
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
    _connectedProvider = null;
    try { localStorage.removeItem('_stake_wallet'); } catch (e) {}
    // Always try to disconnect WalletKit — isConnected() can be stale
    if (window.WalletKit) {
        try { window.WalletKit.disconnect(); } catch (e) {}
    }

    var btn = document.getElementById('poolConnectBtn');
    if (btn) {
        btn.textContent = 'Connect Wallet';
        btn.classList.remove('connected');
    }
    var stakeSection = document.getElementById('poolStakeSection');
    var posSection = document.getElementById('poolPositionSection');
    if (stakeSection) stakeSection.classList.remove('visible');
    if (posSection) posSection.classList.remove('visible');
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

    // Hint if wallet has zero balance + zero staked (likely wrong account connected)
    if (walletBalance === 0 && stakedAmount === 0 && earnedAmount === 0) {
        stakeToast('0 ' + pool.ticker + ' found. Wrong wallet? Switch your active account in your wallet app settings, then reconnect.', 'info', 8000);
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
    var stakerCount = Number(safeBigInt(results[1]));
    var rewardRate = fromWei(results[2]);
    var rewardPool = fromWei(results[4]);
    var nowSec = Math.floor(Date.now() / 1000);
    var periodEndVal = Number(safeBigInt(results[3]));
    var rawApy = totalStaked > 0 && rewardRate > 0 && rewardPool > 0 && periodEndVal > nowSec ? (rewardRate * 86400 * 365 / totalStaked) * 100 : 0;
    var apy = rawApy;
    if (rawApy > 0 && POOLS[key].rewardToken && poolPrices[key] > 0 && poolPrices[key + '_reward'] > 0) {
        apy = rawApy * (poolPrices[key + '_reward'] / poolPrices[key]);
    }

    poolStats[key] = { totalStaked: totalStaked, stakerCount: stakerCount, rewardRate: rewardRate, periodEnd: Number(safeBigInt(results[3])), rewardPool: rewardPool, apy: apy };

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
    if (!currentPoolKey) return;
    if (!walletAddr) { stakeToast('Please connect your wallet first.', 'error'); return; }
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

    var provider = await ensureProvider();
    if (!provider) {
        status.textContent = 'Wallet session expired. Please reconnect.';
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
        var currentAllowance = safeBigInt(allowanceRes);

        // Approve if needed
        if (currentAllowance < amountWei) {
            status.textContent = 'Requesting token approval...';
            var approveData = SEL.approve + pad32(pool.staking) + pad32(MAX_UINT256);
            await sendTxAndWait(provider, walletAddr, pool.token, approveData, status, 'Approving contract...');

            // Wait for RPC nodes to propagate the new allowance before staking
            status.textContent = 'Approval confirmed. Preparing stake...';
            for (var retries = 0; retries < 10; retries++) {
                await new Promise(function(r) { setTimeout(r, 2000); });
                var newAllowance = safeBigInt(await contractRead(pool.token, SEL.allowance + pad32(walletAddr) + pad32(pool.staking)));
                if (newAllowance >= amountWei) break;
            }
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
    if (!currentPoolKey) return;
    if (!walletAddr) { stakeToast('Please connect your wallet first.', 'error'); return; }
    var pool = POOLS[currentPoolKey];
    var provider = await ensureProvider();
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
    if (!currentPoolKey) return;
    if (!walletAddr) { stakeToast('Please connect your wallet first.', 'error'); return; }
    var pool = POOLS[currentPoolKey];
    var provider = await ensureProvider();
    if (!provider) return;

    var addrPadded = pad32(walletAddr);
    var [balRes, earnedRes] = await contractReadBatch([
        { to: pool.staking, data: SEL.balanceOf + addrPadded },
        { to: pool.staking, data: SEL.earned + addrPadded },
    ]);
    var stakedAmount = fromWei(balRes);
    var earnedAmount = fromWei(earnedRes);

    if (safeBigInt(balRes) === 0n) {
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
        var selected = await window.showWalletSelector();
        if (selected && selected.provider) eth = selected.provider;
    }

    if (!eth || typeof eth.request !== 'function') return;

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
    var periodEnd = Number(safeBigInt(results[1]));
    var rewardsLeft = fromWei(results[2]);
    var totalDeposited = fromWei(results[3]);
    var totalClaimed = fromWei(results[4]);
    var isPaused = safeBigInt(results[5]) !== 0n;

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
        var currentAllowance = safeBigInt(allowanceRes);

        if (currentAllowance < amountWei) {
            status.textContent = 'Requesting token approval...';
            var approveData = SEL.approve + pad32(pool.staking) + pad32(MAX_UINT256);
            await sendTxAndWait(provider, walletAddr, depositTokenAddr, approveData, status, 'Approving contract...');

            // Wait for RPC nodes to propagate the new allowance
            status.textContent = 'Approval confirmed. Preparing deposit...';
            for (var retries = 0; retries < 10; retries++) {
                await new Promise(function(r) { setTimeout(r, 2000); });
                var newAllowance = safeBigInt(await contractRead(depositTokenAddr, SEL.allowance + pad32(walletAddr) + pad32(pool.staking)));
                if (newAllowance >= amountWei) break;
            }
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
        collapseAnyRow();
        history.pushState(null, '', '/stake');
        document.title = 'Stake \u2014 Inclawbate';
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

    notFoundEl.style.display = 'none';
    adminEl.classList.remove('visible');

    var pool = getCurrentPool();

    if (pool === null) {
        // Overview
        overviewEl.style.display = '';
        poolEl.classList.remove('visible');
        collapseAnyRow();
        renderOverview();
        document.title = 'Stake \u2014 Inclawbate';
    } else if (pool === 'not_found') {
        overviewEl.style.display = 'none';
        poolEl.classList.remove('visible');
        collapseAnyRow();
        notFoundEl.style.display = '';
        document.title = 'Pool Not Found \u2014 Inclawbate';
    } else if (typeof pool === 'string' && pool.indexOf('admin:') === 0) {
        // Admin panel — full page
        overviewEl.style.display = 'none';
        poolEl.classList.remove('visible');
        collapseAnyRow();
        var key = pool.split(':')[1];
        adminEl.classList.add('visible');
        renderAdminPage(POOLS[key], key);
        document.title = POOLS[key].name + ' Admin \u2014 Inclawbate';
    } else {
        // Individual pool — inline expand
        var key = window.location.pathname.split('/')[2].toLowerCase();
        overviewEl.style.display = '';
        poolEl.classList.remove('visible');
        renderOverview();
        expandRow(key);
        document.title = pool.name + ' Staking \u2014 Inclawbate';
    }
}

// ══════════════════════════════════════
// POOL CREATION MODAL
// ══════════════════════════════════════

var poolModalDeploying = false;
var poolModalResolvedToken = null; // { address, name, symbol, decimals }
var poolModalLookupTimer = null;

function openPoolModal() {
    var overlay = document.getElementById('poolModalOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    // Reset state
    document.getElementById('poolModalTokenAddr').value = '';
    document.getElementById('poolModalDesc').value = '';
    document.getElementById('poolModalStatus').textContent = '';
    document.getElementById('poolModalPreview').classList.add('hidden');
    document.getElementById('poolModalWarning').classList.add('hidden');
    document.getElementById('poolModalDeployBtn').disabled = true;
    document.getElementById('poolModalDeployBtn').textContent = 'Deploy Pool';
    var ts = document.getElementById('poolModalTokenStatus');
    ts.textContent = '';
    ts.className = 'pool-modal-token-status';
    poolModalResolvedToken = null;
}

function closePoolModal() {
    var overlay = document.getElementById('poolModalOverlay');
    if (overlay) overlay.classList.remove('visible');
}

function onPoolModalAddrInput() {
    var input = document.getElementById('poolModalTokenAddr');
    var addr = input.value.trim();
    var ts = document.getElementById('poolModalTokenStatus');
    var preview = document.getElementById('poolModalPreview');
    var warning = document.getElementById('poolModalWarning');
    var deployBtn = document.getElementById('poolModalDeployBtn');

    poolModalResolvedToken = null;
    deployBtn.disabled = true;
    preview.classList.add('hidden');
    warning.classList.add('hidden');

    if (poolModalLookupTimer) clearTimeout(poolModalLookupTimer);

    if (!addr || addr.length < 42 || !addr.match(/^0x[0-9a-fA-F]{40}$/)) {
        ts.textContent = addr.length > 0 ? 'Enter a valid 0x... contract address' : '';
        ts.className = 'pool-modal-token-status' + (addr.length > 0 ? ' error' : '');
        return;
    }

    ts.textContent = 'Looking up token...';
    ts.className = 'pool-modal-token-status loading';

    // Debounce the lookup
    poolModalLookupTimer = setTimeout(function() { lookupToken(addr); }, 400);
}

async function lookupToken(addr) {
    var ts = document.getElementById('poolModalTokenStatus');
    var preview = document.getElementById('poolModalPreview');
    var warning = document.getElementById('poolModalWarning');
    var deployBtn = document.getElementById('poolModalDeployBtn');

    try {
        // Call name(), symbol(), decimals() on the token contract
        var nameRes = await contractRead(addr, '0x06fdde03'); // name()
        var symbolRes = await contractRead(addr, '0x95d89b41'); // symbol()
        var decimalsRes = await contractRead(addr, '0x313ce567'); // decimals()

        if (!nameRes || nameRes === '0x' || !symbolRes || symbolRes === '0x') {
            ts.textContent = 'Not a valid ERC20 token';
            ts.className = 'pool-modal-token-status error';
            return;
        }

        var name = decodeString(nameRes);
        var symbol = decodeString(symbolRes);
        var decimals = parseInt(decimalsRes, 16) || 18;

        if (!name || !symbol) {
            ts.textContent = 'Could not read token name/symbol';
            ts.className = 'pool-modal-token-status error';
            return;
        }

        poolModalResolvedToken = { address: addr, name: name, symbol: symbol, decimals: decimals };

        // Show preview
        document.getElementById('poolModalTokenName').textContent = name;
        document.getElementById('poolModalTokenSymbol').textContent = '$' + symbol;
        document.getElementById('poolModalIcon').textContent = symbol[0];
        preview.classList.remove('hidden');
        ts.textContent = 'Token found on Base';
        ts.className = 'pool-modal-token-status success';
        deployBtn.disabled = false;

        // Check if a pool already exists for this token
        var existingPool = null;
        for (var k in POOLS) {
            if (POOLS[k].token && POOLS[k].token.toLowerCase() === addr.toLowerCase()) {
                existingPool = POOLS[k];
                break;
            }
        }
        if (existingPool) {
            warning.textContent = 'A staking pool already exists for ' + existingPool.ticker + '. Deploying another will create a separate pool.';
            warning.classList.remove('hidden');
        }
    } catch (e) {
        ts.textContent = 'Could not read token — check the address';
        ts.className = 'pool-modal-token-status error';
    }
}

// Decode ABI-encoded string (name/symbol return)
function decodeString(hex) {
    if (!hex || hex === '0x' || hex.length < 66) return '';
    try {
        // Standard ABI: offset at 0x20, length at 0x40, data at 0x60
        var stripped = hex.replace('0x', '');
        var offset = parseInt(stripped.slice(0, 64), 16) * 2;
        var len = parseInt(stripped.slice(offset, offset + 64), 16);
        var data = stripped.slice(offset + 64, offset + 64 + len * 2);
        var result = '';
        for (var i = 0; i < data.length; i += 2) {
            var code = parseInt(data.slice(i, i + 2), 16);
            if (code === 0) break;
            result += String.fromCharCode(code);
        }
        return result;
    } catch (e) { return ''; }
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

    if (!poolModalResolvedToken) { stakeToast('Enter a valid token address first', 'error'); return; }
    var tokenAddress = poolModalResolvedToken.address;
    var tokenName = poolModalResolvedToken.name;
    var tokenSymbol = poolModalResolvedToken.symbol;
    var desc = document.getElementById('poolModalDesc').value.trim();

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

        // Register via API — register token + link staking pool
        try {
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
            var projectId = regData.project ? regData.project.id : null;
            if (projectId) {
                await fetch('/api/inclawbate/inclawbator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update-staking',
                        project_id: projectId,
                        staking_address: stakingPool,
                        staking_deploy_tx: txHash
                    })
                });
            }
        } catch (regErr) { /* Pool deployed successfully even if API registration fails */ }

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
                        rewardToken: CLAWS_ADDR, rewardTicker: 'CLAWS',
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
                // Determine reward token — factory deploys use CLAWS
                var rToken = p.reward_token_address || '0x7ca47B141639B893C6782823C0b219f872056379'; // default CLAWS
                var isSelfReward = p.reward_token_address &&
                    p.reward_token_address.toLowerCase() === p.token_address.toLowerCase();
                var rTicker = p.reward_token_symbol || (isSelfReward ? p.token_symbol : 'CLAWS');

                POOLS[key] = {
                    name: p.token_name,
                    ticker: p.token_symbol,
                    token: p.token_address,
                    rewardToken: rToken,
                    rewardTicker: rTicker,
                    staking: p.staking_address,
                    decimals: 18,
                    logo: p.logo_url || '',
                    color: p.color || 'hsl(172, 32%, 48%)',
                    colorDim: p.color_dim || 'hsla(172, 32%, 48%, 0.12)',
                    glow: p.glow || 'hsla(172, 32%, 48%, 0.18)',
                    description: p.description || '',
                    website: p.website_url || '',
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

    // Sort dropdown (custom)
    var sortBtn = document.getElementById('stakeSortBtn');
    var sortWrap = document.getElementById('stakeSortWrap');
    if (sortBtn && sortWrap) {
        sortBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sortWrap.classList.toggle('open');
        });
        document.addEventListener('click', function() { sortWrap.classList.remove('open'); });
        document.querySelectorAll('#stakeSortDropdown .stake-sort-option').forEach(function(opt) {
            opt.addEventListener('click', function(e) {
                e.stopPropagation();
                document.querySelectorAll('#stakeSortDropdown .stake-sort-option').forEach(function(o) { o.classList.remove('active'); });
                opt.classList.add('active');
                document.getElementById('stakeSortValue').textContent = opt.textContent;
                sortWrap.classList.remove('open');
                collapseAnyRow();
                renderOverview();
            });
        });
    }

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
    var poolModalTokenAddr = document.getElementById('poolModalTokenAddr');
    if (poolModalTokenAddr) poolModalTokenAddr.addEventListener('input', onPoolModalAddrInput);

    // Listen for nav wallet changes (disconnect/reconnect via nav)
    window.addEventListener('navAuthChanged', function(e) {
        var newWallet = e.detail && e.detail.wallet;
        if (newWallet) {
            walletAddr = newWallet;
            try {
                localStorage.setItem('_stake_wallet', newWallet);
                localStorage.setItem('connectedWallet', newWallet);
            } catch (err) {}
            if (currentPoolKey && POOLS[currentPoolKey]) {
                onPoolWalletConnected(newWallet, POOLS[currentPoolKey], currentPoolKey);
            }
        } else {
            disconnectPoolWallet();
        }
    });

    // Listen for account switches on all available providers (MetaMask, Coinbase, etc.)
    function listenAccountChanges(provider) {
        if (provider && typeof provider.on === 'function') {
            provider.on('accountsChanged', function(accounts) {
                if (accounts.length > 0) {
                    walletAddr = accounts[0];
                    _connectedProvider = provider;
                    try {
                        localStorage.setItem('_stake_wallet', walletAddr);
                        localStorage.setItem('connectedWallet', walletAddr);
                    } catch(e) {}
                    if (currentPoolKey && POOLS[currentPoolKey]) {
                        onPoolWalletConnected(walletAddr, POOLS[currentPoolKey], currentPoolKey);
                    }
                    window.dispatchEvent(new CustomEvent('navAuthChanged', { detail: { wallet: walletAddr } }));
                } else {
                    // User disconnected all accounts
                    disconnectPoolWallet();
                }
            });
        }
    }
    // Listen on window.ethereum
    listenAccountChanges(window.ethereum);
    // Also listen on each EIP-6963 discovered provider (catches Coinbase, Base Wallet, etc.)
    (window._eip6963Providers || []).forEach(function(p) {
        if (p.provider !== window.ethereum) listenAccountChanges(p.provider);
    });

    // Listen for popstate
    window.addEventListener('popstate', routeApp);

    // Listen for WalletKit connect
    if (window.WalletKit) {
        window.WalletKit.onConnect(function(address) {
            if (address) {
                walletAddr = address;
                try { localStorage.setItem('_stake_wallet', address); } catch (e) {}
                if (currentPoolKey && POOLS[currentPoolKey]) {
                    onPoolWalletConnected(address, POOLS[currentPoolKey], currentPoolKey);
                }
            }
        });
    }

    // Auto-reconnect saved wallet (wait for late-loading wallets)
    if (!window.ethereum && window._awaitProvider) await window._awaitProvider();
    try {
        // Try WalletKit first — only if isConnected() confirms a live session.
        // Don't use getAddress() alone — it returns a cached address even after
        // the WalletConnect relay session has expired (e.g. after PC restart).
        if (window.WalletKit && window.WalletKit.isConnected()) {
            var wkAddr = window.WalletKit.getAddress();
            if (wkAddr) {
                walletAddr = wkAddr;
                try { localStorage.setItem('_stake_wallet', wkAddr); } catch (e) {}
            }
        }
        // Then try browser extension
        if (!walletAddr) {
            var saved = localStorage.getItem('_stake_wallet');
            if (saved && window.ethereum) {
                var accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === saved.toLowerCase()) {
                    walletAddr = accounts[0];
                }
            }
        }
    } catch (e) {}

    // Fetch pool stats first (needed for rendering), then route
    await fetchAllPoolStats().catch(function() {});
    routeApp();

    // Fetch prices in background (non-blocking)
    fetchAllPrices().then(function() {
        if (getCurrentPool() === null) renderOverview();
    }).catch(function() {});

    // Delayed WalletKit check — Reown's subscribeProvider can fire after init
    // Gate on isConnected() to avoid using cached addresses from dead sessions
    if (!walletAddr && window.WalletKit) {
        setTimeout(function() {
            if (!window.WalletKit.isConnected()) return;
            var wkAddr = window.WalletKit.getAddress();
            if (wkAddr && !walletAddr) {
                walletAddr = wkAddr;
                try { localStorage.setItem('_stake_wallet', wkAddr); } catch (e) {}
                // If user is on a pool page, show the staking UI
                if (currentPoolKey && POOLS[currentPoolKey]) {
                    onPoolWalletConnected(wkAddr, POOLS[currentPoolKey], currentPoolKey);
                }
            }
        }, 1500);
    }

    // Refresh stats every 60s
    setInterval(function() {
        fetchAllPoolStats().then(function() {
            // If no pool expanded, safe to re-render overview
            if (!document.querySelector('.stk-expand-row')) {
                if (getCurrentPool() === null) {
                    renderOverview();
                }
            }
            // If a pool is expanded inline, refresh its stats
            if (currentPoolKey && POOLS[currentPoolKey] && document.querySelector('.stk-expand-row')) {
                refreshPoolStats(currentPoolKey);
            }
        });
    }, 60000);

    // Refresh prices every 5 min
    setInterval(fetchAllPrices, 300000);
}

init();

})();
