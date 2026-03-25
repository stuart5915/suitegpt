// X Search — Frontend Logic
// Search tweets, engage (like/retweet/reply), AI-generated replies

function isLoggedIn() { return !!localStorage.getItem('inclawbate_token'); }

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
const buyModal = document.getElementById('buyModal');

// ── Init ──
(async function init() {
    // Show main content to all visitors (gate removed)
    mainContent.classList.remove('hidden');

    if (isLoggedIn()) {
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
    }

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

// Suggestion pills
document.querySelectorAll('.xs-suggest-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        searchInput.value = pill.dataset.query;
        doSearch();
    });
});

// ── Search ──
async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

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

// ══════════════════════════════════════
// BUY CREDITS MODAL
// ══════════════════════════════════════
const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const TARGET_USD_PER_CREDIT = 0.005;
const BASE_CHAIN_ID = '0x2105';

let modalProvider = null;
let modalAccount = null;
let clawnchPrice = 0;

function getTokensPerCredit() {
    if (clawnchPrice <= 0) return 0;
    const raw = TARGET_USD_PER_CREDIT / clawnchPrice;
    return Math.max(1, Math.min(10000, raw));
}

// Fetch price
async function fetchPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            clawnchPrice = parseFloat(data.pairs[0].priceUsd) || 0;
        }
    } catch (e) { /* price stays 0 */ }
    modalUpdateEstimates();
}

// Modal refs
const modalAmountInput = document.getElementById('modalAmountInput');
const modalDepositBtn = document.getElementById('modalDepositBtn');

// Open/close modal
document.getElementById('openBuyBtn').addEventListener('click', () => {
    buyModal.classList.add('open');
    if (!clawnchPrice) fetchPrice();
});

document.getElementById('closeBuyModal').addEventListener('click', closeModal);
buyModal.addEventListener('click', (e) => {
    if (e.target === buyModal) closeModal();
});

function closeModal() {
    buyModal.classList.remove('open');
}

// Estimates
function modalUpdateEstimates() {
    const amount = parseInt(modalAmountInput.value) || 0;
    const tpc = getTokensPerCredit();
    const modalCredits = tpc > 0 ? Math.floor(amount / tpc) : 0;
    const usdEl = document.getElementById('modalUsd');
    const creditsEl = document.getElementById('modalCreditsEst');
    const rateEl = document.getElementById('modalRate');

    if (amount > 0 && clawnchPrice > 0) {
        usdEl.textContent = '$' + (amount * clawnchPrice).toFixed(2);
    } else {
        usdEl.textContent = '\u2014';
    }

    creditsEl.textContent = modalCredits > 0 ? modalCredits.toLocaleString() + ' credits' : '\u2014';
    modalDepositBtn.disabled = !(modalAccount && modalCredits > 0);

    if (tpc > 0) {
        rateEl.innerHTML = '<strong>~' + Math.round(tpc).toLocaleString() + ' INCLAWNCH = 1 credit</strong>';
    } else {
        rateEl.innerHTML = '<strong>Loading rate...</strong>';
    }
}

modalAmountInput.addEventListener('input', modalUpdateEstimates);

// Presets
document.querySelectorAll('.xs-modal-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        modalAmountInput.value = btn.dataset.amount;
        modalUpdateEstimates();
    });
});

// Wallet connect
document.getElementById('modalConnectBtn').addEventListener('click', async () => {
    if (!window.ethereum) {
        modalShowError('No wallet detected. Install MetaMask or Coinbase Wallet.');
        return;
    }
    modalProvider = window.ethereum;

    try {
        const accounts = await modalProvider.request({ method: 'eth_requestAccounts' });
        modalAccount = accounts[0];

        try {
            await modalProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID }]
            });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await modalProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BASE_CHAIN_ID,
                        chainName: 'Base',
                        rpcUrls: ['https://mainnet.base.org'],
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://basescan.org']
                    }]
                });
            } else throw switchErr;
        }

        document.getElementById('modalWalletConnect').classList.add('hidden');
        document.getElementById('modalWalletConnected').classList.remove('hidden');
        document.getElementById('modalWalletAddr').textContent = modalAccount.slice(0, 6) + '...' + modalAccount.slice(-4);
        modalUpdateEstimates();
    } catch (err) {
        if (err.code !== 4001) modalShowError('Wallet connection failed');
    }
});

