/**
 * SUITE Visual Feedback - Background Service Worker
 * Handles screenshot capture and cross-tab communication
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureScreenshot') {
        captureVisibleTab(sender.tab.id, message.bounds)
            .then(dataUrl => sendResponse({ dataUrl }))
            .catch(error => {
                console.error('Screenshot error:', error);
                sendResponse({ error: error.message });
            });
        return true; // Keep channel open for async response
    }
});

// Capture the visible tab
async function captureVisibleTab(tabId, bounds) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: 90
        });

        // If bounds specified, crop the image
        if (bounds) {
            return await cropImage(dataUrl, bounds);
        }

        return dataUrl;
    } catch (error) {
        console.error('Capture failed:', error);
        throw error;
    }
}

// Crop image to specified bounds
async function cropImage(dataUrl, bounds) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = new OffscreenCanvas(bounds.width, bounds.height);
            const ctx = canvas.getContext('2d');

            // Account for device pixel ratio
            const dpr = 1; // Simplified for service worker

            ctx.drawImage(
                img,
                bounds.left * dpr,
                bounds.top * dpr,
                bounds.width * dpr,
                bounds.height * dpr,
                0,
                0,
                bounds.width,
                bounds.height
            );

            canvas.convertToBlob({ type: 'image/png' })
                .then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                })
                .catch(reject);
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('SUITE Visual Feedback installed! Press Ctrl+Shift+F on any page to start.');
    }
});

// Handle keyboard shortcut command
chrome.commands?.onCommand?.addListener((command) => {
    if (command === 'toggle-feedback') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' });
            }
        });
    }
});
