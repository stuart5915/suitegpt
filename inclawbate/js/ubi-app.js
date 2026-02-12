// Inclawbate — UBI Treasury Page

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const BASE_CHAIN_ID = '0x2105';
const TRANSFER_SELECTOR = '0xa9059cbb';

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

(async function() {
    let clawnchPrice = 0;
    let ubiData = null;

    // Fetch UBI data and CLAWNCH price in parallel
    const [ubiRes, priceRes] = await Promise.all([
        fetch('/api/inclawbate/ubi').then(r => r.json()).catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS)
            .then(r => r.json()).catch(() => null)
    ]);

    if (priceRes && priceRes.pairs && priceRes.pairs[0]) {
        clawnchPrice = parseFloat(priceRes.pairs[0].priceUsd) || 0;
    }

    ubiData = ubiRes;
    const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

    if (ubiData) {
        const balance = Number(ubiData.total_balance) || 0;
        document.getElementById('treasuryValue').textContent = fmt(balance) + ' CLAWNCH';

        if (clawnchPrice > 0) {
            document.getElementById('treasuryUsd').textContent = '~$' + (balance * clawnchPrice).toFixed(2) + ' USD';
        } else {
            document.getElementById('treasuryUsd').textContent = '';
        }

        document.getElementById('statDistributed').textContent = fmt(ubiData.total_distributed);

        const weeklyRate = Number(ubiData.weekly_rate) || 0;
        const monthlyRate = weeklyRate * 4.33;
        document.getElementById('statMonthly').textContent = monthlyRate > 0 ? fmt(monthlyRate) : '--';

        const eligible = ubiData.total_eligible || 0;
        document.getElementById('statEligible').textContent = fmt(eligible);

        // Rough APY estimate: (monthly yield / treasury) * 12 * 100
        if (balance > 0 && monthlyRate > 0) {
            const apy = ((monthlyRate / balance) * 12 * 100).toFixed(1);
            document.getElementById('statApy').textContent = apy + '%';
        }

        // ── Roadmap ──
        const treasuryUsd = balance * clawnchPrice;
        updateRoadmap(treasuryUsd);

        // Contributors
        if (ubiData.contributors && ubiData.contributors.length > 0) {
            const cList = document.getElementById('contributorsList');
            cList.innerHTML = ubiData.contributors.map(function(c) {
                const name = c.x_name || c.x_handle || shortAddr(c.wallet_address);
                const amount = fmt(c.clawnch_amount);
                const ago = timeAgo(c.created_at);
                return '<div class="ubi-contrib-row">' +
                    '<span class="ubi-contrib-name">' + esc(name) + '</span>' +
                    '<span class="ubi-contrib-amount">' + amount + ' CLAWNCH</span>' +
                    '<span class="ubi-contrib-time">' + ago + '</span>' +
                '</div>';
            }).join('');
        }
    } else {
        // Still update roadmap with 0 if no data
        updateRoadmap(0);
    }

    // ── Roadmap Logic ──
    function updateRoadmap(treasuryUsd) {
        const maxTarget = MILESTONES[MILESTONES.length - 1];

        // Fill the progress bar
        const fillEl = document.getElementById('roadmapFill');
        if (fillEl) {
            // Use logarithmic scale for better visual representation
            const pct = treasuryUsd <= 0 ? 0 : Math.min(100, (Math.log10(treasuryUsd) / Math.log10(maxTarget)) * 100);
            setTimeout(function() { fillEl.style.width = pct + '%'; }, 300);
        }

        // Place milestone dots on the progress bar
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

        // Update milestone cards
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

    // ── Fund the Treasury ──
    let fundWallet = null;
    const connectBtn = document.getElementById('ubiConnectBtn');
    const fundForm = document.getElementById('ubiFundForm');
    const amountInput = document.getElementById('ubiAmountInput');
    const depositBtn = document.getElementById('ubiDepositBtn');
    const fundStatus = document.getElementById('ubiFundStatus');
    const hint = document.getElementById('ubiHint');

    function updateHint() {
        const amount = parseInt(amountInput.value) || 0;
        if (clawnchPrice > 0 && amount > 0) {
            hint.textContent = '~$' + (amount * clawnchPrice).toFixed(2);
        } else {
            hint.textContent = '';
        }
        depositBtn.disabled = amount <= 0 || !fundWallet;
    }

    amountInput.addEventListener('input', updateHint);

    connectBtn.addEventListener('click', async function() {
        if (fundWallet) return;
        if (!window.ethereum) {
            fundStatus.textContent = 'No wallet found. Install MetaMask or Coinbase Wallet.';
            fundStatus.className = 'ubi-fund-status error';
            return;
        }
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            fundWallet = accounts[0];

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

            connectBtn.textContent = shortAddr(fundWallet);
            connectBtn.classList.add('connected');
            fundForm.style.display = '';
            updateHint();
        } catch (err) {
            fundStatus.textContent = err.message || 'Connection failed';
            fundStatus.className = 'ubi-fund-status error';
        }
    });

    depositBtn.addEventListener('click', async function() {
        const amount = parseInt(amountInput.value) || 0;
        if (amount <= 0 || !fundWallet) return;

        depositBtn.disabled = true;
        fundStatus.textContent = 'Sending CLAWNCH to UBI treasury...';
        fundStatus.className = 'ubi-fund-status';

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

            const apiRes = await fetch('/api/inclawbate/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'fund',
                    tx_hash: txHash,
                    wallet_address: fundWallet
                })
            });
            const apiData = await apiRes.json();

            if (apiRes.ok && apiData.success) {
                fundStatus.textContent = 'Deposited ' + apiData.amount.toLocaleString() + ' CLAWNCH to the UBI treasury!';
                fundStatus.className = 'ubi-fund-status success';

                // Update treasury display
                const newBalance = (Number(ubiData?.total_balance) || 0) + apiData.amount;
                document.getElementById('treasuryValue').textContent = fmt(newBalance) + ' CLAWNCH';
                if (clawnchPrice > 0) {
                    document.getElementById('treasuryUsd').textContent = '~$' + (newBalance * clawnchPrice).toFixed(2) + ' USD';
                    // Update roadmap with new value
                    updateRoadmap(newBalance * clawnchPrice);
                }
            } else {
                fundStatus.textContent = apiData.error || 'Failed to record deposit';
                fundStatus.className = 'ubi-fund-status error';
            }
        } catch (err) {
            fundStatus.textContent = err.message || 'Deposit failed';
            fundStatus.className = 'ubi-fund-status error';
        }

        depositBtn.disabled = false;
    });
})();
