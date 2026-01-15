// nav-component.js - Single source of truth for SUITE navigation
// Include this script and add <nav id="main-nav"></nav> to any page

(function () {
    const isSubfolder = window.location.pathname.includes('/docs/') || window.location.pathname.includes('/learn/');
    const basePath = isSubfolder ? '../' : '';

    const navHTML = `
    <div class="nav-inner">
        <a href="${basePath}index.html" class="nav-logo">
            <img src="${basePath}assets/suite-token.png" alt="SUITE" class="nav-logo-img">
            SUITE
        </a>
        <div class="nav-links">
            <a href="${basePath}apps.html">Apps</a>
            <a href="${basePath}developer-portal.html">Build</a>
            <a href="${basePath}docs/">Docs</a>
            <a href="${basePath}learn.html">Learn</a>
            <a href="${basePath}wallet.html">Vault</a>
            <a href="${basePath}start-building.html" class="nav-cta"><img src="${basePath}assets/emojis/clay-rocket.png" alt="" class="nav-cta-emoji"> Start Building</a>
        </div>
        <div class="nav-actions">
            <button class="nav-btn nav-wallet" onclick="connectWallet()">
                🔗 Connect Wallet
            </button>
        </div>
        <button class="mobile-menu-btn" onclick="this.classList.toggle('active'); document.querySelector('.nav-links').classList.toggle('mobile-open'); document.querySelector('.nav-actions').classList.toggle('mobile-open');">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
    `;

    // Inject nav when DOM is ready
    function injectNav() {
        const navElement = document.getElementById('main-nav');
        if (navElement) {
            navElement.className = 'nav';
            navElement.innerHTML = navHTML;
        }
    }

    // Restore wallet state after nav is injected
    function restoreWalletState() {
        // Check both possible localStorage keys
        const savedAddress = localStorage.getItem('suiteWalletAddress') || localStorage.getItem('suiteWallet');
        if (savedAddress) {
            const walletBtn = document.querySelector('.nav-wallet');
            if (walletBtn) {
                const shortAddress = `${savedAddress.slice(0, 6)}...${savedAddress.slice(-4)}`;
                walletBtn.classList.add('connected');
                walletBtn.innerHTML = `✅ ${shortAddress}`;
                // Sync both keys
                localStorage.setItem('suiteWalletAddress', savedAddress);
                localStorage.setItem('suiteWallet', savedAddress);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectNav();
            restoreWalletState();
        });
    } else {
        injectNav();
        restoreWalletState();
    }
})();

// Global wallet connection function
async function connectWallet() {
    const walletBtn = document.querySelector('.nav-wallet');

    // Check if already connected
    if (walletBtn && walletBtn.classList.contains('connected')) {
        // Disconnect - clear state
        walletBtn.classList.remove('connected');
        walletBtn.innerHTML = '🔗 Connect Wallet';
        localStorage.removeItem('suiteWalletAddress');
        localStorage.removeItem('suiteWallet'); // Also clear wallet.html key
        window.walletAddress = null;
        return;
    }

    // Check for MetaMask/Ethereum provider
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet to connect!');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts.length > 0) {
            const address = accounts[0];
            const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

            // Update button state
            if (walletBtn) {
                walletBtn.classList.add('connected');
                walletBtn.innerHTML = `✅ ${shortAddress}`;
            }

            // Store in localStorage for persistence
            localStorage.setItem('suiteWalletAddress', address);

            console.log('Wallet connected:', address);
        }
    } catch (error) {
        console.error('Wallet connection failed:', error);
        if (error.code === 4001) {
            // User rejected the request
            alert('Connection cancelled. Click Connect Wallet to try again.');
        } else {
            alert('Failed to connect wallet. Please try again.');
        }
    }
}
