// Leaderboard + Weekly Rewards + Fund the Pool

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const BASE_CHAIN_ID = '0x2105';
const TRANSFER_SELECTOR = '0xa9059cbb'; // transfer(address,uint256)

function esc(str) {
    var div = document.createElement('div');
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

(async function() {
    const list = document.getElementById('leaderboardList');

    // Load rewards config and leaderboard in parallel
    const [rewardsRes, lbRes] = await Promise.all([
        fetch('/api/inclawbate/rewards').then(r => r.json()).catch(() => null),
        fetch('/api/inclawbate/leaderboard').then(r => r.json()).catch(() => null)
    ]);

    // ── Rewards Banner ──
    if (rewardsRes) {
        const banner = document.getElementById('rewardsBanner');
        banner.style.display = '';

        const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

        document.getElementById('rewardsPool').textContent = fmt(rewardsRes.current_pool) + ' CLAWNCH';
        document.getElementById('rewardsTopN').textContent = rewardsRes.top_n || 10;
        document.getElementById('statLastWeek').textContent = fmt(rewardsRes.last_distributed);
        document.getElementById('statThisWeek').textContent = fmt(rewardsRes.current_pool);
        document.getElementById('statNextWeek').textContent = fmt(rewardsRes.next_pool);
        document.getElementById('statTotal').textContent = fmt(rewardsRes.total_distributed);

        // Countdown
        if (rewardsRes.week_ends_at) {
            const endTime = new Date(rewardsRes.week_ends_at).getTime();
            const cdDays = document.getElementById('cdDays');
            const cdHours = document.getElementById('cdHours');
            const cdMins = document.getElementById('cdMins');
            const cdSecs = document.getElementById('cdSecs');
            const countdownEl = document.getElementById('countdown');

            function tick() {
                const now = Date.now();
                const diff = endTime - now;

                if (diff <= 0) {
                    countdownEl.innerHTML = '<div class="countdown-ended">Week ended — rewards distributing soon!</div>';
                    return;
                }

                const d = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);

                cdDays.textContent = d;
                cdHours.textContent = String(h).padStart(2, '0');
                cdMins.textContent = String(m).padStart(2, '0');
                cdSecs.textContent = String(s).padStart(2, '0');

                requestAnimationFrame(tick);
            }
            tick();
        }

        // ── Contributors ──
        if (rewardsRes.contributors && rewardsRes.contributors.length > 0) {
            const section = document.getElementById('contributorsSection');
            section.style.display = '';
            const cList = document.getElementById('contributorsList');
            cList.innerHTML = rewardsRes.contributors.map(function(c) {
                const name = c.x_name || c.x_handle || shortAddr(c.wallet_address);
                const amount = Math.round(Number(c.clawnch_amount) || 0).toLocaleString();
                const ago = timeAgo(c.created_at);
                return '<div class="contributor-row">' +
                    '<span class="contributor-name">' + esc(name) + '</span>' +
                    '<span class="contributor-amount">' + amount + ' CLAWNCH</span>' +
                    '<span class="contributor-time">' + ago + '</span>' +
                '</div>';
            }).join('');
        }
    }

    // ── Fund the Pool ──
    let fundWallet = null;
    let clawnchPrice = 0;
    const fundConnectBtn = document.getElementById('fundConnectBtn');
    const fundForm = document.getElementById('fundForm');
    const fundAmountInput = document.getElementById('fundAmountInput');
    const fundDepositBtn = document.getElementById('fundDepositBtn');
    const fundStatus = document.getElementById('fundStatus');
    const fundHint = document.getElementById('fundHint');

    // Fetch CLAWNCH price
    try {
        const priceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const priceData = await priceRes.json();
        const pair = priceData.pairs && priceData.pairs[0];
        if (pair) clawnchPrice = parseFloat(pair.priceUsd) || 0;
    } catch (e) { /* no price */ }

    function updateFundHint() {
        const amount = parseInt(fundAmountInput.value) || 0;
        if (clawnchPrice > 0 && amount > 0) {
            fundHint.textContent = '~$' + (amount * clawnchPrice).toFixed(2);
        } else {
            fundHint.textContent = '';
        }
        fundDepositBtn.disabled = amount <= 0 || !fundWallet;
    }

    fundAmountInput.addEventListener('input', updateFundHint);

    fundConnectBtn.addEventListener('click', async function() {
        if (fundWallet) return;
        if (!window.ethereum) {
            fundStatus.textContent = 'No wallet found. Install MetaMask or Coinbase Wallet.';
            fundStatus.className = 'fund-pool-status error';
            return;
        }
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            fundWallet = accounts[0];

            // Switch to Base
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

            fundConnectBtn.textContent = shortAddr(fundWallet);
            fundConnectBtn.classList.add('connected');
            fundForm.style.display = '';
            updateFundHint();
        } catch (err) {
            fundStatus.textContent = err.message || 'Connection failed';
            fundStatus.className = 'fund-pool-status error';
        }
    });

    fundDepositBtn.addEventListener('click', async function() {
        const amount = parseInt(fundAmountInput.value) || 0;
        if (amount <= 0 || !fundWallet) return;

        fundDepositBtn.disabled = true;
        fundStatus.textContent = 'Sending CLAWNCH...';
        fundStatus.className = 'fund-pool-status';

        try {
            const amountWei = toWei(amount);
            const data = TRANSFER_SELECTOR + pad32(PROTOCOL_WALLET) + pad32(toHex(amountWei));

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: fundWallet,
                    to: CLAWNCH_ADDRESS,
                    data: data
                }]
            });

            fundStatus.textContent = 'Confirming transaction...';

            // Wait for receipt
            let receipt = null;
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 2000));
                receipt = await window.ethereum.request({
                    method: 'eth_getTransactionReceipt',
                    params: [txHash]
                });
                if (receipt) break;
            }

            if (!receipt || receipt.status !== '0x1') {
                throw new Error('Transaction failed or timed out');
            }

            fundStatus.textContent = 'Recording contribution...';

            // Call API to record
            const apiRes = await fetch('/api/inclawbate/rewards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'pool-deposit',
                    tx_hash: txHash,
                    wallet_address: fundWallet
                })
            });
            const apiData = await apiRes.json();

            if (apiRes.ok && apiData.success) {
                fundStatus.textContent = 'Deposited ' + apiData.amount.toLocaleString() + ' CLAWNCH to the pool!';
                fundStatus.className = 'fund-pool-status success';

                // Update pool display
                const poolEl = document.getElementById('rewardsPool');
                const thisWeekEl = document.getElementById('statThisWeek');
                if (poolEl && thisWeekEl) {
                    const newPool = Math.round(Number(apiData.amount) + (Number(rewardsRes.current_pool) || 0));
                    poolEl.textContent = newPool.toLocaleString() + ' CLAWNCH';
                    thisWeekEl.textContent = newPool.toLocaleString();
                }
            } else {
                fundStatus.textContent = apiData.error || 'Failed to record deposit';
                fundStatus.className = 'fund-pool-status error';
            }
        } catch (err) {
            fundStatus.textContent = err.message || 'Deposit failed';
            fundStatus.className = 'fund-pool-status error';
        }

        fundDepositBtn.disabled = false;
    });

    // ── Leaderboard ──
    if (!lbRes || !lbRes.leaderboard || lbRes.leaderboard.length === 0) {
        list.innerHTML = '<div class="lb-empty"><p>No replies generated yet. Be the first!</p></div>';
        return;
    }

    list.innerHTML = lbRes.leaderboard.map(function(user) {
        var rankClass = user.rank <= 3 ? ' lb-rank-' + user.rank : '';
        var avatar = user.x_avatar_url || '';
        var name = user.x_name || user.x_handle;
        var handle = user.x_handle;
        var replies = user.total_replies.toLocaleString();

        return '<a href="/u/' + encodeURIComponent(handle) + '" class="lb-row">' +
            '<div class="lb-rank' + rankClass + '">' + user.rank + '</div>' +
            (avatar ? '<img class="lb-avatar" src="' + esc(avatar) + '" alt="" loading="lazy">' : '<div class="lb-avatar"></div>') +
            '<div class="lb-info">' +
                '<div class="lb-name">' + esc(name) + '</div>' +
                '<div class="lb-handle">@' + esc(handle) + '</div>' +
            '</div>' +
            '<div class="lb-replies">' + replies + ' replies</div>' +
        '</a>';
    }).join('');
})();
