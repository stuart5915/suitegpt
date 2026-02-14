// Inclawbate — Kingdom Page

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

    // ── Load community stats (kingdom total) ──
    async function loadCommunityStats() {
        try {
            var res = await fetch('/api/inclawbate/philanthropy');
            var data = await res.json();
            var el = document.getElementById('statKingdomTotal');
            if (el) el.textContent = fmt(data.kingdom_total_distributed || 0);
        } catch (e) {
            // silent
        }
    }

    // ── Load kingdom status for connected wallet ──
    async function loadKingdomStatus(wallet) {
        try {
            var res = await fetch('/api/inclawbate/ubi?wallet=' + wallet);
            var data = await res.json();

            var pctEl = document.getElementById('kingdomUserPct');
            var labelEl = document.getElementById('kingdomUserLabel');
            var nudgeEl = document.getElementById('kingdomNudge');
            var statusEl = document.getElementById('kingdomStatusContent');

            var target = data.whale_redirect_target;
            var kingdomPct = 0;

            if (target === 'philanthropy') {
                kingdomPct = 100;
            } else if (target === 'split') {
                kingdomPct = data.split_kingdom_pct || 0;
            }

            if (kingdomPct > 0) {
                if (pctEl) pctEl.textContent = kingdomPct + '%';
                if (labelEl) labelEl.textContent = 'of your UBI goes to Kingdom';
                if (statusEl) statusEl.style.display = 'block';
                if (nudgeEl) nudgeEl.style.display = 'none';
            } else {
                if (statusEl) statusEl.style.display = 'none';
                if (nudgeEl) nudgeEl.style.display = 'block';
            }
        } catch (e) {
            // silent
        }
    }

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

        // Update kingdom connect button
        var kingdomBtn = document.getElementById('kingdomConnectBtn');
        if (kingdomBtn) {
            kingdomBtn.textContent = shortAddr(address) + ' \u00B7 Disconnect';
            kingdomBtn.classList.add('connected');
        }

        // Hide connect wraps, show status
        var connectWrap = document.getElementById('kingdomConnectWrap');
        if (connectWrap) connectWrap.style.display = 'none';

        // Hide request connect message
        var reqConnectMsg = document.getElementById('reqConnectMsg');
        if (reqConnectMsg) reqConnectMsg.style.display = 'none';

        // Load kingdom status + requests
        await Promise.all([
            loadKingdomStatus(address),
            loadRequests()
        ]);
    }

    function disconnectWallet() {
        if (!connectedWallet) return;
        connectedWallet = null;
        userHasOpenRequest = false;
        if (window.WalletKit && window.WalletKit.isConnected()) window.WalletKit.disconnect();

        // Reset kingdom connect
        var kingdomBtn = document.getElementById('kingdomConnectBtn');
        if (kingdomBtn) {
            kingdomBtn.textContent = 'Connect Wallet';
            kingdomBtn.classList.remove('connected');
        }
        var connectWrap = document.getElementById('kingdomConnectWrap');
        if (connectWrap) connectWrap.style.display = 'block';

        var statusEl = document.getElementById('kingdomStatusContent');
        if (statusEl) statusEl.style.display = 'none';
        var nudgeEl = document.getElementById('kingdomNudge');
        if (nudgeEl) nudgeEl.style.display = 'none';

        // Reset request section
        var reqConnectMsg = document.getElementById('reqConnectMsg');
        if (reqConnectMsg) reqConnectMsg.style.display = 'block';
        var reqForm = document.getElementById('reqForm');
        if (reqForm) reqForm.classList.remove('visible');
        var reqHasOpen = document.getElementById('reqHasOpen');
        if (reqHasOpen) reqHasOpen.style.display = 'none';
    }

    // Kingdom connect button
    var kingdomBtn = document.getElementById('kingdomConnectBtn');
    if (kingdomBtn) {
        kingdomBtn.addEventListener('click', function() {
            if (connectedWallet) { disconnectWallet(); return; }
            connectWallet();
        });
    }

    // Request connect button (shared wallet)
    var reqConnectBtn = document.getElementById('reqConnectBtn');
    if (reqConnectBtn) {
        reqConnectBtn.addEventListener('click', function() {
            if (connectedWallet) { disconnectWallet(); return; }
            connectWallet();
        });
    }

    // ══════════════════════════════════════
    //  CHARACTER COUNTER
    // ══════════════════════════════════════

    var descField = document.getElementById('reqDesc');
    var descCount = document.getElementById('reqDescCount');
    if (descField && descCount) {
        descField.addEventListener('input', function() {
            var len = descField.value.length;
            descCount.textContent = len.toLocaleString() + ' / 5,000';
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

            // Preview: first 120 chars of description
            var preview = (r.description || '').substring(0, 120);
            if ((r.description || '').length > 120) preview += '...';

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
                '<div class="phil-req-card-preview">' + escHtml(preview) + '</div>' +
                '<div class="phil-req-expanded" id="reqExpanded' + r.id + '"></div>';

            card.addEventListener('click', (function(reqId) {
                return function(e) {
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
            if (desc.length < 10 || desc.length > 5000) {
                philToast('Description must be 10-5,000 characters', 'error');
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
                    if (descCount) descCount.textContent = '0 / 5,000';
                    loadRequests();
                } else {
                    philToast(data.error || 'Failed to post', 'error');
                }
            } catch (e) {
                philToast('Network error', 'error');
            }

            reqSubmitBtn.disabled = false;
            reqSubmitBtn.textContent = 'Submit Proof of Need';
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

    // ── Tab Switching ──
    document.querySelectorAll('.phil-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.phil-tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.phil-tab-panel').forEach(function(p) { p.classList.remove('active'); });
            tab.classList.add('active');
            var panel = tab.getAttribute('data-panel');
            var el = document.getElementById(panel === 'orgs' ? 'panelOrgs' : 'panelHumans');
            if (el) el.classList.add('active');
        });
    });

    // ── Initial load (no wallet needed) ──
    loadCommunityStats();
    loadRequests();
})();
