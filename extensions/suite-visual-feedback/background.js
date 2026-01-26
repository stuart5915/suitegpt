// SUITE Visual Feedback - Background Service Worker

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            agentEndpoint: 'ws://localhost:9999'
        });

        console.log('[SUITE Visual Feedback] Extension installed');
    }
});

// Handle keyboard shortcut command
chrome.commands?.onCommand?.addListener((command) => {
    if (command === 'toggle-selection') {
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-selection' });
            }
        });
    }
});
