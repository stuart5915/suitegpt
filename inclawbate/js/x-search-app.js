// X Search — Frontend Logic
// Search tweets, engage (like/retweet/reply), AI-generated replies

import { isLoggedIn } from '/js/x-auth-client.js';

const API = '/api/inclawbate/x-search';

// ── State ──
let credits = 0;
let searchResults = [];
let activeDrawer = null; // tweet id of open reply drawer

// ── DOM refs ──
const loginGate = document.getElementById('loginGate');
const mainContent = document.getElementById('mainContent');
const creditBadge = document.getElementById('creditBadge');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchStatus = document.getElementById('searchStatus');
const searchLoading = document.getElementById('searchLoading');
const searchFeed = document.getElementById('searchFeed');
const minLikesSlider = document.getElementById('filterMinLikes');
const minLikesVal = document.getElementById('minLikesVal');

// ── Init ──
(async function init() {
    if (!isLoggedIn()) {
        loginGate.classList.remove('hidden');
        document.body.style.opacity = '1';
        return;
    }

    // Logged in — fetch credits
    const token = localStorage.getItem('inclawbate_token');
    try {
        const res = await fetch('/api/inclawbate/credits', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            const data = await res.json();
            credits = data.credits || 0;
        }
    } catch (e) { /* credits stay 0 */ }

    creditBadge.textContent = credits;
    mainContent.classList.remove('hidden');
    document.body.style.opacity = '1';
})();

// ── Helpers ──
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
}

function formatNumber(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function highlightText(text) {
    // Highlight @mentions and #hashtags
    return escHtml(text)
        .replace(/@(\w+)/g, '<span class="xs-mention">@$1</span>')
        .replace(/#(\w+)/g, '<span class="xs-hashtag">#$1</span>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" onclick="event.stopPropagation()">$1</a>');
}

function getAuthHeaders() {
    const token = localStorage.getItem('inclawbate_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

function updateCredits(newCredits) {
    credits = newCredits;
    creditBadge.textContent = credits;
}

function showToast(message, type) {
    const existing = document.querySelector('.toast-success, .toast-error');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = type === 'error' ? 'toast-error' : 'toast-success';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ── Filters ──
function getFilters() {
    const timePill = document.querySelector('[data-filter="time"] .xs-filter-pill.active');
    return {
        time_range: timePill ? timePill.dataset.value : '24h',
        verified: document.getElementById('filterVerified').classList.contains('active'),
        has_media: document.getElementById('filterMedia').classList.contains('active'),
        exclude_replies: document.getElementById('filterNoReplies').classList.contains('active'),
        exclude_retweets: document.getElementById('filterNoRTs').classList.contains('active'),
        min_likes: parseInt(minLikesSlider.value) || 0
    };
}

// Time range pills
document.querySelector('[data-filter="time"]').addEventListener('click', (e) => {
    const pill = e.target.closest('.xs-filter-pill');
    if (!pill) return;
    document.querySelectorAll('[data-filter="time"] .xs-filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
});

// Toggle buttons
['filterVerified', 'filterMedia', 'filterNoReplies', 'filterNoRTs'].forEach(id => {
    document.getElementById(id).addEventListener('click', function () {
        this.classList.toggle('active');
    });
});

// Min likes slider
minLikesSlider.addEventListener('input', () => {
    minLikesVal.textContent = minLikesSlider.value;
});

// ── Search ──
async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    if (credits <= 0) {
        searchStatus.innerHTML = 'You need credits to search. <a href="/deposit" style="color:var(--lobster-300);">Buy credits</a> to get started.';
        searchStatus.className = 'xs-status';
        searchStatus.classList.remove('hidden');
        return;
    }

    const filters = getFilters();
    searchFeed.innerHTML = '';
    searchStatus.classList.add('hidden');
    searchLoading.classList.remove('hidden');
    searchBtn.disabled = true;

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                action: 'search',
                query,
                time_range: filters.time_range,
                verified_only: filters.verified,
                has_media: filters.has_media,
                exclude_replies: filters.exclude_replies,
                exclude_retweets: filters.exclude_retweets,
                max_results: 100
            })
        });

        const data = await res.json();

        if (!res.ok) {
            searchStatus.textContent = data.error || 'Search failed';
            searchStatus.className = 'xs-status error';
            searchStatus.classList.remove('hidden');
            searchLoading.classList.add('hidden');
            searchBtn.disabled = false;
            return;
        }

        searchResults = data.tweets || [];
        if (data.credits !== undefined) updateCredits(data.credits);

        // Apply client-side min likes filter
        const minLikes = filters.min_likes;
        const filtered = minLikes > 0
            ? searchResults.filter(t => (t.public_metrics?.like_count || 0) >= minLikes)
            : searchResults;

        renderTweets(filtered);
    } catch (err) {
        searchStatus.textContent = 'Network error. Try again.';
        searchStatus.className = 'xs-status error';
        searchStatus.classList.remove('hidden');
    }

    searchLoading.classList.add('hidden');
    searchBtn.disabled = false;
}

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
});

