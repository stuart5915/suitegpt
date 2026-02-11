// Runs in MAIN world (page context) — can access localStorage directly
// Reads stored auth and posts it so auth-relay.js (isolated world) can relay to extension
try {
    var profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
    if (profile && profile.api_key) {
        window.postMessage({
            type: 'inclawbate-auth',
            apiKey: profile.api_key,
            xHandle: profile.x_handle || '',
            walletAddress: profile.wallet_address || ''
        }, '*');
    }
} catch(e) {}
