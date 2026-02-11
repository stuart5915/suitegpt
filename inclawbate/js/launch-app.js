// Inclawbate — Launch Page (OAuth handler + redirect)
// If already authed → redirect to profile
// If has OAuth code → handle callback → redirect to profile
// If not authed → show Connect X button
import { startXAuth, handleXCallback, getStoredAuth } from './x-auth-client.js';

const connectGate = document.getElementById('connectGate');
const connectBtn = document.getElementById('xConnectBtn');

function getPostLoginRedirect() {
    const r = sessionStorage.getItem('inclawbate_redirect');
    sessionStorage.removeItem('inclawbate_redirect');
    return r || null;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Stash redirect param before OAuth clears the URL
    const redirectParam = params.get('redirect');
    if (redirectParam && /^\/[a-z]/.test(redirectParam)) {
        sessionStorage.setItem('inclawbate_redirect', redirectParam);
    }

    // X sent back an error (user denied, rate limit, etc.) — don't auto-retry
    if (params.has('error')) {
        const desc = params.get('error_description') || 'X denied access. Please try again.';
        connectGate.querySelector('h2').textContent = 'Connection Failed';
        connectGate.querySelector('p').textContent = desc;
        connectBtn.classList.remove('hidden');
        connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
        // Clean URL
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
            // Post API key for extension auth-relay to pick up
            if (result.profile && result.profile.api_key) {
                window.postMessage({
                    type: 'inclawbate-auth',
                    apiKey: result.profile.api_key,
                    xHandle: result.profile.x_handle
                }, '*');
            }
            // Small delay so auth-relay content script can relay to extension
            await new Promise(r => setTimeout(r, 300));
            // Redirect to stashed destination or profile
            window.location.href = getPostLoginRedirect() || `/u/${result.profile.x_handle}`;
        } catch (err) {
            connectGate.querySelector('h2').textContent = 'Connection Failed';
            connectGate.querySelector('p').textContent = err.message;
            connectBtn.classList.remove('hidden');
            connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
            // Clean URL so refresh doesn't replay stale code
            window.history.replaceState({}, '', '/launch');
        }
        return;
    }

    // Already authenticated → go to redirect destination or profile
    const stored = getStoredAuth();
    if (stored && stored.profile && stored.profile.x_handle && !params.has('switch')) {
        window.location.href = getPostLoginRedirect() || redirectParam || `/u/${stored.profile.x_handle}`;
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

    // Not authed, no code → auto-start OAuth (no double click)
    connectGate.querySelector('h2').textContent = 'Redirecting to X...';
    connectGate.querySelector('p').textContent = '';
    connectBtn.classList.add('hidden');

    sessionStorage.setItem('oauth_attempt_ts', now.toString());
    try {
        await startXAuth();
    } catch (err) {
        // Fallback: show the button if auto-redirect fails
        connectGate.querySelector('h2').textContent = 'Connect X to get started';
        connectGate.querySelector('p').textContent = 'One click. Your X profile becomes a human API that AI agents can discover, hire, and pay in $CLAWNCH.';
        connectBtn.classList.remove('hidden');
    }
}

// Connect button → start OAuth
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

init();
