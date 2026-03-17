// Inclawbate — Nav: Mobile Menu + Wallet Connect + Wallet Selector Modal

// ?reset param: nuke all cached wallet/auth state (for stuck sessions)
(function() {
    if (new URLSearchParams(window.location.search).has('reset')) {
        ['inclawbate_token','inclawbate_profile','connectedWallet','_stake_wallet','privy_login_info'].forEach(function(k) {
            try { localStorage.removeItem(k); } catch(e) {}
        });
        try {
            Object.keys(localStorage).forEach(function(k) {
                if (k.startsWith('wc@') || k.startsWith('walletconnect') || k.startsWith('@walletconnect')) localStorage.removeItem(k);
            });
        } catch(e) {}
        document.cookie = 'inclawbate_token=; path=/; max-age=0';
        // Strip ?reset from URL and reload clean
        var url = new URL(window.location);
        url.searchParams.delete('reset');
        window.location.replace(url.toString());
    }
})();

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
// LOGIN / WALLET SELECTOR MODAL
// ══════════════════════════════════════
(function() {
    // Known wallets for deep links + install links
    var KNOWN_WALLETS = [
        {
            name: 'Coinbase Wallet',
            rdns: 'com.coinbase.wallet',
            icon: "data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='48' height='48' rx='10' fill='%230052FF'/%3E%3Cpath d='M24 10c-7.732 0-14 6.268-14 14s6.268 14 14 14 14-6.268 14-14-6.268-14-14-14zm-5 11a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6z' fill='%23fff'/%3E%3C/svg%3E",
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
        '.ws-option{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:background .15s,border-color .15s;width:100%;margin-bottom:6px;text-decoration:none;font-family:inherit;font-size:inherit}',
        '.ws-option:hover{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.3)}',
        '.ws-option img{width:36px;height:36px;border-radius:8px;flex-shrink:0}',
        '.ws-option-info{flex:1;text-align:left}',
        '.ws-option-name{color:#fff;font-size:14px;font-weight:500}',
        '.ws-option-tag{font-size:11px;padding:2px 8px;border-radius:99px;font-weight:500;flex-shrink:0}',
        '.ws-tag-detected{background:rgba(52,211,153,.15);color:#34d399}',
        '.ws-tag-open{background:rgba(99,102,241,.15);color:#818cf8}',
        '.ws-tag-install{background:rgba(255,255,255,.08);color:#888}',
        '.ws-divider{display:flex;align-items:center;gap:12px;margin:16px 0;color:#444;font-size:12px}',
        '.ws-divider::before,.ws-divider::after{content:"";flex:1;height:1px;background:#333}',
        '.ws-email-form{display:flex;flex-direction:column;gap:8px}',
        '.ws-email-input{background:#1a1a22;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:14px;outline:none;font-family:inherit}',
        '.ws-email-input:focus{border-color:rgba(199,91,63,.5)}',
        '.ws-email-input::placeholder{color:#555}',
        '.ws-email-btn{background:linear-gradient(135deg,#c75b3f,#a84832);color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}',
        '.ws-email-btn:hover{opacity:.9}',
        '.ws-email-btn:disabled{opacity:.5;cursor:not-allowed}',
        '.ws-email-status{font-size:12px;color:#888;text-align:center}',
        '.ws-email-status.error{color:#ef4444}',
    ].join('\n');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'walletSelectorOverlay';
    overlay.innerHTML = '<div id="walletSelectorModal">' +
        '<div class="ws-header"><h3>Sign In</h3><button class="ws-close" id="wsClose">&times;</button></div>' +
        '<div id="wsBody"></div>' +
        '</div>';
    document.body.appendChild(overlay);

    // Close handlers
    function hideModal() { overlay.classList.remove('visible'); }
    document.getElementById('wsClose').addEventListener('click', hideModal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hideModal(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideModal(); });

    // ── Build the wallet-only selector (used as sub-view) ──
    function buildWalletSelector(body, done) {
        var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile) {
            try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch(e) {}
            var mobileProviders = window._eip6963Providers || [];

            if (mobileProviders.length > 0 || window.ethereum) {
                var connectSec = document.createElement('div');
                connectSec.className = 'ws-section';
                connectSec.innerHTML = '<div class="ws-section-label">Detected Wallet</div>';

                if (mobileProviders.length > 0) {
                    mobileProviders.forEach(function(p) {
                        var info = p.info || {};
                        var btn = document.createElement('button');
                        btn.className = 'ws-option';
                        var iconSrc = info.icon || '';
                        btn.innerHTML = (iconSrc ? '<img src="' + iconSrc + '" alt="' + (info.name || 'Wallet') + '">' : '<div style="width:36px;height:36px;border-radius:8px;background:#333;flex-shrink:0"></div>') +
                            '<div class="ws-option-info"><div class="ws-option-name">' + (info.name || 'Wallet') + '</div></div>' +
                            '<span class="ws-option-tag ws-tag-detected">Connect</span>';
                        btn.addEventListener('click', function() { done({ type: 'provider', provider: p.provider }); });
                        connectSec.appendChild(btn);
                    });
                } else {
                    var btn = document.createElement('button');
                    btn.className = 'ws-option';
                    btn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#6366f1;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0">W</div>' +
                        '<div class="ws-option-info"><div class="ws-option-name">Browser Wallet</div></div>' +
                        '<span class="ws-option-tag ws-tag-detected">Connect</span>';
                    btn.addEventListener('click', function() { done({ type: 'provider', provider: window.ethereum }); });
                    connectSec.appendChild(btn);
                }
                body.appendChild(connectSec);
            }

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

            if (window.WalletKit) {
                var wcSec = document.createElement('div');
                wcSec.className = 'ws-section';
                wcSec.innerHTML = '<div class="ws-section-label">Or Connect Remotely</div>';
                var wcBtn = document.createElement('button');
                wcBtn.className = 'ws-option';
                wcBtn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#3396FF;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="12" viewBox="0 0 480 280" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M98.1 69.4c78.4-76.8 205.5-76.8 283.9 0l9.4 9.2c3.9 3.8 3.9 10 0 13.9l-32.2 31.6c-2 1.9-5.1 1.9-7.1 0l-13-12.7c-54.7-53.6-143.3-53.6-198 0l-13.9 13.6c-2 1.9-5.1 1.9-7.1 0L88 93.3c-3.9-3.8-3.9-10 0-13.9l10.1-10zm350.9 65.3 28.7 28.1c3.9 3.8 3.9 10 0 13.9L349.2 302.6c-3.9 3.8-10.3 3.8-14.2 0l-91.8-89.9c-1-.9-2.6-.9-3.5 0l-91.8 89.9c-3.9 3.8-10.3 3.8-14.2 0L5.2 176.7c-3.9-3.8-3.9-10 0-13.9l28.7-28.1c3.9-3.8 10.3-3.8 14.2 0l91.8 89.9c1 .9 2.6.9 3.5 0l91.8-89.9c3.9-3.8 10.3-3.8 14.2 0l91.8 89.9c1 .9 2.6.9 3.5 0l91.8-89.9c4-3.9 10.3-3.9 14.3 0z" fill="#fff"/></svg></div>' +
                    '<div class="ws-option-info"><div class="ws-option-name">WalletConnect</div><div style="font-size:12px;color:#999;margin-top:2px">Scan with any wallet app</div></div>' +
                    '<span class="ws-option-tag ws-tag-open">Connect</span>';
                wcBtn.addEventListener('click', function() {
                    hideModal();
                    WalletKit.onConnect(function() {
                        var p = WalletKit.getProvider();
                        if (p) done({ type: 'provider', provider: p });
                    });
                    WalletKit.open();
                });
                wcSec.appendChild(wcBtn);
                body.appendChild(wcSec);
            }
        } else {
            try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch(e) {}
            var providers = window._eip6963Providers || [];
            var detectedRdns = {};
            var seenNames = {};
            var uniqueProviders = providers.filter(function(p) {
                var key = ((p.info && p.info.rdns) || (p.info && p.info.name) || '').toLowerCase();
                if (!key || seenNames[key]) return false;
                seenNames[key] = true;
                return true;
            });

            if (uniqueProviders.length > 0) {
                var detSec = document.createElement('div');
                detSec.className = 'ws-section';
                detSec.innerHTML = '<div class="ws-section-label">Detected Wallets</div>';
                uniqueProviders.forEach(function(p) {
                    var info = p.info || {};
                    detectedRdns[(info.rdns || '').toLowerCase()] = true;
                    var btn = document.createElement('button');
                    btn.className = 'ws-option';
                    var iconSrc = info.icon || '';
                    btn.innerHTML = (iconSrc ? '<img src="' + iconSrc + '" alt="' + (info.name || 'Wallet') + '">' : '<div style="width:36px;height:36px;border-radius:8px;background:#333;flex-shrink:0"></div>') +
                        '<div class="ws-option-info"><div class="ws-option-name">' + (info.name || 'Unknown Wallet') + '</div></div>' +
                        '<span class="ws-option-tag ws-tag-detected">Detected</span>';
                    btn.addEventListener('click', function() { done({ type: 'provider', provider: p.provider }); });
                    detSec.appendChild(btn);
                });
                body.appendChild(detSec);
            }

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

            if (providers.length === 0 && window.ethereum) {
                var legSec = document.createElement('div');
                legSec.className = 'ws-section';
                legSec.innerHTML = '<div class="ws-section-label">Detected Wallets</div>';
                var btn = document.createElement('button');
                btn.className = 'ws-option';
                btn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#6366f1;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0">W</div>' +
                    '<div class="ws-option-info"><div class="ws-option-name">Browser Wallet</div></div>' +
                    '<span class="ws-option-tag ws-tag-detected">Detected</span>';
                btn.addEventListener('click', function() { done({ type: 'provider', provider: window.ethereum }); });
                legSec.appendChild(btn);
                body.appendChild(legSec);
            }

            if (window.WalletKit) {
                var wcSec = document.createElement('div');
                wcSec.className = 'ws-section';
                wcSec.innerHTML = '<div class="ws-section-label">WalletConnect</div>';
                var wcBtn = document.createElement('button');
                wcBtn.className = 'ws-option';
                wcBtn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#3396FF;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="12" viewBox="0 0 480 280" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M98.1 69.4c78.4-76.8 205.5-76.8 283.9 0l9.4 9.2c3.9 3.8 3.9 10 0 13.9l-32.2 31.6c-2 1.9-5.1 1.9-7.1 0l-13-12.7c-54.7-53.6-143.3-53.6-198 0l-13.9 13.6c-2 1.9-5.1 1.9-7.1 0L88 93.3c-3.9-3.8-3.9-10 0-13.9l10.1-10zm350.9 65.3 28.7 28.1c3.9 3.8 3.9 10 0 13.9L349.2 302.6c-3.9 3.8-10.3 3.8-14.2 0l-91.8-89.9c-1-.9-2.6-.9-3.5 0l-91.8 89.9c-3.9 3.8-10.3 3.8-14.2 0L5.2 176.7c-3.9-3.8-3.9-10 0-13.9l28.7-28.1c3.9-3.8 10.3-3.8 14.2 0l91.8 89.9c1 .9 2.6.9 3.5 0l91.8-89.9c3.9-3.8 10.3-3.8 14.2 0l91.8 89.9c1 .9 2.6.9 3.5 0l91.8-89.9c4-3.9 10.3-3.9 14.3 0z" fill="#fff"/></svg></div>' +
                    '<div class="ws-option-info"><div class="ws-option-name">WalletConnect</div><div style="font-size:12px;color:#999;margin-top:2px">Scan QR with your phone</div></div>' +
                    '<span class="ws-option-tag ws-tag-open">Connect</span>';
                wcBtn.addEventListener('click', function() {
                    hideModal();
                    WalletKit.onConnect(function() {
                        var p = WalletKit.getProvider();
                        if (p) done({ type: 'provider', provider: p });
                    });
                    WalletKit.open();
                });
                wcSec.appendChild(wcBtn);
                body.appendChild(wcSec);
            }
        }
    }

    // ── showWalletSelector() — returns Promise<{ type, provider?, address? } | null> ──
    window.showWalletSelector = function() {
        return new Promise(function(resolve) {
            var body = document.getElementById('wsBody');
            body.innerHTML = '';
            var resolved = false;

            function done(val) {
                if (resolved) return;
                resolved = true;
                hideModal();
                resolve(val);
            }

            // ── Social Login Section (Google, Email) ──
            if (window.PrivyAuth) {
                var socialSec = document.createElement('div');
                socialSec.className = 'ws-section';

                // Google button
                var googleBtn = document.createElement('button');
                googleBtn.className = 'ws-option';
                googleBtn.innerHTML = '<div style="width:36px;height:36px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg></div>' +
                    '<div class="ws-option-info"><div class="ws-option-name">Continue with Google</div></div>';
                googleBtn.addEventListener('click', function() {
                    googleBtn.querySelector('.ws-option-name').textContent = 'Redirecting...';
                    window.PrivyAuth.loginWithGoogle();
                });
                socialSec.appendChild(googleBtn);

                // Email section
                var emailWrap = document.createElement('div');
                emailWrap.className = 'ws-email-form';
                emailWrap.innerHTML =
                    '<input type="email" class="ws-email-input" id="wsEmailInput" placeholder="Enter your email">' +
                    '<button class="ws-email-btn" id="wsEmailBtn">Continue with Email</button>' +
                    '<div class="ws-email-status" id="wsEmailStatus"></div>';
                socialSec.appendChild(emailWrap);
                body.appendChild(socialSec);

                // Email flow logic (after DOM is ready)
                setTimeout(function() {
                    var emailInput = document.getElementById('wsEmailInput');
                    var emailBtn = document.getElementById('wsEmailBtn');
                    var emailStatus = document.getElementById('wsEmailStatus');
                    var sentEmail = null;

                    emailBtn.addEventListener('click', async function() {
                        if (!sentEmail) {
                            // Step 1: Send code
                            var email = emailInput.value.trim();
                            if (!email || !email.includes('@')) {
                                emailStatus.textContent = 'Enter a valid email';
                                emailStatus.className = 'ws-email-status error';
                                return;
                            }
                            emailBtn.disabled = true;
                            emailBtn.textContent = 'Sending code...';
                            emailStatus.textContent = '';
                            try {
                                await window.PrivyAuth.sendEmailCode(email);
                                sentEmail = email;
                                emailInput.value = '';
                                emailInput.type = 'text';
                                emailInput.placeholder = 'Enter 6-digit code';
                                emailInput.maxLength = 6;
                                emailInput.setAttribute('inputmode', 'numeric');
                                emailBtn.textContent = 'Verify Code';
                                emailBtn.disabled = false;
                                emailStatus.textContent = 'Code sent to ' + email;
                                emailStatus.className = 'ws-email-status';
                            } catch(e) {
                                emailBtn.textContent = 'Continue with Email';
                                emailBtn.disabled = false;
                                emailStatus.textContent = e.message || 'Failed to send code';
                                emailStatus.className = 'ws-email-status error';
                            }
                        } else {
                            // Step 2: Verify code
                            var code = emailInput.value.trim();
                            if (!code || code.length < 6) {
                                emailStatus.textContent = 'Enter the 6-digit code';
                                emailStatus.className = 'ws-email-status error';
                                return;
                            }
                            emailBtn.disabled = true;
                            emailBtn.textContent = 'Verifying...';
                            emailStatus.textContent = '';
                            try {
                                var address = await window.PrivyAuth.verifyEmailCode(sentEmail, code);
                                done({ type: 'address', address: address });
                            } catch(e) {
                                emailBtn.textContent = 'Verify Code';
                                emailBtn.disabled = false;
                                emailStatus.textContent = e.message || 'Invalid code';
                                emailStatus.className = 'ws-email-status error';
                            }
                        }
                    });
                }, 0);
            }

            // ── Divider ──
            if (window.PrivyAuth) {
                var divider = document.createElement('div');
                divider.className = 'ws-divider';
                divider.textContent = 'or connect a wallet';
                body.appendChild(divider);
            }

            // ── Wallet Section ──
            buildWalletSelector(body, done);

            // Show modal
            overlay.classList.add('visible');

            var closeBtn = document.getElementById('wsClose');
            function cancelClose() { done(null); }
            closeBtn.onclick = cancelClose;
            overlay.addEventListener('click', function(e) { if (e.target === overlay) cancelClose(); });
            document.addEventListener('keydown', function(e) { if (e.key === 'Escape') cancelClose(); });
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
            localStorage.removeItem('connectedWallet');
            localStorage.removeItem('_stake_wallet');
            document.cookie = 'inclawbate_token=; path=/; max-age=0';
            // Logout from Privy if active
            if (window.PrivyAuth) {
                try { await window.PrivyAuth.logout(); } catch(e) {}
            }
            // Disconnect WalletKit/WalletConnect session if active
            try {
                if (window.WalletKit && window.WalletKit.disconnect) {
                    window.WalletKit.disconnect();
                }
            } catch(e) {}
            // Clear any WalletConnect cached sessions
            try {
                Object.keys(localStorage).forEach(function(key) {
                    if (key.startsWith('wc@') || key.startsWith('walletconnect') || key.startsWith('@walletconnect')) {
                        localStorage.removeItem(key);
                    }
                });
            } catch(e) {}
            // Revoke wallet permissions so the picker shows again on next connect
            // Try all discovered providers (MetaMask, Coinbase, etc.)
            var allProviders = [];
            if (window.ethereum) allProviders.push(window.ethereum);
            if (window.phantom && window.phantom.ethereum && window.phantom.ethereum !== window.ethereum) allProviders.push(window.phantom.ethereum);
            (window._eip6963Providers || []).forEach(function(p) {
                if (p.provider && allProviders.indexOf(p.provider) === -1) allProviders.push(p.provider);
            });
            for (var i = 0; i < allProviders.length; i++) {
                try {
                    await allProviders[i].request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
                } catch(e) { /* Not all wallets support this — Coinbase Wallet may ignore it */ }
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
                // Check if user logged in via Privy social login
                var privyInfo = null;
                try { privyInfo = JSON.parse(localStorage.getItem('privy_login_info') || 'null'); } catch(e) {}
                var displayLabel;
                if (privyInfo && privyInfo.email) {
                    // Truncate long emails
                    var em = privyInfo.email;
                    displayLabel = em.length > 18 ? em.slice(0, 15) + '…' : em;
                } else if (privyInfo && privyInfo.method) {
                    displayLabel = privyInfo.method === 'google' ? 'Google' : privyInfo.method === 'email' ? 'Email' : 'Signed in';
                } else {
                    var addr = profile.wallet_address;
                    displayLabel = addr.slice(0, 6) + '…' + addr.slice(-4);
                }
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + displayLabel + '</button>';
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

            // Always show wallet selector so user can pick the right wallet
            var result = await window.showWalletSelector();

            if (!result) {
                btn.textContent = 'Connect';
                btn.disabled = false;
                return;
            }

            try {
                var address;

                if (result.type === 'address') {
                    // Privy social login — address already obtained, backend auth already done
                    renderWallet();
                    window.location.reload();
                    return;
                } else {
                    // Traditional wallet — request accounts
                    var accounts = await result.provider.request({ method: 'eth_requestAccounts' });
                    address = accounts[0];
                }

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
                    alert(e.message || 'Connection failed');
                }
                btn.textContent = 'Connect';
                btn.disabled = false;
            }
        }

        // Expose for other scripts
        window.navWalletConnect = navWalletConnect;

        renderWallet();

        // Auto-reconnect: if no inclawbate session but Privy has one, re-auth
        if (!localStorage.getItem('inclawbate_token') && window.PrivyAuth) {
            window.PrivyAuth.getExistingSession().then(function(address) {
                if (address) {
                    fetch('/api/inclawbate/wallet-connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: address })
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            localStorage.setItem('inclawbate_token', data.token);
                            localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
                            document.cookie = 'inclawbate_token=' + encodeURIComponent(data.token) + '; path=/; max-age=2592000; SameSite=Lax';
                            renderWallet();
                        }
                    }).catch(function() {});
                }
            });
        }
    } catch(e) {}
})();

