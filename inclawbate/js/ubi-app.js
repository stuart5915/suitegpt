// Inclawbate — UBI Treasury Page (Dual Staking: CLAWNCH 1x / inCLAWNCH 2x)

// ── MIGRATION MODE ──
// Set to true while migrating stakers to the new on-chain InclawnchStaking contract.
// Disables staking and unstaking with a maintenance banner.
const MIGRATION_MODE = false;

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const INCLAWNCH_ADDRESS = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
var DEPOSIT_WALLET = PROTOCOL_WALLET; // overridden by API response
const BASE_CHAIN_ID = '0x2105';
const TRANSFER_SELECTOR = '0xa9059cbb';
const BALANCE_SELECTOR = '0x70a08231'; // balanceOf(address)
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// ── On-Chain Staking Contract (InclawnchStaking) ──
const STAKING_PROXY = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';

// Function selectors (first 4 bytes of keccak256 of signature)
const SEL = {
    // User actions
    stake:            '0xa694fc3a', // stake(uint256)
    unstake:          '0x2e17de78', // unstake(uint256)
    claim:            '0x4e71d92d', // claim()
    claimAndRestake:  '0xf755d8c3', // claimAndRestake()
    exit:             '0xe9fad8ee', // exit()
    setAutoRestake:   '0x501cdba4', // setAutoRestake(bool)
    // Admin actions
    depositRewards:   '0xbdd071fb', // depositRewards(uint256,uint256)
    transferAdmin:    '0x75829def', // transferAdmin(address)
    pause:            '0x8456cb59', // pause()
    unpause:          '0x3f4ba83a', // unpause()
    // View functions
    balanceOf:        '0x70a08231', // balanceOf(address)
    earned:           '0x008cc262', // earned(address)
    totalStaked:      '0x817b1cd2', // totalStaked()
    stakerCount:      '0xdff69787', // stakerCount()
    rewardRate:       '0x7b0a47ee', // rewardRate()
    periodEnd:        '0x506ec095', // periodEnd()
    rewardPoolBalance:'0x7a5c08ae', // rewardPoolBalance()
    timeUntilEnd:     '0xecf30c98', // timeUntilPeriodEnd()
    admin:            '0xf851a440', // admin()
    paused:           '0x5c975abb', // paused()
    autoRestake:      '0x5ccba116', // autoRestake(address)
    totalDeposited:   '0x1f4c74fd', // totalRewardsDeposited()
    totalClaimed:     '0xa34b0f76', // totalRewardsClaimed()
    // ERC20
    approve:          '0x095ea7b3', // approve(address,uint256)
    allowance:        '0xdd62ed3e', // allowance(address,address)
};

const MAX_UINT256 = '0x' + 'f'.repeat(64);

const TOKEN_CONFIG = {
    clawnch: { address: CLAWNCH_ADDRESS, label: 'CLAWNCH' },
    inclawnch: { address: INCLAWNCH_ADDRESS, label: 'inCLAWNCH' }
};

// Roadmap milestones (USD targets)
const MILESTONES = [100000, 500000, 1000000, 5000000, 10000000, 25000000, 50000000];

var _posCountdownInterval = null;

// ── App Modal (replaces native confirm/alert) ──
function ubiModal(opts) {
    // opts: { icon, title, msg, confirmLabel, cancelLabel, confirmClass, onConfirm }
    return new Promise(function(resolve) {
        var overlay = document.getElementById('ubiModalOverlay');
        var iconEl = document.getElementById('ubiModalIcon');
        var titleEl = document.getElementById('ubiModalTitle');
        var msgEl = document.getElementById('ubiModalMsg');
        var actionsEl = document.getElementById('ubiModalActions');

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
            cancelBtn.className = 'ubi-modal-btn';
            cancelBtn.textContent = opts.cancelLabel || 'Cancel';
            cancelBtn.onclick = function() { close(false); };
            actionsEl.appendChild(cancelBtn);
        }

        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'ubi-modal-btn ' + (opts.confirmClass || 'ubi-modal-btn--confirm');
        confirmBtn.textContent = opts.confirmLabel || 'Confirm';
        confirmBtn.onclick = function() { close(true); };
        actionsEl.appendChild(confirmBtn);

        overlay.onclick = function(e) { if (e.target === overlay) close(false); };
        overlay.classList.add('visible');
    });
}

function ubiToast(msg, type) {
    var container = document.getElementById('ubiToastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'ubi-toast' + (type ? ' ubi-toast--' + type : '');
    var icon = type === 'error' ? '\u26A0\uFE0F' : type === 'success' ? '\u2705' : '\u2139\uFE0F';
    toast.innerHTML = '<span class="ubi-toast-icon">' + icon + '</span><span>' + msg + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function shortAddr(a) {
    return a.slice(0, 6) + '...' + a.slice(-4);
}

function pad32(hex) {
    return hex.replace('0x', '').padStart(64, '0');
}

function toHex(n) {
    return '0x' + BigInt(n).toString(16);
}

function toWei(amount) {
    return BigInt(Math.floor(amount)) * BigInt('1000000000000000000');
}

function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}

// Read from contract via public RPC (no wallet needed)
async function contractRead(to, data) {
    var res = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: to, data: data }, 'latest'] })
    });
    var json = await res.json();
    return json.result || '0x0';
}

// Send tx via connected wallet and wait for receipt
async function sendTxAndWait(provider, from, to, data, statusEl, statusMsg) {
    if (statusEl && statusMsg) {
        statusEl.textContent = statusMsg;
        statusEl.className = 'ubi-stake-status stake-status';
    }
    var txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: from, to: to, data: data }]
    });
    if (statusEl) {
        statusEl.textContent = 'Confirming transaction...';
    }
    for (var i = 0; i < 90; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        var receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash]
        });
        if (receipt) {
            if (receipt.status !== '0x1') throw new Error('Transaction reverted');
            return txHash;
        }
    }
    throw new Error('Transaction timed out');
}

// Read multiple contract values in parallel
async function readContractState(wallet) {
    var addrPadded = pad32(wallet);
    var [balRes, earnedRes, autoRes, totalRes, countRes, rateRes, endRes, poolRes, adminRes, pausedRes] = await Promise.all([
        contractRead(STAKING_PROXY, SEL.balanceOf + addrPadded),
        contractRead(STAKING_PROXY, SEL.earned + addrPadded),
        contractRead(STAKING_PROXY, SEL.autoRestake + addrPadded),
        contractRead(STAKING_PROXY, SEL.totalStaked),
        contractRead(STAKING_PROXY, SEL.stakerCount),
        contractRead(STAKING_PROXY, SEL.rewardRate),
        contractRead(STAKING_PROXY, SEL.periodEnd),
        contractRead(STAKING_PROXY, SEL.rewardPoolBalance),
        contractRead(STAKING_PROXY, SEL.admin),
        contractRead(STAKING_PROXY, SEL.paused),
    ]);
    return {
        staked: fromWei(balRes),
        stakedRaw: BigInt(balRes || '0x0'),
        earned: fromWei(earnedRes),
        earnedRaw: BigInt(earnedRes || '0x0'),
        autoRestake: BigInt(autoRes || '0x0') > 0n,
        totalStaked: fromWei(totalRes),
        stakerCount: Number(BigInt(countRes || '0x0')),
        rewardRate: fromWei(rateRes),
        periodEnd: Number(BigInt(endRes || '0x0')),
        rewardPool: fromWei(poolRes),
        admin: '0x' + (adminRes || '').slice(-40),
        paused: BigInt(pausedRes || '0x0') > 0n,
    };
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
}

function daysSince(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = diff / 86400000;
    if (days < 1) return 'less than a day';
    return Math.floor(days) + ' day' + (Math.floor(days) !== 1 ? 's' : '');
}

