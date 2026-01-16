/**
 * SUITE Docs Shared Navigation Component
 * Single source of truth for all docs page navigation
 * Injects consistent nav HTML across all pages
 */

document.addEventListener('DOMContentLoaded', function () {
    // Find nav element by ID or class
    let nav = document.querySelector('#main-nav') || document.querySelector('nav.nav');

    if (nav) {
        // Replace existing nav with standardized version
        nav.outerHTML = `
            <nav class="nav">
                <div class="nav-inner">
                    <a href="../index.html" class="nav-logo">
                        <img src="../assets/suite-logo-new.png" alt="SUITE" class="nav-logo-img">
                        SUITE
                    </a>
                    <div class="nav-links">
                        <a href="../apps.html">Apps</a>
                        <a href="index.html" class="active">Docs</a>
                        <a href="../learn.html">Learn</a>
                        <a href="../wallet.html">Vault</a>
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
            </nav>
        `;
    }

    // Restore wallet state
    restoreDocsWalletState();
});

// Restore wallet state for docs pages
function restoreDocsWalletState() {
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

// Global wallet connection function for docs pages
async function connectWallet() {
    const walletBtn = document.querySelector('.nav-wallet');

    // Check if already connected - disconnect
    if (walletBtn && walletBtn.classList.contains('connected')) {
        walletBtn.classList.remove('connected');
        walletBtn.innerHTML = '🔗 Connect Wallet';
        localStorage.removeItem('suiteWalletAddress');
        localStorage.removeItem('suiteWallet');
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

            // Store in localStorage for persistence (both keys)
            localStorage.setItem('suiteWalletAddress', address);
            localStorage.setItem('suiteWallet', address);

            console.log('Wallet connected:', address);
        }
    } catch (error) {
        console.error('Wallet connection failed:', error);
        if (error.code === 4001) {
            alert('Connection cancelled. Click Connect Wallet to try again.');
        } else {
            alert('Failed to connect wallet. Please try again.');
        }
    }
}
