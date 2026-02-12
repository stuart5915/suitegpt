// Inclawbate — Humans Browse Page Controller
import { humansApi } from './humans-api.js';

const grid = document.getElementById('humansGrid');
const searchInput = document.getElementById('humansSearch');
const skillFilter = document.getElementById('skillFilter');
const sortSelect = document.getElementById('sortSelect');
const loadMoreBtn = document.getElementById('loadMoreBtn');

let searchQuery = '';
let currentSkill = '';
let currentSort = 'newest';
let currentOffset = 0;
let hasMore = false;
let loading = false;

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ══════════════════════════════════════
// Dashboard Stats
// ══════════════════════════════════════

function animateCounter(el, target, duration = 1200) {
    const start = performance.now();
    const isLarge = target >= 1000;
    el.classList.add('counting');

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * target);
        el.textContent = isLarge ? current.toLocaleString() : current;
        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            el.textContent = target.toLocaleString();
            setTimeout(() => el.classList.remove('counting'), 300);
        }
    }
    requestAnimationFrame(tick);
}

async function loadDashboardStats() {
    try {
        const resp = await fetch('/api/inclawbate/stats');
        const stats = await resp.json();

        // Animated counters
        const fields = ['total_humans', 'wallets_connected', 'total_clawnch', 'total_hires'];
        fields.forEach(key => {
            const el = document.querySelector(`[data-target="${key}"]`);
            if (el && stats[key] !== undefined) {
                setTimeout(() => animateCounter(el, stats[key]), 400);
            }
        });

        // Top Skills cloud
        const cloud = document.getElementById('skillsCloud');
        if (cloud && stats.top_skills?.length) {
            cloud.innerHTML = stats.top_skills.map((s, i) =>
                `<span class="dash-skill-tag" style="--i: ${i}">${esc(s.skill)}<span class="dash-skill-count">${s.count}</span></span>`
            ).join('');
        } else if (cloud) {
            cloud.innerHTML = '<span class="dash-panel-empty">No skills listed yet</span>';
        }

        // Top Earners
        const earners = document.getElementById('earnersList');
        if (earners && stats.top_earners?.length) {
            earners.innerHTML = stats.top_earners.map((e, i) => {
                const avatar = e.x_avatar_url
                    ? `<img class="dash-earner-avatar" src="${esc(e.x_avatar_url)}" onerror="this.style.display='none'">`
                    : '';
                return `<div class="dash-earner-row" style="--i: ${i}">
                    <span class="dash-earner-rank">${i + 1}</span>
                    ${avatar}
                    <span class="dash-earner-name">${esc(e.x_name || e.x_handle)}</span>
                    <span class="dash-earner-amount">${e.total_earned.toLocaleString()}</span>
                </div>`;
            }).join('');
        } else if (earners) {
            earners.innerHTML = '<span class="dash-panel-empty">No hires yet</span>';
        }

        // Recent Signups
        const recent = document.getElementById('recentList');
        if (recent && stats.recent_signups?.length) {
            recent.innerHTML = stats.recent_signups.map((r, i) => {
                const initial = (r.x_name || r.x_handle || '?')[0].toUpperCase();
                const avatar = r.x_avatar_url
                    ? `<img class="dash-recent-avatar" src="${esc(r.x_avatar_url)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : '';
                const fallback = `<div class="dash-recent-avatar-fallback" ${r.x_avatar_url ? 'style="display:none"' : ''}>${initial}</div>`;
                const walletClass = r.has_wallet ? 'connected' : 'disconnected';
                return `<div class="dash-recent-row" style="--i: ${i}">
                    ${avatar}${fallback}
                    <span class="dash-recent-name">@${esc(r.x_handle)}</span>
                    <span class="dash-recent-wallet-dot ${walletClass}" title="${r.has_wallet ? 'Wallet connected' : 'No wallet'}"></span>
                </div>`;
            }).join('');
        } else if (recent) {
            recent.innerHTML = '<span class="dash-panel-empty">No signups yet</span>';
        }

    } catch (err) {
        // Stats failed silently — not critical
        console.warn('Failed to load dashboard stats:', err);
    }
}

// ══════════════════════════════════════
// Human Cards Grid
// ══════════════════════════════════════

let maxPaid = 1; // track max CLAWNCH across profiles for allocation bars

function humanCard(p) {
    const name = esc(p.x_name || p.x_handle);
    const handle = esc(p.x_handle);
    const tagline = esc(p.tagline || p.bio?.slice(0, 100) || '');
    const initial = (p.x_name || p.x_handle || '?')[0].toUpperCase();

    const avatar = p.x_avatar_url
        ? `<img class="human-card-avatar" src="${esc(p.x_avatar_url)}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
    const fallback = `<div class="human-card-avatar-fallback" ${p.x_avatar_url ? 'style="display:none"' : ''}>${initial}</div>`;

    const skillBadges = (p.skills || []).slice(0, 4).map(s =>
        `<span class="badge badge-primary">${esc(s)}</span>`
    ).join('');

    const hasWallet = !!p.wallet_address;
    const cardClass = hasWallet ? 'human-card' : 'human-card no-wallet';
    const totalPaid = p.total_paid || 0;
    const hires = p.hire_count || 0;
    const barPct = totalPaid > 0 ? Math.max(4, Math.round((totalPaid / maxPaid) * 100)) : 0;

    return `<a href="/u/${handle}" class="${cardClass}">
        <div class="human-card-header">
            ${avatar}${fallback}
            <div>
                <div class="human-card-name">${name}</div>
                <div class="human-card-handle">@${handle}</div>
            </div>
        </div>
        ${tagline ? `<div class="human-card-tagline">${tagline}</div>` : ''}
        ${skillBadges ? `<div class="human-card-skills">${skillBadges}</div>` : ''}
        <div class="human-card-meta">
            ${totalPaid > 0 ? `<span class="human-card-earned">${Math.round(totalPaid).toLocaleString()} CLAWNCH</span>` : '<span class="text-dim">No allocation yet</span>'}
            ${hires > 0 ? `<span class="text-dim">${hires} hire${hires > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${totalPaid > 0 ? `<div class="human-card-bar"><div class="human-card-bar-fill" style="width:${barPct}%"></div></div>` : ''}
        ${!hasWallet ? '<div class="no-wallet-hint">No wallet connected</div>' : ''}
    </a>`;
}

async function loadProfiles(append = false) {
    if (loading) return;
    loading = true;

    if (!append) {
        currentOffset = 0;
        grid.innerHTML = '<div class="humans-loading"><div class="spinner spinner-lg"></div><p>Loading humans...</p></div>';
    }

    try {
        const res = await humansApi.listProfiles({
            search: searchQuery || undefined,
            skill: currentSkill || undefined,
            sort: currentSort,
            offset: currentOffset,
            limit: 48
        });

        const profiles = res.profiles || [];
        hasMore = res.hasMore || false;

        // Calculate max CLAWNCH for allocation bars
        const batchMax = profiles.reduce((max, p) => Math.max(max, p.total_paid || 0), 0);
        if (!append) maxPaid = batchMax || 1;
        else maxPaid = Math.max(maxPaid, batchMax);

        if (append) {
            grid.insertAdjacentHTML('beforeend', profiles.map(humanCard).join(''));
        } else {
            if (profiles.length === 0) {
                grid.innerHTML = `<div class="humans-empty">
                    <p>${searchQuery ? `No humans matching "${esc(searchQuery)}"` : 'No humans yet. Be the first!'}</p>
                    <a href="/launch" class="btn btn-primary mt-lg">Connect X</a>
                </div>`;
            } else {
                grid.innerHTML = profiles.map(humanCard).join('');
            }
        }

        currentOffset += profiles.length;
        if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? '' : 'none';
    } catch (err) {
        if (!append) {
            grid.innerHTML = '<div class="humans-empty"><p>Failed to load profiles. Try refreshing.</p></div>';
        }
    } finally {
        loading = false;
    }
}

// Debounce
function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Events
searchInput?.addEventListener('input', debounce(() => {
    searchQuery = searchInput.value.trim();
    loadProfiles();
}));

skillFilter?.addEventListener('change', () => {
    currentSkill = skillFilter.value;
    loadProfiles();
});

sortSelect?.addEventListener('change', () => {
    currentSort = sortSelect.value;
    loadProfiles();
});

loadMoreBtn?.addEventListener('click', () => loadProfiles(true));

// Boot — load stats and profiles in parallel
loadDashboardStats();
loadProfiles();