// Re-filter when min likes changes (client-side only)
minLikesSlider.addEventListener('change', () => {
    if (!searchResults.length) return;
    const minLikes = parseInt(minLikesSlider.value) || 0;
    const filtered = minLikes > 0
        ? searchResults.filter(t => (t.public_metrics?.like_count || 0) >= minLikes)
        : searchResults;
    renderTweets(filtered);
});

// ── Render ──
function renderTweets(tweets) {
    searchFeed.innerHTML = '';

    if (!tweets.length) {
        searchStatus.textContent = 'No tweets found matching your criteria.';
        searchStatus.className = 'xs-status';
        searchStatus.classList.remove('hidden');
        return;
    }

    searchStatus.classList.add('hidden');

    tweets.forEach(tweet => {
        const author = tweet.author || {};
        const metrics = tweet.public_metrics || {};
        const isVerified = author.verified;
        const tweetUrl = 'https://x.com/' + (author.username || 'x') + '/status/' + tweet.id;

        const card = document.createElement('div');
        card.className = 'xs-tweet';
        card.dataset.tweetId = tweet.id;

        card.innerHTML = `
            <div class="xs-tweet-author">
                <img class="xs-tweet-avatar" src="${escHtml(author.profile_image_url || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
                <div class="xs-tweet-author-info">
                    <div class="xs-tweet-name">
                        ${escHtml(author.name || 'Unknown')}
                        ${isVerified ? '<span class="xs-tweet-verified" title="Verified">&#10003;</span>' : ''}
                    </div>
                    <div class="xs-tweet-handle">@${escHtml(author.username || '')}</div>
                </div>
                <div style="text-align:right;">
                    ${author.public_metrics?.followers_count ? '<div class="xs-tweet-followers">' + formatNumber(author.public_metrics.followers_count) + ' followers</div>' : ''}
                    <div class="xs-tweet-time">${timeAgo(tweet.created_at)}</div>
                </div>
            </div>
            <div class="xs-tweet-text" onclick="window.open('${escHtml(tweetUrl)}','_blank')">${highlightText(tweet.text || '')}</div>
            <div class="xs-tweet-metrics">
                <span class="xs-metric">&#10084; ${formatNumber(metrics.like_count)}</span>
                <span class="xs-metric">&#128257; ${formatNumber(metrics.retweet_count)}</span>
                <span class="xs-metric">&#128172; ${formatNumber(metrics.reply_count)}</span>
                <span class="xs-metric">&#10077; ${formatNumber(metrics.quote_count)}</span>
            </div>
            <div class="xs-tweet-actions">
                <button class="xs-action-btn like-btn" data-tweet-id="${tweet.id}">&#10084;&#65039; Like</button>
                <button class="xs-action-btn rt-btn" data-tweet-id="${tweet.id}">&#128260; Retweet</button>
                <button class="xs-action-btn reply-btn" data-tweet-id="${tweet.id}">&#128172; Reply</button>
                <button class="xs-action-btn ai-reply-btn" data-tweet-id="${tweet.id}">&#129302; AI Reply <span class="xs-action-cost">(1 credit)</span></button>
            </div>
            <div class="xs-reply-drawer" id="drawer-${tweet.id}">
                <textarea class="xs-reply-textarea" id="reply-text-${tweet.id}" placeholder="Write your reply..." maxlength="280"></textarea>
                <div class="xs-reply-footer">
                    <span class="xs-reply-charcount" id="charcount-${tweet.id}">0/280</span>
                    <div class="xs-reply-btns">
                        <button class="btn btn-ghost btn-sm regen-btn hidden" data-tweet-id="${tweet.id}">Regenerate (1 credit)</button>
                        <button class="btn btn-primary btn-sm send-reply-btn" data-tweet-id="${tweet.id}">Send Reply</button>
                    </div>
                </div>
            </div>
        `;

        searchFeed.appendChild(card);
    });

    // Wire up events
    wireActions();
}