document.getElementById('modalDisconnectBtn').addEventListener('click', () => {
    modalAccount = null;
    modalProvider = null;
    document.getElementById('modalWalletConnect').classList.remove('hidden');
    document.getElementById('modalWalletConnected').classList.add('hidden');
    modalUpdateEstimates();
});

// Deposit
modalDepositBtn.addEventListener('click', async () => {
    const amount = parseInt(modalAmountInput.value) || 0;
    const tpc = getTokensPerCredit();
    const estCredits = tpc > 0 ? Math.floor(amount / tpc) : 0;
    if (!modalAccount || !modalProvider || estCredits <= 0) return;

    modalHideError();
    modalShowStep('progress');
    modalSetProgress('Confirm in your wallet...', '');

    try {
        const amountWei = BigInt(Math.floor(amount)) * BigInt('1000000000000000000');
        const transferData = '0xa9059cbb' +
            PROTOCOL_WALLET.slice(2).toLowerCase().padStart(64, '0') +
            amountWei.toString(16).padStart(64, '0');

        // Ensure wallet is on Base before sending
        try { await modalProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] }); }
        catch (e) { if (e.code === 4902) await modalProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }] }); }

        const txHash = await modalProvider.request({
            method: 'eth_sendTransaction',
            params: [{ from: modalAccount, to: CLAWNCH_ADDRESS, data: transferData }]
        });

        modalSetProgress('Waiting for confirmation...', txHash.slice(0, 10) + '...');

        const receipt = await modalWaitReceipt(modalProvider, txHash);
        if (!receipt || receipt.status === '0x0') {
            modalShowStep('form');
            modalShowError('Transaction failed on-chain.');
            return;
        }

        modalSetProgress('Adding credits...', '');

        const jwt = localStorage.getItem('inclawbate_token');
        const resp = await fetch('/api/inclawbate/credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
            body: JSON.stringify({ action: 'deposit', tx_hash: txHash })
        });
        const data = await resp.json();

        if (!resp.ok) {
            modalShowStep('form');
            modalShowError(data.error || 'Failed to credit deposit');
            return;
        }

        // Success
        document.getElementById('modalSuccessCredits').textContent = '+' + data.credits_added;
        document.getElementById('modalSuccessDetail').textContent =
            Math.floor(data.clawnch_deposited).toLocaleString() + ' INCLAWNCH deposited';
        document.getElementById('modalTxLink').href = 'https://basescan.org/tx/' + txHash;

        // Update credit badge on the page
        updateCredits(data.credits_total);

        modalShowStep('success');
    } catch (err) {
        modalShowStep('form');
        if (err.code !== 4001) modalShowError('Deposit failed: ' + (err.message || 'Unknown error'));
    }
});

async function modalWaitReceipt(p, txHash) {
    for (let i = 0; i < 30; i++) {
        const receipt = await p.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
        if (receipt) return receipt;
        await new Promise(r => setTimeout(r, 2000));
    }
    return null;
}

// Deposit again
document.getElementById('modalDepositAgain').addEventListener('click', () => {
    modalAmountInput.value = '';
    modalUpdateEstimates();
    modalShowStep('form');
});

// Done
document.getElementById('modalDone').addEventListener('click', closeModal);

// Modal UI helpers
function modalShowStep(step) {
    document.getElementById('modalForm').classList.toggle('hidden', step !== 'form');
    document.getElementById('modalProgress').classList.toggle('hidden', step !== 'progress');
    document.getElementById('modalSuccess').classList.toggle('hidden', step !== 'success');
}

function modalSetProgress(text, sub) {
    document.getElementById('modalProgressText').textContent = text;
    document.getElementById('modalProgressSub').textContent = sub;
}

function modalShowError(msg) {
    const el = document.getElementById('modalError');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function modalHideError() {
    document.getElementById('modalError').classList.add('hidden');
}
