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

let currentAllocation = [];
let currentTotalAllocated = 0;

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
        currentAllocation = res.allocation || [];
        currentTotalAllocated = res.total_allocated || 0;
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

    // Capacity badge (market-driven: allocated if any agents are paying)
    const capacityBadge = document.getElementById('profileCapacityBadge');
    const isAllocated = currentAllocation.length > 0;
    capacityBadge.textContent = isAllocated ? 'Fully allocated' : 'Available';
    capacityBadge.className = `badge ${isAllocated ? 'badge-yellow' : 'badge-green'}`;

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

    // Allocation (market-driven capacity — pie chart)
    const allocationSection = document.getElementById('allocationSection');
    if (currentAllocation.length > 0 && allocationSection) {
        allocationSection.style.display = '';
        const colors = [
            'hsl(9, 52%, 56%)',    // lobster
            'hsl(172, 32%, 48%)',  // seafoam
            'hsl(32, 32%, 66%)',   // sand
            'hsl(210, 28%, 54%)', // blue
            'hsl(280, 30%, 55%)', // purple
            'hsl(45, 50%, 55%)',  // gold
            'hsl(0, 60%, 50%)',   // red
            'hsl(140, 30%, 50%)' // green
        ];

        // Build conic-gradient stops
        let cumulative = 0;
        const stops = currentAllocation.map((a, i) => {
            const color = colors[i % colors.length];
            const start = cumulative;
            cumulative += a.share;
            return `${color} ${start}% ${cumulative}%`;
        });
        // Fill remainder if < 100%
        if (cumulative < 100) {
            stops.push(`hsl(240, 4%, 16%) ${cumulative}% 100%`);
        }
        const gradient = `conic-gradient(${stops.join(', ')})`;

        // Legend rows
        const legendHtml = currentAllocation.map((a, i) => {
            const name = esc(a.agent_name || 'Unknown Agent');
            const addr = a.agent_address ? a.agent_address.slice(0, 6) + '...' + a.agent_address.slice(-4) : '';
            const color = colors[i % colors.length];
            const paid = parseFloat(a.total_paid || 0);
            return `<div class="alloc-legend-row">
                <span class="alloc-dot" style="background:${color}"></span>
                <div class="alloc-legend-info">
                    <span class="alloc-legend-name">${name}</span>
                    <span class="alloc-legend-addr">${addr}</span>
                </div>
                <div class="alloc-legend-values">
                    <span class="alloc-legend-clawnch">${paid.toLocaleString()} CLAWNCH</span>
                    <span class="alloc-legend-share">${a.share}%</span>
                </div>
            </div>`;
        }).join('');

        document.getElementById('profileAllocation').innerHTML = `
            <div class="alloc-chart-wrap">
                <div class="alloc-pie" style="background:${gradient}">
                    <div class="alloc-pie-center">
                        <span class="alloc-pie-total">${currentTotalAllocated.toLocaleString()}</span>
                        <span class="alloc-pie-label">CLAWNCH</span>
                    </div>
                </div>
                <div class="alloc-legend">${legendHtml}</div>
            </div>`;
    }

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

    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Capacity</div><div class="profile-detail-value">${isAllocated ? `${currentAllocation.length} agent${currentAllocation.length !== 1 ? 's' : ''}` : 'Available'}</div></div>`);
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
    const timelineContainer = document.getElementById('xTimelineContainer');
    if (feedSection && timelineContainer && p.x_handle) {
        feedSection.style.display = '';
        const renderTimeline = () => {
            window.twttr.widgets.createTimeline(
                { sourceType: 'profile', screenName: p.x_handle },
                timelineContainer,
                { theme: 'dark', chrome: 'noheader nofooter noborders', tweetLimit: 5 }
            );
        };
        if (window.twttr && window.twttr.widgets) {
            renderTimeline();
        } else if (window.twttr && window.twttr.ready) {
            window.twttr.ready(renderTimeline);
        }
    }

    // Action links
    document.getElementById('skillDocLink').href = `/u/${p.x_handle}/skill`;

    // Own profile: hide Hire Me, show edit
    const editBtn = document.getElementById('editProfileBtn');
    const hireBtn = document.getElementById('hireCta');
    if (isOwnProfile) {
        if (editBtn) editBtn.classList.remove('hidden');
        if (hireBtn) hireBtn.style.display = 'none';
    }

    // Hero mini allocation (visible to everyone)
    const heroAlloc = document.getElementById('heroAllocation');
    if (heroAlloc && currentAllocation.length > 0) {
        const colors = [
            'hsl(9, 52%, 56%)', 'hsl(172, 32%, 48%)', 'hsl(32, 32%, 66%)',
            'hsl(210, 28%, 54%)', 'hsl(280, 30%, 55%)', 'hsl(45, 50%, 55%)'
        ];
        let cum = 0;
        const stops = currentAllocation.map((a, i) => {
            const c = colors[i % colors.length];
            const s = cum; cum += a.share;
            return `${c} ${s}% ${cum}%`;
        });
        if (cum < 100) stops.push(`hsl(240, 4%, 16%) ${cum}% 100%`);

        const payers = currentAllocation.length;
        heroAlloc.innerHTML = `
            <div class="hero-alloc-pie" style="background:conic-gradient(${stops.join(', ')})"></div>
            <div class="hero-alloc-info">
                <span class="hero-alloc-total">${currentTotalAllocated.toLocaleString()} CLAWNCH</span>
                <span class="hero-alloc-sub">${payers} payer${payers !== 1 ? 's' : ''} &middot; ${isOwnProfile ? 'Share your profile to get more' : 'Get allocation &darr;'}</span>
            </div>`;
        heroAlloc.classList.remove('hidden');
        if (!isOwnProfile) {
            heroAlloc.style.cursor = 'pointer';
            heroAlloc.addEventListener('click', () => {
                document.getElementById('allocationSection')?.scrollIntoView({ behavior: 'smooth' });
            });
        }
    } else if (heroAlloc && isOwnProfile) {
        heroAlloc.innerHTML = `
            <div class="hero-alloc-pie hero-alloc-empty"></div>
            <div class="hero-alloc-info">
                <span class="hero-alloc-total">0 CLAWNCH</span>
                <span class="hero-alloc-sub">Share your profile to get allocation</span>
            </div>`;
        heroAlloc.classList.remove('hidden');
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
            wallet_address: document.getElementById('editWallet').value.trim() || null,
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
    btn.textContent = 'Switching to Base...';

    try {
        if (!currentProfile?.wallet_address) {
            alert('This human has not set a wallet address yet. Contact them directly.');
            btn.disabled = false;
            btn.textContent = 'Send Payment';
            return;
        }

        // Ensure wallet is on Base network
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }]
            });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x2105',
                        chainName: 'Base',
                        rpcUrls: ['https://mainnet.base.org'],
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://basescan.org']
                    }]
                });
            } else {
                throw switchErr;
            }
        }

        const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
        const humanWallet = currentProfile.wallet_address;

        const amountWei = BigInt(Math.floor(amount * 1e18));
        const transferData = '0xa9059cbb' +
            humanWallet.slice(2).padStart(64, '0') +
            amountWei.toString(16).padStart(64, '0');

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });

        btn.textContent = 'Confirm in wallet...';
        const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: accounts[0],
                to: CLAWNCH_ADDRESS,
                data: transferData
            }]
        });

        // Payment succeeded — now create conversation via API
        btn.textContent = 'Creating conversation...';
        const initialMessage = document.getElementById('payMessageInput')?.value?.trim() || '';

        try {
            await fetch('/api/inclawbate/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    human_handle: currentProfile.x_handle,
                    agent_address: accounts[0],
                    payment_amount: amount,
                    payment_tx: tx,
                    message: initialMessage || `Hired via inclawbate.com \u2014 ${amount} CLAWNCH sent.`
                })
            });
        } catch (convErr) {
            // Conversation creation failed but payment went through
            console.error('Failed to create conversation:', convErr);
        }

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
