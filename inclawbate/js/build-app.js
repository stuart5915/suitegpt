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
        codeHistory: [],
        credits: null,
        sending: false,
        title: 'New Project',
        forkedFrom: null,  // { app_id, name } if forked
        editingApp: null,  // { id, slug, name } if editing existing app
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
                    '<div class="project-card-preview"></div>' +
                    '<div class="project-card-info">' +
                        '<div class="project-card-title">' + escapeHtml(s.title) + '</div>' +
                        '<div class="project-card-meta">' + date + pub + '</div>' +
                    '</div>' +
                    '<button type="button" class="project-card-delete" title="Delete project">&times;</button>';

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
            els.projectsList.innerHTML = '<div class="projects-empty"><p>Failed to load projects.</p></div>';
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

            // If session has no code and no messages, it was likely interrupted
            if (!data.session.current_code && (!data.messages || data.messages.length === 0)) {
                appendMessage('assistant', 'This session was interrupted before it could finish. Type your prompt again to continue building.');
                if (els.chatHeaderArea) els.chatHeaderArea.style.display = '';
            }

            scrollChat();
        } catch (e) {
            els.buildTitle.textContent = 'Error loading session';
        }
    }

    // ── New Project ──
    function newProject() {
        state.sessionId = null;
        state.currentCode = null;
        state.codeHistory = [];
        updateUndoBtn();
        state.title = 'New Project';
        // Remove chat messages but re-show welcome
        var msgs = els.chatMessages.querySelectorAll('.chat-msg');
        msgs.forEach(function (m) { m.remove(); });
        removeSuggestionChips();
        if (els.chatHeaderArea) els.chatHeaderArea.style.display = '';
        els.buildTitle.textContent = 'New Project';
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

            var hasSurcharge = estimate.estimated_surcharge > 0;
            var codeSize = state.currentCode ? (state.currentCode.length / 1024).toFixed(0) + 'KB' : '';
            var rows = '';

            if (hasSurcharge) {
                rows =
                    '<div class="cost-row"><span>Base cost</span><span>' + estimate.base_credits + ' credits</span></div>' +
                    '<div class="cost-row extra"><span>Context surcharge (est.)</span><span>+' + estimate.estimated_surcharge + ' credits</span></div>' +
                    '<div class="cost-row total"><span>Estimated total</span><span>~' + estimate.estimated_credits + ' credits</span></div>';
            } else {
                rows =
                    '<div class="cost-row total"><span>Cost per message</span><span>' + estimate.base_credits + ' credits</span></div>';
            }

            var overlay = document.createElement('div');
            overlay.className = 'cost-confirm-overlay active';
            overlay.innerHTML =
                '<div class="cost-confirm-modal">' +
                    '<h3>Editing ' + (codeSize ? codeSize + ' app' : 'existing app') + '</h3>' +
                    '<p class="cost-confirm-desc">Larger apps use more tokens and may cost extra credits per message.</p>' +
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

        // Gate: show cost confirmation for first message when editing/forking existing code
        if (!state.sessionId && state.currentCode) {
            var estimate = await estimateEditCost();
            if (estimate) {
                var confirmed = await showCostConfirmation(estimate);
                if (!confirmed) return; // user cancelled — message stays in input
            }
        }

        state.sending = true;
        els.chatInput.value = '';
        els.chatInput.style.height = 'auto';
        els.chatSend.disabled = true;

        // Show user message
        removeSuggestionChips();
        appendMessage('user', message);

        // Optimistic credit deduction — backend charges upfront too
        var tierCost = { fast: 10, standard: 25, pro: 50 }[state.selectedModel] || 10;
        if (state.credits !== null) {
            state.credits = Math.max(0, state.credits - tierCost);
            updateCredits();
        }

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
            var fullMessage = message + getAttachmentPrompt();

            var resp = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify(Object.assign({
                    session_id: state.sessionId,
                    message: fullMessage,
                    model: state.selectedModel
                }, !state.sessionId && state.currentCode ? { current_code: state.currentCode } : {}))
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
                if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
                var data = await resp.json();
                if (resp.status === 401) { logout(); return; }
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

            while (true) {
                var chunk = await reader.read();
                if (chunk.done) break;

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
                            if (evt.title && state.title === 'New Project') {
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

            // Remove thinking indicator
            clearInterval(thinkingInterval);
            if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
            var finalCode = doneData ? doneData.code : extractHtmlClient(streamedText);

            // Guard: if response is just metadata (model ID, etc.) and no code, treat as error
            var stripped = streamedText.replace(/```html[\s\S]*?```/g, '').trim();
            if (!finalCode && stripped.length < 80 && /^model:\s/i.test(stripped)) {
                streamedText = 'Something went wrong — the AI returned an empty response. Please try again.';
            }

            appendMessage('assistant', streamedText, finalCode);

            if (doneData) {
                if (doneData.credits_remaining !== undefined) {
                    state.credits = doneData.credits_remaining;
                    updateCredits();
                }
                if (doneData.surcharge > 0) {
                    var notice = document.createElement('div');
                    notice.className = 'chat-msg system-notice';
                    notice.textContent = 'Context surcharge: +' + doneData.surcharge + ' credits (' + doneData.credits_charged + ' total)';
                    els.chatMessages.appendChild(notice);
                    scrollChat();
                }
            }

            if (finalCode) {
                if (state.currentCode) {
                    state.codeHistory.push(state.currentCode);
                    if (state.codeHistory.length > 20) state.codeHistory.shift();
                    updateUndoBtn();
                }
                state.currentCode = finalCode;
                updatePreview(finalCode);
                setTimeout(showSuggestionChips, 400);
            }

        } catch (e) {
            clearInterval(thinkingInterval);
            if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
            var errMsg = 'Network error. Please try again.';
            if (e && e.message && e.message.includes('504')) {
                errMsg = 'Request timed out — the app may be too complex. Try a simpler change or start fresh.';
            }
            appendMessage('assistant', errMsg);
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
        if (state.credits === null) return;
        els.creditsCount.textContent = state.credits;
        els.creditsCount.className = 'action-credits-count' +
            (state.credits <= 0 ? ' empty' : state.credits < 10 ? ' low' : '');
    }

    // ── Image Attachments ──
    var chatAttachments = [];

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

    // ── Model Selector ──
    function setModel(tier) {
        state.selectedModel = tier;
        var btns = document.querySelectorAll('.model-option');
        btns.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-model') === tier);
        });
        var hint = document.getElementById('modelHint');
        if (hint) {
            var hints = { fast: 'Haiku — fast & lightweight', standard: 'Sonnet — balanced quality', pro: 'Opus — maximum detail' };
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
        if (state.title && state.title !== 'New Project') {
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
        els.slugPreview.textContent = raw ? 'inclawbate.com/s/' + raw : 'inclawbate.com/s/...';
        els.publishConfirm.disabled = !raw || raw.length < 2;
    }

    async function deletePublishedApp() {
        if (!state.editingApp || !state.editingApp.slug) return;
        if (!confirm('Delete "' + (state.editingApp.name || state.editingApp.slug) + '"? This cannot be undone.')) return;

        var profile = getProfile();
        var email = (profile && profile.x_handle ? profile.x_handle + '@inclawbate.com' : 'build@inclawbate.com');

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
                els.publishResult.innerHTML = 'Live at <a href="' + data.url + '" target="_blank">' + data.url + '</a>' + storeLink;
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
        if (bSonnet) bSonnet.textContent = Math.floor(amount / 25) + ' msgs';
        if (bOpus) bOpus.textContent = Math.floor(amount / 50) + ' msgs';
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

    // ── Client-side HTML extraction (fallback for streaming) ──
    function extractHtmlClient(text) {
        var match = text.match(/```html\s*([\s\S]*?)```/);
        if (match) return match[1].trim();
        // Fallback for truncated responses (no closing ```)
        var truncated = text.match(/```html\s*([\s\S]+)/);
        return truncated ? truncated[1].trim() : null;
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

        // Handle Stripe payment return
        checkPaymentReturn();

        // Check if we're loading from an edit or fork
        if (checkEditSource()) return;
        if (checkForkSource()) return;

        loadProjects();
    }

    // ── Expose Public API ──
    window.BuildApp = {
        newProject: newProject,
        startNew: startNew,
        send: sendMessage,
        goBack: goBack,
        setModel: setModel,
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
        handleFileSelect: handleFileSelect,
        removeAttach: removeAttach,
        selectCap: selectCap,
        useCapPrompt: useCapPrompt,
        shuffleCapExpand: shuffleCapExpand
    };

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
