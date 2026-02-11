// Auth relay — runs on inclawbate.com pages
// Listens for postMessage from launch-app.js and relays API key to extension background

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'inclawbate-auth') return;

    chrome.runtime.sendMessage({
        action: 'set-api-key',
        apiKey: event.data.apiKey,
        xHandle: event.data.xHandle
    });
});
