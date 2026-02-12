// Runs in MAIN world (page context) — can access localStorage directly
// Reads stored auth and posts it so auth-relay.js (isolated world) can relay to extension
try {
    var profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
    var token = localStorage.getItem('inclawbate_token') || '';
    if (profile && (profile.api_key || token)) {
        window.postMessage({
            type: 'inclawbate-auth',
            apiKey: profile.api_key || '',
            token: token,
            xHandle: profile.x_handle || '',
            walletAddress: profile.wallet_address || ''
        }, '*');
    }
} catch(e) {}
