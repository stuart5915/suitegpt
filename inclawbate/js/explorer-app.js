// Inclawbate — Token Explorer
import { clawnch } from './clawnch.js';
import { formatNumber, timeAgo, debounce, escapeHtml } from './utils.js';

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
    const desc = escapeHtml((t.description || '').slice(0, 60));
    const age = t.launchedAt ? timeAgo(t.launchedAt) : '';
    const source = escapeHtml(t.source || '');
    const initial = ticker.slice(0, 2);

    return `<a href="/tokens/${ticker}" class="token-card">
        <div class="token-card-header">
            <div class="token-card-logo">${initial}</div>
            <div>
                <div class="token-card-name">${name}</div>
                <div class="token-card-ticker">$${ticker}</div>
            </div>
        </div>
        <div class="token-card-meta">
            ${source ? `<span class="token-card-source">${source}</span>` : ''}
            ${age ? `<span class="token-card-age">${age}</span>` : ''}
        </div>
        ${desc ? `<div class="token-card-desc">${desc}</div>` : ''}
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
