// Inclawbate — Ops Dashboard Controller
import { auth } from './auth.js';
import { opsApi } from './ops-api.js';
import { escapeHtml, timeAgo, shortenAddress } from './utils.js';

// ── State ──
let selectedToken = null;
let brandConfig = null;
let currentPostFilter = '';

// ── DOM refs ──
const connectGate = document.getElementById('connectGate');
const opsContent = document.getElementById('opsContent');
const tokenGrid = document.getElementById('tokenGrid');
const opsPanel = document.getElementById('opsPanel');
const panelTitle = document.getElementById('panelTitle');
const connectBtn = document.getElementById('connectBtn');
const connectGateBtn = document.getElementById('connectGateBtn');

// ── Init ──
async function init() {
    connectBtn.addEventListener('click', handleConnect);
    connectGateBtn.addEventListener('click', handleConnect);

    // Tab switching
    document.querySelectorAll('.ops-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Post filters
    document.querySelectorAll('.ops-post-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPostFilter = btn.dataset.status;
            document.querySelectorAll('.ops-post-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPosts();
        });
    });

    // Brand voice save
    document.getElementById('saveBrandBtn').addEventListener('click', saveBrandConfig);

    // Sample post add
    document.getElementById('addSampleBtn').addEventListener('click', addSamplePost);

    // Radio groups
    setupRadioGroup('frequencyGroup');
    setupRadioGroup('autonomyGroup');

    // Check if already connected
    if (auth.isConnected) {
        showDashboard();
    } else {
        connectGate.classList.remove('hidden');
        opsContent.classList.add('hidden');
        connectBtn.textContent = 'Connect Wallet';
    }

    // Check URL for token param
    const params = new URLSearchParams(window.location.search);
    if (params.get('token')) {
        // Will be used after tokens load
        window._preselect = params.get('token').toUpperCase();
    }
}

async function handleConnect() {
    try {
        connectBtn.textContent = 'Connecting...';
        connectBtn.disabled = true;
        await auth.connect();
        showDashboard();
    } catch (err) {
        showToast(err.message, 'error');
        connectBtn.textContent = 'Connect Wallet';
        connectBtn.disabled = false;
    }
}

function showDashboard() {
    connectGate.classList.add('hidden');
    opsContent.classList.remove('hidden');
    connectBtn.textContent = shortenAddress(auth.wallet, 4);
    loadMyTokens();
}

// ── Token Selector ──
async function loadMyTokens() {
    tokenGrid.innerHTML = '<div class="ops-empty"><div class="spinner spinner-lg"></div><p>Loading tokens...</p></div>';

    try {
        const res = await opsApi.getMyTokens();
        const tokens = res.tokens || [];

        if (tokens.length === 0) {
            tokenGrid.innerHTML = `<div class="ops-empty">
                <div class="ops-empty-icon">&#128269;</div>
                <p>No tokens found for this wallet. Tokens you deploy on Clawnch will appear here.</p>
            </div>`;
            return;
        }

        tokenGrid.innerHTML = tokens.map(t => {
            const symbol = escapeHtml(t.symbol || '???');
            const name = escapeHtml(t.name || symbol);
            let badges = '';
            if (t.pendingPosts > 0) {
                badges += `<span class="ops-token-badge pending">${t.pendingPosts} pending</span>`;
            }
            if (t.hasBrandConfig) {
                badges += '<span class="ops-token-badge configured">configured</span>';
            } else {
                badges += '<span class="ops-token-badge new">not setup</span>';
            }

            return `<div class="ops-token-card" data-address="${escapeHtml(t.address || '')}" data-symbol="${symbol}">
                <div class="ops-token-card-symbol">$${symbol}</div>
                <div class="ops-token-card-name">${name}</div>
                <div class="ops-token-card-meta">${badges}</div>
            </div>`;
        }).join('');

        // Click handlers
        tokenGrid.querySelectorAll('.ops-token-card').forEach(card => {
            card.addEventListener('click', () => selectToken(card.dataset.address, card.dataset.symbol));
        });

        // Auto-select from URL param
        if (window._preselect) {
            const match = tokens.find(t => (t.symbol || '').toUpperCase() === window._preselect);
            if (match) selectToken(match.address, match.symbol);
            delete window._preselect;
        }

    } catch (err) {
        tokenGrid.innerHTML = `<div class="ops-empty"><p>Failed to load tokens. ${escapeHtml(err.message)}</p></div>`;
    }
}

async function selectToken(address, symbol) {
    selectedToken = { address, symbol };

    // Highlight selected card
    tokenGrid.querySelectorAll('.ops-token-card').forEach(c => c.classList.remove('active'));
    const card = tokenGrid.querySelector(`[data-address="${address}"]`);
    if (card) card.classList.add('active');

    panelTitle.textContent = `$${symbol} Operations`;
    opsPanel.classList.remove('hidden');

    // Load brand config for this token
    loadBrandConfig();

    // Load posts if that tab is visible
    const activeTab = document.querySelector('.ops-tab.active');
    if (activeTab && activeTab.dataset.tab === 'posts') loadPosts();
    if (activeTab && activeTab.dataset.tab === 'activity') loadActivity();
}

