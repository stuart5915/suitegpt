// Inclawbate — Dashboard Controller (Single Overview Page)

const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

function getStoredAuth() {
    try {
        const token = localStorage.getItem('inclawbate_token');
        const profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
        if (token && profile) {
            // Check if JWT is expired
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                    localStorage.removeItem('inclawbate_token');
                    return null;
                }
            } catch (e) {}
            return { token, profile };
        }
    } catch (e) {}
    return null;
}

const API_BASE = '/api/inclawbate';

// Cached data for project modal dropdowns
let _cachedUserApps = [];
let _cachedTokens = [];

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

function getAllocationUnlockTime(createdAt) {
    return new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
}

function formatCountdown(ms) {
    if (ms <= 0) return '0m';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

// ── Overview ──
async function loadOverview() {
    const auth = getStoredAuth();
    if (!auth) return;
    const profile = auth.profile;

    renderProfileCard(profile);

    // Hide "View all" — all apps now render inline with Manage buttons
    const viewAllLink = document.getElementById('myAppsViewAll');
    if (viewAllLink) viewAllLink.style.display = 'none';

    // Build apps query from all available identifiers
    const appParams = new URLSearchParams();
    if (profile.id) appParams.set('creator_id', profile.id);
    if (profile.wallet_address) appParams.set('creator_wallet', profile.wallet_address);
    if (profile.x_handle) appParams.set('creator_x_handle', profile.x_handle);

    const [credits, apps] = await Promise.allSettled([
        fetch(`${API_BASE}/credits`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        appParams.toString()
            ? fetch(`${API_BASE}/apps?${appParams}`).then(r => {
                if (!r.ok) { console.warn('[dash] apps fetch status:', r.status); return null; }
                return r.json();
            })
            : Promise.resolve(null)
    ]);

    const creditsData = credits.status === 'fulfilled' ? credits.value : null;
    let appsData = apps.status === 'fulfilled' ? apps.value : null;
    if (apps.status === 'rejected') console.warn('[dash] apps fetch rejected:', apps.reason);

    // Fallback: if no apps found, try by handle and/or wallet separately
    if (!appsData?.apps?.length) {
        const fallbacks = [];
        if (profile.x_handle) fallbacks.push(`creator=${encodeURIComponent(profile.x_handle)}`);
        if (profile.wallet_address) fallbacks.push(`creator_wallet=${encodeURIComponent(profile.wallet_address)}`);
        for (const q of fallbacks) {
            try {
                const fb = await fetch(`${API_BASE}/apps?${q}`);
                if (fb.ok) {
                    const d = await fb.json();
                    if (d?.apps?.length) { appsData = d; break; }
                }
            } catch(e) {}
        }
    }

    // Update stat cards
    const creditCount = creditsData?.credits ?? 0;
    const ovCreditsEl = document.getElementById('ovCredits');
    if (ovCreditsEl) ovCreditsEl.textContent = creditCount;
    const ovAppsEl = document.getElementById('ovApps');
    if (ovAppsEl) ovAppsEl.textContent = appsData?.apps?.length ?? appsData?.total ?? 0;

    // Update buy panel balance
    const balEl = document.getElementById('dashBuyBalance');
    if (balEl) balEl.textContent = creditCount + ' credits';

    // Update profile card credits
    const profileCreditsEl = document.getElementById('profileCredits');
    if (profileCreditsEl) profileCreditsEl.textContent = creditCount.toLocaleString();

    _cachedUserApps = appsData?.apps || [];
    renderAppCards(_cachedUserApps);

    loadSavedApps();
}

async function refreshCredits() {
    const btn = document.getElementById('profileCreditsRefresh');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
    try {
        const resp = await fetch(`${API_BASE}/credits`, { headers: authHeaders() });
        if (!resp.ok) return;
        const data = await resp.json();
        const count = data?.credits ?? 0;
        const el = document.getElementById('profileCredits');
        if (el) el.textContent = count.toLocaleString();
        const balEl = document.getElementById('dashBuyBalance');
        if (balEl) balEl.textContent = count + ' credits';
    } catch (e) { /* silent */ }
    finally {
        if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
}

function shortWallet(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function renderProfileCard(profile) {
    const card = document.getElementById('overviewProfileCard');
    card.classList.remove('hidden');
    const name = profile.display_name || shortWallet(profile.wallet_address) || 'Anonymous';
    const walletDisplay = profile.wallet_address ? shortWallet(profile.wallet_address) : '';

    const initial = (profile.display_name || profile.wallet_address || 'A')[0].toUpperCase();
    const avatarHtml = `<div class="overview-profile-avatar-fallback">${initial}</div>`;

    // Privy login info
    let privyInfo = null;
    try { privyInfo = JSON.parse(localStorage.getItem('privy_login_info') || 'null'); } catch(e) {}
    const signInMethod = privyInfo ? (privyInfo.method === 'google' ? 'Google' : privyInfo.method === 'email' ? 'Email' : 'Wallet') : 'Wallet';
    const signInEmail = privyInfo && privyInfo.email ? privyInfo.email : null;
    const displayName = signInEmail || name;

    card.innerHTML = `
        ${avatarHtml}
        <div class="overview-profile-info">
            <div class="overview-profile-name">${esc(displayName)}</div>
            ${signInEmail ? `<div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);margin-top:2px;">Signed in with ${signInMethod}</div>` : ''}
            ${walletDisplay ? `<div class="overview-profile-handle" style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim);">${esc(walletDisplay)}</div>` : ''}
        </div>
        ${profile.wallet_address ? `
        <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;width:100%;margin-top:8px;">
            <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Your Wallet (Base)</div>
            <div style="display:flex;align-items:center;gap:8px;">
                <code style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${profile.wallet_address}</code>
                <button type="button" id="dashCopyWallet" style="background:none;border:1px solid var(--border-subtle);border-radius:6px;padding:3px 8px;color:var(--text-dim);font-size:0.7rem;cursor:pointer;font-family:var(--font-mono);white-space:nowrap;" title="Copy address">Copy</button>
            </div>
            ${privyInfo ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:6px;line-height:1.4;">This wallet was created when you signed in. Tokens and rewards are sent here automatically.</div>' : ''}
        </div>` : ''}
        <div class="profile-credits-area">
            <div class="profile-sub-row">
                <span class="profile-sub-badge" id="profileSubBadge">Free</span>
                <a href="#" class="profile-sub-upgrade" id="profileSubUpgrade">Get a plan</a>
            </div>
            <div class="profile-credits-row">
                <span class="profile-credits-count" id="profileCredits">--</span>
                <span class="profile-credits-label">credits</span>
                <button type="button" class="profile-credits-refresh" id="profileCreditsRefresh" title="Refresh balance">&#x21bb;</button>
                <span class="profile-credits-info" id="profileCreditsInfo" tabindex="0">i
                    <span class="profile-credits-tooltip">Credits are used per AI message in Build Studio. Cost varies by model: Haiku (10), Sonnet (50), Opus (100).</span>
                </span>
            </div>
            <button type="button" class="profile-buy-btn" id="profileBuyBtn">Buy Credits</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <button type="button" class="overview-profile-link" id="dashEditProfile" style="color:var(--lobster-300);border-color:var(--lobster-300);">Edit Profile</button>
            <button type="button" class="overview-profile-link" id="dashDisconnect" style="color:var(--text-dim);border-color:var(--border-subtle);">Disconnect</button>
        </div>
        <div id="dashEditForm" class="hidden" style="width:100%;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">
            <div style="margin-bottom:10px;">
                <label style="font-family:var(--font-mono);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);display:block;margin-bottom:4px;">Display Name</label>
                <input class="input" id="dashEditName" placeholder="How you want to appear" maxlength="100" style="width:100%;font-size:0.9rem;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="font-family:var(--font-mono);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);display:block;margin-bottom:4px;">Tagline</label>
                <input class="input" id="dashEditTagline" placeholder="One line about what you do" maxlength="200" style="width:100%;font-size:0.9rem;">
            </div>
            <div style="display:flex;gap:8px;">
                <button type="button" class="btn btn-primary btn-sm" id="dashEditSave">Save</button>
                <button type="button" class="btn btn-ghost btn-sm" id="dashEditCancel">Cancel</button>
            </div>
        </div>
    `;

    document.getElementById('profileBuyBtn')?.addEventListener('click', () => {
        openBuyModal('credits');
    });

    document.getElementById('profileCreditsRefresh')?.addEventListener('click', refreshCredits);

    document.getElementById('profileSubUpgrade')?.addEventListener('click', (e) => {
        e.preventDefault();
        openBuyModal('subscribe');
    });

    document.getElementById('dashCopyWallet')?.addEventListener('click', function() {
        navigator.clipboard.writeText(profile.wallet_address).then(() => {
            this.textContent = 'Copied!';
            this.style.color = 'var(--seafoam-300)';
            this.style.borderColor = 'var(--seafoam-300)';
            setTimeout(() => { this.textContent = 'Copy'; this.style.color = ''; this.style.borderColor = ''; }, 2000);
        });
    });

    document.getElementById('dashEditProfile')?.addEventListener('click', () => {
        const form = document.getElementById('dashEditForm');
        form.classList.remove('hidden');
        document.getElementById('dashEditName').value = profile.display_name || '';
        document.getElementById('dashEditTagline').value = profile.tagline || '';
        document.getElementById('dashEditProfile').style.display = 'none';
    });

    document.getElementById('dashEditCancel')?.addEventListener('click', () => {
        document.getElementById('dashEditForm').classList.add('hidden');
        document.getElementById('dashEditProfile').style.display = '';
    });

    document.getElementById('dashEditSave')?.addEventListener('click', async () => {
        const btn = document.getElementById('dashEditSave');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            const resp = await fetch(`${API_BASE}/humans`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    display_name: document.getElementById('dashEditName').value.trim() || null,
                    tagline: document.getElementById('dashEditTagline').value.trim()
                })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Save failed');
            // Update local storage and re-render
            const stored = JSON.parse(localStorage.getItem('inclawbate_profile') || '{}');
            Object.assign(stored, data.profile);
            localStorage.setItem('inclawbate_profile', JSON.stringify(stored));
            renderProfileCard(stored);
        } catch (err) {
            alert('Failed to save: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    });

    document.getElementById('dashDisconnect')?.addEventListener('click', () => {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
        localStorage.removeItem('inclawbate_last_inbox');
        window.location.reload();
    });
}

function renderAppCards(apps) {
    const container = document.getElementById('overviewAppList');
    if (!apps.length) {
        container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128736;</div><p>No apps yet.</p><p class="empty-hint"><a href="/build">Build your first app</a> with AI — no code needed.</p></div>';
        return;
    }

    container.innerHTML = '';
    apps.forEach(a => {
        const isPublished = a.is_public !== false;
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(a.name || 'Untitled App')}</div>
                <div class="overview-item-sub">${a.upvote_count ? a.upvote_count + ' upvotes' : '0 upvotes'} · ${a.category || 'App'}</div>
            </div>
            <div class="app-publish-toggle">
                <span class="app-publish-label ${isPublished ? 'is-published' : ''}">${isPublished ? 'Published' : 'Unpublished'}</span>
                <div class="app-publish-switch ${isPublished ? 'on' : ''}" data-app-id="${esc(a.id)}" title="${isPublished ? 'Click to unpublish' : 'Click to publish'}"></div>
            </div>
            <div class="app-actions">
                <button type="button" class="overview-item-action app-actions-toggle">Manage</button>
                <div class="app-actions-menu">
                    <a href="/s/${esc(a.slug || a.id)}" target="_blank">View App</a>
                    <button type="button" class="app-actions-details">Edit Details</button>
                    <button type="button" class="app-actions-edit">Keep Building</button>
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

        el.querySelector('.app-actions-details').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllAppMenus();
            openEditDetailsModal(a, el);
        });

        el.querySelector('.app-actions-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllAppMenus();
            sessionStorage.setItem('edit_source', JSON.stringify({
                app_id: a.id,
                name: a.name || 'Untitled App',
                slug: a.slug,
                code: a.code,
                description: a.description || '',
                category: a.category || 'other',
                tags: a.tags || '',
                claws_price: a.claws_price || 0
            }));
            window.location.href = '/build';
        });

        el.querySelector('.app-actions-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllAppMenus();
            deleteApp(a.id, a.name || 'Untitled App');
        });

        el.querySelector('.app-publish-switch').addEventListener('click', async (e) => {
            e.stopPropagation();
            const sw = e.currentTarget;
            const label = el.querySelector('.app-publish-label');
            sw.style.opacity = '0.5';
            sw.style.pointerEvents = 'none';
            try {
                const res = await fetch(API_BASE + '/apps', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ action: 'toggle-publish', app_id: a.id })
                });
                const data = await res.json();
                if (!res.ok) { alert(data.error || 'Failed'); return; }
                const pub = data.is_public;
                sw.classList.toggle('on', pub);
                sw.title = pub ? 'Click to unpublish' : 'Click to publish';
                label.textContent = pub ? 'Published' : 'Unpublished';
                label.classList.toggle('is-published', pub);
                a.is_public = pub;
            } catch (err) {
                alert('Failed to update');
            } finally {
                sw.style.opacity = '';
                sw.style.pointerEvents = '';
            }
        });

        container.appendChild(el);
    });
}

function closeAllAppMenus() {
    document.querySelectorAll('.app-actions-menu.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', () => closeAllAppMenus());

// ── Edit Details Modal ──
function openEditDetailsModal(app, cardEl) {
    // Remove any existing modal
    document.querySelector('.edit-details-overlay')?.remove();

    const cats = ['games','defi','social','tools','creative','other'];
    const catOpts = cats.map(c => `<option value="${c}"${c === (app.category || 'other') ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'edit-details-overlay';
    overlay.innerHTML = `
        <div class="edit-details-modal">
            <div class="edit-details-header">Edit Details</div>
            <label class="edit-details-label">Name
                <input type="text" class="edit-details-input" id="edName" value="${esc(app.name || '')}" maxlength="100">
            </label>
            <label class="edit-details-label">Slug
                <div style="display:flex;align-items:center;gap:4px">
                    <span style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.75rem;white-space:nowrap">inclawbate.app/s/</span>
                    <input type="text" class="edit-details-input" id="edSlug" value="${esc(app.slug || '')}" maxlength="80" style="margin:0;font-family:var(--font-mono)" placeholder="my-app-name">
                </div>
            </label>
            <label class="edit-details-label">Description
                <textarea class="edit-details-input edit-details-textarea" id="edDesc" maxlength="500" placeholder="What does this app do?">${esc(app.description || '')}</textarea>
            </label>
            <label class="edit-details-label">Category
                <select class="edit-details-input" id="edCat">${catOpts}</select>
            </label>
            <label class="edit-details-label">Tags
                <input type="text" class="edit-details-input" id="edTags" value="${esc(app.tags || '')}" placeholder="comma, separated, tags" maxlength="200">
            </label>
            <label class="edit-details-label" style="flex-direction:row;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="edForkable" ${app.forkable !== false ? 'checked' : ''} style="accent-color:#f97066;width:18px;height:18px;cursor:pointer;">
                <span>Allow others to fork this app</span>
            </label>
            <div class="edit-details-actions">
                <button type="button" class="edit-details-cancel">Cancel</button>
                <button type="button" class="edit-details-save">Save</button>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.edit-details-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.edit-details-save').addEventListener('click', async () => {
        const saveBtn = overlay.querySelector('.edit-details-save');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        try {
            const token = localStorage.getItem('inclawbate_token');
            const resp = await fetch('/api/inclawbate/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    action: 'update-details',
                    app_id: app.id,
                    new_name: document.getElementById('edName').value,
                    new_slug: document.getElementById('edSlug').value,
                    description: document.getElementById('edDesc').value,
                    category: document.getElementById('edCat').value,
                    tags: document.getElementById('edTags').value,
                    forkable: document.getElementById('edForkable').checked
                })
            });
            const data = await resp.json();
            if (resp.status === 401) {
                // Token expired or invalid — prompt re-login
                localStorage.removeItem('inclawbate_token');
                overlay.remove();
                alert('Session expired. Please sign in again.');
                window.location.reload();
                return;
            }
            if (data.updated) {
                if (data.name !== undefined) { app.name = data.name; cardEl.querySelector('.overview-item-title').textContent = data.name; }
                if (data.slug !== undefined) app.slug = data.slug;
                if (data.description !== undefined) app.description = data.description;
                if (data.category !== undefined) { app.category = data.category; cardEl.querySelector('.overview-item-sub').textContent = `${app.upvote_count || 0} upvotes \u00b7 ${data.category}`; }
                if (data.tags !== undefined) app.tags = data.tags;
                overlay.remove();
            } else {
                alert(data.error || 'Save failed');
                saveBtn.textContent = 'Save';
                saveBtn.disabled = false;
            }
        } catch (err) {
            alert('Save failed: ' + err.message);
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    });

    document.body.appendChild(overlay);
    document.getElementById('edName').focus();
}

// ── Saved Apps ──
async function loadSavedApps() {
    const container = document.getElementById('savedAppsList');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE}/apps?saved=true`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        const apps = json.apps || [];
        if (!apps.length) {
            container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128278;</div><p>No saved apps yet.</p><p class="empty-hint"><a href="/apps">Browse the app store</a> and save your favorites.</p></div>';
            return;
        }
        container.innerHTML = '';
        apps.forEach(a => {
            const el = document.createElement('div');
            el.className = 'overview-item';
            el.innerHTML = `
                <div class="overview-item-info">
                    <div class="overview-item-title">${esc(a.name || 'Untitled')}</div>
                    <div class="overview-item-sub">${esc(a.category || 'App')}</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <a href="/s/${esc(a.slug)}" class="overview-item-action" style="text-decoration:none;">Open</a>
                    <button type="button" class="overview-item-action" style="color:#f87171;border-color:hsla(0,60%,50%,0.3);background:none;cursor:pointer;" data-slug="${esc(a.slug)}">Remove</button>
                </div>
            `;
            el.querySelector('button[data-slug]').addEventListener('click', async function () {
                const slug = this.dataset.slug;
                try {
                    await fetch(`${API_BASE}/apps`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ action: 'unsave', app_slug: slug })
                    });
                    loadSavedApps();
                } catch (e) {}
            });
            container.appendChild(el);
        });
    } catch (e) {}
}

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

