// Project Detail Page — Inclawbator
// Pattern: IIFE, plain JS (same as inclawbator-app.js)

(function() {
'use strict';

var API_BASE = '/api/inclawbate/inclawbator';

var state = {
    project: null,
    posts: [],
    wallet: null
};

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
}

function getProjectId() {
    var path = window.location.pathname;
    var parts = path.split('/');
    // /inclawbator/{id}
    return parts[2] || null;
}

function showToast(msg, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'project-toast project-toast--' + (type || 'success');
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('visible'); });
    setTimeout(function() {
        el.classList.remove('visible');
        setTimeout(function() { el.remove(); }, 300);
    }, 3000);
}

// ══════════════════════════════════════
// API
// ══════════════════════════════════════

async function apiGet(params) {
    var url = API_BASE + '?' + new URLSearchParams(params).toString();
    var res = await fetch(url);
    return res.json();
}

async function apiPost(body) {
    var token = localStorage.getItem('inclawbate_token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch(API_BASE, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    return res.json();
}

// ══════════════════════════════════════
// WALLET
// ══════════════════════════════════════

async function connectWallet() {
    if (!window.ethereum) return null;
    try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return accounts[0] ? accounts[0].toLowerCase() : null;
    } catch (e) { return null; }
}

function getConnectedWallet() {
    if (!window.ethereum || !window.ethereum.selectedAddress) return null;
    return window.ethereum.selectedAddress.toLowerCase();
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════

function renderProject() {
    var p = state.project;
    if (!p) return;

    // Update page title
    document.title = p.token_name + ' — Inclawbator';

    // Logo
    var logoEl = document.getElementById('projectLogo');
    if (p.logo_url) {
        logoEl.innerHTML = '<img src="' + escapeHtml(p.logo_url) + '" class="project-hero-logo" alt="">';
    } else {
        logoEl.innerHTML = '<div class="project-hero-logo-placeholder" style="background:' + (p.color || 'var(--seafoam-500)') + '">' + (p.token_symbol || '?')[0] + '</div>';
    }

    // Name, symbol, tier
    document.getElementById('projectName').textContent = p.token_name;
    document.getElementById('projectSymbol').textContent = '$' + p.token_symbol;

    var tierEl = document.getElementById('projectTier');
    if (p.tier === 'incubated') {
        tierEl.innerHTML = '<span class="tier-badge tier-incubated">Incubated</span>';
    } else if (p.tier === 'byt') {
        tierEl.innerHTML = '<span class="tier-badge tier-permissionless">BYT</span>';
    } else {
        tierEl.innerHTML = '<span class="tier-badge tier-permissionless">Permissionless</span>';
    }

    // Description
    var descEl = document.getElementById('projectDesc');
    descEl.textContent = p.description || '';
    descEl.style.display = p.description ? '' : 'none';

    // Links
    var linksHtml = '';
    if (p.website_url) linksHtml += '<a href="' + escapeHtml(p.website_url) + '" target="_blank" rel="noopener" class="project-link">Website</a>';
    if (p.x_handle) linksHtml += '<a href="https://x.com/' + escapeHtml(p.x_handle) + '" target="_blank" rel="noopener" class="project-link">@' + escapeHtml(p.x_handle) + '</a>';
    if (p.telegram_url) linksHtml += '<a href="' + escapeHtml(p.telegram_url) + '" target="_blank" rel="noopener" class="project-link">Telegram</a>';
    if (p.token_address) linksHtml += '<a href="https://dexscreener.com/base/' + p.token_address + '" target="_blank" rel="noopener" class="project-link">Chart</a>';
    if (p.staking_address) linksHtml += '<a href="/stake" class="project-link">Stake</a>';
    document.getElementById('projectLinks').innerHTML = linksHtml;

    // Info grid
    var splitPct = Math.round((p.fee_split_bps || 10000) / 100);
    var gridHtml =
        '<div class="info-card"><div class="info-label">Fee Split</div><div class="info-value">' + splitPct + '%</div></div>' +
        '<div class="info-card"><div class="info-label">Staking</div><div class="info-value">' + (p.staking_address ? '<span class="active-dot">Live</span>' : 'Pending') + '</div></div>' +
        '<div class="info-card"><div class="info-label">Total Rewards</div><div class="info-value">' + fmt(p.total_rewards_distributed || 0) + ' INCLAWNCH</div></div>' +
        '<div class="info-card"><div class="info-label">Total Fees</div><div class="info-value">' + fmt(p.total_fees_claimed || 0) + '</div></div>';
    document.getElementById('infoGrid').innerHTML = gridHtml;

    // Agent section
    if (p.agent_enabled) {
        var agentSec = document.getElementById('agentSection');
        agentSec.classList.remove('hidden');

        var statusClass = p.agent_status === 'active' ? 'agent-badge--active'
            : p.agent_status === 'paused' ? 'agent-badge--paused'
            : 'agent-badge--dormant';
        var statusLabel = p.agent_status === 'active' ? 'Live'
            : p.agent_status === 'paused' ? 'Paused'
            : 'Dormant';

        var statusHtml =
            '<span class="agent-badge ' + statusClass + '">' + statusLabel + '</span>' +
            '<span class="agent-meta">' + (p.agent_credits || 0) + ' credits</span>' +
            '<span class="agent-meta">' + (p.agent_posts_per_day || 4) + ' posts/day</span>';

        if (p.x_connected && p.x_handle) {
            statusHtml += '<span class="agent-meta">X: @' + escapeHtml(p.x_handle) + '</span>';
        }

        statusHtml += '<button class="feed-agent-btn" id="feedAgentBtn">Feed Agent</button>';
        document.getElementById('agentStatusRow').innerHTML = statusHtml;

        // Wire feed button
        document.getElementById('feedAgentBtn').addEventListener('click', function() {
            openFeedModal();
        });

        // Tweets
        renderTweets();
    }

    // Owner panel
    var isOwner = state.wallet && p.creator_wallet === state.wallet;
    if (isOwner && p.agent_enabled) {
        var ownerPanel = document.getElementById('ownerPanel');
        ownerPanel.classList.remove('hidden');

        // X status
        var xStatus = document.getElementById('ownerXStatus');
        var connectBtn = document.getElementById('ownerConnectX');
        var disconnectBtn = document.getElementById('ownerDisconnectX');

        if (p.x_connected) {
            xStatus.textContent = p.x_handle ? '@' + p.x_handle : 'Connected';
            connectBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
        } else {
            xStatus.textContent = 'Not connected';
            connectBtn.href = '/api/inclawbate/x-connect?project_id=' + p.id + '&wallet=' + state.wallet;
            connectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('hidden');
        }

        // Posts per day
        var postsSelect = document.getElementById('ownerPostsPerDay');
        postsSelect.value = String(p.agent_posts_per_day || 4);

        // Persona
        document.getElementById('ownerPersona').value = p.agent_persona || '';

        // Pause/Resume button
        var pauseBtn = document.getElementById('ownerPauseBtn');
        if (p.agent_status === 'active') {
            pauseBtn.textContent = 'Pause Agent';
            pauseBtn.className = 'owner-btn owner-btn--danger';
        } else {
            pauseBtn.textContent = 'Resume Agent';
            pauseBtn.className = 'owner-btn';
        }
    }
}

function renderTweets() {
    var container = document.getElementById('agentTweets');
    if (!state.posts || state.posts.length === 0) {
        container.innerHTML = '<p style="font-family:var(--font-body);font-size:0.85rem;color:var(--text-dim);">No posts yet.</p>';
        return;
    }

    var html = '<div class="tweets-list">';
    state.posts.forEach(function(post) {
        var tweetUrl = post.tweet_id ? 'https://x.com/i/status/' + post.tweet_id : null;
        html += '<div class="tweet-item">' +
            '<div class="tweet-text">' + escapeHtml(post.tweet_text) + '</div>' +
            '<div class="tweet-meta">' +
                '<span>' + timeAgo(post.created_at) + '</span>' +
                (tweetUrl ? '<a href="' + tweetUrl + '" target="_blank" rel="noopener">View on X</a>' : '') +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

// ══════════════════════════════════════
// FEED MODAL
// ══════════════════════════════════════

function openFeedModal() {
    var overlay = document.getElementById('feedModalOverlay');
    var p = state.project;
    document.getElementById('feedModalTitle').textContent = 'Feed $' + (p ? p.token_symbol : '') + ' Agent';
    document.getElementById('feedProjectId').value = p ? p.id : '';
    document.getElementById('feedTxHash').value = '';
    document.getElementById('feedResult').style.display = 'none';
    overlay.classList.add('visible');
}

function closeFeedModal() {
    document.getElementById('feedModalOverlay').classList.remove('visible');
}

async function submitFeed() {
    var txHash = document.getElementById('feedTxHash').value.trim();
    var projectId = document.getElementById('feedProjectId').value;
    var resultEl = document.getElementById('feedResult');
    var btn = document.getElementById('feedSubmitBtn');

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--lobster-300)';
        resultEl.textContent = 'Enter a valid transaction hash (0x...)';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    resultEl.style.display = 'none';

    try {
        var res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'feed-agent', project_id: projectId, tx_hash: txHash })
        });
        var data = await res.json();

        resultEl.style.display = 'block';
        if (data.error) {
            resultEl.style.color = 'var(--lobster-300)';
            resultEl.textContent = data.error;
        } else {
            resultEl.style.color = 'var(--seafoam-300)';
            resultEl.textContent = '+' + data.credits_added + ' credits added! Total: ' + data.credits_total;
            showToast('Agent fed! +' + data.credits_added + ' credits', 'success');
            // Reload project data
            loadProject();
        }
    } catch (e) {
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--lobster-300)';
        resultEl.textContent = 'Network error. Try again.';
    }

    btn.disabled = false;
    btn.textContent = 'Submit';
}

