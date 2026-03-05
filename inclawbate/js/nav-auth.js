// Inclawbate — Nav: Mobile Menu + Wallet Connect

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
                    localStorage.removeItem('inclawbate_token');
                    localStorage.removeItem('inclawbate_profile');
                    document.cookie = 'inclawbate_token=; path=/; max-age=0';
                    renderWallet();
                    window.location.reload();
                });
            } else if (token && profile) {
                var label = profile.display_name || 'Connected';
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + label + '</button>';
                document.getElementById('navWalletBtn').addEventListener('click', function() {
                    localStorage.removeItem('inclawbate_token');
                    localStorage.removeItem('inclawbate_profile');
                    document.cookie = 'inclawbate_token=; path=/; max-age=0';
                    renderWallet();
                    window.location.reload();
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
            var eth = window.ethereum || (window.phantom && window.phantom.ethereum);
            if (!eth) {
                var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isMobile) {
                    if (confirm('To connect on mobile, open this page in your wallet app\'s browser.\n\nOpen in Phantom?')) {
                        window.location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(window.location.href);
                    }
                } else {
                    alert('No wallet detected. Install MetaMask, Phantom, Coinbase Wallet, or Base Wallet.');
                }
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