// ── Applications & Tokens ──
async function loadProjects() {
    const auth = getStoredAuth();
    if (!auth) return;

    const appContainer = document.getElementById('applicationList');
    const tokenContainer = document.getElementById('tokenList');
    if (!appContainer || !tokenContainer) return;

    const profile = auth.profile;
    const wallet = profile.wallet_address;
    if (!wallet) return;

    if (wallet.toLowerCase() === SUPER_ADMIN) loadAdminPending(wallet);

    try {
        const res = await fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(wallet.toLowerCase())}`);
        const data = await res.json();
        const all = data.projects || [];

        // Split: pending/rejected incubation applications vs active projects & tokens
        const applications = all.filter(p => p.tier === 'incubated' && !p.token_address && p.status !== 'active');
        const tokens = all.filter(p => p.token_address);
        _cachedTokens = tokens;

        // Sort each: active first, then pending, then rejected; within group by date desc
        const statusOrder = { active: 0, pending: 1, rejected: 2 };
        const sortFn = (a, b) => {
            const sa = statusOrder[a.status] ?? 1;
            const sb = statusOrder[b.status] ?? 1;
            if (sa !== sb) return sa - sb;
            return new Date(b.created_at) - new Date(a.created_at);
        };
        applications.sort(sortFn);
        tokens.sort(sortFn);

        // Render applications
        appContainer.innerHTML = '';
        if (applications.length > 0) {
            for (const p of applications) {
                appContainer.appendChild(renderProjectCard(p));
            }
        } else {
            appContainer.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#129438;</div><p>No applications yet.</p><p class="empty-hint"><a href="/inclawbator">Request incubation</a> — dev help, marketing, and an AI agent.</p></div>';
        }

        // Render tokens
        tokenContainer.innerHTML = '';
        if (tokens.length > 0) {
            for (const p of tokens) {
                tokenContainer.appendChild(renderProjectCard(p));
            }
            // Fetch prices async (non-blocking)
            fetchTokenPrices(tokens);
            // Fetch LP fees async (non-blocking)
            fetchLPFees(tokens, wallet);
            // Fetch Solana fees async (non-blocking)
            const solTokens = tokens.filter(t => t.chain === 'solana' || (t.token_address && !t.token_address.startsWith('0x')));
            if (solTokens.length > 0) fetchSolanaFees(solTokens);
        }
        // Auto-discover Clanker tokens not yet registered (non-blocking)
        const knownAddrs = all.filter(p => p.token_address).map(p => p.token_address);
        discoverClankerTokens(wallet, knownAddrs);
        if (tokens.length === 0) {
            tokenContainer.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128640;</div><p>No tokens yet.</p><p class="empty-hint"><a href="/inclawbator">Launch your first token</a> on Base, Solana, or Cardano.</p></div>';
        }
    } catch (e) {
        // silent
    }
}

function renderProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';

    const symbol = p.token_symbol || '';
    const name = p.token_name || 'Unknown';
    const status = p.status || 'pending';
    const tier = p.tier || 'permissionless';
    const addr = p.token_address || '';
    const addrShort = addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
    const created = p.created_at ? timeAgo(p.created_at) : '';
    const iconLetter = (symbol || name)[0].toUpperCase();
    const iconHtml = p.logo_url
        ? `<img class="project-card-logo" src="${esc(p.logo_url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            + `<div class="project-card-icon" style="display:none">${iconLetter}</div>`
        : `<div class="project-card-icon">${iconLetter}</div>`;

    // Price row placeholder (filled async)
    const priceRowHtml = addr ? `<div class="project-card-price" id="price-${esc(addr)}" style="display:none"></div>` : '';

    // Fee estimate row (filled async by fetchSingleTokenPrice) + per-card claim button
    const splitBps = p.fee_split_bps || 10000;
    const feeRowHtml = addr ? `<div class="project-card-fee-estimate" id="fee-${esc(addr)}" data-split-bps="${splitBps}" style="display:none"></div>` : '';

    // Chart embed (hidden by default)
    const chartChain = (p.chain === 'solana' || (addr && !addr.startsWith('0x'))) ? 'solana' : 'base';
    const chartHtml = addr ? `<div class="project-card-chart" id="chart-${esc(addr)}" style="display:none">
        <iframe src="https://dexscreener.com/${chartChain}/${esc(addr)}?embed=1&theme=dark&info=0&trades=0" loading="lazy" allowfullscreen></iframe>
    </div>` : '';

    // Build action buttons
    let actionsHtml = '';
    const isSolana = p.chain === 'solana' || (addr && !addr.startsWith('0x'));
    if (addr) {
        if (isSolana) {
            actionsHtml += `<button type="button" class="project-card-action claim-sol-btn" data-token-mint="${esc(addr)}" data-sol-wallet="${esc(p.solana_wallet || '')}" style="display:none">Claim Fees</button>`;
            actionsHtml += `<button type="button" class="project-card-action chart-toggle" data-chart-addr="${esc(addr)}">Chart</button>`;
            actionsHtml += `<a href="https://bags.fm/${esc(addr)}" target="_blank" rel="noopener" class="project-card-action buy">Buy</a>`;
            actionsHtml += `<a href="https://solscan.io/token/${esc(addr)}" target="_blank" rel="noopener" class="project-card-action">Solscan</a>`;
        } else {
            actionsHtml += `<button type="button" class="project-card-action claim-single-btn" data-token-addr="${esc(addr)}" style="display:none">Claim Fees</button>`;
            actionsHtml += `<button type="button" class="project-card-action chart-toggle" data-chart-addr="${esc(addr)}">Chart</button>`;
            actionsHtml += `<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${esc(addr)}&chain=base" target="_blank" rel="noopener" class="project-card-action buy">Buy</a>`;
            actionsHtml += `<a href="https://www.clanker.world/clanker/${esc(addr)}" target="_blank" rel="noopener" class="project-card-action">Clanker</a>`;
            actionsHtml += `<a href="https://basescan.org/address/${esc(addr)}" target="_blank" rel="noopener" class="project-card-action">BaseScan</a>`;
        }
    }
    if (!isSolana && !p.staking_address && status === 'active' && addr) {
        actionsHtml += `<button type="button" class="project-card-action primary" data-deploy-pool="${esc(addr)}" data-project-id="${esc(p.id)}" data-token-name="${esc(name)}">Create Pool</button>`;
    }
    if (p.staking_address) {
        actionsHtml += `<button type="button" class="project-card-action primary" data-pool="${esc(p.staking_address)}" data-name="${esc(name)}" data-project="${esc(p.id)}">Fund Rewards</button>`;
    }
    if (p.agent_enabled) {
        actionsHtml += `<a href="/inclawbator#agent" class="project-card-action">Manage Agent</a>`;
    }
    if (p.id) {
        actionsHtml += `<button type="button" class="project-card-action" data-settings-project="${esc(p.id)}">Settings</button>`;
    }
    // Edit / Delete for incubation applications (no token launched yet)
    if (tier === 'incubated' && !addr) {
        actionsHtml += `<button type="button" class="project-card-action" data-edit-project="${esc(p.id)}">Edit</button>`;
        if (status === 'pending' || status === 'rejected') {
            actionsHtml += `<button type="button" class="project-card-action" data-delete-project="${esc(p.id)}" data-delete-name="${esc(name)}">Delete</button>`;
        }
    }

    // Allocation section
    let allocationHtml = '';
    if (p.allocation_pct > 0 && addr) {
        if (p.allocation_claimed_at) {
            allocationHtml = `<div class="project-allocation-section claimed">
                <div class="allocation-row">
                    <span class="alloc-label">&#128274; ${p.allocation_pct}% Allocation</span>
                    <span class="allocation-claimed-badge">Claimed</span>
                </div>
            </div>`;
        } else {
            const unlockTime = getAllocationUnlockTime(p.created_at);
            const remaining = unlockTime - Date.now();
            if (remaining > 0) {
                allocationHtml = `<div class="project-allocation-section locked" data-unlock="${unlockTime}">
                    <div class="allocation-row">
                        <span class="alloc-label">&#128274; ${p.allocation_pct}% Allocation</span>
                        <span class="allocation-countdown">Unlocks in ${formatCountdown(remaining)}</span>
                    </div>
                </div>`;
            } else {
                allocationHtml = `<div class="project-allocation-section unlocked">
                    <div class="allocation-row">
                        <span class="alloc-label">&#128275; ${p.allocation_pct}% Allocation</span>
                        <span class="allocation-claimable">Claimable now!</span>
                    </div>
                    <button type="button" class="allocation-claim-btn"
                        data-token="${esc(addr)}"
                        data-project="${esc(p.id)}"
                        data-alloc="${p.allocation_pct}">Claim Allocation</button>
                    <div class="allocation-result"></div>
                </div>`;
            }
        }
    }

    card.innerHTML = `
        <div class="project-card-header">
            ${iconHtml}
            <div class="project-card-title">
                <span class="project-card-name">${esc(name)}</span>
                ${symbol ? `<span class="project-card-symbol">$${esc(symbol)}</span>` : ''}
            </div>
            ${addr ? `<span class="project-card-addr-inline"><a href="${isSolana ? 'https://solscan.io/token/' : 'https://basescan.org/address/'}${esc(addr)}" target="_blank" rel="noopener" class="project-card-address">${addrShort}</a><button type="button" class="project-card-copy" data-copy="${esc(addr)}" title="Copy address">&#128203;</button></span>` : ''}
            ${created ? `<span class="project-card-time">${created}</span>` : ''}
            <div class="project-card-badges">
                <span class="project-status-badge ${esc(status)}">${esc(status)}</span>
                ${addr ? `<span class="project-status-badge chain-badge-${isSolana ? 'solana' : 'base'}">${isSolana ? 'Solana' : 'Base'}</span>` : ''}
                ${p.allocation_pct > 0 ? `<span class="project-status-badge" style="background:hsla(9,52%,56%,0.15);color:#e07356;border-color:hsla(9,52%,56%,0.3)">${p.allocation_pct}%</span>` : ''}
            </div>
        </div>
        ${priceRowHtml}
        ${feeRowHtml}
        ${actionsHtml ? `<div class="project-card-actions">${actionsHtml}</div>` : ''}
        ${allocationHtml}
        ${chartHtml}
    `;

    // Wire copy button
    card.querySelector('.project-card-copy')?.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.copy;
        navigator.clipboard.writeText(text);
        e.currentTarget.textContent = '✓';
        setTimeout(() => { e.currentTarget.innerHTML = '&#128203;'; }, 1500);
    });

    // Wire chart toggle
    card.querySelector('.chart-toggle')?.addEventListener('click', (e) => {
        const chartAddr = e.currentTarget.dataset.chartAddr;
        const chartDiv = document.getElementById('chart-' + chartAddr);
        if (chartDiv) {
            const isOpen = chartDiv.style.display !== 'none';
            chartDiv.style.display = isOpen ? 'none' : 'block';
            e.currentTarget.textContent = isOpen ? 'Chart' : 'Hide Chart';
        }
    });

    // Wire fund button
    card.querySelector('.project-card-action.primary[data-pool]')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        openFundModal(btn.dataset.pool, btn.dataset.name, btn.dataset.project);
    });

    // Wire create pool button
    card.querySelector('[data-deploy-pool]')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        deployStakingPool(btn.dataset.deployPool, btn.dataset.projectId, btn.dataset.tokenName, btn);
    });

    // Wire edit button
    card.querySelector('[data-edit-project]')?.addEventListener('click', () => {
        openEditApplicationModal(p);
    });

    // Wire delete button
    card.querySelector('[data-delete-project]')?.addEventListener('click', (e) => {
        deleteApplication(e.currentTarget.dataset.deleteProject, e.currentTarget.dataset.deleteName);
    });

    // Wire settings button
    card.querySelector('[data-settings-project]')?.addEventListener('click', () => {
        openTokenSettingsModal(p);
    });

    // Wire allocation claim button
    card.querySelector('.allocation-claim-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        claimAllocation(btn.dataset.token, btn.dataset.project, parseInt(btn.dataset.alloc), btn);
    });

    // Wire per-card claim fees button (Base/ETH)
    card.querySelector('.claim-single-btn')?.addEventListener('click', (e) => {
        const auth = getStoredAuth();
        if (auth && auth.profile.wallet_address) {
            claimLPFees(auth.profile.wallet_address, e.currentTarget);
        }
    });

    // Wire per-card Solana claim fees button
    card.querySelector('.claim-sol-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        let solWallet = btn.dataset.solWallet || (window._phantomSolana && window._phantomSolana.publicKey ? window._phantomSolana.publicKey.toString() : '');
        const tokenMint = btn.dataset.tokenMint;
        if (!solWallet) {
            btn.disabled = true; btn.textContent = 'Connect wallet...';
            solWallet = await window.connectSolanaWallet();
            if (!solWallet) { btn.disabled = false; btn.textContent = 'Claim'; return; }
        }
        if (tokenMint) claimSolanaFees(solWallet, tokenMint, btn).catch(err => { alert(err.message); btn.disabled = false; btn.textContent = 'Claim'; });
    });

    return card;
}

// ── Token Price Fetch ──
window._tokenVolumes = {}; // addr.toLowerCase() → { volume24h, ethPrice }

async function fetchTokenPrices(tokens) {
    const addrs = tokens.filter(p => p.token_address).map(p => p.token_address);
    if (!addrs.length) return;

    // Dedupe and fetch each, wait for all to settle
    const unique = [...new Set(addrs.map(a => a.toLowerCase()))];
    await Promise.allSettled(unique.map(addr => fetchSingleTokenPrice(addr)));

    // Fallback: any fee rows still hidden → show "No trading activity"
    for (const addr of addrs) {
        const feeEl = document.getElementById('fee-' + addr);
        if (feeEl && feeEl.style.display === 'none') {
            feeEl.innerHTML = '<span class="fee-estimate-value fee-none">No trading activity (24h)</span>';
            feeEl.style.display = '';
        }
    }
}

async function fetchSingleTokenPrice(addr) {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + addr);
        const data = await res.json();
        if (!data || !data.pairs || !data.pairs.length) return;

        // Pick best pair by liquidity
        const candidates = data.pairs.filter(function(p) {
            return p.baseToken && p.baseToken.address &&
                p.baseToken.address.toLowerCase() === addr.toLowerCase() &&
                parseFloat(p.priceUsd) > 0;
        });
        if (!candidates.length) return;
        candidates.sort(function(a, b) {
            return (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0);
        });

        const best = candidates[0];
        const price = parseFloat(best.priceUsd);
        const change24h = parseFloat(best.priceChange?.h24) || 0;
        const liq = parseFloat(best.liquidity?.usd) || 0;
        const volume24h = parseFloat(best.volume?.h24) || 0;

        // Store volume for per-token fee estimates
        // Find WETH/ETH price from the pair's quote token
        let ethPrice = 0;
        if (best.quoteToken && best.quoteToken.symbol === 'WETH' && best.priceNative) {
            ethPrice = price / parseFloat(best.priceNative);
        }
        window._tokenVolumes[addr.toLowerCase()] = { volume24h, ethPrice };

        // Update fee row if it exists
        const feeEl = document.getElementById('fee-' + addr) || document.getElementById('fee-' + best.baseToken.address);
        if (feeEl) {
            const splitBps = parseInt(feeEl.dataset.splitBps) || 10000;
            if (volume24h > 0 && ethPrice > 0) {
                const feeUsd = volume24h * 0.01 * (splitBps / 10000);
                const feeEth = feeUsd / ethPrice;
                const volStr = volume24h >= 1000 ? '$' + (volume24h / 1000).toFixed(1) + 'K' : '$' + Math.round(volume24h);
                feeEl.innerHTML = `<span class="fee-estimate-value">~${feeEth.toFixed(6)} ETH earned (24h)</span><span class="fee-estimate-vol">Vol: ${volStr}</span>`;
                feeEl.style.display = '';
                // Per-card fee estimate is shown in the fee row above;
                // claim button just says "Claim Fees" since Clanker pools all fees
            } else if (volume24h === 0) {
                feeEl.innerHTML = '<span class="fee-estimate-value fee-none">No trading activity (24h)</span>';
                feeEl.style.display = '';
            }
        }

        // Update DOM
        const el = document.getElementById('price-' + addr) || document.getElementById('price-' + best.baseToken.address);
        if (!el) return;

        const changeClass = change24h >= 0 ? 'up' : 'down';
        const changeArrow = change24h >= 0 ? '▲' : '▼';
        const changeSign = change24h >= 0 ? '+' : '';
        const liqStr = liq >= 1000 ? '$' + (liq / 1000).toFixed(1) + 'K' : '$' + Math.round(liq);

        el.innerHTML = `
            <span class="price-value">$${formatPrice(price)}</span>
            <span class="price-change ${changeClass}">${changeArrow} ${changeSign}${change24h.toFixed(1)}%</span>
            <span class="price-liq">Liq: ${liqStr}</span>
        `;
        el.style.display = '';
    } catch (e) {
        // silent — price just won't show
    }
}

function formatPrice(n) {
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    // Count leading zeros after decimal
    const str = n.toFixed(20);
    const match = str.match(/^0\.(0+)/);
    const zeros = match ? match[1].length : 0;
    if (zeros >= 4) {
        // Subscript notation: 0.0₅1234
        const sig = str.slice(2 + zeros, 2 + zeros + 4);
        return '0.0<sub>' + zeros + '</sub>' + sig;
    }
    return n.toFixed(zeros + 4);
}

// ── LP Fee Claiming (wallet-level, not per-token) ──
async function fetchLPFees(tokens, wallet) {
    if (!wallet) return;
    try {
        // feesToClaim(wallet, WETH) — total across all Clanker tokens
        const wethData = FEE_SEL.feesToClaim + pad32(wallet) + pad32(WETH_BASE);
        const wethHex = await rpcCall(CLANKER_FEE_LOCKER, wethData);
        const wethAmt = fromWei(wethHex);

        if (wethAmt <= 0) {
            const hideBtn = document.getElementById('claimAllEthBtn');
            if (hideBtn) hideBtn.style.display = 'none';
            document.querySelectorAll('.claim-single-btn').forEach(btn => btn.style.display = 'none');
            return;
        }

        // Per-card buttons: just show "Claim Fees" (no amount) since
        // Clanker pools fees across all tokens — clicking any card claims everything.
        // The per-token fee ESTIMATE is already shown in the fee row above.
        document.querySelectorAll('.claim-single-btn').forEach(btn => {
            btn.style.display = '';
            btn.textContent = 'Claim Fees';
        });

        // Show Claim All ETH header button
        const claimAllEthBtn = document.getElementById('claimAllEthBtn');
        if (claimAllEthBtn) {
            claimAllEthBtn.textContent = 'Claim ' + wethAmt.toFixed(6) + ' ETH';
            claimAllEthBtn.style.display = '';
            const freshBtn = claimAllEthBtn.cloneNode(true);
            claimAllEthBtn.parentNode.replaceChild(freshBtn, claimAllEthBtn);
            freshBtn.addEventListener('click', () => claimLPFees(wallet, freshBtn));
        }
    } catch (e) {
        // silent
    }
}

async function claimLPFees(wallet, btn) {
    try {
        const provider = window.ethereum;
        if (!provider) { alert('No wallet connected'); return; }

        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        wallet = accounts[0];

        // Switch to Base
        try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        } catch (e) {
            alert('Please switch to Base network');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Claiming...';

        // Claim WETH fees
        const claimData = FEE_SEL.claim + pad32(wallet) + pad32(WETH_BASE);
        const receipt = await sendTx(wallet, CLANKER_FEE_LOCKER, claimData);
        if (receipt.status === '0x0') throw new Error('Claim reverted');

        btn.textContent = 'Claimed!';

        // Re-fetch after delay
        setTimeout(() => {
            const auth = getStoredAuth();
            if (auth && auth.profile.wallet_address) {
                fetchLPFees([], auth.profile.wallet_address);
            }
        }, 3000);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Claim';
        alert(e.message || 'Claim failed');
    }
}

// ── Solana Fee Claiming (via Bags API) ──
let _solClaimablePositions = []; // cached positions from fetchSolanaFees

async function fetchSolanaFees(solTokens) {
    // Determine Solana wallet: Phantom connected or stored in project data
    const phantomKey = window._phantomSolana && window._phantomSolana.publicKey
        ? window._phantomSolana.publicKey.toString() : null;
    const dbWallet = (solTokens.find(t => t.solana_wallet) || {}).solana_wallet || null;
    const solWallet = phantomKey || dbWallet;
    if (!solWallet) return;

    try {
        const token = localStorage.getItem('inclawbate_token');
        const resp = await fetch('/api/inclawbate/inclawbator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ action: 'bags-claimable-fees', solana_wallet: solWallet })
        });
        const data = await resp.json();
        if (!resp.ok || data.error) return;

        const positions = Array.isArray(data) ? data : (data.response || data.positions || data.data || []);

        // Build set of our token mints for filtering
        const ourMints = new Set(solTokens.map(t => t.token_address).filter(Boolean));

        // Filter to only our tokens with claimable lamports > 0
        const claimable = positions.length
            ? positions.filter(p => ourMints.has(p.baseMint) && parseInt(p.totalClaimableLamportsUserShare || 0) > 0)
            : [];

        // Hide per-card buttons + header btn when nothing is claimable
        if (!claimable.length) {
            document.querySelectorAll('.claim-sol-btn').forEach(b => b.style.display = 'none');
            const hideBtn = document.getElementById('claimAllSolBtn');
            if (hideBtn) hideBtn.style.display = 'none';
            _solClaimablePositions = [];
            return;
        }

        _solClaimablePositions = claimable;
        const totalSol = claimable.reduce((sum, p) => sum + parseInt(p.totalClaimableLamportsUserShare || 0), 0) / 1e9;

        // Show per-card claim buttons for tokens with claimable fees
        const solPerToken = {};
        claimable.forEach(p => { solPerToken[p.baseMint] = parseInt(p.totalClaimableLamportsUserShare || 0) / 1e9; });
        const claimableMints = new Set(claimable.map(p => p.baseMint));
        document.querySelectorAll('.claim-sol-btn').forEach(btn => {
            if (claimableMints.has(btn.dataset.tokenMint)) {
                if (!btn.dataset.solWallet) btn.dataset.solWallet = solWallet;
                const amt = solPerToken[btn.dataset.tokenMint];
                btn.textContent = amt ? 'Claim ~' + amt.toFixed(6) + ' SOL' : 'Claim Fees';
                btn.style.display = '';
            }
        });

        // Show Claim All SOL header button
        const claimAllSolBtn = document.getElementById('claimAllSolBtn');
        if (claimAllSolBtn) {
            claimAllSolBtn.textContent = 'Claim ' + totalSol.toFixed(6) + ' SOL';
            claimAllSolBtn.style.display = '';
            const freshBtn = claimAllSolBtn.cloneNode(true);
            claimAllSolBtn.parentNode.replaceChild(freshBtn, claimAllSolBtn);
            freshBtn.addEventListener('click', async () => {
                freshBtn.disabled = true;
                freshBtn.textContent = 'Claiming...';
                try {
                    for (const pos of claimable) {
                        await claimSolanaFees(solWallet, pos.baseMint, null);
                    }
                    freshBtn.textContent = 'Claimed!';
                    setTimeout(() => {
                        const st = solTokens.filter(t => t.chain === 'solana' || (t.token_address && !t.token_address.startsWith('0x')));
                        if (st.length) fetchSolanaFees(st);
                    }, 3000);
                } catch (e) {
                    freshBtn.disabled = false;
                    freshBtn.textContent = 'Claim ' + totalSol.toFixed(6) + ' SOL';
                    alert(e.message || 'Claim failed');
                }
            });
        }
    } catch (e) {
        // silent
    }
}

async function claimSolanaFees(solWallet, tokenMint, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Claiming...'; }

    // Ensure Solana wallet is connected for signing
    const hasPhantom = window._solanaProvider === 'phantom' && window._phantomSolana;
    const hasWalletStd = window._solanaWalletStd && window._solanaAccount;
    if (!hasPhantom && !hasWalletStd) {
        if (btn) { btn.textContent = 'Connect wallet...'; }
        const connected = await window.connectSolanaWallet();
        if (!connected) {
            if (btn) { btn.disabled = false; btn.textContent = 'Claim'; }
            throw new Error('Solana wallet must be connected to claim fees');
        }
    }

    const token = localStorage.getItem('inclawbate_token');
    const resp = await fetch('/api/inclawbate/inclawbator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ action: 'bags-claim-tx', solana_wallet: solWallet, token_mint: tokenMint })
    });
    const data = await resp.json();
    console.log('[SolClaim] Raw API response:', JSON.stringify(data).slice(0, 1000));
    if (!resp.ok || data.error) throw new Error(data.error || 'Failed to get claim transactions');

    // Unwrap: Bags API may nest txs under various keys
    let txs;
    if (Array.isArray(data)) {
        txs = data;
    } else {
        const inner = data.response || data.transactions || data.claimTransactions
            || data.txs || data.data || data.result;
        if (Array.isArray(inner)) {
            txs = inner;
        } else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            // inner might itself be a wrapper with transactions array
            const nested = inner.transactions || inner.claimTransactions || inner.txs || inner.data;
            txs = Array.isArray(nested) ? nested : [inner];
        } else if (typeof inner === 'string') {
            txs = [inner];
        } else {
            // Last resort: if data has a transaction/serializedTransaction string, treat as single tx
            if (data.transaction || data.serializedTransaction) {
                txs = [data];
            } else {
                console.error('[SolClaim] Could not find transactions in response:', Object.keys(data));
                throw new Error('Unexpected claim response format. Keys: ' + Object.keys(data).join(', '));
            }
        }
    }
    console.log('[SolClaim] Extracted', txs.length, 'transaction(s)');

    for (const tx of txs) {
        console.log('[SolClaim] tx type:', typeof tx, typeof tx === 'object' && tx !== null ? Object.keys(tx) : '');
        const txBytes = decodeSolTxData(tx);
        await window.signAndSendSolanaTransaction(txBytes);
    }

    if (btn) { btn.textContent = 'Claimed!'; }
}

// Decode Solana transaction data (base58/base64/buffer) — mirrors decodeTxData from inclawbator-app.js
function decodeSolTxData(data) {
    if (!data) throw new Error('No transaction data');
    if (data instanceof Uint8Array) return data;
    if (Array.isArray(data)) return new Uint8Array(data);
    if (typeof data === 'object' && data !== null) {
        // Try known string fields
        if (typeof data.transaction === 'string') return decodeSolTxData(data.transaction);
        if (typeof data.serializedTransaction === 'string') return decodeSolTxData(data.serializedTransaction);
        if (typeof data.tx === 'string') return decodeSolTxData(data.tx);
        if (typeof data.rawTransaction === 'string') return decodeSolTxData(data.rawTransaction);
        // Buffer-like shapes
        if (data.data && Array.isArray(data.data)) return new Uint8Array(data.data);
        if (data.type === 'Buffer' && data.data) return new Uint8Array(data.data);
        // Numeric-keyed object (serialized byte array)
        const keys = Object.keys(data);
        if (keys.length > 0 && !isNaN(keys[0])) {
            const arr = new Uint8Array(keys.length);
            for (let i = 0; i < keys.length; i++) arr[i] = data[keys[i]];
            return arr;
        }
        // If object has a single string value, try it as tx data
        if (keys.length === 1 && typeof data[keys[0]] === 'string') {
            return decodeSolTxData(data[keys[0]]);
        }
        console.error('[SolClaim] Unknown tx object keys:', keys, JSON.stringify(data).slice(0, 500));
        throw new Error('Unknown tx object format. Keys: ' + keys.join(', '));
    }
    if (typeof data !== 'string') throw new Error('Unknown tx format: ' + typeof data);
    // Base64 if contains +, /, or =
    if (/[+\/=]/.test(data)) {
        try { return Uint8Array.from(atob(data), c => c.charCodeAt(0)); } catch(e) {}
    }
    // Base58 decode
    const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = [0];
    for (let i = 0; i < data.length; i++) {
        const idx = BASE58.indexOf(data[i]);
        if (idx < 0) throw new Error('Invalid base58 character: ' + data[i]);
        let carry = idx;
        for (let j = 0; j < result.length; j++) {
            carry += result[j] * 58;
            result[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) { result.push(carry & 0xff); carry >>= 8; }
    }
    for (let i = 0; i < data.length && data[i] === '1'; i++) result.push(0);
    return new Uint8Array(result.reverse());
}

// ── Staking Pools ──
const BASE_RPCS = [
    'https://base.llamarpc.com',
    'https://base-mainnet.public.blastapi.io',
    'https://base.drpc.org',
    'https://mainnet.base.org'
];
const CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_SEL = {
    approve:        '0x095ea7b3',
    depositRewards: '0xbdd071fb',
    totalStaked:    '0x817b1cd2',
    stakerCount:    '0xdff69787',
    rewardRate:     '0x7b0a47ee',
    periodEnd:      '0x506ec095',
    pause:          '0x8456cb59',
    unpause:        '0x3f4ba83a',
    paused:         '0x5c975abb',
};
// ── My Staking Positions (user's personal stakes across all pools) ──
const MY_STAKING_POOLS = {
    claws:     { name: 'CLAWS',               ticker: 'CLAWS',     staking: '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40', rewardTicker: 'CLAWS',     logo: '/inclawbate/assets/clawslogo.jpg' },
    inclawnch: { name: 'inCLAWNCH',           ticker: 'INCLAWNCH', staking: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6', rewardTicker: 'INCLAWNCH', logo: '/inclawbate/assets/logo-circle.jpg', retired: true },
    s4h:       { name: 'Salvation 4 Humanity', ticker: 'S4H',      staking: '0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D', rewardTicker: 'CLAWS',     logo: '/salvation4humanity/assets/s4hlogo.png' },
    clawnch:   { name: 'CLAWNCH',             ticker: 'CLAWNCH',   staking: '0xAda0e738F0E4DEb4e2C0B83d6836DE953f2e57b9', rewardTicker: 'INCLAWNCH', logo: '/inclawbate/assets/clawnchlogo.jpg' },
    clawnstr:  { name: 'ClawnStrategy',       ticker: 'CLAWNSTR',  staking: '0x9f7cD1C3e4526937736629a400acBdcA50836848', rewardTicker: 'CLAWNSTR',  logo: '/inclawbate/assets/clawnstr-logo.jpg' },
    bv7x:      { name: 'BitVault Signal',     ticker: 'BV7X',      staking: '0x65Aec0C9fd455822F1cC0e3De7965B106d182017', rewardTicker: 'BV7X',      logo: '/inclawbate/assets/bv7x-logo.jpg' },
};
const STAKING_USER_SEL = {
    balanceOf: '0x70a08231',
    earned:    '0x008cc262',
};
const STAKING_ACTION_SEL = {
    claim:           '0x4e71d92d', // claim()
    claimAndRestake: '0xf755d8c3', // claimAndRestake()
};
let _myPositions = []; // cached for claim-all

async function rpcBatchCall(calls) {
    const body = calls.map((c, i) => ({
        jsonrpc: '2.0', id: i + 1, method: 'eth_call',
        params: [{ to: c.to, data: c.data }, 'latest']
    }));
    for (const url of BASE_RPCS) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            const json = await res.json();
            if (!Array.isArray(json)) continue;
            json.sort((a, b) => a.id - b.id);
            return json.map(r => safeHex(r && r.result));
        } catch (e) { continue; }
    }
    return calls.map(() => '0x0');
}

async function loadMyStakingPositions() {
    const container = document.getElementById('myStakingPositionsList');
    if (!container) return;

    const auth = getStoredAuth();
    if (!auth || !auth.profile?.wallet_address) {
        container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128176;</div><p>No staking positions yet.</p><p class="empty-hint"><a href="/stake">Explore staking pools</a> to start earning rewards.</p></div>';
        return;
    }

    // Merge dynamic Inclawbator pools into MY_STAKING_POOLS
    try {
        const resp = await fetch('/api/inclawbate/inclawbator');
        if (resp.ok) {
            const data = await resp.json();
            (data.projects || []).forEach(p => {
                if (!p.staking_address || !p.token_address) return;
                const key = p.token_symbol.toLowerCase();
                if (MY_STAKING_POOLS[key]) return;
                MY_STAKING_POOLS[key] = {
                    name: p.token_name,
                    ticker: p.token_symbol,
                    staking: p.staking_address,
                    rewardTicker: 'CLAWS',
                    logo: p.logo_url || '',
                };
            });
        }
    } catch (e) {}

    const wallet = auth.profile.wallet_address;
    const addrPadded = pad32(wallet);
    const keys = Object.keys(MY_STAKING_POOLS);

    // Build batch: 5 calls per pool (balanceOf, earned, rewardRate, totalStaked, periodEnd)
    const CALLS_PER_POOL = 5;
    const calls = [];
    keys.forEach(key => {
        const pool = MY_STAKING_POOLS[key];
        calls.push({ to: pool.staking, data: STAKING_USER_SEL.balanceOf + addrPadded });
        calls.push({ to: pool.staking, data: STAKING_USER_SEL.earned + addrPadded });
        calls.push({ to: pool.staking, data: STAKING_SEL.rewardRate });
        calls.push({ to: pool.staking, data: STAKING_SEL.totalStaked });
        calls.push({ to: pool.staking, data: STAKING_SEL.periodEnd });
    });

    const results = await rpcBatchCall(calls);

    const now = Math.floor(Date.now() / 1000);
    const positions = [];
    keys.forEach((key, i) => {
        const base = i * CALLS_PER_POOL;
        const staked = fromWei(results[base]);
        const earned = fromWei(results[base + 1]);
        if (staked > 0 || earned > 0) {
            const rewardRate = fromWei(results[base + 2]);
            const totalStaked = fromWei(results[base + 3]);
            const periodEnd = Number(BigInt(results[base + 4] || '0x0'));
            const active = periodEnd > now;
            // User's share of daily rewards
            let dailyReward = 0;
            if (active && totalStaked > 0 && staked > 0) {
                dailyReward = (rewardRate * 86400) * (staked / totalStaked);
            }
            positions.push({ key, ...MY_STAKING_POOLS[key], staked, earned, dailyReward, active });
        }
    });

    if (positions.length === 0) {
        container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128176;</div><p>No staking positions.</p><p class="empty-hint"><a href="/stake">Explore staking pools</a> to start earning rewards.</p></div>';
        _myPositions = [];
        const actionsEl = document.getElementById('mysActions');
        if (actionsEl) actionsEl.style.display = 'none';
        return;
    }

    _myPositions = positions;
    container.innerHTML = positions.map(renderMyStakingCard).join('');

    // Show claim/compound buttons if any position has earned > 0
    const hasEarnings = positions.some(p => p.earned > 0);
    const actionsEl = document.getElementById('mysActions');
    if (actionsEl) actionsEl.style.display = hasEarnings ? 'flex' : 'none';
}

function renderMyStakingCard(pos) {
    const retiredBadge = pos.retired
        ? ' <span class="my-staking-retired">Retired</span>'
        : '';
    let rateStr = '';
    if (pos.dailyReward > 0) {
        const dailyStr = pos.dailyReward >= 1 ? fmt(Math.round(pos.dailyReward)) : pos.dailyReward.toFixed(2);
        rateStr = `<span class="mys-rate">${dailyStr}/day</span>`;
    } else if (!pos.active && !pos.retired) {
        rateStr = `<span class="mys-rate ended">Ended</span>`;
    }
    return `
        <a href="/stake/${pos.key}" class="mys-row">
            <div class="mys-token">
                <img src="${pos.logo}" alt="${esc(pos.name)}" class="mys-logo" onerror="this.style.display='none'">
                <div class="mys-token-info">
                    <span class="mys-name">${esc(pos.name)}${retiredBadge}</span>
                    <span class="mys-ticker">${esc(pos.ticker)}</span>
                </div>
            </div>
            <div class="mys-col"><span class="mys-val">${fmt(pos.staked)}</span><span class="mys-label">Staked</span></div>
            <div class="mys-col"><span class="mys-val">${fmt(pos.earned)}</span><span class="mys-label">${esc(pos.rewardTicker)} Earned</span></div>
            <div class="mys-col mys-col-rate">${rateStr}</div>
        </a>`;
}

async function claimAllPositions(compound) {
    const provider = window.ethereum;
    if (!provider) { alert('Please connect your wallet first.'); return; }

    const claimable = _myPositions.filter(p => {
        if (p.earned <= 0) return false;
        // Compound only works for same-token pools (stake token = reward token)
        if (compound && p.rewardTicker !== p.ticker) return false;
        return true;
    });
    if (claimable.length === 0) {
        alert(compound ? 'No compoundable positions (only same-token pools can compound).' : 'No rewards to claim.');
        return;
    }

    const action = compound ? 'Compound' : 'Claim';
    const poolNames = claimable.map(p => p.ticker).join(', ');
    if (!confirm(action + ' rewards from ' + claimable.length + ' pool' + (claimable.length > 1 ? 's' : '') + '?\n(' + poolNames + ')\n\nYou\'ll confirm each transaction in your wallet.')) return;

    const btn = document.getElementById(compound ? 'mysCompoundAll' : 'mysClaimAll');
    const otherBtn = document.getElementById(compound ? 'mysClaimAll' : 'mysCompoundAll');
    if (btn) { btn.disabled = true; btn.textContent = action + 'ing...'; }
    if (otherBtn) otherBtn.disabled = true;

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const wallet = accounts[0];

    // Ensure Base chain
    try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        if (chainId !== '0x2105') {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        }
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = action + ' All'; }
        if (otherBtn) otherBtn.disabled = false;
        return;
    }

    const selector = compound ? STAKING_ACTION_SEL.claimAndRestake : STAKING_ACTION_SEL.claim;
    let success = 0, failed = 0;

    for (let i = 0; i < claimable.length; i++) {
        const pos = claimable[i];
        if (btn) btn.textContent = action + 'ing ' + (i + 1) + '/' + claimable.length + '...';
        try {
            await sendTx(wallet, pos.staking, selector);
            success++;
        } catch (e) {
            console.warn(action + ' failed for ' + pos.ticker + ':', e);
            failed++;
        }
    }

    if (btn) { btn.disabled = false; btn.textContent = action + ' All'; }
    if (otherBtn) otherBtn.disabled = false;

    const msg = success + ' of ' + claimable.length + ' ' + action.toLowerCase() + (success !== 1 ? 's' : '') + ' successful.';
    alert(msg + (failed > 0 ? ' (' + failed + ' failed)' : ''));

    // Refresh positions
    loadMyStakingPositions();
}

const CLANKER_AIRDROP_V2 = '0xf652B3610D75D81871bf96DB50825d9af28391E0';
const DEFAULT_SUPPLY = 100000000000n;
const CLAIM_SEL = '0x2e7ba6ef'; // claim(address,address,uint256,bytes32[])
const CLANKER_FEE_LOCKER = '0xF3622742b1E446D92e45E22923Ef11C2fcD55D68';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const FEE_SEL = {
    feesToClaim: '0x8417645e', // feesToClaim(address,address)
    claim:       '0x21c0b342', // claim(address,address)
};

function pad32(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function safeHex(v) { return (!v || v === '0x') ? '0x0' : v; }
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    try { return Number(BigInt(hex)) / 1e18; } catch (e) { return 0; }
}
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

async function rpcCall(to, data) {
    // Try public RPCs first
    for (const url of BASE_RPCS) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            if (!res.ok) continue; // 429/5xx — try next RPC
            const json = await res.json();
            if (!json || !json.result || json.error) continue; // RPC error — try next
            return safeHex(json.result);
        } catch (e) { continue; }
    }
    // Fallback: use the injected wallet provider (works inside Coinbase/MetaMask browsers
    // even when public RPCs are blocked)
    try {
        const provider = window.ethereum || (window.phantom && window.phantom.ethereum);
        if (provider) {
            const result = await provider.request({ method: 'eth_call', params: [{ to, data }, 'latest'] });
            if (result) return safeHex(result);
        }
    } catch (e) {}
    return '0x0';
}

// ── Inline Staking Pool Deployment ──
const STAKING_FACTORY = '0x7AE0768D9F36088fB967e530A8F4A3936b40B621';
const DEPLOY_PAID_SEL = '0x82123c96'; // deployPaid(address,address)

function deployStakingPool(tokenAddr, projectId, tokenName, btn) {
    // Open modal instead of bare confirm
    document.querySelector('.deploy-pool-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'deploy-pool-overlay fund-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.innerHTML = `
        <div class="fund-modal-header">
            <div class="fund-modal-title">Create Staking Pool</div>
            <div class="fund-modal-pool">${esc(tokenName)}</div>
        </div>
        <div style="padding:0 20px;">
            <div style="margin-bottom:16px;">
                <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:6px;">Stake Token</div>
                <div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);">$${esc(tokenName)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-dim);font-family:var(--font-mono)">${tokenAddr.slice(0,6)}...${tokenAddr.slice(-4)}</span></div>
            </div>
            <div style="margin-bottom:16px;">
                <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:6px;">Reward Token</div>
                <div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);">$CLAWS <span style="font-size:0.75rem;font-weight:400;color:var(--text-dim);">— stakers earn CLAWS</span></div>
            </div>
            <div style="margin-bottom:16px;">
                <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:6px;">Factory</div>
                <div style="font-size:0.78rem;font-family:var(--font-mono);color:var(--text-secondary);">${STAKING_FACTORY.slice(0,6)}...${STAKING_FACTORY.slice(-4)} <span style="color:var(--text-dim)">on Base</span></div>
            </div>
            <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
                Deploys a staking pool where holders stake $${esc(tokenName)} and earn $CLAWS rewards. You control the reward rate — fund it anytime from your dashboard. Free to deploy, just gas.
            </div>
        </div>
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="deployPoolBtn">Deploy Pool</button>
            <button class="fund-modal-cancel" id="deployPoolCancel">Cancel</button>
        </div>
        <div id="deployPoolStatus" style="text-align:center;padding:8px 20px;font-size:0.8rem;color:var(--text-dim);display:none;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('deployPoolCancel').addEventListener('click', () => overlay.remove());
    document.getElementById('deployPoolBtn').addEventListener('click', () => {
        _executePoolDeploy(tokenAddr, projectId, tokenName, overlay);
    });
}

