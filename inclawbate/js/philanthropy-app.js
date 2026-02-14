// Inclawbate — Philanthropy Vote Page

(function() {
    var BASE_CHAIN_ID = '0x2105';
    var connectedWallet = null;
    var userHasOpenRequest = false;
    var expandedRequestId = null;

    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }

    function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function timeAgo(dateStr) {
        var diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

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

        // Kingdom total
        var kingdomEl = document.getElementById('kingdomTotal');
        if (kingdomEl) {
            kingdomEl.textContent = fmt(data.kingdom_total_distributed || 0);
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

        // Update vote section connect button
        var btn = document.getElementById('philConnectBtn');
        if (btn) {
            btn.textContent = shortAddr(address) + ' \u00B7 Disconnect';
            btn.classList.add('connected');
        }

        // Update request section connect button
        var reqConnectMsg = document.getElementById('reqConnectMsg');
        if (reqConnectMsg) reqConnectMsg.style.display = 'none';

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

        // Load requests (to check if user has open request)
        loadRequests();
    }

    function disconnectWallet() {
        if (!connectedWallet) return;
        connectedWallet = null;
        userHasOpenRequest = false;
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

        // Reset request section
        var reqConnectMsg = document.getElementById('reqConnectMsg');
        if (reqConnectMsg) reqConnectMsg.style.display = 'block';
        var reqForm = document.getElementById('reqForm');
        if (reqForm) reqForm.classList.remove('visible');
        var reqHasOpen = document.getElementById('reqHasOpen');
        if (reqHasOpen) reqHasOpen.style.display = 'none';
    }

    // Connect button click (vote section)
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

    // Connect button click (request section) — shared wallet
    var reqConnectBtn = document.getElementById('reqConnectBtn');
    if (reqConnectBtn) {
        reqConnectBtn.addEventListener('click', function() {
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

    // ══════════════════════════════════════
    //  UBI REQUESTS
    // ══════════════════════════════════════

    async function loadRequests() {
        try {
            var res = await fetch('/api/inclawbate/ubi-requests');
            var data = await res.json();
            renderRequestList(data.requests || []);
        } catch (e) {
            // silent
        }
    }

    function renderRequestList(requests) {
        var list = document.getElementById('reqList');
        var empty = document.getElementById('reqEmpty');
        if (!list) return;

        // Check if user has open request
        userHasOpenRequest = false;
        if (connectedWallet) {
            var w = connectedWallet.toLowerCase();
            for (var i = 0; i < requests.length; i++) {
                if (requests[i].wallet_address === w) {
                    userHasOpenRequest = true;
                    break;
                }
            }
        }

        // Update form visibility
        updateRequestFormState();

        // Clear old cards but keep empty el
        var oldCards = list.querySelectorAll('.phil-req-card');
        for (var j = 0; j < oldCards.length; j++) oldCards[j].remove();

        if (requests.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        for (var k = 0; k < requests.length; k++) {
            var r = requests[k];
            var card = document.createElement('div');
            card.className = 'phil-req-card';
            card.setAttribute('data-id', r.id);

            var authorDisplay = r.handle ? '@' + escHtml(r.handle) : shortAddr(r.wallet_address);

            card.innerHTML =
                '<div class="phil-req-card-header">' +
                    '<div class="phil-req-card-title">' + escHtml(r.title) + '</div>' +
                    '<div class="phil-req-card-amount">' + fmt(r.amount_requested) + ' CLAWNCH</div>' +
                '</div>' +
                '<div class="phil-req-card-meta">' +
                    '<span>' + authorDisplay + '</span>' +
                    '<span>' + timeAgo(r.created_at) + '</span>' +
                    '<span>' + (r.comment_count || 0) + ' comment' + ((r.comment_count || 0) !== 1 ? 's' : '') + '</span>' +
                '</div>' +
                '<div class="phil-req-expanded" id="reqExpanded' + r.id + '"></div>';

            card.addEventListener('click', (function(reqId) {
                return function(e) {
                    // Don't toggle if clicking inside form/button
                    if (e.target.closest('.phil-req-comment-form') || e.target.closest('.phil-req-close-btn') || e.target.closest('button')) return;
                    toggleRequestExpand(reqId);
                };
            })(r.id));

            list.appendChild(card);
        }
    }

    function updateRequestFormState() {
        var reqForm = document.getElementById('reqForm');
        var reqHasOpen = document.getElementById('reqHasOpen');
        var reqConnectMsg = document.getElementById('reqConnectMsg');

        if (!connectedWallet) {
            if (reqConnectMsg) reqConnectMsg.style.display = 'block';
            if (reqForm) reqForm.classList.remove('visible');
            if (reqHasOpen) reqHasOpen.style.display = 'none';
            return;
        }

        if (reqConnectMsg) reqConnectMsg.style.display = 'none';

        if (userHasOpenRequest) {
            if (reqForm) reqForm.classList.remove('visible');
            if (reqHasOpen) reqHasOpen.style.display = 'block';
        } else {
            if (reqForm) reqForm.classList.add('visible');
            if (reqHasOpen) reqHasOpen.style.display = 'none';
        }
    }

    async function toggleRequestExpand(reqId) {
        var el = document.getElementById('reqExpanded' + reqId);
        if (!el) return;

        if (expandedRequestId === reqId) {
            el.classList.remove('visible');
            expandedRequestId = null;
            return;
        }

        // Collapse previous
        if (expandedRequestId !== null) {
            var prev = document.getElementById('reqExpanded' + expandedRequestId);
            if (prev) prev.classList.remove('visible');
        }

        expandedRequestId = reqId;
        el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:0.8rem;">Loading...</div>';
        el.classList.add('visible');

        try {
            var res = await fetch('/api/inclawbate/ubi-requests?id=' + reqId);
            var data = await res.json();
            renderExpandedRequest(el, data.request, data.comments || []);
        } catch (e) {
            el.innerHTML = '<div style="text-align:center;color:var(--lobster-300);font-size:0.8rem;">Failed to load</div>';
        }
    }

    function renderExpandedRequest(el, request, comments) {
        var html = '<div class="phil-req-full-desc">' + escHtml(request.description) + '</div>';

        // Close button (only for owner)
        if (connectedWallet && request.wallet_address === connectedWallet.toLowerCase()) {
            html += '<button class="phil-req-close-btn" onclick="window._closeRequest(' + request.id + ', this)">Close Request</button>';
        }

        // Comments
        html += '<div class="phil-req-comments">';
        html += '<div class="phil-req-comments-title">Comments (' + comments.length + ')</div>';

        if (comments.length === 0) {
            html += '<div class="phil-req-no-comments">No comments yet.</div>';
        } else {
            for (var i = 0; i < comments.length; i++) {
                var c = comments[i];
                var authorDisplay = c.handle ? '@' + escHtml(c.handle) : shortAddr(c.wallet_address);
                html += '<div class="phil-req-comment">' +
                    '<div class="phil-req-comment-author">' + authorDisplay + '</div>' +
                    '<div class="phil-req-comment-text">' + escHtml(c.comment) + '</div>' +
                    '<div class="phil-req-comment-time">' + timeAgo(c.created_at) + '</div>' +
                '</div>';
            }
        }

        // Comment form (if connected)
        if (connectedWallet) {
            html += '<div class="phil-req-comment-form">' +
                '<input class="phil-req-comment-input" placeholder="Add a comment..." maxlength="1000" id="commentInput' + request.id + '">' +
                '<button class="phil-req-comment-send" onclick="window._postComment(' + request.id + ')">Send</button>' +
            '</div>';
        }

        html += '</div>';
        el.innerHTML = html;
    }

    // Global functions for onclick handlers
    window._closeRequest = async function(reqId, btn) {
        if (!connectedWallet) return;
        btn.disabled = true;
        btn.textContent = 'Closing...';

        try {
            var res = await fetch('/api/inclawbate/ubi-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'close',
                    wallet_address: connectedWallet,
                    request_id: reqId
                })
            });
            var data = await res.json();
            if (data.success) {
                philToast('Request closed', 'success');
                expandedRequestId = null;
                loadRequests();
            } else {
                philToast(data.error || 'Failed to close', 'error');
                btn.disabled = false;
                btn.textContent = 'Close Request';
            }
        } catch (e) {
            philToast('Network error', 'error');
            btn.disabled = false;
            btn.textContent = 'Close Request';
        }
    };

    window._postComment = async function(reqId) {
        if (!connectedWallet) return;
        var input = document.getElementById('commentInput' + reqId);
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;

        input.disabled = true;

        try {
            var res = await fetch('/api/inclawbate/ubi-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'comment',
                    wallet_address: connectedWallet,
                    request_id: reqId,
                    comment: text
                })
            });
            var data = await res.json();
            if (data.success) {
                input.value = '';
                // Refresh expanded view
                toggleRequestExpand(reqId); // collapse
                setTimeout(function() { toggleRequestExpand(reqId); }, 100); // re-expand
            } else {
                philToast(data.error || 'Failed to comment', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }

        input.disabled = false;
    };

    // Submit new request
    var reqSubmitBtn = document.getElementById('reqSubmitBtn');
    if (reqSubmitBtn) {
        reqSubmitBtn.addEventListener('click', async function() {
            if (!connectedWallet) return;

            var title = (document.getElementById('reqTitle').value || '').trim();
            var desc = (document.getElementById('reqDesc').value || '').trim();
            var amount = Number(document.getElementById('reqAmount').value || 0);

            if (title.length < 3 || title.length > 100) {
                philToast('Title must be 3-100 characters', 'error');
                return;
            }
            if (desc.length < 10 || desc.length > 2000) {
                philToast('Description must be 10-2000 characters', 'error');
                return;
            }
            if (!amount || amount <= 0) {
                philToast('Amount must be greater than 0', 'error');
                return;
            }

            reqSubmitBtn.disabled = true;
            reqSubmitBtn.textContent = 'Posting...';

            try {
                var res = await fetch('/api/inclawbate/ubi-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'create',
                        wallet_address: connectedWallet,
                        title: title,
                        description: desc,
                        amount_requested: amount
                    })
                });
                var data = await res.json();
                if (data.success) {
                    philToast('Request posted!', 'success');
                    document.getElementById('reqTitle').value = '';
                    document.getElementById('reqDesc').value = '';
                    document.getElementById('reqAmount').value = '';
                    loadRequests();
                } else {
                    philToast(data.error || 'Failed to post', 'error');
                }
            } catch (e) {
                philToast('Network error', 'error');
            }

            reqSubmitBtn.disabled = false;
            reqSubmitBtn.textContent = 'Post Request';
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
    loadRequests();
})();
