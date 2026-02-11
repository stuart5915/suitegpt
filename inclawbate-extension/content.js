// Content script — injected on x.com
// Adds reply buttons to tweets and handles hotkey triggers

(function () {
    'use strict';

    const BUTTON_CLASS = 'inclawbate-reply-btn';
    const PANEL_CLASS = 'inclawbate-panel';
    let activePanel = null;
    let activeTweetArticle = null;
    let hoveredTweet = null;

    // Track which tweet the mouse is over
    document.addEventListener('mouseover', (e) => {
        const article = e.target.closest('article[data-testid="tweet"]');
        if (article) hoveredTweet = article;
    });

    // Listen for hotkey from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'generate-reply-hotkey') {
            if (hoveredTweet) {
                handleTweetReply(hoveredTweet);
            }
        }
    });

    // Inject buttons on tweets via MutationObserver
    function injectButtons() {
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        tweets.forEach((tweet) => {
            if (tweet.querySelector(`.${BUTTON_CLASS}`)) return;

            const actionBar = tweet.querySelector('[role="group"]');
            if (!actionBar) return;

            const btn = document.createElement('button');
            btn.className = BUTTON_CLASS;
            btn.innerHTML = '🦞';
            btn.title = 'Generate reply with Inclawbate (Alt+R)';

            // Use capture phase to beat X's event handling
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleTweetReply(tweet);
            }, true);

            // Also handle mousedown as backup
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            actionBar.appendChild(btn);
        });
    }

    // Extract tweet data from DOM
    function extractTweetData(article) {
        const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
        const tweetText = tweetTextEl ? tweetTextEl.innerText : '';

        // Get author handle
        const userLinks = article.querySelectorAll('a[role="link"]');
        let tweetAuthor = '';
        for (const link of userLinks) {
            const href = link.getAttribute('href');
            if (href && href.match(/^\/[a-zA-Z0-9_]+$/) && !href.includes('/status/')) {
                tweetAuthor = href.slice(1);
                break;
            }
        }

        // Try to get thread context (parent tweets above this one)
        let threadContext = '';
        const timeline = article.closest('[data-testid="cellInnerDiv"]')?.parentElement;
        if (timeline) {
            const allArticles = timeline.querySelectorAll('article[data-testid="tweet"]');
            const texts = [];
            for (const a of allArticles) {
                if (a === article) break;
                const t = a.querySelector('[data-testid="tweetText"]');
                if (t) texts.push(t.innerText);
            }
            if (texts.length > 0) {
                threadContext = texts.slice(-3).join('\n---\n');
            }
        }

        return { tweetText, tweetAuthor, threadContext };
    }

    // Main handler
    async function handleTweetReply(article) {
        const data = extractTweetData(article);
        if (!data.tweetText) return;

        // Close any existing panel
        closePanel();

        activeTweetArticle = article;

        // Show loading panel (fixed overlay)
        const panel = createPanel();
        panel.querySelector('.inclawbate-panel-body').innerHTML =
            '<div class="inclawbate-loading"><span class="inclawbate-spinner"></span> Generating reply...</div>';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generate-reply',
                data
            });

            if (!response || response.error) {
                panel.querySelector('.inclawbate-panel-body').innerHTML =
                    `<div class="inclawbate-error">Error: ${response?.error || 'No response from background'}</div>`;
                return;
            }

            showReplyPanel(panel, response.reply, article);
        } catch (err) {
            panel.querySelector('.inclawbate-panel-body').innerHTML =
                `<div class="inclawbate-error">Error: ${err.message}</div>`;
        }
    }

    // Create fixed-position overlay panel
    function createPanel() {
        const overlay = document.createElement('div');
        overlay.className = 'inclawbate-overlay';

        const panel = document.createElement('div');
        panel.className = PANEL_CLASS;
        panel.innerHTML = `
            <div class="inclawbate-panel-header">
                <span>🦞 Inclawbate</span>
                <button class="inclawbate-panel-close">&times;</button>
            </div>
            <div class="inclawbate-panel-body"></div>
        `;

        panel.querySelector('.inclawbate-panel-close').addEventListener('click', closePanel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePanel();
        });

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        activePanel = overlay;
        return panel;
    }

    // Show the generated reply with actions
    function showReplyPanel(panel, reply, article) {
        const body = panel.querySelector('.inclawbate-panel-body');
        body.innerHTML = `
            <textarea class="inclawbate-reply-text" rows="4">${escapeHtml(reply)}</textarea>
            <div class="inclawbate-char-count"><span class="inclawbate-count-num">${reply.length}</span>/280</div>
            <div class="inclawbate-panel-actions">
                <button class="inclawbate-btn inclawbate-btn-insert">Insert Reply</button>
                <button class="inclawbate-btn inclawbate-btn-copy">Copy</button>
                <button class="inclawbate-btn inclawbate-btn-regen">Regenerate</button>
            </div>
        `;

        const textarea = body.querySelector('.inclawbate-reply-text');
        const countEl = body.querySelector('.inclawbate-count-num');

        textarea.addEventListener('input', () => {
            countEl.textContent = textarea.value.length;
            countEl.style.color = textarea.value.length > 280 ? '#ef4444' : '';
        });

        // Insert into X's reply composer
        body.querySelector('.inclawbate-btn-insert').addEventListener('click', () => {
            insertReply(article, textarea.value);
            closePanel();
        });

        // Copy to clipboard
        body.querySelector('.inclawbate-btn-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(textarea.value);
            const btn = body.querySelector('.inclawbate-btn-copy');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });

        // Regenerate
        body.querySelector('.inclawbate-btn-regen').addEventListener('click', () => {
            handleTweetReply(article);
        });

        // Focus the textarea so user can edit immediately
        textarea.focus();
        textarea.select();
    }

    // Insert reply text into X's reply composer
    function insertReply(article, text) {
        const replyBtn = article.querySelector('[data-testid="reply"]');
        if (replyBtn) {
            replyBtn.click();

            // Wait for composer to appear, retry a few times
            let attempts = 0;
            const tryInsert = () => {
                const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
                if (composer) {
                    composer.focus();
                    document.execCommand('insertText', false, text);
                } else if (attempts < 10) {
                    attempts++;
                    setTimeout(tryInsert, 200);
                } else {
                    navigator.clipboard.writeText(text);
                }
            };
            setTimeout(tryInsert, 300);
        } else {
            navigator.clipboard.writeText(text);
        }
    }

    function closePanel() {
        if (activePanel) {
            activePanel.remove();
            activePanel = null;
            activeTweetArticle = null;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Watch for new tweets and inject buttons
    const observer = new MutationObserver(() => {
        injectButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial injection
    injectButtons();

    // Close panel on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });
})();