(async function() {
    // Provider helper — uses WalletKit (AppKit) when available, falls back to injected wallet
    function getProvider() {
        if (window.WalletKit && window.WalletKit.isConnected()) {
            return window.WalletKit.getProvider();
        }
        return window.ethereum || null;
    }

    let clawnchPrice = 0;
    let inclawnchPrice = 0;
    let ubiData = null;

    // Best price from DexScreener pairs: filter for our token as baseToken, pick highest liquidity
    function bestPrice(dexRes, tokenAddr) {
        if (!dexRes || !dexRes.pairs) return 0;
        var candidates = dexRes.pairs.filter(function(p) {
            return p.baseToken && p.baseToken.address &&
                p.baseToken.address.toLowerCase() === tokenAddr.toLowerCase() &&
                parseFloat(p.priceUsd) > 0;
        });
        if (candidates.length === 0) return 0;
        // Sort by liquidity descending
        candidates.sort(function(a, b) {
            return (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0);
        });
        return parseFloat(candidates[0].priceUsd) || 0;
    }

    // Price cache: save last-known prices so if APIs fail, we have a fallback
    function cachePrices(cp, ip) {
        try {
            localStorage.setItem('_ubi_prices', JSON.stringify({ cp, ip, t: Date.now() }));
        } catch (e) {}
    }
    function getCachedPrices() {
        try {
            var raw = localStorage.getItem('_ubi_prices');
            if (!raw) return null;
            var d = JSON.parse(raw);
            // Only use cache if less than 30 minutes old
            if (Date.now() - d.t > 1800000) return null;
            return d;
        } catch (e) { return null; }
    }

    // Fetch with single retry on failure
    async function fetchRetry(url, opts) {
        try {
            var r = await fetch(url, opts);
            if (r.ok) return await r.json();
        } catch (e) {}
        // Retry once after 1s
        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        try {
            var r2 = await fetch(url, opts);
            if (r2.ok) return await r2.json();
        } catch (e) {}
        return null;
    }

    // Fetch UBI data, prices, WETH balance, and on-chain staking stats in parallel
    var wethBalCalldata = BALANCE_SELECTOR + pad32(PROTOCOL_WALLET);
    const [ubiRes, clawnchDexRes, inclawnchDexRes, geckoRes, wethBalRes, onChainTotalStaked, onChainStakerCount] = await Promise.all([
        fetchRetry('/api/inclawbate/ubi'),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS)
            .then(r => r.json()).catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + INCLAWNCH_ADDRESS)
            .then(r => r.json()).catch(() => null),
        fetch('https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=' +
            CLAWNCH_ADDRESS.toLowerCase() + ',' + INCLAWNCH_ADDRESS.toLowerCase() + '&vs_currencies=usd')
            .then(r => r.json()).catch(() => null),
        fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
                params: [{ to: WETH_ADDRESS, data: wethBalCalldata }, 'latest'] })
        }).then(r => r.json()).catch(() => null),
        contractRead(STAKING_PROXY, SEL.totalStaked).catch(() => '0x0'),
        contractRead(STAKING_PROXY, SEL.stakerCount).catch(() => '0x0'),
    ]);

    // DexScreener (primary)
    clawnchPrice = bestPrice(clawnchDexRes, CLAWNCH_ADDRESS);
    inclawnchPrice = bestPrice(inclawnchDexRes, INCLAWNCH_ADDRESS);

    // CoinGecko fallback
    if (geckoRes) {
        var clKey = CLAWNCH_ADDRESS.toLowerCase();
        var iKey = INCLAWNCH_ADDRESS.toLowerCase();
        if (!clawnchPrice && geckoRes[clKey] && geckoRes[clKey].usd) {
            clawnchPrice = geckoRes[clKey].usd;
        }
        if (!inclawnchPrice && geckoRes[iKey] && geckoRes[iKey].usd) {
            inclawnchPrice = geckoRes[iKey].usd;
        }
    }

    // localStorage fallback: use cached prices if all APIs failed
    if (!clawnchPrice || !inclawnchPrice) {
        var cached = getCachedPrices();
        if (cached) {
            if (!clawnchPrice && cached.cp) clawnchPrice = cached.cp;
            if (!inclawnchPrice && cached.ip) inclawnchPrice = cached.ip;
        }
    }

    // Cache current prices for future fallback
    if (clawnchPrice > 0 || inclawnchPrice > 0) {
        cachePrices(clawnchPrice, inclawnchPrice);
    }

    ubiData = ubiRes;
    // Expose philanthropy orgs for the standalone Give Back widget
    if (ubiData && ubiData.philanthropy_orgs) {
        window._ubiOrgsLoaded = ubiData.philanthropy_orgs;
    }
    const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

    // Use deposit address from API (unstake wallet) for new stakes
    if (ubiData && ubiData.deposit_address) {
        DEPOSIT_WALLET = ubiData.deposit_address.toLowerCase();
    }

    // ── Distribution Countdown Timer ──
    startCountdown();

    // ── Protocol Revenue Section ──
    var protocolWeth = 0;
    if (wethBalRes && wethBalRes.result) {
        protocolWeth = Number(BigInt(wethBalRes.result)) / 1e18;
    }
    updateRevenueSection(protocolWeth, clawnchPrice);

    // Use on-chain data for inCLAWNCH staked amount
    var onChainInclawnchStaked = fromWei(onChainTotalStaked);
    var onChainStakers = Number(BigInt(onChainStakerCount || '0x0'));

    if (ubiData) {
        const clawnchStaked = Number(ubiData.total_balance) || 0;
        // Prefer on-chain data for inCLAWNCH, fallback to API
        const inclawnchStaked = onChainInclawnchStaked > 0 ? onChainInclawnchStaked : (Number(ubiData.inclawnch_staked) || 0);

        // Treasury display (hidden, for JS compat)
        document.getElementById('treasuryValue').textContent = fmt(clawnchStaked) + ' CLAWNCH + ' + fmt(Math.round(inclawnchStaked)) + ' inCLAWNCH';

        // USD value per token
        const clawnchUsd = clawnchStaked * clawnchPrice;
        const inclawnchUsd = inclawnchStaked * inclawnchPrice;
        const totalUsd = clawnchUsd + inclawnchUsd;
        document.getElementById('treasuryUsd').textContent = '~$' + fmtUsd(totalUsd) + ' USD';

        var tvlCEl = document.getElementById('tvlClawnchUsd');
        var tvlIEl = document.getElementById('tvlInclawnchUsd');
        if (tvlCEl) tvlCEl.textContent = clawnchPrice > 0 ? '~$' + fmtUsd(clawnchUsd) : '(price unavailable)';
        if (tvlIEl) tvlIEl.textContent = inclawnchPrice > 0 ? '~$' + fmtUsd(inclawnchUsd) : '(price unavailable)';

        // Show fetched CLAWNCH price for transparency
        var priceEl = document.getElementById('treasuryPrice');
        if (priceEl && clawnchPrice > 0) {
            var src = bestPrice(clawnchDexRes, CLAWNCH_ADDRESS) ? 'DexScreener' : 'CoinGecko';
            priceEl.textContent = 'CLAWNCH: $' + clawnchPrice.toFixed(7) + ' (' + src + ')';
        }

        // Stats — inCLAWNCH from contract, CLAWNCH from API
        document.getElementById('statClawnchStaked').textContent = fmt(clawnchStaked);
        document.getElementById('statInclawnchStaked').textContent = fmt(Math.round(inclawnchStaked));
        // Staker count: on-chain inCLAWNCH stakers (CLAWNCH stakers counted separately in API)
        var totalStakers = onChainStakers > 0 ? onChainStakers : (Number(ubiData.total_stakers) || 0);
        document.getElementById('statStakers').textContent = fmt(totalStakers);

        var totalDistributed = Number(ubiData.total_distributed) || 0;
        var distEl = document.getElementById('statTotalDistributed');
        if (distEl) distEl.textContent = fmt(totalDistributed);
        var distUsdTotal = Number(ubiData.total_distributed_usd) || 0;
        var distUsdEl = document.getElementById('statTotalDistUsd');
        if (distUsdEl && distUsdTotal > 0) {
            distUsdEl.textContent = '~$' + fmtUsd(distUsdTotal);
        }

        // APY calculation + card APYs
        updateAllApys();
        updateCalc();

        // Roadmap
        updateRoadmap(totalUsd);

        // Contributors
        if (ubiData.contributors && ubiData.contributors.length > 0) {
            const cList = document.getElementById('contributorsList');
            cList.innerHTML = ubiData.contributors.map(function(c) {
                const name = c.x_name || c.x_handle || shortAddr(c.wallet_address);
                const amount = fmt(c.clawnch_amount);
                const ago = timeAgo(c.created_at);
                const token = c.token || 'clawnch';
                const tokenLabel = token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
                const tokenClass = 'ubi-contrib-token--' + token;
                const inactive = c.active === false ? ' style="opacity:0.4"' : '';
                return '<div class="ubi-contrib-row"' + inactive + '>' +
                    '<span class="ubi-contrib-name">' + esc(name) + '</span>' +
                    '<span class="ubi-contrib-token ' + tokenClass + '">' + tokenLabel + '</span>' +
                    '<span class="ubi-contrib-amount">' + amount + '</span>' +
                    '<span class="ubi-contrib-time">' + ago + '</span>' +
                '</div>';
            }).join('');
        }
    } else {
        updateRoadmap(0);
    }

    // ── APY Logic ──
    // Reads current staked amounts from the stat elements so it stays in sync after stake/unstake
    function updateAllApys() {
        var clawnchStaked = Number((document.getElementById('statClawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
        var inclawnchStaked = Number((document.getElementById('statInclawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
        var weeklyRate = Number(ubiData?.weekly_rate) || 0;
        var dailyRate = weeklyRate / 7;
        // USD-weighted total: (tokens × price × multiplier) for each vault
        var clawnchUsdWeighted = clawnchPrice > 0 ? clawnchStaked * clawnchPrice * 1 : clawnchStaked;
        var inclawnchUsdWeighted = inclawnchPrice > 0 ? inclawnchStaked * inclawnchPrice * 2 : inclawnchStaked * 2;
        var totalWeightedStake = clawnchUsdWeighted + inclawnchUsdWeighted;

        // Per-card APYs (USD-denominated)
        // With USD-weighted pool, per $1 staked: CLAWNCH gets 1x share, inCLAWNCH gets 2x share
        // So inCLAWNCH APY is exactly 2× CLAWNCH APY
        var clawnchApy = 0;
        var inclawnchApy = 0;
        if (totalWeightedStake > 0 && dailyRate > 0 && inclawnchPrice > 0) {
            var annualRewardUsd = dailyRate * 365 * inclawnchPrice;
            clawnchApy = annualRewardUsd / totalWeightedStake * 100;
            inclawnchApy = annualRewardUsd * 2 / totalWeightedStake * 100;
        }

        var apyClawnchEl = document.getElementById('apyValClawnch');
        var apyInclawnchEl = document.getElementById('apyValInclawnch');
        var weeklyClawnchEl = document.getElementById('weeklyClawnch');
        var weeklyInclawnchEl = document.getElementById('weeklyInclawnch');

        var clawnchApyStr = clawnchApy > 0 ? clawnchApy.toFixed(1) + '%' : '--';
        var inclawnchApyStr = inclawnchApy > 0 ? inclawnchApy.toFixed(1) + '%' : '--';

        if (apyClawnchEl) apyClawnchEl.textContent = clawnchApyStr;
        if (apyInclawnchEl) apyInclawnchEl.textContent = inclawnchApyStr;

        // Also update vault card APY badges
        var vaultApyC = document.getElementById('vaultApyClawnch');
        var vaultApyI = document.getElementById('vaultApyInclawnch');
        if (vaultApyC) vaultApyC.textContent = clawnchApyStr + ' APY';
        if (vaultApyI) vaultApyI.textContent = inclawnchApyStr + ' APY';

        // Countdown KPIs: total staked value + blended APY
        var cdTotalStakedUsdEl = document.getElementById('cdTotalStakedUsd');
        var cdBlendedApyEl = document.getElementById('cdBlendedApy');
        if (cdTotalStakedUsdEl) {
            var stakedUsd = (clawnchStaked * clawnchPrice) + (inclawnchStaked * inclawnchPrice);
            cdTotalStakedUsdEl.textContent = stakedUsd > 0 ? '$' + stakedUsd.toFixed(2) : '--';
        }
        if (cdBlendedApyEl) {
            // Blended APY = weighted average of each vault's APY by USD value
            var blendedApy = 0;
            var clawnchUsd = clawnchStaked * clawnchPrice;
            var inclawnchUsd = inclawnchStaked * inclawnchPrice;
            var totalUsd = clawnchUsd + inclawnchUsd;
            if (totalUsd > 0 && clawnchApy > 0) {
                blendedApy = (clawnchUsd / totalUsd) * clawnchApy + (inclawnchUsd / totalUsd) * inclawnchApy;
            }
            cdBlendedApyEl.textContent = blendedApy > 0 ? blendedApy.toFixed(1) + '%' : '--';
        }

        // Countdown KPI: total UBI distributed
        var cdTotalDistEl = document.getElementById('cdTotalDistributed');
        if (cdTotalDistEl) {
            var td = Number(ubiData?.total_distributed) || 0;
            if (td > 0) {
                var cdDistUsd = Number(ubiData?.total_distributed_usd) || 0;
                var distUsd = cdDistUsd > 0 ? ' ($' + fmtUsd(cdDistUsd) + ')' : '';
                cdTotalDistEl.innerHTML = fmt(td) + '<span style="font-size:0.7em;color:var(--text-dim);font-weight:600;">' + distUsd + '</span>';
            } else {
                cdTotalDistEl.textContent = '--';
            }
        }

        // Countdown KPI: annual UBI rate in USD
        var cdAnnualEl = document.getElementById('cdAnnualUbiUsd');
        if (cdAnnualEl) {
            if (dailyRate > 0 && inclawnchPrice > 0) {
                var annualUsdKpi = dailyRate * 365 * inclawnchPrice;
                cdAnnualEl.textContent = '$' + fmt(Math.round(annualUsdKpi));
            } else {
                cdAnnualEl.textContent = '--';
            }
        }

        // Daily earnings per 100k staked
        if (weeklyClawnchEl) {
            if (totalWeightedStake > 0 && dailyRate > 0) {
                var per100k = (100000 / totalWeightedStake) * dailyRate;
                weeklyClawnchEl.innerHTML = 'Earn <span>' + fmt(per100k) + ' inCLAWNCH/day</span> per 100k staked';
            } else {
                weeklyClawnchEl.textContent = '';
            }
        }
        if (weeklyInclawnchEl) {
            if (totalWeightedStake > 0 && dailyRate > 0) {
                var per100k2x = (200000 / totalWeightedStake) * dailyRate;
                weeklyInclawnchEl.innerHTML = 'Earn <span>' + fmt(per100k2x) + ' inCLAWNCH/day</span> per 100k staked';
            } else {
                weeklyInclawnchEl.textContent = '';
            }
        }

        // ── UBI Income Banner ──
        var annualInclawnch = dailyRate * 365;
        var annualUsd = annualInclawnch * inclawnchPrice;
        var totalStakers = Number(ubiData?.total_stakers) || 0;

        // Pool value = total staked value in USD (CLAWNCH + inCLAWNCH at market prices)
        var poolTokens = clawnchStaked + (inclawnchStaked * 2);
        var poolUsd = (clawnchStaked * clawnchPrice) + (inclawnchStaked * inclawnchPrice);

        var incomeValEl = document.getElementById('ubiIncomeValue');
        var incomeSubEl = document.getElementById('ubiIncomeSub');
        var incomeWeeklyEl = document.getElementById('ubiIncomeWeekly');
        var incomePerStakerEl = document.getElementById('ubiIncomePerStaker');
        var incomeStakersEl = document.getElementById('ubiIncomeStakers');

        if (incomeValEl) {
            if (weeklyRate > 0 && inclawnchPrice > 0) {
                incomeValEl.textContent = '$' + fmtUsd(annualUsd) + ' / year';
            } else if (weeklyRate > 0) {
                incomeValEl.textContent = fmt(annualInclawnch) + ' inCLAWNCH / year';
            } else if (poolUsd > 0) {
                incomeValEl.textContent = '$' + fmtUsd(poolUsd) + ' Pool';
            } else if (poolTokens > 0) {
                incomeValEl.textContent = fmt(poolTokens) + ' tokens staked';
            } else {
                incomeValEl.textContent = 'Coming Soon';
            }
        }
        if (incomeSubEl) {
            if (weeklyRate > 0) {
                incomeSubEl.innerHTML = '<strong>' + fmt(annualInclawnch) + ' inCLAWNCH</strong> distributed annually to all stakers';
            } else if (poolTokens > 0) {
                incomeSubEl.textContent = fmt(poolTokens) + ' weighted tokens staked — set daily rate from admin to activate distributions';
            } else {
                incomeSubEl.textContent = 'Stake CLAWNCH or inCLAWNCH to grow the UBI pool';
            }
        }
        if (incomeWeeklyEl) {
            incomeWeeklyEl.textContent = dailyRate > 0 ? fmt(dailyRate) : '--';
        }
        if (incomePerStakerEl) {
            if (totalStakers > 0 && annualUsd > 0) {
                incomePerStakerEl.textContent = '~$' + fmtUsd(annualUsd / totalStakers);
            } else if (totalStakers > 0 && annualInclawnch > 0) {
                incomePerStakerEl.textContent = '~' + fmt(annualInclawnch / totalStakers) + ' inCLAWNCH';
            } else if (totalStakers > 0 && poolUsd > 0) {
                incomePerStakerEl.textContent = '~$' + fmtUsd(poolUsd / totalStakers);
            } else {
                incomePerStakerEl.textContent = '--';
            }
        }
        if (incomeStakersEl) {
            incomeStakersEl.textContent = totalStakers;
        }
    }

    function fmtUsd(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        if (n >= 1) return n.toFixed(2);
        return n.toFixed(2);
    }

    // ── Staking Calculator ──
    function updateCalc() {
        var rawC = (document.getElementById('calcAmountClawnch').value || '').replace(/,/g, '');
        var rawI = (document.getElementById('calcAmountInclawnch').value || '').replace(/,/g, '');
        var clawnchAmt = Number(rawC) || 0;
        var inclawnchAmt = Number(rawI) || 0;
        var colC = document.getElementById('calcColClawnch');
        var colI = document.getElementById('calcColInclawnch');
        var usdC = document.getElementById('calcUsdClawnch');
        var usdI = document.getElementById('calcUsdInclawnch');
        if (!colC || !colI) return;

        // Show USD equivalents
        if (usdC) {
            usdC.textContent = (clawnchAmt > 0 && clawnchPrice > 0)
                ? '~$' + fmtUsd(clawnchAmt * clawnchPrice)
                : '';
        }
        if (usdI) {
            usdI.textContent = (inclawnchAmt > 0 && inclawnchPrice > 0)
                ? '~$' + fmtUsd(inclawnchAmt * inclawnchPrice)
                : '';
        }

        if ((clawnchAmt <= 0 && inclawnchAmt <= 0) || !ubiData) {
            colC.innerHTML = '<div class="ubi-calc-col-title">CLAWNCH (1x)</div><div class="ubi-calc-empty">Enter an amount above</div>';
            colI.innerHTML = '<div class="ubi-calc-col-title">inCLAWNCH (2x)</div><div class="ubi-calc-empty">Enter an amount above</div>';
            return;
        }

        var weeklyRate = Number(ubiData.weekly_rate) || 0;
        var dailyRate = weeklyRate / 7;
        var clawnchStaked = Number(ubiData.total_balance) || 0;
        var inclawnchStaked = Number(ubiData.inclawnch_staked) || 0;
        // USD-weighted totals
        var clawnchUsdW = clawnchPrice > 0 ? clawnchStaked * clawnchPrice : clawnchStaked;
        var inclawnchUsdW = inclawnchPrice > 0 ? inclawnchStaked * inclawnchPrice * 2 : inclawnchStaked * 2;
        var totalWeightedStake = clawnchUsdW + inclawnchUsdW;

        // Combined dilution from both inputs (USD-weighted)
        var addClawnchW = clawnchPrice > 0 ? clawnchAmt * clawnchPrice : clawnchAmt;
        var addInclawnchW = inclawnchPrice > 0 ? inclawnchAmt * inclawnchPrice * 2 : inclawnchAmt * 2;
        var newTotalWeighted = totalWeightedStake + addClawnchW + addInclawnchW;

        function renderCol(amount, mult, label) {
            var tokenPrice = mult === 2 ? inclawnchPrice : clawnchPrice;
            var weightedAmount = tokenPrice > 0 ? amount * tokenPrice * mult : amount * mult;
            if (amount <= 0) {
                return '<div class="ubi-calc-col-title">' + label + '</div><div class="ubi-calc-empty">Enter an amount above</div>';
            }
            var daily = newTotalWeighted > 0 ? (weightedAmount / newTotalWeighted) * dailyRate : 0;
            var weekly = daily * 7;
            var monthly = daily * 30;
            var annual = daily * 365;
            // USD APY: with USD-weighted pool, inCLAWNCH gets exactly 2× CLAWNCH APY
            var apy = 0;
            if (newTotalWeighted > 0 && dailyRate > 0 && inclawnchPrice > 0) {
                var annualRewardUsd = dailyRate * 365 * inclawnchPrice;
                apy = annualRewardUsd * mult / newTotalWeighted * 100;
            }

            function valWithUsd(tokens) {
                var s = fmt(tokens);
                if (inclawnchPrice > 0) s += ' <span class="ubi-calc-row-usd">($' + fmtUsd(tokens * inclawnchPrice) + ')</span>';
                return s;
            }

            var html = '<div class="ubi-calc-col-title">' + label + '</div>';
            html += '<div class="ubi-calc-row"><span class="ubi-calc-row-label">Daily</span><span class="ubi-calc-row-val">' + valWithUsd(daily) + '</span></div>';
            html += '<div class="ubi-calc-row"><span class="ubi-calc-row-label">Weekly</span><span class="ubi-calc-row-val">' + valWithUsd(weekly) + '</span></div>';
            html += '<div class="ubi-calc-row"><span class="ubi-calc-row-label">Monthly</span><span class="ubi-calc-row-val">' + valWithUsd(monthly) + '</span></div>';
            html += '<div class="ubi-calc-row"><span class="ubi-calc-row-label">Annual</span><span class="ubi-calc-row-val">' + valWithUsd(annual) + '</span></div>';
            html += '<div class="ubi-calc-row ubi-calc-row--apy"><span class="ubi-calc-row-label">APY</span><span class="ubi-calc-row-val">' + (apy > 0 ? apy.toFixed(1) + '%' : '--') + '</span></div>';
            return html;
        }

        colC.innerHTML = renderCol(clawnchAmt, 1, 'CLAWNCH (1x)');
        colI.innerHTML = renderCol(inclawnchAmt, 2, 'inCLAWNCH (2x)');
    }

    // Format calc inputs with commas on every keystroke
    function setupCalcInput(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function() {
            var raw = el.value.replace(/,/g, '').replace(/[^0-9]/g, '');
            if (raw) {
                var num = parseInt(raw, 10);
                el.value = num.toLocaleString();
            }
            updateCalc();
        });
    }
    setupCalcInput('calcAmountClawnch');
    setupCalcInput('calcAmountInclawnch');

    // Calculator modal open/close
    var calcOverlay = document.getElementById('calcOverlay');
    var calcTriggerBtn = document.getElementById('calcTriggerBtn');
    var calcCloseBtn = document.getElementById('calcCloseBtn');

    function openCalcModal() {
        if (calcOverlay) calcOverlay.classList.add('visible');
    }
    function closeCalcModal() {
        if (calcOverlay) calcOverlay.classList.remove('visible');
    }
    if (calcTriggerBtn) calcTriggerBtn.addEventListener('click', openCalcModal);
    if (calcCloseBtn) calcCloseBtn.addEventListener('click', closeCalcModal);
    if (calcOverlay) calcOverlay.addEventListener('click', function(e) {
        if (e.target === calcOverlay) closeCalcModal();
    });

    // % of wallet buttons (per-token)
    document.querySelectorAll('.ubi-calc-pct-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var pct = parseInt(btn.getAttribute('data-pct')) || 0;
            var token = btn.getAttribute('data-token');
            var bal = (token === 'inclawnch') ? (walletBalances.inclawnch || 0) : (walletBalances.clawnch || 0);
            if (bal <= 0) return;
            var amount = Math.floor(bal * pct / 100);
            var inputId = (token === 'inclawnch') ? 'calcAmountInclawnch' : 'calcAmountClawnch';
            var inputEl = document.getElementById(inputId);
            if (inputEl) {
                inputEl.value = amount.toLocaleString();
                updateCalc();
            }
        });
    });

    function buildSplitHtml(dailyAmt, price, keepPct, kingdomPct, reinvestPct) {
        function splitLine(label, pct) {
            var amt = Math.round(dailyAmt * pct / 100);
            var usd = price > 0 ? ' ($' + (amt * price).toFixed(2) + ')' : '';
            return '<div style="display:flex;justify-content:space-between;align-items:baseline;">'
                + '<span>' + label + '</span>'
                + '<span style="font-family:var(--font-mono);color:var(--text-secondary);">' + fmt(amt) + ' inCLAWNCH' + usd + ' <span style="color:var(--text-dim);">' + pct + '%</span></span>'
                + '</div>';
        }
        return '<div class="ubi-pc-split" id="posCountdownSplit" style="font-size:0.78rem;color:var(--text-dim);margin-top:6px;display:flex;flex-direction:column;gap:2px;" data-daily="' + dailyAmt + '" data-price="' + price + '">'
            + splitLine('Keep', keepPct)
            + splitLine('Kingdom', kingdomPct)
            + splitLine('UBI Fund', reinvestPct)
            + '</div>';
    }

    // ── Protocol Revenue Logic ──
    function updateRevenueSection(wethBal, clPrice) {
        var rewardPct = Number(ubiData?.reward_split_pct) || 80;
        var lpPct = 100 - rewardPct;

        // Get ETH price from DexScreener CLAWNCH pair (priceNative = CLAWNCH per ETH)
        var ethPrice = 0;
        try {
            if (clawnchDexRes && clawnchDexRes.pairs) {
                var topPair = clawnchDexRes.pairs.find(function(p) {
                    return p.baseToken && p.baseToken.address.toLowerCase() === CLAWNCH_ADDRESS.toLowerCase() &&
                        p.quoteToken && (p.quoteToken.symbol === 'WETH' || p.quoteToken.symbol === 'ETH');
                });
                if (topPair && topPair.priceNative && clPrice > 0) {
                    ethPrice = clPrice / parseFloat(topPair.priceNative);
                }
            }
        } catch (e) {}
        // Fallback: estimate ETH ~$2500 if we can't get it
        if (ethPrice <= 0) ethPrice = 2500;

        var wethUsd = wethBal * ethPrice;
        var rewardWeth = wethBal * (rewardPct / 100);
        var lpWeth = wethBal * (lpPct / 100);
        var rewardUsd = rewardWeth * ethPrice;
        var lpUsd = lpWeth * ethPrice;

        // How much CLAWNCH the reward portion would buy
        var rewardClawnch = clPrice > 0 ? rewardUsd / clPrice : 0;

        var yieldValEl = document.getElementById('revYieldVal');
        var yieldUsdEl = document.getElementById('revYieldUsd');
        var barFillEl = document.getElementById('revBarFill');
        var barLabelLeft = document.getElementById('revBarLabelLeft');
        var barLabelRight = document.getElementById('revBarLabelRight');
        var rewardPctEl = document.getElementById('revRewardPct');
        var lpPctEl = document.getElementById('revLpPct');
        var rewardValEl = document.getElementById('revRewardVal');
        var lpValEl = document.getElementById('revLpVal');

        if (yieldValEl) {
            yieldValEl.textContent = wethBal > 0 ? wethBal.toFixed(4) + ' WETH' : 'Accumulating...';
        }
        if (yieldUsdEl) {
            yieldUsdEl.textContent = wethUsd > 0 ? '(~$' + fmtUsd(wethUsd) + ')' : '';
        }
        if (barFillEl) {
            barFillEl.style.setProperty('--split-pct', rewardPct + '%');
        }
        if (barLabelLeft) barLabelLeft.textContent = rewardPct + '% → Weekly Rewards';
        if (barLabelRight) barLabelRight.textContent = lpPct + '% → LP Growth';
        if (rewardPctEl) rewardPctEl.textContent = rewardPct + '%';
        if (lpPctEl) lpPctEl.textContent = lpPct + '%';

        if (rewardValEl) {
            if (rewardClawnch > 0) {
                rewardValEl.textContent = '~' + Math.round(rewardClawnch).toLocaleString() + ' CLAWNCH ($' + fmtUsd(rewardUsd) + ')';
            } else if (rewardWeth > 0) {
                rewardValEl.textContent = rewardWeth.toFixed(4) + ' WETH';
            } else {
                rewardValEl.textContent = 'Accumulating yield...';
            }
        }
        if (lpValEl) {
            if (lpUsd > 0) {
                lpValEl.textContent = lpWeth.toFixed(4) + ' WETH ($' + fmtUsd(lpUsd) + ')';
            } else {
                lpValEl.textContent = 'Compounding...';
            }
        }
    }

    // ── Distribution Countdown (targets every day at 8am local) ──
    function startCountdown() {
        var container = document.getElementById('ubiCountdown');
        if (!container) return;

        var ONE_DAY = 24 * 60 * 60 * 1000;

        function getDaily8am(direction) {
            // direction: 'next' or 'last' — targets 6am EST (11am UTC)
            var now = new Date();
            var target = new Date(now);
            target.setUTCHours(11, 0, 0, 0);

            if (direction === 'next') {
                if (now >= target) {
                    // Already past 8am UTC today — next is tomorrow
                    target.setUTCDate(target.getUTCDate() + 1);
                }
            } else {
                // last 8am UTC
                if (now < target) {
                    // Before 8am UTC today — last was yesterday
                    target.setUTCDate(target.getUTCDate() - 1);
                }
            }
            return target;
        }

        var nextDist = getDaily8am('next').getTime();
        var lastDist = getDaily8am('last').getTime();

        // Show the countdown
        container.classList.remove('hidden');

        // Date labels
        var lastLabel = document.getElementById('cdLastDist');
        var nextLabel = document.getElementById('cdNextDist');
        var fmtDate = function(ts) {
            return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };
        if (lastLabel) lastLabel.textContent = 'Last: ' + fmtDate(lastDist);
        if (nextLabel) nextLabel.textContent = 'Next: ' + fmtDate(nextDist);

        function tick() {
            var now = Date.now();
            var diff = nextDist - now;
            var elapsed = now - lastDist;
            var progress = Math.min(100, Math.max(0, (elapsed / ONE_DAY) * 100));

            // Update progress bar
            var barFill = document.getElementById('cdBarFill');
            if (barFill) barFill.style.width = progress + '%';

            // Accumulating daily distribution number
            var cdWeeklyEl = document.getElementById('cdWeeklyAmount');
            var weeklyRate = Number(ubiData?.weekly_rate) || 0;
            var dailyRateTick = weeklyRate / 7;
            if (cdWeeklyEl && dailyRateTick > 0) {
                var accumPct = Math.min(1, elapsed / ONE_DAY);
                var accumulated = Math.round(dailyRateTick * accumPct);
                cdWeeklyEl.textContent = fmt(accumulated);
            }

            var daysEl = document.getElementById('cdDays');
            var hoursEl = document.getElementById('cdHours');
            var minsEl = document.getElementById('cdMins');
            var secsEl = document.getElementById('cdSecs');

            if (diff <= 0) {
                // Overdue — past 8am today
                container.classList.add('overdue');
                var over = Math.abs(diff);
                var oH = Math.floor(over / 3600000);
                var oM = Math.floor((over % 3600000) / 60000);
                if (daysEl) daysEl.textContent = '00';
                if (hoursEl) hoursEl.textContent = '00';
                if (minsEl) minsEl.textContent = '00';
                if (secsEl) secsEl.textContent = '00';
                var label = document.querySelector('.dash-countdown-label');
                if (label) label.textContent = '\uD83E\uDD9E Distribution Overdue by ' + oH + 'h ' + oM + 'm \uD83E\uDD9E';
            } else {
                container.classList.remove('overdue');
                var d = Math.floor(diff / 86400000);
                var h = Math.floor((diff % 86400000) / 3600000);
                var m = Math.floor((diff % 3600000) / 60000);
                var s = Math.floor((diff % 60000) / 1000);
                if (daysEl) daysEl.textContent = d < 10 ? '0' + d : d;
                if (hoursEl) hoursEl.textContent = h < 10 ? '0' + h : h;
                if (minsEl) minsEl.textContent = m < 10 ? '0' + m : m;
                if (secsEl) secsEl.textContent = s < 10 ? '0' + s : s;
            }
        }

        tick();
        setInterval(tick, 1000);
    }

    // ── Roadmap Logic ──
    function updateRoadmap(treasuryUsd) {
        const maxTarget = MILESTONES[MILESTONES.length - 1];

        const fillEl = document.getElementById('roadmapFill');
        if (fillEl) {
            const pct = treasuryUsd <= 0 ? 0 : Math.min(100, (Math.log10(treasuryUsd) / Math.log10(maxTarget)) * 100);
            setTimeout(function() { fillEl.style.width = pct + '%'; }, 300);
        }

        const markersEl = document.getElementById('milestoneMarkers');
        if (markersEl) {
            markersEl.innerHTML = MILESTONES.map(function(target) {
                const pos = target <= 0 ? 0 : (Math.log10(target) / Math.log10(maxTarget)) * 100;
                const reached = treasuryUsd >= target;
                const isCurrent = !reached && (MILESTONES.indexOf(target) === 0 || treasuryUsd >= MILESTONES[MILESTONES.indexOf(target) - 1]);
                const cls = reached ? 'reached' : (isCurrent ? 'current' : '');
                return '<div class="ubi-milestone-dot ' + cls + '" style="left:' + pos + '%"></div>';
            }).join('');
        }

        var milestoneCards = document.querySelectorAll('.ubi-milestone[data-target]');
        var foundCurrent = false;
        milestoneCards.forEach(function(card) {
            var target = parseInt(card.getAttribute('data-target'));
            if (treasuryUsd >= target) {
                card.classList.add('reached');
                card.classList.remove('current');
            } else if (!foundCurrent) {
                card.classList.add('current');
                card.classList.remove('reached');
                foundCurrent = true;
            } else {
                card.classList.remove('reached', 'current');
            }
        });
    }

    // ── Dual Staking ──
    let stakeWallet = null;

    function getPrice(token) {
        return token === 'inclawnch' ? inclawnchPrice : clawnchPrice;
    }

    // Shared wallet connection — uses AppKit modal if available, else injected wallet
    var isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    function showMobileDeepLinks() {
        var dappUrl = encodeURIComponent(window.location.href);
        var rawUrl = window.location.href;
        document.querySelectorAll('.stake-status').forEach(function(el) {
            el.innerHTML = 'Open this page in your wallet app:<br>' +
                '<a href="https://metamask.app.link/dapp/' + rawUrl.replace('https://', '') + '" style="color:var(--seafoam-300);text-decoration:underline;font-weight:600;">MetaMask</a>' +
                ' &middot; ' +
                '<a href="https://go.cb-w.com/dapp?cb_url=' + dappUrl + '" style="color:var(--seafoam-300);text-decoration:underline;font-weight:600;">Coinbase Wallet</a>' +
                ' &middot; ' +
                '<a href="https://link.trustwallet.com/open_url?coin_id=8453&url=' + dappUrl + '" style="color:var(--seafoam-300);text-decoration:underline;font-weight:600;">Trust Wallet</a>';
            el.className = 'ubi-stake-status stake-status';
        });
    }

    async function connectWallet() {
        if (stakeWallet) return stakeWallet;

        // Path A: WalletKit (AppKit) — opens modal with WalletConnect QR, MetaMask, etc.
        if (window.WalletKit) {
            try {
                await window.WalletKit.open();
                // Connection completes asynchronously via WalletKit.onConnect callback
                // On mobile, also show deep links as a fallback in case modal doesn't work
                if (isMobile) showMobileDeepLinks();
                return null;
            } catch (err) {
                // Fall through to injected wallet / deep links
            }
        }

        // Path B: Injected wallet (MetaMask extension, Coinbase Wallet, etc.)
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

                onWalletConnected(addr);
                return addr;
            } catch (err) {
                document.querySelectorAll('.stake-status').forEach(function(el) {
                    el.textContent = err.message || 'Connection failed';
                    el.className = 'ubi-stake-status stake-status error';
                });
                return null;
            }
        }

        // No wallet available — on mobile, offer deep links to open in wallet app browser
        if (isMobile) {
            showMobileDeepLinks();
        } else {
            document.querySelectorAll('.stake-status').forEach(function(el) {
                el.textContent = 'No wallet found. Install MetaMask or Coinbase Wallet extension.';
                el.className = 'ubi-stake-status stake-status error';
            });
        }
        return null;
    }

    // Called when wallet successfully connects (via WalletKit callback or auto-reconnect)
    function onWalletConnected(address) {
        stakeWallet = address;

        // Step flow: mark Step 1 done, activate Step 2
        var step1 = document.getElementById('ubiStep1');
        var step2 = document.getElementById('ubiStep2');
        if (step1) step1.classList.add('ubi-step--done');
        if (step2) step2.classList.remove('ubi-step--dimmed');

        // Activate both cards
        document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
            btn.textContent = '\u2713 ' + shortAddr(stakeWallet);
            btn.classList.add('connected');
        });
        document.querySelectorAll('.stake-form').forEach(function(form) {
            form.style.display = '';
        });
        // Update hints for both
        document.querySelectorAll('.stake-amount').forEach(function(input) {
            updateHint(input.getAttribute('data-token'));
        });

        // Fetch and show wallet balances
        fetchBalances();

        // Show calculator % buttons for both tokens
        var calcPctRowC = document.getElementById('calcPctRowClawnch');
        var calcPctRowI = document.getElementById('calcPctRowInclawnch');
        if (calcPctRowC) calcPctRowC.style.display = '';
        if (calcPctRowI) calcPctRowI.style.display = '';

        // Load user's stakes
        loadMyStakes();
    }

    // ── Wallet Balances ──
    let walletBalances = { clawnch: 0, inclawnch: 0 };

    async function fetchBalances() {
        if (!stakeWallet) return;
        var provider = getProvider();
        if (!provider) return;
        var callData = BALANCE_SELECTOR + pad32(stakeWallet);

        try {
            var [clawnchResult, inclawnchResult] = await Promise.all([
                provider.request({
                    method: 'eth_call',
                    params: [{ to: CLAWNCH_ADDRESS, data: callData }, 'latest']
                }),
                provider.request({
                    method: 'eth_call',
                    params: [{ to: INCLAWNCH_ADDRESS, data: callData }, 'latest']
                })
            ]);

            walletBalances.clawnch = Number(BigInt(clawnchResult)) / 1e18;
            walletBalances.inclawnch = Number(BigInt(inclawnchResult)) / 1e18;

            // Show balance displays
            var clawnchEl = document.getElementById('balanceClawnch');
            var inclawnchEl = document.getElementById('balanceInclawnch');
            if (clawnchEl) {
                clawnchEl.style.display = 'block';
                document.getElementById('balValClawnch').textContent = fmt(walletBalances.clawnch) + ' CLAWNCH';
            }
            if (inclawnchEl) {
                inclawnchEl.style.display = 'block';
                document.getElementById('balValInclawnch').textContent = fmt(walletBalances.inclawnch) + ' inCLAWNCH';
            }
        } catch (e) {
            // silently fail
        }
    }

    // ── Render Redirect Widget into Step 3 ──
    function renderRedirectWidget(data) {
        var container = document.getElementById('redirectStepContent');
        if (!container) return;

        var savedKeep = data.split_keep_pct ?? 34;
        var savedKingdom = data.split_kingdom_pct ?? 33;
        var savedReinvest = data.split_reinvest_pct ?? 33;

        var rh = '';

        // Split sliders directly (no pill selection needed)
        rh += '<div class="ubi-split-sliders" id="splitSliders">';
        rh += '<div class="ubi-split-row"><span class="ubi-split-label">\uD83C\uDF3F Keep</span><input type="range" min="0" max="100" step="1" value="' + savedKeep + '" class="ubi-split-range" id="splitKeep"><span class="ubi-split-val" id="splitKeepVal">' + savedKeep + '%</span></div>';
        rh += '<div class="ubi-split-row"><span class="ubi-split-label">\u271D\uFE0F Kingdom</span><input type="range" min="0" max="100" step="1" value="' + savedKingdom + '" class="ubi-split-range" id="splitKingdom"><span class="ubi-split-val" id="splitKingdomVal">' + savedKingdom + '%</span></div>';
        rh += '<div class="ubi-split-row"><span class="ubi-split-label">\uD83C\uDF31 UBI Fund</span><input type="range" min="0" max="100" step="1" value="' + savedReinvest + '" class="ubi-split-range" id="splitReinvest"><span class="ubi-split-val" id="splitReinvestVal">' + savedReinvest + '%</span></div>';
        rh += '</div>';

        rh += '<p class="ubi-split-blurb" id="splitBlurb"></p>';
        rh += '<button class="ubi-redirect-save" id="giveBackSaveBtn">Save</button>';
        rh += '<span class="ubi-redirect-status" id="giveBackStatus"></span>';

        // Show the Kingdom info section below the layout
        var kingdomEl = document.getElementById('kingdomInfo');
        if (kingdomEl) kingdomEl.style.display = '';

        container.innerHTML = rh;

        // Wire up split sliders
        var splitKeep = document.getElementById('splitKeep');
        var splitKingdom = document.getElementById('splitKingdom');
        var splitReinvest = document.getElementById('splitReinvest');
        if (splitKeep && splitKingdom && splitReinvest) {
            function updateSplitBlurb() {
                var k = Number(splitKeep.value), g = Number(splitKingdom.value), r = Number(splitReinvest.value);
                var parts = [];
                if (k > 0) parts.push(k + '% for myself');
                if (g > 0) parts.push(g + '% to the Kingdom');
                if (r > 0) parts.push(r + '% back to the Inclawbate UBI fund for higher distributions');
                var blurb = document.getElementById('splitBlurb');
                if (blurb) blurb.textContent = parts.length ? 'I\'m giving ' + parts.join(', ') + '.' : '';
            }
            function updateSplitDisplay() {
                document.getElementById('splitKeepVal').textContent = splitKeep.value + '%';
                document.getElementById('splitKingdomVal').textContent = splitKingdom.value + '%';
                document.getElementById('splitReinvestVal').textContent = splitReinvest.value + '%';
                updateSplitBlurb();
            }
            function balanceSliders(changed, others) {
                var val = Number(changed.value);
                var remaining = 100 - val;
                var o1 = Number(others[0].value);
                var o2 = Number(others[1].value);
                var sum = o1 + o2;
                if (sum === 0) {
                    others[0].value = Math.round(remaining / 2);
                    others[1].value = remaining - Math.round(remaining / 2);
                } else {
                    others[0].value = Math.max(0, Math.round((o1 / sum) * remaining));
                    others[1].value = remaining - Number(others[0].value);
                }
                updateSplitDisplay();
            }
            splitKeep.addEventListener('input', function() { balanceSliders(splitKeep, [splitKingdom, splitReinvest]); });
            splitKingdom.addEventListener('input', function() { balanceSliders(splitKingdom, [splitKeep, splitReinvest]); });
            splitReinvest.addEventListener('input', function() { balanceSliders(splitReinvest, [splitKeep, splitKingdom]); });
            updateSplitBlurb();
        }

        // Wire up save button
        var saveBtn = document.getElementById('giveBackSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async function() {
                var statusEl = document.getElementById('giveBackStatus');
                saveBtn.disabled = true;
                if (statusEl) statusEl.textContent = 'Saving...';

                var k = Number(document.getElementById('splitKeep').value) || 0;
                var g = Number(document.getElementById('splitKingdom').value) || 0;
                var r = Number(document.getElementById('splitReinvest').value) || 0;
                if (k + g + r !== 100) {
                    ubiToast('Split must total 100%', 'error');
                    saveBtn.disabled = false;
                    return;
                }

                var body = {
                    action: 'update-whale-redirect',
                    wallet_address: stakeWallet,
                    redirect_target: 'split',
                    split_keep_pct: k,
                    split_kingdom_pct: g,
                    split_reinvest_pct: r
                };
                var firstOrg = (ubiData?.philanthropy_orgs || [])[0];
                if (firstOrg) body.org_id = firstOrg.id;

                try {
                    var resp = await fetch('/api/inclawbate/ubi', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    var rData = await resp.json();
                    if (resp.ok && rData.success) {
                        if (statusEl) statusEl.textContent = '';
                        ubiToast('Saved', 'success');
                        // Update countdown split display
                        var splitEl = document.getElementById('posCountdownSplit');
                        if (splitEl) {
                            var da = parseFloat(splitEl.dataset.daily) || 0;
                            var dp = parseFloat(splitEl.dataset.price) || 0;
                            splitEl.outerHTML = buildSplitHtml(da, dp, k, g, r);
                        }
                    } else {
                        if (statusEl) statusEl.textContent = '';
                        ubiToast((rData.error || 'Failed to save') + (rData.detail ? ' — ' + rData.detail : ''), 'error');
                    }
                } catch (e) {
                    if (statusEl) statusEl.textContent = '';
                    ubiToast('Failed to save', 'error');
                }
                saveBtn.disabled = false;
            });
        }
    }

    // ── Your Stakes ──
    async function loadMyStakes() {
        if (!stakeWallet) return;

        const section = document.getElementById('yourStakesSection');
        const list = document.getElementById('yourStakesList');
        section.classList.add('visible');

        try {
            // Fetch CLAWNCH from API and inCLAWNCH from contract in parallel
            var [apiResp, contractState] = await Promise.all([
                fetch('/api/inclawbate/ubi?wallet=' + stakeWallet.toLowerCase()).then(r => r.json()).catch(() => ({})),
                readContractState(stakeWallet)
            ]);

            var data = apiResp || {};
            var clawnchStakes = (data.my_stakes || []).filter(function(s) { return s.active && (s.token || 'clawnch') === 'clawnch'; });
            var pendingUnstakes = (data.my_stakes || []).filter(function(s) { return !s.active && s.unstaked_at && s.withdrawal_status !== 'completed' && (s.token || 'clawnch') === 'clawnch'; });

            var userClawnch = clawnchStakes.reduce(function(sum, s) { return sum + s.clawnch_amount; }, 0);
            var userInclawnch = contractState.staked;
            var earnedInclawnch = contractState.earned;
            var autoRestakeOn = contractState.autoRestake;

            var hasAnyStake = userClawnch > 0 || userInclawnch > 0;
            if (!hasAnyStake && pendingUnstakes.length === 0) {
                list.innerHTML = '<div class="ubi-no-stakes">No active stakes yet. Stake CLAWNCH or inCLAWNCH above to start earning.</div>';
                renderRedirectWidget(data);
                return;
            }

            // Update on-chain inCLAWNCH stat
            var statIncEl = document.getElementById('statInclawnchStaked');
            if (statIncEl && contractState.totalStaked > 0) {
                statIncEl.textContent = fmt(Math.round(contractState.totalStaked));
            }

            var html = '';

            // ── inCLAWNCH on-chain position ──
            if (userInclawnch > 0 || earnedInclawnch > 0) {
                var earnedUsd = earnedInclawnch * inclawnchPrice;
                var stakedUsd = userInclawnch * inclawnchPrice;

                html += '<div class="ubi-stake-row ubi-stake-row--onchain">';
                html += '<div class="ubi-stake-row-info">';
                html += '<span class="ubi-contrib-token ubi-contrib-token--inclawnch">inCLAWNCH</span>';
                html += '<span class="ubi-stake-row-amount">' + fmt(Math.round(userInclawnch)) + '</span>';
                if (stakedUsd > 0) html += '<span class="ubi-stake-row-usd">~$' + fmtUsd(stakedUsd) + '</span>';
                html += '<span class="ubi-stake-row-days ubi-onchain-badge">on-chain</span>';
                html += '</div>';
                html += '<div class="ubi-stake-row-actions">';
                html += '<button class="btn-unstake" data-token="inclawnch">Unstake</button>';
                html += '</div>';
                html += '</div>';

                // Pending rewards
                if (earnedInclawnch >= 1) {
                    html += '<div class="ubi-rewards-row">';
                    html += '<div class="ubi-rewards-info">';
                    html += '<span class="ubi-rewards-label">Pending Rewards</span>';
                    html += '<span class="ubi-rewards-amount">' + fmt(Math.round(earnedInclawnch)) + ' inCLAWNCH</span>';
                    if (earnedUsd > 0.01) html += '<span class="ubi-rewards-usd">~$' + fmtUsd(earnedUsd) + '</span>';
                    html += '</div>';
                    html += '<div class="ubi-rewards-actions">';
                    html += '<button class="btn-claim" id="btnClaim">Claim</button>';
                    html += '<button class="btn-compound" id="btnCompound">Compound</button>';
                    html += '</div>';
                    html += '</div>';
                }

                // Auto-restake toggle (on-chain)
                var checkedAttr = autoRestakeOn ? ' checked' : '';
                html += '<div class="ubi-autostake-row">';
                html += '<label class="ubi-autostake-toggle">';
                html += '<input type="checkbox" id="autoStakeToggle"' + checkedAttr + '>';
                html += '<span class="ubi-autostake-slider"></span>';
                html += '</label>';
                html += '<div class="ubi-autostake-info">';
                html += '<div class="ubi-autostake-label">Auto-compound rewards</div>';
                html += '<div class="ubi-autostake-desc">When you claim, rewards automatically compound into your staked position.</div>';
                html += '</div>';
                html += '</div>';

                // Reward period info
                if (contractState.periodEnd > 0) {
                    var now = Math.floor(Date.now() / 1000);
                    var timeLeft = contractState.periodEnd - now;
                    var ratePerDay = contractState.rewardRate * 86400;
                    if (timeLeft > 0) {
                        html += '<div class="ubi-reward-period">';
                        var h = Math.floor(timeLeft / 3600);
                        var m = Math.floor((timeLeft % 3600) / 60);
                        html += 'Reward drip: ' + fmt(Math.round(ratePerDay)) + ' inCLAWNCH/day';
                        html += ' &middot; ' + h + 'h ' + m + 'm remaining';
                        html += '</div>';
                    }
                }
            }

            // ── CLAWNCH position (old API) ──
            if (userClawnch > 0) {
                var earliest = clawnchStakes.reduce(function(min, s) { return new Date(s.created_at) < new Date(min) ? s.created_at : min; }, clawnchStakes[0].created_at);
                html += '<div class="ubi-stake-row">';
                html += '<div class="ubi-stake-row-info">';
                html += '<span class="ubi-contrib-token ubi-contrib-token--clawnch">CLAWNCH</span>';
                html += '<span class="ubi-stake-row-amount">' + fmt(userClawnch) + '</span>';
                html += '<span class="ubi-stake-row-days">staking for ' + daysSince(earliest) + '</span>';
                html += '</div>';
                html += '<div class="ubi-stake-row-actions">';
                html += '<button class="btn-unstake" data-token="clawnch">Unstake</button>';
                html += '</div>';
                html += '</div>';
            }

            // CLAWNCH pending unstakes
            if (pendingUnstakes.length > 0) {
                var pendingAmt = pendingUnstakes.reduce(function(s, u) { return s + u.clawnch_amount; }, 0);
                html += '<div class="ubi-unstake-pending">CLAWNCH withdrawal requested: ' + fmt(pendingAmt) + '. Tokens will be sent to your wallet shortly.</div>';
            }

            list.innerHTML = html;

            // Wire up buttons
            list.querySelectorAll('.btn-unstake').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    handleUnstake(btn.getAttribute('data-token'));
                });
            });

            var btnClaim = document.getElementById('btnClaim');
            var btnCompound = document.getElementById('btnCompound');
            if (btnClaim) btnClaim.addEventListener('click', function() { handleClaim(false); });
            if (btnCompound) btnCompound.addEventListener('click', function() { handleClaim(true); });

            // Wire up auto-stake toggle (on-chain)
            var autoToggle = document.getElementById('autoStakeToggle');
            if (autoToggle) {
                autoToggle.addEventListener('change', async function() {
                    autoToggle.disabled = true;
                    var newVal = autoToggle.checked;
                    try {
                        var provider = getProvider();
                        if (!provider) throw new Error('No wallet');
                        var boolPadded = pad32(newVal ? '0x1' : '0x0');
                        await sendTxAndWait(provider, stakeWallet, STAKING_PROXY, SEL.setAutoRestake + boolPadded, null, null);
                        ubiToast(newVal ? 'Auto-compound enabled' : 'Auto-compound disabled', 'success');
                    } catch (e) {
                        autoToggle.checked = !newVal;
                        ubiToast('Failed to update: ' + (e.message || 'Unknown error'), 'error');
                    }
                    autoToggle.disabled = false;
                });
            }

            // Render Redirect Your Energy widget
            renderRedirectWidget(data);

            // Personalized countdown timer
            if (_posCountdownInterval) clearInterval(_posCountdownInterval);
            if (contractState.periodEnd > 0 && userInclawnch > 0) {
                var periodEndMs = contractState.periodEnd * 1000;
                function pcTick() {
                    var now = Date.now();
                    var diff = periodEndMs - now;
                    var timeEl = document.getElementById('posCountdownTime');
                    if (diff <= 0) {
                        if (timeEl) timeEl.textContent = 'Reward period ended';
                    } else {
                        var h = Math.floor(diff / 3600000);
                        var m = Math.floor((diff % 3600000) / 60000);
                        if (timeEl) timeEl.textContent = 'Rewards dripping \u2014 ' + h + 'h ' + m + 'm left';
                    }
                }
                pcTick();
                _posCountdownInterval = setInterval(pcTick, 30000);
            }
        } catch (e) {
            list.innerHTML = '<div class="ubi-no-stakes">Could not load stakes.</div>';
        }
    }

    // ── Unstake wallet available balance ──
    // ── Pending stake recovery (localStorage) ──
    var PENDING_KEY = 'inclawbate_pending_stakes';

    function savePendingStake(txHash, wallet, token) {
        try {
            var pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
            // Avoid duplicates
            if (!pending.find(function(p) { return p.tx === txHash; })) {
                pending.push({ tx: txHash, wallet: wallet, token: token, ts: Date.now() });
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            }
        } catch (e) { /* localStorage unavailable */ }
    }

    function clearPendingStake(txHash) {
        try {
            var pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
            pending = pending.filter(function(p) { return p.tx !== txHash; });
            localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        } catch (e) {}
    }

    async function recordStakeWithRetry(txHash, wallet, token, retries) {
        retries = retries || 5;
        for (var attempt = 0; attempt < retries; attempt++) {
            try {
                var res = await fetch('/api/inclawbate/ubi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'fund', tx_hash: txHash, wallet_address: wallet, token: token })
                });
                var data = await res.json();
                if (res.ok && data.success) return data;
                // 409 = duplicate, already recorded — treat as success
                if (res.status === 409) return { success: true, amount: 0, duplicate: true };
                // Other error — retry
            } catch (e) { /* network error — retry */ }
            if (attempt < retries - 1) {
                await new Promise(function(r) { setTimeout(r, 3000 * (attempt + 1)); });
            }
        }
        return null;
    }

    async function recoverPendingStakes() {
        try {
            var pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
            if (pending.length === 0) return;
            // Only try stakes less than 24h old
            var cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (var i = 0; i < pending.length; i++) {
                var p = pending[i];
                if (p.ts < cutoff) { clearPendingStake(p.tx); continue; }
                var result = await recordStakeWithRetry(p.tx, p.wallet, p.token, 2);
                if (result) clearPendingStake(p.tx);
            }
        } catch (e) {}
    }

    // Run recovery on page load
    recoverPendingStakes();

    var unstakeAvailable = { clawnch: 0, inclawnch: 0 };

    async function fetchUnstakeBalance() {
        try {
            var resp = await fetch('/api/inclawbate/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unstake-balance' })
            });
            var data = await resp.json();
            unstakeAvailable.clawnch = Number(data.clawnch) || 0;
            unstakeAvailable.inclawnch = Number(data.inclawnch) || 0;

            // Update withdrawal liquidity display
            var wlC = document.getElementById('wlClawnch');
            var wlI = document.getElementById('wlInclawnch');
            if (wlC) wlC.textContent = fmt(Math.floor(unstakeAvailable.clawnch));
            if (wlI) wlI.textContent = fmt(Math.floor(unstakeAvailable.inclawnch));
        } catch (e) { /* silent */ }
    }

    // Fetch unstake balance on page load
    fetchUnstakeBalance();

    async function handleUnstake(token) {
        if (MIGRATION_MODE) {
            ubiModal({
                icon: '\uD83D\uDD27',
                title: 'Migration In Progress',
                msg: 'Staking is temporarily paused while we migrate to a new on-chain contract. Will be back live shortly!',
                confirmLabel: 'Got it',
                confirmClass: 'ubi-modal-btn--confirm'
            });
            return;
        }

        // inCLAWNCH uses on-chain contract
        if (token === 'inclawnch') {
            return handleUnstakeOnChain();
        }

        // ── CLAWNCH: Old API flow ──
        var tokenLabel = 'CLAWNCH';
        try {
            var resp0 = await fetch('/api/inclawbate/ubi?wallet=' + stakeWallet.toLowerCase());
            var data0 = await resp0.json();
        } catch(e) {}

        var confirmed = await ubiModal({
            icon: '\uD83E\uDD9E',
            title: 'Unstake ' + tokenLabel,
            msg: 'Unstake all your ' + tokenLabel + '? Tokens will be sent to your wallet.',
            confirmLabel: 'Unstake',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        var btn = document.querySelector('.btn-unstake[data-token="clawnch"]');
        var statusEl = document.querySelector('.stake-status[data-token="clawnch"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending tokens...'; }
        if (statusEl) { statusEl.textContent = 'Sending CLAWNCH back to your wallet...'; statusEl.className = 'ubi-stake-status stake-status'; }

        try {
            var resp = await fetch('/api/inclawbate/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unstake', wallet_address: stakeWallet, token: 'clawnch' })
            });
            var data = await resp.json();

            if (resp.ok && data.success) {
                var newBal = Math.max(0, (Number(ubiData?.total_balance) || 0) - data.amount);
                document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                refreshTreasuryDisplay();

                if (statusEl) {
                    var msg = fmt(data.amount) + ' CLAWNCH returned to your wallet.';
                    if (data.tx_hash) msg += ' <a href="https://basescan.org/tx/' + data.tx_hash + '" target="_blank" style="color:var(--seafoam-300);text-decoration:underline;">View tx</a>';
                    statusEl.innerHTML = msg;
                    statusEl.className = 'ubi-stake-status stake-status success';
                }
                fetchBalances(); fetchUnstakeBalance(); loadMyStakes(); updateAllApys(); updateCalc();
            } else {
                var errMsg = data.error || 'Unstake failed';
                if (statusEl) { statusEl.textContent = errMsg; statusEl.className = 'ubi-stake-status stake-status error'; }
                else ubiToast(errMsg, 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Unstake'; }
            }
        } catch (err) {
            if (statusEl) { statusEl.textContent = 'Unstake failed: ' + (err.message || 'Unknown error'); statusEl.className = 'ubi-stake-status stake-status error'; }
            if (btn) { btn.disabled = false; btn.textContent = 'Unstake'; }
        }
    }

    // ── inCLAWNCH: On-chain unstake ──
    async function handleUnstakeOnChain() {
        var provider = getProvider();
        if (!provider || !stakeWallet) return;

        // Read staked balance from contract
        var balRes = await contractRead(STAKING_PROXY, SEL.balanceOf + pad32(stakeWallet));
        var stakedRaw = BigInt(balRes || '0x0');
        var stakedAmount = fromWei(balRes);

        if (stakedRaw === 0n) {
            ubiToast('No inCLAWNCH staked on-chain', 'error');
            return;
        }

        var confirmed = await ubiModal({
            icon: '\uD83E\uDD9E',
            title: 'Unstake inCLAWNCH',
            msg: 'Unstake ' + fmt(Math.round(stakedAmount)) + ' inCLAWNCH? Tokens will be sent directly to your wallet from the contract.',
            confirmLabel: 'Unstake',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        var btn = document.querySelector('.btn-unstake[data-token="inclawnch"]');
        var statusEl = document.querySelector('.stake-status[data-token="inclawnch"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Unstaking...'; }

        try {
            var unstakeData = SEL.unstake + pad32(toHex(stakedRaw));
            var txHash = await sendTxAndWait(provider, stakeWallet, STAKING_PROXY, unstakeData, statusEl, 'Unstaking inCLAWNCH...');

            if (statusEl) {
                statusEl.innerHTML = fmt(Math.round(stakedAmount)) + ' inCLAWNCH returned to your wallet. <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--seafoam-300);text-decoration:underline;">View tx</a>';
                statusEl.className = 'ubi-stake-status stake-status success';
            }
            ubiToast('Unstaked ' + fmt(Math.round(stakedAmount)) + ' inCLAWNCH', 'success');
            refreshTreasuryDisplay();
            fetchBalances(); loadMyStakes(); updateAllApys(); updateCalc();
        } catch (err) {
            if (statusEl) { statusEl.textContent = err.message || 'Unstake failed'; statusEl.className = 'ubi-stake-status stake-status error'; }
            if (btn) { btn.disabled = false; btn.textContent = 'Unstake'; }
        }
    }

    // ── On-chain claim rewards ──
    async function handleClaim(compound) {
        var provider = getProvider();
        if (!provider || !stakeWallet) return;

        var earnedRes = await contractRead(STAKING_PROXY, SEL.earned + pad32(stakeWallet));
        var earnedAmount = fromWei(earnedRes);
        if (earnedAmount < 1) {
            ubiToast('No rewards to claim yet', 'error');
            return;
        }

        var action = compound ? 'Compound' : 'Claim';
        var confirmed = await ubiModal({
            icon: compound ? '\uD83C\uDF31' : '\uD83E\uDD9E',
            title: action + ' Rewards',
            msg: action + ' ' + fmt(Math.round(earnedAmount)) + ' inCLAWNCH' + (compound ? ' (adds to your staked balance)' : ' (sends to your wallet)') + '?',
            confirmLabel: action,
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        try {
            var selector = compound ? SEL.claimAndRestake : SEL.claim;
            var txHash = await sendTxAndWait(provider, stakeWallet, STAKING_PROXY, selector, null, null);
            ubiToast((compound ? 'Compounded ' : 'Claimed ') + fmt(Math.round(earnedAmount)) + ' inCLAWNCH', 'success');
            fetchBalances(); loadMyStakes(); updateAllApys(); updateCalc();
        } catch (err) {
            ubiToast(err.message || (action + ' failed'), 'error');
        }
    }

    // ── On-chain exit (unstake all + claim all) ──
    async function handleExit() {
        var provider = getProvider();
        if (!provider || !stakeWallet) return;

        var confirmed = await ubiModal({
            icon: '\uD83D\uDEAA',
            title: 'Exit All',
            msg: 'This will unstake all your inCLAWNCH and claim all pending rewards in a single transaction.',
            confirmLabel: 'Exit All',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        try {
            var txHash = await sendTxAndWait(provider, stakeWallet, STAKING_PROXY, SEL.exit, null, null);
            ubiToast('Exited! All tokens and rewards sent to your wallet.', 'success');
            fetchBalances(); loadMyStakes(); updateAllApys(); updateCalc();
        } catch (err) {
            ubiToast(err.message || 'Exit failed', 'error');
        }
    }

    function getInputAmount(token) {
        var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
        if (!input) return 0;
        return parseInt(input.value.replace(/,/g, '')) || 0;
    }

    function setInputAmount(token, amount) {
        var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
        if (!input) return;
        input.value = Math.floor(amount).toLocaleString();
        updateHint(token);
        updateSliderFromInput(token);
        updatePctButtons(token);
    }

    function updateHint(token) {
        var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
        var hint = document.querySelector('.stake-hint[data-token="' + token + '"]');
        var depositBtn = document.querySelector('.stake-deposit-btn[data-token="' + token + '"]');
        if (!input || !hint || !depositBtn) return;
        var amount = getInputAmount(token);
        var price = getPrice(token);
        if (price > 0 && amount > 0) {
            hint.textContent = '~$' + (amount * price).toFixed(2);
        } else {
            hint.textContent = '';
        }
        depositBtn.disabled = amount <= 0 || !stakeWallet;
    }

    function updateSliderFromInput(token) {
        var slider = document.querySelector('.stake-slider[data-token="' + token + '"]');
        if (!slider) return;
        var bal = walletBalances[token] || 0;
        if (bal <= 0) { slider.value = 0; return; }
        var amount = getInputAmount(token);
        slider.value = Math.min(100, Math.round((amount / bal) * 100));
    }

    function updatePctButtons(token) {
        var bal = walletBalances[token] || 0;
        var amount = getInputAmount(token);
        var pct = bal > 0 ? Math.round((amount / bal) * 100) : 0;
        document.querySelectorAll('.stake-pct-row[data-token="' + token + '"] .ubi-stake-pct-btn').forEach(function(btn) {
            var btnPct = parseInt(btn.getAttribute('data-pct'));
            btn.classList.toggle('active', pct === btnPct);
        });
    }

    async function doDeposit(token) {
        if (MIGRATION_MODE) {
            ubiModal({
                icon: '\uD83D\uDD27',
                title: 'Migration In Progress',
                msg: 'Staking is temporarily paused while we migrate to a new on-chain contract. This makes staking fully trustless — no more middleman wallet. Will be back live in a few minutes! Check our Telegram for the announcement.',
                confirmLabel: 'Got it',
                confirmClass: 'ubi-modal-btn--confirm'
            });
            return;
        }
        var depositBtn = document.querySelector('.stake-deposit-btn[data-token="' + token + '"]');
        var status = document.querySelector('.stake-status[data-token="' + token + '"]');
        if (!depositBtn || !status) return;

        var amount = getInputAmount(token);
        if (amount <= 0 || !stakeWallet) return;

        var config = TOKEN_CONFIG[token];

        // inCLAWNCH uses on-chain contract, CLAWNCH uses old API
        if (token === 'inclawnch') {
            return doDepositOnChain(amount, config, depositBtn, status);
        }

        // ── CLAWNCH: Old flow (ERC20 transfer + API recording) ──
        var confirmed = await ubiModal({
            icon: '\u26A0\uFE0F',
            title: 'Staking Disclaimer',
            msg: 'By staking your ' + config.label + ', you acknowledge that your funds may be locked until the next distribution cycle, depending on available liquidity and other factors.',
            confirmLabel: 'I Understand \u2014 Stake',
            cancelLabel: 'Cancel',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        depositBtn.disabled = true;
        status.textContent = 'Sending ' + config.label + ' to UBI treasury...';
        status.className = 'ubi-stake-status stake-status';

        try {
            var provider = getProvider();
            if (!provider) {
                status.textContent = 'No wallet connected';
                status.className = 'ubi-stake-status stake-status error';
                depositBtn.disabled = false;
                return;
            }
            var amountWei = toWei(amount);
            var data = TRANSFER_SELECTOR + pad32(DEPOSIT_WALLET) + pad32(toHex(amountWei));

            var txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: stakeWallet, to: config.address, data: data }]
            });

            status.textContent = 'Confirming transaction...';

            var receipt = null;
            for (var i = 0; i < 60; i++) {
                await new Promise(function(r) { setTimeout(r, 2000); });
                receipt = await provider.request({
                    method: 'eth_getTransactionReceipt', params: [txHash]
                });
                if (receipt) break;
            }

            if (!receipt || receipt.status !== '0x1') {
                throw new Error('Transaction failed or timed out');
            }

            savePendingStake(txHash, stakeWallet, token);
            status.textContent = 'Recording stake...';

            var apiData = await recordStakeWithRetry(txHash, stakeWallet, token);

            if (apiData && apiData.success) {
                clearPendingStake(txHash);
                status.textContent = 'Staked ' + apiData.amount.toLocaleString() + ' ' + config.label + ' in the UBI treasury!';
                status.className = 'ubi-stake-status stake-status success';

                var newBal = (Number(ubiData?.total_balance) || 0) + apiData.amount;
                document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                refreshTreasuryDisplay();
                loadMyStakes();
                fetchBalances();
                updateAllApys();
                updateCalc();
            } else if (apiData && apiData.duplicate) {
                status.textContent = 'Stake already recorded!';
                status.className = 'ubi-stake-status stake-status success';
                loadMyStakes(); fetchBalances(); updateAllApys(); updateCalc();
            } else {
                status.textContent = 'Transaction confirmed on-chain but recording failed. It will be recovered automatically on next page load.';
                status.className = 'ubi-stake-status stake-status error';
            }
        } catch (err) {
            if (typeof txHash === 'string' && txHash.length > 0) {
                status.textContent = 'Transaction may have succeeded. Refresh the page — your stake will be recovered automatically.';
            } else {
                status.textContent = err.message || 'Stake failed';
            }
            status.className = 'ubi-stake-status stake-status error';
        }

        depositBtn.disabled = false;
    }

    // ── inCLAWNCH: On-chain staking via InclawnchStaking contract ──
    async function doDepositOnChain(amount, config, depositBtn, status) {
        var confirmed = await ubiModal({
            icon: '\u26A0\uFE0F',
            title: 'Stake inCLAWNCH On-Chain',
            msg: 'Your inCLAWNCH will be staked in the on-chain contract. You can unstake anytime — no lock, no middleman. You\'ll need to approve the contract to spend your tokens first.',
            confirmLabel: 'Approve & Stake',
            cancelLabel: 'Cancel',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        depositBtn.disabled = true;
        var provider = getProvider();
        if (!provider) {
            status.textContent = 'No wallet connected';
            status.className = 'ubi-stake-status stake-status error';
            depositBtn.disabled = false;
            return;
        }

        var amountWei = toWei(amount);

        try {
            // Step 1: Check allowance
            status.textContent = 'Checking approval...';
            status.className = 'ubi-stake-status stake-status';

            var allowanceData = SEL.allowance + pad32(stakeWallet) + pad32(STAKING_PROXY);
            var allowanceRes = await provider.request({
                method: 'eth_call',
                params: [{ to: INCLAWNCH_ADDRESS, data: allowanceData }, 'latest']
            });
            var currentAllowance = BigInt(allowanceRes || '0x0');

            // Step 2: Approve if needed
            if (currentAllowance < amountWei) {
                status.textContent = 'Requesting token approval...';
                var approveData = SEL.approve + pad32(STAKING_PROXY) + pad32(MAX_UINT256);
                await sendTxAndWait(provider, stakeWallet, INCLAWNCH_ADDRESS, approveData, status, 'Approving contract...');
            }

            // Step 3: Stake
            var stakeData = SEL.stake + pad32(toHex(amountWei));
            var txHash = await sendTxAndWait(provider, stakeWallet, STAKING_PROXY, stakeData, status, 'Staking ' + fmt(amount) + ' inCLAWNCH...');

            status.innerHTML = 'Staked ' + fmt(amount) + ' inCLAWNCH on-chain! <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--seafoam-300);text-decoration:underline;">View tx</a>';
            status.className = 'ubi-stake-status stake-status success';

            // Refresh everything
            refreshTreasuryDisplay();
            loadMyStakes();
            fetchBalances();
            updateAllApys();
            updateCalc();
        } catch (err) {
            status.textContent = err.message || 'Stake failed';
            status.className = 'ubi-stake-status stake-status error';
        }

        depositBtn.disabled = false;
    }

    function refreshTreasuryDisplay() {
        var clawnchBal = Number((document.getElementById('statClawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
        var inclawnchBal = Number((document.getElementById('statInclawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
        document.getElementById('treasuryValue').textContent = fmt(clawnchBal) + ' CLAWNCH + ' + fmt(inclawnchBal) + ' inCLAWNCH';
        var newUsd = (clawnchBal * clawnchPrice) + (inclawnchBal * inclawnchPrice);
        if (clawnchPrice > 0 || inclawnchPrice > 0) {
            document.getElementById('treasuryUsd').textContent = '~$' + fmtUsd(newUsd) + ' USD';
            updateRoadmap(newUsd);
        }
    }

    function disconnectWallet() {
        if (!stakeWallet) return; // already disconnected
        stakeWallet = null;
        walletBalances = { clawnch: 0, inclawnch: 0 };
        if (window.WalletKit && window.WalletKit.isConnected()) window.WalletKit.disconnect();

        // Step flow: undo Step 1 done, re-dim Step 2
        var step1 = document.getElementById('ubiStep1');
        var step2 = document.getElementById('ubiStep2');
        if (step1) step1.classList.remove('ubi-step--done');
        if (step2) step2.classList.add('ubi-step--dimmed');

        // Restore redirect static content
        var redirectContent = document.getElementById('redirectStepContent');
        if (redirectContent) {
            redirectContent.innerHTML = '<p class="ubi-giveback-connect-hint">Connect your wallet to set your split.</p>';
        }
        var kingdomEl = document.getElementById('kingdomInfo');
        if (kingdomEl) kingdomEl.style.display = 'none';

        // Reset connect buttons
        document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
            btn.textContent = 'Connect Wallet';
            btn.classList.remove('connected');
        });
        // Hide forms + fund button
        document.querySelectorAll('.stake-form').forEach(function(form) {
            form.style.display = 'none';
        });
        // Hide balances
        var clawnchEl = document.getElementById('balanceClawnch');
        var inclawnchEl = document.getElementById('balanceInclawnch');
        if (clawnchEl) clawnchEl.style.display = 'none';
        if (inclawnchEl) inclawnchEl.style.display = 'none';
        // Hide your stakes
        var stakesSection = document.getElementById('yourStakesSection');
        if (stakesSection) stakesSection.classList.remove('visible');
        // Clear statuses
        document.querySelectorAll('.stake-status').forEach(function(el) {
            el.textContent = '';
            el.className = 'ubi-stake-status stake-status';
        });
    }

    // Wire up connect buttons (click to connect, click again to disconnect)
    document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (stakeWallet) {
                disconnectWallet();
                return;
            }
            connectWallet();
        });
    });

    // Wire up amount inputs
    document.querySelectorAll('.stake-amount').forEach(function(input) {
        input.addEventListener('input', function() {
            var token = input.getAttribute('data-token');
            updateHint(token);
            updateSliderFromInput(token);
            updatePctButtons(token);
        });
    });

    // Wire up deposit buttons
    document.querySelectorAll('.stake-deposit-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            doDeposit(btn.getAttribute('data-token'));
        });
    });

    // Wire up MAX buttons (in balance display)
    document.querySelectorAll('.bal-max').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var token = btn.getAttribute('data-token');
            var bal = Math.floor(walletBalances[token] || 0);
            if (bal <= 0) return;
            setInputAmount(token, bal);
        });
    });

    // Wire up % buttons
    document.querySelectorAll('.ubi-stake-pct-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var row = btn.closest('.stake-pct-row');
            if (!row) return;
            var token = row.getAttribute('data-token');
            var pct = parseInt(btn.getAttribute('data-pct'));
            var bal = walletBalances[token] || 0;
            if (bal <= 0) return;
            setInputAmount(token, bal * pct / 100);
        });
    });

    // Wire up sliders
    document.querySelectorAll('.stake-slider').forEach(function(slider) {
        slider.addEventListener('input', function() {
            var token = slider.getAttribute('data-token');
            var pct = parseInt(slider.value);
            var bal = walletBalances[token] || 0;
            if (bal <= 0) return;
            var amount = Math.floor(bal * pct / 100);
            var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
            if (input) input.value = amount.toLocaleString();
            updateHint(token);
            updatePctButtons(token);
        });
    });

    // ── WalletKit Integration (when wallet-bundle.js is loaded) ──
    if (window.WalletKit) {
        window.WalletKit.onConnect(function(address) {
            onWalletConnected(address);
        });
        window.WalletKit.onDisconnect(function() {
            disconnectWallet();
        });
        // Auto-reconnect from previous session
        if (window.WalletKit.isConnected()) {
            onWalletConnected(window.WalletKit.getAddress());
        }
    }
    // If WalletKit isn't loaded, connectWallet() falls back to window.ethereum

})();
