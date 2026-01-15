/* ═══════════════════════════════════════════════════════════════
   WALLET CONNECTION
   Shared wallet connection functionality across SUITE pages
   ═══════════════════════════════════════════════════════════════ */

// Restore wallet state on page load
document.addEventListener('DOMContentLoaded', function() {
    restoreWalletState();
});

// Restore wallet state from localStorage
function restoreWalletState() {
    const savedAddress = localStorage.getItem('suiteWalletAddress') || localStorage.getItem('suiteWallet');
    if (savedAddress) {
        const walletBtn = document.querySelector('.nav-wallet');
        if (walletBtn) {
            const shortAddress = `${savedAddress.slice(0, 6)}...${savedAddress.slice(-4)}`;
            walletBtn.classList.add('connected');
            walletBtn.textContent = shortAddress;
            // Sync both keys
            localStorage.setItem('suiteWalletAddress', savedAddress);
            localStorage.setItem('suiteWallet', savedAddress);
        }
    }
}

// Global wallet connection function
async function connectWallet() {
    const walletBtn = document.querySelector('.nav-wallet');

    // Check if already connected - disconnect
    if (walletBtn && walletBtn.classList.contains('connected')) {
        walletBtn.classList.remove('connected');
        walletBtn.textContent = 'Connect Wallet';
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
                walletBtn.textContent = shortAddress;
            }

            // Store in localStorage for persistence (both keys)
            localStorage.setItem('suiteWalletAddress', address);
            localStorage.setItem('suiteWallet', address);
            window.walletAddress = address;

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

// Listen for account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', function(accounts) {
        if (accounts.length === 0) {
            // User disconnected
            const walletBtn = document.querySelector('.nav-wallet');
            if (walletBtn) {
                walletBtn.classList.remove('connected');
                walletBtn.textContent = 'Connect Wallet';
            }
            localStorage.removeItem('suiteWalletAddress');
            localStorage.removeItem('suiteWallet');
            window.walletAddress = null;
        } else {
            // User switched accounts
            const address = accounts[0];
            const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
            const walletBtn = document.querySelector('.nav-wallet');
            if (walletBtn) {
                walletBtn.classList.add('connected');
                walletBtn.textContent = shortAddress;
            }
            localStorage.setItem('suiteWalletAddress', address);
            localStorage.setItem('suiteWallet', address);
            window.walletAddress = address;
        }
    });
}
