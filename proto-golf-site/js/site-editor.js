/**
 * Proto Golf Site Editor Widget
 * Click-to-select + voice input for Rachel to request changes
 */
(function() {
    'use strict';

    // Config
    const GEMINI_ENDPOINT = 'https://suitegpt.app/api/gemini';
    const EDITOR_ENABLED_KEY = 'proto_editor_enabled';

    // State
    let isEditorActive = false;
    let selectedElement = null;
    let isRecording = false;
    let recognition = null;

    // Check if editor should be shown (add ?edit=1 to URL or localStorage)
    function shouldShowEditor() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('edit') === '1') {
            localStorage.setItem(EDITOR_ENABLED_KEY, '1');
            return true;
        }
        return localStorage.getItem(EDITOR_ENABLED_KEY) === '1';
    }

    // Create the floating widget
    function createWidget() {
        const widget = document.createElement('div');
        widget.id = 'site-editor-widget';
        widget.innerHTML = `
            <style>
                #site-editor-widget {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 99999;
                    font-family: 'Outfit', -apple-system, sans-serif;
                }
                #editor-toggle {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: #1a1a1a;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    transition: transform 0.2s, background 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #editor-toggle:hover {
                    transform: scale(1.05);
                    background: #333;
                }
                #editor-toggle.active {
                    background: #22c55e;
                }
                #editor-panel {
                    display: none;
                    position: absolute;
                    bottom: 70px;
                    right: 0;
                    width: 320px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 8px 40px rgba(0,0,0,0.2);
                    overflow: hidden;
                }
                #editor-panel.open {
                    display: block;
                    animation: slideUp 0.2s ease;
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                #editor-header {
                    background: #1a1a1a;
                    color: white;
                    padding: 16px;
                    font-weight: 600;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #editor-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    opacity: 0.7;
                }
                #editor-close:hover { opacity: 1; }
                #editor-body {
                    padding: 16px;
                }
                #editor-status {
                    font-size: 13px;
                    color: #666;
                    margin-bottom: 12px;
                    min-height: 40px;
                }
                #editor-status.selecting {
                    color: #22c55e;
                    font-weight: 500;
                }
                #selected-preview {
                    background: #f5f5f5;
                    border-radius: 8px;
                    padding: 10px;
                    font-size: 12px;
                    color: #333;
                    margin-bottom: 12px;
                    max-height: 60px;
                    overflow: hidden;
                    display: none;
                }
                #selected-preview.visible {
                    display: block;
                }
                #editor-input-area {
                    display: none;
                }
                #editor-input-area.visible {
                    display: block;
                }
                #editor-textarea {
                    width: 100%;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 10px;
                    font-family: inherit;
                    font-size: 14px;
                    resize: none;
                    height: 70px;
                    box-sizing: border-box;
                }
                #editor-textarea:focus {
                    outline: none;
                    border-color: #1a1a1a;
                }
                #editor-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                }
                .editor-btn {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #editor-mic {
                    background: #f5f5f5;
                    color: #333;
                }
                #editor-mic:hover {
                    background: #eee;
                }
                #editor-mic.recording {
                    background: #ef4444;
                    color: white;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                #editor-send {
                    background: #1a1a1a;
                    color: white;
                }
                #editor-send:hover {
                    background: #333;
                }
                #editor-send:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                .element-highlight {
                    outline: 3px solid #22c55e !important;
                    outline-offset: 2px;
                    cursor: pointer !important;
                }
                .element-selected {
                    outline: 3px solid #3b82f6 !important;
                    outline-offset: 2px;
                }
                #editor-loading {
                    display: none;
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }
                #editor-loading.visible {
                    display: block;
                }
                .spinner {
                    width: 24px;
                    height: 24px;
                    border: 3px solid #eee;
                    border-top-color: #1a1a1a;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 10px;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #editor-result {
                    display: none;
                    padding: 12px;
                    background: #f0fdf4;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #166534;
                    margin-top: 12px;
                }
                #editor-result.visible {
                    display: block;
                }
                #editor-result.error {
                    background: #fef2f2;
                    color: #991b1b;
                }
            </style>

            <div id="editor-panel">
                <div id="editor-header">
                    <span>Site Editor</span>
                    <button id="editor-close">&times;</button>
                </div>
                <div id="editor-body">
                    <div id="editor-status">Click the edit button, then click on any element you want to change.</div>
                    <div id="selected-preview"></div>
                    <div id="editor-input-area">
                        <textarea id="editor-textarea" placeholder="Describe what you want to change..."></textarea>
                        <div id="editor-actions">
                            <button class="editor-btn" id="editor-mic" title="Voice input">🎤 Speak</button>
                            <button class="editor-btn" id="editor-send" disabled>Send Request</button>
                        </div>
                    </div>
                    <div id="editor-loading">
                        <div class="spinner"></div>
                        Processing your request...
                    </div>
                    <div id="editor-result"></div>
                </div>
            </div>

            <button id="editor-toggle" title="Edit this page">✏️</button>
        `;
        document.body.appendChild(widget);

        // Bind events
        document.getElementById('editor-toggle').addEventListener('click', toggleEditor);
        document.getElementById('editor-close').addEventListener('click', closePanel);
        document.getElementById('editor-mic').addEventListener('click', toggleVoice);
        document.getElementById('editor-send').addEventListener('click', sendRequest);
        document.getElementById('editor-textarea').addEventListener('input', updateSendButton);

        // Initialize speech recognition
        initSpeechRecognition();
    }

    function toggleEditor() {
        isEditorActive = !isEditorActive;
        const toggle = document.getElementById('editor-toggle');
        const panel = document.getElementById('editor-panel');
        const status = document.getElementById('editor-status');

        toggle.classList.toggle('active', isEditorActive);
        panel.classList.toggle('open', isEditorActive);

        if (isEditorActive) {
            status.textContent = 'Click on any element you want to change.';
            status.classList.add('selecting');
            document.body.addEventListener('mouseover', handleMouseOver);
            document.body.addEventListener('mouseout', handleMouseOut);
            document.body.addEventListener('click', handleElementClick, true);
        } else {
            disableSelectionMode();
        }
    }

    function closePanel() {
        isEditorActive = false;
        document.getElementById('editor-toggle').classList.remove('active');
        document.getElementById('editor-panel').classList.remove('open');
        disableSelectionMode();
        clearSelection();
    }

    function disableSelectionMode() {
        document.getElementById('editor-status').classList.remove('selecting');
        document.body.removeEventListener('mouseover', handleMouseOver);
        document.body.removeEventListener('mouseout', handleMouseOut);
        document.body.removeEventListener('click', handleElementClick, true);
        document.querySelectorAll('.element-highlight').forEach(el => el.classList.remove('element-highlight'));
    }

    function handleMouseOver(e) {
        if (!isEditorActive || e.target.closest('#site-editor-widget')) return;
        e.target.classList.add('element-highlight');
    }

    function handleMouseOut(e) {
        if (!isEditorActive) return;
        e.target.classList.remove('element-highlight');
    }

    function handleElementClick(e) {
        if (!isEditorActive || e.target.closest('#site-editor-widget')) return;

        e.preventDefault();
        e.stopPropagation();

        // Clear previous selection
        if (selectedElement) {
            selectedElement.classList.remove('element-selected');
        }

        selectedElement = e.target;
        selectedElement.classList.remove('element-highlight');
        selectedElement.classList.add('element-selected');

        // Update UI
        const preview = document.getElementById('selected-preview');
        const inputArea = document.getElementById('editor-input-area');
        const status = document.getElementById('editor-status');

        // Show element info
        const tagName = selectedElement.tagName.toLowerCase();
        const classes = selectedElement.className.replace('element-selected', '').trim();
        const textPreview = selectedElement.textContent.substring(0, 100).trim();

        preview.innerHTML = `<strong>&lt;${tagName}${classes ? ` class="${classes}"` : ''}&gt;</strong><br>${textPreview}${textPreview.length >= 100 ? '...' : ''}`;
        preview.classList.add('visible');
        inputArea.classList.add('visible');
        status.textContent = 'Element selected. Describe your change below or use voice.';
        status.classList.remove('selecting');

        // Disable selection mode but keep panel open
        document.body.removeEventListener('mouseover', handleMouseOver);
        document.body.removeEventListener('mouseout', handleMouseOut);
        document.body.removeEventListener('click', handleElementClick, true);
        document.querySelectorAll('.element-highlight').forEach(el => el.classList.remove('element-highlight'));
    }

    function clearSelection() {
        if (selectedElement) {
            selectedElement.classList.remove('element-selected');
            selectedElement = null;
        }
        document.getElementById('selected-preview').classList.remove('visible');
        document.getElementById('editor-input-area').classList.remove('visible');
        document.getElementById('editor-textarea').value = '';
        document.getElementById('editor-result').classList.remove('visible');
        document.getElementById('editor-status').textContent = 'Click the edit button, then click on any element you want to change.';
        updateSendButton();
    }

    function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            document.getElementById('editor-mic').style.display = 'none';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            document.getElementById('editor-textarea').value = transcript;
            updateSendButton();
        };

        recognition.onend = () => {
            isRecording = false;
            document.getElementById('editor-mic').classList.remove('recording');
            document.getElementById('editor-mic').textContent = '🎤 Speak';
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            document.getElementById('editor-mic').classList.remove('recording');
            document.getElementById('editor-mic').textContent = '🎤 Speak';
        };
    }

    function toggleVoice() {
        if (!recognition) {
            alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const micBtn = document.getElementById('editor-mic');

        if (isRecording) {
            recognition.stop();
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.textContent = '🎤 Speak';
        } else {
            recognition.start();
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.textContent = '⏹ Stop';
        }
    }

    function updateSendButton() {
        const textarea = document.getElementById('editor-textarea');
        const sendBtn = document.getElementById('editor-send');
        sendBtn.disabled = !textarea.value.trim() || !selectedElement;
    }

    async function sendRequest() {
        const textarea = document.getElementById('editor-textarea');
        const request = textarea.value.trim();

        if (!request || !selectedElement) return;

        // Get element context
        const elementHtml = selectedElement.outerHTML;
        const elementSelector = getSelector(selectedElement);
        const pagePath = window.location.pathname;

        // Show loading
        document.getElementById('editor-input-area').classList.remove('visible');
        document.getElementById('editor-loading').classList.add('visible');
        document.getElementById('editor-result').classList.remove('visible');

        // Build the request data
        const requestData = {
            type: 'site_edit_request',
            site: 'Proto Golf',
            page: pagePath,
            element: {
                selector: elementSelector,
                html: elementHtml.substring(0, 2000), // Limit size
                text: selectedElement.textContent.substring(0, 500)
            },
            request: request,
            timestamp: new Date().toISOString()
        };

        // For now, save to localStorage and show confirmation
        // In production, this would go to Supabase or email
        saveRequest(requestData);

        // Show result
        setTimeout(() => {
            document.getElementById('editor-loading').classList.remove('visible');
            const result = document.getElementById('editor-result');
            result.textContent = '✓ Request submitted! Stuart will review and implement your change.';
            result.classList.remove('error');
            result.classList.add('visible');

            // Clear after delay
            setTimeout(() => {
                clearSelection();
                closePanel();
            }, 3000);
        }, 1000);
    }

    function getSelector(el) {
        if (el.id) return `#${el.id}`;

        let path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                selector = `#${el.id}`;
                path.unshift(selector);
                break;
            }
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(c => !c.startsWith('element-'));
                if (classes.length) {
                    selector += '.' + classes.slice(0, 2).join('.');
                }
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.slice(-3).join(' > ');
    }

    function saveRequest(data) {
        // Save to localStorage for now
        const requests = JSON.parse(localStorage.getItem('proto_edit_requests') || '[]');
        requests.push(data);
        localStorage.setItem('proto_edit_requests', JSON.stringify(requests));

        // Also try to send to Supabase
        try {
            fetch('https://rdsmdywbdiskxknluiym.supabase.co/rest/v1/proto_golf_requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    page: data.page,
                    element_selector: data.element.selector,
                    element_html: data.element.html,
                    request_text: data.request,
                    status: 'pending'
                })
            });
        } catch (e) {
            console.log('Could not save to Supabase, stored locally');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        if (shouldShowEditor()) {
            createWidget();
        }
    }

    // Expose enable/disable functions globally
    window.protoEditor = {
        enable: function() {
            localStorage.setItem(EDITOR_ENABLED_KEY, '1');
            if (!document.getElementById('site-editor-widget')) {
                createWidget();
            }
        },
        disable: function() {
            localStorage.removeItem(EDITOR_ENABLED_KEY);
            const widget = document.getElementById('site-editor-widget');
            if (widget) widget.remove();
        }
    };
})();
