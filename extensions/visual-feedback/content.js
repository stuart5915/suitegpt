/**
 * SUITE Visual Feedback - Content Script
 * Adds overlay, click detection, and feedback popup to any webpage
 */

(function() {
    'use strict';

    // State
    let isActive = false;
    let currentElement = null;
    let isDragging = false;
    let dragStart = null;
    let dragBox = null;
    let overlay = null;
    let highlight = null;
    let popup = null;
    let statusIndicator = null;

    // Supabase Config (will be loaded from storage)
    let config = {
        supabaseUrl: 'https://rdsmdywbdiskxknluiym.supabase.co',
        supabaseKey: null,
        userId: null
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Load config from storage
        chrome.storage.sync.get(['supabaseKey', 'userId'], (result) => {
            if (result.supabaseKey) config.supabaseKey = result.supabaseKey;
            if (result.userId) config.userId = result.userId;
        });

        // Listen for activation from popup/keyboard
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'toggle') {
                toggleOverlay();
                sendResponse({ active: isActive });
            } else if (msg.action === 'getStatus') {
                sendResponse({ active: isActive });
            }
        });

        // Keyboard shortcut: Ctrl+Shift+F to toggle
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                toggleOverlay();
            }
            // Escape to close
            if (e.key === 'Escape' && isActive) {
                deactivate();
            }
        });

        console.log('🎯 SUITE Visual Feedback loaded. Press Ctrl+Shift+F to activate.');
    }

    function toggleOverlay() {
        if (isActive) {
            deactivate();
        } else {
            activate();
        }
    }

    function activate() {
        isActive = true;
        
        // Create overlay
        overlay = document.createElement('div');
        overlay.className = 'suite-vf-overlay active';
        document.body.appendChild(overlay);

        // Create highlight box
        highlight = document.createElement('div');
        highlight.className = 'suite-vf-highlight';
        highlight.style.display = 'none';
        document.body.appendChild(highlight);

        // Create status indicator
        statusIndicator = document.createElement('div');
        statusIndicator.className = 'suite-vf-status';
        statusIndicator.innerHTML = '<span class="suite-vf-status-dot"></span> Click an element or drag to select';
        document.body.appendChild(statusIndicator);

        // Prevent text selection
        document.body.classList.add('suite-vf-no-select');

        // Add event listeners
        overlay.addEventListener('mousemove', handleMouseMove);
        overlay.addEventListener('click', handleClick);
        overlay.addEventListener('mousedown', handleMouseDown);
        overlay.addEventListener('mouseup', handleMouseUp);
    }

    function deactivate() {
        isActive = false;

        // Remove elements
        if (overlay) { overlay.remove(); overlay = null; }
        if (highlight) { highlight.remove(); highlight = null; }
        if (statusIndicator) { statusIndicator.remove(); statusIndicator = null; }
        if (dragBox) { dragBox.remove(); dragBox = null; }
        if (popup) { popup.remove(); popup = null; }

        // Remove class
        document.body.classList.remove('suite-vf-no-select');
        
        // Reset state
        currentElement = null;
        isDragging = false;
        dragStart = null;
    }

    function handleMouseMove(e) {
        if (isDragging) {
            updateDragBox(e);
            return;
        }

        // Get element under cursor (temporarily disable overlay pointer events)
        overlay.style.pointerEvents = 'none';
        const element = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = 'auto';

        if (element && element !== currentElement && !element.classList.contains('suite-vf-highlight')) {
            currentElement = element;
            highlightElement(element);
        }
    }

    function highlightElement(element) {
        const rect = element.getBoundingClientRect();
        highlight.style.display = 'block';
        highlight.style.left = rect.left + 'px';
        highlight.style.top = rect.top + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';
    }

    function handleMouseDown(e) {
        dragStart = { x: e.clientX, y: e.clientY };
    }

    function handleMouseUp(e) {
        if (dragStart) {
            const dx = Math.abs(e.clientX - dragStart.x);
            const dy = Math.abs(e.clientY - dragStart.y);
            
            // If we dragged more than 20px, treat as drag selection
            if (dx > 20 || dy > 20) {
                finishDragSelection(e);
            } else {
                // Regular click
                isDragging = false;
                if (dragBox) { dragBox.remove(); dragBox = null; }
            }
        }
        dragStart = null;
    }

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        // Get the element that was clicked
        overlay.style.pointerEvents = 'none';
        const element = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = 'auto';

        if (element) {
            highlight.classList.add('suite-vf-selected');
            showPopup(e.clientX, e.clientY, element);
        }
    }

    function updateDragBox(e) {
        if (!dragStart) return;
        
        isDragging = true;
        
        if (!dragBox) {
            dragBox = document.createElement('div');
            dragBox.className = 'suite-vf-drag-box';
            document.body.appendChild(dragBox);
        }

        const left = Math.min(dragStart.x, e.clientX);
        const top = Math.min(dragStart.y, e.clientY);
        const width = Math.abs(e.clientX - dragStart.x);
        const height = Math.abs(e.clientY - dragStart.y);

        dragBox.style.left = left + 'px';
        dragBox.style.top = top + 'px';
        dragBox.style.width = width + 'px';
        dragBox.style.height = height + 'px';
    }

    function finishDragSelection(e) {
        isDragging = false;
        
        // Calculate selection bounds
        const left = Math.min(dragStart.x, e.clientX);
        const top = Math.min(dragStart.y, e.clientY);
        
        showPopup(left, top, null, {
            left: left,
            top: top,
            width: Math.abs(e.clientX - dragStart.x),
            height: Math.abs(e.clientY - dragStart.y)
        });
    }

    function showPopup(x, y, element, dragBounds = null) {
        // Remove existing popup
        if (popup) { popup.remove(); }

        // Generate CSS selector
        const selector = element ? getSelector(element) : 'Drag selection';

        // Create popup
        popup = document.createElement('div');
        popup.className = 'suite-vf-popup';
        popup.innerHTML = `
            <div class="suite-vf-popup-header">
                <span class="suite-vf-popup-title">🎯 What do you want?</span>
                <button class="suite-vf-popup-close">✕</button>
            </div>
            <div class="suite-vf-selector-display">${escapeHtml(selector)}</div>
            <textarea class="suite-vf-textarea" placeholder="Describe the change you want... (e.g., 'Make this button gradient purple')"></textarea>
            <div class="suite-vf-actions">
                <button class="suite-vf-btn suite-vf-btn-secondary">Cancel</button>
                <button class="suite-vf-btn suite-vf-btn-primary">Send to AI ⏎</button>
            </div>
        `;

        // Position popup
        const popupWidth = 360;
        const popupX = Math.min(x + 20, window.innerWidth - popupWidth - 20);
        const popupY = Math.min(y + 20, window.innerHeight - 300);
        popup.style.left = popupX + 'px';
        popup.style.top = popupY + 'px';

        document.body.appendChild(popup);

        // Focus textarea
        const textarea = popup.querySelector('.suite-vf-textarea');
        setTimeout(() => textarea.focus(), 100);

        // Event listeners
        popup.querySelector('.suite-vf-popup-close').addEventListener('click', () => {
            popup.remove();
            popup = null;
            highlight.classList.remove('suite-vf-selected');
        });

        popup.querySelector('.suite-vf-btn-secondary').addEventListener('click', () => {
            popup.remove();
            popup = null;
            highlight.classList.remove('suite-vf-selected');
        });

        popup.querySelector('.suite-vf-btn-primary').addEventListener('click', () => {
            const message = textarea.value.trim();
            if (message) {
                sendFeedback(message, selector, element, dragBounds);
            }
        });

        // Enter to send
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = textarea.value.trim();
                if (message) {
                    sendFeedback(message, selector, element, dragBounds);
                }
            }
        });
    }

    function getSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        let path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            
            if (element.id) {
                selector = `#${element.id}`;
                path.unshift(selector);
                break;
            }
            
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/).slice(0, 2);
                if (classes.length && classes[0]) {
                    selector += '.' + classes.join('.');
                }
            }
            
            path.unshift(selector);
            element = element.parentNode;
            
            if (path.length > 4) break;
        }
        
        return path.join(' > ');
    }

    async function sendFeedback(message, selector, element, dragBounds) {
        const sendBtn = popup.querySelector('.suite-vf-btn-primary');
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;

        try {
            // Capture screenshot
            let screenshotData = null;
            try {
                screenshotData = await captureScreenshot(dragBounds);
            } catch (e) {
                console.warn('Screenshot failed:', e);
            }

            // Get element info
            const elementInfo = element ? {
                tagName: element.tagName,
                className: element.className,
                id: element.id,
                innerText: element.innerText?.slice(0, 200),
                outerHTML: element.outerHTML?.slice(0, 500)
            } : null;

            // Build prompt
            const fullPrompt = buildPrompt(message, selector, elementInfo, dragBounds);

            // Send to Supabase
            const response = await fetch(`${config.supabaseUrl}/rest/v1/prompts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.supabaseKey,
                    'Authorization': `Bearer ${config.supabaseKey}`
                },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    status: 'pending',
                    user_id: config.userId || null,
                    source: 'visual-feedback',
                    metadata: JSON.stringify({
                        url: window.location.href,
                        selector: selector,
                        timestamp: new Date().toISOString(),
                        screenshot: screenshotData
                    })
                })
            });

            if (response.ok) {
                showSuccess();
            } else {
                throw new Error('Failed to send');
            }
        } catch (error) {
            console.error('Send failed:', error);
            sendBtn.textContent = 'Failed - Retry';
            sendBtn.disabled = false;
        }
    }

    function buildPrompt(message, selector, elementInfo, dragBounds) {
        let prompt = `[VISUAL FEEDBACK from ${window.location.href}]\n\n`;
        prompt += `User Request: ${message}\n\n`;
        
        if (selector) {
            prompt += `Target Element: ${selector}\n`;
        }
        
        if (elementInfo) {
            prompt += `Element Info:\n`;
            prompt += `- Tag: ${elementInfo.tagName}\n`;
            if (elementInfo.id) prompt += `- ID: ${elementInfo.id}\n`;
            if (elementInfo.className) prompt += `- Classes: ${elementInfo.className}\n`;
            if (elementInfo.innerText) prompt += `- Text: "${elementInfo.innerText}"\n`;
        }
        
        if (dragBounds) {
            prompt += `Drag Selection: ${dragBounds.width}x${dragBounds.height} at (${dragBounds.left}, ${dragBounds.top})\n`;
        }
        
        return prompt;
    }

    async function captureScreenshot(bounds) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'captureScreenshot', bounds }, (response) => {
                if (response && response.dataUrl) {
                    resolve(response.dataUrl);
                } else {
                    reject(new Error('Screenshot failed'));
                }
            });
        });
    }

    function showSuccess() {
        if (popup) {
            popup.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
                    <div style="font-weight: 700; font-size: 1.1rem; color: #10b981;">Sent to AI!</div>
                    <div style="color: #666; margin-top: 8px;">Your request is queued for processing</div>
                </div>
            `;
            
            // Flash effect
            const flash = document.createElement('div');
            flash.className = 'suite-vf-flash';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 300);

            // Auto-close
            setTimeout(() => {
                deactivate();
            }, 1500);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
