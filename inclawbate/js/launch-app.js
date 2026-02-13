// Inclawbate — Launch Page (OAuth handler + wallet gate + redirect)
import { startXAuth, handleXCallback, getStoredAuth } from './x-auth-client.js';

const connectGate = document.getElementById('connectGate');
const connectBtn = document.getElementById('xConnectBtn');
const walletGate = document.getElementById('walletGate');
const extensionDone = document.getElementById('extensionDone');

let currentProfile = null;
let currentToken = null;

function getPostLoginRedirect() {
    const r = sessionStorage.getItem('inclawbate_redirect');
    sessionStorage.removeItem('inclawbate_redirect');
    return r || null;
}

// ── Post-auth: check wallet, then redirect or show wallet step ──
function afterAuth(profile, token, dest) {
    currentProfile = profile;
    currentToken = token;

    const fromExtension = new URLSearchParams(window.location.search).get('from') === 'extension'
        || sessionStorage.getItem('inclawbate_from_extension') === '1';
    sessionStorage.removeItem('inclawbate_from_extension');

    // Post API key for extension auth-relay
    if (profile.api_key) {
        window.postMessage({
            type: 'inclawbate-auth',
            apiKey: profile.api_key,
            xHandle: profile.x_handle
        }, '*');
    }

    // If opened from extension, show "Connected!" and don't redirect
    if (fromExtension) {
        connectGate.classList.add('hidden');
        walletGate.classList.add('hidden');
        extensionDone.classList.remove('hidden');
        return;
    }

    // If wallet already linked, go straight through
    if (profile.wallet_address) {
        setTimeout(() => {
            window.location.href = dest || `/u/${profile.x_handle}`;
        }, 500); // small delay for auth-relay
        return;
    }

    // No wallet — show wallet step
    connectGate.classList.add('hidden');
    walletGate.classList.remove('hidden');

    // Store dest so wallet continue button knows where to go
    walletGate.dataset.dest = dest || `/u/${profile.x_handle}`;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    const redirectParam = params.get('redirect');
    if (redirectParam && /^\/[a-z]/.test(redirectParam)) {
        sessionStorage.setItem('inclawbate_redirect', redirectParam);
    }

    // Persist extension context through OAuth redirect
    if (params.get('from') === 'extension') {
        sessionStorage.setItem('inclawbate_from_extension', '1');
    }

    // X sent back an error
    if (params.has('error')) {
        const desc = params.get('error_description') || 'X denied access. Please try again.';
        connectGate.querySelector('h2').textContent = 'Connection Failed';
        connectGate.querySelector('p').textContent = desc;
        connectBtn.classList.remove('hidden');
        connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
        window.history.replaceState({}, '', '/launch');
        return;
    }

    // Handle OAuth callback
    if (code) {
        connectGate.querySelector('h2').textContent = 'Connecting...';
        connectGate.querySelector('p').textContent = 'Setting up your profile...';
        connectBtn.classList.add('hidden');

        try {
            const result = await handleXCallback(code, state);
            const dest = getPostLoginRedirect();
            afterAuth(result.profile, result.token, dest);
        } catch (err) {
            // Clear stale PKCE data so next attempt starts completely fresh
            localStorage.removeItem('x_code_verifier');
            localStorage.removeItem('x_auth_state');
            connectGate.querySelector('h2').textContent = 'Connection Failed';
            connectGate.querySelector('p').textContent = err.message;
            connectBtn.classList.remove('hidden');
            connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
            window.history.replaceState({}, '', '/launch');
        }
        return;
    }

    // Already authenticated
    const stored = getStoredAuth();
    if (stored && stored.profile && stored.profile.x_handle && !params.has('switch')) {
        const dest = getPostLoginRedirect() || redirectParam;
        afterAuth(stored.profile, stored.token, dest);
        return;
    }

    // Clear existing auth so a different account can connect
    if (stored) {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
    }

    // Anti-loop: only auto-start OAuth if we haven't tried in the last 30s
    const lastAttempt = sessionStorage.getItem('oauth_attempt_ts');
    const now = Date.now();
    if (lastAttempt && now - parseInt(lastAttempt) < 30000) {
        connectGate.querySelector('h2').textContent = 'Connect X to get started';
        connectGate.querySelector('p').textContent = 'One click. Your X profile becomes a human API that AI agents can discover, hire, and pay in $CLAWNCH.';
        connectBtn.classList.remove('hidden');
        return;
    }

    // Not authed, no code → auto-start OAuth
    connectGate.querySelector('h2').textContent = 'Redirecting to X...';
    connectGate.querySelector('p').textContent = '';
    connectBtn.classList.add('hidden');

    sessionStorage.setItem('oauth_attempt_ts', now.toString());
    try {
        await startXAuth();
    } catch (err) {
        connectGate.querySelector('h2').textContent = 'Connect X to get started';
        connectGate.querySelector('p').textContent = 'One click. Your X profile becomes a human API that AI agents can discover, hire, and pay in $CLAWNCH.';
        connectBtn.classList.remove('hidden');
    }
}

// ── Connect X button ──
connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Redirecting to X...';
    try {
        await startXAuth();
    } catch (err) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
        alert('Failed: ' + err.message);
    }
});

// ── Wallet step ──
const walletConnectBtn = document.getElementById('walletConnectBtn');
const walletContinueBtn = document.getElementById('walletContinueBtn');
const walletDisplay = document.getElementById('walletDisplay');
const walletError = document.getElementById('walletError');

walletConnectBtn?.addEventListener('click', async () => {
    walletError.textContent = '';

    if (!window.ethereum) {
        walletError.textContent = 'No wallet detected. Install MetaMask or Coinbase Wallet.';
        return;
    }

    walletConnectBtn.disabled = true;
    walletConnectBtn.textContent = 'Connecting...';

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // Switch to Base
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }]
            });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x2105',
                        chainName: 'Base',
                        rpcUrls: ['https://mainnet.base.org'],
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://basescan.org']
                    }]
                });
            }
        }

        // Save wallet to profile
        const token = localStorage.getItem('inclawbate_token');
        const resp = await fetch('/api/inclawbate/humans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ wallet_address: address })
        });

        if (!resp.ok) {
            throw new Error('Failed to save wallet');
        }

        // Update stored profile
        try {
            const stored = JSON.parse(localStorage.getItem('inclawbate_profile') || '{}');
            stored.wallet_address = address;
            localStorage.setItem('inclawbate_profile', JSON.stringify(stored));
        } catch (e) {}

        // Show connected state
        const short = address.slice(0, 6) + '...' + address.slice(-4);
        walletDisplay.textContent = short;
        walletDisplay.classList.remove('hidden');
        walletConnectBtn.classList.add('hidden');
        walletContinueBtn.classList.remove('hidden');

    } catch (err) {
        if (err.code !== 4001) {
            walletError.textContent = err.message || 'Wallet connection failed';
        }
        walletConnectBtn.disabled = false;
        walletConnectBtn.textContent = 'Connect Wallet';
    }
});

walletContinueBtn?.addEventListener('click', () => {
    const dest = walletGate.dataset.dest || '/';
    window.location.href = dest;
});

init();
