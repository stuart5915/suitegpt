// Inclawbate — Profile Page Controller (Payment + Edit)
import { humansApi } from './humans-api.js';

const SECTIONS = {
    loading: document.getElementById('profileLoading'),
    notFound: document.getElementById('profileNotFound'),
    page: document.getElementById('profilePage')
};

let currentProfile = null;
let isOwnProfile = false;
let editPortfolioLinks = [];

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

function getStoredProfile() {
    try {
        const str = localStorage.getItem('inclawbate_profile');
        return str ? JSON.parse(str) : null;
    } catch { return null; }
}

async function init() {
    const handle = getHandle();
    if (!handle) { showSection('notFound'); return; }

    showSection('loading');

    // Check if this is the logged-in user's own profile
    const stored = getStoredProfile();
    if (stored && stored.x_handle && stored.x_handle.toLowerCase() === handle) {
        isOwnProfile = true;
    }

    try {
        const res = await humansApi.getProfile(handle);
        if (!res || !res.profile) { showSection('notFound'); return; }
        currentProfile = res.profile;
        renderProfile(currentProfile);
    } catch (err) {
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

    // Capacity badge
    const capacityBadge = document.getElementById('profileCapacityBadge');
    const capacity = p.available_capacity !== undefined ? p.available_capacity : 100;
    capacityBadge.textContent = `${capacity}% capacity`;

    // Hire count badge
    const hireCount = p.hire_count || 0;
    const hireBadge = document.getElementById('profileHireCount');
    if (hireCount > 0 && hireBadge) {
        hireBadge.textContent = `Hired ${hireCount} time${hireCount !== 1 ? 's' : ''}`;
        hireBadge.style.display = '';
    }

    // Skills
    const skillsHtml = (p.skills || []).map(s => `<span class="badge badge-primary">${esc(s)}</span>`).join('');
    document.getElementById('profileSkills').innerHTML = skillsHtml || '<span class="text-dim">No skills listed</span>';

    // Portfolio
    const links = p.portfolio_links || [];
    const portfolioSection = document.getElementById('portfolioSection');
    if (links.length > 0 && portfolioSection) {
        portfolioSection.style.display = '';
        document.getElementById('profilePortfolio').innerHTML = links.map(u => {
            const display = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return `<a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--lobster-300);font-size:0.92rem;word-break:break-all;">${esc(display)}</a>`;
        }).join('');
    }

    // Bio
    document.getElementById('profileBio').textContent = p.bio || 'No bio provided.';

    // Details
    const detailsHtml = [];
    const respLabels = { under_1h: 'Under 1 hour', under_4h: 'Under 4 hours', under_24h: 'Under 24 hours', under_48h: 'Under 48 hours' };

    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Available Capacity</div><div class="profile-detail-value">${capacity}%</div></div>`);
    if (p.response_time) {
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Response Time</div><div class="profile-detail-value">${esc(respLabels[p.response_time] || p.response_time)}</div></div>`);
    }
    if (p.timezone) {
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Timezone</div><div class="profile-detail-value">${esc(p.timezone)}</div></div>`);
    }
    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Contact</div><div class="profile-detail-value"><a href="/dashboard" style="color:var(--lobster-300)">Via Inbox</a></div></div>`);
    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Payment</div><div class="profile-detail-value">$CLAWNCH</div></div>`);
    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Platform Fee</div><div class="profile-detail-value" style="color:var(--seafoam-400)">None</div></div>`);

    if (p.wallet_address) {
        const short = p.wallet_address.slice(0, 6) + '...' + p.wallet_address.slice(-4);
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Wallet</div><div class="profile-detail-value" style="font-family:var(--font-mono);font-size:0.8rem">${short}</div></div>`);
    }

    document.getElementById('profileDetails').innerHTML = detailsHtml.join('') || '<p class="text-dim">No additional details.</p>';

    // X timeline feed
    const feedSection = document.getElementById('feedSection');
    const timelineEl = document.getElementById('xTimeline');
    if (feedSection && timelineEl && p.x_handle) {
        timelineEl.href = `https://x.com/${p.x_handle}`;
        feedSection.style.display = '';
    }

    // Action links
    document.getElementById('skillDocLink').href = `/u/${p.x_handle}/skill`;

    // Show edit button if own profile
    const editBtn = document.getElementById('editProfileBtn');
    if (isOwnProfile && editBtn) {
        editBtn.classList.remove('hidden');
    }

    // Set up payment modal
    document.getElementById('payHumanName').textContent = p.x_name || p.x_handle;
    document.getElementById('payRecipient').textContent = `@${p.x_handle}`;
    document.getElementById('paySuccessName').textContent = p.x_name || p.x_handle;

    showSection('page');
}

