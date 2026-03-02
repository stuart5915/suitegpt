// Inclawbate Build Studio — Client-side logic
// Chat-based AI builder: describe → generate → preview → publish

(function () {
    'use strict';

    var API_BASE = '/api/studio/chat';
    var PUBLISH_API = '/api/publish-site';

    // ── State ──
    var state = {
        sessionId: null,
        currentCode: null,
        credits: null,
        sending: false,
        title: 'New Project'
    };

    // ── DOM refs ──
    var els = {};
    function $(id) { return document.getElementById(id); }

    function cacheDom() {
        els.authGate = $('authGate');
        els.projectsView = $('projectsView');
        els.projectsList = $('projectsList');
        els.buildView = $('buildView');
        els.buildTitle = $('buildTitle');
        els.buildCredits = $('buildCredits');
        els.creditsCount = $('creditsCount');
        els.publishBtn = $('publishBtn');
        els.chatMessages = $('chatMessages');
        els.buildWelcome = $('buildWelcome');
        els.chatInput = $('chatInput');
        els.chatSend = $('chatSend');
        els.previewFrame = $('previewFrame');
        els.previewCode = $('previewCode');
        els.codeContent = $('codeContent');
        els.previewEmpty = $('previewEmpty');
        els.publishOverlay = $('publishOverlay');
        els.publishSlug = $('publishSlug');
        els.slugPreview = $('slugPreview');
        els.publishConfirm = $('publishConfirm');
        els.publishResult = $('publishResult');
        els.buyOverlay = $('buyOverlay');
        els.buyTxHash = $('buyTxHash');
        els.buyVerifyBtn = $('buyVerifyBtn');
        els.buyResult = $('buyResult');
        els.buyCurrentBalance = $('buyCurrentBalance');
        els.buyRate = $('buyRate');
    }

    // ── Auth ──
    function getToken() {
        return localStorage.getItem('inclawbate_token');
    }

    function getProfile() {
        try {
            return JSON.parse(localStorage.getItem('inclawbate_profile'));
        } catch (e) { return null; }
    }

    function isLoggedIn() {
        return !!getToken() && !!getProfile();
    }

    // ── Views ──
    function showView(view) {
        els.authGate.style.display = 'none';
        els.projectsView.style.display = 'none';
        els.buildView.style.display = 'none';

        if (view === 'auth') els.authGate.style.display = 'flex';
        else if (view === 'projects') els.projectsView.style.display = 'block';
        else if (view === 'build') els.buildView.style.display = 'flex';
    }

    // ── Projects List ──
    async function loadProjects() {
        showView('projects');
        els.projectsList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

        try {
            var resp = await fetch(API_BASE, {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            var data = await resp.json();

            if (!data.sessions || data.sessions.length === 0) {
                els.projectsList.innerHTML =
                    '<div class="projects-empty">' +
                    '<p>No projects yet. Start building something!</p>' +
                    '</div>';
                return;
            }

            els.projectsList.innerHTML = '';
            data.sessions.forEach(function (s) {
                var card = document.createElement('div');
                card.className = 'project-card';
                var date = new Date(s.updated_at || s.created_at).toLocaleDateString();
                var pub = s.published_at ? '<span class="published"> &middot; Published</span>' : '';
                card.innerHTML =
                    '<div class="project-card-title">' + escapeHtml(s.title) + '</div>' +
                    '<div class="project-card-meta">' + date + pub + '</div>';
                card.addEventListener('click', function () { openSession(s.id); });
                els.projectsList.appendChild(card);
            });
        } catch (e) {
            els.projectsList.innerHTML = '<div class="projects-empty"><p>Failed to load projects.</p></div>';
        }
    }

    // ── Open Existing Session ──
    async function openSession(sessionId) {
        state.sessionId = sessionId;
        state.currentCode = null;
        // Clear messages but keep welcome hidden
        var msgs = els.chatMessages.querySelectorAll('.chat-msg');
        msgs.forEach(function (m) { m.remove(); });
        if (els.buildWelcome) els.buildWelcome.style.display = 'none';
        resetPreview();
        showView('build');
        els.buildTitle.textContent = 'Loading...';

        try {
            var resp = await fetch(API_BASE + '?session_id=' + sessionId, {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            var data = await resp.json();

            state.title = data.session.title || 'Untitled';
            els.buildTitle.textContent = state.title;

            // Restore current code from session
            if (data.session.current_code) {
                state.currentCode = data.session.current_code;
                updatePreview(state.currentCode);
            }

            // Replay messages
            (data.messages || []).forEach(function (m) {
                appendMessage(m.role, m.content, m.code);
            });

            scrollChat();
        } catch (e) {
            els.buildTitle.textContent = 'Error loading session';
        }
    }

    // ── New Project ──
    function newProject() {
        state.sessionId = null;
        state.currentCode = null;
        state.title = 'New Project';
        // Remove chat messages but re-show welcome
        var msgs = els.chatMessages.querySelectorAll('.chat-msg');
        msgs.forEach(function (m) { m.remove(); });
        if (els.buildWelcome) els.buildWelcome.style.display = '';
        els.buildTitle.textContent = 'New Project';
        resetPreview();
        showView('build');
        els.chatInput.focus();
    }

    // ── Send Message ──
    async function sendMessage() {
        if (state.sending) return;
        var message = els.chatInput.value.trim();
        if (!message) return;

        state.sending = true;
        els.chatInput.value = '';
        els.chatInput.style.height = 'auto';
        els.chatSend.disabled = true;

        // Show user message
        appendMessage('user', message);

        // Show thinking indicator
        var thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-msg thinking';
        thinkingEl.textContent = 'Building...';
        els.chatMessages.appendChild(thinkingEl);
        scrollChat();

        try {
            var resp = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({
                    session_id: state.sessionId,
                    message: message
                })
            });

            var data = await resp.json();

            // Remove thinking indicator
            if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);

            if (!resp.ok) {
                appendMessage('assistant', data.error || 'Something went wrong.');
                if (resp.status === 402) openBuyCredits();
                state.sending = false;
                els.chatSend.disabled = false;
                return;
            }

            // Update state
            if (data.session_id) state.sessionId = data.session_id;
            if (data.title && state.title === 'New Project') {
                state.title = data.title;
                els.buildTitle.textContent = state.title;
            }
            if (data.credits_remaining !== undefined) {
                state.credits = data.credits_remaining;
                updateCredits();
            }

            // Show assistant message
            appendMessage('assistant', data.message, data.code);

            // Update preview
            if (data.code) {
                state.currentCode = data.code;
                updatePreview(data.code);
            }

        } catch (e) {
            if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
            appendMessage('assistant', 'Network error. Please try again.');
        }

        state.sending = false;
        els.chatSend.disabled = false;
        scrollChat();
    }

    // ── Chat Helpers ──
    function appendMessage(role, content, code) {
        // Hide welcome on first message
        if (els.buildWelcome) els.buildWelcome.style.display = 'none';

        var div = document.createElement('div');
        div.className = 'chat-msg ' + role;

        if (role === 'user') {
            div.textContent = content;
        } else {
            // Strip the HTML code block from display, show explanation only
            var displayText = content.replace(/```html[\s\S]*?```/g, '').trim();
            if (!displayText && code) displayText = 'Here\'s your updated site:';
            div.textContent = displayText;
            if (code) {
                var note = document.createElement('span');
                note.className = 'msg-code-note';
                note.textContent = '[ code updated in preview ]';
                div.appendChild(note);
            }
        }

        els.chatMessages.appendChild(div);
        scrollChat();
    }

    function scrollChat() {
        requestAnimationFrame(function () {
            els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
        });
    }

    // ── Preview ──
    function updatePreview(code) {
        els.previewEmpty.style.display = 'none';
        els.previewFrame.style.display = '';
        els.previewFrame.srcdoc = code;
        els.codeContent.textContent = code;
        els.publishBtn.disabled = false;
    }

    function resetPreview() {
        els.previewEmpty.style.display = 'flex';
        els.previewFrame.style.display = 'none';
        els.previewFrame.srcdoc = '';
        els.previewCode.style.display = 'none';
        els.codeContent.textContent = '';
        els.publishBtn.disabled = true;
        // Reset tabs
        var tabs = document.querySelectorAll('.preview-tab');
        tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === 'preview'); });
    }

    function switchTab(tab) {
        var tabs = document.querySelectorAll('.preview-tab');
        tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });

        if (tab === 'preview') {
            els.previewFrame.style.display = state.currentCode ? '' : 'none';
            els.previewCode.style.display = 'none';
            els.previewEmpty.style.display = state.currentCode ? 'none' : 'flex';
        } else {
            els.previewFrame.style.display = 'none';
            els.previewCode.style.display = state.currentCode ? 'block' : 'none';
            els.previewEmpty.style.display = state.currentCode ? 'none' : 'flex';
        }
    }

    // ── Credits display ──
    function updateCredits() {
        if (state.credits === null) return;
        els.creditsCount.textContent = state.credits;
        els.creditsCount.className = 'build-credits-count' +
            (state.credits <= 0 ? ' empty' : state.credits <= 5 ? ' low' : '');
    }

    async function fetchCredits() {
        try {
            var resp = await fetch('/api/inclawbate/credits', {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            if (!resp.ok) return;
            var data = await resp.json();
            if (data.credits !== undefined) {
                state.credits = data.credits;
                updateCredits();
            }
        } catch (e) { /* non-critical */ }
    }

    // ── Publish ──
    function openPublish() {
        if (!state.currentCode) return;
        els.publishOverlay.classList.add('active');
        els.publishSlug.value = '';
        els.publishResult.innerHTML = '';
        els.publishConfirm.disabled = true;
        els.slugPreview.textContent = 'suitegpt.app/s/...';
        els.publishSlug.focus();
    }

    function closePublish() {
        els.publishOverlay.classList.remove('active');
    }

    function onSlugInput() {
        var raw = els.publishSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
        els.publishSlug.value = raw;
        els.slugPreview.textContent = raw ? 'suitegpt.app/s/' + raw : 'suitegpt.app/s/...';
        els.publishConfirm.disabled = !raw || raw.length < 2;
    }

    async function publish() {
        var slug = els.publishSlug.value.trim();
        if (!slug || !state.currentCode) return;

        els.publishConfirm.disabled = true;
        els.publishResult.innerHTML = 'Publishing...';
        els.publishResult.className = 'publish-result';

        var profile = getProfile();
        var email = (profile && profile.x_handle ? profile.x_handle + '@inclawbate.com' : 'build@inclawbate.com');

        try {
            var resp = await fetch(PUBLISH_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: state.title,
                    slug: slug,
                    code: state.currentCode,
                    email: email,
                    description: 'Built with Inclawbate Build Studio',
                    source: 'build-studio'
                })
            });

            var data = await resp.json();

            if (data.success) {
                els.publishResult.innerHTML = 'Live at <a href="' + data.url + '" target="_blank">' + data.url + '</a>';
                els.publishResult.className = 'publish-result';

                // Update session with slug
                if (state.sessionId) {
                    await fetch(API_BASE, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + getToken()
                        },
                        body: JSON.stringify({
                            session_id: state.sessionId,
                            message: '[Published to ' + data.url + ']'
                        })
                    }).catch(function () {});
                }
            } else {
                els.publishResult.textContent = data.error || 'Failed to publish.';
                els.publishResult.className = 'publish-result error';
                els.publishConfirm.disabled = false;
            }
        } catch (e) {
            els.publishResult.textContent = 'Network error. Try again.';
            els.publishResult.className = 'publish-result error';
            els.publishConfirm.disabled = false;
        }
    }

    // ── Buy Credits ──
    var PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
    var CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';

    async function openBuyCredits() {
        els.buyOverlay.classList.add('active');
        els.buyTxHash.value = '';
        els.buyVerifyBtn.disabled = true;
        els.buyResult.innerHTML = '';
        els.buyCurrentBalance.textContent = state.credits !== null ? state.credits + ' credits' : '--';

        // Fetch CLAWS price for rate display
        els.buyRate.textContent = 'Loading...';
        try {
            var resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
            var data = await resp.json();
            if (data.pairs && data.pairs.length > 0) {
                var price = parseFloat(data.pairs[0].priceUsd) || 0;
                if (price > 0) {
                    var tokensPerCredit = Math.ceil(0.005 / price);
                    els.buyRate.textContent = '~' + tokensPerCredit.toLocaleString() + ' CLAWS / credit';
                } else {
                    els.buyRate.textContent = 'Price unavailable';
                }
            }
        } catch (e) {
            els.buyRate.textContent = 'Price unavailable';
        }
    }

    function closeBuyCredits() {
        els.buyOverlay.classList.remove('active');
    }

    function copyWallet() {
        navigator.clipboard.writeText(PROTOCOL_WALLET).then(function () {
            var btn = els.buyOverlay.querySelector('.copy-btn');
            if (btn) { btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy'; }, 2000); }
        });
    }

    function onTxInput() {
        var val = els.buyTxHash.value.trim();
        els.buyVerifyBtn.disabled = !/^0x[a-fA-F0-9]{64}$/.test(val);
    }

    async function verifyDeposit() {
        var txHash = els.buyTxHash.value.trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return;

        els.buyVerifyBtn.disabled = true;
        els.buyResult.innerHTML = 'Verifying on-chain...';
        els.buyResult.className = 'buy-result';

        try {
            var resp = await fetch('/api/inclawbate/credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({ action: 'deposit', tx_hash: txHash })
            });
            var data = await resp.json();

            if (resp.ok) {
                els.buyResult.textContent = '+' + data.credits_added + ' credits added! New balance: ' + data.credits_total;
                els.buyResult.className = 'buy-result success';
                state.credits = data.credits_total;
                updateCredits();
                els.buyCurrentBalance.textContent = data.credits_total + ' credits';
            } else {
                els.buyResult.textContent = data.error || 'Verification failed.';
                els.buyResult.className = 'buy-result error';
                els.buyVerifyBtn.disabled = false;
            }
        } catch (e) {
            els.buyResult.textContent = 'Network error. Try again.';
            els.buyResult.className = 'buy-result error';
            els.buyVerifyBtn.disabled = false;
        }
    }

    function usePrompt(text) {
        els.chatInput.value = text;
        sendMessage();
    }

    // ── Wallet Connect ──
    async function connectWallet() {
        if (!window.ethereum) {
            alert('No wallet detected. Install MetaMask or another browser wallet to continue.');
            return;
        }

        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var address = accounts[0];
            var timestamp = Math.floor(Date.now() / 1000);
            var message = 'Sign in to Inclawbate Build Studio\nWallet: ' + address + '\nTimestamp: ' + timestamp;

            var signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, address]
            });

            var resp = await fetch('/api/inclawbate/wallet-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: address, signature: signature, message: message })
            });

            var data = await resp.json();

            if (!resp.ok || !data.success) {
                alert(data.error || 'Wallet login failed. Please try again.');
                return;
            }

            localStorage.setItem('inclawbate_token', data.token);
            localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));

            fetchCredits();
            loadProjects();
        } catch (e) {
            if (e.code === 4001) return; // user rejected
            alert('Wallet connection failed. Please try again.');
        }
    }

    // ── Go Back ──
    function goBack() {
        loadProjects();
    }

    // ── Auto-resize textarea ──
    function setupInput() {
        els.chatInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 160) + 'px';
        });

        els.chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // ── Escape HTML ──
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Init ──
    function init() {
        cacheDom();
        setupInput();

        if (!isLoggedIn()) {
            showView('auth');
            return;
        }

        // Fetch credits on load
        fetchCredits();

        loadProjects();
    }

    // ── Expose Public API ──
    window.BuildApp = {
        newProject: newProject,
        send: sendMessage,
        goBack: goBack,
        switchTab: switchTab,
        openPublish: openPublish,
        closePublish: closePublish,
        onSlugInput: onSlugInput,
        publish: publish,
        openBuyCredits: openBuyCredits,
        closeBuyCredits: closeBuyCredits,
        copyWallet: copyWallet,
        onTxInput: onTxInput,
        verifyDeposit: verifyDeposit,
        usePrompt: usePrompt,
        connectWallet: connectWallet
    };

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
