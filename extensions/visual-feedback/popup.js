/**
 * SUITE Visual Feedback - Popup Script
 * Handles destination selection, settings, and activation
 */

document.addEventListener('DOMContentLoaded', () => {
    const activateBtn = document.getElementById('activateBtn');
    const statusBadge = document.getElementById('status');
    const supabaseKeyInput = document.getElementById('supabaseKey');
    const userIdInput = document.getElementById('userId');
    const saveBtn = document.getElementById('saveBtn');
    const destinationOptions = document.querySelectorAll('.destination-option:not(.disabled)');

    // Load saved settings
    chrome.storage.sync.get(['supabaseKey', 'userId', 'destination'], (result) => {
        if (result.supabaseKey) supabaseKeyInput.value = result.supabaseKey;
        if (result.userId) userIdInput.value = result.userId;
        if (result.destination) {
            updateDestinationUI(result.destination);
        }
    });

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
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' }, (response) => {
                    if (response) {
                        updateStatus(response.active);
                    }
                });
            }
        });
    });

    // Destination selection
    destinationOptions.forEach(option => {
        option.addEventListener('click', () => {
            const dest = option.dataset.dest;
            updateDestinationUI(dest);
            chrome.storage.sync.set({ destination: dest });
        });
    });

    function updateDestinationUI(dest) {
        document.querySelectorAll('.destination-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.dest === dest) {
                opt.classList.add('selected');
                const input = opt.querySelector('input');
                if (input) input.checked = true;
            }
        });
    }

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