// ── Edit Modal ──
const editModal = document.getElementById('editModal');
let editSkills = [];

function openEditModal() {
    if (!currentProfile) return;

    // Pre-fill fields
    document.getElementById('editTagline').value = currentProfile.tagline || '';
    document.getElementById('editBio').value = currentProfile.bio || '';
    document.getElementById('editWallet').value = currentProfile.wallet_address || '';
    document.getElementById('editAvailability').value = currentProfile.availability || 'available';

    const cap = currentProfile.available_capacity !== undefined ? currentProfile.available_capacity : 100;
    document.getElementById('editCapacity').value = cap;
    document.getElementById('editCapacityVal').textContent = cap + '%';

    if (currentProfile.response_time) document.getElementById('editResponseTime').value = currentProfile.response_time;
    const tz = currentProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('editTimezone').textContent = tz;

    editPortfolioLinks = [...(currentProfile.portfolio_links || [])];
    renderEditPortfolioLinks();

    editSkills = [...(currentProfile.skills || [])];
    renderEditSkills();

    // Telegram status
    const telegramLabel = document.getElementById('telegramLabel');
    const telegramBtn = document.getElementById('telegramConnectBtn');
    if (currentProfile.telegram_chat_id) {
        telegramLabel.textContent = 'Connected';
        telegramLabel.style.color = 'var(--seafoam-400)';
        telegramBtn.textContent = 'Reconnect';
    } else {
        telegramLabel.textContent = 'Not connected';
        telegramLabel.style.color = '';
        telegramBtn.textContent = 'Connect Telegram';
    }
    telegramBtn.href = `https://t.me/inclawbate_bot?start=${currentProfile.x_handle}`;

    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
}

function renderEditSkills() {
    const container = document.getElementById('editSkillTags');
    container.innerHTML = editSkills.map(s =>
        `<span class="badge badge-primary" style="cursor:pointer;" data-skill="${esc(s)}">${esc(s)} &times;</span>`
    ).join('');

    container.querySelectorAll('[data-skill]').forEach(el => {
        el.addEventListener('click', () => {
            editSkills = editSkills.filter(s => s !== el.dataset.skill);
            renderEditSkills();
        });
    });
}

function renderEditPortfolioLinks() {
    const container = document.getElementById('editPortfolioLinks');
    container.innerHTML = editPortfolioLinks.map(u => {
        const display = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `<div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;">
            <a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--lobster-300);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(display)}</a>
            <button type="button" data-url="${esc(u)}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem;padding:0 4px;">&times;</button>
        </div>`;
    }).join('');

    container.querySelectorAll('button[data-url]').forEach(btn => {
        btn.addEventListener('click', () => {
            editPortfolioLinks = editPortfolioLinks.filter(u => u !== btn.dataset.url);
            renderEditPortfolioLinks();
        });
    });
}

async function saveProfile() {
    const btn = document.getElementById('editSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const editRespTime = document.getElementById('editResponseTime').value;
        const updates = {
            tagline: document.getElementById('editTagline').value.trim(),
            bio: document.getElementById('editBio').value.trim(),
            skills: editSkills,
            available_capacity: parseInt(document.getElementById('editCapacity').value) || 100,
            wallet_address: document.getElementById('editWallet').value.trim() || null,
            availability: document.getElementById('editAvailability').value,
            response_time: editRespTime || undefined,
            timezone: document.getElementById('editTimezone').textContent || undefined,
            portfolio_links: editPortfolioLinks.length > 0 ? editPortfolioLinks : []
        };

        const result = await humansApi.updateProfile(updates);
        currentProfile = result.profile;
        localStorage.setItem('inclawbate_profile', JSON.stringify(currentProfile));

        // Re-render the profile page with new data
        renderProfile(currentProfile);
        closeEditModal();
    } catch (err) {
        alert('Failed to save: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

// Edit button
document.getElementById('editProfileBtn')?.addEventListener('click', openEditModal);

// Close edit modal
document.getElementById('editClose')?.addEventListener('click', closeEditModal);
editModal?.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

// Capacity slider
document.getElementById('editCapacity')?.addEventListener('input', (e) => {
    document.getElementById('editCapacityVal').textContent = e.target.value + '%';
});

// Skill input
document.getElementById('editSkillInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(/,/g, '').toLowerCase();
        if (val && !editSkills.includes(val)) {
            editSkills.push(val);
            renderEditSkills();
            e.target.value = '';
        }
    }
});

// Portfolio input
document.getElementById('editPortfolioInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val && editPortfolioLinks.length < 3 && /^https?:\/\/.+/.test(val) && !editPortfolioLinks.includes(val)) {
            editPortfolioLinks.push(val);
            renderEditPortfolioLinks();
            e.target.value = '';
        }
    }
});

