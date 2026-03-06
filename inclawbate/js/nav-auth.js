// Inclawbate — Nav: Mobile Menu + Wallet Connect + Wallet Selector Modal

// EIP-6963 polyfill: discover wallets (Base Wallet, MetaMask, Rabby, etc.)
// If window.ethereum is missing, assign the first discovered provider so all code works.
(function() {
    var discovered = [];
    window.addEventListener('eip6963:announceProvider', function(e) {
        if (e.detail && e.detail.provider) {
            discovered.push(e.detail);
            if (!window.ethereum) window.ethereum = e.detail.provider;
        }
    });
    try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch(e) {}
    window._eip6963Providers = discovered;

    // Await provider: re-dispatches requestProvider and waits up to 1s for late wallets
    window._awaitProvider = function() {
        if (window.ethereum) return Promise.resolve(window.ethereum);
        if (window.phantom && window.phantom.ethereum) return Promise.resolve(window.phantom.ethereum);
        return new Promise(function(resolve) {
            try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch(e) {}
            var timeout = setTimeout(function() { resolve(window.ethereum || (window.phantom && window.phantom.ethereum) || null); }, 1000);
            function handler(ev) {
                if (ev.detail && ev.detail.provider) {
                    clearTimeout(timeout);
                    window.removeEventListener('eip6963:announceProvider', handler);
                    if (!window.ethereum) window.ethereum = ev.detail.provider;
                    resolve(window.ethereum);
                }
            }
            window.addEventListener('eip6963:announceProvider', handler);
        });
    };
})();