// ══════════════════════════════════════
// SOLANA WALLET (Wallet Standard — MetaMask, Phantom, etc.)
// ══════════════════════════════════════
(function() {
    // Discover wallets via Wallet Standard protocol
    var _registeredWallets = [];
    var _api = {
        register: function() {
            for (var i = 0; i < arguments.length; i++) _registeredWallets.push(arguments[i]);
        },
        get: function() { return _registeredWallets.slice(); },
        on: function() { return function(){}; }
    };
    window.addEventListener('wallet-standard:register-wallet', function(event) {
        if (event.detail && typeof event.detail === 'function') event.detail(_api);
    });
    try {
        window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: _api }));
    } catch(e) {}

    // Stored wallet + account for signing later
    window._solanaWalletStd = null;
    window._solanaAccount = null;

    // Phantom's native Solana provider (preferred — no simulation freeze)
    function getPhantomSolana() {
        return (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null);
    }

    // Track which provider we're using
    window._solanaProvider = null; // 'phantom' or 'walletStd'

    window.connectSolanaWallet = async function() {
        // 1. Try Phantom first (best Solana support, no simulation freeze)
        var phantom = getPhantomSolana();
        if (phantom) {
            try {
                var resp = await phantom.connect();
                window._solanaProvider = 'phantom';
                window._phantomSolana = phantom;
                return resp.publicKey.toString();
            } catch(e) {
                console.log('Phantom connect failed:', e);
            }
        }

        // 2. Fall back to Wallet Standard (MetaMask etc.)
        var wallets = _registeredWallets.filter(function(w) {
            return w.chains && w.chains.some(function(c) { return c.startsWith('solana:'); });
        });

        if (wallets.length === 0) {
            if (confirm('No Solana wallet detected. Install Phantom (recommended for Solana)?')) {
                window.open('https://phantom.app/download', '_blank');
            }
            return null;
        }

        var wallet = wallets[0];
        // Log available features for debugging
        console.log('[Solana] Wallet:', wallet.name, 'Features:', Object.keys(wallet.features || {}));

        var connectFeature = wallet.features && wallet.features['standard:connect'];
        if (!connectFeature) {
            alert('Wallet does not support Solana connect. Please install Phantom.');
            return null;
        }

        var result = await connectFeature.connect();
        var accounts = result.accounts || [];
        var account = accounts.find(function(a) {
            return a.chains && a.chains.some(function(c) { return c === 'solana:mainnet'; });
        }) || accounts[0];

        if (!account) {
            alert('No Solana account found. Please install Phantom for Solana support.');
            return null;
        }

        window._solanaWalletStd = wallet;
        window._solanaAccount = account;
        window._solanaProvider = 'walletStd';
        return account.address;
    };

    // Sign and send a Solana transaction (Uint8Array)
    var SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

    window.signAndSendSolanaTransaction = async function(txBytes) {
        // Phantom path — uses native signAndSendTransaction (no manual RPC needed)
        if (window._solanaProvider === 'phantom' && window._phantomSolana) {
            var phantom = window._phantomSolana;
            if (!window.solanaWeb3) throw new Error('solanaWeb3 not loaded.');
            var tx;
            try {
                tx = window.solanaWeb3.VersionedTransaction.deserialize(txBytes);
            } catch(e) {
                tx = window.solanaWeb3.Transaction.from(txBytes);
            }
            var result = await phantom.signAndSendTransaction(tx, { skipPreflight: true });
            return { signature: result.signature };
        }

        // Wallet Standard path (MetaMask etc.)
        var wallet = window._solanaWalletStd;
        var account = window._solanaAccount;
        if (!wallet || !account) throw new Error('Solana wallet not connected');

        // Try signTransaction first — may bypass MetaMask's simulation freeze
        var signFeature = wallet.features['solana:signTransaction'];
        if (signFeature) {
            console.log('[Solana] Using signTransaction (no simulation)');
            var signResult = await signFeature.signTransaction({
                account: account,
                transaction: txBytes,
                chain: 'solana:mainnet'
            });
            var signedBytes = signResult.signedTransaction || signResult;
            if (signedBytes instanceof Uint8Array) {
                var b64ws = btoa(String.fromCharCode.apply(null, signedBytes));
                var rpcResp2 = await fetch(SOLANA_RPC, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0', id: 1,
                        method: 'sendTransaction',
                        params: [b64ws, { encoding: 'base64', skipPreflight: true, preflightCommitment: 'confirmed' }]
                    })
                });
                var rpcData2 = await rpcResp2.json();
                if (rpcData2.error) throw new Error('Solana RPC error: ' + (rpcData2.error.message || JSON.stringify(rpcData2.error)));
                return { signature: rpcData2.result };
            }
        }

        // Last resort: signAndSendTransaction (may freeze on MetaMask)
        var sendFeature = wallet.features['solana:signAndSendTransaction'];
        if (!sendFeature) throw new Error('Wallet does not support Solana signing. Please install Phantom.');
        console.log('[Solana] Using signAndSendTransaction (may require simulation)');
        var result = await sendFeature.signAndSendTransaction({
            account: account,
            transaction: txBytes,
            chain: 'solana:mainnet'
        });
        return result;
    };
})();