// ── Wire action buttons ──
function wireActions() {
    // Like
    searchFeed.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', () => handleLike(btn));
    });

    // Retweet
    searchFeed.querySelectorAll('.rt-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRetweet(btn));
    });

    // Reply (manual)
    searchFeed.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', () => openReplyDrawer(btn.dataset.tweetId, false));
    });

    // AI Reply
    searchFeed.querySelectorAll('.ai-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => openReplyDrawer(btn.dataset.tweetId, true));
    });

    // Send reply
    searchFeed.querySelectorAll('.send-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => handleSendReply(btn.dataset.tweetId));
    });

    // Regenerate
    searchFeed.querySelectorAll('.regen-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAiReply(btn.dataset.tweetId));
    });

    // Character counts
    searchFeed.querySelectorAll('.xs-reply-textarea').forEach(ta => {
        ta.addEventListener('input', () => {
            const tweetId = ta.id.replace('reply-text-', '');
            const cc = document.getElementById('charcount-' + tweetId);
            cc.textContent = ta.value.length + '/280';
            cc.className = ta.value.length > 280 ? 'xs-reply-charcount over' : 'xs-reply-charcount';
        });
    });
}

// ── Like ──
async function handleLike(btn) {
    const tweetId = btn.dataset.tweetId;
    const isLiked = btn.classList.contains('liked');
    btn.disabled = true;

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: isLiked ? 'unlike' : 'like', tweet_id: tweetId })
        });
        const data = await res.json();
        if (res.ok) {
            btn.classList.toggle('liked');
            btn.innerHTML = isLiked ? '&#10084;&#65039; Like' : '&#10084;&#65039; Liked';
        } else {
            showToast(data.error || 'Like failed', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
    btn.disabled = false;
}

// ── Retweet ──
async function handleRetweet(btn) {
    const tweetId = btn.dataset.tweetId;
    if (btn.classList.contains('retweeted')) return; // no undo for retweets in v2
    btn.disabled = true;

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'retweet', tweet_id: tweetId })
        });
        const data = await res.json();
        if (res.ok) {
            btn.classList.add('retweeted');
            btn.innerHTML = '&#128260; Retweeted';
        } else {
            showToast(data.error || 'Retweet failed', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
    btn.disabled = false;
}

// ── Reply drawer ──
async function openReplyDrawer(tweetId, useAi) {
    const drawer = document.getElementById('drawer-' + tweetId);
    if (!drawer) return;

    // Close other drawers
    if (activeDrawer && activeDrawer !== tweetId) {
        const prev = document.getElementById('drawer-' + activeDrawer);
        if (prev) prev.classList.remove('open');
    }

    // Toggle
    if (drawer.classList.contains('open') && !useAi) {
        drawer.classList.remove('open');
        activeDrawer = null;
        return;
    }

    drawer.classList.add('open');
    activeDrawer = tweetId;

    const regenBtn = drawer.querySelector('.regen-btn');

    if (useAi) {
        regenBtn.classList.remove('hidden');
        await handleAiReply(tweetId);
    } else {
        regenBtn.classList.add('hidden');
        const ta = document.getElementById('reply-text-' + tweetId);
        ta.value = '';
        ta.focus();
    }
}

// ── AI Reply ──
async function handleAiReply(tweetId) {
    if (credits <= 0) {
        showToast('No credits. Buy more at /deposit', 'error');
        return;
    }

    const tweet = searchResults.find(t => t.id === tweetId);
    if (!tweet) return;

    const ta = document.getElementById('reply-text-' + tweetId);
    ta.value = 'Generating reply...';
    ta.disabled = true;

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                action: 'ai-reply',
                tweet_id: tweetId,
                tweet_text: tweet.text,
                author_handle: tweet.author?.username || ''
            })
        });
        const data = await res.json();

        if (res.ok) {
            ta.value = data.reply || '';
            if (data.credits !== undefined) updateCredits(data.credits);
            // Update char count
            const cc = document.getElementById('charcount-' + tweetId);
            cc.textContent = ta.value.length + '/280';
            cc.className = ta.value.length > 280 ? 'xs-reply-charcount over' : 'xs-reply-charcount';
        } else {
            ta.value = '';
            showToast(data.error || 'AI reply generation failed', 'error');
        }
    } catch (e) {
        ta.value = '';
        showToast('Network error', 'error');
    }
    ta.disabled = false;
    ta.focus();
}

// ── Send reply ──
async function handleSendReply(tweetId) {
    const ta = document.getElementById('reply-text-' + tweetId);
    const text = ta.value.trim();
    if (!text) return;
    if (text.length > 280) {
        showToast('Reply exceeds 280 characters', 'error');
        return;
    }

    const sendBtn = searchFeed.querySelector(`.send-reply-btn[data-tweet-id="${tweetId}"]`);
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'reply', tweet_id: tweetId, text })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Reply posted!', 'success');
            ta.value = '';
            const drawer = document.getElementById('drawer-' + tweetId);
            if (drawer) drawer.classList.remove('open');
            activeDrawer = null;
        } else {
            showToast(data.error || 'Reply failed', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Reply';
}
