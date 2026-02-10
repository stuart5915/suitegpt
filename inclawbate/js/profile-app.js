// Inclawbate — Profile Page Controller (Staking Model)
import { humansApi } from './humans-api.js';

const SECTIONS = {
    loading: document.getElementById('profileLoading'),
    notFound: document.getElementById('profileNotFound'),
    page: document.getElementById('profilePage')
};

function showSection(name) {
    Object.values(SECTIONS).forEach(el => { if (el) el.classList.add('hidden'); });
    if (SECTIONS[name]) SECTIONS[name].classList.remove('hidden');
}

function getHandle() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('u');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1].toLowerCase() : null;
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

async function init() {
    const handle = getHandle();
    if (!handle) { showSection('notFound'); return; }

    showSection('loading');

    try {
        const res = await humansApi.getProfile(handle);
        if (!res || !res.profile) { showSection('notFound'); return; }
        renderProfile(res.profile);
    } catch (err) {
        console.error('Profile load error:', err);
        showSection('notFound');
    }
}

function renderProfile(p) {
    document.title = `${p.x_name || p.x_handle} — inclawbate`;

    // Avatar
    const avatarEl = document.getElementById('profileAvatar');
    const avatarFallback = document.getElementById('profileAvatarFallback');
    if (p.x_avatar_url) {
        avatarEl.src = p.x_avatar_url;
        avatarEl.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
    } else {
        avatarEl.classList.add('hidden');
        avatarFallback.classList.remove('hidden');
        avatarFallback.textContent = (p.x_name || p.x_handle || '?')[0].toUpperCase();
    }

    document.getElementById('profileName').textContent = p.x_name || p.x_handle;
    document.getElementById('profileHandle').innerHTML = `<a href="https://x.com/${esc(p.x_handle)}" target="_blank" rel="noopener">@${esc(p.x_handle)}</a>`;
    document.getElementById('profileTagline').textContent = p.tagline || '';

    // Availability badge
    const availEl = document.getElementById('profileAvailability');
    availEl.textContent = p.availability || 'available';
    availEl.className = `badge badge-${p.availability === 'available' ? 'green' : p.availability === 'busy' ? 'yellow' : 'dim'}`;

    // Stake badge (placeholder — will show total staked once staking is live)
    const stakeBadge = document.getElementById('profileStakeBadge');
    if (p.min_stake_clawnch && p.min_stake_clawnch > 0) {
        stakeBadge.textContent = `Min ${p.min_stake_clawnch} $CLAWNCH`;
        stakeBadge.classList.remove('hidden');
    }

    // Skills
    const skillsHtml = (p.skills || []).map(s => `<span class="badge badge-primary">${esc(s)}</span>`).join('');
    document.getElementById('profileSkills').innerHTML = skillsHtml || '<span class="text-dim">No skills listed</span>';

    // Bio
    document.getElementById('profileBio').textContent = p.bio || 'No bio provided.';

    // Details
    const detailsHtml = [];

    if (p.min_stake_clawnch !== undefined) {
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Min Stake</div><div class="profile-detail-value">${p.min_stake_clawnch || 0} $CLAWNCH</div></div>`);
    }

    if (p.contact_preference) {
        const prefLabel = { x_dm: 'X DM', email: 'Email', discord: 'Discord', telegram: 'Telegram' }[p.contact_preference] || p.contact_preference;
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Contact</div><div class="profile-detail-value">${esc(prefLabel)}</div></div>`);
    }

    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Unstake Fee</div><div class="profile-detail-value">5% to human</div></div>`);

    if (p.wallet_address) {
        const short = p.wallet_address.slice(0, 6) + '...' + p.wallet_address.slice(-4);
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Wallet</div><div class="profile-detail-value" style="font-family:var(--font-mono);font-size:0.8rem">${short}</div></div>`);
    }

    document.getElementById('profileDetails').innerHTML = detailsHtml.join('') || '<p class="text-dim">No additional details.</p>';

    // Action links
    document.getElementById('hireCta').href = `https://x.com/messages/compose?recipient_id=${p.x_handle}`;
    document.getElementById('skillDocLink').href = `/u/${p.x_handle}/skill`;

    showSection('page');
}

init();
