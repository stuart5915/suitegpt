// Inclawbate — Token Explorer
import { clawnch } from './clawnch.js';
import { formatNumber, formatUSD, timeAgo, debounce, escapeHtml } from './utils.js';

const SORT_OPTIONS = {
    marketCap: 'Market Cap',
    volume24h: 'Volume 24h',
    newest: 'Newest',
    holders: 'Holders'
};

let allTokens = [];
let currentSort = 'marketCap';
let searchQuery = '';
let loading = false;

// ── DOM refs ──
const grid = document.getElementById('explorerGrid');
const searchInput = document.getElementById('explorerSearch');
const sortSelect = document.getElementById('explorerSort');
const statsTokens = document.getElementById('statTokens');
const statsVolume = document.getElementById('statVolume');
const statsAgents = document.getElementById('statAgents');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// ── Init ──
async function init() {
    loadStats();
    await loadTokens();

    searchInput.addEventListener('input', debounce(handleSearch, 250));
    sortSelect.addEventListener('change', handleSort);
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);
}

// ── Load stats ──
async function loadStats() {
    try {
        const res = await clawnch.getStats();
        const d = res.data || res;
        if (d.totalTokens != null) statsTokens.textContent = formatNumber(d.totalTokens);
        if (d.totalVolume != null) statsVolume.textContent = '$' + formatNumber(d.totalVolume);
        if (d.activeAgents != null) statsAgents.textContent = formatNumber(d.activeAgents);
    } catch {}
}

// ── Load tokens ──
async function loadTokens() {
    if (loading) return;
    loading = true;
    showLoading();

    try {
        const res = await clawnch.getLeaderboard(currentSort, 50);
        allTokens = res.data || res || [];
        renderGrid();
    } catch (err) {
        grid.innerHTML = `<div class="explorer-loading"><p>Failed to load tokens. Try refreshing.</p></div>`;
    } finally {
        loading = false;
    }
}

// ── Render ──
function renderGrid() {
    const filtered = filterTokens(allTokens, searchQuery);

    if (filtered.length === 0) {
        grid.innerHTML = searchQuery
            ? `<div class="explorer-loading"><p>No tokens matching "${escapeHtml(searchQuery)}"</p></div>`
            : `<div class="explorer-loading"><p>No tokens found</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(t => tokenCard(t)).join('');
}

function tokenCard(t) {
    const ticker = escapeHtml(t.symbol || t.ticker || '???');
    const name = escapeHtml(t.name || ticker);
    const logo = t.logoUrl
        ? `<img src="${escapeHtml(t.logoUrl)}" alt="${ticker}" onerror="this.parentElement.textContent='${ticker.slice(0,2)}'"/>`
        : ticker.slice(0, 2);
    const price = t.price != null ? formatUSD(t.price) : '--';
    const mcap = t.marketCap != null ? '$' + formatNumber(t.marketCap) : '--';
    const vol = t.volume24h != null ? '$' + formatNumber(t.volume24h) : '--';
    const holders = t.holders != null ? formatNumber(t.holders) : '--';
    const age = t.createdAt ? timeAgo(t.createdAt) : '';

    return `<a href="/tokens/${ticker}" class="token-card">
        <div class="token-card-header">
            <div class="token-card-logo">${logo}</div>
            <div>
                <div class="token-card-name">${name}</div>
                <div class="token-card-ticker">$${ticker}${age ? ' · ' + age : ''}</div>
            </div>
        </div>
        <div class="token-card-price">${price}</div>
        <div class="token-card-stats">
            <div class="token-card-stat">
                <span class="token-card-stat-label">MCap</span>
                <span class="token-card-stat-value">${mcap}</span>
            </div>
            <div class="token-card-stat">
                <span class="token-card-stat-label">Vol</span>
                <span class="token-card-stat-value">${vol}</span>
            </div>
            <div class="token-card-stat">
                <span class="token-card-stat-label">Holders</span>
                <span class="token-card-stat-value">${holders}</span>
            </div>
        </div>
    </a>`;
}

function filterTokens(tokens, q) {
    if (!q) return tokens;
    const lower = q.toLowerCase();
    return tokens.filter(t =>
        (t.symbol || t.ticker || '').toLowerCase().includes(lower) ||
        (t.name || '').toLowerCase().includes(lower)
    );
}

function showLoading() {
    grid.innerHTML = `<div class="explorer-loading"><div class="spinner spinner-lg"></div><p>Loading tokens...</p></div>`;
}

// ── Handlers ──
function handleSearch(e) {
    searchQuery = e.target.value.trim();
    renderGrid();
}

function handleSort(e) {
    currentSort = e.target.value;
    loadTokens();
}

async function loadMore() {
    try {
        const res = await clawnch.getLeaderboard(currentSort, allTokens.length + 50);
        allTokens = res.data || res || [];
        renderGrid();
    } catch {}
}

// ── Boot ──
init();
