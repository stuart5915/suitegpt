// Inclawbate — Dashboard Controller (Single Overview Page)
import { getStoredAuth, logout } from './x-auth-client.js';

const API_BASE = '/api/inclawbate';

function authHeaders() {
    const token = localStorage.getItem('inclawbate_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Overview ──
async function loadOverview() {
    const auth = getStoredAuth();
    if (!auth) return;
    const profile = auth.profile;

    renderProfileCard(profile);

    const [credits, projects, apps] = await Promise.allSettled([
        fetch(`${API_BASE}/credits`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        profile.wallet_address
            ? fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(profile.wallet_address)}`).then(r => r.ok ? r.json() : null)
            : Promise.resolve(null),
        profile.x_handle
            ? fetch(`${API_BASE}/apps?creator=${encodeURIComponent(profile.x_handle)}`).then(r => r.ok ? r.json() : null)
            : Promise.resolve(null)
    ]);

    const creditsData = credits.status === 'fulfilled' ? credits.value : null;
    const projectsData = projects.status === 'fulfilled' ? projects.value : null;
    const appsData = apps.status === 'fulfilled' ? apps.value : null;

    // Update stat cards
    document.getElementById('ovCredits').textContent = creditsData?.credits ?? 0;
    document.getElementById('ovProjects').textContent = projectsData?.projects?.length ?? 0;
    document.getElementById('ovApps').textContent = appsData?.apps?.length ?? appsData?.total ?? 0;

    renderProjectCards(projectsData?.projects || []);
    renderAppCards(appsData?.apps || []);

    // Render credits inline
    document.getElementById('creditBalance').textContent = creditsData?.credits ?? 0;
    if (creditsData?.api_key) {
        document.getElementById('dashApiKey').value = creditsData.api_key;
    }
}

function renderProfileCard(profile) {
    const card = document.getElementById('overviewProfileCard');
    const name = profile.x_name || profile.x_handle || 'Anonymous';
    const handle = profile.x_handle && !profile.x_handle.startsWith('w_') ? `@${profile.x_handle}` : '';
    const profileHref = profile.x_handle ? `/u/${encodeURIComponent(profile.x_handle)}` : '#';

    let avatarHtml;
    if (profile.x_avatar_url) {
        avatarHtml = `<img src="${esc(profile.x_avatar_url)}" class="overview-profile-avatar" alt="">`;
    } else {
        avatarHtml = `<div class="overview-profile-avatar-fallback">${name[0].toUpperCase()}</div>`;
    }

    card.innerHTML = `
        ${avatarHtml}
        <div class="overview-profile-info">
            <div class="overview-profile-name">${esc(name)}</div>
            ${handle ? `<div class="overview-profile-handle">${esc(handle)}</div>` : ''}
        </div>
        <a href="${profileHref}" class="overview-profile-link">View Profile</a>
        <button type="button" class="overview-profile-link" id="dashDisconnect" style="color:var(--text-dim);border-color:var(--border-subtle);">Disconnect</button>
    `;

    document.getElementById('dashDisconnect')?.addEventListener('click', () => {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
        localStorage.removeItem('inclawbate_last_inbox');
        window.location.reload();
    });
}

function renderProjectCards(projects) {
    const container = document.getElementById('overviewProjectList');
    if (!projects.length) {
        container.innerHTML = '<div class="overview-empty"><p>No projects yet. <a href="/inclawbator">Launch your first token</a></p></div>';
        return;
    }

    container.innerHTML = '';
    projects.slice(0, 5).forEach(p => {
        const status = (p.status || 'pending').toLowerCase();
        const badgeClass = status === 'funded' ? 'funded' : status === 'building' ? 'building' : status === 'live' ? 'live' : 'pending';
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(p.token_name || p.name || 'Untitled')}</div>
                <div class="overview-item-sub">${p.token_ticker ? '$' + esc(p.token_ticker) : ''} ${p.created_at ? '· ' + timeAgo(p.created_at) : ''}</div>
            </div>
            <span class="overview-item-badge ${badgeClass}">${esc(status)}</span>
            <a href="/inclawbator/${p.id}" class="overview-item-action">Manage</a>
        `;
        container.appendChild(el);
    });
}

function renderAppCards(apps) {
    const container = document.getElementById('overviewAppList');
    if (!apps.length) {
        container.innerHTML = '<div class="overview-empty"><p>No apps yet. <a href="/apps">Build your first app</a></p></div>';
        return;
    }

    container.innerHTML = '';
    apps.slice(0, 5).forEach(a => {
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(a.name || 'Untitled App')}</div>
                <div class="overview-item-sub">${a.upvote_count ? a.upvote_count + ' upvotes' : '0 upvotes'} · ${a.category || 'App'}</div>
            </div>
            <div class="app-actions">
                <button type="button" class="overview-item-action app-actions-toggle">Manage</button>
                <div class="app-actions-menu">
                    <a href="/apps/${esc(a.slug || a.id)}">View on Store</a>
                    <button type="button" class="app-actions-delete" data-id="${esc(a.id)}" data-name="${esc(a.name || 'Untitled App')}">Delete</button>
                </div>
            </div>
        `;

        el.querySelector('.app-actions-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = el.querySelector('.app-actions-menu');
            const wasOpen = menu.classList.contains('open');
            closeAllAppMenus();
            if (!wasOpen) menu.classList.add('open');
        });

        el.querySelector('.app-actions-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllAppMenus();
            deleteApp(a.id, a.name || 'Untitled App');
        });

        container.appendChild(el);
    });
}

function closeAllAppMenus() {
    document.querySelectorAll('.app-actions-menu.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', () => closeAllAppMenus());

async function deleteApp(appId, appName) {
    if (!confirm(`Delete "${appName}"? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${API_BASE}/apps`, {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ app_id: appId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to delete app');
            return;
        }
        loadOverview();
    } catch (err) {
        alert('Failed to delete app');
    }
}

// ── Init ──
function init() {
    const auth = getStoredAuth();
    if (!auth) {
        document.getElementById('loginGate').classList.remove('hidden');
        return;
    }

    document.getElementById('dashboardView').classList.remove('hidden');

    // Fetch fresh profile for Telegram status
    const profile = auth.profile;
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data?.profile) {
                localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
            }
        })
        .catch(() => {});

    // Wire credits buttons
    document.getElementById('generateApiKey')?.addEventListener('click', async () => {
        const btn = document.getElementById('generateApiKey');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            const res = await fetch(`${API_BASE}/credits`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ action: 'generate-key' })
            });
            const data = await res.json();
            if (data.api_key) {
                document.getElementById('dashApiKey').value = data.api_key;
            }
        } catch (err) {
            // Silent
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generate';
        }
    });

    document.getElementById('copyApiKey')?.addEventListener('click', () => {
        const input = document.getElementById('dashApiKey');
        if (input.value) {
            navigator.clipboard.writeText(input.value);
            const btn = document.getElementById('copyApiKey');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
    });

    document.getElementById('copyDepositAddr')?.addEventListener('click', () => {
        const input = document.getElementById('depositAddr');
        navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('copyDepositAddr');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });

    loadOverview();
}

// Boot
init();
