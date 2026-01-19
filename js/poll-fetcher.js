/**
 * Poll Fetcher - Embeds the latest POLL tweet from @getSUITE on X
 * Tries API first to find actual polls, falls back to timeline embed
 */

(function() {
    'use strict';

    const TWITTER_HANDLE = 'getsuiteapp';

    // API endpoints - tries production first, then local
    const API_URLS = [
        'https://cadence.getsuite.app/api/twitter/latest-poll',
        'http://localhost:3000/api/twitter/latest-poll'
    ];

    async function fetchAndEmbedPoll() {
        const voteCard = document.querySelector('.vote-card');
        if (!voteCard) return;

        // Show loading state
        voteCard.innerHTML = `
            <span class="card-label">VOTE ON NEXT APP</span>
            <div style="display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666;">
                Loading latest poll...
            </div>
        `;
        addEmbedStyles();

        // Try API endpoints to get the specific poll tweet
        for (const apiUrl of API_URLS) {
            try {
                const response = await fetch(apiUrl, {
                    signal: AbortSignal.timeout(5000),
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) continue;

                const data = await response.json();

                if (data.success && data.tweetId) {
                    console.log('Found poll tweet via API:', data.tweetId);
                    embedSpecificTweet(voteCard, data.tweetId);
                    return;
                }
            } catch (e) {
                console.warn('API failed:', apiUrl, e.message);
                continue;
            }
        }

        // If all APIs failed, fall back to timeline embed
        console.log('APIs unavailable, falling back to timeline embed');
        embedTimeline(voteCard);
    }

    function embedSpecificTweet(container, tweetId) {
        container.innerHTML = `
            <span class="card-label">VOTE ON NEXT APP</span>
            <div class="tweet-embed-wrapper">
                <blockquote class="twitter-tweet" data-theme="light" data-conversation="none" data-cards="hidden">
                    <a href="https://twitter.com/${TWITTER_HANDLE}/status/${tweetId}"></a>
                </blockquote>
            </div>
        `;

        loadTwitterWidgets();
    }

    function embedTimeline(container) {
        // Show a nice placeholder when no poll is available
        container.innerHTML = `
            <span class="card-label">VOTE ON NEXT APP</span>
            <div class="poll-placeholder">
                <div class="poll-placeholder-icon">🗳️</div>
                <div class="poll-placeholder-text">
                    <h3>Poll Coming Soon</h3>
                    <p>Follow <a href="https://twitter.com/${TWITTER_HANDLE}" target="_blank" rel="noopener">@${TWITTER_HANDLE}</a> to vote on the next app!</p>
                </div>
                <a href="https://twitter.com/${TWITTER_HANDLE}" target="_blank" rel="noopener" class="poll-follow-btn">
                    Follow on X →
                </a>
            </div>
        `;
    }

    function loadTwitterWidgets() {
        if (!window.twttr) {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.onload = () => {
                if (window.twttr && window.twttr.widgets) {
                    window.twttr.widgets.load();
                }
            };
            document.head.appendChild(script);
        } else {
            window.twttr.widgets.load();
        }
    }

    function addEmbedStyles() {
        if (document.getElementById('poll-embed-styles')) return;

        const style = document.createElement('style');
        style.id = 'poll-embed-styles';
        style.textContent = `
            .vote-card {
                min-height: 320px;
            }
            .vote-card .card-label {
                display: inline-block;
                background: linear-gradient(135deg, var(--accent-purple, #a855f7), var(--accent-pink, #ff6b9d));
                color: white;
                padding: 4px 12px;
                border-radius: 100px;
                font-size: 0.65rem;
                font-weight: 800;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
            }
            .tweet-embed-wrapper,
            .twitter-timeline-wrapper {
                border-radius: 12px;
                overflow: hidden;
                background: white;
                min-height: 200px;
            }
            .tweet-embed-wrapper .twitter-tweet,
            .twitter-timeline-wrapper .twitter-timeline {
                margin: 0 !important;
            }
            .poll-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px 20px;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                text-align: center;
                min-height: 200px;
            }
            .poll-placeholder-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .poll-placeholder-text h3 {
                margin: 0 0 8px 0;
                font-size: 1.1rem;
                font-weight: 600;
                color: #333;
            }
            .poll-placeholder-text p {
                margin: 0;
                font-size: 0.9rem;
                color: #666;
            }
            .poll-placeholder-text a {
                color: #1da1f2;
                text-decoration: none;
            }
            .poll-placeholder-text a:hover {
                text-decoration: underline;
            }
            .poll-follow-btn {
                display: inline-block;
                margin-top: 20px;
                padding: 10px 24px;
                background: #1da1f2;
                color: white;
                text-decoration: none;
                border-radius: 20px;
                font-weight: 500;
                font-size: 0.9rem;
                transition: background 0.2s ease;
            }
            .poll-follow-btn:hover {
                background: #0d8ed9;
                text-decoration: none;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchAndEmbedPoll);
    } else {
        fetchAndEmbedPoll();
    }

    // Expose for manual refresh
    window.refreshPoll = fetchAndEmbedPoll;

})();
