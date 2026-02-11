// Inclawbate — Launch Page (OAuth handler + redirect)
// If already authed → redirect to profile
// If has OAuth code → handle callback → redirect to profile
// If not authed → show Connect X button
import { startXAuth, handleXCallback, getStoredAuth } from './x-auth-client.js';

const connectGate = document.getElementById('connectGate');
const connectBtn = document.getElementById('xConnectBtn');

async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Handle OAuth callback
    if (code) {
        connectGate.querySelector('h2').textContent = 'Connecting...';
        connectGate.querySelector('p').textContent = 'Setting up your profile...';
        connectBtn.classList.add('hidden');

        try {
            const result = await handleXCallback(code, state);
            // Redirect to their profile
            window.location.href = `/u/${result.profile.x_handle}`;
        } catch (err) {
            connectGate.querySelector('h2').textContent = 'Connection Failed';
            connectGate.querySelector('p').textContent = err.message;
            connectBtn.classList.remove('hidden');
            connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
        }
        return;
    }

    // Already authenticated → go to profile
    const stored = getStoredAuth();
    if (stored && stored.profile && stored.profile.x_handle) {
        window.location.href = `/u/${stored.profile.x_handle}`;
        return;
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