// ══════════════════════════════════════
// OWNER ACTIONS
// ══════════════════════════════════════

async function saveAgentSettings() {
    var p = state.project;
    if (!p) return;

    var btn = document.getElementById('ownerSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var data = await apiPost({
        action: 'update-agent',
        project_id: p.id,
        agent_persona: document.getElementById('ownerPersona').value,
        agent_posts_per_day: parseInt(document.getElementById('ownerPostsPerDay').value)
    });

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (data.error) {
        showToast(data.error, 'error');
    } else {
        showToast('Settings saved', 'success');
        state.project = data.project;
        renderProject();
    }
}

async function togglePause() {
    var p = state.project;
    if (!p) return;

    var newStatus = p.agent_status === 'active' ? 'paused' : 'active';
    var btn = document.getElementById('ownerPauseBtn');
    btn.disabled = true;

    var data = await apiPost({
        action: 'update-agent',
        project_id: p.id,
        agent_status: newStatus
    });

    btn.disabled = false;

    if (data.error) {
        showToast(data.error, 'error');
    } else {
        showToast(newStatus === 'paused' ? 'Agent paused' : 'Agent resumed', 'success');
        state.project = data.project;
        renderProject();
    }
}

async function disconnectX() {
    var p = state.project;
    if (!p) return;

    if (!confirm('Disconnect X account? The agent will stop posting.')) return;

    var data = await apiPost({
        action: 'disconnect-x',
        project_id: p.id
    });

    if (data.error) {
        showToast(data.error, 'error');
    } else {
        showToast('X disconnected', 'success');
        loadProject(); // full reload to get fresh data
    }
}