// ══════════════════════════════════════
// CARDANO WALLET (CIP-30 — Nami, Eternl, Lace, Flint, Yoroi)
// ══════════════════════════════════════
(function() {
    var CARDANO_WALLETS = ['nami', 'eternl', 'lace', 'flint', 'yoroi', 'typhon', 'begin'];

    // Store enabled CIP-30 API handle
    window._cardanoWalletApi = null;

    window.connectCardanoWallet = async function() {
        if (!window.cardano) {
            if (confirm('No Cardano wallet detected. Install Nami or Eternl?')) {
                window.open('https://namiwallet.io/', '_blank');
            }
            return null;
        }

        // Find available wallets
        var available = CARDANO_WALLETS.filter(function(name) {
            return window.cardano && window.cardano[name];
        });

        if (available.length === 0) {
            if (confirm('No Cardano wallet detected. Install Nami or Eternl?')) {
                window.open('https://namiwallet.io/', '_blank');
            }
            return null;
        }

        // Use the first available wallet, prefer Nami > Eternl > Lace > others
        var walletName = available[0];
        console.log('[Cardano] Connecting to', walletName);

        try {
            var api = await window.cardano[walletName].enable();
            window._cardanoWalletApi = api;

            // Get used addresses (returns array of CBOR-encoded addresses)
            var addresses = await api.getUsedAddresses();
            if (!addresses || addresses.length === 0) {
                // Fallback to unused addresses
                addresses = await api.getUnusedAddresses();
            }
            if (!addresses || addresses.length === 0) {
                throw new Error('No addresses found in Cardano wallet');
            }

            // Convert hex address to bech32 for display
            // CIP-30 returns hex-encoded addresses; we'll use hex for the API
            var hexAddr = addresses[0];
            console.log('[Cardano] Connected, address (hex):', hexAddr);

            return hexAddr;
        } catch (e) {
            if (e.code === -3 || (e.message && e.message.includes('refused'))) {
                // User declined
                return null;
            }
            console.error('[Cardano] Connection failed:', e);
            alert('Cardano wallet connection failed: ' + (e.message || e));
            return null;
        }
    };

    // Sign and submit a Cardano transaction (CBOR hex string)
    window.signAndSubmitCardanoTx = async function(unsignedTxCbor) {
        var api = window._cardanoWalletApi;
        if (!api) throw new Error('Cardano wallet not connected');

        // Sign the transaction (partial = true allows the server to add its own signatures)
        var signedTxCbor = await api.signTx(unsignedTxCbor, true);

        // Submit the signed transaction
        var txHash;
        try {
            txHash = await api.submitTx(signedTxCbor);
        } catch (submitErr) {
            console.error('[Cardano] CIP-30 submitTx failed, trying server fallback:', submitErr);
            // Fallback: submit via server-side Blockfrost
            var fallbackResp = await fetch('/api/inclawbate/inclawbator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('inclawbate_token') || '')
                },
                body: JSON.stringify({
                    action: 'cardano-submit-tx',
                    signed_tx: signedTxCbor
                })
            });
            var fallbackData = await fallbackResp.json();
            if (fallbackData.error) throw new Error('Submit failed: ' + fallbackData.error);
            txHash = fallbackData.txHash;
        }

        console.log('[Cardano] Transaction submitted:', txHash);
        return { txHash: txHash };
    };
})();