// ══════════════════════════════════════
// WALLET SELECTOR MODAL
// ══════════════════════════════════════
(function() {
    // Known wallets for deep links + install links
    var KNOWN_WALLETS = [
        {
            name: 'Coinbase Wallet',
            rdns: 'com.coinbase.wallet',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMCIgZmlsbD0iIzAwNTJGRiIvPjxwYXRoIGQ9Ik0yNCAxMGMtNy43MzIgMC0xNCCA2LjI2OC0xNCAxNHM2LjI2OCAxNCAxNCAxNCAxNC02LjI2OCAxNC0xNC02LjI2OC0xNC0xNC0xNHptLTUgMTFhMiAyIDAgMDEyLTJoNmEyIDIgMCAwMTIgMnY2YTIgMiAwIDAxLTIgMmgtNmEyIDIgMCAwMS0yLTJ2LTZ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+',
            deepLink: function(url) { return 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(url); },
            installUrl: 'https://www.coinbase.com/wallet/downloads'
        },
        {
            name: 'MetaMask',
            rdns: 'io.metamask',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMCIgZmlsbD0iI0Y1ODQxRiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjI2Ij7wn6aKPC90ZXh0Pjwvc3ZnPg==',
            deepLink: function(url) { return 'https://metamask.app.link/dapp/' + url.replace(/^https?:\/\//, ''); },
            installUrl: 'https://metamask.io/download/'
        },
        {
            name: 'Phantom',
            rdns: 'app.phantom',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMCIgZmlsbD0iIzU0MURGRSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjI2Ij7wn5G7PC90ZXh0Pjwvc3ZnPg==',
            deepLink: function(url) { return 'https://phantom.app/ul/browse/' + encodeURIComponent(url); },
            installUrl: 'https://phantom.app/download'
        },
        {
            name: 'Trust Wallet',
            rdns: 'com.trustwallet.app',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMCIgZmlsbD0iIzMzNzVCQiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjI2Ij7wn5uhPC90ZXh0Pjwvc3ZnPg==',
            deepLink: function(url) { return 'https://link.trustwallet.com/open_url?coin_id=8453&url=' + encodeURIComponent(url); },
            installUrl: 'https://trustwallet.com/download'
        }
    ];

    // Inject modal HTML + CSS once
    var style = document.createElement('style');
    style.textContent = [
        '#walletSelectorOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}',
        '#walletSelectorOverlay.visible{opacity:1;pointer-events:auto}',
        '#walletSelectorModal{background:#141419;border:1px solid rgba(255,255,255,.1);border-radius:16px;max-width:380px;width:90%;max-height:80vh;overflow-y:auto;padding:24px;transform:translateY(20px);transition:transform .2s}',
        '#walletSelectorOverlay.visible #walletSelectorModal{transform:translateY(0)}',
        '.ws-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}',
        '.ws-header h3{margin:0;font-size:18px;color:#fff;font-weight:600}',
        '.ws-close{background:none;border:none;color:#888;font-size:22px;cursor:pointer;padding:4px 8px;line-height:1}',
        '.ws-close:hover{color:#fff}',
        '.ws-section{margin-bottom:12px}',
        '.ws-section-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:8px;padding-left:4px}',
        '.ws-option{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:background .15s,border-color .15s;width:100%;margin-bottom:6px;text-decoration:none}',
        '.ws-option:hover{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.3)}',
        '.ws-option img{width:36px;height:36px;border-radius:8px;flex-shrink:0}',
        '.ws-option-info{flex:1;text-align:left}',
        '.ws-option-name{color:#fff;font-size:14px;font-weight:500}',
        '.ws-option-tag{font-size:11px;padding:2px 8px;border-radius:99px;font-weight:500;flex-shrink:0}',
        '.ws-tag-detected{background:rgba(52,211,153,.15);color:#34d399}',
        '.ws-tag-open{background:rgba(99,102,241,.15);color:#818cf8}',
        '.ws-tag-install{background:rgba(255,255,255,.08);color:#888}',
    ].join('\n');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'walletSelectorOverlay';
    overlay.innerHTML = '<div id="walletSelectorModal">' +
        '<div class="ws-header"><h3>Connect Wallet</h3><button class="ws-close" id="wsClose">&times;</button></div>' +
        '<div id="wsBody"></div>' +
        '</div>';
    document.body.appendChild(overlay);

    // Close handlers
    function hideModal() { overlay.classList.remove('visible'); }
    document.getElementById('wsClose').addEventListener('click', hideModal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hideModal(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideModal(); });

    // ── showWalletSelector() — returns Promise<provider | null> ──
    window.showWalletSelector = function() {
        return new Promise(function(resolve) {
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            var body = document.getElementById('wsBody');
            body.innerHTML = '';
            var resolved = false;

            function done(val) {
                if (resolved) return;
                resolved = true;
                hideModal();
                resolve(val);
            }

            if (isMobile) {
                // ── Mobile: deep link buttons ──
                var sec = document.createElement('div');
                sec.className = 'ws-section';
                sec.innerHTML = '<div class="ws-section-label">Open in Wallet App</div>';

                KNOWN_WALLETS.forEach(function(w) {
                    var a = document.createElement('a');
                    a.className = 'ws-option';
                    a.href = w.deepLink(window.location.href);
                    a.innerHTML = '<img src="' + w.icon + '" alt="' + w.name + '">' +
                        '<div class="ws-option-info"><div class="ws-option-name">' + w.name + '</div></div>' +
                        '<span class="ws-option-tag ws-tag-open">Open</span>';
                    sec.appendChild(a);
                });
                body.appendChild(sec);
            } else {
                // ── Desktop: show detected wallets + install links ──
                // Re-request EIP-6963 to catch any late arrivals
                try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch(e) {}
                var providers = window._eip6963Providers || [];
                var detectedRdns = {};

                if (providers.length > 0) {
                    var detSec = document.createElement('div');
                    detSec.className = 'ws-section';
                    detSec.innerHTML = '<div class="ws-section-label">Detected Wallets</div>';

                    providers.forEach(function(p) {
                        var info = p.info || {};
                        var rdns = (info.rdns || '').toLowerCase();
                        detectedRdns[rdns] = true;

                        var btn = document.createElement('button');
                        btn.className = 'ws-option';
                        var iconSrc = info.icon || '';
                        btn.innerHTML = (iconSrc ? '<img src="' + iconSrc + '" alt="' + (info.name || 'Wallet') + '">' : '<div style="width:36px;height:36px;border-radius:8px;background:#333;flex-shrink:0"></div>') +
                            '<div class="ws-option-info"><div class="ws-option-name">' + (info.name || 'Unknown Wallet') + '</div></div>' +
                            '<span class="ws-option-tag ws-tag-detected">Detected</span>';
                        btn.addEventListener('click', function() { done(p.provider); });
                        detSec.appendChild(btn);
                    });
                    body.appendChild(detSec);
                }

                // Other wallets (not detected) — show install links
                var otherWallets = KNOWN_WALLETS.filter(function(w) { return !detectedRdns[w.rdns]; });
                if (otherWallets.length > 0) {
                    var otherSec = document.createElement('div');
                    otherSec.className = 'ws-section';
                    otherSec.innerHTML = '<div class="ws-section-label">' + (providers.length > 0 ? 'Other Wallets' : 'Install a Wallet') + '</div>';

                    otherWallets.forEach(function(w) {
                        var a = document.createElement('a');
                        a.className = 'ws-option';
                        a.href = w.installUrl;
                        a.target = '_blank';
                        a.rel = 'noopener';
                        a.innerHTML = '<img src="' + w.icon + '" alt="' + w.name + '">' +
                            '<div class="ws-option-info"><div class="ws-option-name">' + w.name + '</div></div>' +
                            '<span class="ws-option-tag ws-tag-install">Install</span>';
                        otherSec.appendChild(a);
                    });
                    body.appendChild(otherSec);
                }

                // If no EIP-6963 but window.ethereum exists (legacy), add a generic option
                if (providers.length === 0 && window.ethereum) {
                    var legSec = document.createElement('div');
                    legSec.className = 'ws-section';
                    legSec.innerHTML = '<div class="ws-section-label">Detected Wallets</div>';
                    var btn = document.createElement('button');
                    btn.className = 'ws-option';
                    btn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#6366f1;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0">W</div>' +
                        '<div class="ws-option-info"><div class="ws-option-name">Browser Wallet</div></div>' +
                        '<span class="ws-option-tag ws-tag-detected">Detected</span>';
                    btn.addEventListener('click', function() { done(window.ethereum); });
                    legSec.appendChild(btn);
                    body.appendChild(legSec);
                }
            }

            // Show modal — cancel on close
            overlay.classList.add('visible');

            // Override close to resolve null
            var origHide = hideModal;
            var closeBtn = document.getElementById('wsClose');
            function cancelClose() { done(null); }
            closeBtn.onclick = cancelClose;
            var overlayClick = function(e) { if (e.target === overlay) cancelClose(); };
            overlay.addEventListener('click', overlayClick);
            var escHandler = function(e) { if (e.key === 'Escape') cancelClose(); };
            document.addEventListener('keydown', escHandler);

            // Clean up listeners when resolved
            var origDone = done;
        });
    };
})();

(function() {
    var nav = document.querySelector('.nav');
    var navLinks = document.querySelector('.nav-links');
    if (!nav || !navLinks) return;

    // ── Mobile hamburger toggle ──
    try {
        var toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-label', 'Menu');
        toggle.innerHTML = '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        nav.appendChild(toggle);
        toggle.addEventListener('click', function() {
            navLinks.classList.toggle('open');
            var isOpen = navLinks.classList.contains('open');
            toggle.innerHTML = isOpen
                ? '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'
                : '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        });
    } catch(e) {}

    // ── Nav wallet button ──
    try {
        var walletEl = document.createElement('div');
        walletEl.className = 'nav-wallet';
        nav.appendChild(walletEl);

        async function disconnectWallet() {
            localStorage.removeItem('inclawbate_token');
            localStorage.removeItem('inclawbate_profile');
            document.cookie = 'inclawbate_token=; path=/; max-age=0';
            // Revoke wallet permissions so the picker shows again on next connect
            var eth = window.ethereum || (window.phantom && window.phantom.ethereum);
            if (eth) {
                try {
                    await eth.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
                } catch(e) { /* Not all wallets support this */ }
            }
            renderWallet();
            window.location.reload();
        }

        function renderWallet() {
            var token = localStorage.getItem('inclawbate_token');
            var profile = null;
            try { profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null'); } catch(e) {}
            // Sync token to cookie so server-side pages (paywall) can read it
            if (token) {
                document.cookie = 'inclawbate_token=' + encodeURIComponent(token) + '; path=/; max-age=2592000; SameSite=Lax';
            }

            if (token && profile && profile.wallet_address) {
                var addr = profile.wallet_address;
                var short = addr.slice(0, 6) + '…' + addr.slice(-4);
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + short + '</button>';
                document.getElementById('navWalletBtn').addEventListener('click', function() {
                    disconnectWallet();
                });
            } else if (token && profile) {
                var label = profile.display_name || 'Connected';
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + label + '</button>';
                document.getElementById('navWalletBtn').addEventListener('click', function() {
                    disconnectWallet();
                });
            } else {
                walletEl.innerHTML = '<button class="nav-wallet-btn" id="navWalletBtn">Connect</button>';
                document.getElementById('navWalletBtn').addEventListener('click', navWalletConnect);
            }
        }

        async function navWalletConnect() {
            var btn = document.getElementById('navWalletBtn');
            btn.textContent = 'Connecting…';
            btn.disabled = true;

            // Wait for late-loading wallets (Base Wallet, etc.)
            if (!window.ethereum && window._awaitProvider) {
                await window._awaitProvider();
            }

            var eth = null;
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            var providers = window._eip6963Providers || [];

            // Auto-connect: desktop with exactly 1 provider or legacy window.ethereum only
            if (!isMobile && providers.length === 1) {
                eth = providers[0].provider;
            } else if (!isMobile && providers.length === 0 && window.ethereum) {
                eth = window.ethereum;
            } else {
                // Show modal for: mobile, multiple providers, or no providers
                eth = await window.showWalletSelector();
            }

            if (!eth) {
                btn.textContent = 'Connect';
                btn.disabled = false;
                return;
            }

            try {
                var accounts = await eth.request({ method: 'eth_requestAccounts' });
                var address = accounts[0];

                var resp = await fetch('/api/inclawbate/wallet-connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: address })
                });

                var data = await resp.json();

                if (!resp.ok || !data.success) {
                    throw new Error(data.error || 'Connection failed');
                }

                localStorage.setItem('inclawbate_token', data.token);
                localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
                document.cookie = 'inclawbate_token=' + encodeURIComponent(data.token) + '; path=/; max-age=2592000; SameSite=Lax';

                // Post API key for extension relay
                if (data.profile.api_key) {
                    window.postMessage({
                        type: 'inclawbate-auth',
                        apiKey: data.profile.api_key
                    }, '*');
                }

                renderWallet();
                window.location.reload();
            } catch (e) {
                if (e.code !== 4001) {
                    alert(e.message || 'Wallet connection failed');
                }
                btn.textContent = 'Connect';
                btn.disabled = false;
            }
        }

        // Expose for other scripts
        window.navWalletConnect = navWalletConnect;

        renderWallet();
    } catch(e) {}
})();