// ══════════════════════════════════════
// LOAD
// ══════════════════════════════════════

async function loadProject() {
    var id = getProjectId();
    if (!id) {
        document.getElementById('projectLoading').classList.add('hidden');
        document.getElementById('projectNotFound').classList.remove('hidden');
        return;
    }

    try {
        var data = await apiGet({ id: id });

        if (data.error || !data.project) {
            document.getElementById('projectLoading').classList.add('hidden');
            document.getElementById('projectNotFound').classList.remove('hidden');
            return;
        }

        state.project = data.project;
        state.posts = data.agent_posts || [];

        document.getElementById('projectLoading').classList.add('hidden');
        document.getElementById('projectPage').classList.remove('hidden');

        renderProject();
    } catch (e) {
        document.getElementById('projectLoading').classList.add('hidden');
        document.getElementById('projectNotFound').classList.remove('hidden');
    }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

function init() {
    // Try to get wallet
    state.wallet = getConnectedWallet();

    // Listen for wallet changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', function(accounts) {
            state.wallet = accounts[0] ? accounts[0].toLowerCase() : null;
            renderProject();
        });
    }

    // Wire up modal buttons
    document.getElementById('feedCancelBtn').addEventListener('click', closeFeedModal);
    document.getElementById('feedSubmitBtn').addEventListener('click', submitFeed);

    // Wire up owner buttons
    document.getElementById('ownerSaveBtn').addEventListener('click', saveAgentSettings);
    document.getElementById('ownerPauseBtn').addEventListener('click', togglePause);
    document.getElementById('ownerDisconnectX').addEventListener('click', disconnectX);

    // Close modal on overlay click
    document.getElementById('feedModalOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeFeedModal();
    });

    loadProject();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
