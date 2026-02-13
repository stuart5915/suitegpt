// Inclawbate — UBI Treasury Page (Dual Staking: CLAWNCH 1x / inCLAWNCH 2x)

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const INCLAWNCH_ADDRESS = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const BASE_CHAIN_ID = '0x2105';
const TRANSFER_SELECTOR = '0xa9059cbb';
const BALANCE_SELECTOR = '0x70a08231'; // balanceOf(address)
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

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

    // Fetch UBI data, prices, and protocol WETH balance in parallel
    var wethBalCalldata = BALANCE_SELECTOR + pad32(PROTOCOL_WALLET);
    const [ubiRes, clawnchDexRes, inclawnchDexRes, geckoRes, wethBalRes] = await Promise.all([
        fetch('/api/inclawbate/ubi').then(r => r.json()).catch(() => null),
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
        }).then(r => r.json()).catch(() => null)
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

    ubiData = ubiRes;
    const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

    // ── Distribution Countdown Timer ──
    startCountdown();

    // ── Protocol Revenue Section ──
    var protocolWeth = 0;
    if (wethBalRes && wethBalRes.result) {
        protocolWeth = Number(BigInt(wethBalRes.result)) / 1e18;
    }
    updateRevenueSection(protocolWeth, clawnchPrice);

    if (ubiData) {
        const clawnchStaked = Number(ubiData.total_balance) || 0;
        const inclawnchStaked = Number(ubiData.inclawnch_staked) || 0;

        // Treasury display (hidden, for JS compat)
        document.getElementById('treasuryValue').textContent = fmt(clawnchStaked) + ' CLAWNCH + ' + fmt(inclawnchStaked) + ' inCLAWNCH';

        // USD value per token
        const clawnchUsd = clawnchStaked * clawnchPrice;
        const inclawnchUsd = inclawnchStaked * inclawnchPrice;
        const totalUsd = clawnchUsd + inclawnchUsd;
        document.getElementById('treasuryUsd').textContent = '~$' + fmtUsd(totalUsd) + ' USD';

        var tvlCEl = document.getElementById('tvlClawnchUsd');
        var tvlIEl = document.getElementById('tvlInclawnchUsd');
        if (tvlCEl) tvlCEl.textContent = clawnchPrice > 0 ? '~$' + fmtUsd(clawnchUsd) : '';
        if (tvlIEl) tvlIEl.textContent = inclawnchPrice > 0 ? '~$' + fmtUsd(inclawnchUsd) : '';

        // Show fetched CLAWNCH price for transparency
        var priceEl = document.getElementById('treasuryPrice');
        if (priceEl && clawnchPrice > 0) {
            var src = bestPrice(clawnchDexRes, CLAWNCH_ADDRESS) ? 'DexScreener' : 'CoinGecko';
            priceEl.textContent = 'CLAWNCH: $' + clawnchPrice.toFixed(7) + ' (' + src + ')';
        }

        // Stats
        document.getElementById('statClawnchStaked').textContent = fmt(clawnchStaked);
        document.getElementById('statInclawnchStaked').textContent = fmt(inclawnchStaked);
        document.getElementById('statStakers').textContent = fmt(ubiData.total_stakers);

        // APY calculation + card APYs
        updateAllApys();

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
        var totalWeightedStake = clawnchStaked + (inclawnchStaked * 2);

        // Weekly rate is displayed by the countdown tick (accumulating)

        // Per-card APYs
        // 1x CLAWNCH APY: (weekly_rate * 52 * 1) / total_weighted_stake * 100
        // 2x inCLAWNCH APY: (weekly_rate * 52 * 2) / total_weighted_stake * 100
        var clawnchApy = 0;
        var inclawnchApy = 0;
        if (totalWeightedStake > 0 && weeklyRate > 0) {
            clawnchApy = (weeklyRate * 52 * 1) / totalWeightedStake * 100;
            inclawnchApy = (weeklyRate * 52 * 2) / totalWeightedStake * 100;
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

        // Weekly earnings per 100k staked
        if (weeklyClawnchEl) {
            if (totalWeightedStake > 0 && weeklyRate > 0) {
                var per100k = (100000 / totalWeightedStake) * weeklyRate;
                weeklyClawnchEl.innerHTML = 'Earn <span>' + fmt(per100k) + ' CLAWNCH/week</span> per 100k staked';
            } else {
                weeklyClawnchEl.textContent = '';
            }
        }
        if (weeklyInclawnchEl) {
            if (totalWeightedStake > 0 && weeklyRate > 0) {
                var per100k2x = (200000 / totalWeightedStake) * weeklyRate;
                weeklyInclawnchEl.innerHTML = 'Earn <span>' + fmt(per100k2x) + ' CLAWNCH/week</span> per 100k staked';
            } else {
                weeklyInclawnchEl.textContent = '';
            }
        }

        // ── UBI Income Banner ──
        var annualClawnch = weeklyRate * 52;
        var annualUsd = annualClawnch * clawnchPrice;
        var totalStakers = Number(ubiData?.total_stakers) || 0;

        // Pool value = total staked value in USD (CLAWNCH + inCLAWNCH at market prices)
        var poolClawnch = clawnchStaked + (inclawnchStaked * 2); // weighted CLAWNCH equivalent
        var poolUsd = (clawnchStaked * clawnchPrice) + (inclawnchStaked * inclawnchPrice);

        var incomeValEl = document.getElementById('ubiIncomeValue');
        var incomeSubEl = document.getElementById('ubiIncomeSub');
        var incomeWeeklyEl = document.getElementById('ubiIncomeWeekly');
        var incomePerStakerEl = document.getElementById('ubiIncomePerStaker');
        var incomeStakersEl = document.getElementById('ubiIncomeStakers');

        if (incomeValEl) {
            if (weeklyRate > 0 && clawnchPrice > 0) {
                incomeValEl.textContent = '$' + fmtUsd(annualUsd) + ' / year';
            } else if (weeklyRate > 0) {
                incomeValEl.textContent = fmt(annualClawnch) + ' CLAWNCH / year';
            } else if (poolUsd > 0) {
                incomeValEl.textContent = '$' + fmtUsd(poolUsd) + ' Pool';
            } else if (poolClawnch > 0) {
                incomeValEl.textContent = fmt(poolClawnch) + ' CLAWNCH Pool';
            } else {
                incomeValEl.textContent = 'Coming Soon';
            }
        }
        if (incomeSubEl) {
            if (weeklyRate > 0) {
                incomeSubEl.innerHTML = '<strong>' + fmt(annualClawnch) + ' CLAWNCH</strong> distributed annually to all stakers';
            } else if (poolClawnch > 0) {
                incomeSubEl.textContent = fmt(poolClawnch) + ' weighted CLAWNCH staked — set weekly rate from admin to activate distributions';
            } else {
                incomeSubEl.textContent = 'Stake CLAWNCH or inCLAWNCH to grow the UBI pool';
            }
        }
        if (incomeWeeklyEl) {
            incomeWeeklyEl.textContent = weeklyRate > 0 ? fmt(weeklyRate) : '--';
        }
        if (incomePerStakerEl) {
            if (totalStakers > 0 && annualUsd > 0) {
                incomePerStakerEl.textContent = '~$' + fmtUsd(annualUsd / totalStakers);
            } else if (totalStakers > 0 && annualClawnch > 0) {
                incomePerStakerEl.textContent = '~' + fmt(annualClawnch / totalStakers) + ' CLAWNCH';
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

    // ── Distribution Countdown (targets every Sunday 8am local) ──
    function startCountdown() {
        var container = document.getElementById('ubiCountdown');
        if (!container) return;

        var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        function getSunday8am(direction) {
            // direction: 'next' or 'last'
            var now = new Date();
            var day = now.getDay(); // 0 = Sunday
            var target = new Date(now);
            target.setHours(8, 0, 0, 0);

            if (direction === 'next') {
                if (day === 0 && now < target) {
                    // It's Sunday before 8am — target is today
                } else {
                    var daysUntil = (7 - day) % 7 || 7;
                    target.setDate(target.getDate() + daysUntil);
                }
            } else {
                // last Sunday 8am
                if (day === 0 && now >= target) {
                    // It's Sunday after 8am — last was today
                } else {
                    var daysSince = day === 0 ? 7 : day;
                    target.setDate(target.getDate() - daysSince);
                }
            }
            return target;
        }

        var nextDist = getSunday8am('next').getTime();
        var lastDist = getSunday8am('last').getTime();

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
            var progress = Math.min(100, Math.max(0, (elapsed / SEVEN_DAYS) * 100));

            // Update progress bar
            var barFill = document.getElementById('cdBarFill');
            if (barFill) barFill.style.width = progress + '%';

            // Accumulating weekly distribution number
            var cdWeeklyEl = document.getElementById('cdWeeklyAmount');
            var weeklyRate = Number(ubiData?.weekly_rate) || 0;
            if (cdWeeklyEl && weeklyRate > 0) {
                var accumPct = Math.min(1, elapsed / SEVEN_DAYS);
                var accumulated = Math.round(weeklyRate * accumPct);
                cdWeeklyEl.textContent = fmt(accumulated);
            }

            var daysEl = document.getElementById('cdDays');
            var hoursEl = document.getElementById('cdHours');
            var minsEl = document.getElementById('cdMins');
            var secsEl = document.getElementById('cdSecs');

            if (diff <= 0) {
                // Overdue — past Sunday 8am
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

    // Shared wallet connection — connects once, activates both cards
    async function connectWallet() {
        if (stakeWallet) return stakeWallet;
        if (!window.ethereum) {
            document.querySelectorAll('.stake-status').forEach(function(el) {
                el.textContent = 'No wallet found. Install MetaMask or Coinbase Wallet.';
                el.className = 'ubi-stake-status stake-status error';
            });
            return null;
        }
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            stakeWallet = accounts[0];

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

            // Activate both cards
            document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
                btn.textContent = shortAddr(stakeWallet) + ' · Disconnect';
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

            // Load user's stakes
            loadMyStakes();

            return stakeWallet;
        } catch (err) {
            document.querySelectorAll('.stake-status').forEach(function(el) {
                el.textContent = err.message || 'Connection failed';
                el.className = 'ubi-stake-status stake-status error';
            });
            return null;
        }
    }

    // ── Wallet Balances ──
    let walletBalances = { clawnch: 0, inclawnch: 0 };

    async function fetchBalances() {
        if (!stakeWallet) return;
        var callData = BALANCE_SELECTOR + pad32(stakeWallet);

        try {
            var [clawnchResult, inclawnchResult] = await Promise.all([
                window.ethereum.request({
                    method: 'eth_call',
                    params: [{ to: CLAWNCH_ADDRESS, data: callData }, 'latest']
                }),
                window.ethereum.request({
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

    // ── Your Stakes ──
    async function loadMyStakes() {
        if (!stakeWallet) return;

        const section = document.getElementById('yourStakesSection');
        const list = document.getElementById('yourStakesList');
        section.classList.add('visible');

        try {
            const resp = await fetch('/api/inclawbate/ubi?wallet=' + stakeWallet.toLowerCase());
            const data = await resp.json();
            const stakes = data.my_stakes || [];

            const activeStakes = stakes.filter(function(s) { return s.active; });
            const pendingUnstakes = stakes.filter(function(s) { return !s.active && s.unstaked_at && s.withdrawal_status !== 'completed'; });

            if (activeStakes.length === 0 && pendingUnstakes.length === 0) {
                list.innerHTML = '<div class="ubi-no-stakes">No active stakes yet. Stake CLAWNCH or inCLAWNCH above to start earning UBI.</div>';
                return;
            }

            // Group active stakes by token
            var grouped = {};
            activeStakes.forEach(function(s) {
                var token = s.token || 'clawnch';
                if (!grouped[token]) grouped[token] = { amount: 0, earliest: s.created_at };
                grouped[token].amount += s.clawnch_amount;
                if (new Date(s.created_at) < new Date(grouped[token].earliest)) {
                    grouped[token].earliest = s.created_at;
                }
            });

            // Calculate user's estimated weekly UBI
            var userClawnch = grouped.clawnch ? grouped.clawnch.amount : 0;
            var userInclawnch = grouped.inclawnch ? grouped.inclawnch.amount : 0;
            var userWeighted = userClawnch + (userInclawnch * 2);
            var totalClawnchStaked = Number(ubiData?.total_balance) || 0;
            var totalInclawnchStaked = Number(ubiData?.inclawnch_staked) || 0;
            var totalWeightedAll = totalClawnchStaked + (totalInclawnchStaked * 2);
            var weeklyRateVal = Number(ubiData?.weekly_rate) || 0;

            var html = '';

            // Show personalized countdown + earnings widget
            if (userWeighted > 0 && totalWeightedAll > 0 && weeklyRateVal > 0) {
                var sharePct = (userWeighted / totalWeightedAll) * 100;
                var weeklyAllocation = (userWeighted / totalWeightedAll) * weeklyRateVal;
                var weeklyUsdVal = weeklyAllocation * clawnchPrice;
                var yearlyAllocation = weeklyAllocation * 52;
                var yearlyUsdVal = yearlyAllocation * clawnchPrice;

                html += '<div class="ubi-position-countdown" id="posCountdownWidget">';
                html += '<div class="ubi-pc-label" id="posCountdownLabel">NEXT DISTRIBUTION</div>';
                html += '<div class="ubi-pc-amount" id="posCountdownAmount">~' + fmt(Math.round(weeklyAllocation)) + ' CLAWNCH &rarr; your wallet</div>';
                html += '<div class="ubi-pc-timer-row">';
                html += '<div class="ubi-pc-bar"><div class="ubi-pc-bar-fill" id="posCountdownBarFill"></div></div>';
                html += '<div class="ubi-pc-time" id="posCountdownTime">--</div>';
                html += '</div>';
                html += '<div class="ubi-pc-footer">';
                if (clawnchPrice > 0 && weeklyUsdVal >= 0.01) {
                    html += '<span class="ubi-pc-usd">~$' + fmtUsd(weeklyUsdVal) + '/week &middot; ~$' + fmtUsd(yearlyUsdVal) + '/year</span>';
                }
                html += '<span class="ubi-pc-share">' + sharePct.toFixed(2) + '% of pool</span>';
                html += '</div>';
                html += '</div>';
            } else if (userWeighted > 0 && totalWeightedAll > 0) {
                var sharePctOnly = (userWeighted / totalWeightedAll) * 100;
                html += '<div class="ubi-pending-allocation">';
                html += '<div class="ubi-pending-label">Your Pool Share</div>';
                html += '<div class="ubi-pending-value">' + sharePctOnly.toFixed(2) + '%</div>';
                html += '<div class="ubi-pending-detail">' + fmt(userWeighted) + ' weighted stake out of ' + fmt(totalWeightedAll) + ' total. Weekly rate not yet set.</div>';
                html += '</div>';
            }

            Object.keys(grouped).forEach(function(token) {
                var g = grouped[token];
                var tokenLabel = token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
                var tokenClass = 'ubi-contrib-token--' + token;
                html += '<div class="ubi-stake-row">' +
                    '<div class="ubi-stake-row-info">' +
                        '<span class="ubi-contrib-token ' + tokenClass + '">' + tokenLabel + '</span>' +
                        '<span class="ubi-stake-row-amount">' + fmt(g.amount) + '</span>' +
                        '<span class="ubi-stake-row-days">staking for ' + daysSince(g.earliest) + '</span>' +
                    '</div>' +
                    '<button class="btn-unstake" data-token="' + token + '">Unstake</button>' +
                '</div>';
            });

            if (pendingUnstakes.length > 0) {
                var pendingTotal = {};
                pendingUnstakes.forEach(function(s) {
                    var t = s.token || 'clawnch';
                    if (!pendingTotal[t]) pendingTotal[t] = 0;
                    pendingTotal[t] += s.clawnch_amount;
                });
                var parts = [];
                Object.keys(pendingTotal).forEach(function(t) {
                    var label = t === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
                    parts.push(fmt(pendingTotal[t]) + ' ' + label);
                });
                html += '<div class="ubi-unstake-pending">Withdrawal requested: ' + parts.join(', ') + '. Your tokens will be sent to your wallet shortly.</div>';
            }

            list.innerHTML = html;

            // Wire up unstake buttons
            list.querySelectorAll('.btn-unstake').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    handleUnstake(btn.getAttribute('data-token'));
                });
            });

            // Start personalized countdown timer
            if (_posCountdownInterval) clearInterval(_posCountdownInterval);
            var pcWidget = document.getElementById('posCountdownWidget');
            if (pcWidget) {
                var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

                function getPcSunday8am(dir) {
                    var now = new Date();
                    var day = now.getDay();
                    var t = new Date(now);
                    t.setHours(8, 0, 0, 0);
                    if (dir === 'next') {
                        if (day === 0 && now < t) { /* today */ }
                        else { t.setDate(t.getDate() + ((7 - day) % 7 || 7)); }
                    } else {
                        if (day === 0 && now >= t) { /* today */ }
                        else { t.setDate(t.getDate() - (day === 0 ? 7 : day)); }
                    }
                    return t;
                }

                var pcNext = getPcSunday8am('next').getTime();
                var pcLast = getPcSunday8am('last').getTime();

                function pcTick() {
                    var now = Date.now();
                    var diff = pcNext - now;
                    var elapsed = now - pcLast;
                    var progress = Math.min(100, Math.max(0, (elapsed / SEVEN_DAYS) * 100));

                    var barFill = document.getElementById('posCountdownBarFill');
                    var timeEl = document.getElementById('posCountdownTime');
                    var labelEl = document.getElementById('posCountdownLabel');
                    var amountEl = document.getElementById('posCountdownAmount');

                    if (barFill) barFill.style.width = progress + '%';

                    if (diff <= 0) {
                        // Overdue
                        if (!pcWidget.classList.contains('ubi-pc-overdue')) {
                            pcWidget.classList.add('ubi-pc-overdue');
                            if (labelEl) labelEl.textContent = 'DISTRIBUTION READY';
                            if (amountEl) amountEl.innerHTML = amountEl.innerHTML.replace('\u2192 your wallet', '\u2192 your wallet soon!');
                        }
                        if (timeEl) timeEl.textContent = 'Incoming\u2026';
                    } else {
                        pcWidget.classList.remove('ubi-pc-overdue');
                        var d = Math.floor(diff / 86400000);
                        var h = Math.floor((diff % 86400000) / 3600000);
                        var m = Math.floor((diff % 3600000) / 60000);
                        if (timeEl) timeEl.textContent = d + 'd ' + h + 'h ' + m + 'm';
                    }
                }

                pcTick();
                _posCountdownInterval = setInterval(pcTick, 1000);
            }
        } catch (e) {
            list.innerHTML = '<div class="ubi-no-stakes">Could not load stakes.</div>';
        }
    }

    // ── Unstake wallet available balance ──
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

            // Banner removed from UI — data still used internally by handleUnstake
        } catch (e) { /* silent */ }
    }

    // Fetch unstake balance on page load
    fetchUnstakeBalance();

    async function handleUnstake(token) {
        var tokenLabel = token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';

        // Check if enough available
        var userAmount = 0;
        var grouped = {};
        var section = document.getElementById('yourStakesList');
        // Re-read from stakes data
        try {
            var resp0 = await fetch('/api/inclawbate/ubi?wallet=' + stakeWallet.toLowerCase());
            var data0 = await resp0.json();
            var activeForToken = (data0.my_stakes || []).filter(function(s) { return s.active && (s.token || 'clawnch') === token; });
            userAmount = activeForToken.reduce(function(sum, s) { return sum + s.clawnch_amount; }, 0);
        } catch(e) {}

        var available = token === 'inclawnch' ? unstakeAvailable.inclawnch : unstakeAvailable.clawnch;
        var isInstant = available >= userAmount;

        var confirmTitle = isInstant ? 'Unstake ' + tokenLabel : 'Request Withdrawal';
        var confirmMsg = isInstant
            ? 'Unstake all your ' + tokenLabel + '? Tokens will be sent to your wallet instantly.'
            : 'Unstake all your ' + tokenLabel + '? Your withdrawal exceeds what\u2019s available for instant transfer. Your tokens will be returned to your wallet \u2014 usually within an hour, but it may take up to 24 hours.';

        var confirmed = await ubiModal({
            icon: isInstant ? '\uD83E\uDD9E' : '\u23F3',
            title: confirmTitle,
            msg: confirmMsg,
            confirmLabel: isInstant ? 'Unstake' : 'Request',
            confirmClass: 'ubi-modal-btn--confirm'
        });
        if (!confirmed) return;

        var btn = document.querySelector('.btn-unstake[data-token="' + token + '"]');
        var statusEl = document.querySelector('.stake-status[data-token="' + token + '"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = isInstant ? 'Sending tokens...' : 'Requesting...';
        }
        if (statusEl) {
            statusEl.textContent = isInstant ? 'Sending ' + tokenLabel + ' back to your wallet...' : 'Submitting withdrawal request...';
            statusEl.className = 'ubi-stake-status stake-status';
        }

        try {
            var resp = await fetch('/api/inclawbate/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unstake',
                    wallet_address: stakeWallet,
                    token: token
                })
            });
            var data = await resp.json();

            if (resp.ok && data.success) {
                // Update treasury display
                if (token === 'clawnch') {
                    var newBal = Math.max(0, (Number(ubiData?.total_balance) || 0) - data.amount);
                    document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                } else {
                    var newInc = Math.max(0, (Number(ubiData?.inclawnch_staked) || 0) - data.amount);
                    document.getElementById('statInclawnchStaked').textContent = fmt(newInc);
                }
                var cStaked = Number((document.getElementById('statClawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
                var iStaked = Number((document.getElementById('statInclawnchStaked').textContent || '0').replace(/,/g, '')) || 0;
                document.getElementById('treasuryValue').textContent = fmt(cStaked) + ' CLAWNCH + ' + fmt(iStaked) + ' inCLAWNCH';

                if (statusEl) {
                    if (data.instant && data.tx_hash) {
                        statusEl.innerHTML = fmt(data.amount) + ' ' + tokenLabel + ' returned to your wallet. <a href="https://basescan.org/tx/' + data.tx_hash + '" target="_blank" style="color:var(--seafoam-300);text-decoration:underline;">View tx</a>';
                        statusEl.className = 'ubi-stake-status stake-status success';
                    } else {
                        statusEl.innerHTML = 'Withdrawal requested for ' + fmt(data.amount) + ' ' + tokenLabel + '. Your tokens will be sent shortly once the withdrawal wallet is funded.';
                        statusEl.className = 'ubi-stake-status stake-status success';
                    }
                }

                fetchBalances();
                fetchUnstakeBalance();
                loadMyStakes();
                updateAllApys();
            } else {
                var errMsg = data.error || 'Unstake failed';
                if (statusEl) {
                    statusEl.textContent = errMsg;
                    statusEl.className = 'ubi-stake-status stake-status error';
                } else {
                    ubiToast(errMsg, 'error');
                }
                if (btn) { btn.disabled = false; btn.textContent = 'Unstake'; }
            }
        } catch (err) {
            var errText = 'Unstake failed: ' + (err.message || 'Unknown error');
            if (statusEl) {
                statusEl.textContent = errText;
                statusEl.className = 'ubi-stake-status stake-status error';
            } else {
                ubiToast(errText, 'error');
            }
            if (btn) { btn.disabled = false; btn.textContent = 'Unstake'; }
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
        var depositBtn = document.querySelector('.stake-deposit-btn[data-token="' + token + '"]');
        var status = document.querySelector('.stake-status[data-token="' + token + '"]');
        if (!depositBtn || !status) return;

        var amount = getInputAmount(token);
        if (amount <= 0 || !stakeWallet) return;

        var config = TOKEN_CONFIG[token];
        depositBtn.disabled = true;
        status.textContent = 'Sending ' + config.label + ' to UBI treasury...';
        status.className = 'ubi-stake-status stake-status';

        try {
            var amountWei = toWei(amount);
            var data = TRANSFER_SELECTOR + pad32(PROTOCOL_WALLET) + pad32(toHex(amountWei));

            var txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: stakeWallet,
                    to: config.address,
                    data: data
                }]
            });

            status.textContent = 'Confirming transaction...';

            var receipt = null;
            for (var i = 0; i < 60; i++) {
                await new Promise(function(r) { setTimeout(r, 2000); });
                receipt = await window.ethereum.request({
                    method: 'eth_getTransactionReceipt',
                    params: [txHash]
                });
                if (receipt) break;
            }

            if (!receipt || receipt.status !== '0x1') {
                throw new Error('Transaction failed or timed out');
            }

            status.textContent = 'Recording stake...';

            var apiRes = await fetch('/api/inclawbate/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'fund',
                    tx_hash: txHash,
                    wallet_address: stakeWallet,
                    token: token
                })
            });
            var apiData = await apiRes.json();

            if (apiRes.ok && apiData.success) {
                status.textContent = 'Staked ' + apiData.amount.toLocaleString() + ' ' + config.label + ' in the UBI treasury!';
                status.className = 'ubi-stake-status stake-status success';

                // Update treasury display
                if (token === 'clawnch') {
                    var newBal = (Number(ubiData?.total_balance) || 0) + apiData.amount;
                    document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                } else {
                    var newInc = (Number(ubiData?.inclawnch_staked) || 0) + apiData.amount;
                    document.getElementById('statInclawnchStaked').textContent = fmt(newInc);
                }

                // Recalculate USD + roadmap + TVL subtitle
                var clawnchBal = Number(document.getElementById('statClawnchStaked').textContent.replace(/,/g, '')) || 0;
                var inclawnchBal = Number(document.getElementById('statInclawnchStaked').textContent.replace(/,/g, '')) || 0;
                document.getElementById('treasuryValue').textContent = fmt(clawnchBal) + ' CLAWNCH + ' + fmt(inclawnchBal) + ' inCLAWNCH';
                var newUsd = (clawnchBal * clawnchPrice) + (inclawnchBal * inclawnchPrice);
                if (clawnchPrice > 0 || inclawnchPrice > 0) {
                    document.getElementById('treasuryUsd').textContent = '~$' + newUsd.toFixed(2) + ' USD';
                    updateRoadmap(newUsd);
                }

                // Reload user's stakes + balance + APY
                loadMyStakes();
                fetchBalances();
                updateAllApys();
            } else {
                status.textContent = apiData.error || 'Failed to record stake';
                status.className = 'ubi-stake-status stake-status error';
            }
        } catch (err) {
            status.textContent = err.message || 'Stake failed';
            status.className = 'ubi-stake-status stake-status error';
        }

        depositBtn.disabled = false;
    }

    function disconnectWallet() {
        stakeWallet = null;
        walletBalances = { clawnch: 0, inclawnch: 0 };

        // Reset connect buttons
        document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
            btn.textContent = 'Connect Wallet';
            btn.classList.remove('connected');
        });
        // Hide forms
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
})();
