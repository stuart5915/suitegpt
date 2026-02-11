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

    const availClass = p.availability || 'available';

    return `<a href="/u/${handle}" class="human-card">
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
            <span class="human-card-availability ${availClass}">${availClass}</span>
            ${(p.hire_count || 0) > 0 ? `<span class="text-dim">${p.hire_count} hire${p.hire_count > 1 ? 's' : ''}</span>` : ''}
        </div>
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

        if (append) {
            grid.insertAdjacentHTML('beforeend', profiles.map(humanCard).join(''));
        } else {
            if (profiles.length === 0) {
                grid.innerHTML = `<div class="humans-empty">
                    <p>${searchQuery ? `No humans matching "${esc(searchQuery)}"` : 'No humans yet. Be the first!'}</p>
                    <a href="/launch" class="btn btn-primary mt-lg">Launch Your Profile</a>
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
        // Load failed
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

// Boot
loadProfiles();
