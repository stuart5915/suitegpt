// Inclawbate — Philanthropy Vote Page

(function() {
    var BASE_CHAIN_ID = '0x2105';
    var connectedWallet = null;

    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }

    function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

    function philToast(msg, type) {
        var container = document.getElementById('philToastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'phil-toast' + (type ? ' phil-toast--' + type : '');
        var icon = type === 'error' ? '\u26A0\uFE0F' : type === 'success' ? '\u2705' : '\u2139\uFE0F';
        toast.innerHTML = '<span class="phil-toast-icon">' + icon + '</span><span>' + msg + '</span>';
        container.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('visible'); });
        setTimeout(function() {
            toast.classList.add('hiding');
            setTimeout(function() { toast.remove(); }, 300);
        }, 4000);
    }

    function getProvider() {
        if (window.WalletKit && window.WalletKit.isConnected()) {
            return window.WalletKit.getProvider();
        }
        return window.ethereum || null;
    }

    // ── Load community results (no wallet needed) ──
    async function loadResults(wallet) {
        var url = '/api/inclawbate/philanthropy';
        if (wallet) url += '?wallet=' + wallet;

        try {
            var res = await fetch(url);
            var data = await res.json();
            updateResultsUI(data);
            return data;
        } catch (e) {
            return null;
        }
    }

    function updateResultsUI(data) {
        if (!data) return;

        var reinvestPct = data.weighted_reinvest_pct || 100;
        var philPct = data.weighted_philanthropy_pct || 0;
        var voters = data.voter_count || 0;
        var totalVoting = data.total_weighted_voting || 0;

        var emptyEl = document.getElementById('philEmpty');
        var contentEl = document.getElementById('philResultsContent');

        if (voters === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (contentEl) contentEl.style.display = 'none';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

        // Update bar widths
        var barReinvest = document.getElementById('barReinvest');
        var barPhilanthropy = document.getElementById('barPhilanthropy');
        if (barReinvest) barReinvest.style.width = Math.max(reinvestPct, 2) + '%';
        if (barPhilanthropy) barPhilanthropy.style.width = Math.max(philPct, 2) + '%';

        // Bar labels (only show if > 10% to avoid cramming)
        var reinvestLabel = document.getElementById('barReinvestLabel');
        var philLabel = document.getElementById('barPhilanthropyLabel');
        if (reinvestLabel) reinvestLabel.textContent = reinvestPct >= 10 ? reinvestPct.toFixed(1) + '%' : '';
        if (philLabel) philLabel.textContent = philPct >= 10 ? philPct.toFixed(1) + '%' : '';

        // Stats
        var voterEl = document.getElementById('statVoters');
        var powerEl = document.getElementById('statVotingPower');
        var powerSubEl = document.getElementById('statVotingPowerSub');
        if (voterEl) voterEl.textContent = voters;
        if (powerEl) powerEl.textContent = fmt(totalVoting);
        if (powerSubEl) {
            var cl = data.total_clawnch_voting || 0;
            var incl = data.total_inclawnch_voting || 0;
            var parts = [];
            if (cl > 0) parts.push(fmt(cl) + ' CLAWNCH');
            if (incl > 0) parts.push(fmt(incl) + ' inCLAWNCH');
            powerSubEl.textContent = parts.length > 0 ? '[' + parts.join(' + ') + ']' : '';
        }
    }

    // ── Slider + Preset Logic ──
    var currentPct = 0; // philanthropy_pct

    function updatePreview(pct) {
        currentPct = pct;
        var slider = document.getElementById('philSlider');
        if (slider && parseInt(slider.value) !== pct) slider.value = pct;

        var reinvest = 100 - pct;
        document.getElementById('previewReinvest').textContent = reinvest + '%';
        document.getElementById('previewPhilanthropy').textContent = pct + '%';

        // Update preset active states
        document.querySelectorAll('.phil-preset-btn').forEach(function(btn) {
            var btnPct = parseInt(btn.getAttribute('data-pct'));
            btn.classList.toggle('active', btnPct === pct);
        });
    }

    // Wire up slider
    var slider = document.getElementById('philSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            updatePreview(parseInt(slider.value));
        });
    }

    // Wire up preset buttons
    document.querySelectorAll('.phil-preset-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            updatePreview(parseInt(btn.getAttribute('data-pct')));
        });
    });

    // ── Wallet Connect ──
    async function connectWallet() {
        if (connectedWallet) return connectedWallet;

        if (window.WalletKit) {
            try {
                await window.WalletKit.open();
                return null; // completes via onConnect callback
            } catch (err) {
                // fall through
            }
        }

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
                philToast(err.message || 'Connection failed', 'error');
                return null;
            }
        }

        philToast('No wallet found. Install MetaMask or Coinbase Wallet.', 'error');
        return null;
    }

    async function onWalletConnected(address) {
        connectedWallet = address;

        var btn = document.getElementById('philConnectBtn');
        if (btn) {
            btn.textContent = shortAddr(address) + ' \u00B7 Disconnect';
            btn.classList.add('connected');
        }

        // Fetch results with wallet to get user's vote + stake
        var data = await loadResults(address);
        if (!data) return;

        var form = document.getElementById('philForm');
        var noStake = document.getElementById('philNoStake');
        var connectWrap = document.getElementById('philConnectWrap');

        var myPower = data.my_voting_power || 0;

        if (myPower <= 0) {
            // No active stakes — show message
            if (noStake) noStake.style.display = 'block';
            if (form) form.style.display = 'none';
            return;
        }

        // Has stakes — show form
        if (noStake) noStake.style.display = 'none';
        if (form) form.style.display = 'block';

        var stakeEl = document.getElementById('philMyStake');
        if (stakeEl) stakeEl.textContent = fmt(myPower);

        var mySubEl = document.getElementById('philMyStakeSub');
        if (mySubEl) {
            var myCl = data.my_clawnch || 0;
            var myIncl = data.my_inclawnch || 0;
            var parts = [];
            if (myCl > 0) parts.push(fmt(myCl) + ' CLAWNCH');
            if (myIncl > 0) parts.push(fmt(myIncl) + ' inCLAWNCH');
            mySubEl.textContent = parts.length > 0 ? '[' + parts.join(' + ') + ']' : '';
        }

        // Restore existing vote
        if (data.my_vote !== null && data.my_vote !== undefined) {
            updatePreview(data.my_vote);
        } else {
            updatePreview(0);
        }
    }

    function disconnectWallet() {
        if (!connectedWallet) return;
        connectedWallet = null;
        if (window.WalletKit && window.WalletKit.isConnected()) window.WalletKit.disconnect();

        var btn = document.getElementById('philConnectBtn');
        if (btn) {
            btn.textContent = 'Connect Wallet';
            btn.classList.remove('connected');
        }

        document.getElementById('philForm').style.display = 'none';
        document.getElementById('philNoStake').style.display = 'none';

        var statusEl = document.getElementById('philVoteStatus');
        if (statusEl) { statusEl.textContent = ''; statusEl.className = 'phil-vote-status'; }
    }

    // Connect button click
    var connectBtn = document.getElementById('philConnectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', function() {
            if (connectedWallet) {
                disconnectWallet();
                return;
            }
            connectWallet();
        });
    }

    // ── Cast Vote ──
    var castBtn = document.getElementById('philCastBtn');
    if (castBtn) {
        castBtn.addEventListener('click', async function() {
            if (!connectedWallet) return;

            castBtn.disabled = true;
            castBtn.textContent = 'Casting...';
            var statusEl = document.getElementById('philVoteStatus');

            try {
                var res = await fetch('/api/inclawbate/philanthropy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: connectedWallet,
                        philanthropy_pct: currentPct
                    })
                });

                var data = await res.json();

                if (data.success) {
                    philToast('Vote cast! ' + (100 - currentPct) + '% UBI / ' + currentPct + '% Philanthropy', 'success');
                    if (statusEl) {
                        statusEl.textContent = 'Vote saved';
                        statusEl.className = 'phil-vote-status success';
                    }
                    // Refresh community results
                    loadResults(connectedWallet);
                } else {
                    philToast(data.error || 'Failed to cast vote', 'error');
                    if (statusEl) {
                        statusEl.textContent = data.error || 'Failed';
                        statusEl.className = 'phil-vote-status error';
                    }
                }
            } catch (e) {
                philToast('Network error', 'error');
                if (statusEl) {
                    statusEl.textContent = 'Network error';
                    statusEl.className = 'phil-vote-status error';
                }
            }

            castBtn.disabled = false;
            castBtn.textContent = 'Cast Vote';
        });
    }

    // ── WalletKit Integration ──
    if (window.WalletKit) {
        window.WalletKit.onConnect(function(address) {
            onWalletConnected(address);
        });
        window.WalletKit.onDisconnect(function() {
            disconnectWallet();
        });
        if (window.WalletKit.isConnected()) {
            onWalletConnected(window.WalletKit.getAddress());
        }
    }

    // ── Initial load (no wallet) ──
    loadResults();
})();
