// Inclawbate — Kingdom Page

(function() {
    var BASE_CHAIN_ID = '0x2105';
    var connectedWallet = null;

    var CLAWNCH_TOKEN = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';

    var typeConfig = {
        gcm: { apiType: 'goclawnchme', hasOpen: false, expandedId: null, showProgress: true, showFund: true },
        ubi: { apiType: 'ubi', hasOpen: false, expandedId: null, showProgress: false, showFund: false }
    };

    var panelMap = { orgs: 'panelOrgs', gcm: 'panelGcm', ubi: 'panelUbi' };

    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }

    function progressHtml(funded, requested) {
        var f = Number(funded) || 0;
        var r = Number(requested) || 1;
        var pct = Math.min(100, Math.round(f / r * 100));
        return '<div class="phil-req-progress">' +
            '<div class="phil-req-progress-bar"><div class="phil-req-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="phil-req-progress-text">' +
                '<span>' + fmt(f) + ' / ' + fmt(r) + ' CLAWNCH</span>' +
                '<span class="phil-req-progress-pct">' + pct + '% funded</span>' +
            '</div></div>';
    }

    function pad32(hex) {
        return hex.replace('0x', '').padStart(64, '0');
    }

    function toHexWei(amount) {
        // Convert CLAWNCH amount to hex wei (18 decimals)
        var wei = BigInt(Math.floor(amount)) * BigInt('1000000000000000000');
        return '0x' + wei.toString(16);
    }

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
    var selectedOrgId = null;

    function computeUserShare(data) {
        // Approximate user's share from their stakes vs total
        var myStakes = data.my_stakes || [];
        var userWeight = 0;
        for (var i = 0; i < myStakes.length; i++) {
            var s = myStakes[i];
            if (!s.active) continue;
            var mult = (s.token === 'inclawnch') ? 2 : 1;
            userWeight += s.clawnch_amount * mult;
        }
        var totalWeight = (Number(data.total_balance) || 0) + (Number(data.inclawnch_staked) || 0) * 2;
        var dailyRate = Number(data.daily_rate) || 0;
        if (totalWeight <= 0 || dailyRate <= 0) return 0;
        return (userWeight / totalWeight) * dailyRate;
    }

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
                var shareAmt = computeUserShare(data);
                var kingdomAmt = Math.round(shareAmt * kingdomPct / 100 * 100) / 100;

                if (pctEl) pctEl.textContent = kingdomPct + '%';
                if (labelEl) {
                    labelEl.textContent = 'of your UBI goes to Kingdom';
                    if (kingdomAmt > 0) {
                        labelEl.textContent += ' (~' + fmt(kingdomAmt) + ' CLAWNCH per distribution)';
                    }
                }
                if (statusEl) statusEl.style.display = 'block';
                if (nudgeEl) nudgeEl.style.display = 'none';

                // Update community stat with user's kingdom amount
                var statEl = document.getElementById('statKingdomTotal');
                if (statEl && kingdomAmt > 0) {
                    statEl.textContent = fmt(kingdomAmt);
                }
            } else {
                if (statusEl) statusEl.style.display = 'none';
                if (nudgeEl) nudgeEl.style.display = 'block';
            }

            // Highlight selected org
            selectedOrgId = data.redirect_org_id || 1;
            highlightSelectedOrg();
        } catch (e) {
            // silent
        }
    }

    function highlightSelectedOrg() {
        document.querySelectorAll('.phil-kingdom-card').forEach(function(card) {
            var orgId = Number(card.getAttribute('data-org-id'));
            card.classList.toggle('selected', orgId === selectedOrgId);
        });
    }

    async function selectOrg(orgId) {
        if (!connectedWallet || orgId === selectedOrgId) return;

        try {
            var res = await fetch('/api/inclawbate/philanthropy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_kingdom_org',
                    wallet_address: connectedWallet,
                    org_id: orgId
                })
            });
            var data = await res.json();
            if (data.success) {
                selectedOrgId = orgId;
                highlightSelectedOrg();
                philToast('Allocation updated', 'success');
            } else {
                philToast(data.error || 'Failed to update', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }
    }

    // Wire up org card clicks
    document.querySelectorAll('.phil-kingdom-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('a')) return; // don't hijack links
            if (!connectedWallet) {
                philToast('Connect your wallet first', 'error');
                return;
            }
            var orgId = Number(card.getAttribute('data-org-id'));
            selectOrg(orgId);
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

        // Update kingdom connect button
        var kingdomBtn = document.getElementById('kingdomConnectBtn');
        if (kingdomBtn) {
            kingdomBtn.textContent = shortAddr(address) + ' \u00B7 Disconnect';
            kingdomBtn.classList.add('connected');
        }

        // Hide connect wraps, show status
        var connectWrap = document.getElementById('kingdomConnectWrap');
        if (connectWrap) connectWrap.style.display = 'none';

        // Hide connect messages for BOTH request panels
        var gcmConnectMsg = document.getElementById('gcmConnectMsg');
        if (gcmConnectMsg) gcmConnectMsg.style.display = 'none';
        var ubiConnectMsg = document.getElementById('ubiConnectMsg');
        if (ubiConnectMsg) ubiConnectMsg.style.display = 'none';

        // Load kingdom status + requests for both types
        await Promise.all([
            loadKingdomStatus(address),
            loadRequests('gcm'),
            loadRequests('ubi')
        ]);
    }

    function disconnectWallet() {
        if (!connectedWallet) return;
        connectedWallet = null;
        typeConfig.gcm.hasOpen = false;
        typeConfig.ubi.hasOpen = false;
        typeConfig.gcm.expandedId = null;
        typeConfig.ubi.expandedId = null;
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

        // Reset BOTH request panels
        ['gcm', 'ubi'].forEach(function(type) {
            var connectMsg = document.getElementById(type + 'ConnectMsg');
            if (connectMsg) connectMsg.style.display = 'block';
            var createBtn = document.getElementById(type + 'CreateBtn');
            if (createBtn) createBtn.style.display = 'none';
            var form = document.getElementById(type + 'Form');
            if (form) form.classList.remove('visible');
            var hasOpen = document.getElementById(type + 'HasOpen');
            if (hasOpen) hasOpen.style.display = 'none';
        });
    }

    // Kingdom connect button
    var kingdomBtn = document.getElementById('kingdomConnectBtn');
    if (kingdomBtn) {
        kingdomBtn.addEventListener('click', function() {
            if (connectedWallet) { disconnectWallet(); return; }
            connectWallet();
        });
    }

    // GCM connect button
    var gcmConnectBtn = document.getElementById('gcmConnectBtn');
    if (gcmConnectBtn) {
        gcmConnectBtn.addEventListener('click', function() {
            if (connectedWallet) { disconnectWallet(); return; }
            connectWallet();
        });
    }

    // UBI connect button
    var ubiConnectBtn = document.getElementById('ubiConnectBtn');
    if (ubiConnectBtn) {
        ubiConnectBtn.addEventListener('click', function() {
            if (connectedWallet) { disconnectWallet(); return; }
            connectWallet();
        });
    }

    // ══════════════════════════════════════
    //  CHARACTER COUNTERS
    // ══════════════════════════════════════

    ['gcm', 'ubi'].forEach(function(type) {
        var descField = document.getElementById(type + 'Desc');
        var descCount = document.getElementById(type + 'DescCount');
        if (descField && descCount) {
            descField.addEventListener('input', function() {
                var len = descField.value.length;
                descCount.textContent = len.toLocaleString() + ' / 5,000';
            });
        }
    });

    // ══════════════════════════════════════
    //  PARAMETERIZED REQUEST FUNCTIONS
    // ══════════════════════════════════════

    async function loadRequests(type) {
        var cfg = typeConfig[type];
        if (!cfg) return;
        try {
            var res = await fetch('/api/inclawbate/ubi-requests?type=' + cfg.apiType);
            var data = await res.json();
            renderRequestList(data.requests || [], type);
        } catch (e) {
            // silent
        }
    }

    function renderRequestList(requests, type) {
        var cfg = typeConfig[type];
        var list = document.getElementById(type + 'List');
        var empty = document.getElementById(type + 'Empty');
        if (!list) return;

        // Check if user has open request of this type
        cfg.hasOpen = false;
        if (connectedWallet) {
            var w = connectedWallet.toLowerCase();
            for (var i = 0; i < requests.length; i++) {
                if (requests[i].wallet_address === w) {
                    cfg.hasOpen = true;
                    break;
                }
            }
        }

        // Update form visibility
        updateRequestFormState(type);

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

            var amountHtml;
            if (cfg.showProgress) {
                amountHtml = '<div class="phil-req-card-amount">' + fmt(r.amount_requested) + ' CLAWNCH</div>';
            } else {
                amountHtml = '<div class="phil-req-card-amount">' + fmt(r.amount_requested) + ' CLAWNCH/mo</div>';
            }

            var cardBodyHtml =
                '<div class="phil-req-card-header">' +
                    '<div class="phil-req-card-title">' + escHtml(r.title) + '</div>' +
                    amountHtml +
                '</div>' +
                '<div class="phil-req-card-meta">' +
                    '<span>' + authorDisplay + '</span>' +
                    '<span>' + timeAgo(r.created_at) + '</span>' +
                    '<span>' + (r.comment_count || 0) + ' comment' + ((r.comment_count || 0) !== 1 ? 's' : '') + '</span>' +
                '</div>';

            if (cfg.showProgress) {
                cardBodyHtml += progressHtml(r.total_funded, r.amount_requested);
            } else {
                cardBodyHtml += '<div style="margin-top:8px;font-family:var(--font-mono);font-size:0.68rem;font-weight:700;color:var(--sand-300);">' + fmt(r.amount_requested) + ' CLAWNCH/month requested</div>';
            }

            cardBodyHtml +=
                '<div class="phil-req-card-preview">' + escHtml(preview) + '</div>' +
                '<div class="phil-req-expanded" id="' + type + 'Expanded' + r.id + '"></div>';

            card.innerHTML = cardBodyHtml;

            card.addEventListener('click', (function(reqId, t) {
                return function(e) {
                    if (e.target.closest('.phil-req-comment-form') || e.target.closest('.phil-req-close-btn') || e.target.closest('button')) return;
                    toggleRequestExpand(reqId, t);
                };
            })(r.id, type));

            list.appendChild(card);
        }
    }

    function updateRequestFormState(type) {
        var cfg = typeConfig[type];
        var form = document.getElementById(type + 'Form');
        var hasOpen = document.getElementById(type + 'HasOpen');
        var connectMsg = document.getElementById(type + 'ConnectMsg');
        var createBtn = document.getElementById(type + 'CreateBtn');

        if (!connectedWallet) {
            if (connectMsg) connectMsg.style.display = 'block';
            if (createBtn) createBtn.style.display = 'none';
            if (form) form.classList.remove('visible');
            if (hasOpen) hasOpen.style.display = 'none';
            return;
        }

        if (connectMsg) connectMsg.style.display = 'none';

        if (cfg.hasOpen) {
            if (createBtn) createBtn.style.display = 'none';
            if (form) form.classList.remove('visible');
            if (hasOpen) hasOpen.style.display = 'block';
        } else {
            // Show "Create Post" button, keep form hidden until clicked
            if (createBtn) createBtn.style.display = 'inline-flex';
            if (hasOpen) hasOpen.style.display = 'none';
            // Don't auto-show form — wait for button click
        }
    }

    // Create Post buttons → reveal respective forms
    ['gcm', 'ubi'].forEach(function(type) {
        var createBtn = document.getElementById(type + 'CreateBtn');
        if (createBtn) {
            createBtn.addEventListener('click', function() {
                var form = document.getElementById(type + 'Form');
                if (form) {
                    form.classList.add('visible');
                    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                createBtn.style.display = 'none';
            });
        }
    });

    async function toggleRequestExpand(reqId, type) {
        var cfg = typeConfig[type];
        var el = document.getElementById(type + 'Expanded' + reqId);
        if (!el) return;

        if (cfg.expandedId === reqId) {
            el.classList.remove('visible');
            cfg.expandedId = null;
            return;
        }

        // Collapse previous
        if (cfg.expandedId !== null) {
            var prev = document.getElementById(type + 'Expanded' + cfg.expandedId);
            if (prev) prev.classList.remove('visible');
        }

        cfg.expandedId = reqId;
        el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:0.8rem;">Loading...</div>';
        el.classList.add('visible');

        try {
            var res = await fetch('/api/inclawbate/ubi-requests?id=' + reqId);
            var data = await res.json();
            renderExpandedRequest(el, data.request, data.comments || [], type);
        } catch (e) {
            el.innerHTML = '<div style="text-align:center;color:var(--lobster-300);font-size:0.8rem;">Failed to load</div>';
        }
    }

    function renderExpandedRequest(el, request, comments, type) {
        var cfg = typeConfig[type];
        var html = '<div class="phil-req-full-desc">' + escHtml(request.description) + '</div>';

        // Show socials if present
        var socials = request.socials;
        if (socials && typeof socials === 'object' && Object.keys(socials).length > 0) {
            html += '<div class="phil-req-socials-display">';
            var labels = { x: 'X', instagram: 'Instagram', youtube: 'YouTube', discord: 'Discord', telegram: 'Telegram', github: 'GitHub' };
            for (var key in socials) {
                if (socials[key]) {
                    html += '<span class="phil-req-social-badge">' + (labels[key] || key) + ': ' + escHtml(socials[key]) + '</span>';
                }
            }
            html += '</div>';
        }

        if (cfg.showProgress) {
            // Progress bar (large)
            html += progressHtml(request.total_funded, request.amount_requested);
        } else {
            // UBI: show monthly label instead
            html += '<div style="margin:12px 0;font-family:var(--font-mono);font-size:0.75rem;font-weight:700;color:var(--sand-300);">' + fmt(request.amount_requested) + ' CLAWNCH/month requested</div>';
        }

        // Fund UI (only for GCM, if connected and not own request)
        if (cfg.showFund && connectedWallet && request.wallet_address !== connectedWallet.toLowerCase()) {
            html += '<div class="phil-req-fund">' +
                '<span class="phil-req-fund-label">Send CLAWNCH</span>' +
                '<input type="number" class="phil-req-fund-input" id="fundInput' + request.id + '" placeholder="Amount" min="1" step="1">' +
                '<button class="phil-req-fund-btn" id="fundBtn' + request.id + '" onclick="window._fundRequest(' + request.id + ', \'' + request.wallet_address + '\')">Fund</button>' +
            '</div>';
        }

        // Close button (only for owner)
        if (connectedWallet && request.wallet_address === connectedWallet.toLowerCase()) {
            html += '<button class="phil-req-close-btn" onclick="window._closeRequest(' + request.id + ', this, \'' + type + '\')">Close Request</button>';
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
                '<input class="phil-req-comment-input" placeholder="Add a comment..." maxlength="1000" id="commentInput' + type + request.id + '">' +
                '<button class="phil-req-comment-send" onclick="window._postComment(' + request.id + ', \'' + type + '\')">Send</button>' +
            '</div>';
        }

        html += '</div>';
        el.innerHTML = html;
    }

    // Global functions for onclick handlers
    window._closeRequest = async function(reqId, btn, type) {
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
                typeConfig[type].expandedId = null;
                loadRequests(type);
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

    window._fundRequest = async function(reqId, recipientWallet) {
        if (!connectedWallet) return;
        var input = document.getElementById('fundInput' + reqId);
        var btn = document.getElementById('fundBtn' + reqId);
        if (!input || !btn) return;

        var amount = Number(input.value);
        if (!amount || amount <= 0) {
            philToast('Enter an amount to send', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            var provider = getProvider();
            if (!provider) throw new Error('No wallet connected');

            // ERC-20 transfer: transfer(address,uint256)
            var transferData = '0xa9059cbb' + pad32(recipientWallet) + pad32(toHexWei(amount));

            var txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: connectedWallet,
                    to: CLAWNCH_TOKEN,
                    data: transferData
                }]
            });

            philToast('Transaction sent! Waiting for confirmation...', 'success');

            // Record the funding in the API
            var res = await fetch('/api/inclawbate/ubi-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'fund',
                    wallet_address: connectedWallet,
                    request_id: reqId,
                    amount: amount,
                    tx_hash: txHash
                })
            });
            var data = await res.json();
            if (data.success) {
                philToast('Funded ' + fmt(amount) + ' CLAWNCH!', 'success');
                input.value = '';
                // Refresh the expanded view
                typeConfig.gcm.expandedId = null;
                toggleRequestExpand(reqId, 'gcm');
                loadRequests('gcm');
            } else {
                philToast(data.error || 'Failed to record funding', 'error');
            }
        } catch (e) {
            if (e.code === 4001) {
                philToast('Transaction cancelled', 'error');
            } else {
                philToast(e.message || 'Transaction failed', 'error');
            }
        }

        btn.disabled = false;
        btn.textContent = 'Fund';
    };

    window._postComment = async function(reqId, type) {
        if (!connectedWallet) return;
        var input = document.getElementById('commentInput' + type + reqId);
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
                toggleRequestExpand(reqId, type); // collapse
                setTimeout(function() { toggleRequestExpand(reqId, type); }, 100); // re-expand
            } else {
                philToast(data.error || 'Failed to comment', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }

        input.disabled = false;
    };

    // Submit new request (parameterized)
    function submitRequest(type) {
        var cfg = typeConfig[type];
        var submitBtn = document.getElementById(type + 'SubmitBtn');
        if (!submitBtn) return;

        submitBtn.addEventListener('click', async function() {
            if (!connectedWallet) return;

            var title = (document.getElementById(type + 'Title').value || '').trim();
            var desc = (document.getElementById(type + 'Desc').value || '').trim();
            var amount = Number(document.getElementById(type + 'Amount').value || 0);

            // Collect socials
            var socials = {};
            var sx = (document.getElementById(type + 'SocialX') ? document.getElementById(type + 'SocialX').value : '').trim();
            var sig = (document.getElementById(type + 'SocialIG') ? document.getElementById(type + 'SocialIG').value : '').trim();
            var syt = (document.getElementById(type + 'SocialYT') ? document.getElementById(type + 'SocialYT').value : '').trim();
            var sdc = (document.getElementById(type + 'SocialDiscord') ? document.getElementById(type + 'SocialDiscord').value : '').trim();
            var stg = (document.getElementById(type + 'SocialTG') ? document.getElementById(type + 'SocialTG').value : '').trim();
            var sgh = (document.getElementById(type + 'SocialGH') ? document.getElementById(type + 'SocialGH').value : '').trim();
            if (sx) socials.x = sx;
            if (sig) socials.instagram = sig;
            if (syt) socials.youtube = syt;
            if (sdc) socials.discord = sdc;
            if (stg) socials.telegram = stg;
            if (sgh) socials.github = sgh;

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

            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';

            try {
                var body = {
                    action: 'create',
                    wallet_address: connectedWallet,
                    title: title,
                    description: desc,
                    amount_requested: amount,
                    request_type: cfg.apiType
                };
                if (Object.keys(socials).length > 0) body.socials = socials;

                var res = await fetch('/api/inclawbate/ubi-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                var data = await res.json();
                if (data.success) {
                    philToast('Request posted!', 'success');
                    document.getElementById(type + 'Title').value = '';
                    document.getElementById(type + 'Desc').value = '';
                    document.getElementById(type + 'Amount').value = '';
                    [type + 'SocialX', type + 'SocialIG', type + 'SocialYT', type + 'SocialDiscord', type + 'SocialTG', type + 'SocialGH'].forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    var descCount = document.getElementById(type + 'DescCount');
                    if (descCount) descCount.textContent = '0 / 5,000';
                    loadRequests(type);
                } else {
                    philToast(data.error || 'Failed to post', 'error');
                }
            } catch (e) {
                philToast('Network error', 'error');
            }

            submitBtn.disabled = false;
            submitBtn.textContent = (type === 'gcm') ? 'Launch Fundraiser' : 'Submit UBI Request';
        });
    }

    // Wire up submit handlers for both types
    submitRequest('gcm');
    submitRequest('ubi');

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
            var el = document.getElementById(panelMap[panel] || panel);
            if (el) el.classList.add('active');
        });
    });

    // ── Initial load (no wallet needed) ──
    loadCommunityStats();
    loadRequests('gcm');
    loadRequests('ubi');
})();
