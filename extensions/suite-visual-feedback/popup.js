// SUITE Visual Feedback - Popup Script

document.addEventListener('DOMContentLoaded', () => {
    const endpointInput = document.getElementById('agentEndpoint');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['agentEndpoint'], (result) => {
        if (result.agentEndpoint) {
            endpointInput.value = result.agentEndpoint;
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const endpoint = endpointInput.value.trim() || 'ws://localhost:9999';

        chrome.storage.sync.set({ agentEndpoint: endpoint }, () => {
            status.classList.add('success');
            setTimeout(() => {
                status.classList.remove('success');
            }, 2000);
        });
    });
});
