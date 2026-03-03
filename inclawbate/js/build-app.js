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
        title: 'New Project',
        forkedFrom: null,  // { app_id, name } if forked
        selectedModel: 'fast'
    };

    // ── Starter Prompts Pool ──
    var STARTER_PROMPTS = [
        'A modern coffee shop landing page with menu and hours',
        'A minimal portfolio site with dark theme and project cards',
        'A countdown timer app for New Year with confetti animation',
        'A personal budget tracker with charts and categories',
        'A recipe card layout with ingredients and step-by-step instructions',
        'A weather dashboard that shows a 5-day forecast',
        'A habit tracker with streaks and daily check-ins',
        'A landing page for a dog walking service',
        'A retro arcade-style game menu screen',
        'A simple todo app with drag-and-drop reordering',
        'A pricing comparison table for SaaS plans',
        'A music playlist viewer with album art grid',
        'A fitness workout log with exercise cards',
        'A travel blog homepage with destination cards',
        'A restaurant menu with categories and photos',
        'An event RSVP page with countdown and details',
        'A personal link-in-bio page with social icons',
        'A quiz app with multiple choice questions and scoring'
    ];

    var currentPromptIndices = [];

    var FOLLOWUP_SUGGESTIONS = [
        'Add a contact form',
        'Make the header sticky',
        'Add dark/light mode toggle',
        'Add smooth scroll animations',
        'Make it mobile-responsive',
        'Add a footer with social links',
        'Add a hero image or banner',
        'Include a testimonials section',
        'Add hover effects to the cards',
        'Add a search bar',
        'Include an FAQ accordion',
        'Add a loading spinner',
        'Make the colors more vibrant',
        'Add a navigation menu',
        'Include a call-to-action button',
        'Add subtle background animation',
        'Include a pricing section',
        'Add icon badges or tags',
        'Make the typography bolder',
        'Add a modal popup',
        'Include breadcrumb navigation',
        'Add progress indicators',
        'Include a notification banner',
        'Add page transitions',
        'Include a stats counter section'
    ];

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
        els.buyResult = $('buyResult');
        els.buyCurrentBalance = $('buyCurrentBalance');
        els.buyRate = $('buyRate');
        els.buyCostValue = $('buyCostValue');
        els.buySendBtn = $('buySendBtn');
        els.buyCustomAmount = $('buyCustomAmount');
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

    function logout() {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
        showView('auth');
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

            if (resp.status === 401) { logout(); return; }

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
        removeSuggestionChips();
        if (els.buildWelcome) els.buildWelcome.style.display = '';
        els.buildTitle.textContent = 'New Project';
        resetPreview();
        showView('build');
        renderWelcomePrompts();
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
        removeSuggestionChips();
        appendMessage('user', message);

        // Show thinking indicator
        var thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-msg thinking';
        thinkingEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>' +
            '<span class="thinking-status">Thinking...</span>' +
            '<span class="thinking-note">This may take up to 30 seconds</span>';
        els.chatMessages.appendChild(thinkingEl);
        scrollChat();

        var thinkingMessages = ['Thinking...', 'Designing layout...', 'Writing HTML...', 'Building your site...', 'Rendering styles...', 'Almost there...'];
        var thinkingIdx = 0;
        var thinkingInterval = setInterval(function() {
            thinkingIdx = (thinkingIdx + 1) % thinkingMessages.length;
            var statusEl = thinkingEl.querySelector('.thinking-status');
            if (statusEl) statusEl.textContent = thinkingMessages[thinkingIdx];
        }, 3000);

        try {
            var resp = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({
                    session_id: state.sessionId,
                    message: message,
                    model: state.selectedModel
                })
            });

            var data = await resp.json();

            // Remove thinking indicator
            clearInterval(thinkingInterval);
            if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);

            if (resp.status === 401) {
                if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
                logout();
                return;
            }

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
                setTimeout(showSuggestionChips, 400);
            }

        } catch (e) {
            clearInterval(thinkingInterval);
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

    // ── Model Selector ──
    function setModel(tier) {
        state.selectedModel = tier;
        var btns = document.querySelectorAll('.model-option');
        btns.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-model') === tier);
        });
        var hint = document.getElementById('modelHint');
        if (hint) {
            var hints = { fast: 'Fast & lightweight', standard: 'Balanced quality', pro: 'Maximum detail' };
            hint.textContent = hints[tier] || '';
        }
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

        // Pre-fill fields
        var nameEl = document.getElementById('publishName');
        var descEl = document.getElementById('publishDesc');
        if (nameEl) nameEl.value = state.title !== 'New Project' ? state.title : '';
        if (descEl) descEl.value = '';

        els.publishSlug.value = '';
        els.publishResult.innerHTML = '';
        els.publishConfirm.disabled = true;
        els.slugPreview.textContent = 'inclawbate.com/s/...';

        // Auto-generate slug from title
        if (state.title && state.title !== 'New Project') {
            var autoSlug = state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
            els.publishSlug.value = autoSlug;
            onSlugInput();
        }

        if (nameEl) nameEl.focus();
    }

    function closePublish() {
        els.publishOverlay.classList.remove('active');
    }

    function onSlugInput() {
        var raw = els.publishSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
        els.publishSlug.value = raw;
        els.slugPreview.textContent = raw ? 'inclawbate.com/s/' + raw : 'inclawbate.com/s/...';
        els.publishConfirm.disabled = !raw || raw.length < 2;
    }

    function onPaidToggle() {
        var paid = document.getElementById('publishPaid');
        var priceRow = document.getElementById('publishPriceRow');
        if (paid && priceRow) {
            priceRow.classList.toggle('visible', paid.checked);
        }
    }

    async function publish() {
        var slug = els.publishSlug.value.trim();
        if (!slug || !state.currentCode) return;

        els.publishConfirm.disabled = true;
        els.publishResult.innerHTML = 'Publishing...';
        els.publishResult.className = 'publish-result';

        var profile = getProfile();
        var email = (profile && profile.x_handle ? profile.x_handle + '@inclawbate.com' : 'build@inclawbate.com');

        // Collect new fields
        var appName = (document.getElementById('publishName') || {}).value || state.title;
        var appDesc = (document.getElementById('publishDesc') || {}).value || '';
        var category = (document.getElementById('publishCategory') || {}).value || 'other';
        var isPaid = (document.getElementById('publishPaid') || {}).checked || false;
        var priceVal = isPaid ? parseFloat((document.getElementById('publishPrice') || {}).value) || 0 : 0;
        var tagsRaw = (document.getElementById('publishTags') || {}).value || '';
        var tags = tagsRaw.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
        var isListed = (document.getElementById('publishListed') || {}).checked !== false;
        var creatorWallet = profile && profile.wallet_address ? profile.wallet_address : null;
        var creatorXHandle = profile && profile.x_handle ? profile.x_handle : null;

        try {
            var resp = await fetch(PUBLISH_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: appName,
                    slug: slug,
                    code: state.currentCode,
                    email: email,
                    description: appDesc || 'Built with Inclawbate Build Studio',
                    source: state.forkedFrom ? 'build-studio-fork' : 'build-studio',
                    category: category,
                    claws_price: priceVal,
                    creator_wallet: creatorWallet,
                    creator_x_handle: creatorXHandle,
                    tags: tags,
                    is_listed: isListed,
                    forked_from_user_app: state.forkedFrom ? state.forkedFrom.app_id : null,
                    revenue_split: state.forkedFrom ? 80 : 100
                })
            });

            var data = await resp.json();

            if (data.success) {
                var storeLink = isListed ? ' | <a href="/apps" target="_blank">View in App Store</a>' : '';
                els.publishResult.innerHTML = 'Live at <a href="' + data.url + '" target="_blank">' + data.url + '</a>' + storeLink;
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
    var BASE_CHAIN_ID = '0x2105'; // 8453
    var buyState = { clawsPerCredit: 0, selectedAmount: 50, clawsPrice: 0 };

    async function openBuyCredits() {
        els.buyOverlay.classList.add('active');
        els.buyResult.innerHTML = '';
        els.buySendBtn.disabled = true;
        els.buyCustomAmount.value = '';
        els.buyCurrentBalance.textContent = state.credits !== null ? state.credits + ' credits' : '--';

        // Reset preset buttons to default (50)
        buyState.selectedAmount = 50;
        var presets = els.buyOverlay.querySelectorAll('.buy-preset');
        presets.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-amount') === '50');
        });

        // Fetch CLAWS price
        els.buyRate.textContent = 'Loading...';
        els.buyCostValue.textContent = '--';
        try {
            var resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
            var data = await resp.json();
            if (data.pairs && data.pairs.length > 0) {
                var price = parseFloat(data.pairs[0].priceUsd) || 0;
                if (price > 0) {
                    buyState.clawsPrice = price;
                    buyState.clawsPerCredit = Math.ceil(0.005 / price);
                    els.buyRate.textContent = '~' + buyState.clawsPerCredit.toLocaleString() + ' CLAWS / credit';
                    updateBuyCost();
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

    function pickCredits(n) {
        buyState.selectedAmount = n;
        els.buyCustomAmount.value = '';
        var presets = els.buyOverlay.querySelectorAll('.buy-preset');
        presets.forEach(function (btn) {
            btn.classList.toggle('active', parseInt(btn.getAttribute('data-amount')) === n);
        });
        updateBuyCost();
    }

    function onCustomCredits() {
        var val = parseInt(els.buyCustomAmount.value) || 0;
        if (val > 0) {
            buyState.selectedAmount = val;
            var presets = els.buyOverlay.querySelectorAll('.buy-preset');
            presets.forEach(function (btn) { btn.classList.remove('active'); });
        }
        updateBuyCost();
    }

    function updateBuyCost() {
        var amount = buyState.selectedAmount;
        if (!amount || !buyState.clawsPerCredit) {
            els.buyCostValue.textContent = '--';
            els.buySendBtn.disabled = true;
            return;
        }
        var totalClaws = amount * buyState.clawsPerCredit;
        var totalUsd = (amount * 0.005).toFixed(2);
        els.buyCostValue.textContent = totalClaws.toLocaleString() + ' CLAWS (~$' + totalUsd + ')';
        els.buySendBtn.disabled = false;
    }

    async function sendClawsTx() {
        if (!window.ethereum) {
            els.buyResult.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
            els.buyResult.className = 'buy-result error';
            return;
        }

        var amount = buyState.selectedAmount;
        if (!amount || !buyState.clawsPerCredit) return;

        els.buySendBtn.disabled = true;
        els.buyResult.innerHTML = '';

        try {
            // Ensure Base network
            var chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== BASE_CHAIN_ID) {
                try {
                    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
                } catch (switchErr) {
                    els.buyResult.textContent = 'Please switch to Base network in your wallet.';
                    els.buyResult.className = 'buy-result error';
                    els.buySendBtn.disabled = false;
                    return;
                }
            }

            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var from = accounts[0];

            // Build ERC-20 transfer calldata
            var totalTokens = BigInt(amount) * BigInt(buyState.clawsPerCredit);
            var amountWei = totalTokens * BigInt('1000000000000000000');
            var selector = '0xa9059cbb';
            var paddedAddr = PROTOCOL_WALLET.slice(2).toLowerCase().padStart(64, '0');
            var paddedAmt = amountWei.toString(16).padStart(64, '0');
            var data = selector + paddedAddr + paddedAmt;

            els.buyResult.textContent = 'Confirm in your wallet...';
            els.buyResult.className = 'buy-result';

            var txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{ from: from, to: CLAWS_ADDRESS, data: data }]
            });

            // Auto-verify the deposit
            els.buyResult.textContent = 'Transaction sent! Verifying...';
            await verifyDeposit(txHash);

        } catch (e) {
            if (e.code === 4001) {
                els.buyResult.textContent = 'Transaction cancelled.';
            } else {
                els.buyResult.textContent = e.message || 'Transaction failed.';
            }
            els.buyResult.className = 'buy-result error';
            els.buySendBtn.disabled = false;
        }
    }

    async function verifyDeposit(txHash) {
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
                els.buySendBtn.disabled = false;
            }
        } catch (e) {
            els.buyResult.textContent = 'Network error. Try again.';
            els.buyResult.className = 'buy-result error';
            els.buySendBtn.disabled = false;
        }
    }

    // ── Refreshable Welcome Prompts ──
    function pickRandomIndices(poolSize, count) {
        var indices = [];
        while (indices.length < count && indices.length < poolSize) {
            var r = Math.floor(Math.random() * poolSize);
            if (indices.indexOf(r) === -1) indices.push(r);
        }
        return indices;
    }

    function renderWelcomePrompts() {
        var container = document.querySelector('.build-welcome-prompts');
        if (!container) return;

        // Remove existing prompt buttons (keep the shuffle button)
        var existing = container.querySelectorAll('.build-welcome-prompt');
        existing.forEach(function (el) {
            el.classList.add('fade-out');
        });

        setTimeout(function () {
            // Remove old buttons
            container.querySelectorAll('.build-welcome-prompt').forEach(function (el) { el.remove(); });

            // Pick 3 new random prompts
            currentPromptIndices = pickRandomIndices(STARTER_PROMPTS.length, 3);

            // Insert before the shuffle button
            var shuffleBtn = container.querySelector('.shuffle-prompts-btn');

            currentPromptIndices.forEach(function (idx, i) {
                var btn = document.createElement('button');
                btn.className = 'build-welcome-prompt fade-in';
                btn.style.animationDelay = (i * 0.08) + 's';
                btn.textContent = STARTER_PROMPTS[idx];
                btn.addEventListener('click', function () { usePrompt(STARTER_PROMPTS[idx]); });
                container.insertBefore(btn, shuffleBtn);
            });
        }, existing.length > 0 ? 200 : 0);
    }

    function shufflePrompts() {
        renderWelcomePrompts();
    }

    // ── Follow-up Suggestion Chips ──
    function removeSuggestionChips() {
        var chips = els.chatMessages.querySelectorAll('.suggestion-chips');
        chips.forEach(function (c) { c.remove(); });
    }

    function showSuggestionChips() {
        removeSuggestionChips();

        var indices = pickRandomIndices(FOLLOWUP_SUGGESTIONS.length, 4);
        var container = document.createElement('div');
        container.className = 'suggestion-chips';

        indices.forEach(function (idx, i) {
            var chip = document.createElement('button');
            chip.className = 'suggestion-chip';
            chip.style.animationDelay = (i * 0.08) + 's';
            chip.textContent = FOLLOWUP_SUGGESTIONS[idx];
            chip.addEventListener('click', function () {
                removeSuggestionChips();
                usePrompt(FOLLOWUP_SUGGESTIONS[idx]);
            });
            container.appendChild(chip);
        });

        var shuffleBtn = document.createElement('button');
        shuffleBtn.className = 'shuffle-prompts-btn';
        shuffleBtn.title = 'More ideas';
        shuffleBtn.innerHTML = '<svg class="shuffle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> More ideas';
        shuffleBtn.addEventListener('click', function () { showSuggestionChips(); });
        container.appendChild(shuffleBtn);

        els.chatMessages.appendChild(container);
        scrollChat();
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

    // ── Fork Detection ──
    function checkForkSource() {
        try {
            var raw = sessionStorage.getItem('fork_source');
            if (!raw) return false;
            sessionStorage.removeItem('fork_source');
            var fork = JSON.parse(raw);
            if (!fork.code) return false;

            state.forkedFrom = { app_id: fork.app_id, name: fork.name };
            state.currentCode = fork.code;
            state.title = 'Fork of ' + (fork.name || 'App');

            // Go straight to build view with code loaded
            showView('build');
            els.buildTitle.textContent = state.title;
            if (els.buildWelcome) els.buildWelcome.style.display = 'none';
            updatePreview(state.currentCode);
            appendMessage('assistant', 'Forked from "' + (fork.name || 'App') + '". The code is loaded in preview — edit it with chat or publish directly.');
            return true;
        } catch (e) { return false; }
    }

    // ── Init ──
    function init() {
        cacheDom();
        setupInput();
        renderWelcomePrompts();

        if (!isLoggedIn()) {
            showView('auth');
            return;
        }

        // Fetch credits on load
        fetchCredits();

        // Check if we're loading from a fork
        if (checkForkSource()) return;

        loadProjects();
    }

    // ── Expose Public API ──
    window.BuildApp = {
        newProject: newProject,
        send: sendMessage,
        goBack: goBack,
        setModel: setModel,
        switchTab: switchTab,
        openPublish: openPublish,
        closePublish: closePublish,
        onSlugInput: onSlugInput,
        onPaidToggle: onPaidToggle,
        publish: publish,
        openBuyCredits: openBuyCredits,
        closeBuyCredits: closeBuyCredits,
        pickCredits: pickCredits,
        onCustomCredits: onCustomCredits,
        sendClawsTx: sendClawsTx,
        usePrompt: usePrompt,
        shufflePrompts: shufflePrompts,
        connectWallet: connectWallet
    };

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
