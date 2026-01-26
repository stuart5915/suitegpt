// SUITE Visual Feedback - Content Script
// Press Alt+X to activate element selection mode

(function() {
    'use strict';

    let isSelectionMode = false;
    let hoveredElement = null;
    let selectedElement = null;
    let feedbackOverlay = null;
    let highlightOverlay = null;

    // Create highlight overlay for hovering
    function createHighlightOverlay() {
        if (highlightOverlay) return;

        highlightOverlay = document.createElement('div');
        highlightOverlay.id = 'suite-vf-highlight';
        highlightOverlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #6366f1;
            background: rgba(99, 102, 241, 0.1);
            z-index: 999998;
            transition: all 0.1s ease;
            display: none;
        `;
        document.body.appendChild(highlightOverlay);
    }

    // Create feedback modal
    function createFeedbackOverlay() {
        if (feedbackOverlay) return;

        feedbackOverlay = document.createElement('div');
        feedbackOverlay.id = 'suite-vf-overlay';
        feedbackOverlay.innerHTML = `
            <div class="suite-vf-modal">
                <div class="suite-vf-header">
                    <div class="suite-vf-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 15l-2 5L9 9l11 4-5 2z"/>
                            <path d="M14 14L9 9"/>
                        </svg>
                        SUITE Visual Feedback
                    </div>
                    <button class="suite-vf-close" id="suite-vf-close">&times;</button>
                </div>
                <div class="suite-vf-element-info" id="suite-vf-element-info">
                    <span class="suite-vf-tag"></span>
                    <span class="suite-vf-classes"></span>
                </div>
                <textarea
                    class="suite-vf-input"
                    id="suite-vf-input"
                    placeholder="Describe what you want to change about this element..."
                    rows="4"
                ></textarea>
                <div class="suite-vf-actions">
                    <button class="suite-vf-btn suite-vf-btn-secondary" id="suite-vf-copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copy to Clipboard
                    </button>
                    <button class="suite-vf-btn suite-vf-btn-primary" id="suite-vf-send">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        Send to Agent
                    </button>
                </div>
                <div class="suite-vf-status" id="suite-vf-status"></div>
            </div>
        `;
        document.body.appendChild(feedbackOverlay);

        // Event listeners
        document.getElementById('suite-vf-close').addEventListener('click', closeFeedback);
        document.getElementById('suite-vf-copy').addEventListener('click', copyToClipboard);
        document.getElementById('suite-vf-send').addEventListener('click', sendToAgent);

        feedbackOverlay.addEventListener('click', (e) => {
            if (e.target === feedbackOverlay) closeFeedback();
        });
    }

    // Get element info string
    function getElementInfo(el) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const classes = el.className && typeof el.className === 'string'
            ? '.' + el.className.split(' ').filter(c => c).join('.')
            : '';
        const text = el.innerText ? el.innerText.substring(0, 100).replace(/\n/g, ' ').trim() : '';

        return {
            selector: `${tag}${id}${classes}`,
            tag,
            id: el.id || '',
            classes: el.className || '',
            text: text ? `"${text}${text.length >= 100 ? '...' : ''}"` : ''
        };
    }

    // Generate feedback message
    function generateFeedbackMessage() {
        if (!selectedElement) return '';

        const info = getElementInfo(selectedElement);
        const input = document.getElementById('suite-vf-input');
        const userRequest = input ? input.value.trim() : '';
        const url = window.location.href;

        let message = `[VISUAL FEEDBACK from ${url}]\n\n`;
        message += `User Request: ${userRequest}\n\n`;
        message += `Target Element: ${info.selector}\n`;
        message += `Element Info:\n`;
        message += `- Tag: ${info.tag.toUpperCase()}\n`;
        if (info.id) message += `- ID: ${info.id}\n`;
        if (info.classes) message += `- Classes: ${info.classes}\n`;
        if (info.text) message += `- Text: ${info.text}\n`;

        return message;
    }

    // Copy to clipboard
    async function copyToClipboard() {
        const message = generateFeedbackMessage();

        try {
            await navigator.clipboard.writeText(message);
            showStatus('Copied to clipboard!', 'success');
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = message;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showStatus('Copied to clipboard!', 'success');
        }
    }

    // Send to agent (via WebSocket or configured endpoint)
    async function sendToAgent() {
        const message = generateFeedbackMessage();

        // Try to get agent connection settings from storage
        chrome.storage.sync.get(['agentEndpoint', 'agentPort'], async (settings) => {
            const endpoint = settings.agentEndpoint || 'ws://localhost:9999';

            try {
                // Try WebSocket connection
                const ws = new WebSocket(endpoint);

                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        type: 'visual-feedback',
                        message: message,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    }));
                    showStatus('Sent to agent!', 'success');
                    ws.close();
                };

                ws.onerror = () => {
                    // Fallback: copy to clipboard
                    copyToClipboard();
                    showStatus('Agent not connected. Copied to clipboard instead.', 'warning');
                };
            } catch (err) {
                copyToClipboard();
                showStatus('Agent not connected. Copied to clipboard instead.', 'warning');
            }
        });
    }

    // Show status message
    function showStatus(message, type) {
        const status = document.getElementById('suite-vf-status');
        if (status) {
            status.textContent = message;
            status.className = `suite-vf-status suite-vf-status-${type}`;
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }

    // Enter selection mode
    function enterSelectionMode() {
        isSelectionMode = true;
        createHighlightOverlay();
        document.body.style.cursor = 'crosshair';
        highlightOverlay.style.display = 'block';

        // Show toast
        showToast('Click on any element to select it');
    }

    // Exit selection mode
    function exitSelectionMode() {
        isSelectionMode = false;
        document.body.style.cursor = '';
        if (highlightOverlay) {
            highlightOverlay.style.display = 'none';
        }
        hoveredElement = null;
    }

    // Show feedback modal
    function showFeedback(element) {
        selectedElement = element;
        createFeedbackOverlay();

        const info = getElementInfo(element);
        const infoEl = document.getElementById('suite-vf-element-info');
        if (infoEl) {
            infoEl.innerHTML = `
                <span class="suite-vf-tag">${info.tag}</span>
                ${info.id ? `<span class="suite-vf-id">#${info.id}</span>` : ''}
                ${info.classes ? `<span class="suite-vf-classes">.${info.classes.split(' ').filter(c=>c).join('.')}</span>` : ''}
            `;
        }

        feedbackOverlay.classList.add('active');

        setTimeout(() => {
            const input = document.getElementById('suite-vf-input');
            if (input) input.focus();
        }, 100);
    }

    // Close feedback modal
    function closeFeedback() {
        if (feedbackOverlay) {
            feedbackOverlay.classList.remove('active');
        }
        selectedElement = null;
    }

    // Show toast notification
    function showToast(message) {
        let toast = document.getElementById('suite-vf-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'suite-vf-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 2000);
    }

    // Update highlight position
    function updateHighlight(element) {
        if (!highlightOverlay || !element) return;

        const rect = element.getBoundingClientRect();
        highlightOverlay.style.top = rect.top + 'px';
        highlightOverlay.style.left = rect.left + 'px';
        highlightOverlay.style.width = rect.width + 'px';
        highlightOverlay.style.height = rect.height + 'px';
    }

    // Mouse move handler
    function onMouseMove(e) {
        if (!isSelectionMode) return;

        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (element && element !== highlightOverlay && element !== feedbackOverlay && !feedbackOverlay?.contains(element)) {
            hoveredElement = element;
            updateHighlight(element);
        }
    }

    // Click handler
    function onClick(e) {
        if (!isSelectionMode) return;

        e.preventDefault();
        e.stopPropagation();

        if (hoveredElement) {
            exitSelectionMode();
            showFeedback(hoveredElement);
        }
    }

    // Keyboard handler
    function onKeyDown(e) {
        // Alt + X to toggle selection mode
        if (e.altKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            if (isSelectionMode) {
                exitSelectionMode();
            } else {
                enterSelectionMode();
            }
        }

        // Escape to exit
        if (e.key === 'Escape') {
            if (isSelectionMode) {
                exitSelectionMode();
            }
            if (feedbackOverlay?.classList.contains('active')) {
                closeFeedback();
            }
        }
    }

    // Initialize
    function init() {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('click', onClick, true);

        console.log('[SUITE Visual Feedback] Ready. Press Alt+X to select an element.');
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
