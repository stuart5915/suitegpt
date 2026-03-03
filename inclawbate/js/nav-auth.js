// Inclawbate — Nav: Mobile Menu + Wallet Connect
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

            if (token && profile && profile.wallet_address) {
                var addr = profile.wallet_address;
                var short = addr.slice(0, 6) + '…' + addr.slice(-4);
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + short + '</button>';
                document.getElementById('navWalletBtn').addEventListener('click', function() {
                    if (confirm('Disconnect wallet?')) {
                        localStorage.removeItem('inclawbate_token');
                        localStorage.removeItem('inclawbate_profile');
                        renderWallet();
                        window.location.reload();
                    }
                });
            } else if (token && profile) {
                var label = profile.x_handle && !profile.x_handle.startsWith('w_')
                    ? '@' + profile.x_handle
                    : (profile.x_name || 'Connected');
                walletEl.innerHTML = '<button class="nav-wallet-btn connected" id="navWalletBtn">' +
                    '<span class="nav-wallet-dot"></span>' + label + '</button>';
                document.getElementById('navWalletBtn').addEventListener('click', function() {
                    if (confirm('Disconnect?')) {
                        localStorage.removeItem('inclawbate_token');
                        localStorage.removeItem('inclawbate_profile');
                        renderWallet();
                        window.location.reload();
                    }
                });
            } else {
                walletEl.innerHTML = '<button class="nav-wallet-btn" id="navWalletBtn">Connect</button>';
                document.getElementById('navWalletBtn').addEventListener('click', navWalletConnect);
            }
        }

        async function navWalletConnect() {
            if (!window.ethereum) {
                alert('No wallet detected. Install MetaMask or Coinbase Wallet.');
                return;
            }

            var btn = document.getElementById('navWalletBtn');
            btn.textContent = 'Connecting…';
            btn.disabled = true;

            try {
                var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
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

                // Post API key for extension relay
                if (data.profile.api_key) {
                    window.postMessage({
                        type: 'inclawbate-auth',
                        apiKey: data.profile.api_key,
                        xHandle: data.profile.x_handle
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
