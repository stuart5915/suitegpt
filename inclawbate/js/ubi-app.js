// Inclawbate — UBI Treasury Page (Dual Staking: CLAWNCH 1x / inCLAWNCH 2x)

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const INCLAWNCH_ADDRESS = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const BASE_CHAIN_ID = '0x2105';
const TRANSFER_SELECTOR = '0xa9059cbb';

const TOKEN_CONFIG = {
    clawnch: { address: CLAWNCH_ADDRESS, label: 'CLAWNCH' },
    inclawnch: { address: INCLAWNCH_ADDRESS, label: 'inCLAWNCH' }
};

// Roadmap milestones (USD targets)
const MILESTONES = [100000, 500000, 1000000, 5000000, 10000000, 25000000, 50000000];

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

    // Fetch UBI data and prices in parallel
    const [ubiRes, clawnchPriceRes, inclawnchPriceRes] = await Promise.all([
        fetch('/api/inclawbate/ubi').then(r => r.json()).catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS)
            .then(r => r.json()).catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + INCLAWNCH_ADDRESS)
            .then(r => r.json()).catch(() => null)
    ]);

    if (clawnchPriceRes && clawnchPriceRes.pairs && clawnchPriceRes.pairs[0]) {
        clawnchPrice = parseFloat(clawnchPriceRes.pairs[0].priceUsd) || 0;
    }
    if (inclawnchPriceRes && inclawnchPriceRes.pairs && inclawnchPriceRes.pairs[0]) {
        inclawnchPrice = parseFloat(inclawnchPriceRes.pairs[0].priceUsd) || 0;
    }

    ubiData = ubiRes;
    const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

    if (ubiData) {
        const clawnchStaked = Number(ubiData.total_balance) || 0;
        const inclawnchStaked = Number(ubiData.inclawnch_staked) || 0;

        // Treasury main display: total value in CLAWNCH equivalent
        document.getElementById('treasuryValue').textContent = fmt(clawnchStaked) + ' CLAWNCH';

        // USD value (both tokens combined)
        const totalUsd = (clawnchStaked * clawnchPrice) + (inclawnchStaked * inclawnchPrice);
        if (clawnchPrice > 0 || inclawnchPrice > 0) {
            document.getElementById('treasuryUsd').textContent = '~$' + totalUsd.toFixed(2) + ' USD';
        } else {
            document.getElementById('treasuryUsd').textContent = '';
        }

        // Stats
        document.getElementById('statClawnchStaked').textContent = fmt(clawnchStaked);
        document.getElementById('statInclawnchStaked').textContent = fmt(inclawnchStaked);
        document.getElementById('statStakers').textContent = fmt(ubiData.total_stakers);

        // APY: (weekly_rate * 52) / total_weighted_stake * 100
        const weeklyRate = Number(ubiData.weekly_rate) || 0;
        const totalWeightedStake = clawnchStaked + (inclawnchStaked * 2);
        if (totalWeightedStake > 0 && weeklyRate > 0) {
            const apy = ((weeklyRate * 52) / totalWeightedStake * 100).toFixed(1);
            document.getElementById('statApy').textContent = apy + '%';
        }

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
                btn.textContent = shortAddr(stakeWallet);
                btn.classList.add('connected');
            });
            document.querySelectorAll('.stake-form').forEach(function(form) {
                form.style.display = '';
            });
            // Update hints for both
            document.querySelectorAll('.stake-amount').forEach(function(input) {
                updateHint(input.getAttribute('data-token'));
            });

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
            const pendingUnstakes = stakes.filter(function(s) { return !s.active && s.unstaked_at; });

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

            var html = '';
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
                html += '<div class="ubi-unstake-pending">Pending return: ' + parts.join(', ') + '. Your tokens will be returned in the next weekly distribution.</div>';
            }

            list.innerHTML = html;

            // Wire up unstake buttons
            list.querySelectorAll('.btn-unstake').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    handleUnstake(btn.getAttribute('data-token'));
                });
            });
        } catch (e) {
            list.innerHTML = '<div class="ubi-no-stakes">Could not load stakes.</div>';
        }
    }

    async function handleUnstake(token) {
        var tokenLabel = token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
        if (!confirm('Unstake all your ' + tokenLabel + '? Your tokens will be returned in the next weekly distribution.')) {
            return;
        }

        var btn = document.querySelector('.btn-unstake[data-token="' + token + '"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Unstaking...';
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
                    document.getElementById('treasuryValue').textContent = fmt(newBal) + ' CLAWNCH';
                    document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                } else {
                    var newInc = Math.max(0, (Number(ubiData?.inclawnch_staked) || 0) - data.amount);
                    document.getElementById('statInclawnchStaked').textContent = fmt(newInc);
                }

                // Reload stakes
                loadMyStakes();
            } else {
                alert(data.error || 'Unstake failed');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Unstake';
                }
            }
        } catch (err) {
            alert('Unstake failed: ' + (err.message || 'Unknown error'));
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Unstake';
            }
        }
    }

    function updateHint(token) {
        var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
        var hint = document.querySelector('.stake-hint[data-token="' + token + '"]');
        var depositBtn = document.querySelector('.stake-deposit-btn[data-token="' + token + '"]');
        if (!input || !hint || !depositBtn) return;
        var amount = parseInt(input.value) || 0;
        var price = getPrice(token);
        if (price > 0 && amount > 0) {
            hint.textContent = '~$' + (amount * price).toFixed(2);
        } else {
            hint.textContent = '';
        }
        depositBtn.disabled = amount <= 0 || !stakeWallet;
    }

    async function doDeposit(token) {
        var input = document.querySelector('.stake-amount[data-token="' + token + '"]');
        var depositBtn = document.querySelector('.stake-deposit-btn[data-token="' + token + '"]');
        var status = document.querySelector('.stake-status[data-token="' + token + '"]');
        if (!input || !depositBtn || !status) return;

        var amount = parseInt(input.value) || 0;
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
                    document.getElementById('treasuryValue').textContent = fmt(newBal) + ' CLAWNCH';
                    document.getElementById('statClawnchStaked').textContent = fmt(newBal);
                } else {
                    var newInc = (Number(ubiData?.inclawnch_staked) || 0) + apiData.amount;
                    document.getElementById('statInclawnchStaked').textContent = fmt(newInc);
                }

                // Recalculate USD + roadmap
                var clawnchBal = Number(document.getElementById('statClawnchStaked').textContent.replace(/,/g, '')) || 0;
                var inclawnchBal = Number(document.getElementById('statInclawnchStaked').textContent.replace(/,/g, '')) || 0;
                var newUsd = (clawnchBal * clawnchPrice) + (inclawnchBal * inclawnchPrice);
                if (clawnchPrice > 0 || inclawnchPrice > 0) {
                    document.getElementById('treasuryUsd').textContent = '~$' + newUsd.toFixed(2) + ' USD';
                    updateRoadmap(newUsd);
                }

                // Reload user's stakes
                loadMyStakes();
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

    // Wire up connect buttons (both trigger shared wallet connection)
    document.querySelectorAll('.stake-connect-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (stakeWallet) return;
            connectWallet();
        });
    });

    // Wire up amount inputs
    document.querySelectorAll('.stake-amount').forEach(function(input) {
        input.addEventListener('input', function() {
            updateHint(input.getAttribute('data-token'));
        });
    });

    // Wire up deposit buttons
    document.querySelectorAll('.stake-deposit-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            doDeposit(btn.getAttribute('data-token'));
        });
    });
})();
