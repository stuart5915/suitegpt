// Inclawbate — Staking-as-a-Service (On-Chain Multi-Pool Staking)

(function() {
'use strict';

// ══════════════════════════════════════
// ADMIN GATE — hide page until admin wallet connects
// ══════════════════════════════════════

var ADMIN_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'  // protocol wallet
];

function isAdmin(addr) {
    return addr && ADMIN_WALLETS.indexOf(addr.toLowerCase()) !== -1;
}

async function tryAdminGate() {
    var gate = document.getElementById('constructionGate');
    var page = document.querySelector('.stake-page');
    if (!gate || !page) return true; // no gate in DOM, skip

    // Auto-check: if wallet already connected and is admin, bypass
    try {
        var saved = localStorage.getItem('_stake_wallet');
        if (saved && window.ethereum) {
            var accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === saved.toLowerCase() && isAdmin(saved)) {
                gate.style.display = 'none';
                page.classList.remove('gated');
                return true;
            }
        }
    } catch (e) {}

    // Wire up the connect button on the gate
    var btn = document.getElementById('constructionConnectBtn');
    var denied = document.getElementById('constructionDenied');

    return new Promise(function(resolve) {
        btn.addEventListener('click', async function() {
            if (!window.ethereum) {
                denied.textContent = 'No wallet found. Install MetaMask.';
                return;
            }
            try {
                btn.textContent = 'Connecting...';
                var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                var addr = accounts[0];
                if (isAdmin(addr)) {
                    gate.style.display = 'none';
                    page.classList.remove('gated');
                    resolve(true);
                } else {
                    btn.textContent = 'Connect Wallet';
                    denied.textContent = 'Access denied. This page is under construction.';
                }
            } catch (err) {
                btn.textContent = 'Connect Wallet';
                denied.textContent = err.code === 4001 ? '' : (err.message || 'Connection failed');
            }
        });
    });
}

// ══════════════════════════════════════
// POOL CONFIG
// ══════════════════════════════════════

var POOLS = {
    inclawnch: {
        name: 'inCLAWNCH',
        ticker: 'INCLAWNCH',
        token: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        staking: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
        decimals: 18,
        logo: '/assets/inclawnch-logo.svg',
        color: 'hsl(172, 32%, 48%)',
        colorDim: 'hsla(172, 32%, 48%, 0.12)',
        glow: 'hsla(172, 32%, 48%, 0.18)',
        description: 'The original. Stake inCLAWNCH, earn inCLAWNCH.',
        buyLink: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0xB0b6e0E9da530f68D713cC03a813B506205aC808&chain=base',
        chartLink: 'https://dexscreener.com/base/0xB0b6e0E9da530f68D713cC03a813B506205aC808',
        featured: true
    }
    // Partners added here as they onboard:
    // cos: { name: 'COS', ticker: 'COS', token: '0x...', staking: '0x...', ... },
};

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
};

var BALANCE_SELECTOR = '0x70a08231';
var BASE_CHAIN_ID = '0x2105';
var MAX_UINT256 = '0x' + 'f'.repeat(64);

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
    'https://base.drpc.org',
    'https://1rpc.io/base',
    'https://base-mainnet.public.blastapi.io',
    'https://mainnet.base.org'
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
    // Deduplicate token addresses across pools
    var tokenAddrs = [];
    var seen = {};
    POOL_KEYS.forEach(function(key) {
        var addr = POOLS[key].token.toLowerCase();
        if (!seen[addr]) {
            seen[addr] = true;
            tokenAddrs.push(POOLS[key].token);
        }
    });

    var promises = tokenAddrs.map(function(addr) {
        return fetch('https://api.dexscreener.com/latest/dex/tokens/' + addr)
            .then(function(r) { return r.json(); }).catch(function() { return null; });
    });

    var results = await Promise.all(promises);

    for (var i = 0; i < tokenAddrs.length; i++) {
        var price = bestPrice(results[i], tokenAddrs[i]);
        // Apply to all pools with this token
        POOL_KEYS.forEach(function(key) {
            if (POOLS[key].token.toLowerCase() === tokenAddrs[i].toLowerCase()) {
                poolPrices[key] = price;
            }
        });
    }
}

// ══════════════════════════════════════
// READ ALL POOL STATS (single batch)
// ══════════════════════════════════════

