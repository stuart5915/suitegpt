// Just4Claws Nav + Wallet Connect
// Simple: connect wallet, store address, click to disconnect

const _B = window.J4C_BASE || '';

// ── EIP-6963: discover wallets ──
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
})();

// ── Render nav ──
function renderNav() {
    const currentPath = window.location.pathname;
    const nav = document.createElement('nav');
    nav.className = 'j4c-nav';
    nav.innerHTML = `
        <div class="j4c-nav-inner">
            <a href="${_B || '/'}" class="j4c-nav-brand">Just4Claws</a>
            <div class="j4c-nav-links" id="nav-links">
                <a href="${_B}/app" class="j4c-nav-link ${currentPath.endsWith('/app') ? 'active' : ''}">Discover</a>
                <a href="${_B}/feed" class="j4c-nav-link ${currentPath.endsWith('/feed') ? 'active' : ''}">Feed</a>
                <a href="${_B}/studio" class="j4c-nav-link ${currentPath.endsWith('/studio') ? 'active' : ''}">Studio</a>
            </div>
            <div class="j4c-nav-actions">
                <button class="j4c-nav-hamburger" onclick="toggleMobileNav()">&#9776;</button>
                <div class="nav-wallet" id="nav-wallet"></div>
            </div>
        </div>
    `;
    document.body.prepend(nav);
    renderWalletBtn();
}

// ── Wallet button ──
function renderWalletBtn() {
    const el = document.getElementById('nav-wallet');
    if (!el) return;

    const addr = localStorage.getItem('j4c_wallet');

    if (addr) {
        const short = addr.slice(0, 6) + '…' + addr.slice(-4);
        el.innerHTML = `<button class="j4c-wallet-btn connected" onclick="disconnectWallet()">${short}</button>`;
        window.j4c.wallet = addr;
    } else {
        el.innerHTML = `<button class="j4c-wallet-btn" onclick="connectJ4CWallet()">Connect</button>`;
        window.j4c.wallet = null;
    }
}

async function connectJ4CWallet() {
    const btn = document.querySelector('.j4c-wallet-btn');
    if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }

    try {
        let eth = window.ethereum;

        if (!eth) {
            alert('No wallet detected. Install MetaMask or Coinbase Wallet.');
            if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
            return;
        }

        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        const address = accounts[0].toLowerCase();

        localStorage.setItem('j4c_wallet', address);
        window.j4c.wallet = address;
        renderWalletBtn();
    } catch(e) {
        if (e.code !== 4001) alert(e.message || 'Connection failed');
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
    }
}

async function disconnectWallet() {
    localStorage.removeItem('j4c_wallet');
    window.j4c.wallet = null;

    // Try revoking wallet permissions
    if (window.ethereum) {
        try { await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch(e) {}
    }

    renderWalletBtn();
}

function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('mobile-open');
}

// ── Inject wallet button styles ──
const walletStyle = document.createElement('style');
walletStyle.textContent = `
    .j4c-wallet-btn {
        padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 600;
        border: 1px solid rgba(255,255,255,0.15); cursor: pointer;
        font-family: inherit; transition: all 0.2s;
        background: linear-gradient(135deg, #627eea, #3b5998); color: #fff;
    }
    .j4c-wallet-btn:hover { opacity: 0.9; }
    .j4c-wallet-btn.connected {
        background: rgba(255,255,255,0.06); border-color: rgba(99,102,241,0.3);
        color: #a5b4fc;
    }
    .j4c-wallet-btn.connected:hover { border-color: rgba(239,68,68,0.5); color: #fca5a5; }
    .j4c-wallet-btn:disabled { opacity: 0.5; }
`;
document.head.appendChild(walletStyle);

// Init
renderNav();
