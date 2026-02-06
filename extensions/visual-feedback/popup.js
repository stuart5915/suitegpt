/**
 * SUITE Visual Feedback - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
    const activateBtn = document.getElementById('activateBtn');
    const statusBadge = document.getElementById('status');

    // Check current status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    updateStatus(false);
                } else if (response) {
                    updateStatus(response.active);
                }
            });
        }
    });

    // Activate button
    activateBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const tabId = tabs[0].id;

            chrome.tabs.sendMessage(tabId, { action: 'toggle' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // Content script not loaded — inject it, then retry
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content.js']
                    }).then(() => {
                        return chrome.scripting.insertCSS({
                            target: { tabId },
                            files: ['content.css']
                        });
                    }).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { action: 'toggle' }, (resp) => {
                                if (resp) updateStatus(resp.active);
                                window.close();
                            });
                        }, 150);
                    }).catch((err) => {
                        console.error('Cannot inject on this page:', err);
                        activateBtn.textContent = 'Cannot activate on this page';
                        setTimeout(() => {
                            activateBtn.textContent = '🎯 Activate on This Page';
                        }, 2000);
                    });
                } else {
                    updateStatus(response.active);
                    window.close();
                }
            });
        });
    });

    function updateStatus(isActive) {
        if (isActive) {
            statusBadge.className = 'status-badge active';
            statusBadge.innerHTML = '<span class="status-dot active"></span> Active';
            activateBtn.textContent = '⏹️ Deactivate';
            activateBtn.classList.add('deactivate');
        } else {
            statusBadge.className = 'status-badge inactive';
            statusBadge.innerHTML = '<span class="status-dot inactive"></span> Inactive';
            activateBtn.textContent = '🎯 Activate on This Page';
            activateBtn.classList.remove('deactivate');
        }
    }
});