async function _executePoolDeploy(tokenAddr, projectId, tokenName, overlay) {
    const deployBtn = document.getElementById('deployPoolBtn');
    const statusEl = document.getElementById('deployPoolStatus');
    const provider = window.ethereum;
    if (!provider) { alert('No wallet connected'); return; }

    deployBtn.disabled = true;
    deployBtn.textContent = 'Deploying...';
    statusEl.style.display = 'block';
    statusEl.textContent = 'Waiting for wallet confirmation...';

    try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const wallet = accounts[0];

        // Switch to Base
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }); } catch(e) {}

        statusEl.textContent = 'Sending transaction...';

        // deployPaid(tokenAddress, rewardToken=CLAWS)
        const deployData = DEPLOY_PAID_SEL + pad32(tokenAddr) + pad32(CLAWS);
        const receipt = await sendTx(wallet, STAKING_FACTORY, deployData);

        statusEl.textContent = 'Parsing pool address...';

        // Parse pool address from PoolDeployed event
        let poolAddr = null;
        if (receipt && receipt.logs) {
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                if (log.address && log.address.toLowerCase() === STAKING_FACTORY.toLowerCase() && log.topics && log.topics.length >= 2) {
                    poolAddr = '0x' + log.topics[1].slice(26);
                    break;
                }
            }
        }
        if (!poolAddr) throw new Error('Could not find pool address in transaction');

        statusEl.textContent = 'Registering pool...';

        // Update DB with staking address
        const auth = getStoredAuth();
        const token = auth ? auth.token : null;
        const resp = await fetch(API_BASE + '/inclawbator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}), 'x-wallet': wallet },
            body: JSON.stringify({ action: 'update-staking', project_id: projectId, staking_address: poolAddr, staking_deploy_tx: receipt.transactionHash })
        });
        const result = await resp.json();
        if (result.error) console.warn('DB update warning:', result.error);

        // Show success state in modal
        deployBtn.style.display = 'none';
        document.getElementById('deployPoolCancel').textContent = 'Done';
        statusEl.style.color = '#4ade80';
        statusEl.innerHTML = `Pool deployed!<br><span style="font-family:var(--font-mono);font-size:0.75rem;">${poolAddr}</span><br><br>You can now <strong>Fund Rewards</strong> from your dashboard.`;

        // Reload tokens to show Fund Rewards button
        loadProjects();
    } catch (e) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'Failed: ' + (e.message || e);
        deployBtn.disabled = false;
        deployBtn.textContent = 'Deploy Pool';
    }
}

