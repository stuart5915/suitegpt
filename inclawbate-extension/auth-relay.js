// Auth relay — runs on ALL inclawbate.com pages
// Proactively reads auth from localStorage and sends to extension background
// Content scripts can't access page localStorage directly (isolated world),
// so we inject a small inline script that reads it and postMessages back.

// 1. Listen for auth messages
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'inclawbate-auth') return;

    chrome.runtime.sendMessage({
        action: 'set-api-key',
        apiKey: event.data.apiKey,
        xHandle: event.data.xHandle
    });
});

// 2. Inject script to read localStorage and post auth data
function injectAuthCheck() {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            try {
                var profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
                if (profile && profile.api_key) {
                    window.postMessage({
                        type: 'inclawbate-auth',
                        apiKey: profile.api_key,
                        xHandle: profile.x_handle || ''
                    }, '*');
                }
            } catch(e) {}
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
}

// Run when DOM is ready (auth-relay runs at document_start)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAuthCheck);
} else {
    injectAuthCheck();
}
