// Inclawbate — Profile Page Controller (Payment Model)
import { humansApi } from './humans-api.js';

const SECTIONS = {
    loading: document.getElementById('profileLoading'),
    notFound: document.getElementById('profileNotFound'),
    page: document.getElementById('profilePage')
};

let currentProfile = null;

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
        currentProfile = res.profile;
        renderProfile(currentProfile);
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

    // Capacity badge
    const capacityBadge = document.getElementById('profileCapacityBadge');
    const capacity = p.available_capacity !== undefined ? p.available_capacity : 100;
    capacityBadge.textContent = `${capacity}% capacity`;

    // Skills
    const skillsHtml = (p.skills || []).map(s => `<span class="badge badge-primary">${esc(s)}</span>`).join('');
    document.getElementById('profileSkills').innerHTML = skillsHtml || '<span class="text-dim">No skills listed</span>';

    // Bio
    document.getElementById('profileBio').textContent = p.bio || 'No bio provided.';

    // Details
    const detailsHtml = [];

    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Available Capacity</div><div class="profile-detail-value">${capacity}%</div></div>`);

    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Contact</div><div class="profile-detail-value"><a href="/dashboard" style="color:var(--lobster-300)">Via Inbox</a></div></div>`);
    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Payment</div><div class="profile-detail-value">$CLAWNCH</div></div>`);
    detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Platform Fee</div><div class="profile-detail-value" style="color:var(--seafoam-400)">None</div></div>`);

    if (p.wallet_address) {
        const short = p.wallet_address.slice(0, 6) + '...' + p.wallet_address.slice(-4);
        detailsHtml.push(`<div class="profile-detail"><div class="profile-detail-label">Wallet</div><div class="profile-detail-value" style="font-family:var(--font-mono);font-size:0.8rem">${short}</div></div>`);
    }

    document.getElementById('profileDetails').innerHTML = detailsHtml.join('') || '<p class="text-dim">No additional details.</p>';

    // Action links
    document.getElementById('skillDocLink').href = `/u/${p.x_handle}/skill`;

    // Set up payment modal
    document.getElementById('payHumanName').textContent = p.x_name || p.x_handle;
    document.getElementById('payRecipient').textContent = `@${p.x_handle}`;
    document.getElementById('paySuccessName').textContent = p.x_name || p.x_handle;

    showSection('page');
}

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

// Connect wallet (V1: placeholder for wagmi/viem integration)
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
        console.error('Wallet connect error:', err);
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

// Send payment (V1: direct ERC20 transfer)
document.getElementById('sendPaymentBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sendPaymentBtn');
    const amount = parseFloat(document.getElementById('payAmountInput').value) || 0;
    if (amount <= 0) return;

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        // Check human has a wallet
        if (!currentProfile?.wallet_address) {
            alert('This human has not set a wallet address yet. Contact them directly.');
            btn.disabled = false;
            btn.textContent = 'Send Payment';
            return;
        }

        // ERC20 transfer via eth_sendTransaction
        // CLAWNCH contract on Base — address TBD, using placeholder
        const CLAWNCH_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: set real CLAWNCH address
        const humanWallet = currentProfile.wallet_address;

        // ERC20 transfer(address, uint256) function selector
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

        // Success
        document.getElementById('paySuccessAmount').textContent = amount.toLocaleString();
        document.getElementById('payTxLink').href = `https://basescan.org/tx/${tx}`;
        showPayStep(3);

    } catch (err) {
        console.error('Payment error:', err);
        btn.disabled = false;
        btn.textContent = 'Send Payment';
        if (err.code !== 4001) { // 4001 = user rejected
            alert('Payment failed: ' + (err.message || 'Unknown error'));
        }
    }
});

// Done button
document.getElementById('payDoneBtn')?.addEventListener('click', closePaymentModal);

// Keyboard escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closePaymentModal();
});

init();