async function sendTx(from, to, data) {
    const provider = window.ethereum;
    if (!provider) throw new Error('No wallet');
    const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from, to, data }]
    });
    // Wait for receipt
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
            if (receipt) return receipt;
        } catch (e) {}
    }
    throw new Error('Transaction timed out');
}

async function claimAllocation(tokenAddr, projectId, allocPct, btn) {
    const resultEl = btn.parentElement.querySelector('.allocation-result');
    try {
        const provider = window.ethereum;
        if (!provider) { resultEl.className = 'allocation-result error'; resultEl.textContent = 'No wallet connected'; return; }

        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const wallet = accounts[0];

        // Switch to Base if needed
        try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        } catch (e) {
            resultEl.className = 'allocation-result error';
            resultEl.textContent = 'Please switch to Base network';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Claiming...';

        // Calculate allocated amount: 100B * allocPct / 100 * 1e18
        const allocatedAmount = DEFAULT_SUPPLY * BigInt(allocPct) / 100n * (10n ** 18n);
        const amountHex = allocatedAmount.toString(16).padStart(64, '0');

        // Build calldata: claim(address token, address recipient, uint256 amount, bytes32[] proof)
        const data = CLAIM_SEL
            + pad32(tokenAddr)       // token
            + pad32(wallet)          // recipient
            + amountHex              // allocatedAmount
            + '0'.repeat(62) + '80'  // offset to proof array (128 bytes = 0x80)
            + '0'.repeat(64);        // proof length = 0

        const receipt = await sendTx(wallet, CLANKER_AIRDROP_V2, data);
        if (receipt.status === '0x0') throw new Error('Transaction reverted');

        // Record in DB
        try {
            await fetch(`${API_BASE}/inclawbator`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'record-allocation-claim',
                    project_id: projectId,
                    claim_tx_hash: receipt.transactionHash,
                    wallet: wallet
                })
            });
        } catch (e) { /* non-fatal */ }

        resultEl.className = 'allocation-result success';
        resultEl.textContent = 'Claimed!';
        btn.textContent = 'Claimed';

        setTimeout(() => { loadProjects(); }, 2500);
    } catch (e) {
        resultEl.className = 'allocation-result error';
        resultEl.textContent = e.message || 'Claim failed';
        btn.disabled = false;
        btn.textContent = 'Claim Allocation';
    }
}

function updateAllocationCountdowns() {
    const sections = document.querySelectorAll('.project-allocation-section.locked');
    let needsReload = false;
    sections.forEach(section => {
        const unlockTime = parseInt(section.dataset.unlock);
        const remaining = unlockTime - Date.now();
        if (remaining <= 0) {
            needsReload = true;
        } else {
            const countdownEl = section.querySelector('.allocation-countdown');
            if (countdownEl) countdownEl.textContent = 'Unlocks in ' + formatCountdown(remaining);
        }
    });
    if (needsReload) loadProjects();
}

async function loadStakingPools() {
    const auth = getStoredAuth();
    if (!auth) return;

    const container = document.getElementById('stakingPoolList');
    if (!container) return;

    const profile = auth.profile;
    const wallet = profile.wallet_address;
    if (!wallet) {
        container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#127793;</div><p>No staking pools yet.</p><p class="empty-hint"><a href="/inclawbator">Create a staking pool</a> for your token.</p></div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(wallet.toLowerCase())}`);
        const data = await res.json();
        const projects = (data.projects || []).filter(p => p.staking_address && p.status === 'active');

        if (projects.length === 0) {
            container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#127793;</div><p>No staking pools yet.</p><p class="empty-hint"><a href="/inclawbator">Create a staking pool</a> for your token — free, just gas.</p></div>';
            return;
        }

        container.innerHTML = '';
        const cards = [];
        for (const project of projects) {
            const card = document.createElement('div');
            card.className = 'staking-pool-card';
            card._projectId = project.id;
            card._poolAddr = project.staking_address;
            card.innerHTML = `
                <div class="staking-pool-header">
                    ${project.logo_url
                        ? `<img class="staking-pool-logo" src="${esc(project.logo_url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="staking-pool-icon" style="display:none">${(project.token_symbol || '?')[0]}</div>`
                        : `<div class="staking-pool-icon">${(project.token_symbol || '?')[0]}</div>`
                    }
                    <div class="staking-pool-title">
                        <div class="staking-pool-name">${esc(project.token_name || 'Unknown')}</div>
                        <div class="staking-pool-symbol">$${esc(project.token_symbol || '???')}</div>
                    </div>
                </div>
                <div class="staking-pool-analytics" data-field="analytics"></div>
                <div class="staking-pool-stats">
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="staked">--</div>
                        <div class="staking-pool-stat-label">Staked</div>
                    </div>
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="stakers">--</div>
                        <div class="staking-pool-stat-label">Stakers</div>
                    </div>
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="rate">--</div>
                        <div class="staking-pool-stat-label">CLAWS/day</div>
                    </div>
                </div>
                <div class="staking-pool-reward-bar"><div class="staking-pool-reward-fill" data-field="bar" style="width:0%"></div></div>
                <div class="staking-pool-actions">
                    <button class="staking-pool-fund-btn" data-pool="${esc(project.staking_address)}" data-name="${esc(project.token_name || 'Pool')}" data-project="${esc(project.id)}">Fund Rewards</button>
                    <button class="staking-pool-pause-btn" data-pool="${esc(project.staking_address)}" data-field="pauseBtn">Pause</button>
                    <a href="https://basescan.org/address/${esc(project.staking_address)}" target="_blank" rel="noopener" class="staking-pool-view-btn">BaseScan</a>
                </div>
                <div class="staking-pool-history" data-field="history">
                    <button class="staking-pool-history-toggle" data-field="historyToggle">Distribution History &#9662;</button>
                    <div class="staking-pool-history-list" data-field="historyList" style="display:none"></div>
                </div>
            `;

            // Wire fund button
            card.querySelector('.staking-pool-fund-btn').addEventListener('click', (e) => {
                const btn = e.target;
                openFundModal(btn.dataset.pool, btn.dataset.name, btn.dataset.project);
            });

            // Wire pause/unpause button
            card.querySelector('.staking-pool-pause-btn').addEventListener('click', (e) => {
                handlePauseToggle(card, e.target);
            });

            // Wire history toggle
            card.querySelector('[data-field="historyToggle"]').addEventListener('click', () => {
                const list = card.querySelector('[data-field="historyList"]');
                const toggle = card.querySelector('[data-field="historyToggle"]');
                const isOpen = list.style.display !== 'none';
                list.style.display = isOpen ? 'none' : 'block';
                toggle.innerHTML = isOpen ? 'Distribution History &#9662;' : 'Distribution History &#9652;';
            });

            container.appendChild(card);
            cards.push({ card, project });
        }

        // Batch ALL pool stats into a single RPC call (5 reads per pool)
        const sels = [STAKING_SEL.totalStaked, STAKING_SEL.stakerCount, STAKING_SEL.rewardRate, STAKING_SEL.periodEnd, STAKING_SEL.paused];
        const batchCalls = [];
        for (const { project } of cards) {
            for (const sel of sels) {
                batchCalls.push({ to: project.staking_address, data: sel });
            }
        }
        const batchResults = await rpcBatchCall(batchCalls);

        // Apply results + load distributions in parallel
        const distPromises = cards.map(({ card, project }, idx) => {
            const base = idx * 5;
            applyPoolStats(card, batchResults.slice(base, base + 5));
            return loadDistributions(card, project.id).then(distributions => {
                renderPoolAnalytics(card, distributions);
            });
        });
        await Promise.all(distPromises);
    } catch (e) {
        container.innerHTML = '<div class="overview-empty"><p>Failed to load pools.</p></div>';
    }
}

function applyPoolStats(card, results) {
    try {
        const [totalHex, countHex, rateHex, endHex, pausedHex] = results;

        const total = fromWei(totalHex);
        const stakers = Number(BigInt(countHex || '0x0'));
        const rate = fromWei(rateHex);
        const periodEnd = Number(BigInt(endHex || '0x0'));
        const isPaused = pausedHex && BigInt(pausedHex) === 1n;
        const now = Math.floor(Date.now() / 1000);

        // Store stats on card for analytics
        card._onChainStats = { total, stakers, rate, periodEnd, isPaused };

        card.querySelector('[data-field="staked"]').textContent = fmt(total);
        card.querySelector('[data-field="stakers"]').textContent = fmt(stakers);
        card.querySelector('[data-field="rate"]').textContent = fmt(rate * 86400);

        // Paused state
        const pauseBtn = card.querySelector('[data-field="pauseBtn"]');
        const nameEl = card.querySelector('.staking-pool-name');
        if (isPaused) {
            card.classList.add('is-paused');
            if (!nameEl.querySelector('.staking-pool-paused-badge')) {
                nameEl.insertAdjacentHTML('afterend', '<span class="staking-pool-paused-badge">Paused</span>');
            }
            pauseBtn.textContent = 'Unpause';
            pauseBtn.classList.add('is-unpause');
        } else {
            pauseBtn.textContent = 'Pause';
        }

        // Reward period progress bar
        const bar = card.querySelector('[data-field="bar"]');
        if (periodEnd > now) {
            const remaining = periodEnd - now;
            const pct = Math.min(100, Math.max(5, (remaining / (30 * 86400)) * 100));
            bar.style.width = pct + '%';
        } else {
            bar.style.width = '0%';
        }
    } catch (e) {
        // Stats stay as --
    }
}

async function loadDistributions(card, projectId) {
    try {
        const res = await fetch(`${API_BASE}/inclawbator?distributions=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        const distributions = data.distributions || [];

        card._distributions = distributions;

        const list = card.querySelector('[data-field="historyList"]');
        const historySection = card.querySelector('[data-field="history"]');

        if (distributions.length === 0) {
            historySection.style.display = 'none';
            return distributions;
        }

        list.innerHTML = distributions.map(d => {
            const amount = parseFloat(d.amount) || 0;
            const days = Math.round((d.duration_seconds || 0) / 86400);
            const ago = timeAgo(d.created_at);
            const txLink = d.tx_hash ? `https://basescan.org/tx/${d.tx_hash}` : '#';
            return `<div class="staking-pool-history-item">
                <div class="staking-pool-history-amount">${fmt(amount)} CLAWS</div>
                <div class="staking-pool-history-meta">${days}d period · ${ago}</div>
                ${d.tx_hash ? `<a href="${txLink}" target="_blank" rel="noopener" class="staking-pool-history-tx">tx</a>` : ''}
            </div>`;
        }).join('');

        return distributions;
    } catch (e) {
        return [];
    }
}

async function handlePauseToggle(card, btn) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    const wallet = auth.profile.wallet_address;
    const poolAddr = card._poolAddr;
    const isPaused = card.classList.contains('is-paused');
    const selector = isPaused ? STAKING_SEL.unpause : STAKING_SEL.pause;

    btn.disabled = true;
    btn.textContent = isPaused ? 'Unpausing...' : 'Pausing...';

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0x2105') {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        }

        await sendTx(wallet, poolAddr, selector);

        // Toggle state
        if (isPaused) {
            card.classList.remove('is-paused');
            const badge = card.querySelector('.staking-pool-paused-badge');
            if (badge) badge.remove();
            btn.textContent = 'Pause';
            btn.classList.remove('is-unpause');
        } else {
            card.classList.add('is-paused');
            const nameEl = card.querySelector('.staking-pool-name');
            nameEl.insertAdjacentHTML('afterend', '<span class="staking-pool-paused-badge">Paused</span>');
            btn.textContent = 'Unpause';
            btn.classList.add('is-unpause');
        }
    } catch (e) {
        btn.textContent = isPaused ? 'Unpause' : 'Pause';
        alert(e.message || 'Transaction failed');
    } finally {
        btn.disabled = false;
    }
}

function renderPoolAnalytics(card, distributions) {
    const el = card.querySelector('[data-field="analytics"]');
    if (!distributions || distributions.length === 0) {
        el.style.display = 'none';
        return;
    }

    const totalDistributed = distributions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const eventCount = distributions.length;

    // Mini bar chart of last 5 distributions
    const recent = distributions.slice(0, 5).reverse();
    const maxAmount = Math.max(...recent.map(d => parseFloat(d.amount) || 0), 1);

    const barsHtml = recent.map(d => {
        const amount = parseFloat(d.amount) || 0;
        const pct = Math.max(8, (amount / maxAmount) * 100);
        return `<div class="analytics-bar" style="height:${pct}%" title="${fmt(amount)} CLAWS"></div>`;
    }).join('');

    el.innerHTML = `
        <div class="analytics-summary">
            <div class="analytics-metric">
                <div class="analytics-metric-val">${fmt(totalDistributed)}</div>
                <div class="analytics-metric-label">Total Distributed</div>
            </div>
            <div class="analytics-metric">
                <div class="analytics-metric-val">${eventCount}</div>
                <div class="analytics-metric-label">Funding Events</div>
            </div>
        </div>
        <div class="analytics-bars">${barsHtml}</div>
    `;
    el.style.display = '';
}

