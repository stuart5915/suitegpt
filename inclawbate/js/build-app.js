// Inclawbate Build Studio — Client-side logic
// Chat-based AI builder: describe → generate → preview → publish

(function () {
    'use strict';

    var API_BASE = '/api/studio/chat';
    var PUBLISH_API = '/api/publish-site';

    var FREE_CREDIT_WALLETS = [
        '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'
    ];
    var FREE_HANDLES = ['artstu'];

    function isAdmin() {
        var p = getProfile();
        if (!p) return false;
        if (state.isAngelHolder) return true;
        if (p.wallet_address && FREE_CREDIT_WALLETS.indexOf(p.wallet_address.toLowerCase()) !== -1) return true;
        if (p.x_handle && FREE_HANDLES.indexOf(p.x_handle.toLowerCase()) !== -1) return true;
        return false;
    }

    // ── State ──
    var state = {
        sessionId: null,
        currentCode: null,
        codeHistory: [],
        credits: null,
        sending: false,
        title: 'New App',
        forkedFrom: null,  // { app_id, name } if forked
        editingApp: null,  // { id, slug, name } if editing existing app
        selectedModel: 'gemini',
        previewErrors: [],
        autoFixAttempts: 0,
        maxAutoFix: 2,
        isAngelHolder: false
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

    var CATEGORY_PROMPTS = {
        apis: [
            'A crypto price dashboard that fetches live prices from DexScreener',
            'A weather app that pulls real-time forecasts from a public API',
            'A news aggregator that fetches top headlines from NewsAPI',
            'A GitHub profile viewer that shows repos and stats from the GitHub API',
            'A stock ticker widget with live price updates',
            'A sports scoreboard fetching live game data',
            'A movie search app that pulls ratings and posters from OMDB API',
            'A currency converter with live exchange rates from ExchangeRate API',
            'A random quote generator that fetches quotes from a public API',
            'A recipe finder that searches meals by ingredient using TheMealDB',
            'A space tracker showing ISS location in real time',
            'A dictionary app with definitions, synonyms, and pronunciation',
            'A Pokémon explorer that fetches stats and sprites from PokéAPI',
            'A public transit arrival board using a city transit API',
            'A COVID or health stats dashboard with historical charts',
            'A timezone converter that shows clocks for multiple cities',
            'A joke generator that fetches random jokes from JokeAPI',
            'An earthquake tracker showing recent seismic activity on a map',
            'A book search app using the Open Library API',
            'A dog breed explorer with photos from the Dog CEO API'
        ],
        wallet: [
            'A tip jar page where visitors can send CLAWS tokens to the creator',
            'A paywalled article site — readers pay CLAWS to unlock premium content',
            'A digital art gallery where each piece can be purchased with CLAWS',
            'A creator subscription page with CLAWS-gated tiers',
            'A bounty board where users pay CLAWS to post and claim tasks',
            'A donation tracker showing live CLAWS contributions',
            'A pay-per-download file sharing page with CLAWS payments',
            'A freelance marketplace where clients pay CLAWS for gigs',
            'A charity fundraiser page with CLAWS donation progress bar',
            'A token-gated members-only community page',
            'A microtipping blog where readers tip per paragraph with CLAWS',
            'A raffle page where users buy entries with CLAWS tokens',
            'A tutoring marketplace with CLAWS-based session booking',
            'A prediction market where users bet CLAWS on outcomes',
            'An escrow service page for safe peer-to-peer CLAWS trades',
            'A crowdfunding page where backers pledge CLAWS to projects',
            'A pay-what-you-want music store with CLAWS payments',
            'A digital coupon marketplace bought and sold with CLAWS',
            'A token-gated event ticketing page using CLAWS',
            'A creator merch store with CLAWS checkout'
        ],
        canvas: [
            'A retro snake game with high score tracking',
            'An interactive particle system that reacts to mouse movement',
            'A pixel art drawing tool with color palette and export',
            'A 3D spinning cube with WebGL shading',
            'A platformer game with physics and level progression',
            'A data visualization dashboard with animated bar and pie charts',
            'A breakout/brick-breaker game with levels and power-ups',
            'A generative art canvas that creates unique patterns on each load',
            'A drawing whiteboard with pen sizes, colors, and undo',
            'A flappy bird clone with animated sprites',
            'A maze generator and solver with animated pathfinding',
            'A fireworks display that launches on click',
            'A mandelbrot fractal explorer with zoom and pan',
            'A tower defense game with enemy waves and placeable turrets',
            'A pong game with AI opponent and score tracking',
            'A cloth simulation that drapes and tears on interaction',
            'An analog clock with smooth sweeping second hand',
            'A starfield animation with parallax depth effect',
            'A connect-four game with gravity drop animations',
            'A fluid simulation where you paint with colorful particles'
        ],
        images: [
            'A portfolio gallery with uploaded project screenshots',
            'A restaurant menu page with food photography',
            'A real estate listing page with property photos',
            'A team page with staff headshots and bios',
            'A product landing page with hero banner and feature images',
            'A photo blog with grid layout and lightbox',
            'A before-and-after image comparison slider',
            'An image carousel with swipe gestures and thumbnails',
            'A moodboard builder where you arrange uploaded images freely',
            'A recipe card generator with food photos and instructions',
            'A travel destination showcase with full-bleed hero images',
            'An event invitation page with photo collage header',
            'A pet adoption listing page with animal photos and details',
            'A fashion lookbook with grid and full-screen gallery views',
            'A wedding photo gallery with date, venue, and slideshow',
            'An art portfolio with category filters and zoom view',
            'A product comparison page with side-by-side images',
            'A nature photography showcase with masonry grid layout',
            'A yearbook-style page with photo grid and captions',
            'A screenshot gallery for app store marketing'
        ],
        web3: [
            'A token swap interface connected to Uniswap on Base',
            'A wallet dashboard showing ETH and ERC-20 token balances',
            'A token holder leaderboard fetching on-chain data',
            'A DEX price chart pulling from DexScreener API',
            'A staking calculator showing APY and projected rewards',
            'An NFT gallery that displays tokens from a wallet address',
            'A gas price tracker showing current Base network fees',
            'A multi-chain portfolio viewer for ETH, Base, and Arbitrum',
            'A DAO voting interface with proposal list and vote buttons',
            'A token vesting schedule viewer with unlock countdown',
            'An airdrop eligibility checker for a wallet address',
            'A block explorer lite that shows recent transactions on Base',
            'A whale watcher that tracks large token transfers',
            'A yield farming dashboard comparing APYs across protocols',
            'An ENS name lookup tool that resolves addresses and avatars',
            'A multi-sig wallet interface for approving group transactions',
            'A token launch countdown page with live price feed',
            'A DeFi position tracker showing LP and lending balances',
            'An on-chain activity feed for a given wallet address',
            'A memecoin screener with volume, holders, and price change'
        ],
        audio: [
            'A drum machine with 8 pads and different sound samples',
            'A text-to-speech reader that speaks any pasted text aloud',
            'A voice memo recorder with playback and waveform display',
            'A music visualizer that reacts to microphone input',
            'A metronome app with adjustable BPM and time signatures',
            'A soundboard with customizable audio clips',
            'A piano keyboard you can play with mouse or keyboard keys',
            'A lo-fi beat maker with looping tracks and volume sliders',
            'A podcast player with speed control and bookmarks',
            'A white noise generator with rain, ocean, and forest sounds',
            'An audio spectrum analyzer with colorful frequency bars',
            'A vocal pitch detector that shows your note in real time',
            'A DJ mixer with two decks and a crossfader',
            'A sound effects board for live streaming or video calls',
            'A chord progression builder that plays back in sequence',
            'A karaoke lyrics display with synced scrolling',
            'A binaural beats generator with frequency controls',
            'A sample slicer that chops audio into triggerable pads',
            'A guitar tuner that listens and shows how sharp or flat you are',
            'An alarm clock app with selectable ringtones and snooze'
        ],
        appdb: [
            'A multiplayer quiz game with a global leaderboard using AppDB',
            'A shared todo list where anyone can add and check off items using AppDB',
            'A guestbook where visitors leave messages stored in AppDB',
            'A voting/poll app with live results saved in AppDB',
            'A cloud-synced personal journal that saves entries with AppDB',
            'A bookmark manager that saves links per user with AppDB',
            'A habit tracker that logs daily streaks per user with AppDB',
            'A flashcard study app with saved decks stored in AppDB',
            'A recipe box where users save and share recipes via AppDB',
            'A bug tracker with issue cards saved in AppDB',
            'A multiplayer tic-tac-toe game with match history in AppDB',
            'A fitness log that tracks workouts and PRs with AppDB',
            'A link shortener that stores and tracks clicks via AppDB',
            'A collaborative wishlist where groups add items via AppDB',
            'A mood journal that charts your mood over time using AppDB',
            'A micro-blog feed where users post short updates via AppDB',
            'A classroom attendance tracker with AppDB persistence',
            'A movie watchlist with ratings saved per user in AppDB',
            'A shared grocery list app with real-time sync via AppDB',
            'A community event board with RSVPs stored in AppDB'
        ],
        libraries: [
            'A dashboard with interactive Chart.js charts and live data',
            'A 3D model viewer using Three.js with orbit controls',
            'An interactive map with Leaflet and custom markers',
            'A drag-and-drop Kanban board with SortableJS',
            'A markdown editor with live preview using Marked.js',
            'A physics simulation with bouncing balls using Matter.js',
            'A code editor with syntax highlighting using CodeMirror',
            'A gantt chart project planner using Frappe Gantt',
            'An animated solar system using Three.js with orbiting planets',
            'A CSV data explorer with sortable tables using Tabulator',
            'A flowchart builder using Mermaid.js for diagrams',
            'A 3D terrain generator using Three.js with height maps',
            'A real-time collaborative whiteboard using Fabric.js',
            'A network graph visualizer using D3.js force layout',
            'A calendar scheduler with event drag-and-drop using FullCalendar',
            'An image annotation tool with drawing overlays using Fabric.js',
            'A math equation renderer with live preview using KaTeX',
            'A slide deck presenter using Reveal.js with custom themes',
            'A rich text editor with formatting toolbar using Quill.js',
            'A data-driven scatter plot explorer using Chart.js'
        ]
    };

    var currentPromptIndices = [];
    var lastShownIndices = [];
    var activeCategory = null;

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
        els.chatHeaderArea = $('chatHeaderArea');
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
        els.buyCardBtn = $('buyCardBtn');
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
                    '<div class="empty-state-icon">&#129438;</div>' +
                    '<div class="empty-state-headline">Your first app is waiting</div>' +
                    '<div class="empty-state-sub">Describe it in words. Watch AI build it live. Publish it to the world.</div>' +
                    '<button class="empty-state-cta" onclick="window.BuildApp.newProject()">&#10024; Start Building</button>' +
                    '</div>';
                return;
            }

            els.projectsList.innerHTML = '';
            data.sessions.forEach(function (s) {
                var card = document.createElement('div');
                card.className = 'project-card';
                var date = new Date(s.updated_at || s.created_at).toLocaleDateString();
                var pub = s.published_at ? '<span class="published"> &middot; Published</span>' : '<span class="draft-badge"> &middot; Draft</span>';

                card.innerHTML =
                    '<div class="project-card-preview"></div>' +
                    '<div class="project-card-info">' +
                        '<div class="project-card-title">' + escapeHtml(s.title) + '</div>' +
                        '<div class="project-card-meta">' + date + pub + '</div>' +
                    '</div>' +
                    '<button type="button" class="project-card-delete" title="Delete app">&times;</button>';

                // Build preview via DOM to avoid srcdoc escaping issues
                var previewEl = card.querySelector('.project-card-preview');
                if (s.current_code) {
                    var iframe = document.createElement('iframe');
                    iframe.sandbox = 'allow-scripts';
                    iframe.loading = 'lazy';
                    iframe.tabIndex = -1;
                    iframe.srcdoc = s.current_code;
                    previewEl.appendChild(iframe);
                } else {
                    previewEl.innerHTML = '<div class="project-card-preview-empty">&#128196;</div>';
                }

                card.querySelector('.project-card-info').addEventListener('click', function () { openSession(s.id); });
                card.querySelector('.project-card-preview').addEventListener('click', function () { openSession(s.id); });
                card.querySelector('.project-card-delete').addEventListener('click', function (e) {
                    e.stopPropagation();
                    deleteSession(s.id, s.title, card);
                });
                els.projectsList.appendChild(card);
            });
        } catch (e) {
            els.projectsList.innerHTML = '<div class="projects-empty"><p>Failed to load apps.</p></div>';
        }
    }

    // ── Delete Session ──
    async function deleteSession(sessionId, title, cardEl) {
        if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
        try {
            var resp = await fetch(API_BASE + '?session_id=' + sessionId, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            if (resp.ok) {
                cardEl.style.transition = 'opacity 0.25s';
                cardEl.style.opacity = '0';
                setTimeout(function () { cardEl.remove(); }, 250);
            } else {
                var data = await resp.json();
                alert(data.error || 'Failed to delete.');
            }
        } catch (e) {
            alert('Network error. Try again.');
        }
    }

    // ── Open Existing Session ──
    async function openSession(sessionId) {
        state.sessionId = sessionId;
        state.currentCode = null;
        // Clear messages but keep welcome hidden
        var msgs = els.chatMessages.querySelectorAll('.chat-msg');
        msgs.forEach(function (m) { m.remove(); });
        if (els.chatHeaderArea) els.chatHeaderArea.style.display = 'none';
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

            // If session has no saved code, try to recover from message history
            if (!data.session.current_code && data.messages && data.messages.length > 0) {
                var lastCode = null;
                for (var mi = data.messages.length - 1; mi >= 0; mi--) {
                    if (data.messages[mi].code) { lastCode = data.messages[mi].code; break; }
                }
                if (lastCode) {
                    state.currentCode = lastCode;
                    updatePreview(lastCode);
                } else {
                    appendMessage('assistant', 'This session was interrupted before it could finish. Type your prompt again to continue building.');
                }
            } else if (!data.session.current_code && (!data.messages || data.messages.length === 0)) {
                appendMessage('assistant', 'This session was interrupted before it could finish. Type your prompt again to continue building.');
                if (els.chatHeaderArea) els.chatHeaderArea.style.display = '';
            }

            scrollChat();
        } catch (e) {
            els.buildTitle.textContent = 'Error loading session';
        }
    }

    // ── New App ──
    function newProject() {
        state.sessionId = null;
        state.currentCode = null;
        state.codeHistory = [];
        updateUndoBtn();
        state.title = 'New App';
        // Remove chat messages but re-show welcome
        var msgs = els.chatMessages.querySelectorAll('.chat-msg');
        msgs.forEach(function (m) { m.remove(); });
        removeSuggestionChips();
        if (els.chatHeaderArea) els.chatHeaderArea.style.display = '';
        var cp = document.querySelector('.chat-panel');
        if (cp) cp.classList.remove('has-messages');
        els.buildTitle.textContent = 'New App';
        resetPreview();
        showView('build');
        renderWelcomePrompts();
        els.chatInput.focus();
    }

    function startNew() {
        state.forkedFrom = null;
        state.editingApp = null;
        newProject();
    }

    // ── Cost Estimation & Confirmation ──
    async function estimateEditCost() {
        if (!state.currentCode) return null;
        try {
            var resp = await fetch(API_BASE + '?estimate=true&model=' + state.selectedModel + '&code_length=' + state.currentCode.length + '&is_edit=true', {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) { return null; }
    }

    function showCostConfirmation(estimate) {
        return new Promise(function (resolve) {
            // Remove existing modal if any
            var existing = document.querySelector('.cost-confirm-overlay');
            if (existing) existing.remove();

            var codeSize = state.currentCode ? (state.currentCode.length / 1024).toFixed(0) + 'KB' : '';
            var rows = '<div class="cost-row total"><span>Cost per message</span><span>' + estimate.base_credits + ' credits</span></div>';

            var overlay = document.createElement('div');
            overlay.className = 'cost-confirm-overlay active';
            overlay.innerHTML =
                '<div class="cost-confirm-modal">' +
                    '<h3>Editing ' + (codeSize ? codeSize + ' app' : 'existing app') + '</h3>' +
                    '<p class="cost-confirm-desc">This will use credits from your balance.</p>' +
                    rows +
                    '<div class="cost-confirm-actions">' +
                        '<button class="cost-cancel-btn">Cancel</button>' +
                        '<button class="cost-continue-btn">Send</button>' +
                    '</div>' +
                '</div>';

            overlay.querySelector('.cost-cancel-btn').onclick = function () {
                overlay.remove();
                resolve(false);
            };
            overlay.querySelector('.cost-continue-btn').onclick = function () {
                overlay.remove();
                resolve(true);
            };
            document.body.appendChild(overlay);
        });
    }

    // ── Send Message ──
    async function sendMessage() {
        if (state.sending) return;
        var message = els.chatInput.value.trim();
        if (!message) return;

        // Reset auto-fix counter for user-initiated messages (not auto-retries)
        if (message.indexOf('The generated code has runtime') !== 0 &&
            message.indexOf('The previous output was truncated') !== 0) {
            state.autoFixAttempts = 0;
        }

        // Credits no longer gated — free for all users

        state.sending = true;
        els.chatInput.value = '';
        els.chatInput.style.height = 'auto';
        els.chatSend.disabled = true;

        // Show user message
        removeSuggestionChips();
        appendMessage('user', message);

        // Optimistic credit deduction — backend charges upfront too (skip for admins)
        var tierCost = { gemini: 0, llama: 0, kimi: 0, fast: 10, standard: 50, pro: 100 }[state.selectedModel] || 0;
        if (tierCost > 0 && !isAdmin() && state.credits !== null) {
            state.credits = Math.max(0, state.credits - tierCost);
            updateCredits();
        }

        // Show thinking indicator
        var thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-msg thinking';
        thinkingEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>' +
            '<span class="thinking-status">Thinking...</span>' +
            '<span class="thinking-note">Complex apps may take a few minutes</span>';
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
            var fullMessage = message + getAttachmentPrompt() + getProjectPrompt();

            var fetchHeaders = { 'Content-Type': 'application/json' };
            if (getToken()) fetchHeaders['Authorization'] = 'Bearer ' + getToken();
            var resp = await fetch(API_BASE, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify(Object.assign({
                    session_id: state.sessionId,
                    message: fullMessage,
                    model: state.selectedModel
                }, state.currentCode ? { current_code: state.currentCode } : {}))
            });

            if (resp.status === 504) {
                clearInterval(thinkingInterval);
                if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
                appendMessage('assistant', 'Request timed out. Try a simpler change, or try again.');
                state.sending = false;
                els.chatSend.disabled = false;
                return;
            }

            // Non-streaming error responses (401, 402, etc.) come as JSON
            var contentType = resp.headers.get('content-type') || '';
            if (!contentType.includes('text/event-stream')) {
                clearInterval(thinkingInterval);
                if (thinkingEl && thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
                var data;
                try { data = await resp.json(); } catch (jsonErr) { data = { error: 'Server error (' + resp.status + '). Please try again.' }; }
                if (resp.status === 401) {
                    appendMessage('assistant', data.error || 'Session expired. Please log in to continue.');
                    if (isLoggedIn()) logout();
                    state.sending = false;
                    els.chatSend.disabled = false;
                    return;
                }
                appendMessage('assistant', data.error || 'Something went wrong.');
                if (resp.status === 402) openBuyCredits();
                state.sending = false;
                els.chatSend.disabled = false;
                return;
            }

            // ── Read SSE stream ──
            // Keep thinking indicator alive with progress messages while streaming
            var streamMessages = ['Writing code...', 'Building layout...', 'Adding styles...', 'Wiring up logic...', 'Polishing details...', 'Almost done...'];
            var streamMsgIdx = 0;
            var streamStarted = false;
            var streamedText = '';

            var reader = resp.body.getReader();
            var decoder = new TextDecoder();
            var sseBuffer = '';
            var doneData = null;
            var lastDataTime = Date.now();
            var STREAM_TIMEOUT = 5 * 60 * 1000; // 5 minutes

            while (true) {
                // Timeout guard: abort if no data for 5 minutes
                var timeSinceLast = Date.now() - lastDataTime;
                if (timeSinceLast > STREAM_TIMEOUT) {
                    reader.cancel();
                    throw new Error('Stream timed out — no data received for 5 minutes.');
                }
                var chunk = await reader.read();
                if (chunk.done) break;
                lastDataTime = Date.now();

                sseBuffer += decoder.decode(chunk.value, { stream: true });
                var sseLines = sseBuffer.split('\n');
                sseBuffer = sseLines.pop();

                for (var i = 0; i < sseLines.length; i++) {
                    var line = sseLines[i];
                    if (!line.startsWith('data: ')) continue;
                    try {
                        var evt = JSON.parse(line.slice(6));
                        if (evt.type === 'session') {
                            if (evt.session_id) state.sessionId = evt.session_id;
                            if (evt.title && state.title === 'New App') {
                                state.title = evt.title;
                                els.buildTitle.textContent = state.title;
                            }
                        } else if (evt.type === 'delta') {
                            streamedText += evt.text;
                            // Update thinking indicator with progress on first delta
                            if (!streamStarted) {
                                streamStarted = true;
                                clearInterval(thinkingInterval);
                                var statusEl = thinkingEl.querySelector('.thinking-status');
                                if (statusEl) statusEl.textContent = streamMessages[0];
                                var noteEl = thinkingEl.querySelector('.thinking-note');
                                if (noteEl) noteEl.textContent = '';
                                // Rotate progress messages every 2.5s
                                thinkingInterval = setInterval(function() {
                                    streamMsgIdx = (streamMsgIdx + 1) % streamMessages.length;
                                    var s = thinkingEl.querySelector('.thinking-status');
                                    if (s) s.textContent = streamMessages[streamMsgIdx];
                                }, 2500);
                            }
                        } else if (evt.type === 'done') {
                            doneData = evt;
                        }
                    } catch (e) { /* skip */ }
                }
            }

            // Flush decoder and process any remaining data in buffer
            // (the 'done' event can arrive in the final chunk and stay in sseBuffer)
            sseBuffer += decoder.decode();
            if (sseBuffer) {
                var remainingLines = sseBuffer.split('\n');
                for (var ri = 0; ri < remainingLines.length; ri++) {
                    var rline = remainingLines[ri];
                    if (!rline.startsWith('data: ')) continue;
                    try {
                        var revt = JSON.parse(rline.slice(6));
                        if (revt.type === 'delta') streamedText += revt.text;
                        else if (revt.type === 'done') doneData = revt;
                        else if (revt.type === 'session') {
                            if (revt.session_id) state.sessionId = revt.session_id;
                        }
                    } catch (e) {}
                }
            }

            // Remove thinking indicator
            clearInterval(thinkingInterval);
            if (thinkingEl && thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
            var finalCode = (doneData && doneData.code) || extractHtmlClient(streamedText);

            // Fallback: if done event was lost but backend saved code, recover it
            if (!finalCode && state.sessionId && streamedText.length > 20) {
                try {
                    var recoverResp = await fetch(API_BASE + '?session_id=' + state.sessionId, {
                        headers: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}
                    });
                    if (recoverResp.ok) {
                        var recoverData = await recoverResp.json();
                        if (recoverData.session && recoverData.session.current_code) {
                            finalCode = recoverData.session.current_code;
                            console.warn('Recovered code from session (done event was lost)');
                        }
                    }
                } catch (recoverErr) {
                    console.warn('Code recovery failed:', recoverErr);
                }
            }

            // Guard: if response is just metadata (model ID, etc.) and no code, treat as error
            var stripped = streamedText.replace(/```html[\s\S]*?```/g, '').trim();
            if (!finalCode && stripped.length < 80 && /^model:\s/i.test(stripped)) {
                streamedText = 'Something went wrong — the AI returned an empty response. Please try again.';
            }

            var responseShown = false;
            if (!streamedText.trim() && !finalCode) {
                appendMessage('assistant', 'No response from AI. Please try again.');
            } else {
                appendMessage('assistant', streamedText, finalCode);
                responseShown = true;
            }

            if (doneData) {
                if (doneData.credits_remaining !== undefined) {
                    state.credits = doneData.credits_remaining;
                    updateCredits();
                }
            }

            if (finalCode) {
                // Detect truncated output — missing </html> means code was cut off
                // Only check </script> if the code actually has a <script> tag
                var hasScript = finalCode.includes('<script');
                var isTruncated = !finalCode.includes('</html>') || (hasScript && !finalCode.includes('</script>'));
                if (isTruncated && state.autoFixAttempts < state.maxAutoFix) {
                    // Show partial preview even though it's truncated
                    state.currentCode = finalCode;
                    try { updatePreview(finalCode); } catch (e) { /* ignore */ }
                    appendMessage('assistant', '⚠️ Code appears truncated (output was cut off). Attempting to regenerate...');
                    state.autoFixAttempts++;
                    els.chatInput.value = 'The previous output was truncated and the code is incomplete — it\'s missing closing tags. Please regenerate the COMPLETE app from scratch, making sure to include ALL functions and closing tags. Output the full HTML file.';
                    state.sending = false;
                    els.chatSend.disabled = false;
                    sendMessage();
                    return;
                }
                if (state.currentCode && state.autoFixAttempts === 0) {
                    state.codeHistory.push(state.currentCode);
                    if (state.codeHistory.length > 20) state.codeHistory.shift();
                    updateUndoBtn();
                }
                state.currentCode = finalCode;
                try {
                    updatePreview(finalCode);
                    showPreviewBadge();
                } catch (previewErr) {
                    console.error('Preview update failed:', previewErr);
                }
                setTimeout(showSuggestionChips, 400);
            }

        } catch (e) {
            clearInterval(thinkingInterval);
            if (thinkingEl && thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);

            // If response was already displayed, don't show confusing "Network error"
            if (responseShown) {
                console.warn('Post-stream error (response already shown):', e);
            // If we already received partial streamed data, try to use it
            } else if (streamedText && streamedText.length > 100) {
                var partialCode = extractHtmlClient(streamedText);
                appendMessage('assistant', streamedText + '\n\n⚠️ Connection interrupted — showing partial result.', partialCode);
                if (partialCode) {
                    // Check if it looks complete enough to use
                    var looksComplete = partialCode.includes('</html>') && partialCode.includes('</script>');
                    if (looksComplete) {
                        if (state.currentCode) {
                            state.codeHistory.push(state.currentCode);
                            if (state.codeHistory.length > 20) state.codeHistory.shift();
                            updateUndoBtn();
                        }
                        state.currentCode = partialCode;
                        try {
                            updatePreview(partialCode);
                            showPreviewBadge();
                        } catch (pe) { console.warn('Preview failed:', pe); }
                    } else {
                        appendMessage('assistant', '⚠️ Code was incomplete. Try sending your request again.');
                    }
                }
            } else {
                var errMsg = 'Network error. Please try again.';
                if (e && e.message && e.message.includes('504')) {
                    errMsg = 'Request timed out — the app may be too complex. Try a simpler change or start fresh.';
                } else if (e && e.message && e.message.includes('timed out')) {
                    errMsg = 'Stream timed out. Try a simpler request or start fresh.';
                }
                appendMessage('assistant', errMsg);
            }
        }

        // Clear attachments after send
        chatAttachments = [];
        renderChatAttachPreviews();

        state.sending = false;
        els.chatSend.disabled = false;
        scrollChat();
    }

    // ── Chat Helpers ──
    function appendMessage(role, content, code) {
        // Hide welcome on first message
        if (els.chatHeaderArea) els.chatHeaderArea.style.display = 'none';
        // Flag chat panel for mobile layout switch
        var cp = document.querySelector('.chat-panel');
        if (cp) cp.classList.add('has-messages');

        var div = document.createElement('div');
        div.className = 'chat-msg ' + role;

        if (role === 'user') {
            div.textContent = content;
        } else {
            // Strip HTML code blocks, edit blocks, and any leftover markers from display
            var displayText = content
                .replace(/```html[\s\S]*?```/g, '')
                .replace(/```html[\s\S]*/g, '')
                .replace(/<{3,8}\s*SEARCH[\s\S]*?>{3,8}\s*REPLACE/g, '')
                .replace(/^[<>={3,8}\s]*(SEARCH|REPLACE|=======).*$/gm, '')
                .trim();
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

    // ── Error handler injection (client-side, matches server-side) ──
    function injectErrorHandlerClient(html) {
        var script = '<script>' +
            '(function(){' +
            'var errs=[];' +
            'window.onerror=function(msg,src,line,col,err){' +
            'errs.push({message:msg,line:line,col:col,stack:err&&err.stack||""});' +
            'if(window.parent!==window)window.parent.postMessage({type:"studio-error",errors:errs},"*");' +
            '};' +
            'window.addEventListener("unhandledrejection",function(e){' +
            'errs.push({message:String(e.reason),line:0});' +
            'if(window.parent!==window)window.parent.postMessage({type:"studio-error",errors:errs},"*");' +
            '});' +
            'window.addEventListener("load",function(){' +
            'setTimeout(function(){' +
            'if(errs.length>0&&window.parent!==window){' +
            'window.parent.postMessage({type:"studio-error",errors:errs},"*");' +
            '}' +
            'var body=document.body;' +
            'if(body&&window.parent!==window){' +
            'var text=(body.innerText||"").trim();' +
            'var hasCanvas=body.querySelector("canvas,svg,img,video,iframe");' +
            'var h=body.scrollHeight;' +
            'if(!text&&!hasCanvas&&h<50){' +
            'window.parent.postMessage({type:"studio-error",errors:[{message:"Page appears blank — no visible content rendered",line:0,blank:true}]},"*");' +
            '}' +
            '}' +
            '},2000);' +
            '});' +
            '})();' +
            '<\/script>';
        if (html.indexOf('<head>') !== -1) return html.replace('<head>', '<head>' + script);
        if (html.indexOf('<html>') !== -1) return html.replace('<html>', '<html><head>' + script + '</head>');
        return script + html;
    }

    // ── Preview ──
    // SDK scripts to inject into preview so AppDB/CLAWS/Realtime don't crash
    var SDK_TAGS = '<script src="https://inclawbate.app/js/claws-sdk.js" data-preview="true"><\/script>' +
        '<script src="https://inclawbate.app/js/appdb-sdk.js" data-app-id="preview"><\/script>' +
        '<script src="https://inclawbate.app/js/realtime-sdk.js" data-app-id="preview"><\/script>';

    function injectSDKs(code) {
        // Inject SDK scripts right after <head> so they load before app code
        if (code.indexOf('appdb-sdk') !== -1 && code.indexOf('claws-sdk') !== -1) return code; // already has them
        var headIdx = code.indexOf('<head>');
        if (headIdx !== -1) {
            return code.slice(0, headIdx + 6) + SDK_TAGS + code.slice(headIdx + 6);
        }
        // No <head> tag — prepend before everything
        return SDK_TAGS + code;
    }

    function updatePreview(code) {
        els.previewEmpty.style.display = 'none';
        els.previewFrame.style.display = '';
        // Inject SDKs so AppDB/CLAWS/Realtime are available in preview
        var codeWithSDKs = injectSDKs(code);
        // Inject error handler if not already present
        var codeWithHandler = codeWithSDKs.indexOf('studio-error') === -1 ? injectErrorHandlerClient(codeWithSDKs) : codeWithSDKs;
        els.previewFrame.srcdoc = codeWithHandler;
        els.codeContent.textContent = code;
        els.publishBtn.disabled = false;
        // Reset error state for new preview
        state.previewErrors = [];
        hideErrorBanner();
        updateDownloadBtn();
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
        updateDownloadBtn();
    }

    // ── Error Banner ──
    function showErrorBanner(errors) {
        var banner = document.getElementById('errorBanner');
        if (!banner) return;
        var list = errors.map(function(e) {
            return '<div class="error-item">' +
                '<span class="error-msg">' + escapeHtml(e.message) + '</span>' +
                (e.line ? ' <span class="error-line">line ' + e.line + '</span>' : '') +
                '</div>';
        }).join('');
        banner.innerHTML =
            '<div class="error-banner-header">' +
                '<span class="error-banner-icon">&#9888;</span>' +
                '<span class="error-banner-title">Runtime errors detected (' + errors.length + ')</span>' +
                '<button class="error-toggle-btn" onclick="this.parentNode.parentNode.classList.toggle(\'collapsed\')">' +
                    '&#9660;' +
                '</button>' +
            '</div>' +
            '<div class="error-banner-body">' +
                list +
                '<div class="error-banner-actions">' +
                    (state.autoFixAttempts < state.maxAutoFix
                        ? '<button class="error-autofix-btn" onclick="window.BuildApp.autoFix()">&#9889; Auto-fix errors</button>'
                        : '<div class="error-incubation-cta">' +
                            '<div class="cta-headline">Need something more advanced?</div>' +
                            '<div class="cta-body">Our incubation program builds production-grade apps with multi-page routing, API integrations, databases, and ongoing dev support. We\'ll review your project and come back with a quote.</div>' +
                            '<div class="cta-buttons">' +
                                '<button class="incubation-cta-btn primary" onclick="window.BuildApp.openIncubation(\'incubation\')">Request Incubation</button>' +
                                '<button class="incubation-cta-btn secondary" onclick="window.BuildApp.openIncubation(\'super\')">Super Incubation</button>' +
                            '</div>' +
                          '</div>') +
                '</div>' +
            '</div>';
        banner.style.display = 'block';
        banner.classList.remove('collapsed');
    }

    function hideErrorBanner() {
        var banner = document.getElementById('errorBanner');
        if (banner) {
            banner.style.display = 'none';
            banner.innerHTML = '';
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function handlePreviewErrors(errors) {
        if (!errors || errors.length === 0) return;
        state.previewErrors = errors;
        showErrorBanner(errors);

        // Auto-trigger first fix attempt automatically (Bolt.new-style UX)
        if (state.autoFixAttempts < 1) {
            setTimeout(function() {
                if (!state.sending && state.previewErrors.length > 0) {
                    autoFix();
                }
            }, 800);
        }
    }

    function autoFix() {
        if (state.sending) return;
        if (state.autoFixAttempts >= state.maxAutoFix) return;
        state.autoFixAttempts++;

        var isBlank = state.previewErrors.some(function(e) { return e.blank; });
        var errorSummary = state.previewErrors.map(function(e) {
            return '- ' + e.message + (e.line ? ' (line ' + e.line + ')' : '');
        }).join('\n');

        var fixMessage;
        if (isBlank) {
            fixMessage = 'The generated code renders a blank page — nothing is visible. The page has no text content, no canvas/svg/images, and the body height is under 50px. This usually means the JavaScript failed silently or the DOM was never populated. Please fix the code so it renders correctly and output the complete corrected HTML.';
        } else {
            fixMessage = 'The generated code has runtime JavaScript errors:\n' + errorSummary + '\n\nPlease fix these errors and output the complete corrected HTML.';
        }

        // Insert the message and send
        els.chatInput.value = fixMessage;
        hideErrorBanner();
        sendMessage();
    }

    // ── Listen for errors from preview iframe ──
    var _errorDebounce = null;
    function initErrorListener() {
        window.addEventListener('message', function(event) {
            if (!event.data || event.data.type !== 'studio-error') return;
            // Only handle errors if we're not currently generating
            if (state.sending) return;
            // Debounce — iframe may post multiple times as errors accumulate
            clearTimeout(_errorDebounce);
            _errorDebounce = setTimeout(function() {
                handlePreviewErrors(event.data.errors);
            }, 500);
        });
    }

    function undoCode() {
        if (state.codeHistory.length === 0) return;
        state.currentCode = state.codeHistory.pop();
        updatePreview(state.currentCode);
        updateUndoBtn();
        appendMessage('system', 'Reverted to previous version.');
    }

    function updateUndoBtn() {
        var btn = document.getElementById('undoBtn');
        if (btn) {
            btn.style.display = state.codeHistory.length > 0 ? '' : 'none';
            btn.title = 'Undo (' + state.codeHistory.length + ')';
        }
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
        if (state.credits === null || !els.creditsCount) return;
        var container = document.getElementById('actionCredits');
        if (container) container.style.display = '';
        if (isAdmin()) {
            els.creditsCount.textContent = '∞';
            els.creditsCount.className = 'action-credits-count';
            return;
        }
        els.creditsCount.textContent = state.credits;
        els.creditsCount.className = 'action-credits-count' +
            (state.credits <= 0 ? ' empty' : state.credits < 10 ? ' low' : '');
    }

    // ── Image Attachments ──
    var chatAttachments = [];

    // ── Project Folder Files ──
    var projectFiles = [];
    var projectFolderName = '';

    async function handleFileSelect(files) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (!file.type.startsWith('image/')) continue;
            if (file.size > 3 * 1024 * 1024) { alert('Image too large (max 3MB)'); continue; }
            try {
                var url = await uploadFile(file);
                chatAttachments.push({ url: url, name: file.name });
                renderChatAttachPreviews();
            } catch (e) {
                console.error('Upload failed:', e);
            }
        }
        var input = document.getElementById('chatFileInput');
        if (input) input.value = '';
    }

    function uploadFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = async function () {
                try {
                    var resp = await fetch('/api/upload-asset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
                        body: JSON.stringify({ file_data: reader.result, file_name: file.name, file_type: file.type })
                    });
                    var data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || 'Upload failed');
                    resolve(data.url);
                } catch (e) { reject(e); }
            };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsDataURL(file);
        });
    }

    function renderChatAttachPreviews() {
        var container = document.getElementById('chatAttachPreview');
        if (!container) return;
        container.innerHTML = chatAttachments.map(function (a, i) {
            return '<div class="chat-attach-thumb"><img src="' + a.url + '" alt="' + a.name + '"><button class="remove-thumb" onclick="window.BuildApp.removeAttach(' + i + ')">&times;</button></div>';
        }).join('');
    }

    function removeAttach(index) {
        chatAttachments.splice(index, 1);
        renderChatAttachPreviews();
    }

    function getAttachmentPrompt() {
        if (chatAttachments.length === 0) return '';
        var lines = chatAttachments.map(function (a, i) { return (i + 1) + '. "' + a.name + '" → ' + a.url; });
        return '\n\nIMAGE ASSETS (use these URLs directly in <img> tags or as CSS background-image URLs where appropriate):\n' + lines.join('\n');
    }

    // ── Project Folder Loading ──
    var SKIP_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.vercel', '.cache', '__pycache__', '.svelte-kit'];
    var SKIP_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'];
    var BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.zip', '.pdf', '.svg', '.webp', '.avif', '.bmp', '.tiff', '.mov', '.avi', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.wasm', '.map'];
    var MAX_FILE_SIZE = 100 * 1024; // 100KB per file
    var MAX_TOTAL_SIZE = 500 * 1024; // 500KB total

    function handleFolderSelect(files) {
        if (!files || files.length === 0) return;
        projectFiles = [];
        projectFolderName = '';
        projectFilesSent = false;
        var totalSize = 0;
        var skipped = 0;

        // Determine folder name from first file's path
        var firstPath = files[0].webkitRelativePath || files[0].name;
        projectFolderName = firstPath.split('/')[0] || 'project';

        var textFiles = [];
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var path = file.webkitRelativePath || file.name;

            // Skip directories
            var parts = path.split('/');
            var skipDir = false;
            for (var j = 0; j < parts.length; j++) {
                if (SKIP_DIRS.indexOf(parts[j]) !== -1) { skipDir = true; break; }
            }
            if (skipDir) continue;

            // Skip specific files
            var fileName = parts[parts.length - 1];
            if (SKIP_FILES.indexOf(fileName) !== -1) continue;

            // Skip binary extensions
            var ext = fileName.lastIndexOf('.') !== -1 ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
            if (BINARY_EXTS.indexOf(ext) !== -1) continue;

            // Skip large files
            if (file.size > MAX_FILE_SIZE) { skipped++; continue; }

            // Check total cap
            if (totalSize + file.size > MAX_TOTAL_SIZE) { skipped++; continue; }

            totalSize += file.size;
            // Remove the top-level folder from the relative path for cleaner display
            var relativePath = parts.slice(1).join('/');
            textFiles.push({ file: file, path: relativePath || fileName });
        }

        if (textFiles.length === 0) {
            alert('No readable text files found in this folder.');
            return;
        }

        var loaded = 0;
        textFiles.forEach(function (entry) {
            var reader = new FileReader();
            reader.onload = function () {
                projectFiles.push({ path: entry.path, content: reader.result });
                loaded++;
                if (loaded === textFiles.length) {
                    // Sort by path for consistent ordering
                    projectFiles.sort(function (a, b) { return a.path.localeCompare(b.path); });
                    renderProjectPreview(skipped);
                }
            };
            reader.onerror = function () {
                loaded++;
                if (loaded === textFiles.length) {
                    projectFiles.sort(function (a, b) { return a.path.localeCompare(b.path); });
                    renderProjectPreview(skipped);
                }
            };
            reader.readAsText(entry.file);
        });

        // Reset input so same folder can be re-selected
        var input = document.getElementById('folderInput');
        if (input) input.value = '';
    }

    function renderProjectPreview(skipped) {
        var container = document.getElementById('chatAttachPreview');
        if (!container) return;
        // Keep existing image previews and add/replace project banner
        var existing = container.querySelector('.project-files-banner');
        if (existing) existing.remove();

        if (projectFiles.length === 0) return;

        var banner = document.createElement('div');
        banner.className = 'project-files-banner';
        var totalKB = 0;
        projectFiles.forEach(function (f) { totalKB += f.content.length; });
        totalKB = Math.round(totalKB / 1024);
        var text = projectFiles.length + ' file' + (projectFiles.length !== 1 ? 's' : '') + ' loaded from <strong>' + projectFolderName + '</strong> (' + totalKB + 'KB)';
        if (skipped > 0) text += ' <span style="opacity:0.6">· ' + skipped + ' skipped</span>';
        banner.innerHTML = '<span class="project-banner-icon">&#128193;</span> ' + text +
            ' <button class="project-clear-btn" onclick="window.BuildApp.clearProject()">&times;</button>';
        container.insertBefore(banner, container.firstChild);

        // Auto-preview the loaded project
        var previewHtml = buildProjectPreviewHtml();
        if (previewHtml) {
            state.currentCode = previewHtml;
            updatePreview(previewHtml);
        }
    }

    function buildProjectPreviewHtml() {
        if (projectFiles.length === 0) return null;
        // Find index.html or first .html file
        var htmlFile = null;
        for (var i = 0; i < projectFiles.length; i++) {
            if (projectFiles[i].path === 'index.html') { htmlFile = projectFiles[i]; break; }
        }
        if (!htmlFile) {
            for (var i = 0; i < projectFiles.length; i++) {
                if (projectFiles[i].path.match(/\.html$/i)) { htmlFile = projectFiles[i]; break; }
            }
        }
        if (!htmlFile) return null;

        // Build lookup map of project files by path
        var fileMap = {};
        projectFiles.forEach(function (f) { fileMap[f.path] = f.content; });

        var html = htmlFile.content;

        // Inline <link rel="stylesheet" href="X"> where X matches a project file
        html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, function (tag) {
            var hrefMatch = tag.match(/href=["']([^"']+)["']/);
            if (!hrefMatch) return tag;
            var href = hrefMatch[1].replace(/^\.\//, '');
            if (fileMap[href]) {
                return '<style>' + fileMap[href] + '</style>';
            }
            return tag;
        });

        // Inline <script src="X"> where X matches a project file
        html = html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, function (tag, src) {
            var cleanSrc = src.replace(/^\.\//, '');
            if (fileMap[cleanSrc]) {
                return '<script>' + fileMap[cleanSrc] + '<\/script>';
            }
            return tag;
        });

        return html;
    }

    function downloadProject() {
        if (!state.currentCode) return;
        var name = projectFolderName || state.title || 'project';
        name = name.replace(/[^a-zA-Z0-9_-]/g, '-');
        var blob = new Blob([state.currentCode], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function updateDownloadBtn() {
        var btn = document.getElementById('downloadBtn');
        if (btn) btn.style.display = state.currentCode ? '' : 'none';
    }

    function clearProject() {
        projectFiles = [];
        projectFolderName = '';
        projectFilesSent = false;
        var container = document.getElementById('chatAttachPreview');
        if (container) {
            var banner = container.querySelector('.project-files-banner');
            if (banner) banner.remove();
        }
    }

    var projectFilesSent = false;
    var MAX_PROJECT_CHARS = 120000; // ~30K tokens — safe limit

    function getProjectPrompt() {
        if (projectFiles.length === 0) return '';
        // Only send raw project files on the first message; after that current_code carries the state
        if (projectFilesSent) return '';
        projectFilesSent = true;

        var lines = ['\n\nPROJECT FILES (loaded from user\'s local folder "' + projectFolderName + '"):'];
        var totalChars = 0;
        for (var i = 0; i < projectFiles.length; i++) {
            var header = '--- ' + projectFiles[i].path + ' ---\n';
            var content = projectFiles[i].content;
            if (totalChars + header.length + content.length > MAX_PROJECT_CHARS) {
                lines.push('\n[... ' + (projectFiles.length - i) + ' more files omitted — project too large for single prompt]');
                break;
            }
            totalChars += header.length + content.length;
            lines.push(header + content);
        }
        return lines.join('\n');
    }

    // ── Model Selector ──
    var MODEL_INFO = {
        gemini: { label: 'Gemini Flash', free: true, cost: 0 },
        llama: { label: 'Llama 70B', free: true, cost: 0 },
        kimi: { label: 'Kimi K2', free: true, cost: 0 },
        fast: { label: 'Haiku', free: false, cost: 10 },
        standard: { label: 'Sonnet', free: false, cost: 50 },
        pro: { label: 'Opus', free: false, cost: 100 }
    };

    function setModel(tier) {
        var info = MODEL_INFO[tier] || MODEL_INFO.gemini;
        // Require login for paid models
        if (!info.free && !isLoggedIn()) {
            appendMessage('assistant', 'Log in to use ' + info.label + '. Or try a free model like Gemini Flash.');
            var selector = document.getElementById('modelSelector');
            if (selector) selector.classList.remove('open');
            return;
        }
        state.selectedModel = tier;
        // Update dropup items
        var items = document.querySelectorAll('.model-dropup-item');
        items.forEach(function (item) {
            item.classList.toggle('active', item.getAttribute('data-model') === tier);
        });
        // Update trigger button
        var info = MODEL_INFO[tier] || MODEL_INFO.gemini;
        var triggerName = document.getElementById('modelTriggerName');
        var triggerBadge = document.getElementById('modelTriggerBadge');
        if (triggerName) triggerName.textContent = info.label;
        if (triggerBadge) {
            triggerBadge.textContent = info.free ? 'Free' : info.cost + ' cr';
            triggerBadge.className = 'trigger-badge ' + (info.free ? 'free' : 'pro');
        }
        // Close menu
        var selector = document.getElementById('modelSelector');
        if (selector) selector.classList.remove('open');
    }

    function toggleModelMenu() {
        var selector = document.getElementById('modelSelector');
        if (!selector) return;
        var isOpening = !selector.classList.contains('open');
        selector.classList.toggle('open');
        // On mobile, position the fixed dropup above the trigger
        if (isOpening && window.innerWidth <= 768) {
            var dropup = document.getElementById('modelDropup');
            var trigger = document.getElementById('modelTrigger');
            if (dropup && trigger) {
                var rect = trigger.getBoundingClientRect();
                dropup.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
            }
        }
    }

    // Close dropup when clicking outside
    document.addEventListener('click', function (e) {
        var selector = document.getElementById('modelSelector');
        if (selector && !selector.contains(e.target)) {
            selector.classList.remove('open');
        }
    });

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
        if (nameEl) nameEl.value = state.title !== 'New App' ? state.title : '';
        if (descEl) descEl.value = '';

        els.publishSlug.value = '';
        els.publishResult.innerHTML = '';
        els.publishConfirm.disabled = true;
        els.slugPreview.textContent = 'inclawbate.app/s/...';

        // Show/hide delete button
        var delBtn = document.getElementById('publishDeleteBtn');
        if (delBtn) delBtn.style.display = state.editingApp ? '' : 'none';

        // Editing existing app — pre-fill and lock slug
        if (state.editingApp) {
            if (nameEl) nameEl.value = state.editingApp.name || '';
            if (descEl) descEl.value = state.editingApp.description || '';
            els.publishSlug.value = state.editingApp.slug || '';
            els.publishSlug.readOnly = true;
            els.publishSlug.style.opacity = '0.6';
            var catEl = document.getElementById('publishCategory');
            if (catEl) catEl.value = state.editingApp.category || 'other';
            var tagsEl = document.getElementById('publishTags');
            if (tagsEl) tagsEl.value = state.editingApp.tags || '';
            var paidEl = document.getElementById('publishPaid');
            var priceRowEl = document.getElementById('publishPriceRow');
            var priceEl = document.getElementById('publishPrice');
            if (state.editingApp.claws_price > 0) {
                if (paidEl) paidEl.checked = true;
                if (priceRowEl) priceRowEl.classList.add('visible');
                if (priceEl) priceEl.value = state.editingApp.claws_price;
            }
            onSlugInput();
            if (nameEl) nameEl.focus();
            return;
        }

        // Auto-generate slug from title
        if (state.title && state.title !== 'New App') {
            var autoSlug = state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
            els.publishSlug.value = autoSlug;
            onSlugInput();
        }

        els.publishSlug.readOnly = false;
        els.publishSlug.style.opacity = '';
        if (nameEl) nameEl.focus();
    }

    function closePublish() {
        els.publishOverlay.classList.remove('active');
    }

    function onSlugInput() {
        var raw = els.publishSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
        els.publishSlug.value = raw;
        els.slugPreview.textContent = raw ? 'inclawbate.app/s/' + raw : 'inclawbate.app/s/...';
        els.publishConfirm.disabled = !raw || raw.length < 2;
    }

    async function deletePublishedApp() {
        if (!state.editingApp || !state.editingApp.slug) return;
        if (!confirm('Delete "' + (state.editingApp.name || state.editingApp.slug) + '"? This cannot be undone.')) return;

        var profile = getProfile();
        var email = profile && profile.x_handle ? profile.x_handle + '@inclawbate.app' : 'anonymous@inclawbate.app';

        els.publishResult.innerHTML = 'Deleting...';
        els.publishResult.className = 'publish-result';

        try {
            var resp = await fetch(PUBLISH_API, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: state.editingApp.slug, email: email })
            });
            var data = await resp.json();
            if (data.success) {
                state.editingApp = null;
                els.publishResult.innerHTML = 'App deleted.';
                els.publishResult.className = 'publish-result';
                var delBtn = document.getElementById('publishDeleteBtn');
                if (delBtn) delBtn.style.display = 'none';
                setTimeout(function() { closePublish(); }, 1200);
            } else {
                els.publishResult.textContent = data.error || 'Failed to delete.';
                els.publishResult.className = 'publish-result error';
            }
        } catch (e) {
            els.publishResult.textContent = 'Network error. Try again.';
            els.publishResult.className = 'publish-result error';
        }
    }

    function onPaidToggle() {
        var paid = document.getElementById('publishPaid');
        var priceRow = document.getElementById('publishPriceRow');
        if (paid && priceRow) {
            priceRow.classList.toggle('visible', paid.checked);
            if (paid.checked) {
                var input = document.getElementById('publishPrice');
                if (input) setTimeout(function () { input.focus(); }, 100);
            }
        }
    }

    async function publish() {
        var slug = els.publishSlug.value.trim();
        if (!slug || !state.currentCode) return;

        els.publishConfirm.disabled = true;
        els.publishResult.innerHTML = 'Publishing...';
        els.publishResult.className = 'publish-result';

        var profile = getProfile();
        var email = profile && profile.x_handle ? profile.x_handle + '@inclawbate.app' : '';

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
                    email: email || undefined,
                    description: appDesc || 'Built with Inclawbate Build Studio',
                    update: state.editingApp ? true : undefined,
                    source: state.editingApp ? 'build-studio-edit' : (state.forkedFrom ? 'build-studio-fork' : 'build-studio'),
                    category: category,
                    claws_price: priceVal,
                    creator_wallet: creatorWallet,
                    creator_x_handle: creatorXHandle,
                    user_id: profile && profile.id ? profile.id : null,
                    tags: tags,
                    is_listed: isListed,
                    forked_from_user_app: state.forkedFrom ? state.forkedFrom.app_id : null,
                    revenue_split: state.forkedFrom ? 80 : 100
                })
            });

            var data = await resp.json();

            if (data.success) {
                var storeLink = isListed ? ' | <a href="/apps" target="_blank">View in App Store</a>' : '';
                var nudge = '';
                if (!isLoggedIn()) {
                    // Save slug to localStorage so we can claim it after wallet connect
                    try {
                        var pending = JSON.parse(localStorage.getItem('inclawbate_pending_apps') || '[]');
                        if (pending.indexOf(slug) === -1) pending.push(slug);
                        localStorage.setItem('inclawbate_pending_apps', JSON.stringify(pending));
                    } catch (e) {}
                    nudge = '<div class="publish-nudge">' +
                        '<p>Want to edit this app later and save your projects?</p>' +
                        '<button class="publish-nudge-btn" onclick="window.BuildApp.connectWalletFromNudge()">Connect Wallet to Save</button>' +
                        '<p class="publish-nudge-nowallet">Don\'t have a wallet? Get one free in 60 seconds:</p>' +
                        '<div class="publish-nudge-links">' +
                            '<a href="https://www.coinbase.com/wallet" target="_blank">Coinbase Wallet</a>' +
                            '<a href="https://wallet.base.org" target="_blank">Base Wallet</a>' +
                        '</div>' +
                        '<p class="publish-nudge-reassure">Your app is already live — come back anytime and connect to claim it.</p>' +
                        '</div>';
                }
                els.publishResult.innerHTML = 'Live at <a href="' + data.url + '" target="_blank">' + data.url + '</a>' + storeLink + nudge;
                els.publishResult.className = 'publish-result';

                // Track as editing app so re-publish sends update: true
                if (!state.editingApp) {
                    state.editingApp = {
                        slug: slug,
                        name: (document.getElementById('publishName') || {}).value || state.title,
                        description: (document.getElementById('publishDesc') || {}).value || '',
                        category: (document.getElementById('publishCategory') || {}).value || 'other',
                        tags: (document.getElementById('publishTags') || {}).value || '',
                        claws_price: parseFloat((document.getElementById('publishPrice') || {}).value) || 0
                    };
                    // Lock slug field for future publishes
                    els.publishSlug.readOnly = true;
                    els.publishSlug.style.opacity = '0.6';
                    // Show delete button now that app exists
                    var delBtn = document.getElementById('publishDeleteBtn');
                    if (delBtn) delBtn.style.display = '';
                }

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
    var buyState = { clawsPerCredit: 0, selectedAmount: 250, clawsPrice: 0 };

    function switchBuyTab(tab) {
        var btnCredits = document.getElementById('buyTabBtnCredits');
        var btnSubscribe = document.getElementById('buyTabBtnSubscribe');
        var tabCredits = document.getElementById('buyTabCredits');
        var tabSubscribe = document.getElementById('buyTabSubscribe');
        if (!btnCredits || !tabCredits) return;
        btnCredits.classList.toggle('active', tab === 'credits');
        btnSubscribe.classList.toggle('active', tab === 'subscribe');
        tabCredits.classList.toggle('active', tab === 'credits');
        tabSubscribe.classList.toggle('active', tab === 'subscribe');
    }

    var TIER_CREDITS = { spark: 1500, builder: 5000, studio: 15000 };

    async function selectSubscription(tier) {
        var credits = TIER_CREDITS[tier];
        if (!credits) return;

        var card = document.querySelector('.sub-tier-card[onclick*="' + tier + '"]');
        var btn = card ? card.querySelector('.sub-tier-btn') : null;
        if (btn) { btn.disabled = true; btn.textContent = 'Redirecting...'; }

        try {
            var resp = await fetch('/api/inclawbate/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('inclawbate_token') },
                body: JSON.stringify({ credits: credits, return_path: '/build' })
            });
            var data = await resp.json();
            if (resp.ok && data.url) {
                window.location.href = data.url;
            } else {
                els.buyResult.textContent = data.error || 'Failed to start checkout.';
                if (btn) { btn.disabled = false; btn.textContent = 'Choose ' + tier.charAt(0).toUpperCase() + tier.slice(1); }
            }
        } catch (e) {
            els.buyResult.textContent = 'Network error. Try again.';
            if (btn) { btn.disabled = false; btn.textContent = 'Choose ' + tier.charAt(0).toUpperCase() + tier.slice(1); }
        }
    }

    async function openBuyCredits() {
        switchBuyTab('credits');
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
        var bHaiku = document.getElementById('breakdownHaiku');
        var bSonnet = document.getElementById('breakdownSonnet');
        var bOpus = document.getElementById('breakdownOpus');
        var cardIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
        if (!amount || !buyState.clawsPerCredit) {
            els.buyCostValue.textContent = '--';
            els.buySendBtn.disabled = true;
            if (els.buyCardBtn) {
                els.buyCardBtn.disabled = true;
                els.buyCardBtn.innerHTML = cardIcon + 'Pay with Card';
            }
            if (bHaiku) bHaiku.textContent = '--';
            if (bSonnet) bSonnet.textContent = '--';
            if (bOpus) bOpus.textContent = '--';
            return;
        }
        var totalClaws = amount * buyState.clawsPerCredit;
        var totalUsd = (amount * 0.005).toFixed(2);
        els.buyCostValue.textContent = totalClaws.toLocaleString() + ' CLAWS (~$' + totalUsd + ')';
        els.buySendBtn.disabled = false;
        // Update card button — minimum 100 credits ($0.50 Stripe floor)
        if (els.buyCardBtn) {
            if (amount >= 100) {
                els.buyCardBtn.disabled = false;
                els.buyCardBtn.innerHTML = cardIcon + 'Pay with Card — $' + totalUsd;
            } else {
                els.buyCardBtn.disabled = true;
                els.buyCardBtn.innerHTML = cardIcon + 'Card min $0.50 (100 credits)';
            }
        }
        if (bHaiku) bHaiku.textContent = Math.floor(amount / 10) + ' msgs';
        if (bSonnet) bSonnet.textContent = Math.floor(amount / 50) + ' msgs';
        if (bOpus) bOpus.textContent = Math.floor(amount / 100) + ' msgs';
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

    async function scanDeposits() {
        if (!window.ethereum) {
            els.buyResult.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
            els.buyResult.className = 'buy-result error';
            return;
        }

        var scanLink = document.getElementById('scanDepositsLink');
        if (scanLink) scanLink.style.pointerEvents = 'none';
        els.buyResult.textContent = 'Scanning chain for uncredited deposits...';
        els.buyResult.className = 'buy-result';

        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var wallet = accounts[0];

            var resp = await fetch('/api/inclawbate/credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({ action: 'scan-deposits', wallet: wallet })
            });
            var result = await resp.json();

            if (!resp.ok) {
                els.buyResult.textContent = result.error || 'Scan failed.';
                els.buyResult.className = 'buy-result error';
            } else if (result.credited > 0) {
                els.buyResult.textContent = 'Found ' + result.new_deposits + ' uncredited deposit(s) — +' + result.credited + ' credits added! Balance: ' + result.credits_total;
                els.buyResult.className = 'buy-result success';
                state.credits = result.credits_total;
                updateCredits();
                if (els.buyCurrentBalance) els.buyCurrentBalance.textContent = result.credits_total + ' credits';
            } else if (result.found > 0) {
                els.buyResult.textContent = 'Found ' + result.found + ' deposit(s), all already credited. No new credits to add.';
                els.buyResult.className = 'buy-result';
            } else {
                els.buyResult.textContent = 'No CLAWS deposits found from this wallet in the last ~3 hours.';
                els.buyResult.className = 'buy-result';
            }
        } catch (e) {
            els.buyResult.textContent = e.message || 'Scan failed.';
            els.buyResult.className = 'buy-result error';
        } finally {
            if (scanLink) scanLink.style.pointerEvents = '';
        }
    }

    // ── Pay with Card (Stripe) ──
    async function buyWithCard() {
        var amount = buyState.selectedAmount;
        if (!amount || amount < 100) return;

        els.buyCardBtn.disabled = true;
        els.buyResult.innerHTML = '';

        try {
            var resp = await fetch('/api/inclawbate/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({ credits: amount })
            });
            var data = await resp.json();

            if (resp.ok && data.url) {
                window.location.href = data.url;
            } else {
                els.buyResult.textContent = data.error || 'Failed to start checkout.';
                els.buyResult.className = 'buy-result error';
                els.buyCardBtn.disabled = false;
            }
        } catch (e) {
            els.buyResult.textContent = 'Network error. Try again.';
            els.buyResult.className = 'buy-result error';
            els.buyCardBtn.disabled = false;
        }
    }

    // ── Payment Return Handler ──
    function checkPaymentReturn() {
        var params = new URLSearchParams(window.location.search);
        var payment = params.get('payment');
        if (!payment) return;

        // Clean URL
        var clean = window.location.pathname;
        history.replaceState(null, '', clean);

        if (payment === 'success') {
            var credits = params.get('credits');
            var msg = credits ? 'Payment successful! ' + credits + ' credits are being added.' : 'Payment successful! Credits are being added.';
            setTimeout(function () {
                alert(msg);
                fetchCredits();
            }, 300);
        }
    }

    // ── Refreshable Welcome Prompts ──
    function pickRandomIndices(poolSize, count, exclude) {
        var indices = [];
        var avoid = exclude || [];
        // Try to pick indices not in the exclude list
        var attempts = 0;
        while (indices.length < count && attempts < 200) {
            var r = Math.floor(Math.random() * poolSize);
            if (indices.indexOf(r) === -1 && avoid.indexOf(r) === -1) indices.push(r);
            attempts++;
        }
        // If pool is too small to fully avoid, fill remaining from any unused index
        if (indices.length < count && indices.length < poolSize) {
            for (var i = 0; i < poolSize && indices.length < count; i++) {
                if (indices.indexOf(i) === -1) indices.push(i);
            }
        }
        return indices;
    }

    function renderWelcomePrompts(category) {
        var container = document.getElementById('chatHeaderPrompts');
        if (!container) return;

        var pool = category && CATEGORY_PROMPTS[category] ? CATEGORY_PROMPTS[category] : STARTER_PROMPTS;

        // Remove existing prompt buttons (keep the shuffle button and category label)
        var existing = container.querySelectorAll('.build-welcome-prompt');
        existing.forEach(function (el) {
            el.classList.add('fade-out');
        });

        // Remove old category label
        var oldLabel = container.querySelector('.cap-category-label');
        if (oldLabel) oldLabel.remove();

        setTimeout(function () {
            container.querySelectorAll('.build-welcome-prompt').forEach(function (el) { el.remove(); });

            currentPromptIndices = pickRandomIndices(pool.length, 3, currentPromptIndices);

            var shuffleBtn = container.querySelector('.shuffle-prompts-btn');

            // Add category label if filtered
            if (category) {
                var names = { apis: 'Live APIs', wallet: 'CLAWS Wallet', canvas: 'Canvas & WebGL', appdb: 'AppDb', images: 'Image Assets', web3: 'Web3 / DeFi', audio: 'Audio & Speech', libraries: 'Libraries' };
                var label = document.createElement('div');
                label.className = 'cap-category-label';
                label.innerHTML = names[category] + ' ideas <button onclick="window.BuildApp.selectCap(null)">Show all</button>';
                container.insertBefore(label, shuffleBtn);
            }

            currentPromptIndices.forEach(function (idx, i) {
                var btn = document.createElement('button');
                btn.className = 'build-welcome-prompt fade-in';
                btn.style.animationDelay = (i * 0.08) + 's';
                btn.textContent = pool[idx];
                btn.addEventListener('click', function () { usePrompt(pool[idx]); });
                container.insertBefore(btn, shuffleBtn);
            });
        }, existing.length > 0 ? 200 : 0);
    }

    var CAP_DESCRIPTIONS = {
        apis: 'Fetch live data from any public API — crypto prices, weather, news, and more.',
        wallet: 'Accept CLAWS payments, tip jars, paywalls, and token-gated features.',
        canvas: 'Build games, animations, and visualizations with Canvas and WebGL.',
        appdb: 'Persistent database for your app — leaderboards, user accounts, shared data.',
        images: 'Upload and display your own images — portfolios, galleries, product pages.',
        web3: 'Token swaps, wallet dashboards, on-chain data, and DeFi interfaces.',
        audio: 'Sound effects, text-to-speech, voice recording, and music visualizers.',
        libraries: 'Use Chart.js, Three.js, Leaflet, and other popular libraries via CDN.'
    };

    function selectCap(category) {
        var expandEl = document.getElementById('capExpand');
        var innerEl = document.getElementById('capExpandInner');

        // Toggle: click same pill again = collapse
        if (category === activeCategory) {
            activeCategory = null;
            if (expandEl) expandEl.classList.remove('open');
            var items = document.querySelectorAll('.cap-pill');
            items.forEach(function (item) { item.classList.remove('active'); });
            var promptsEl = document.getElementById('chatHeaderPrompts');
            if (promptsEl) promptsEl.style.display = '';
            renderWelcomePrompts(null);
            return;
        }

        activeCategory = category;
        lastShownIndices = [];

        // Toggle active state on pills
        var items = document.querySelectorAll('.cap-pill');
        items.forEach(function (item) {
            item.classList.toggle('active', category && item.getAttribute('data-cap') === category);
        });

        if (category && expandEl && innerEl) {
            var pool = CATEGORY_PROMPTS[category] || [];
            var indices = pickRandomIndices(pool.length, 3, lastShownIndices);
            lastShownIndices = indices;
            var desc = CAP_DESCRIPTIONS[category] || '';

            var html = '<div class="cap-expand-desc">' + desc + '</div>';
            html += '<div class="cap-expand-prompts">';
            indices.forEach(function (idx) {
                html += '<button class="cap-expand-prompt" onclick="window.BuildApp.useCapPrompt(\'' + pool[idx].replace(/'/g, "\\'") + '\')">' + pool[idx] + '</button>';
            });
            html += '</div>';
            html += '<button class="cap-expand-shuffle" onclick="window.BuildApp.shuffleCapExpand()">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
            html += ' Shuffle</button>';

            innerEl.innerHTML = html;
            expandEl.classList.add('open');
        } else if (expandEl) {
            expandEl.classList.remove('open');
        }

        // Hide welcome prompts when accordion is open, show when collapsed
        var promptsEl = document.getElementById('chatHeaderPrompts');
        if (category && promptsEl) {
            promptsEl.style.display = 'none';
        } else if (promptsEl) {
            promptsEl.style.display = '';
            renderWelcomePrompts(null);
        }
    }

    function useCapPrompt(text) {
        usePrompt(text);
    }

    function shuffleCapExpand() {
        if (!activeCategory) return;
        // Force re-render of expand panel with new random prompts
        var savedCat = activeCategory;
        activeCategory = null; // Temporarily clear so selectCap doesn't toggle off
        selectCap(savedCat);
    }

    function shufflePrompts() {
        renderWelcomePrompts(activeCategory);
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
        if (!window.ethereum && window._awaitProvider) await window._awaitProvider();
        if (!window.ethereum) {
            alert('No wallet detected. Install MetaMask, Coinbase Wallet, or Base Wallet.');
            return;
        }

        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var address = accounts[0];

            var resp = await fetch('/api/inclawbate/wallet-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: address })
            });

            var data = await resp.json();

            if (!resp.ok || !data.success) {
                alert(data.error || 'Wallet connection failed. Please try again.');
                return;
            }

            localStorage.setItem('inclawbate_token', data.token);
            localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));

            fetchCredits();
            await claimPendingApps();
            loadProjects();
        } catch (e) {
            if (e.code === 4001) return; // user rejected
            alert('Wallet connection failed. Please try again.');
        }
    }

    async function connectWalletFromNudge() {
        if (!window.ethereum && window._awaitProvider) await window._awaitProvider();
        if (!window.ethereum) {
            alert('No wallet detected. Install MetaMask, Coinbase Wallet, or Base Wallet.');
            return;
        }
        try {
            var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            var resp = await fetch('/api/inclawbate/wallet-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: accounts[0] })
            });
            var data = await resp.json();
            if (!resp.ok || !data.success) {
                alert(data.error || 'Wallet connection failed.');
                return;
            }
            localStorage.setItem('inclawbate_token', data.token);
            localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
            fetchCredits();

            // Claim any pending anonymous apps
            await claimPendingApps();

            // Update the nudge area to show success
            var nudgeEl = document.querySelector('.publish-nudge');
            if (nudgeEl) nudgeEl.innerHTML = '<p style="color:var(--seafoam-300)">Account connected! Your app is linked to your account.</p>';
        } catch (e) {
            if (e.code === 4001) return;
            alert('Wallet connection failed.');
        }
    }

    async function claimPendingApps() {
        try {
            var pending = JSON.parse(localStorage.getItem('inclawbate_pending_apps') || '[]');
            if (!pending.length) return;
            var token = getToken();
            if (!token) return;
            var resp = await fetch('/api/inclawbate/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ action: 'claim_anonymous', slugs: pending })
            });
            var data = await resp.json();
            if (data.claimed) localStorage.removeItem('inclawbate_pending_apps');
        } catch (e) { /* non-critical */ }
    }

    // ── Go Back ──
    function goBack() {
        if (!isLoggedIn()) {
            newProject();
            return;
        }
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

    // ── Client-side HTML extraction (fallback for streaming) ──
    function extractHtmlClient(text) {
        var match = text.match(/```html\s*([\s\S]*?)```/);
        if (match) return match[1].trim();
        var generic = text.match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);
        if (generic) return generic[1].trim();
        var generic2 = text.match(/```\s*(<html[\s\S]*?)```/i);
        if (generic2) return generic2[1].trim();
        var truncated = text.match(/```html\s*([\s\S]+)/);
        if (truncated) return truncated[1].trim();
        var truncGen = text.match(/```\s*(<!DOCTYPE[\s\S]+)/i);
        if (truncGen) return truncGen[1].trim();
        var rawHtml = text.match(/(<!DOCTYPE\s+html[\s\S]*<\/html>)/i);
        if (rawHtml) return rawHtml[1].trim();
        return null;
    }

    // ── Escape HTML ──
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Variable pricing hints ──
    function showVariablePricingHints() {
        var costs = document.querySelectorAll('.model-cost');
        costs.forEach(function (el) {
            var text = el.textContent.trim();
            if (!text.includes('+')) {
                el.textContent = text.replace(' cr', '+ cr');
            }
        });
    }

    // ── Edit Detection ──
    function checkEditSource() {
        try {
            var raw = sessionStorage.getItem('edit_source');
            if (!raw) return false;
            sessionStorage.removeItem('edit_source');
            var edit = JSON.parse(raw);
            if (!edit.code) return false;

            state.editingApp = { id: edit.app_id, slug: edit.slug, name: edit.name, description: edit.description || '', category: edit.category || 'other', tags: edit.tags || '', claws_price: edit.claws_price || 0 };
            state.currentCode = edit.code;
            state.title = edit.name || 'Untitled App';

            showView('build');
            els.buildTitle.textContent = state.title;
            if (els.chatHeaderArea) els.chatHeaderArea.style.display = 'none';
            updatePreview(state.currentCode);
            appendMessage('assistant', 'Editing "' + (edit.name || 'App') + '". Make changes and hit Publish to update.');
            showVariablePricingHints();
            return true;
        } catch (e) { return false; }
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
            if (els.chatHeaderArea) els.chatHeaderArea.style.display = 'none';
            updatePreview(state.currentCode);
            appendMessage('assistant', 'Forked from "' + (fork.name || 'App') + '". The code is loaded in preview — edit it with chat or publish directly.');
            showVariablePricingHints();
            return true;
        } catch (e) { return false; }
    }

    // ── Load app from ?app=slug URL param (for Inclawbator integration) ──
    function checkAppParam() {
        try {
            var params = new URLSearchParams(window.location.search);
            var slug = params.get('app');
            if (!slug) return false;

            // Clean URL
            history.replaceState(null, '', window.location.pathname);

            // Fetch the app's code from serve-site API
            appendMessage('assistant', 'Loading "' + slug + '"...');
            fetch('/api/serve-site?slug=' + encodeURIComponent(slug) + '&raw=1')
                .then(function(r) { return r.text(); })
                .then(function(code) {
                    if (!code || code.length < 50) {
                        appendMessage('assistant', 'Could not load app "' + slug + '". It may not exist.');
                        return;
                    }
                    // Also fetch app metadata
                    fetch('/api/inclawbate/apps?slug=' + encodeURIComponent(slug))
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            var app = (data.apps || [])[0] || {};
                            state.editingApp = {
                                slug: slug,
                                name: app.name || slug,
                                description: app.description || '',
                                category: app.category || 'other',
                                tags: app.tags || '',
                                claws_price: app.claws_price || 0
                            };
                            state.currentCode = code;
                            state.title = app.name || slug;
                            showView('build');
                            els.buildTitle.textContent = state.title;
                            if (els.chatHeaderArea) els.chatHeaderArea.style.display = 'none';
                            updatePreview(code);
                            appendMessage('assistant', 'Editing "' + (app.name || slug) + '". Describe what you want to change, or pick a model and start building.');
                            showVariablePricingHints();
                        })
                        .catch(function() {
                            // Metadata fetch failed but we have the code
                            state.editingApp = { slug: slug, name: slug };
                            state.currentCode = code;
                            state.title = slug;
                            showView('build');
                            updatePreview(code);
                            appendMessage('assistant', 'Editing "' + slug + '". Describe what you want to change.');
                        });
                })
                .catch(function() {
                    appendMessage('assistant', 'Could not load app "' + slug + '". Try again.');
                });

            return true;
        } catch (e) { return false; }
    }

    // ── Onboarding Tooltips ──
    var onboardSteps = [
        {
            target: 'chatInput',
            text: 'Describe what you want to build in plain English. Be as specific as you like — the more detail, the better the result.',
            position: 'top',
            highlight: true
        },
        {
            target: '.model-selector',
            text: '<strong>Pick your AI model.</strong> Haiku is fast and free-friendly. Sonnet is balanced. Pro (Opus) gives the best results for complex apps.',
            position: 'top',
            highlight: true
        },
        {
            target: 'chatSend',
            text: 'Hit this button or press <strong>Enter</strong> to send. The AI will build your app — it may take 30 seconds to a couple minutes for complex requests.',
            position: 'top',
            highlight: true
        },
        {
            target: '.preview-panel',
            text: 'Your app appears here as a <strong>live preview</strong>. You can keep chatting to make changes — just describe what to tweak.',
            position: 'left',
            highlight: false
        },
        {
            target: 'publishBtn',
            text: 'When you\'re happy, hit <strong>Publish</strong> to get a real URL you can share with anyone. No account needed!',
            position: 'top',
            highlight: true
        }
    ];

    var onboardIndex = 0;
    var onboardActive = false;

    function shouldShowOnboarding() {
        return !localStorage.getItem('inclawbate_onboard_done');
    }

    function startOnboarding() {
        if (!shouldShowOnboarding()) return;
        onboardIndex = 0;
        onboardActive = true;
        showOnboardStep();
    }

    function showOnboardStep() {
        // Remove any existing tooltip
        var existing = document.querySelector('.onboard-tip');
        if (existing) existing.remove();
        // Remove highlights
        document.querySelectorAll('.onboard-highlight').forEach(function(el) {
            el.classList.remove('onboard-highlight');
        });

        if (onboardIndex >= onboardSteps.length) {
            finishOnboarding();
            return;
        }

        var step = onboardSteps[onboardIndex];
        var targetEl = step.target.charAt(0) === '.'
            ? document.querySelector(step.target)
            : document.getElementById(step.target);

        if (!targetEl) { onboardIndex++; showOnboardStep(); return; }

        if (step.highlight) targetEl.classList.add('onboard-highlight');

        var tip = document.createElement('div');
        tip.className = 'onboard-tip';
        tip.innerHTML =
            '<div class="onboard-tip-arrow ' + (step.position === 'top' ? 'bottom' : 'top') + '"></div>' +
            '<div class="onboard-tip-step">Step ' + (onboardIndex + 1) + ' of ' + onboardSteps.length + '</div>' +
            '<p class="onboard-tip-text">' + step.text + '</p>' +
            '<div class="onboard-tip-actions">' +
                '<button class="onboard-tip-next" onclick="window.BuildApp.onboardNext()">' +
                    (onboardIndex < onboardSteps.length - 1 ? 'Next' : 'Got it!') +
                '</button>' +
                '<button class="onboard-tip-skip" onclick="window.BuildApp.onboardSkip()">Skip tour</button>' +
            '</div>';

        document.body.appendChild(tip);

        // Position the tooltip
        var rect = targetEl.getBoundingClientRect();
        if (step.position === 'top') {
            tip.style.left = Math.max(12, rect.left) + 'px';
            tip.style.top = (rect.top - tip.offsetHeight - 12 + window.scrollY) + 'px';
        } else {
            tip.style.left = Math.max(12, rect.left - tip.offsetWidth - 12) + 'px';
            tip.style.top = (rect.top + window.scrollY) + 'px';
        }

        // Clamp to viewport
        var tipRect = tip.getBoundingClientRect();
        if (tipRect.right > window.innerWidth - 12) {
            tip.style.left = (window.innerWidth - tipRect.width - 12) + 'px';
        }
        if (tipRect.top < 0) {
            tip.style.top = (rect.bottom + 12 + window.scrollY) + 'px';
            var arrow = tip.querySelector('.onboard-tip-arrow');
            if (arrow) { arrow.className = 'onboard-tip-arrow top'; }
        }
    }

    function onboardNext() {
        onboardIndex++;
        showOnboardStep();
    }

    function onboardSkip() {
        finishOnboarding();
    }

    function finishOnboarding() {
        onboardActive = false;
        localStorage.setItem('inclawbate_onboard_done', '1');
        var existing = document.querySelector('.onboard-tip');
        if (existing) existing.remove();
        document.querySelectorAll('.onboard-highlight').forEach(function(el) {
            el.classList.remove('onboard-highlight');
        });
    }

    // ── Init ──
    function init() {
        cacheDom();
        setupInput();
        renderWelcomePrompts();
        initErrorListener();

        if (!isLoggedIn()) {
            // Skip auth gate — go straight to builder for anonymous use
            newProject();
            setTimeout(startOnboarding, 600);
            return;
        }

        // Fetch credits on load
        fetchCredits();

        // Check Angel NFT status
        (function checkAngel() {
            var p = getProfile();
            if (p && p.wallet_address) {
                fetch('/api/inclawbate/angel-check?wallet=' + encodeURIComponent(p.wallet_address))
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        if (d.isAngel) {
                            state.isAngelHolder = true;
                            updateCredits();
                        }
                    })
                    .catch(function() {});
            }
        })();

        // Handle Stripe payment return
        checkPaymentReturn();

        // Check if we're loading from an edit, fork, or ?app=slug param
        if (checkEditSource()) return;
        if (checkForkSource()) return;
        if (checkAppParam()) return;

        loadProjects();
    }

    // ── Incubation Request ──
    var incubationTier = 'incubation';

    function openIncubation(tier) {
        incubationTier = tier || 'incubation';
        var overlay = document.getElementById('incubationOverlay');
        if (!overlay) return;

        // Update tier card selection
        var cards = overlay.querySelectorAll('.incubation-tier-card');
        cards.forEach(function(c) { c.classList.toggle('selected', c.dataset.tier === incubationTier); });

        // Pre-fill project name from session title
        var nameInput = document.getElementById('incReqName');
        if (nameInput && state.title && state.title !== 'New App') {
            nameInput.value = state.title;
        }

        // Pre-fill description with session context
        var descInput = document.getElementById('incReqDesc');
        if (descInput) {
            var ctx = '';
            if (state.previewErrors.length > 0) {
                ctx = 'Auto-fix couldn\'t resolve these errors:\n' +
                    state.previewErrors.map(function(e) { return '- ' + e.message; }).join('\n') + '\n\n';
            }
            if (state.sessionId) ctx += 'Build session: ' + state.sessionId + '\n';
            descInput.value = ctx;
        }

        // Reset result
        var result = document.getElementById('incReqResult');
        if (result) { result.style.display = 'none'; result.textContent = ''; }

        var btn = document.getElementById('incReqSubmit');
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }

        overlay.classList.add('active');
    }

    function closeIncubation() {
        var overlay = document.getElementById('incubationOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function selectIncubationTier(tier) {
        incubationTier = tier;
        var overlay = document.getElementById('incubationOverlay');
        if (!overlay) return;
        var cards = overlay.querySelectorAll('.incubation-tier-card');
        cards.forEach(function(c) { c.classList.toggle('selected', c.dataset.tier === tier); });
    }

    async function submitIncubation() {
        var name = (document.getElementById('incReqName').value || '').trim();
        var desc = (document.getElementById('incReqDesc').value || '').trim();
        var contactMethod = document.getElementById('incReqContact').value;
        var handle = (document.getElementById('incReqHandle').value || '').trim();
        var btn = document.getElementById('incReqSubmit');
        var result = document.getElementById('incReqResult');

        if (!name) { result.style.display = 'block'; result.style.color = '#f87171'; result.textContent = 'Please enter a project name.'; return; }
        if (!handle) { result.style.display = 'block'; result.style.color = '#f87171'; result.textContent = 'Please enter your contact handle.'; return; }

        btn.disabled = true;
        btn.textContent = 'Submitting...';

        // Build description with session context
        var fullDesc = desc;
        fullDesc += '\n\n--- TIER ---\n' + (incubationTier === 'super' ? 'Super Incubation' : 'Incubation');
        if (state.sessionId) fullDesc += '\n\n--- BUILD SESSION ---\nbuild_session_id: ' + state.sessionId;
        fullDesc += '\n\n--- CONTACT ---\n' + contactMethod + ': ' + handle;

        var profile = getProfile();
        var wallet = profile && profile.wallet_address ? profile.wallet_address : null;
        var xHandle = contactMethod === 'x_dms' ? handle.replace(/^@/, '') : '';
        var telegram = contactMethod === 'telegram' ? handle : '';

        try {
            var token = getToken();
            var resp = await fetch('/api/inclawbate/inclawbator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    action: 'register',
                    token_name: name,
                    description: fullDesc,
                    x_handle: xHandle,
                    telegram_url: telegram,
                    fee_split_bps: 10000,
                    tier: 'incubated',
                    creator_wallet: wallet || ''
                })
            });

            var data = await resp.json();
            if (data.error) {
                result.style.display = 'block';
                result.style.color = '#f87171';
                result.textContent = 'Failed: ' + data.error;
                btn.disabled = false;
                btn.textContent = 'Submit Request';
                return;
            }

            result.style.display = 'block';
            result.style.color = '#a5b4fc';
            result.textContent = 'Application submitted! We\'ll review and reach out within 48 hours with a quote.';
            btn.textContent = 'Submitted!';
            setTimeout(closeIncubation, 3000);
        } catch (e) {
            result.style.display = 'block';
            result.style.color = '#f87171';
            result.textContent = 'Error: ' + (e.message || 'Unknown error');
            btn.disabled = false;
            btn.textContent = 'Submit Request';
        }
    }

    // ── Mobile Tab Switching ──
    function switchMobileTab(tab) {
        var chatPanel = document.querySelector('.chat-panel');
        var previewPanel = document.querySelector('.preview-panel');
        var tabBar = document.getElementById('mobileTabBar');
        if (!chatPanel || !previewPanel || !tabBar) return;

        var tabs = tabBar.querySelectorAll('button');
        tabs.forEach(function(t) { t.classList.remove('active'); });

        if (tab === 'preview') {
            chatPanel.classList.add('mobile-hidden');
            previewPanel.classList.remove('mobile-hidden');
            tabs[1].classList.add('active');
            // Sync iframe visibility with current code state
            switchTab('preview');
            // Clear badge
            var badge = document.getElementById('previewBadge');
            if (badge) badge.classList.remove('visible');
        } else {
            previewPanel.classList.add('mobile-hidden');
            chatPanel.classList.remove('mobile-hidden');
            tabs[0].classList.add('active');
        }
    }

    function showPreviewBadge() {
        if (window.innerWidth > 768) return;
        // Auto-switch to preview when AI finishes generating code
        switchMobileTab('preview');
    }

    // ── Expose Public API ──
    window.BuildApp = {
        newProject: newProject,
        startNew: startNew,
        send: sendMessage,
        goBack: goBack,
        setModel: setModel,
        toggleModelMenu: toggleModelMenu,
        switchTab: switchTab,
        undoCode: undoCode,
        openPublish: openPublish,
        closePublish: closePublish,
        onSlugInput: onSlugInput,
        onPaidToggle: onPaidToggle,
        publish: publish,
        deletePublishedApp: deletePublishedApp,
        openBuyCredits: openBuyCredits,
        closeBuyCredits: closeBuyCredits,
        switchBuyTab: switchBuyTab,
        selectSubscription: selectSubscription,
        pickCredits: pickCredits,
        onCustomCredits: onCustomCredits,
        sendClawsTx: sendClawsTx,
        scanDeposits: scanDeposits,
        buyWithCard: buyWithCard,
        usePrompt: usePrompt,
        shufflePrompts: shufflePrompts,
        connectWallet: connectWallet,
        connectWalletFromNudge: connectWalletFromNudge,
        onboardNext: onboardNext,
        onboardSkip: onboardSkip,
        handleFileSelect: handleFileSelect,
        removeAttach: removeAttach,
        handleFolderSelect: handleFolderSelect,
        clearProject: clearProject,
        downloadProject: downloadProject,
        selectCap: selectCap,
        useCapPrompt: useCapPrompt,
        shuffleCapExpand: shuffleCapExpand,
        autoFix: autoFix,
        openIncubation: openIncubation,
        closeIncubation: closeIncubation,
        selectIncubationTier: selectIncubationTier,
        submitIncubation: submitIncubation,
        switchMobileTab: switchMobileTab
    };

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