// ── Tab Switching ──
function switchTab(tabName) {
    document.querySelectorAll('.ops-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ops-tab-content').forEach(c => c.classList.remove('active'));

    const tab = document.querySelector(`.ops-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');

    if (selectedToken) {
        if (tabName === 'posts') loadPosts();
        if (tabName === 'activity') loadActivity();
    }
}

// ── Brand Voice ──
async function loadBrandConfig() {
    if (!selectedToken) return;

    try {
        const res = await opsApi.getBrandConfig(selectedToken.address);
        brandConfig = res.config;
        renderBrandForm(brandConfig);
    } catch (err) {
        console.error('Brand config load error:', err);
    }
}

function renderBrandForm(config) {
    document.getElementById('brandTone').value = config.tone || '';

    renderTagList('topicsFocus', config.topics_focus || [], 'focus');
    renderTagList('topicsAvoid', config.topics_avoid || [], 'avoid');
    renderTagList('hashtags', config.hashtags || [], 'hashtag');

    // Sample posts
    const container = document.getElementById('samplePosts');
    container.innerHTML = (config.sample_posts || []).map((text, i) =>
        `<div class="ops-sample-post">
            <div class="ops-sample-post-text">"${escapeHtml(text)}"</div>
            <span class="ops-tag-remove" data-index="${i}" data-type="sample">&times;</span>
        </div>`
    ).join('');

    container.querySelectorAll('.ops-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => removeSamplePost(parseInt(btn.dataset.index)));
    });

    // Radio groups
    setRadioValue('frequencyGroup', config.posting_frequency || 'moderate');
    setRadioValue('autonomyGroup', config.autonomy_mode || 'review');
}

function renderTagList(containerId, tags, type) {
    const container = document.getElementById(containerId);
    const html = tags.map((tag, i) =>
        `<span class="ops-tag">${escapeHtml(tag)}<span class="ops-tag-remove" data-index="${i}" data-type="${type}">&times;</span></span>`
    ).join('') + `<button class="ops-tag-add" data-type="${type}">+ Add</button>`;

    container.innerHTML = html;

    // Remove handlers
    container.querySelectorAll('.ops-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => removeTag(type, parseInt(btn.dataset.index)));
    });

    // Add handler
    container.querySelector('.ops-tag-add').addEventListener('click', () => addTag(type));
}

function addTag(type) {
    const value = prompt(`Add ${type === 'hashtag' ? 'hashtag' : 'topic'}:`);
    if (!value || !value.trim()) return;

    const field = type === 'focus' ? 'topics_focus' : type === 'avoid' ? 'topics_avoid' : 'hashtags';
    if (!brandConfig[field]) brandConfig[field] = [];
    brandConfig[field].push(value.trim());
    renderBrandForm(brandConfig);
}

function removeTag(type, index) {
    const field = type === 'focus' ? 'topics_focus' : type === 'avoid' ? 'topics_avoid' : 'hashtags';
    if (brandConfig[field]) {
        brandConfig[field].splice(index, 1);
        renderBrandForm(brandConfig);
    }
}

function addSamplePost() {
    if (!brandConfig.sample_posts) brandConfig.sample_posts = [];
    if (brandConfig.sample_posts.length >= 5) {
        showToast('Maximum 5 sample posts', 'error');
        return;
    }
    const text = prompt('Enter a sample post:');
    if (!text || !text.trim()) return;
    brandConfig.sample_posts.push(text.trim());
    renderBrandForm(brandConfig);
}

function removeSamplePost(index) {
    if (brandConfig.sample_posts) {
        brandConfig.sample_posts.splice(index, 1);
        renderBrandForm(brandConfig);
    }
}

async function saveBrandConfig() {
    if (!selectedToken || !brandConfig) return;

    const btn = document.getElementById('saveBrandBtn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const config = {
            token_address: selectedToken.address,
            tone: document.getElementById('brandTone').value.trim(),
            topics_focus: brandConfig.topics_focus || [],
            topics_avoid: brandConfig.topics_avoid || [],
            sample_posts: brandConfig.sample_posts || [],
            hashtags: brandConfig.hashtags || [],
            posting_frequency: getRadioValue('frequencyGroup'),
            autonomy_mode: getRadioValue('autonomyGroup')
        };

        await opsApi.saveBrandConfig(config);
        showToast('Brand settings saved', 'success');
    } catch (err) {
        showToast('Failed to save: ' + err.message, 'error');
    } finally {
        btn.textContent = 'Save Settings';
        btn.disabled = false;
    }
}

// ── Scheduled Posts ──
async function loadPosts() {
    if (!selectedToken) return;

    const container = document.getElementById('postsList');
    container.innerHTML = '<div class="ops-empty"><div class="spinner spinner-lg"></div></div>';

    try {
        const res = await opsApi.getPosts(selectedToken.address, currentPostFilter || undefined);
        const posts = res.posts || [];

        if (posts.length === 0) {
            container.innerHTML = `<div class="ops-empty">
                <div class="ops-empty-icon">&#128221;</div>
                <p>No ${currentPostFilter || ''} posts yet. Agents will generate posts once assigned and configured.</p>
            </div>`;
            return;
        }

        container.innerHTML = posts.map(p => renderPostCard(p)).join('');

        // Action handlers
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => handlePostAction(btn.dataset.postId, btn.dataset.action));
        });

    } catch (err) {
        container.innerHTML = `<div class="ops-empty"><p>Failed to load posts.</p></div>`;
    }
}

function renderPostCard(post) {
    const status = escapeHtml(post.status || 'draft');
    const platform = escapeHtml(post.platform || 'unknown');
    const time = post.scheduled_for
        ? new Date(post.scheduled_for).toLocaleString()
        : post.created_at ? timeAgo(post.created_at) : '';
    const text = escapeHtml(post.post_text || '');

    let actions = '';
    if (status === 'draft') {
        actions = `
            <button class="ops-post-action edit" data-post-id="${post.id}" data-action="edit">Edit</button>
            <button class="ops-post-action approve" data-post-id="${post.id}" data-action="approve">Approve</button>
            <button class="ops-post-action reject" data-post-id="${post.id}" data-action="reject">Reject</button>`;
    } else if (status === 'approved') {
        actions = `
            <button class="ops-post-action edit" data-post-id="${post.id}" data-action="edit">Edit</button>
            <button class="ops-post-action reject" data-post-id="${post.id}" data-action="revoke">Revoke</button>`;
    }

    return `<div class="ops-post-card">
        <div class="ops-post-header">
            <span class="ops-post-status ${status}">${status}</span>
            <span class="ops-post-platform">${platform}</span>
            <span class="ops-post-time">${time}</span>
        </div>
        <div class="ops-post-text">${text}</div>
        ${actions ? `<div class="ops-post-actions">${actions}</div>` : ''}
    </div>`;
}

async function handlePostAction(postId, action) {
    try {
        if (action === 'edit') {
            const newText = prompt('Edit post text:');
            if (!newText || !newText.trim()) return;
            await opsApi.updatePost(postId, 'edit', { post_text: newText.trim() });
            showToast('Post updated', 'success');
        } else if (action === 'reject') {
            const reason = prompt('Rejection reason (optional):');
            await opsApi.updatePost(postId, 'reject', { rejected_reason: reason || undefined });
            showToast('Post rejected', 'success');
        } else {
            await opsApi.updatePost(postId, action);
            showToast(`Post ${action}d`, 'success');
        }
        loadPosts();
    } catch (err) {
        showToast('Action failed: ' + err.message, 'error');
    }
}

// ── Activity Feed ──
async function loadActivity() {
    if (!selectedToken) return;

    const container = document.getElementById('activityFeed');
    container.innerHTML = '<div class="ops-empty"><div class="spinner spinner-lg"></div></div>';

    try {
        const res = await opsApi.getActivityFeed(selectedToken.address);
        const feed = res.feed || [];

        if (feed.length === 0) {
            container.innerHTML = `<div class="ops-empty">
                <div class="ops-empty-icon">&#128202;</div>
                <p>No activity yet. Agent actions and post updates will appear here.</p>
            </div>`;
            return;
        }

        container.innerHTML = feed.map(item => `
            <div class="ops-feed-item">
                <div class="ops-feed-dot ${item.type}"></div>
                <div class="ops-feed-content">
                    <div class="ops-feed-summary">${escapeHtml(item.summary)}</div>
                    ${item.preview ? `<div class="ops-feed-preview">${escapeHtml(item.preview)}</div>` : ''}
                </div>
                <div class="ops-feed-time">${item.timestamp ? timeAgo(item.timestamp) : ''}</div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = `<div class="ops-empty"><p>Failed to load activity.</p></div>`;
    }
}

// ── Radio Group Helpers ──
function setupRadioGroup(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.ops-radio').forEach(radio => {
        radio.addEventListener('click', () => {
            group.querySelectorAll('.ops-radio').forEach(r => r.classList.remove('selected'));
            radio.classList.add('selected');
            radio.querySelector('input').checked = true;
        });
    });
}

function getRadioValue(groupId) {
    const selected = document.querySelector(`#${groupId} .ops-radio.selected`);
    return selected ? selected.dataset.value : null;
}

function setRadioValue(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.ops-radio').forEach(r => {
        r.classList.toggle('selected', r.dataset.value === value);
        const input = r.querySelector('input');
        if (input) input.checked = r.dataset.value === value;
    });
}

// ── Toast ──
function showToast(message, type = 'success') {
    const existing = document.querySelector('.ops-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `ops-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── Boot ──
init();
