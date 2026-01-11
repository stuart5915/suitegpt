/**
 * SUITE Visual Feedback - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
    const activateBtn = document.getElementById('activateBtn');
    const statusBadge = document.getElementById('status');
    const supabaseKeyInput = document.getElementById('supabaseKey');
    const userIdInput = document.getElementById('userId');
    const saveBtn = document.getElementById('saveBtn');

    // Load saved settings
    chrome.storage.sync.get(['supabaseKey', 'userId'], (result) => {
        if (result.supabaseKey) supabaseKeyInput.value = result.supabaseKey;
        if (result.userId) userIdInput.value = result.userId;
    });

    // Check current status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script not loaded yet
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
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' }, (response) => {
                    if (response) {
                        updateStatus(response.active);
                    }
                });
            }
        });
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const supabaseKey = supabaseKeyInput.value.trim();
        const userId = userIdInput.value.trim();

        chrome.storage.sync.set({ supabaseKey, userId }, () => {
            saveBtn.textContent = '✓ Saved!';
            saveBtn.classList.add('save-success');

            setTimeout(() => {
                saveBtn.textContent = 'Save Settings';
                saveBtn.classList.remove('save-success');
            }, 2000);
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