async function openFundModal(poolAddr, poolName, projectId) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }
    const wallet = auth.profile.wallet_address;
    if (!wallet) { alert('No wallet connected.'); return; }

    // Ensure we're on Base before reading balance
    const provider = window.ethereum || (window.phantom && window.phantom.ethereum);
    if (provider) {
        try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        } catch (e) {
            if (e.code === 4902) {
                try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }] }); } catch (e2) {}
            }
        }
    }

    // Fetch CLAWS balance — try provider first (works in wallet browsers), then public RPCs
    let clawsBalance = 0;
    let clawsPrice = buyState.clawsPrice || 0;
    const balData = STAKING_USER_SEL.balanceOf + pad32(wallet);
    let _dbgSource = 'none';
    let _dbgRaw = '?';
    let _dbgErr = '';
    try {
        // Try injected provider first (most reliable inside wallet browsers like Coinbase)
        if (provider) {
            try {
                const result = await provider.request({ method: 'eth_call', params: [{ to: CLAWS_ADDRESS, data: balData }, 'latest'] });
                _dbgRaw = result;
                if (result && result !== '0x') { clawsBalance = fromWei(safeHex(result)); _dbgSource = 'provider'; }
            } catch (e) { _dbgErr = 'provider:' + (e.message || e.code || 'unknown'); }
        }
        // Fallback to public RPCs if provider failed
        if (clawsBalance === 0) {
            const balHex = await rpcCall(CLAWS_ADDRESS, balData);
            _dbgRaw = balHex;
            clawsBalance = fromWei(balHex);
            if (clawsBalance > 0) _dbgSource = 'rpc';
        }
        if (!clawsPrice) {
            const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
            const data = await resp.json();
            if (data.pairs && data.pairs.length > 0) {
                clawsPrice = parseFloat(data.pairs[0].priceUsd) || 0;
                buyState.clawsPrice = clawsPrice;
            }
        }
    } catch (e) { /* proceed with 0 */ }

    const overlay = document.createElement('div');
    overlay.className = 'fund-modal-overlay';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.innerHTML = `
        <div class="fund-modal-header">
            <div class="fund-modal-title">Fund Rewards</div>
            <div class="fund-modal-pool">${esc(poolName)}</div>
        </div>
        <div class="fund-modal-balance-row">
            <span class="fund-modal-balance-label">Your CLAWS Balance</span>
            <span class="fund-modal-balance-val">${fmt(Math.floor(clawsBalance))}</span>
        </div>
        <div style="font-size:10px;color:#666;padding:2px 16px;word-break:break-all">dbg: addr=${wallet.slice(0,10)} src=${_dbgSource} raw=${String(_dbgRaw).slice(0,20)} ${_dbgErr}</div>
        <div class="fund-modal-field">
            <label class="fund-modal-label">Amount</label>
            <div class="fund-modal-input-wrap">
                <input class="fund-modal-input" type="text" inputmode="numeric" placeholder="0" id="fundAmount" autocomplete="off">
                <span class="fund-modal-input-suffix">CLAWS</span>
            </div>
            <div class="fund-modal-usd" id="fundUsd">&nbsp;</div>
            <input type="range" class="fund-modal-slider" id="fundSlider" min="0" max="${Math.floor(clawsBalance)}" value="0" step="${Math.max(1, Math.floor(clawsBalance / 1000))}">
            <div class="fund-modal-pct-row">
                <button type="button" class="fund-modal-pct" data-pct="25">25%</button>
                <button type="button" class="fund-modal-pct" data-pct="50">50%</button>
                <button type="button" class="fund-modal-pct" data-pct="75">75%</button>
                <button type="button" class="fund-modal-pct" data-pct="100">MAX</button>
            </div>
        </div>
        <div class="fund-modal-field">
            <label class="fund-modal-label">Duration</label>
            <div class="fund-modal-dur-row">
                <button type="button" class="fund-modal-dur" data-days="7">7d</button>
                <button type="button" class="fund-modal-dur" data-days="14">14d</button>
                <button type="button" class="fund-modal-dur active" data-days="30">30d</button>
                <button type="button" class="fund-modal-dur" data-days="60">60d</button>
                <button type="button" class="fund-modal-dur" data-days="90">90d</button>
            </div>
            <input type="hidden" id="fundDuration" value="30">
        </div>
        <div class="fund-modal-summary" id="fundSummary"></div>
        <div class="fund-modal-hint">CLAWS will be dripped to stakers over this period. You can top up anytime — leftover rewards roll into the new period.</div>
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="fundSubmitBtn">Approve & Fund</button>
            <button class="fund-modal-cancel" id="fundCancelBtn">Cancel</button>
        </div>
        <div class="fund-modal-result" id="fundResult"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const amountInput = modal.querySelector('#fundAmount');
    const slider = modal.querySelector('#fundSlider');
    const usdEl = modal.querySelector('#fundUsd');
    const summaryEl = modal.querySelector('#fundSummary');
    const durationInput = modal.querySelector('#fundDuration');
    const maxBal = Math.floor(clawsBalance);

    function updateSliderFill() {
        const pct = maxBal > 0 ? (parseInt(slider.value) / maxBal) * 100 : 0;
        slider.style.setProperty('--fill', pct + '%');
    }

    function updateUsd() {
        const raw = parseInt((amountInput.value || '0').replace(/[^0-9]/g, '')) || 0;
        if (raw > 0 && clawsPrice > 0) {
            const usd = raw * clawsPrice;
            usdEl.textContent = '~$' + (usd >= 1000 ? fmt(Math.round(usd)) : usd.toFixed(2)) + ' USD';
        } else {
            usdEl.textContent = '\u00a0';
        }
        updateSummary();
    }

    function updateSummary() {
        const raw = parseInt((amountInput.value || '0').replace(/[^0-9]/g, '')) || 0;
        const days = parseInt(durationInput.value) || 30;
        if (raw > 0 && days > 0) {
            const perDay = Math.floor(raw / days);
            summaryEl.textContent = fmt(perDay) + ' CLAWS/day for ' + days + ' days';
        } else {
            summaryEl.textContent = '';
        }
    }

    // Slider → input
    slider.addEventListener('input', () => {
        const val = parseInt(slider.value) || 0;
        amountInput.value = val > 0 ? val.toLocaleString('en-US') : '';
        updateSliderFill();
        updateUsd();
    });

    // Input → slider
    amountInput.addEventListener('input', () => {
        const raw = amountInput.value.replace(/[^0-9]/g, '');
        if (raw) {
            const num = parseInt(raw);
            try {
                const pos = amountInput.selectionStart;
                const oldLen = amountInput.value.length;
                amountInput.value = num.toLocaleString('en-US');
                const newLen = amountInput.value.length;
                amountInput.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
            } catch (e) {
                amountInput.value = num.toLocaleString('en-US');
            }
            slider.value = Math.min(num, maxBal);
        } else {
            slider.value = 0;
        }
        updateSliderFill();
        updateUsd();
    });

    // Percentage buttons
    modal.querySelectorAll('.fund-modal-pct').forEach(btn => {
        btn.addEventListener('click', () => {
            const pct = parseInt(btn.dataset.pct);
            const val = Math.floor(clawsBalance * pct / 100);
            amountInput.value = val > 0 ? val.toLocaleString('en-US') : '';
            slider.value = val;
            updateSliderFill();
            updateUsd();
        });
    });

    // Duration buttons
    modal.querySelectorAll('.fund-modal-dur').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.fund-modal-dur').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            durationInput.value = btn.dataset.days;
            updateSummary();
        });
    });

    modal.querySelector('#fundCancelBtn').addEventListener('click', () => overlay.remove());

    modal.querySelector('#fundSubmitBtn').addEventListener('click', async () => {
        const amountRaw = parseInt((amountInput.value || '0').replace(/[^0-9]/g, '')) || 0;
        const durationDays = parseInt(durationInput.value);
        const resultEl = modal.querySelector('#fundResult');
        const btn = modal.querySelector('#fundSubmitBtn');

        if (!amountRaw || amountRaw <= 0) { resultEl.textContent = 'Enter a valid amount'; resultEl.className = 'fund-modal-result error'; return; }
        if (!durationDays || durationDays <= 0) { resultEl.textContent = 'Enter a valid duration'; resultEl.className = 'fund-modal-result error'; return; }

        // Ensure on Base
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== '0x2105') {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
            }
        } catch (e) {
            resultEl.textContent = 'Switch to Base network';
            resultEl.className = 'fund-modal-result error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Approving CLAWS...';
        resultEl.textContent = '';
        resultEl.className = 'fund-modal-result';

        const amountWei = BigInt(Math.floor(amountRaw * 1e18)).toString(16).padStart(64, '0');
        const durationSec = BigInt(durationDays * 86400).toString(16).padStart(64, '0');

        try {
            // Step 1: Approve CLAWS to pool
            const approveData = STAKING_SEL.approve + pad32(poolAddr) + amountWei;
            await sendTx(wallet, CLAWS, approveData);

            // Wait for allowance propagation
            btn.textContent = 'Approval confirmed. Funding...';
            const ALLOWANCE_SEL = '0xdd62ed3e';
            for (let retries = 0; retries < 10; retries++) {
                await new Promise(r => setTimeout(r, 2000));
                const allowance = BigInt(await rpcCall(CLAWS_ADDRESS, ALLOWANCE_SEL + pad32(wallet) + pad32(poolAddr)));
                if (allowance >= BigInt(amountRaw) * 10n ** 18n) break;
            }

            // Step 2: depositRewards(amount, duration)
            btn.textContent = 'Funding pool...';
            const depositData = STAKING_SEL.depositRewards + amountWei + durationSec;
            const receipt = await sendTx(wallet, poolAddr, depositData);

            // Record distribution
            if (projectId && receipt?.transactionHash) {
                try {
                    await fetch(`${API_BASE}/inclawbator`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            action: 'record-distribution-owner',
                            project_id: projectId,
                            staking_address: poolAddr,
                            amount: amountRaw,
                            duration_seconds: durationDays * 86400,
                            tx_hash: receipt.transactionHash
                        })
                    });
                } catch (e) { /* non-critical */ }
            }

            resultEl.textContent = `Funded ${fmt(amountRaw)} CLAWS over ${durationDays} days!`;
            resultEl.className = 'fund-modal-result success';
            btn.textContent = 'Done!';

            setTimeout(() => {
                loadStakingPools();
                overlay.remove();
            }, 2000);
        } catch (e) {
            resultEl.textContent = e.message || 'Transaction failed';
            resultEl.className = 'fund-modal-result error';
            btn.disabled = false;
            btn.textContent = 'Approve & Fund';
        }
    });

    // Escape to close
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    setTimeout(() => amountInput.focus(), 100);
}

// ── Edit / Delete Application ──

function parseDescription(raw) {
    const result = { vision: '', helpNeeded: '', contact: '' };
    if (!raw) return result;
    const helpIdx = raw.indexOf('--- HELP NEEDED ---');
    const contactIdx = raw.indexOf('--- CONTACT ---');
    if (helpIdx === -1 && contactIdx === -1) {
        result.vision = raw.trim();
    } else if (helpIdx !== -1 && contactIdx !== -1) {
        result.vision = raw.slice(0, helpIdx).trim();
        result.helpNeeded = raw.slice(helpIdx + 19, contactIdx).trim();
        result.contact = raw.slice(contactIdx + 15).trim();
    } else if (helpIdx !== -1) {
        result.vision = raw.slice(0, helpIdx).trim();
        result.helpNeeded = raw.slice(helpIdx + 19).trim();
    } else {
        result.vision = raw.slice(0, contactIdx).trim();
        result.contact = raw.slice(contactIdx + 15).trim();
    }
    return result;
}

function buildDescription(vision, helpNeeded, contact) {
    let desc = (vision || '').trim();
    if (helpNeeded && helpNeeded.trim()) desc += '\n\n--- HELP NEEDED ---\n' + helpNeeded.trim();
    if (contact && contact.trim()) desc += '\n\n--- CONTACT ---\n' + contact.trim();
    return desc;
}

function openEditApplicationModal(project) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    const parsed = parseDescription(project.description);

    const overlay = document.createElement('div');
    overlay.className = 'fund-modal-overlay';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.innerHTML = `
        <div class="fund-modal-title">Edit Application</div>
        <label class="fund-modal-label">Project Name</label>
        <input class="fund-modal-input" type="text" id="editAppName" value="${esc(project.token_name || '')}">
        <label class="fund-modal-label">Description / Vision</label>
        <textarea class="fund-modal-input" id="editAppVision" rows="3" style="resize:vertical">${esc(parsed.vision)}</textarea>
        <label class="fund-modal-label">Help Needed</label>
        <textarea class="fund-modal-input" id="editAppHelp" rows="2" style="resize:vertical">${esc(parsed.helpNeeded)}</textarea>
        <label class="fund-modal-label">Contact Info</label>
        <input class="fund-modal-input" type="text" id="editAppContact" value="${esc(parsed.contact)}">
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="editAppSave">Save Changes</button>
            <button class="fund-modal-cancel" id="editAppCancel">Cancel</button>
        </div>
        <div class="fund-modal-result" id="editAppResult"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#editAppCancel').addEventListener('click', () => overlay.remove());

    modal.querySelector('#editAppSave').addEventListener('click', async () => {
        const btn = modal.querySelector('#editAppSave');
        const resultEl = modal.querySelector('#editAppResult');
        const nameVal = modal.querySelector('#editAppName').value.trim();

        if (!nameVal) {
            resultEl.textContent = 'Project name is required';
            resultEl.className = 'fund-modal-result error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';
        resultEl.textContent = '';
        resultEl.className = 'fund-modal-result';

        const description = buildDescription(
            modal.querySelector('#editAppVision').value,
            modal.querySelector('#editAppHelp').value,
            modal.querySelector('#editAppContact').value
        );

        try {
            const resp = await fetch(`${API_BASE}/inclawbator`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'update-application',
                    project_id: project.id,
                    token_name: nameVal,
                    description
                })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Update failed');

            resultEl.textContent = 'Application updated!';
            resultEl.className = 'fund-modal-result success';
            btn.textContent = 'Saved!';

            setTimeout(() => {
                overlay.remove();
                loadProjects();
            }, 1200);
        } catch (e) {
            resultEl.textContent = e.message || 'Update failed';
            resultEl.className = 'fund-modal-result error';
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    });

    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

// ── Token Settings Modal ──
let _settingsPendingLogo = null;

function hslToHex(hslStr) {
    const m = hslStr.match(/hsla?\(\s*(\d+),\s*(\d+)%?,\s*(\d+)%?/);
    if (!m) return '#4ecca3';
    let h = parseInt(m[1]) / 360, s = parseInt(m[2]) / 100, l = parseInt(m[3]) / 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = x => { const hex = Math.round(x * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; };
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3), 16) / 255, g = parseInt(hex.slice(3,5), 16) / 255, b = parseInt(hex.slice(5,7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function deriveColors(hex) {
    const hsl = hexToHsl(hex);
    return {
        color: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
        color_dim: `hsla(${hsl.h}, ${Math.round(hsl.s * 0.4)}%, ${Math.round(hsl.l * 0.3)}%, 0.15)`,
        glow: `0 0 30px hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.15)`
    };
}

function openTokenSettingsModal(project) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    _settingsPendingLogo = null;
    const currentHex = project.color ? hslToHex(project.color) : '#4ecca3';
    const logoSrc = project.logo_url || '';
    const iconLetter = ((project.token_symbol || project.token_name || '?')[0]).toUpperCase();

    const overlay = document.createElement('div');
    overlay.className = 'fund-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.style.maxWidth = '480px';
    modal.innerHTML = `
        <div class="fund-modal-title">Token Settings</div>
        <div class="ts-logo-row">
            <div class="ts-logo-preview" id="tsLogoPreview">
                ${logoSrc
                    ? `<img src="${esc(logoSrc)}" alt="" class="ts-logo-img">`
                    : `<div class="ts-logo-letter">${iconLetter}</div>`
                }
            </div>
            <button type="button" class="ts-logo-btn" id="tsLogoBtn">Upload Logo</button>
            <input type="file" id="tsLogoFile" accept="image/*" style="display:none">
        </div>
        <label class="fund-modal-label">Description</label>
        <textarea class="fund-modal-input" id="tsDesc" rows="3" style="resize:vertical" placeholder="What is this token about?">${esc(project.description || '')}</textarea>
        <label class="fund-modal-label">Website URL</label>
        <input class="fund-modal-input" type="url" id="tsWebsite" value="${esc(project.website_url || '')}" placeholder="https://...">
        <label class="fund-modal-label">X / Twitter Handle</label>
        <input class="fund-modal-input" type="text" id="tsXHandle" value="${esc(project.x_handle || '')}" placeholder="@yourtoken">
        <label class="fund-modal-label">Telegram URL</label>
        <input class="fund-modal-input" type="url" id="tsTelegram" value="${esc(project.telegram_url || '')}" placeholder="https://t.me/...">
        <label class="fund-modal-label">Accent Color</label>
        <div class="ts-color-row">
            <input type="color" id="tsColor" value="${currentHex}">
            <span class="ts-color-hex" id="tsColorHex">${currentHex}</span>
        </div>
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="tsSave">Save Settings</button>
            <button class="fund-modal-cancel" id="tsCancel">Cancel</button>
        </div>
        <div class="fund-modal-result" id="tsResult"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Color picker live update
    modal.querySelector('#tsColor').addEventListener('input', (e) => {
        modal.querySelector('#tsColorHex').textContent = e.target.value;
    });

    // Logo upload
    modal.querySelector('#tsLogoBtn').addEventListener('click', () => {
        modal.querySelector('#tsLogoFile').click();
    });
    modal.querySelector('#tsLogoFile').addEventListener('change', async () => {
        const file = modal.querySelector('#tsLogoFile').files[0];
        if (!file) return;
        const btn = modal.querySelector('#tsLogoBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';
        try {
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const resp = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_data: dataUrl, file_name: file.name, file_type: file.type })
            });
            const data = await resp.json();
            if (data.url) {
                _settingsPendingLogo = data.url;
                modal.querySelector('#tsLogoPreview').innerHTML = `<img src="${esc(data.url)}" alt="" class="ts-logo-img">`;
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (e) {
            alert('Upload failed');
        }
        btn.disabled = false;
        btn.textContent = 'Upload Logo';
    });

    // Cancel
    modal.querySelector('#tsCancel').addEventListener('click', () => overlay.remove());

    // Save
    modal.querySelector('#tsSave').addEventListener('click', async () => {
        const btn = modal.querySelector('#tsSave');
        const resultEl = modal.querySelector('#tsResult');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        resultEl.textContent = '';

        const hex = modal.querySelector('#tsColor').value;
        const colors = deriveColors(hex);

        const body = {
            action: 'update-project',
            project_id: project.id,
            description: modal.querySelector('#tsDesc').value.trim(),
            website_url: modal.querySelector('#tsWebsite').value.trim(),
            x_handle: modal.querySelector('#tsXHandle').value.trim().replace(/^@/, ''),
            telegram_url: modal.querySelector('#tsTelegram').value.trim(),
            color: colors.color,
            color_dim: colors.color_dim,
            glow: colors.glow
        };
        if (_settingsPendingLogo) body.logo_url = _settingsPendingLogo;

        try {
            const resp = await fetch(`${API_BASE}/inclawbator`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body)
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Update failed');

            resultEl.textContent = 'Settings saved!';
            resultEl.className = 'fund-modal-result success';
            btn.textContent = 'Saved!';
            _settingsPendingLogo = null;

            setTimeout(() => {
                overlay.remove();
                loadProjects();
                loadStakingPools();
            }, 1000);
        } catch (e) {
            resultEl.textContent = e.message || 'Save failed';
            resultEl.className = 'fund-modal-result error';
            btn.disabled = false;
            btn.textContent = 'Save Settings';
        }
    });

    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

async function deleteApplication(projectId, projectName) {
    if (!confirm(`Delete application for "${projectName}"? This cannot be undone.`)) return;

    try {
        const resp = await fetch(`${API_BASE}/inclawbator`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'delete-application', project_id: projectId })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Delete failed');
        loadProjects();
    } catch (e) {
        alert(e.message || 'Failed to delete application');
    }
}

// ── Buy Credits ──
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const BASE_CHAIN_ID = '0x2105';
const buyState = { clawsPerCredit: 0, selectedAmount: 250, clawsPrice: 0 };

function openBuyModal(tab) {
    const modal = document.getElementById('buyCreditsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Switch to requested tab
    if (tab) {
        document.querySelectorAll('.dash-buy-panel .buy-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.getElementById('dashBuyCredits').classList.toggle('active', tab === 'credits');
        document.getElementById('dashBuySubscribe').classList.toggle('active', tab === 'subscribe');
    }
}

function closeBuyModal() {
    const modal = document.getElementById('buyCreditsModal');
    if (modal) modal.classList.add('hidden');
}

function initBuyCredits() {
    // Modal close handlers
    document.getElementById('buyModalClose')?.addEventListener('click', closeBuyModal);
    document.querySelector('.buy-modal-backdrop')?.addEventListener('click', closeBuyModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeBuyModal();
    });
    // Tab switching
    document.querySelectorAll('.dash-buy-panel .buy-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.dash-buy-panel .buy-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            document.getElementById('dashBuyCredits').classList.toggle('active', tab === 'credits');
            document.getElementById('dashBuySubscribe').classList.toggle('active', tab === 'subscribe');
        });
    });

    // Presets
    document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            buyState.selectedAmount = parseInt(btn.dataset.amount);
            const custom = document.getElementById('dashBuyCustom');
            if (custom) custom.value = '';
            document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(b => b.classList.toggle('active', b === btn));
            updateDashBuyCost();
        });
    });

    // Custom amount
    document.getElementById('dashBuyCustom')?.addEventListener('input', () => {
        const val = parseInt(document.getElementById('dashBuyCustom').value) || 0;
        if (val > 0) {
            buyState.selectedAmount = val;
            document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(b => b.classList.remove('active'));
        }
        updateDashBuyCost();
    });

    // Pay with card
    document.getElementById('dashBuyCardBtn')?.addEventListener('click', dashBuyWithCard);

    // Pay with CLAWS
    document.getElementById('dashBuySendBtn')?.addEventListener('click', dashSendClawsTx);

    // Subscription tier cards in the picker view → subscription checkout
    document.querySelectorAll('#subPickerView .sub-tier-card').forEach(card => {
        card.addEventListener('click', () => dashSubscribeTier(card));
    });

    // Subscription action buttons
    document.getElementById('subChangeBtn')?.addEventListener('click', toggleChangeTiers);
    document.getElementById('subCancelBtn')?.addEventListener('click', cancelSubscription);

    // Load subscription status
    loadSubscriptionStatus();

    // Fetch price
    fetchClawsPrice();
}

async function fetchClawsPrice() {
    const rateEl = document.getElementById('dashBuyRate');
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            const price = parseFloat(data.pairs[0].priceUsd) || 0;
            if (price > 0) {
                buyState.clawsPrice = price;
                buyState.clawsPerCredit = Math.ceil(0.005 / price);
                if (rateEl) rateEl.textContent = '~' + buyState.clawsPerCredit.toLocaleString() + ' CLAWS / credit';
                updateDashBuyCost();
                return;
            }
        }
        if (rateEl) rateEl.textContent = 'Price unavailable';
    } catch (e) {
        if (rateEl) rateEl.textContent = 'Price unavailable';
    }
}

function updateDashBuyCost() {
    const amount = buyState.selectedAmount;
    const costEl = document.getElementById('dashBuyCost');
    const sendBtn = document.getElementById('dashBuySendBtn');
    const cardBtn = document.getElementById('dashBuyCardBtn');
    const bH = document.getElementById('dashBrkHaiku');
    const bS = document.getElementById('dashBrkSonnet');
    const bO = document.getElementById('dashBrkOpus');
    const cardIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';

    if (!amount || !buyState.clawsPerCredit) {
        if (costEl) costEl.textContent = '--';
        if (sendBtn) sendBtn.disabled = true;
        if (cardBtn) { cardBtn.disabled = true; cardBtn.innerHTML = cardIcon + 'Pay with Card'; }
        if (bH) bH.textContent = '--';
        if (bS) bS.textContent = '--';
        if (bO) bO.textContent = '--';
        return;
    }

    const totalClaws = amount * buyState.clawsPerCredit;
    const totalUsd = (amount * 0.005).toFixed(2);
    if (costEl) costEl.textContent = totalClaws.toLocaleString() + ' CLAWS (~$' + totalUsd + ')';
    if (sendBtn) sendBtn.disabled = false;
    if (cardBtn) {
        if (amount >= 100) {
            cardBtn.disabled = false;
            cardBtn.innerHTML = cardIcon + 'Pay with Card — $' + totalUsd;
        } else {
            cardBtn.disabled = true;
            cardBtn.innerHTML = cardIcon + 'Card min $0.50 (100 credits)';
        }
    }
    if (bH) bH.textContent = Math.floor(amount / 10) + ' msgs';
    if (bS) bS.textContent = Math.floor(amount / 50) + ' msgs';
    if (bO) bO.textContent = Math.floor(amount / 100) + ' msgs';
}

async function dashSendClawsTx() {
    const resultEl = document.getElementById('dashBuyResult');
    const sendBtn = document.getElementById('dashBuySendBtn');

    if (!window.ethereum) {
        resultEl.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
        resultEl.className = 'buy-result error';
        return;
    }

    const amount = buyState.selectedAmount;
    if (!amount || !buyState.clawsPerCredit) return;

    sendBtn.disabled = true;
    resultEl.innerHTML = '';

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== BASE_CHAIN_ID) {
            try {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            } catch (e) {
                resultEl.textContent = 'Please switch to Base network in your wallet.';
                resultEl.className = 'buy-result error';
                sendBtn.disabled = false;
                return;
            }
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];

        const totalTokens = BigInt(amount) * BigInt(buyState.clawsPerCredit);
        const amountWei = totalTokens * BigInt('1000000000000000000');
        const selector = '0xa9059cbb';
        const paddedAddr = PROTOCOL_WALLET.slice(2).toLowerCase().padStart(64, '0');
        const paddedAmt = amountWei.toString(16).padStart(64, '0');
        const data = selector + paddedAddr + paddedAmt;

        resultEl.textContent = 'Confirm in your wallet...';
        resultEl.className = 'buy-result';

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from, to: CLAWS_ADDRESS, data }]
        });

        resultEl.textContent = 'Transaction sent! Waiting for confirmation...';

        // Verify deposit (backend now polls for receipt)
        const resp = await fetch(`${API_BASE}/credits`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'deposit', tx_hash: txHash })
        });
        const result = await resp.json();

        if (resp.ok) {
            resultEl.textContent = '+' + result.credits_added + ' credits added! New balance: ' + result.credits_total;
            resultEl.className = 'buy-result success';
            const ovEl = document.getElementById('ovCredits');
            if (ovEl) ovEl.textContent = result.credits_total;
            const balEl = document.getElementById('dashBuyBalance');
            if (balEl) balEl.textContent = result.credits_total + ' credits';
            const pcEl = document.getElementById('profileCredits');
            if (pcEl) pcEl.textContent = result.credits_total.toLocaleString();
        } else {
            resultEl.innerHTML = (result.error || 'Verification failed.') +
                ' <a href="#" onclick="dashScanDeposits();return false;" style="color:#6366f1;text-decoration:underline;">Scan for uncredited deposits</a>';
            resultEl.className = 'buy-result error';
            sendBtn.disabled = false;
        }
    } catch (e) {
        if (e.code === 4001) {
            resultEl.textContent = 'Transaction cancelled.';
        } else {
            resultEl.textContent = e.message || 'Transaction failed.';
        }
        resultEl.className = 'buy-result error';
        sendBtn.disabled = false;
    }
}

async function dashScanDeposits() {
    const resultEl = document.getElementById('dashBuyResult');
    const scanLink = document.getElementById('scanDepositsLink');

    if (!window.ethereum) {
        resultEl.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
        resultEl.className = 'buy-result error';
        return;
    }

    if (scanLink) scanLink.style.pointerEvents = 'none';
    resultEl.textContent = 'Scanning chain for uncredited deposits...';
    resultEl.className = 'buy-result';

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const wallet = accounts[0];

        const resp = await fetch(`${API_BASE}/credits`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'scan-deposits', wallet })
        });
        const result = await resp.json();

        if (!resp.ok) {
            resultEl.textContent = result.error || 'Scan failed.';
            resultEl.className = 'buy-result error';
        } else if (result.credited > 0) {
            resultEl.textContent = 'Found ' + result.new_deposits + ' uncredited deposit(s) — +' + result.credited + ' credits added! Balance: ' + result.credits_total;
            resultEl.className = 'buy-result success';
            const ovEl = document.getElementById('ovCredits');
            if (ovEl) ovEl.textContent = result.credits_total;
            const balEl = document.getElementById('dashBuyBalance');
            if (balEl) balEl.textContent = result.credits_total + ' credits';
            const pcEl = document.getElementById('profileCredits');
            if (pcEl) pcEl.textContent = result.credits_total.toLocaleString();
        } else if (result.found > 0) {
            resultEl.textContent = 'Found ' + result.found + ' deposit(s), all already credited. No new credits to add.';
            resultEl.className = 'buy-result';
        } else {
            resultEl.textContent = 'No CLAWS deposits found from this wallet in the last ~3 hours.';
            resultEl.className = 'buy-result';
        }
    } catch (e) {
        resultEl.textContent = e.message || 'Scan failed.';
        resultEl.className = 'buy-result error';
    } finally {
        if (scanLink) scanLink.style.pointerEvents = '';
    }
}

async function dashBuyWithCard() {
    const amount = buyState.selectedAmount;
    if (!amount || amount < 100) return;

    const cardBtn = document.getElementById('dashBuyCardBtn');
    const resultEl = document.getElementById('dashBuyResult');
    cardBtn.disabled = true;
    resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/create-checkout`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ credits: amount, return_path: '/dashboard' })
        });
        const data = await resp.json();

        if (resp.ok && data.url) {
            window.location.href = data.url;
        } else {
            resultEl.textContent = data.error || 'Failed to start checkout.';
            resultEl.className = 'buy-result error';
            cardBtn.disabled = false;
        }
    } catch (e) {
        resultEl.textContent = 'Network error. Try again.';
        resultEl.className = 'buy-result error';
        cardBtn.disabled = false;
    }
}

