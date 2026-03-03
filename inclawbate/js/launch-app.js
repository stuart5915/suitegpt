// Inclawbate — Launch Page (wallet-only auth + redirect)

const walletGate = document.getElementById('walletGate');
const walletConnectBtn = document.getElementById('walletConnectBtn');
const walletContinueBtn = document.getElementById('walletContinueBtn');
const walletDisplay = document.getElementById('walletDisplay');
const walletError = document.getElementById('walletError');

let currentProfile = null;
let currentToken = null;

function getPostLoginRedirect() {
    const r = sessionStorage.getItem('inclawbate_redirect');
    sessionStorage.removeItem('inclawbate_redirect');
    return r || null;
}

function getStoredAuth() {
    try {
        const token = localStorage.getItem('inclawbate_token');
        const profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
        if (token && profile) return { token, profile };
    } catch (e) {}
    return null;
}

// ── Post-auth: relay API key for extension, then redirect ──
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

    // If opened from extension, show connected state
    if (fromExtension) {
        walletGate.querySelector('h2').textContent = 'Connected!';
        walletGate.querySelector('p').textContent = 'Your extension is authenticated. You can close this tab.';
        walletConnectBtn.classList.add('hidden');
        return;
    }

    // Already authenticated — redirect
    const destination = dest || '/dashboard';
    setTimeout(() => {
        window.location.href = destination;
    }, 500);
}

// ── Wallet sign-in (same pattern as Build Studio) ──
async function walletSignIn() {
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
        const timestamp = Math.floor(Date.now() / 1000);
        const message = 'Sign in to Inclawbate\nWallet: ' + address + '\nTimestamp: ' + timestamp;

        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, address]
        });

        walletConnectBtn.textContent = 'Signing in...';

        const resp = await fetch('/api/inclawbate/wallet-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature, message })
        });

        const data = await resp.json();

        if (!resp.ok || !data.success) {
            throw new Error(data.error || 'Wallet login failed. Please try again.');
        }

        localStorage.setItem('inclawbate_token', data.token);
        localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));

        // Show connected state
        const short = address.slice(0, 6) + '...' + address.slice(-4);
        walletDisplay.textContent = short;
        walletDisplay.classList.remove('hidden');
        walletConnectBtn.classList.add('hidden');

        const dest = getPostLoginRedirect();
        afterAuth(data.profile, data.token, dest);

    } catch (err) {
        if (err.code !== 4001) { // user rejected
            walletError.textContent = err.message || 'Wallet connection failed';
        }
        walletConnectBtn.disabled = false;
        walletConnectBtn.textContent = 'Connect Wallet';
    }
}

// ── Init ──
function init() {
    const params = new URLSearchParams(window.location.search);

    const redirectParam = params.get('redirect');
    if (redirectParam && /^\/[a-z]/.test(redirectParam)) {
        sessionStorage.setItem('inclawbate_redirect', redirectParam);
    }

    // Persist extension context
    if (params.get('from') === 'extension') {
        sessionStorage.setItem('inclawbate_from_extension', '1');
    }

    // Already authenticated — skip to redirect
    const stored = getStoredAuth();
    if (stored && stored.profile && !params.has('switch')) {
        const dest = getPostLoginRedirect() || redirectParam;
        afterAuth(stored.profile, stored.token, dest);
        return;
    }

    // Clear stale auth if switching accounts
    if (stored) {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
    }
}

// ── Connect Wallet button ──
walletConnectBtn?.addEventListener('click', walletSignIn);

init();
