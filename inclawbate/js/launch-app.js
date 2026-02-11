// Inclawbate — Launch Page Controller (Capacity Allocation Model)
import { startXAuth, handleXCallback, getStoredAuth, logout } from './x-auth-client.js';
import { humansApi } from './humans-api.js';

const STEPS = ['profile', 'preferences', 'preview'];
let currentStep = 0;
let profile = null;
let skills = [];

// DOM refs
const connectGate = document.getElementById('connectGate');
const builderSection = document.getElementById('builderSection');
const connectBtn = document.getElementById('xConnectBtn');
const stepperSteps = document.querySelectorAll('.stepper-step');
const stepperLabels = document.querySelectorAll('.stepper-label');
const formPanels = document.querySelectorAll('.form-panel');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// ── Init ──
async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code) {
        connectGate.querySelector('h2').textContent = 'Connecting...';
        connectGate.querySelector('p').textContent = 'Exchanging tokens with X...';
        connectBtn.classList.add('hidden');

        try {
            const result = await handleXCallback(code, state);
            profile = result.profile;
            window.history.replaceState({}, '', '/launch');
            showBuilder();
        } catch (err) {
            connectGate.querySelector('h2').textContent = 'Connection Failed';
            connectGate.querySelector('p').textContent = err.message;
            connectBtn.classList.remove('hidden');
            connectBtn.textContent = 'Try Again';
        }
        return;
    }

    const stored = getStoredAuth();
    if (stored) {
        profile = stored.profile;
        skills = profile.skills || [];
        showBuilder();
        return;
    }
}

function showBuilder() {
    connectGate.classList.add('hidden');
    builderSection.classList.remove('hidden');

    // Pre-fill from profile
    if (profile.bio) document.getElementById('bioInput').value = profile.bio;
    if (profile.tagline) document.getElementById('taglineInput').value = profile.tagline;
    if (profile.wallet_address) document.getElementById('walletInput').value = profile.wallet_address;
    if (profile.available_capacity !== undefined) {
        document.getElementById('capacityInput').value = profile.available_capacity;
        document.getElementById('capacityValue').textContent = profile.available_capacity + '%';
    }
    if (profile.availability) document.getElementById('availabilitySelect').value = profile.availability;

    // Set Telegram deep link
    const tgLink = document.getElementById('telegramLink');
    if (tgLink && profile.x_handle) {
        tgLink.href = `https://t.me/inclawbate_bot?start=${profile.x_handle}`;
    }

    // Render existing skills
    skills.forEach(s => addSkillTag(s));

    // Show logout button
    document.getElementById('logoutBtn')?.classList.remove('hidden');

    updateStepper();
    showStep(0);
}

// ── Stepper ──
function updateStepper() {
    stepperSteps.forEach((el, i) => {
        el.classList.remove('active', 'done');
        if (i < currentStep) el.classList.add('done');
        if (i === currentStep) el.classList.add('active');
    });
    stepperLabels.forEach((el, i) => {
        el.classList.remove('active', 'done');
        if (i < currentStep) el.classList.add('done');
        if (i === currentStep) el.classList.add('active');
    });
}

function showStep(idx) {
    currentStep = idx;
    formPanels.forEach((p, i) => {
        p.classList.toggle('hidden', i !== idx);
    });
    prevBtn.classList.toggle('hidden', idx === 0);
    nextBtn.textContent = idx === STEPS.length - 1 ? 'PUBLISH PROFILE' : 'NEXT';
    updateStepper();

    if (idx === STEPS.length - 1) renderPreview();
}

// ── Skills ──
function addSkillTag(skill) {
    if (!skill || skills.includes(skill)) return;
    skills.push(skill);
    renderSkillTags();
}

function removeSkill(skill) {
    skills = skills.filter(s => s !== skill);
    renderSkillTags();
}

function renderSkillTags() {
    const container = document.getElementById('skillTags');
    container.innerHTML = skills.map(s =>
        `<span class="skill-tag">${esc(s)}<button type="button" class="skill-tag-remove" data-skill="${esc(s)}">&times;</button></span>`
    ).join('');

    container.querySelectorAll('.skill-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => removeSkill(btn.dataset.skill));
    });
}

// ── Preview ──
function renderPreview() {
    document.getElementById('previewAvatar').src = profile.x_avatar_url || '';
    document.getElementById('previewName').textContent = profile.x_name || profile.x_handle;
    document.getElementById('previewHandle').textContent = `@${profile.x_handle}`;
    document.getElementById('previewTagline').textContent = document.getElementById('taglineInput').value || 'No tagline set';

    const skillsHtml = skills.map(s => `<span class="badge badge-primary">${esc(s)}</span>`).join('');
    document.getElementById('previewSkills').innerHTML = skillsHtml || '<span class="text-dim">No skills added</span>';

    const capacity = document.getElementById('capacityInput').value || '100';
    const wallet = document.getElementById('walletInput').value;
    const avail = document.getElementById('availabilitySelect').value;

    let detailsHtml = `
        <div class="profile-details" style="margin-top:var(--space-lg);">
            <div class="profile-detail">
                <div class="profile-detail-label">Available Capacity</div>
                <div class="profile-detail-value">${esc(capacity)}%</div>
            </div>
            <div class="profile-detail">
                <div class="profile-detail-label">Availability</div>
                <div class="profile-detail-value">${esc(avail)}</div>
            </div>
    `;
    if (wallet) {
        const short = wallet.length > 12 ? wallet.slice(0, 6) + '...' + wallet.slice(-4) : wallet;
        detailsHtml += `
            <div class="profile-detail">
                <div class="profile-detail-label">Wallet</div>
                <div class="profile-detail-value" style="font-family:var(--font-mono);font-size:0.8rem">${esc(short)}</div>
            </div>
        `;
    }
    detailsHtml += '</div>';
    document.getElementById('previewDetails').innerHTML = detailsHtml;
}

// ── Publish ──
async function publishProfile() {
    nextBtn.disabled = true;
    nextBtn.textContent = 'PUBLISHING...';

    try {
        const updates = {
            tagline: document.getElementById('taglineInput').value.trim(),
            bio: document.getElementById('bioInput').value.trim(),
            skills,
            available_capacity: parseInt(document.getElementById('capacityInput').value) || 100,
            wallet_address: document.getElementById('walletInput').value.trim() || null,
            availability: document.getElementById('availabilitySelect').value
        };

        const result = await humansApi.updateProfile(updates);
        profile = result.profile;
        localStorage.setItem('inclawbate_profile', JSON.stringify(profile));

        // Redirect to their profile page
        window.location.href = `/u/${profile.x_handle}`;
    } catch (err) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'PUBLISH PROFILE';
        alert('Failed to publish: ' + err.message);
    }
}

// ── Escape helper ──
function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ── Events ──
connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Redirecting to X...';
    try {
        await startXAuth();
    } catch (err) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Try Again`;
        alert('Failed: ' + err.message);
    }
});

document.getElementById('capacityInput')?.addEventListener('input', (e) => {
    document.getElementById('capacityValue').textContent = e.target.value + '%';
});

document.getElementById('skillInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(/,/g, '');
        if (val) {
            addSkillTag(val.toLowerCase());
            e.target.value = '';
        }
    }
});

prevBtn?.addEventListener('click', () => {
    if (currentStep > 0) showStep(currentStep - 1);
});

nextBtn?.addEventListener('click', () => {
    if (currentStep === STEPS.length - 1) {
        publishProfile();
    } else {
        showStep(currentStep + 1);
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logout();
    window.location.reload();
});

// Boot
init();