// ── Subscription Management ──
const SUB_TIERS = {
    spark:   { credits: 1500,  price: '$6',  label: 'Spark'   },
    builder: { credits: 5000,  price: '$19', label: 'Builder' },
    studio:  { credits: 15000, price: '$55', label: 'Studio'  },
};

let currentSub = { tier: null, status: 'none', current_period_end: null };

async function loadSubscriptionStatus() {
    const auth = getStoredAuth();
    if (!auth) return;

    try {
        const resp = await fetch(`${API_BASE}/subscription`, { headers: authHeaders() });
        if (!resp.ok) return;
        const data = await resp.json();
        currentSub = data;

        const activeView = document.getElementById('subActiveView');
        const pickerView = document.getElementById('subPickerView');

        // Update profile badge
        const profileBadge = document.getElementById('profileSubBadge');

        if (data.status === 'active' || data.status === 'canceled' || data.status === 'past_due') {
            // Show active subscription view
            activeView.style.display = '';
            pickerView.style.display = 'none';

            const t = SUB_TIERS[data.tier] || { credits: 0, price: '?', label: data.tier || '?' };
            if (profileBadge) {
                profileBadge.textContent = t.label;
                profileBadge.classList.add('active');
            }
            const upgradeLink = document.getElementById('profileSubUpgrade');
            if (upgradeLink) upgradeLink.textContent = 'Manage';

            document.getElementById('subTierName').textContent = t.label + ' Plan';
            const badge = document.getElementById('subStatusBadge');
            badge.className = 'sub-status-badge ' + data.status;
            badge.textContent = data.status === 'active' ? 'Active' :
                                data.status === 'canceled' ? 'Cancels at period end' :
                                'Past due';

            document.getElementById('subCreditsMonth').textContent = t.credits.toLocaleString();
            document.getElementById('subMonthlyCost').textContent = t.price + '/mo';

            const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
            document.getElementById('subRenewalDate').textContent = periodEnd
                ? periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '--';

            // Toggle cancel vs reactivate button
            const cancelBtn = document.getElementById('subCancelBtn');
            if (data.status === 'canceled') {
                cancelBtn.className = 'sub-reactivate-btn';
                cancelBtn.textContent = 'Reactivate';
                cancelBtn.onclick = reactivateSubscription;
            } else {
                cancelBtn.className = 'sub-cancel-btn';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.onclick = cancelSubscription;
            }

            // Hide change tiers on refresh
            document.getElementById('subChangeTiers').style.display = 'none';
        } else {
            // Show tier picker
            activeView.style.display = 'none';
            pickerView.style.display = '';
        }
    } catch (e) {
        // Silently fail, picker stays visible
    }
}

async function dashSubscribeTier(card) {
    const tier = card.dataset.tier;
    const btn = card.querySelector('.sub-tier-btn');
    const resultEl = document.getElementById('subResult') || document.getElementById('dashBuyResult');
    if (!tier || !btn) return;

    btn.disabled = true;
    btn.textContent = 'Redirecting...';
    if (resultEl) resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/subscription`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'create', tier })
        });
        const data = await resp.json();

        if (resp.ok && data.url) {
            window.location.href = data.url;
        } else {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to start checkout.';
                resultEl.className = 'sub-result error';
            }
            btn.disabled = false;
            btn.textContent = 'Subscribe to ' + (SUB_TIERS[tier]?.label || tier);
        }
    } catch (e) {
        if (resultEl) {
            resultEl.textContent = 'Network error. Try again.';
            resultEl.className = 'sub-result error';
        }
        btn.disabled = false;
        btn.textContent = 'Subscribe to ' + (SUB_TIERS[tier]?.label || tier);
    }
}

function toggleChangeTiers() {
    const panel = document.getElementById('subChangeTiers');
    if (panel.style.display === 'none') {
        panel.style.display = '';
        renderChangeTierCards();
    } else {
        panel.style.display = 'none';
    }
}

function renderChangeTierCards() {
    const container = document.getElementById('subChangeTierCards');
    container.innerHTML = '';

    for (const [key, t] of Object.entries(SUB_TIERS)) {
        const isCurrent = key === currentSub.tier;
        const card = document.createElement('div');
        card.className = 'sub-tier-card' + (isCurrent ? ' current' : '');
        card.innerHTML = `
            <div class="sub-tier-name">${t.label}</div>
            <div class="sub-tier-price">${t.price}<span>/mo</span></div>
            <div class="sub-tier-credits">${t.credits.toLocaleString()} cr/mo</div>
            <button class="sub-tier-btn">${isCurrent ? 'Current Plan' : 'Switch to ' + t.label}</button>
        `;
        if (!isCurrent) {
            card.addEventListener('click', () => changeTier(key, card));
        }
        container.appendChild(card);
    }
}

async function changeTier(newTier, card) {
    const btn = card.querySelector('.sub-tier-btn');
    const resultEl = document.getElementById('subResult');
    btn.disabled = true;
    btn.textContent = 'Switching...';
    if (resultEl) resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/subscription`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'change', tier: newTier })
        });
        const data = await resp.json();

        if (resp.ok && data.ok) {
            if (resultEl) {
                resultEl.textContent = 'Switched to ' + (SUB_TIERS[newTier]?.label || newTier) + '!';
                resultEl.className = 'sub-result success';
            }
            loadSubscriptionStatus();
        } else {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to change plan.';
                resultEl.className = 'sub-result error';
            }
            btn.disabled = false;
            btn.textContent = 'Switch to ' + (SUB_TIERS[newTier]?.label || newTier);
        }
    } catch (e) {
        if (resultEl) {
            resultEl.textContent = 'Network error. Try again.';
            resultEl.className = 'sub-result error';
        }
        btn.disabled = false;
        btn.textContent = 'Switch to ' + (SUB_TIERS[newTier]?.label || newTier);
    }
}

async function cancelSubscription() {
    if (!confirm('Cancel your subscription? You\'ll keep access until the current period ends.')) return;

    const cancelBtn = document.getElementById('subCancelBtn');
    const resultEl = document.getElementById('subResult');
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Cancelling...';
    if (resultEl) resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/subscription`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'cancel' })
        });
        const data = await resp.json();

        if (resp.ok && data.ok) {
            if (resultEl) {
                resultEl.textContent = 'Subscription cancelled. You\'ll keep access until the period ends.';
                resultEl.className = 'sub-result success';
            }
            loadSubscriptionStatus();
        } else {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to cancel.';
                resultEl.className = 'sub-result error';
            }
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel';
        }
    } catch (e) {
        if (resultEl) {
            resultEl.textContent = 'Network error. Try again.';
            resultEl.className = 'sub-result error';
        }
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancel';
    }
}

async function reactivateSubscription() {
    const btn = document.getElementById('subCancelBtn');
    const resultEl = document.getElementById('subResult');
    btn.disabled = true;
    btn.textContent = 'Reactivating...';
    if (resultEl) resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/subscription`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'reactivate' })
        });
        const data = await resp.json();

        if (resp.ok && data.ok) {
            if (resultEl) {
                resultEl.textContent = 'Subscription reactivated!';
                resultEl.className = 'sub-result success';
            }
            loadSubscriptionStatus();
        } else {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to reactivate.';
                resultEl.className = 'sub-result error';
            }
            btn.disabled = false;
            btn.textContent = 'Reactivate';
        }
    } catch (e) {
        if (resultEl) {
            resultEl.textContent = 'Network error. Try again.';
            resultEl.className = 'sub-result error';
        }
        btn.disabled = false;
        btn.textContent = 'Reactivate';
    }
}

// ── User Projects ──
async function deleteUserProject(projectId, projectName) {
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ id: projectId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to delete project');
            return;
        }
        loadUserProjects();
    } catch (err) {
        alert('Failed to delete project');
    }
}

