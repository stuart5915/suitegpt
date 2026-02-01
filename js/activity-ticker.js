/**
 * Activity Ticker - Fetches real GitHub activity for SUITE apps
 * Populates the ticker with recent commits and releases
 */

(function() {
    'use strict';

    // GitHub username and repos to track
    const GITHUB_USER = 'stuart5915';
    const REPOS = [
        { repo: 'cadence-ai-nextjs', appName: 'Cadence AI', emoji: 'clay-sparkles.png', link: 'https://suitegpt.app/apps' },
        { repo: 'foodvitals-expo-source', appName: 'FoodVitals', emoji: 'clay-rocket.png', link: 'https://suitegpt.app/apps' },
        { repo: 'foodvitals-flutter', appName: 'FoodVitals', emoji: 'clay-rocket.png', link: 'https://suitegpt.app/apps' },
    ];

    // Map app names to site links
    const APP_LINKS = {
        'Cadence AI': 'https://suitegpt.app/apps',
        'FoodVitals': 'https://suitegpt.app/apps',
        'OpticRep': 'https://suitegpt.app/apps',
        'TrueForm': 'https://suitegpt.app/apps',
        'Cheshbon': 'https://suitegpt.app/apps',
        'RemCast': 'https://suitegpt.app/apps',
        'SUITE Platform': 'index.html',
        'default': 'https://suitegpt.app/apps'
    };

    // Map commit message keywords to display formats
    const COMMIT_FORMATTERS = [
        { match: /^add\s+/i, format: (msg, app) => `"${cleanMessage(msg)}" added to <span class="user">${app}</span>`, emoji: 'clay-sparkles.png' },
        { match: /^fix\s+/i, format: (msg, app) => `Bug fix shipped for <span class="user">${app}</span>`, emoji: 'clay-wrench.png' },
        { match: /^update\s+/i, format: (msg, app) => `<span class="user">${app}</span> updated: ${cleanMessage(msg)}`, emoji: 'clay-gear.png' },
        { match: /^remove\s+/i, format: (msg, app) => `Cleanup in <span class="user">${app}</span>`, emoji: 'clay-trophy.png' },
        { match: /^polish\s+/i, format: (msg, app) => `<span class="user">${app}</span> polished`, emoji: 'clay-sparkles.png' },
        { match: /^refactor\s+/i, format: (msg, app) => `<span class="user">${app}</span> refactored`, emoji: 'clay-gear.png' },
        { match: /./, format: (msg, app) => `<span class="user">${app}</span>: ${cleanMessage(msg)}`, emoji: 'clay-rocket.png' }
    ];

    // Clean up commit message for display
    function cleanMessage(msg) {
        // Remove common prefixes
        let clean = msg
            .replace(/^(add|fix|update|remove|polish|refactor)\s+/i, '')
            .replace(/^(feat|chore|docs|style|test)(\(.+?\))?:\s*/i, '');

        // Capitalize first letter
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);

        // Truncate if too long
        if (clean.length > 50) {
            clean = clean.substring(0, 47) + '...';
        }

        return clean;
    }

    // Format a commit into a ticker item
    function formatCommit(commit, appName) {
        const msg = commit.commit.message.split('\n')[0]; // First line only

        for (const formatter of COMMIT_FORMATTERS) {
            if (formatter.match.test(msg)) {
                return {
                    html: formatter.format(msg, appName),
                    emoji: formatter.emoji
                };
            }
        }

        return {
            html: `<span class="user">${appName}</span>: ${cleanMessage(msg)}`,
            emoji: 'clay-rocket.png'
        };
    }

    // Format relative time
    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    // Fetch commits from GitHub
    async function fetchCommits(repo) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${GITHUB_USER}/${repo}/commits?per_page=5`,
                { headers: { 'Accept': 'application/vnd.github.v3+json' } }
            );

            if (!response.ok) {
                console.warn(`Failed to fetch commits for ${repo}:`, response.status);
                return [];
            }

            return await response.json();
        } catch (error) {
            console.warn(`Error fetching commits for ${repo}:`, error);
            return [];
        }
    }

    // Create ticker item HTML
    function createTickerItem(formatted, link = 'https://suitegpt.app/apps') {
        return `
            <a href="${link}" class="ticker-item">
                <img src="assets/emojis/${formatted.emoji}" alt="" class="ticker-emoji">
                ${formatted.html}
            </a>
        `;
    }

    // Main function to load activity
    async function loadActivity() {
        const tickerTrack = document.querySelector('.ticker-track');
        if (!tickerTrack) {
            console.warn('Ticker track not found');
            return;
        }

        // Collect all commits from all repos
        const allItems = [];

        for (const { repo, appName, emoji, link } of REPOS) {
            const commits = await fetchCommits(repo);

            for (const commit of commits) {
                const formatted = formatCommit(commit, appName);
                // Use the app's site link, not GitHub
                const siteLink = APP_LINKS[appName] || APP_LINKS['default'];
                allItems.push({
                    date: new Date(commit.commit.author.date),
                    html: createTickerItem(formatted, siteLink),
                    formatted
                });
            }
        }

        // Sort by date (newest first)
        allItems.sort((a, b) => b.date - a.date);

        // Take top 10 items
        const topItems = allItems.slice(0, 10);

        if (topItems.length === 0) {
            console.warn('No activity items found, keeping placeholder content');
            return;
        }

        // Generate ticker HTML (duplicate for seamless loop)
        const itemsHtml = topItems.map(item => item.html).join('');
        tickerTrack.innerHTML = itemsHtml + itemsHtml; // Duplicate for seamless scrolling

        console.log(`Loaded ${topItems.length} activity items into ticker`);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadActivity);
    } else {
        loadActivity();
    }

    // Expose for manual refresh
    window.refreshActivityTicker = loadActivity;

})();
