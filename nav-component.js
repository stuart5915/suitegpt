// Simple Nav Component - injects nav into <nav id="main-nav"></nav>
(function() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.className = 'nav';
    nav.innerHTML = `
        <div class="nav-inner">
            <a href="/" class="nav-logo">
                <img src="/assets/suite-logo-new.png" alt="SUITE" class="nav-logo-img">
                SUITE
            </a>
            <div class="nav-links">
                <a href="/apps.html">Apps</a>
                <a href="/docs/">Docs</a>
                <a href="/learn.html">Learn</a>
                <a href="/wallet.html">Vault</a>
            </div>
            <div class="nav-actions">
                <button class="nav-btn nav-wallet" onclick="connectWallet()">Connect Wallet</button>
            </div>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
                <span></span><span></span><span></span>
            </button>
        </div>
    `;
})();

function toggleMobileMenu() {
    document.querySelector('.mobile-menu-btn').classList.toggle('active');
    document.querySelector('.nav-links').classList.toggle('mobile-open');
}

async function connectWallet() {
    const btn = document.querySelector('.nav-wallet');
    if (!btn) return;

    // If already connected, disconnect
    if (btn.classList.contains('connected')) {
        btn.classList.remove('connected');
        btn.textContent = 'Connect Wallet';
        localStorage.removeItem('suiteWalletAddress');
        return;
    }

    // Check for MetaMask
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to connect your wallet');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            const addr = accounts[0];
            btn.classList.add('connected');
            btn.textContent = addr.slice(0,6) + '...' + addr.slice(-4);
            localStorage.setItem('suiteWalletAddress', addr);
        }
    } catch (e) {
        console.error('Wallet connection failed:', e);
    }
}

// Restore wallet state on load
(function() {
    const saved = localStorage.getItem('suiteWalletAddress');
    if (saved) {
        setTimeout(() => {
            const btn = document.querySelector('.nav-wallet');
            if (btn) {
                btn.classList.add('connected');
                btn.textContent = saved.slice(0,6) + '...' + saved.slice(-4);
            }
        }, 100);
    }
})();