async function loadUserProjects() {
    const auth = getStoredAuth();
    if (!auth) return;
    const wallet = auth.profile.wallet_address;
    if (!wallet) return;

    const container = document.getElementById('projectsList');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/projects?wallet=${encodeURIComponent(wallet.toLowerCase())}`);
        const data = await res.json();
        // Filter out agent-only duplicates (no app, no token, no real content)
        const seen = {};
        const projects = (data.projects || []).filter(p => {
            if (p.agent_enabled && !p.app_slug && !p.token_address && !p.staking_address && !p.website_url) return false;
            const key = (p.name || '').toLowerCase();
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });

        if (!projects.length) {
            container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#128230;</div><p>No projects yet.</p><p class="empty-hint">Bundle your app, token, and socials into one project to track everything.</p></div>';
            return;
        }

        container.innerHTML = '';
        projects.forEach(p => container.appendChild(renderUserProjectCard(p)));
    } catch (e) {
        // silent
    }
}

function renderUserProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';

    const addrShort = p.token_address ? p.token_address.slice(0, 6) + '…' + p.token_address.slice(-4) : '';
    const initial = (p.name || 'P')[0].toUpperCase();

    let chipsHtml = '';
    if (p.app_slug) chipsHtml += `<span class="user-project-chip">App: ${esc(p.app_slug)}</span>`;
    if (addrShort) chipsHtml += `<span class="user-project-chip">${esc(addrShort)}</span>`;
    if (p.staking_address) chipsHtml += `<span class="user-project-chip">Pool</span>`;
    if (p.x_handle) chipsHtml += `<span class="user-project-chip">@${esc(p.x_handle)}</span>`;

    let actionsHtml = `<button type="button" class="project-card-action" data-edit-user-project="1">Edit</button>`;
    actionsHtml += `<button type="button" class="project-card-action" data-delete-user-project="${esc(p.id)}" data-delete-name="${esc(p.name)}" style="color:#ef4444;">Delete</button>`;
    if (p.app_slug) actionsHtml += `<a href="/s/${esc(p.app_slug)}" target="_blank" class="project-card-action">Open App</a>`;
    if (p.token_address && (p.chain === 'solana' || !p.token_address.startsWith('0x'))) actionsHtml += `<a href="https://solscan.io/token/${esc(p.token_address)}" target="_blank" rel="noopener" class="project-card-action">Solscan</a>`;
    else if (p.token_address) actionsHtml += `<a href="https://basescan.org/address/${esc(p.token_address)}" target="_blank" rel="noopener" class="project-card-action">BaseScan</a>`;
    if (p.website_url) actionsHtml += `<a href="${esc(p.website_url)}" target="_blank" rel="noopener" class="project-card-action">Website</a>`;

    card.innerHTML = `
        <div class="project-card-header">
            <div class="project-card-icon">${initial}</div>
            <div class="project-card-title">
                <div class="project-card-name">${esc(p.name)}</div>
                ${p.description ? `<div class="project-card-desc" style="font-size:0.8rem;color:var(--text-dim);margin-top:2px;">${esc(p.description).slice(0, 120)}</div>` : ''}
            </div>
        </div>
        ${chipsHtml ? `<div class="user-project-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">${chipsHtml}</div>` : ''}
        <div class="project-card-actions">${actionsHtml}</div>
    `;

    card.querySelector('[data-edit-user-project]')?.addEventListener('click', () => {
        openCreateProjectModal(p);
    });

    card.querySelector('[data-delete-user-project]')?.addEventListener('click', (e) => {
        deleteUserProject(e.currentTarget.dataset.deleteUserProject, e.currentTarget.dataset.deleteName);
    });

    return card;
}

function openCreateProjectModal(existingProject) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    const isEdit = !!existingProject;

    const overlay = document.createElement('div');
    overlay.className = 'fund-modal-overlay';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Build app dropdown options
    let appOptionsHtml = '<option value="">-- None --</option>';
    _cachedUserApps.forEach(a => {
        const sel = existingProject && existingProject.app_id === a.id ? 'selected' : '';
        appOptionsHtml += `<option value="${esc(a.id)}" data-slug="${esc(a.slug || '')}" ${sel}>${esc(a.name || a.slug || 'Untitled')}</option>`;
    });

    // Build token suggestions
    let tokenSuggestionsHtml = '';
    if (_cachedTokens.length) {
        tokenSuggestionsHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">';
        _cachedTokens.forEach(t => {
            if (t.token_address) {
                const label = t.token_symbol || t.token_address.slice(0, 8) + '…';
                const staking = t.staking_address || '';
                tokenSuggestionsHtml += `<button type="button" class="token-suggest-btn" data-addr="${esc(t.token_address)}" data-staking="${esc(staking)}" style="background:rgba(255,255,255,0.06);border:1px solid var(--border-subtle);color:var(--text-secondary);padding:2px 8px;border-radius:6px;font-size:0.75rem;cursor:pointer;">$${esc(label)}</button>`;
            }
        });
        tokenSuggestionsHtml += '</div>';
    }

    let pendingLogoUrl = existingProject?.logo_url || null;

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.innerHTML = `
        <div class="fund-modal-title">${isEdit ? 'Edit Project' : 'Create Project'}</div>
        <label class="fund-modal-label">Project Icon</label>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div id="projLogoPreview" style="width:48px;height:48px;border-radius:10px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;">
                ${pendingLogoUrl ? `<img src="${esc(pendingLogoUrl)}" style="width:100%;height:100%;object-fit:cover;" alt="">` : `<span style="color:var(--text-dim);font-size:1.2rem;">${existingProject ? existingProject.name.charAt(0).toUpperCase() : '?'}</span>`}
            </div>
            <input type="file" id="projLogoFile" accept="image/*" style="display:none;">
            <button type="button" id="projLogoBtn" class="fund-modal-submit" style="padding:6px 14px;font-size:0.78rem;">Upload Icon</button>
            <span id="projLogoStatus" style="font-size:0.75rem;color:var(--text-dim);"></span>
        </div>
        <label class="fund-modal-label">Project Name *</label>
        <input class="fund-modal-input" type="text" id="projName" maxlength="100" value="${esc(existingProject?.name || '')}">
        <label class="fund-modal-label">Short Description</label>
        <textarea class="fund-modal-input" id="projDesc" rows="2" style="resize:vertical" maxlength="500">${esc(existingProject?.description || '')}</textarea>
        <label class="fund-modal-label">Long Description (pitch, utility, roadmap)</label>
        <textarea class="fund-modal-input" id="projLongDesc" rows="6" style="resize:vertical" maxlength="5000" placeholder="Tell people what your project is about...">${esc(existingProject?.long_description || '')}</textarea>
        <label class="fund-modal-label">Link an App</label>
        <select class="fund-modal-input" id="projApp" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-subtle);padding:10px 12px;border-radius:8px;font-size:0.9rem;width:100%;">
            ${appOptionsHtml}
        </select>
        <label class="fund-modal-label">Token Address</label>
        <input class="fund-modal-input" type="text" id="projToken" placeholder="0x..." value="${esc(existingProject?.token_address || '')}">
        ${tokenSuggestionsHtml}
        <label class="fund-modal-label" style="margin-top:4px;">Staking Pool Address</label>
        <input class="fund-modal-input" type="text" id="projStaking" placeholder="Auto-detected or paste address" value="${esc(existingProject?.staking_address || '')}">
        <label class="fund-modal-label">X Handle</label>
        <input class="fund-modal-input" type="text" id="projX" placeholder="@handle" maxlength="50" value="${esc(existingProject?.x_handle || '')}">
        <label class="fund-modal-label">Website</label>
        <input class="fund-modal-input" type="text" id="projWebsite" placeholder="https://..." maxlength="200" value="${esc(existingProject?.website_url || '')}">
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="projSave">${isEdit ? 'Save Changes' : 'Create Project'}</button>
            <button class="fund-modal-cancel" id="projCancel">Cancel</button>
        </div>
        <div class="fund-modal-result" id="projResult"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Wire token suggestion clicks
    modal.querySelectorAll('.token-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelector('#projToken').value = btn.dataset.addr;
            if (btn.dataset.staking) {
                modal.querySelector('#projStaking').value = btn.dataset.staking;
            }
        });
    });

    // Wire logo upload
    modal.querySelector('#projLogoBtn').addEventListener('click', () => {
        modal.querySelector('#projLogoFile').click();
    });
    modal.querySelector('#projLogoFile').addEventListener('change', async () => {
        const file = modal.querySelector('#projLogoFile').files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            modal.querySelector('#projLogoStatus').textContent = 'Max 2MB';
            return;
        }
        modal.querySelector('#projLogoStatus').textContent = 'Uploading...';
        modal.querySelector('#projLogoBtn').disabled = true;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const token = localStorage.getItem('inclawbate_token');
                const res = await fetch('/api/inclawbate/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ file_data: reader.result, file_name: file.name, file_type: file.type }),
                });
                const data = await res.json();
                if (data.url) {
                    pendingLogoUrl = data.url;
                    modal.querySelector('#projLogoPreview').innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover;" alt="">`;
                    modal.querySelector('#projLogoStatus').textContent = 'Uploaded!';
                } else {
                    modal.querySelector('#projLogoStatus').textContent = data.error || 'Upload failed';
                }
            } catch (e) {
                modal.querySelector('#projLogoStatus').textContent = 'Upload error';
            }
            modal.querySelector('#projLogoBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    });

    modal.querySelector('#projCancel').addEventListener('click', () => overlay.remove());

    modal.querySelector('#projSave').addEventListener('click', async () => {
        const btn = modal.querySelector('#projSave');
        const resultEl = modal.querySelector('#projResult');
        const name = modal.querySelector('#projName').value.trim();

        if (!name) {
            resultEl.textContent = 'Project name is required';
            resultEl.className = 'fund-modal-result error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';
        resultEl.textContent = '';
        resultEl.className = 'fund-modal-result';

        const appSelect = modal.querySelector('#projApp');
        const selectedOption = appSelect.options[appSelect.selectedIndex];
        const appId = appSelect.value || null;
        const appSlug = selectedOption?.dataset?.slug || null;

        const body = {
            name,
            description: modal.querySelector('#projDesc').value.trim() || null,
            app_id: appId,
            app_slug: appSlug,
            token_address: modal.querySelector('#projToken').value.trim() || null,
            staking_address: modal.querySelector('#projStaking').value.trim() || null,
            x_handle: modal.querySelector('#projX').value.trim().replace(/^@/, '') || null,
            website_url: modal.querySelector('#projWebsite').value.trim() || null,
            long_description: modal.querySelector('#projLongDesc').value.trim() || null,
            logo_url: pendingLogoUrl || null,
        };

        if (isEdit) body.id = existingProject.id;

        try {
            const resp = await fetch(`${API_BASE}/projects`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Save failed');

            resultEl.textContent = isEdit ? 'Project updated!' : 'Project created!';
            resultEl.className = 'fund-modal-result success';
            btn.textContent = 'Saved!';

            setTimeout(() => {
                overlay.remove();
                loadUserProjects();
            }, 800);
        } catch (err) {
            resultEl.textContent = err.message;
            resultEl.className = 'fund-modal-result error';
            btn.disabled = false;
            btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
        }
    });
}

// ── Auto-discover Clanker tokens for wallet ──
// Finds tokens where this wallet received a mint (from 0x0), meaning they're the creator.
// Checks Blockscout token transfer history, auto-registers any not already in the DB.
let _discoveryRan = false;
async function discoverClankerTokens(wallet, knownAddrs) {
    if (!wallet || _discoveryRan) return;
    _discoveryRan = true;
    try {
        const knownSet = new Set(knownAddrs.map(a => a.toLowerCase()));
        const mintTokens = {}; // addr → { name, symbol }

        // Get token transfer history — look for mint events (from = 0x0) to this wallet
        const txResp = await fetch('https://base.blockscout.com/api/v2/addresses/' + wallet + '/token-transfers?type=ERC-20&filter=to&limit=200');
        if (!txResp.ok) return;
        const txData = await txResp.json();
        for (const item of (txData.items || [])) {
            const from = (item.from && item.from.hash || '').toLowerCase();
            const t = item.token || {};
            const addr = (t.address_hash || t.address || '').toLowerCase();
            if (from === '0x0000000000000000000000000000000000000000' && addr && !knownSet.has(addr)) {
                mintTokens[addr] = { name: t.name || 'Unknown', symbol: t.symbol || '???' };
            }
        }

        // Known Inclawbate ecosystem tokens — always attached to admin wallet,
        // checked via fee balance for other wallets
        const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
        const ECOSYSTEM_TOKENS = [
            { addr: '0x7ca47b141639b893c6782823c0b219f872056379', name: 'CLAWS', symbol: 'CLAWS' },
            { addr: '0x623a5cfc2e2e04957373a9f45b2b2beeabf82b07', name: 'PokerAI', symbol: 'POKERAI' },
            { addr: '0xb0b6e0e9da530f68d713cc03a813b506205ac808', name: 'inCLAWNCH', symbol: 'INCLAWNCH' },
            { addr: '0x9f15f27e0a28d1d521211ed17fb42901e8a7a972', name: 'stu', symbol: 'STU' },
            { addr: '0x30f5bcb8bda2b91430be93dbae08ac346884eb07', name: 'Salvation 4 Humanity', symbol: 'S4H' }
        ];
        const isAdmin = wallet.toLowerCase() === ADMIN_WALLET;
        for (const eco of ECOSYSTEM_TOKENS) {
            if (!knownSet.has(eco.addr) && !mintTokens[eco.addr]) {
                if (isAdmin) {
                    mintTokens[eco.addr] = { name: eco.name, symbol: eco.symbol };
                } else {
                    try {
                        const feeData = FEE_SEL.feesToClaim + pad32(wallet) + pad32(WETH_BASE);
                        const feeHex = await rpcCall(CLANKER_FEE_LOCKER, feeData);
                        if (fromWei(feeHex) > 0) {
                            mintTokens[eco.addr] = { name: eco.name, symbol: eco.symbol };
                        }
                    } catch (e) {}
                }
            }
        }

        const toRegister = Object.entries(mintTokens);
        if (!toRegister.length) return;

        // Auto-register discovered tokens
        let registered = 0;
        for (const [addr, info] of toRegister) {
            try {
                const resp = await fetch('/api/inclawbate/inclawbator', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        action: 'register',
                        token_address: addr,
                        token_name: info.name,
                        token_symbol: info.symbol,
                        creator_wallet: wallet,
                        chain: 'base',
                        tier: 'permissionless'
                    })
                });
                const data = await resp.json();
                if (data.project) registered++;
            } catch (e) { /* skip duplicates / errors */ }
        }

        // Refresh project list if we registered new tokens
        if (registered > 0) loadProjects();
    } catch (e) {
        // silent — discovery is best-effort
    }
}

// ── Init ──
function init() {
    // Handle Stripe payment return
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
        openBuyModal('credits');
        const cr = params.get('credits');
        const resultEl = document.getElementById('dashBuyResult');
        if (resultEl) {
            resultEl.textContent = (cr ? cr + ' credits' : 'Credits') + ' added! Refreshing balance...';
            resultEl.className = 'buy-result success';
        }
        window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('payment') === 'cancelled') {
        openBuyModal('credits');
        const resultEl = document.getElementById('dashBuyResult');
        if (resultEl) {
            resultEl.textContent = 'Payment cancelled.';
            resultEl.className = 'buy-result error';
        }
        window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('subscription') === 'success') {
        openBuyModal('subscribe');
        const resultEl = document.getElementById('subResult');
        if (resultEl) {
            resultEl.textContent = 'Subscribed! Your credits have been added.';
            resultEl.className = 'sub-result success';
        }
        window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('subscription') === 'cancelled') {
        openBuyModal('subscribe');
        window.history.replaceState({}, '', '/dashboard');
    }

    const auth = getStoredAuth();
    if (!auth) {
        document.getElementById('connectBanner')?.classList.remove('hidden');
        document.getElementById('overviewProfileCard')?.classList.add('hidden');
        loadMyStakingPositions();
        initBuyCredits();
        return;
    }

    // Show quick actions for authenticated users
    var qa = document.getElementById('quickActions');
    if (qa) qa.style.display = '';

    // Fetch fresh profile
    const profile = auth.profile;
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data?.profile) {
                localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
            }
        })
        .catch(() => {});

    // Init buy credits panel
    initBuyCredits();

    loadOverview().then(function() { loadInsights(); });
    loadProjects();
    loadUserProjects();
    loadStakingPools();
    loadMyStakingPositions();
    setInterval(updateAllocationCountdowns, 60000);

    // Wire create project button
    document.getElementById('createProjectBtn')?.addEventListener('click', () => {
        const auth = getStoredAuth();
        if (!auth) { alert('Connect your wallet first.'); return; }
        openCreateProjectModal(null);
    });

    // Wire claim/compound all buttons
    document.getElementById('mysClaimAll')?.addEventListener('click', () => claimAllPositions(false));
    document.getElementById('mysCompoundAll')?.addEventListener('click', () => claimAllPositions(true));

}

// ══════════════════════════════════════
// ADMIN: PENDING APPLICATIONS
// ══════════════════════════════════════

function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

async function loadAdminPending(wallet) {
    const section = document.getElementById('adminPendingSection');
    if (!section) return;
    section.style.display = '';

    try {
        const res = await fetch(`${API_BASE}/inclawbator?pending=true`, {
            headers: { 'x-wallet': wallet }
        });
        const data = await res.json();
        renderAdminPending(data.projects || []);
    } catch (e) {
        const list = document.getElementById('adminPendingList');
        if (list) list.innerHTML = '<p class="overview-empty">Failed to load</p>';
    }
}

function renderAdminPending(apps) {
    const list = document.getElementById('adminPendingList');
    if (!list) return;

    if (apps.length === 0) {
        list.innerHTML = '<p class="overview-empty">No pending applications</p>';
        return;
    }

    list.innerHTML = apps.map(p => {
        const borderColor = p.color || 'var(--border-subtle)';
        const meta = [];
        if (p.creator_wallet) meta.push('Wallet: ' + shortAddr(p.creator_wallet));
        if (p.x_handle) meta.push('X: @' + esc(p.x_handle).replace('@', ''));
        if (p.telegram_url) meta.push('TG: ' + esc(p.telegram_url));
        if (p.token_address) meta.push('Token: ' + shortAddr(p.token_address));

        return '<div class="admin-pending-card" style="border-color:' + borderColor + '">' +
            '<div class="pending-header">' +
                '<span class="pending-name">' + esc(p.token_name) + (p.token_symbol ? ' ($' + esc(p.token_symbol) + ')' : '') + '</span>' +
                '<span class="pending-tier">' + esc(p.tier || 'incubated') + '</span>' +
            '</div>' +
            '<div class="pending-meta">' + meta.join(' &middot; ') + '</div>' +
            (p.description ? '<div class="pending-desc">' + esc(p.description) + '</div>' : '') +
            '<div class="admin-pending-actions">' +
                '<button class="btn-approve" onclick="approveProject(\'' + p.id + '\')">Approve</button>' +
                '<button class="btn-reject" onclick="rejectProject(\'' + p.id + '\')">Reject</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

async function approveProject(id) {
    const secret = prompt('Admin secret:');
    if (!secret) return;

    try {
        const res = await fetch(`${API_BASE}/inclawbator`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'approve', project_id: id, admin_secret: secret })
        });
        const result = await res.json();
        if (result.error) {
            alert('Approve failed: ' + result.error);
        } else {
            alert('Project approved!');
            const auth = getStoredAuth();
            if (auth) loadAdminPending(auth.profile.wallet_address);
        }
    } catch (e) {
        alert('Approve failed: ' + (e.message || 'Unknown error'));
    }
}

async function rejectProject(id) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    const secret = prompt('Admin secret:');
    if (!secret) return;

    try {
        const res = await fetch(`${API_BASE}/inclawbator`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'reject', project_id: id, admin_secret: secret, rejection_reason: reason })
        });
        const result = await res.json();
        if (result.error) {
            alert('Reject failed: ' + result.error);
        } else {
            alert('Project rejected');
            const auth = getStoredAuth();
            if (auth) loadAdminPending(auth.profile.wallet_address);
        }
    } catch (e) {
        alert('Reject failed: ' + (e.message || 'Unknown error'));
    }
}

// ══════════════════════════════════════
// DASHBOARD TABS
// ══════════════════════════════════════

(function() {
    var tabs = document.querySelectorAll('.dash-tab[data-tab]');
    var sections = document.querySelectorAll('.overview-section[data-section]');
    var activeTab = 'all';

    function switchTab(tab) {
        activeTab = tab;
        tabs.forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-tab') === tab);
        });
        sections.forEach(function(s) {
            var sec = s.getAttribute('data-section');
            if (tab === 'all') {
                s.classList.remove('tab-hidden');
            } else {
                s.classList.toggle('tab-hidden', sec !== tab);
            }
        });
        // Update URL hash
        if (tab !== 'all') {
            history.replaceState(null, '', '/dashboard#' + tab);
        } else {
            history.replaceState(null, '', '/dashboard');
        }
    }

    tabs.forEach(function(t) {
        t.addEventListener('click', function() {
            var tab = t.getAttribute('data-tab');
            // Toggle: clicking active tab goes back to All
            if (tab === activeTab && tab !== 'all') {
                switchTab('all');
            } else {
                switchTab(tab);
            }
        });
    });

    // Check initial hash
    var hash = window.location.hash.replace('#', '');
    if (hash && ['projects','tokens','apps','staking','agents','insights','incubation'].indexOf(hash) !== -1) {
        switchTab(hash);
    } else {
        // Default: "All" is active
        tabs.forEach(function(t) {
            if (t.getAttribute('data-tab') === 'all') t.classList.add('active');
        });
    }
})();

// ══════════════════════════════════════
// INSIGHTS
// ══════════════════════════════════════

