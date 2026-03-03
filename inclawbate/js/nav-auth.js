// Inclawbate — Nav: Mobile Menu + Wallet Button
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
                // Logged in but no wallet address displayed — show name or handle
                var label = profile.x_handle && !profile.x_handle.startsWith('w_')
                    ? '@' + profile.x_handle
                    : (profile.x_name || 'Connected');
                walletEl.innerHTML = '<a href="/dashboard" class="nav-wallet-btn connected">' +
                    '<span class="nav-wallet-dot"></span>' + label + '</a>';
            } else {
                walletEl.innerHTML = '<a href="/launch" class="nav-wallet-btn">Connect</a>';
            }
        }

        renderWallet();
    } catch(e) {}
})();