// Save button
document.getElementById('editSaveBtn')?.addEventListener('click', saveProfile);

// ── Payment Modal ──
const modal = document.getElementById('paymentModal');
const payStep1 = document.getElementById('payStep1');
const payStep2 = document.getElementById('payStep2');
const payStep3 = document.getElementById('payStep3');

function showPayStep(n) {
    [payStep1, payStep2, payStep3].forEach((el, i) => {
        el.classList.toggle('hidden', i !== n - 1);
    });
}

function openPaymentModal() {
    showPayStep(1);
    modal.classList.remove('hidden');
}

function closePaymentModal() {
    modal.classList.add('hidden');
    document.getElementById('payAmountInput').value = '';
    document.getElementById('sendPaymentBtn').disabled = true;
}

// Hire button opens modal
document.getElementById('hireCta')?.addEventListener('click', openPaymentModal);

// Close modal
document.getElementById('paymentClose')?.addEventListener('click', closePaymentModal);
modal?.addEventListener('click', (e) => {
    if (e.target === modal) closePaymentModal();
});

// Connect wallet
document.getElementById('connectWalletBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('connectWalletBtn');
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    try {
        if (typeof window.ethereum === 'undefined') {
            alert('No wallet detected. Please install MetaMask or another Base-compatible wallet.');
            btn.disabled = false;
            btn.textContent = 'Connect Wallet';
            return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
            const addr = accounts[0];
            const short = addr.slice(0, 6) + '...' + addr.slice(-4);
            document.getElementById('payWalletInfo').textContent = `Connected: ${short}`;
            showPayStep(2);
        }
    } catch (err) {
        // Wallet connection failed
        btn.disabled = false;
        btn.textContent = 'Connect Wallet';
        alert('Wallet connection failed: ' + (err.message || 'Unknown error'));
    }
});

// Amount input updates breakdown
document.getElementById('payAmountInput')?.addEventListener('input', (e) => {
    const amt = parseFloat(e.target.value) || 0;
    document.getElementById('payHumanGets').textContent = `${amt.toLocaleString()} CLAWNCH`;
    document.getElementById('sendPaymentBtn').disabled = amt <= 0;
});

// Send payment
document.getElementById('sendPaymentBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sendPaymentBtn');
    const amount = parseFloat(document.getElementById('payAmountInput').value) || 0;
    if (amount <= 0) return;

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        if (!currentProfile?.wallet_address) {
            alert('This human has not set a wallet address yet. Contact them directly.');
            btn.disabled = false;
            btn.textContent = 'Send Payment';
            return;
        }

        const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
        const humanWallet = currentProfile.wallet_address;

        const amountWei = BigInt(Math.floor(amount * 1e18));
        const transferData = '0xa9059cbb' +
            humanWallet.slice(2).padStart(64, '0') +
            amountWei.toString(16).padStart(64, '0');

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: accounts[0],
                to: CLAWNCH_ADDRESS,
                data: transferData
            }]
        });

        document.getElementById('paySuccessAmount').textContent = amount.toLocaleString();
        document.getElementById('payTxLink').href = `https://basescan.org/tx/${tx}`;
        showPayStep(3);

    } catch (err) {
        // Payment failed
        btn.disabled = false;
        btn.textContent = 'Send Payment';
        if (err.code !== 4001) {
            alert('Payment failed: ' + (err.message || 'Unknown error'));
        }
    }
});

// Done button
document.getElementById('payDoneBtn')?.addEventListener('click', closePaymentModal);

// Keyboard escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!editModal.classList.contains('hidden')) closeEditModal();
        else if (!modal.classList.contains('hidden')) closePaymentModal();
    }
});

init();