async function loadInsights() {
    const auth = getStoredAuth();
    if (!auth) return;

    // Use cached data from loadOverview where possible
    const apps = _cachedUserApps || [];
    const totalUpvotes = apps.reduce(function(sum, a) { return sum + (a.upvote_count || 0); }, 0);

    var el;
    el = document.getElementById('insAppsCreated');
    if (el) el.textContent = apps.length;
    el = document.getElementById('insUpvotes');
    if (el) el.textContent = totalUpvotes;

    // Credits
    var creditsEl = document.getElementById('profileCredits');
    var credits = creditsEl ? creditsEl.textContent.replace(/,/g, '') : '0';
    el = document.getElementById('insCredits');
    if (el) el.textContent = Number(credits).toLocaleString();

    // Saved apps count
    try {
        var savedResp = await fetch(API_BASE + '/apps?saved=true', { headers: authHeaders() });
        if (savedResp.ok) {
            var savedData = await savedResp.json();
            el = document.getElementById('insSaved');
            if (el) el.textContent = savedData.apps ? savedData.apps.length : 0;
        }
    } catch(e) {}

    // Staking positions count
    var stakingRows = document.querySelectorAll('#myStakingPositionsList .staking-position-card');
    el = document.getElementById('insStaking');
    if (el) el.textContent = stakingRows.length;

    // Projects count
    var projectRows = document.querySelectorAll('#projectsList .project-card, #projectsList .overview-card');
    el = document.getElementById('insProjects');
    if (el) el.textContent = projectRows.length;

    // App performance list
    var listEl = document.getElementById('insAppsList');
    if (!listEl) return;
    if (!apps.length) {
        listEl.innerHTML = '<div class="overview-empty"><p>No apps yet. <a href="/build" style="color:var(--seafoam-400)">Build one</a></p></div>';
        return;
    }
    var sorted = apps.slice().sort(function(a, b) { return (b.upvote_count || 0) - (a.upvote_count || 0); });
    listEl.innerHTML = sorted.map(function(a) {
        var cat = a.category || 'other';
        var price = a.claws_price > 0 ? a.claws_price + ' CLAWS' : 'Free';
        return '<div class="insight-app-row">' +
            '<span class="insight-app-name">' + esc(a.name) + '</span>' +
            '<div class="insight-app-stats">' +
                '<span class="insight-app-stat"><span class="stat-icon">\u{1F44D}</span> ' + (a.upvote_count || 0) + '</span>' +
                '<span class="insight-app-stat"><span class="stat-icon">\u{1F3F7}</span> ' + esc(cat) + '</span>' +
                '<span class="insight-app-stat">' + esc(price) + '</span>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ══════════════════════════════════════
// AI AGENTS PANEL
// ══════════════════════════════════════

// Cache agent projects for controls
var _agentProjects = [];

async function loadAgents() {
    var container = document.getElementById('agentsList');
    if (!container) return;

    var auth = getStoredAuth();
    if (!auth || !auth.profile || !auth.profile.wallet_address) {
        container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#129302;</div><p>No agents yet.</p><p class="empty-hint">Create an AI agent to auto-post on X for your project.</p></div>';
        return;
    }

    try {
        var res = await fetch(API_BASE + '/inclawbator?wallet=' + encodeURIComponent(auth.profile.wallet_address));
        var data = await res.json();
        var projects = (data.projects || []).filter(function(p) { return p.agent_enabled; });
        _agentProjects = projects;

        if (!projects.length) {
            container.innerHTML = '<div class="overview-empty"><div class="empty-icon">&#129302;</div><p>No agents yet.</p><p class="empty-hint">Create an AI agent to auto-post on X.</p><button onclick="openCreateAgent()" style="margin-top:10px;padding:10px 24px;background:var(--accent-gradient);border:none;border-radius:var(--radius-md);color:#fff;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer">Create Your First Agent</button></div>';
            return;
        }

        var html = '';
        for (var i = 0; i < projects.length; i++) {
            var p = projects[i];
            var st = p.agent_status || 'dormant';
            var postsVia = p.x_connected && p.x_handle ? '@' + esc(p.x_handle) : '@inclawbator';
            var xBadgeClass = p.x_connected ? 'connected' : 'fallback';
            var credits = p.agent_credits || 0;
            var totalPosts = p.agent_total_posts || 0;
            var postsPerDay = p.agent_posts_per_day || 2;
            var toggleLabel = st === 'active' ? 'Pause' : 'Resume';
            var toggleIcon = st === 'active' ? '⏸' : '▶';

            html += '<div class="agent-card" id="agentCard_' + p.id + '">';

            // Header with optional pfp
            html += '<div class="agent-card-header">';
            html += '<div style="display:flex;align-items:center;gap:10px">';
            if (p.logo_url) {
                html += '<img src="' + esc(p.logo_url) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border-subtle)" onerror="this.style.display=\'none\'">';
            } else {
                html += '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--text-dim);font-size:0.9rem">' + (p.token_symbol || '?')[0] + '</div>';
            }
            html += '<div class="agent-card-name">' + esc(p.token_name || p.token_symbol || '???') + '</div>';
            html += '</div>';
            html += '<span class="agent-status-pill ' + st + '">' + st + '</span>';
            html += '</div>';

            // Stats grid
            html += '<div class="agent-stats-grid">';
            html += '<div class="agent-stat"><div class="agent-stat-label">Credits</div><div class="agent-stat-value">' + credits + '</div></div>';
            html += '<div class="agent-stat"><div class="agent-stat-label">Total Posts</div><div class="agent-stat-value">' + totalPosts + '</div></div>';
            html += '<div class="agent-stat"><div class="agent-stat-label">Posts/Day</div><div class="agent-stat-value">' + postsPerDay + '</div></div>';
            html += '<div class="agent-stat"><div class="agent-stat-label">Posts via</div><div class="agent-stat-value accent" style="font-size:0.78rem">' + postsVia + '</div></div>';
            html += '</div>';

            // Action buttons
            html += '<div class="agent-actions">';
            html += '<button class="agent-action-btn' + (st === 'active' ? '' : ' primary') + '" onclick="toggleAgentStatus(\'' + p.id + '\',\'' + st + '\')">' + toggleIcon + ' ' + toggleLabel + '</button>';
            html += '<button class="agent-action-btn" onclick="toggleAgentPanel(\'' + p.id + '\',\'persona\')">Edit Persona</button>';
            html += '<button class="agent-action-btn" onclick="toggleAgentPanel(\'' + p.id + '\',\'posts\')">Post History</button>';
            if (p.x_connected) {
                html += '<button class="agent-action-btn danger" onclick="disconnectAgentX(\'' + p.id + '\')">Disconnect X</button>';
            } else {
                html += '<button class="agent-action-btn" onclick="connectAgentX(\'' + p.id + '\')">Connect X</button>';
            }
            html += '<a href="/inclawbator?id=' + p.id + '" class="agent-action-btn" style="text-decoration:none;text-align:center">Feed Credits</a>';
            html += '</div>';

            // X connection info
            if (p.x_connected && p.x_handle) {
                html += '<div style="margin-bottom:var(--space-sm)"><span class="agent-x-badge connected">&#120143; Connected: @' + esc(p.x_handle) + '</span></div>';
            } else {
                html += '<div style="margin-bottom:var(--space-sm)"><span class="agent-x-badge fallback">Posts go to @inclawbator (shared)</span></div>';
            }

            // Persona editor panel (hidden by default)
            html += '<div class="agent-panel" id="agentPersona_' + p.id + '">';
            html += '<div class="agent-panel-title">Agent Persona</div>';
            html += '<textarea class="agent-persona-textarea" id="personaText_' + p.id + '" placeholder="Describe how your agent should tweet...">' + esc(p.agent_persona || '') + '</textarea>';
            html += '<div class="agent-posts-per-day">';
            html += '<label>Posts per day:</label>';
            html += '<select id="postsPerDay_' + p.id + '">';
            for (var d = 1; d <= 3; d++) {
                html += '<option value="' + d + '"' + (d === postsPerDay ? ' selected' : '') + '>' + d + '</option>';
            }
            html += '</select>';
            html += '</div>';
            html += '<div class="agent-persona-actions">';
            html += '<button class="agent-action-btn primary" onclick="saveAgentPersona(\'' + p.id + '\')">Save</button>';
            html += '<button class="agent-action-btn" onclick="toggleAgentPanel(\'' + p.id + '\',\'persona\')">Cancel</button>';
            html += '</div>';
            html += '</div>';

            // Post history panel (hidden by default)
            html += '<div class="agent-panel" id="agentPosts_' + p.id + '">';
            html += '<div class="agent-panel-title">Recent Posts</div>';
            html += '<div id="agentPostsList_' + p.id + '"><div style="font-size:0.8rem;color:var(--text-dim)">Loading...</div></div>';
            html += '</div>';

            html += '</div>'; // end agent-card
        }

        container.innerHTML = html;

    } catch (err) {
        console.error('[agents]', err);
        container.innerHTML = '<div class="overview-empty"><p>Failed to load agents.</p></div>';
    }
}

// ── Toggle agent panels ──
function toggleAgentPanel(projectId, panel) {
    var panelId = panel === 'persona' ? 'agentPersona_' + projectId : 'agentPosts_' + projectId;
    var el = document.getElementById(panelId);
    if (!el) return;
    var isOpen = el.classList.contains('open');
    // Close all panels on this card first
    var card = document.getElementById('agentCard_' + projectId);
    if (card) card.querySelectorAll('.agent-panel').forEach(function(p) { p.classList.remove('open'); });
    if (!isOpen) {
        el.classList.add('open');
        if (panel === 'posts') loadAgentPosts(projectId);
    }
}

// ── Pause / Resume ──
async function toggleAgentStatus(projectId, currentStatus) {
    var newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
        var res = await fetch(API_BASE + '/inclawbator', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'update-agent', project_id: projectId, agent_status: newStatus })
        });
        var data = await res.json();
        if (res.ok) {
            showToast(newStatus === 'active' ? 'Agent resumed' : 'Agent paused');
            loadAgents();
        } else {
            showToast(data.error || 'Failed to update', true);
        }
    } catch (e) {
        showToast('Network error', true);
    }
}

// ── Save persona ──
async function saveAgentPersona(projectId) {
    var personaEl = document.getElementById('personaText_' + projectId);
    var ppdEl = document.getElementById('postsPerDay_' + projectId);
    if (!personaEl) return;

    var persona = personaEl.value.trim();
    var postsPerDay = parseInt(ppdEl ? ppdEl.value : '2') || 2;

    try {
        var res = await fetch(API_BASE + '/inclawbator', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'update-agent', project_id: projectId, agent_persona: persona, agent_posts_per_day: postsPerDay })
        });
        var data = await res.json();
        if (res.ok) {
            showToast('Persona saved');
            toggleAgentPanel(projectId, 'persona');
            loadAgents();
        } else {
            showToast(data.error || 'Failed to save', true);
        }
    } catch (e) {
        showToast('Network error', true);
    }
}

// ── Load post history ──
async function loadAgentPosts(projectId) {
    var listEl = document.getElementById('agentPostsList_' + projectId);
    if (!listEl) return;
    listEl.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">Loading...</div>';

    try {
        var res = await fetch(API_BASE + '/inclawbator?id=' + projectId);
        var data = await res.json();
        var posts = data.agent_posts || [];
        var proj = data.project || {};
        var xHandle = proj.x_connected && proj.x_handle ? proj.x_handle : 'inclawbator';

        if (!posts.length) {
            listEl.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">No posts yet. Agent will start posting once it has credits.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < posts.length; i++) {
            var post = posts[i];
            var ago = timeAgo(post.created_at);
            var statusClass = post.status === 'posted' ? 'posted' : 'failed';
            html += '<div class="agent-post-item">';
            html += '<div class="agent-post-time">' + ago + '</div>';
            html += '<div class="agent-post-text">' + esc(post.tweet_text || '');
            html += ' <span class="agent-post-status ' + statusClass + '">' + post.status + '</span>';
            html += '</div>';
            if (post.tweet_id) {
                html += '<div class="agent-post-link"><a href="https://x.com/' + esc(xHandle) + '/status/' + esc(post.tweet_id) + '" target="_blank">View</a></div>';
            }
            html += '</div>';
        }
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<div style="font-size:0.8rem;color:#f87171">Failed to load posts.</div>';
    }
}

// ── Connect / Disconnect X ──
function connectAgentX(projectId) {
    // Redirect to unified agents page
    window.location.href = '/agents';
}

async function disconnectAgentX(projectId) {
    if (!confirm('Disconnect X account? Agent will post to @inclawbator instead.')) return;
    try {
        var res = await fetch(API_BASE + '/inclawbator', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'disconnect-x', project_id: projectId })
        });
        if (res.ok) {
            showToast('X account disconnected');
            loadAgents();
        } else {
            var data = await res.json();
            showToast(data.error || 'Failed to disconnect', true);
        }
    } catch (e) {
        showToast('Network error', true);
    }
}

// ── Toast helper (reuse existing or create simple one) ──
function showToast(msg, isError) {
    var existing = document.getElementById('agentToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'agentToast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:12px;font-size:0.85rem;font-weight:600;z-index:9999;font-family:var(--font-body);' +
        (isError ? 'background:#1a0a0a;border:1px solid hsla(0,60%,50%,0.4);color:#f87171;' : 'background:#0a1a12;border:1px solid hsla(142,52%,48%,0.3);color:#4ade80;');
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(function() { toast.remove(); }, 2900);
}

// ══════════════════════════════════════
// CREATE AGENT
// ══════════════════════════════════════

var _agentPfpFile = null;
var _agentSelectedVibe = 'degen';

var VIBE_PERSONAS = {
    degen: 'You are a degen crypto enthusiast. Use slang like "lfg", "gm", "wagmi", "ser". Be bullish, energetic, and hype. Use fire/rocket emojis. Keep tweets short and punchy.',
    hype: 'You are an ultra-hype marketing agent. Every post should build excitement and FOMO. Use caps for emphasis, countdown energy, and make everything sound like the biggest thing happening right now.',
    chill: 'You are laid-back and conversational. Share updates casually like you are talking to friends. No hype, no caps lock. Just genuine, relaxed vibes about the project.',
    professional: 'You are a professional project communicator. Write clear, informative tweets about developments, metrics, and milestones. No slang, no emojis. Credible and data-driven.',
    meme: 'You are a meme lord. Every tweet should be funny, irreverent, or reference popular memes. Roast competitors gently. Use absurd humor. Make people laugh first, learn about the project second.'
};

function openCreateAgent() {
    var modal = document.getElementById('createAgentModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Reset form
    document.getElementById('createAgentName').value = '';
    document.getElementById('createAgentPersona').value = '';
    document.getElementById('createAgentPPD').value = '2';
    document.getElementById('createAgentResult').textContent = '';
    document.getElementById('createAgentBtn').disabled = false;
    _agentPfpFile = null;

    // Reset pfp preview
    var preview = document.getElementById('agentPfpPreview');
    preview.innerHTML = '<span id="agentPfpPlaceholder" style="font-size:0.7rem;color:var(--text-dim);text-align:center;line-height:1.2">Upload<br>pic</span>';
    preview.style.borderStyle = 'dashed';

    // Reset vibe
    _agentSelectedVibe = 'degen';
    document.querySelectorAll('.agent-vibe-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.vibe === 'degen'); });
    document.getElementById('createAgentPersonaWrap').style.display = 'none';

    // Populate token dropdown from cached projects
    var select = document.getElementById('createAgentToken');
    select.innerHTML = '<option value="">No token — standalone agent</option>';
    if (_agentProjects && _agentProjects.length) {
        // Filter out projects that already have agents
        var agentProjectIds = _agentProjects.map(function(p) { return p.id; });
    }
    // Use _cachedTokens (all user projects)
    if (typeof _cachedTokens !== 'undefined' && _cachedTokens.length) {
        _cachedTokens.forEach(function(t) {
            var symbol = t.token_symbol || '';
            var name = t.token_name || '';
            var hasAgent = t.agent_enabled;
            var label = '$' + symbol + (name ? ' — ' + name : '');
            if (hasAgent) label += ' (agent exists)';
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = label;
            if (hasAgent) opt.disabled = true;
            select.appendChild(opt);
        });
    }
}

function closeCreateAgent() {
    var modal = document.getElementById('createAgentModal');
    if (modal) modal.classList.add('hidden');
}

function previewAgentPfp(input) {
    if (!input.files || !input.files[0]) return;
    _agentPfpFile = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
        var preview = document.getElementById('agentPfpPreview');
        preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover">';
        preview.style.borderStyle = 'solid';
        preview.style.borderColor = 'var(--lobster-300)';
    };
    reader.readAsDataURL(_agentPfpFile);
}

function selectAgentVibe(btn) {
    document.querySelectorAll('.agent-vibe-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    _agentSelectedVibe = btn.dataset.vibe;
    var personaWrap = document.getElementById('createAgentPersonaWrap');
    if (_agentSelectedVibe === 'custom') {
        personaWrap.style.display = 'block';
    } else {
        personaWrap.style.display = 'none';
    }
}

async function uploadAgentPfp() {
    if (!_agentPfpFile) return null;
    return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = async function(e) {
            try {
                var res = await fetch(API_BASE + '/upload', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        file_data: e.target.result,
                        file_name: 'agent-pfp-' + Date.now() + '.' + (_agentPfpFile.type.split('/')[1] || 'png'),
                        file_type: _agentPfpFile.type
                    })
                });
                if (res.ok) {
                    var data = await res.json();
                    resolve(data.url);
                } else {
                    resolve(null);
                }
            } catch (e) {
                resolve(null);
            }
        };
        reader.readAsDataURL(_agentPfpFile);
    });
}

async function submitCreateAgent() {
    var auth = getStoredAuth();
    if (!auth || !auth.profile) {
        showToast('Sign in first', true);
        return;
    }

    var nameEl = document.getElementById('createAgentName');
    var name = (nameEl.value || '').trim();
    if (!name) {
        showToast('Give your agent a name', true);
        nameEl.focus();
        return;
    }

    var btn = document.getElementById('createAgentBtn');
    var result = document.getElementById('createAgentResult');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    result.textContent = '';
    result.className = 'buy-result';

    // Build persona from vibe or custom
    var persona;
    if (_agentSelectedVibe === 'custom') {
        persona = (document.getElementById('createAgentPersona').value || '').trim();
    } else {
        persona = VIBE_PERSONAS[_agentSelectedVibe] || '';
    }
    // Prepend agent name to persona
    persona = 'Agent name: ' + name + '. ' + persona;

    var postsPerDay = parseInt(document.getElementById('createAgentPPD').value) || 2;
    var tokenProjectId = document.getElementById('createAgentToken').value;

    try {
        // Upload pfp if selected
        var logoUrl = await uploadAgentPfp();

        var wallet = auth.profile.wallet_address || '';

        // If linking to existing project, just enable agent on it
        if (tokenProjectId) {
            var res = await fetch(API_BASE + '/inclawbator', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'update-agent',
                    project_id: tokenProjectId,
                    agent_enabled: true,
                    agent_persona: persona,
                    agent_posts_per_day: postsPerDay,
                    agent_status: 'active'
                })
            });
            var data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');

            // Update logo if uploaded
            if (logoUrl) {
                await fetch(API_BASE + '/inclawbator', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ action: 'update-project', project_id: tokenProjectId, logo_url: logoUrl })
                });
            }
        } else {
            // Create standalone agent project
            var res = await fetch(API_BASE + '/inclawbator', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'register',
                    token_name: name,
                    token_symbol: name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase(),
                    creator_wallet: wallet,
                    agent_enabled: true,
                    agent_persona: persona,
                    agent_posts_per_day: postsPerDay,
                    logo_url: logoUrl || null,
                    tier: 'agent',
                    description: 'AI agent: ' + name
                })
            });
            var data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
        }

        result.textContent = 'Agent created! Connect your X account to start posting.';
        result.className = 'buy-result success';
        btn.textContent = 'Done';

        // Reload agents list after short delay
        setTimeout(function() {
            closeCreateAgent();
            loadAgents();
        }, 1200);

    } catch (err) {
        result.textContent = err.message || 'Something went wrong';
        result.className = 'buy-result error';
        btn.disabled = false;
        btn.textContent = 'Create Agent';
    }
}

// Boot
init();
loadAgents();
