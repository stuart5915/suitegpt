// Inclawbate — Kingdom Page

(function() {
    var BASE_CHAIN_ID = '0x2105';
    var connectedWallet = null;

    var CLAWNCH_TOKEN = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
    var UBI_TREASURY = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
    var ORG_LISTING_FEE = 10000;

    var loadedOrgs = [];
    var lastLoadedRequests = { gcm: [], ubi: [] };

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

    function renderKingdomDestination(kingdomAmt) {
        var el = document.getElementById('kingdomDestination');
        if (!el) return;

        var amtHtml = kingdomAmt > 0 ? '<div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--seafoam-300);white-space:nowrap;">~' + fmt(kingdomAmt) + ' CLAWNCH</div>' : '';
        var header = '<div style="font-family:var(--font-mono);font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:8px;">Going to</div>';

        // Check if targeting a request
        if (selectedRequestId && lastLoadedRequests) {
            var req = null;
            for (var t in lastLoadedRequests) {
                for (var i = 0; i < lastLoadedRequests[t].length; i++) {
                    if (lastLoadedRequests[t][i].id === selectedRequestId) { req = lastLoadedRequests[t][i]; break; }
                }
                if (req) break;
            }
            if (req) {
                var authorDisplay = req.handle ? '@' + escHtml(req.handle) : shortAddr(req.wallet_address);
                el.innerHTML = header +
                    '<div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:14px 16px;">' +
                        '<span style="font-size:1.6rem;flex-shrink:0;">\uD83D\uDE4F</span>' +
                        '<div style="flex:1;min-width:0;">' +
                            '<div style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:var(--text-primary);">' + escHtml(req.title) + '</div>' +
                            '<div style="font-family:var(--font-mono);font-size:0.58rem;font-weight:600;color:var(--text-dim);">' + authorDisplay + '</div>' +
                        '</div>' +
                        amtHtml +
                    '</div>';
                return;
            }
        }

        // Look up org from loaded array
        var org = null;
        if (selectedOrgId) {
            for (var j = 0; j < loadedOrgs.length; j++) {
                if (loadedOrgs[j].id === selectedOrgId) { org = loadedOrgs[j]; break; }
            }
        }

        if (org) {
            var icon = org.icon_emoji || '\uD83C\uDFE2';
            var taglineHtml = org.tagline ? '<div style="font-family:var(--font-mono);font-size:0.58rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--sand-300);">' + escHtml(org.tagline) + '</div>' : '';
            el.innerHTML = header +
                '<div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:14px 16px;">' +
                    '<span style="font-size:1.6rem;flex-shrink:0;">' + icon + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:var(--text-primary);">' + escHtml(org.name) + '</div>' +
                        taglineHtml +
                    '</div>' +
                    amtHtml +
                '</div>';
        } else if (selectedOrgId) {
            el.innerHTML = header +
                '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:14px 16px;font-size:0.85rem;color:var(--text-secondary);">Organization #' + selectedOrgId + '</div>';
        } else {
            el.innerHTML = header +
                '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:14px 16px;font-size:0.85rem;color:var(--text-secondary);">No destination selected</div>';
        }
    }

    // ── Load kingdom status for connected wallet ──
    var selectedOrgId = null;
    var selectedRequestId = null;
    var lastKingdomAmt = 0;

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
                lastKingdomAmt = kingdomAmt;

                if (pctEl) pctEl.textContent = kingdomPct + '%';
                if (labelEl) {
                    labelEl.textContent = 'of your UBI goes to Kingdom';
                    if (kingdomAmt > 0) {
                        labelEl.textContent += ' (~' + fmt(kingdomAmt) + ' CLAWNCH per distribution)';
                    }
                }
                if (statusEl) statusEl.style.display = 'block';
                if (nudgeEl) nudgeEl.style.display = 'none';

                // Show where kingdom allocation is going
                selectedRequestId = data.redirect_request_id || null;
                selectedOrgId = selectedRequestId ? null : (data.redirect_org_id || 1);
                renderKingdomDestination(kingdomAmt);
            } else {
                if (statusEl) statusEl.style.display = 'none';
                if (nudgeEl) nudgeEl.style.display = 'block';
            }

            // Set selection state
            selectedRequestId = data.redirect_request_id || null;
            selectedOrgId = selectedRequestId ? null : (data.redirect_org_id || 1);
            highlightSelectedOrg();
            highlightSelectedRequest();
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
        if (!connectedWallet || (orgId === selectedOrgId && !selectedRequestId)) return;

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
                selectedRequestId = null;
                renderOrgCards(loadedOrgs);
                highlightSelectedRequest();
                renderKingdomDestination(lastKingdomAmt);
                philToast('Allocation updated', 'success');
            } else {
                philToast(data.error || 'Failed to update', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }
    }

    function highlightSelectedRequest() {
        document.querySelectorAll('.phil-req-card').forEach(function(card) {
            var reqId = Number(card.getAttribute('data-id'));
            card.classList.toggle('selected', reqId === selectedRequestId);
        });
    }

    async function selectRequest(reqId) {
        if (!connectedWallet || reqId === selectedRequestId) return;

        try {
            var res = await fetch('/api/inclawbate/philanthropy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_kingdom_request',
                    wallet_address: connectedWallet,
                    request_id: reqId
                })
            });
            var data = await res.json();
            if (data.success) {
                selectedRequestId = reqId;
                selectedOrgId = null;
                renderOrgCards(loadedOrgs);
                highlightSelectedRequest();
                renderKingdomDestination(lastKingdomAmt);
                philToast('Allocation updated', 'success');
            } else {
                philToast(data.error || 'Failed to update', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }
    }

    window._selectRequest = function(reqId) {
        selectRequest(reqId);
    };

    // ── Load & Render Orgs ──
    async function loadOrgs() {
        try {
            var res = await fetch('/api/inclawbate/philanthropy?orgs_only=true');
            var data = await res.json();
            loadedOrgs = data.orgs || [];
            renderOrgCards(loadedOrgs);
            // Re-render destination in case loadKingdomStatus finished first
            if (selectedOrgId || selectedRequestId) renderKingdomDestination(lastKingdomAmt);
        } catch (e) {
            // silent
        }
    }

    function renderOrgCards(orgs) {
        var container = document.getElementById('orgsList');
        if (!container) return;
        container.innerHTML = '';

        if (orgs.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:var(--space-lg);color:var(--text-dim);font-size:0.82rem;">No organizations listed yet.</div>';
            return;
        }

        for (var i = 0; i < orgs.length; i++) {
            var o = orgs[i];
            var icon = o.icon_emoji || '\uD83C\uDFE2';
            var card = document.createElement('div');
            card.className = 'phil-kingdom-card';
            card.setAttribute('data-org-id', o.id);
            if (o.id === selectedOrgId) card.classList.add('selected');

            var bodyHtml = '<div class="phil-kingdom-card-name">' + escHtml(o.name) + '</div>';
            if (o.tagline) bodyHtml += '<div class="phil-kingdom-card-motto">' + escHtml(o.tagline) + '</div>';
            bodyHtml += '<div class="phil-kingdom-card-desc">' + escHtml(o.description) + '</div>';
            if (o.website_url) {
                var displayUrl = o.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                bodyHtml += '<a href="' + escHtml(o.website_url) + '" target="_blank" rel="noopener" class="phil-kingdom-card-link">' + escHtml(displayUrl) + ' &rarr;</a>';
            }

            // Direct Kingdom Here button
            var isSelected = o.id === selectedOrgId && !selectedRequestId;
            if (connectedWallet) {
                if (isSelected) {
                    bodyHtml += '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border-radius:var(--radius-full);background:hsla(172,32%,48%,0.1);border:1px solid var(--seafoam-400);font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--seafoam-300);">&#10003; Kingdom goes here</div>';
                } else {
                    bodyHtml += '<button class="phil-kingdom-select-btn" data-select-org="' + o.id + '" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border-radius:var(--radius-full);border:1px solid var(--seafoam-400);background:hsla(172,32%,48%,0.06);color:var(--seafoam-300);font-family:var(--font-mono);font-size:0.72rem;font-weight:700;cursor:pointer;transition:all 0.2s;">\uD83D\uDC51 Direct Kingdom Here</button>';
                }
            }

            card.innerHTML =
                '<span class="phil-kingdom-card-icon">' + icon + '</span>' +
                '<div class="phil-kingdom-card-body">' + bodyHtml + '</div>' +
                '<span class="phil-kingdom-card-check">&#10003;</span>';

            container.appendChild(card);
        }
    }

    // Event delegation for org card clicks
    var orgsContainer = document.getElementById('orgsList');
    if (orgsContainer) {
        orgsContainer.addEventListener('click', function(e) {
            if (e.target.closest('a')) return;
            // Handle "Direct Kingdom Here" button
            var btn = e.target.closest('.phil-kingdom-select-btn');
            if (btn) {
                e.stopPropagation();
                var orgId = Number(btn.getAttribute('data-select-org'));
                if (!connectedWallet) { philToast('Connect your wallet first', 'error'); return; }
                selectOrg(orgId);
                return;
            }
        });
    }

    // ── Org Listing Form ──
    window._toggleOrgForm = function() {
        if (!connectedWallet) {
            connectWallet();
            return;
        }
        var form = document.getElementById('orgSubmitForm');
        if (form) {
            form.classList.toggle('visible');
            if (form.classList.contains('visible')) {
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    // Org description char counter
    var orgDescField = document.getElementById('orgDescription');
    var orgDescCount = document.getElementById('orgDescCount');
    if (orgDescField && orgDescCount) {
        orgDescField.addEventListener('input', function() {
            orgDescCount.textContent = orgDescField.value.length + ' / 500';
        });
    }

    // Submit org listing
    var orgSubmitBtn = document.getElementById('orgSubmitBtn');
    if (orgSubmitBtn) {
        orgSubmitBtn.addEventListener('click', async function() {
            if (!connectedWallet) { connectWallet(); return; }

            var name = (document.getElementById('orgName').value || '').trim();
            var tagline = (document.getElementById('orgTagline').value || '').trim();
            var desc = (document.getElementById('orgDescription').value || '').trim();
            var website = (document.getElementById('orgWebsite').value || '').trim();
            var orgWallet = (document.getElementById('orgWallet').value || '').trim();
            var emoji = (document.getElementById('orgEmoji').value || '').trim();

            if (name.length < 3 || name.length > 80) { philToast('Name must be 3-80 characters', 'error'); return; }
            if (desc.length < 10 || desc.length > 500) { philToast('Description must be 10-500 characters', 'error'); return; }
            if (!/^0x[a-fA-F0-9]{40}$/.test(orgWallet)) { philToast('Enter a valid wallet address (0x...)', 'error'); return; }

            orgSubmitBtn.disabled = true;
            orgSubmitBtn.textContent = 'Sending 10,000 CLAWNCH...';

            try {
                var provider = getProvider();
                if (!provider) throw new Error('No wallet connected');

                // ERC-20 transfer: 10,000 CLAWNCH to UBI treasury
                var transferData = '0xa9059cbb' + pad32(UBI_TREASURY) + pad32(toHexWei(ORG_LISTING_FEE));

                var txHash = await provider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: connectedWallet,
                        to: CLAWNCH_TOKEN,
                        data: transferData
                    }]
                });

                philToast('Payment sent! Creating listing...', 'success');
                orgSubmitBtn.textContent = 'Creating listing...';

                var body = {
                    action: 'submit_org',
                    wallet_address: connectedWallet,
                    name: name,
                    description: desc,
                    org_wallet: orgWallet,
                    tx_hash: txHash
                };
                if (tagline) body.tagline = tagline;
                if (emoji) body.icon_emoji = emoji;
                if (website) body.website_url = website;

                var res = await fetch('/api/inclawbate/philanthropy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                var data = await res.json();

                if (data.success) {
                    philToast('Listed! Your org is now live.', 'success');
                    // Clear form
                    document.getElementById('orgName').value = '';
                    document.getElementById('orgTagline').value = '';
                    document.getElementById('orgDescription').value = '';
                    document.getElementById('orgWebsite').value = '';
                    document.getElementById('orgWallet').value = '';
                    document.getElementById('orgEmoji').value = '';
                    if (orgDescCount) orgDescCount.textContent = '0 / 500';
                    document.getElementById('orgSubmitForm').classList.remove('visible');
                    // Reload orgs
                    loadOrgs();
                } else {
                    philToast(data.error || 'Failed to create listing', 'error');
                }
            } catch (e) {
                if (e.code === 4001) {
                    philToast('Transaction cancelled', 'error');
                } else {
                    philToast(e.message || 'Transaction failed', 'error');
                }
            }

            orgSubmitBtn.disabled = false;
            orgSubmitBtn.textContent = 'Pay 10,000 CLAWNCH & List';
        });
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

        // Hide connect messages for BOTH request panels
        var gcmConnectMsg = document.getElementById('gcmConnectMsg');
        if (gcmConnectMsg) gcmConnectMsg.style.display = 'none';
        var ubiConnectMsg = document.getElementById('ubiConnectMsg');
        if (ubiConnectMsg) ubiConnectMsg.style.display = 'none';

        // Load kingdom status, orgs, + requests for both types
        await Promise.all([
            loadKingdomStatus(address),
            loadOrgs(),
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
            var reqs = data.requests || [];
            lastLoadedRequests[type] = reqs;
            renderRequestList(reqs, type);
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
            if (r.id === selectedRequestId) card.classList.add('selected');

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

        // "Direct Kingdom Here" button (if connected and not own request)
        if (connectedWallet && request.wallet_address !== connectedWallet.toLowerCase()) {
            var isSelected = selectedRequestId === request.id;
            if (isSelected) {
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-md);padding:10px 16px;border-radius:var(--radius-full);background:hsla(172,32%,48%,0.1);border:1px solid var(--seafoam-400);">' +
                    '<span style="font-size:0.9rem;">&#10003;</span>' +
                    '<span style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:var(--seafoam-300);">Your Kingdom allocation goes here</span>' +
                '</div>';
            } else {
                html += '<button onclick="window._selectRequest(' + request.id + ')" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:var(--space-md);padding:10px 20px;border-radius:var(--radius-full);border:1px solid var(--seafoam-400);background:hsla(172,32%,48%,0.06);color:var(--seafoam-300);font-family:var(--font-mono);font-size:0.78rem;font-weight:700;cursor:pointer;transition:all 0.2s;">' +
                    '\uD83D\uDC51 Direct Kingdom Here</button>';
            }
        }

        // Fund UI (only for GCM, if connected and not own request)
        if (cfg.showFund && connectedWallet && request.wallet_address !== connectedWallet.toLowerCase()) {
            html += '<div class="phil-req-fund">' +
                '<span class="phil-req-fund-label">Send CLAWNCH</span>' +
                '<input type="number" class="phil-req-fund-input" id="fundInput' + request.id + '" placeholder="Amount" min="1" step="1">' +
                '<button class="phil-req-fund-btn" id="fundBtn' + request.id + '" onclick="window._fundRequest(' + request.id + ', \'' + request.wallet_address + '\')">Fund</button>' +
            '</div>';
        }

        // Owner actions (edit + close)
        if (connectedWallet && request.wallet_address === connectedWallet.toLowerCase()) {
            html += '<div style="display:flex;gap:8px;margin-bottom:var(--space-md);">' +
                '<button class="phil-req-close-btn" onclick="window._editRequest(' + request.id + ', \'' + type + '\')" style="border-color:var(--border-default);background:var(--bg-elevated);color:var(--text-secondary);">Edit</button>' +
                '<button class="phil-req-close-btn" onclick="window._closeRequest(' + request.id + ', this, \'' + type + '\')">Close Request</button>' +
            '</div>';

            // Edit form (hidden until Edit clicked)
            html += '<div id="editForm' + request.id + '" style="display:none;margin-bottom:var(--space-lg);padding:var(--space-md);background:var(--bg-elevated);border-radius:var(--radius-lg);">' +
                '<div style="margin-bottom:12px;"><label style="display:block;font-family:var(--font-mono);font-size:0.68rem;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px;">Title</label>' +
                '<input type="text" id="editTitle' + request.id + '" value="' + escHtml(request.title).replace(/"/g, '&quot;') + '" maxlength="100" style="width:100%;padding:8px 12px;border-radius:var(--radius-lg);border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-primary);font-family:var(--font-display);font-size:0.85rem;outline:none;box-sizing:border-box;"></div>' +
                '<div style="margin-bottom:12px;"><label style="display:block;font-family:var(--font-mono);font-size:0.68rem;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px;">Description</label>' +
                '<textarea id="editDesc' + request.id + '" maxlength="5000" rows="8" style="width:100%;padding:8px 12px;border-radius:var(--radius-lg);border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-primary);font-family:var(--font-display);font-size:0.85rem;outline:none;box-sizing:border-box;resize:vertical;line-height:1.6;">' + escHtml(request.description) + '</textarea></div>' +
                '<div style="margin-bottom:12px;"><label style="display:block;font-family:var(--font-mono);font-size:0.68rem;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px;">Amount' + (cfg.showProgress ? '' : ' (CLAWNCH/month)') + '</label>' +
                '<input type="number" id="editAmount' + request.id + '" value="' + request.amount_requested + '" min="1" step="1" style="width:100%;padding:8px 12px;border-radius:var(--radius-lg);border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-primary);font-family:var(--font-mono);font-size:0.85rem;outline:none;box-sizing:border-box;"></div>' +
                '<div style="display:flex;gap:8px;">' +
                    '<button onclick="window._saveEdit(' + request.id + ', \'' + type + '\')" style="flex:1;padding:10px;border-radius:var(--radius-full);border:none;background:var(--accent-gradient);color:#fff;font-family:var(--font-mono);font-size:0.82rem;font-weight:700;cursor:pointer;">Save Changes</button>' +
                    '<button onclick="document.getElementById(\'editForm' + request.id + '\').style.display=\'none\'" style="padding:10px 16px;border-radius:var(--radius-full);border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.82rem;font-weight:600;cursor:pointer;">Cancel</button>' +
                '</div>' +
            '</div>';
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
    window._editRequest = function(reqId, type) {
        var form = document.getElementById('editForm' + reqId);
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };

    window._saveEdit = async function(reqId, type) {
        if (!connectedWallet) return;

        var title = (document.getElementById('editTitle' + reqId).value || '').trim();
        var desc = (document.getElementById('editDesc' + reqId).value || '').trim();
        var amount = Number(document.getElementById('editAmount' + reqId).value || 0);

        if (title.length < 3) { philToast('Title must be at least 3 characters', 'error'); return; }
        if (desc.length < 10) { philToast('Description must be at least 10 characters', 'error'); return; }
        if (!amount || amount <= 0) { philToast('Amount must be greater than 0', 'error'); return; }

        try {
            var res = await fetch('/api/inclawbate/ubi-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'edit',
                    wallet_address: connectedWallet,
                    request_id: reqId,
                    title: title,
                    description: desc,
                    amount_requested: amount
                })
            });
            var data = await res.json();
            if (data.success) {
                philToast('Updated!', 'success');
                typeConfig[type].expandedId = null;
                toggleRequestExpand(reqId, type);
                loadRequests(type);
            } else {
                philToast(data.error || 'Failed to update', 'error');
            }
        } catch (e) {
            philToast('Network error', 'error');
        }
    };

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
    loadOrgs();
    loadRequests('gcm');
    loadRequests('ubi');
})();
