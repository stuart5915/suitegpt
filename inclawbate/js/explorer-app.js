// Inclawbate — Token Explorer
import { clawnch } from './clawnch.js';
import { formatNumber, formatUSD, timeAgo, debounce, escapeHtml } from './utils.js';

let currentSort = 'newest';
let currentOffset = 0;
let hasMore = false;
let loading = false;
let searchQuery = '';

// ── DOM refs ──
const grid = document.getElementById('explorerGrid');
const searchInput = document.getElementById('explorerSearch');
const sortSelect = document.getElementById('explorerSort');
const statsTokens = document.getElementById('statTokens');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// ── Init ──
async function init() {
    loadStats();
    await loadTokens();

    searchInput.addEventListener('input', debounce(handleSearch, 300));
    sortSelect.addEventListener('change', handleSort);
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);
}

// ── Load stats ──
async function loadStats() {
    try {
        const res = await clawnch.getStats();
        if (res.data) {
            statsTokens.textContent = formatNumber(res.data.totalTokens || 0);
        }
    } catch {}
}

// ── Load tokens ──
async function loadTokens(append = false) {
    if (loading) return;
    loading = true;
    if (!append) {
        currentOffset = 0;
        showLoading();
    }

    try {
        const res = await clawnch.getTokens({
            offset: currentOffset,
            limit: 48,
            search: searchQuery || undefined,
            sort: currentSort
        });

        const tokens = res.tokens || [];
        hasMore = res.hasMore || false;

        if (append) {
            grid.insertAdjacentHTML('beforeend', tokens.map(tokenCard).join(''));
        } else {
            if (tokens.length === 0) {
                grid.innerHTML = searchQuery
                    ? `<div class="explorer-loading"><p>No tokens matching "${escapeHtml(searchQuery)}"</p></div>`
                    : `<div class="explorer-loading"><p>No tokens found</p></div>`;
            } else {
                grid.innerHTML = tokens.map(tokenCard).join('');
            }
        }

        currentOffset += tokens.length;
        if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? '' : 'none';

    } catch (err) {
        if (!append) {
            grid.innerHTML = `<div class="explorer-loading"><p>Failed to load tokens. Try refreshing.</p></div>`;
        }
    } finally {
        loading = false;
    }
}

function tokenCard(t) {
    const ticker = escapeHtml(t.symbol || '???');
    const name = escapeHtml(t.name || ticker);
    const age = t.launchedAt ? timeAgo(t.launchedAt) : '';
    const source = escapeHtml(t.source || '');
    const initial = ticker.slice(0, 2);
    const mcap = t.startingMcap ? '$' + formatNumber(t.startingMcap) : '';
    const addr = t.address || '';
    const shortAddr = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';

    const logo = t.imgUrl
        ? `<img src="${escapeHtml(t.imgUrl)}" alt="${ticker}" onerror="this.style.display='none';this.parentElement.textContent='${initial}'">`
        : initial;

    return `<a href="/tokens/${ticker}" class="token-card">
        <div class="token-card-header">
            <div class="token-card-logo">${logo}</div>
            <div class="token-card-info">
                <div class="token-card-name">${name}</div>
                <div class="token-card-ticker">$${ticker}</div>
            </div>
        </div>
        <div class="token-card-meta">
            ${source ? `<span class="token-card-source">${source}</span>` : ''}
            ${age ? `<span class="token-card-age">${age}</span>` : ''}
            ${mcap ? `<span class="token-card-age">${mcap} launch</span>` : ''}
        </div>
        ${addr ? `<div class="token-card-links">
            <span class="token-card-addr">${shortAddr}</span>
            <span class="token-card-link-row">
                <a href="https://app.uniswap.org/swap?outputCurrency=${addr}&chain=base" target="_blank" rel="noopener" class="token-card-action" onclick="event.stopPropagation()">Trade</a>
                <a href="https://basescan.org/token/${addr}" target="_blank" rel="noopener" class="token-card-action" onclick="event.stopPropagation()">BaseScan</a>
            </span>
        </div>` : ''}
    </a>`;
}

function showLoading() {
    grid.innerHTML = `<div class="explorer-loading"><div class="spinner spinner-lg"></div><p>Loading tokens...</p></div>`;
}

// ── Handlers ──
function handleSearch(e) {
    searchQuery = e.target.value.trim();
    loadTokens();
}

function handleSort(e) {
    currentSort = e.target.value;
    loadTokens();
}

function loadMore() {
    loadTokens(true);
}

// ── Boot ──
init();