var poolStats = {}; // key -> { totalStaked, stakerCount, rewardRate, periodEnd, rewardPool }

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
        var totalStaked = fromWei(results[base]);
        var stakerCount = Number(BigInt(results[base + 1] || '0x0'));
        var rewardRate = fromWei(results[base + 2]);
        var periodEnd = Number(BigInt(results[base + 3] || '0x0'));
        var rewardPool = fromWei(results[base + 4]);
        var apy = 0;
        if (totalStaked > 0 && rewardRate > 0) {
            apy = (rewardRate * 86400 * 365 / totalStaked) * 100;
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

function renderOverview() {
    var grid = document.getElementById('stakeGrid');
    var totalTvl = 0;

    // Sort: featured first, then by TVL descending
    var sorted = POOL_KEYS.slice().sort(function(a, b) {
        if (POOLS[a].featured && !POOLS[b].featured) return -1;
        if (!POOLS[a].featured && POOLS[b].featured) return 1;
        var tvlA = (poolStats[a] ? poolStats[a].totalStaked : 0) * (poolPrices[a] || 0);
        var tvlB = (poolStats[b] ? poolStats[b].totalStaked : 0) * (poolPrices[b] || 0);
        return tvlB - tvlA;
    });

    var html = '';
    sorted.forEach(function(key) {
        var pool = POOLS[key];
        var stats = poolStats[key] || {};
        var price = poolPrices[key] || 0;
        var tvl = (stats.totalStaked || 0) * price;
        totalTvl += tvl;

        var apyStr = stats.apy ? Math.round(stats.apy) + '%' : '--';
        var stakedStr = stats.totalStaked ? fmt(stats.totalStaked) : '--';
        var stakersStr = stats.stakerCount !== undefined ? stats.stakerCount.toLocaleString('en-US') : '--';
        var tvlStr = tvl > 0 ? fmtUsd(tvl) : '--';

        html += '<a href="/stake/' + key + '" class="stake-card' + (pool.featured ? ' featured' : '') + '" ' +
            'style="--pool-accent:' + pool.color + ';--pool-accent-dim:' + pool.colorDim + ';--pool-glow:' + pool.glow + '">' +
            '<img class="stake-card-logo" src="' + pool.logo + '" alt="' + pool.name + '" onerror="this.style.display=\'none\'">' +
            '<div class="stake-card-name">' + pool.name + '</div>' +
            '<div class="stake-card-desc">' + pool.description + '</div>' +
            '<div class="stake-card-stats">' +
                '<div class="stake-card-stat">' +
                    '<span class="stake-card-stat-value apy">' + apyStr + '</span>' +
                    '<span class="stake-card-stat-label">APY</span>' +
                '</div>' +
                '<div class="stake-card-stat">' +
                    '<span class="stake-card-stat-value">' + tvlStr + '</span>' +
                    '<span class="stake-card-stat-label">TVL</span>' +
                '</div>' +
                '<div class="stake-card-stat">' +
                    '<span class="stake-card-stat-value">' + stakedStr + '</span>' +
                    '<span class="stake-card-stat-label">Tokens Staked</span>' +
                '</div>' +
                '<div class="stake-card-stat">' +
                    '<span class="stake-card-stat-value">' + stakersStr + '</span>' +
                    '<span class="stake-card-stat-label">Stakers</span>' +
                '</div>' +
            '</div>' +
            '<div class="stake-card-cta">Stake &rarr;</div>' +
        '</a>';
    });

    grid.innerHTML = html;

    // Update header
    document.getElementById('overviewTvl').textContent = totalTvl > 0 ? fmtUsd(totalTvl) : '--';
    document.getElementById('overviewPoolCount').textContent = POOL_KEYS.length + ' pool' + (POOL_KEYS.length !== 1 ? 's' : '');

    // Prevent default link navigation — use pushState
    grid.querySelectorAll('.stake-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            var href = card.getAttribute('href');
            history.pushState(null, '', href);
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

function getProvider() {
    if (window.WalletKit && window.WalletKit.isConnected()) {
        return window.WalletKit.getProvider();
    }
    return window.ethereum || null;
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
    document.getElementById('poolApy').textContent = stats.apy ? Math.round(stats.apy) + '%' : '--';
    document.getElementById('poolTotalStaked').textContent = stats.totalStaked ? fmt(stats.totalStaked) : '--';
    document.getElementById('poolStakers').textContent = stats.stakerCount !== undefined ? stats.stakerCount.toLocaleString('en-US') : '--';
    document.getElementById('poolRewardsLeft').textContent = stats.rewardPool ? fmt(stats.rewardPool) : '--';

    // Links
    var linksHtml = '';
    if (pool.buyLink) {
        linksHtml += '<a href="' + pool.buyLink + '" target="_blank" rel="noopener" class="pool-link">Buy ' + pool.ticker + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    }
    if (pool.chartLink) {
        linksHtml += '<a href="' + pool.chartLink + '" target="_blank" rel="noopener" class="pool-link">Chart <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    }
    linksHtml += '<a href="https://basescan.org/address/' + pool.staking + '" target="_blank" rel="noopener" class="pool-link">Contract <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>';
    document.getElementById('poolLinks').innerHTML = linksHtml;

    // Reset wallet state
    document.getElementById('poolConnectBtn').textContent = 'Connect Wallet';
    document.getElementById('poolConnectBtn').classList.remove('connected');
    document.getElementById('poolStakeSection').classList.remove('visible');
    document.getElementById('poolPositionSection').classList.remove('visible');
    document.getElementById('poolStakeStatus').textContent = '';
    document.getElementById('poolStakeInput').value = '';
    document.getElementById('poolSlider').value = 0;
    document.getElementById('poolHint').textContent = '';

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

    if (window.ethereum) {
        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var addr = accounts[0];
            try {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            } catch (switchErr) {
                if (switchErr.code === 4902) {
                    await window.ethereum.request({
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
            stakeToast(msg, 'error');
            return null;
        }
    }

    if (window.WalletKit) {
        try {
            await window.WalletKit.open();
            return null;
        } catch (err) {}
    }

    var confirmed = await stakeModal({
        icon: '\uD83E\uDD8A',
        title: 'No Wallet Found',
        msg: 'Install a wallet extension like MetaMask or Coinbase Wallet to connect.',
        confirmLabel: 'Get MetaMask',
        cancelLabel: 'Close',
    });
    if (confirmed) window.open('https://metamask.io/download/', '_blank');
    return null;
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

    // Update balance display
    document.getElementById('poolWalletBal').textContent = fmt(walletBalance) + ' ' + pool.ticker;

    // Update position
    if (stakedAmount > 0 || earnedAmount > 0) {
        document.getElementById('poolPositionSection').classList.add('visible');
        var stakedUsd = price > 0 ? ' <span class="usd">(' + fmtUsd(stakedAmount * price) + ')</span>' : '';
        var earnedUsd = price > 0 ? ' <span class="usd">(' + fmtUsd(earnedAmount * price) + ')</span>' : '';
        document.getElementById('posStaked').innerHTML = fmt(stakedAmount) + ' ' + pool.ticker + stakedUsd;
        document.getElementById('posEarned').innerHTML = fmt(earnedAmount) + ' ' + pool.ticker + earnedUsd;
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

    var totalStaked = fromWei(results[0]);
    var stakerCount = Number(BigInt(results[1] || '0x0'));
    var rewardRate = fromWei(results[2]);
    var rewardPool = fromWei(results[4]);
    var apy = totalStaked > 0 && rewardRate > 0 ? (rewardRate * 86400 * 365 / totalStaked) * 100 : 0;

    poolStats[key] = { totalStaked: totalStaked, stakerCount: stakerCount, rewardRate: rewardRate, periodEnd: Number(BigInt(results[3] || '0x0')), rewardPool: rewardPool, apy: apy };

    document.getElementById('poolApy').textContent = apy > 0 ? Math.round(apy) + '%' : '--';
    document.getElementById('poolTotalStaked').textContent = totalStaked > 0 ? fmt(totalStaked) : '--';
    document.getElementById('poolStakers').textContent = stakerCount > 0 ? stakerCount.toLocaleString('en-US') : '--';
    document.getElementById('poolRewardsLeft').textContent = rewardPool > 0 ? fmt(rewardPool) : '--';
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

        // Refresh
        input.value = '';
        document.getElementById('poolSlider').value = 0;
        document.getElementById('poolHint').textContent = '';
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
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
        msg: action + ' ' + fmt(Math.round(earnedAmount)) + ' ' + pool.ticker + (compound ? ' (adds to your staked balance)' : ' (sends to your wallet)') + '?',
        confirmLabel: action,
        confirmClass: 'stake-modal-btn--confirm'
    });
    if (!confirmed) return;

    try {
        var selector = compound ? SEL.claimAndRestake : SEL.claim;
        await sendTxAndWait(provider, walletAddr, pool.staking, selector, null, null);
        stakeToast((compound ? 'Compounded ' : 'Claimed ') + fmt(Math.round(earnedAmount)) + ' ' + pool.ticker, 'success');
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
    } catch (err) {
        stakeToast(err.message || (action + ' failed'), 'error');
    }
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

    try {
        var txHash = await sendTxAndWait(provider, walletAddr, pool.staking, SEL.exit, null, null);
        stakeToast('Unstaked ' + fmt(Math.round(stakedAmount)) + ' ' + pool.ticker + rewardsNote, 'success');
        await fetchPoolUserData(walletAddr, pool, currentPoolKey);
    } catch (err) {
        stakeToast(err.message || 'Unstake failed', 'error');
    }
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
}

// ══════════════════════════════════════
// APP ROUTER
// ══════════════════════════════════════

function routeApp() {
    var overviewEl = document.getElementById('stakeOverview');
    var poolEl = document.getElementById('stakePool');
    var notFoundEl = document.getElementById('stakeNotFound');

    overviewEl.style.display = 'none';
    poolEl.classList.remove('visible');
    notFoundEl.style.display = 'none';

    var pool = getCurrentPool();

    if (pool === null) {
        // Overview
        overviewEl.style.display = '';
        renderOverview();
        document.title = 'Stake \u2014 Inclawbate';
    } else if (pool === 'not_found') {
        notFoundEl.style.display = '';
        document.title = 'Pool Not Found \u2014 Inclawbate';
    } else {
        // Individual pool
        var key = window.location.pathname.split('/')[2].toLowerCase();
        poolEl.classList.add('visible');
        renderPoolPage(pool, key);
        document.title = pool.name + ' Staking \u2014 Inclawbate';
    }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

async function init() {
    // Admin gate — blocks until admin wallet connects (or auto-bypasses)
    await tryAdminGate();

    wirePoolEvents();

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

    // Auto-reconnect saved wallet
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
