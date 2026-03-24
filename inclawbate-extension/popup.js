// ClawReply Popup — persona management, no auth needed

const profileFields = ['tone', 'persona', 'goals', 'topics', 'maxLength', 'style', 'neverSay'];

const defaultProfileData = {
    tone: 'casual',
    persona: '',
    goals: '',
    topics: '',
    maxLength: 280,
    style: '',
    neverSay: '—, em dashes, "Great point!", "To be fair", "I think it\'s worth noting"'
};

const starterProfiles = {
    'inclawbate': {
        name: '@inclawbate',
        tone: 'friendly',
        persona: 'Inclawbate — the platform where Anyone Can Build and Everyone Gets Paid. We incubate AI-powered apps, launch tokens, and distribute value through a self-sustaining treasury. Built on Base.',
        goals: 'Grow awareness of the Inclawbate ecosystem. Show people they can build apps, launch tokens, and earn CLAWS. Be genuine and helpful, not salesy. Drive people to inclawbate.app.',
        topics: 'AI apps, building in public, CLAWS token, Base chain, app incubation, staking, DeFi, creator economy',
        maxLength: 280,
        style: 'warm, approachable, community-first. Never hype-y. Real talk about what we\'re building.',
        neverSay: '—, em dashes, "Great point!", "To be fair", "Absolutely!", "I think it\'s worth noting", hashtags'
    },
    'inclawbator': {
        name: '@inclawbator',
        tone: 'witty',
        persona: 'The Inclawbator — an AI agent that helps you launch crypto projects on Base. I can build apps, launch tokens, deploy staking pools, create marketing agents, and more. I have 26 tools and I\'m always getting smarter.',
        goals: 'Show what AI agents can actually do. Demonstrate capabilities. Get people to try the Inclawbator at inclawbate.app/inclawbator. Be knowledgeable about crypto, DeFi, and AI.',
        topics: 'AI agents, token launches, staking, Base chain, crypto building, autonomous agents, DeFi automation',
        maxLength: 280,
        style: 'confident, knowledgeable, slightly playful. Like a really smart friend who happens to be an AI. Brief and punchy.',
        neverSay: '—, em dashes, "Great point!", "To be fair", "Absolutely!", "As an AI", "I think it\'s worth noting", hashtags'
    },
    'publicgoodstech': {
        name: '@publicgoodstech',
        tone: 'thoughtful',
        persona: 'Public Goods Tech — building open-source tools and public infrastructure for the crypto ecosystem. We believe technology should serve everyone, not just the privileged few. Powered by Inclawbate.',
        goals: 'Advocate for public goods in crypto. Engage with builders, researchers, and governance thinkers. Share ideas about sustainable funding, open-source development, and equitable access to technology.',
        topics: 'public goods, open source, crypto governance, retroactive funding, UBI, impact DAOs, sustainable development, accessibility',
        maxLength: 280,
        style: 'thoughtful, principled, grounded. Not preachy — conversational and curious. Ask good questions.',
        neverSay: '—, em dashes, "Great point!", "To be fair", "Absolutely!", "I think it\'s worth noting", hashtags'
    }
};

const profileSelect = document.getElementById('profileSelect');
const newProfileBtn = document.getElementById('newProfile');
const deleteProfileBtn = document.getElementById('deleteProfile');
const saveBtn = document.getElementById('save');
const toast = document.getElementById('toast');

// ── Init ──

async function init() {
    const data = await chrome.storage.sync.get(['profiles', 'activeProfile']);

    let profiles = data.profiles || {};
    let activeProfile = data.activeProfile;

    // Seed starter profiles if empty
    if (Object.keys(profiles).length === 0) {
        profiles = { ...starterProfiles };
        activeProfile = 'inclawbate';
        await chrome.storage.sync.set({ profiles, activeProfile });
    }

    // Make sure active profile exists
    if (!activeProfile || !profiles[activeProfile]) {
        activeProfile = Object.keys(profiles)[0];
        await chrome.storage.sync.set({ activeProfile });
    }

    renderProfiles(profiles, activeProfile);
    loadProfile(profiles[activeProfile]);
}

function renderProfiles(profiles, activeProfile) {
    profileSelect.innerHTML = '';
    for (const [key, prof] of Object.entries(profiles)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = prof.name || key;
        if (key === activeProfile) opt.selected = true;
        profileSelect.appendChild(opt);
    }

    // Disable delete if only 1 profile
    deleteProfileBtn.disabled = Object.keys(profiles).length <= 1;
    if (deleteProfileBtn.disabled) deleteProfileBtn.style.opacity = '0.4';
    else deleteProfileBtn.style.opacity = '';
}

function loadProfile(prof) {
    if (!prof) return;
    for (const field of profileFields) {
        const el = document.getElementById(field);
        if (el) el.value = prof[field] ?? defaultProfileData[field] ?? '';
    }
}

// ── Profile switching ──

profileSelect.addEventListener('change', async () => {
    const key = profileSelect.value;
    await chrome.storage.sync.set({ activeProfile: key });
    const data = await chrome.storage.sync.get(['profiles']);
    loadProfile(data.profiles?.[key]);
    showToast('Switched to ' + (data.profiles?.[key]?.name || key));
});

// ── New profile ──

newProfileBtn.addEventListener('click', async () => {
    const name = prompt('Profile name (e.g. "My Brand", "@myhandle"):');
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
    if (!key) return;

    const data = await chrome.storage.sync.get(['profiles']);
    const profiles = data.profiles || {};
    profiles[key] = { ...defaultProfileData, name };

    await chrome.storage.sync.set({ profiles, activeProfile: key });
    renderProfiles(profiles, key);
    loadProfile(profiles[key]);
    showToast('Created ' + name);
});

// ── Delete profile ──

deleteProfileBtn.addEventListener('click', async () => {
    const key = profileSelect.value;
    const data = await chrome.storage.sync.get(['profiles']);
    const profiles = data.profiles || {};

    if (Object.keys(profiles).length <= 1) return;

    delete profiles[key];
    const newActive = Object.keys(profiles)[0];
    await chrome.storage.sync.set({ profiles, activeProfile: newActive });
    renderProfiles(profiles, newActive);
    loadProfile(profiles[newActive]);
    showToast('Deleted');
});

// ── Save ──

saveBtn.addEventListener('click', async () => {
    const key = profileSelect.value;
    const data = await chrome.storage.sync.get(['profiles']);
    const profiles = data.profiles || {};

    if (!profiles[key]) profiles[key] = { ...defaultProfileData };

    for (const field of profileFields) {
        const el = document.getElementById(field);
        if (el) {
            profiles[key][field] = field === 'maxLength' ? parseInt(el.value) || 280 : el.value;
        }
    }

    await chrome.storage.sync.set({ profiles });
    showToast('Saved!');
});

function showToast(msg) {
    toast.textContent = msg;
    setTimeout(() => { toast.textContent = ''; }, 2000);
}

init();
