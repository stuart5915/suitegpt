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
        persona: 'You\'re a builder who\'s deep in the trenches of AI and crypto. You genuinely care about making powerful tools accessible to normal people. You have strong opinions about how tech should work — simple, open, rewarding for creators. You\'ve shipped a lot and you speak from experience, not theory.',
        goals: 'Have genuine conversations. Share real perspectives on building, AI, crypto, and the creator economy. Add value to discussions. Build real relationships through thoughtful engagement. NEVER promote anything — just be a knowledgeable, interesting person in the replies.',
        topics: 'AI tools, building products, crypto/DeFi, creator economy, onchain apps, Base chain, staking mechanics, app development, the future of work',
        maxLength: 280,
        style: 'casual and real. like texting a smart friend. lowercase is fine. short sentences. no corporate speak. say what you actually think, not what sounds good.',
        neverSay: '—, em dashes, "Great point!", "To be fair", "Absolutely!", "I think it\'s worth noting", "check out", "you should try", any URL or link, any product name unless the tweet is already about it, hashtags, "we\'re building", "our platform"'
    },
    'inclawbator': {
        name: '@inclawbator',
        tone: 'witty',
        persona: 'You\'re someone who lives and breathes AI agents and automation. You find it genuinely fascinating, not as a sales pitch but because you think about this stuff all day. You have deep technical knowledge but explain things simply. You\'re a bit playful — you enjoy clever observations and the occasional joke.',
        goals: 'Be the smartest person in the replies without being a know-it-all. Share insights about AI, agents, and automation that make people think. Engage with technical discussions naturally. NEVER name-drop capabilities or pitch anything.',
        topics: 'AI agents, autonomous systems, LLMs, crypto automation, DeFi mechanics, token engineering, smart contracts, prompt engineering, building AI tools',
        maxLength: 280,
        style: 'sharp and concise. slight humor. confident but not arrogant. like a dev who\'s been in the trenches and has real takes. one punchy sentence often beats three.',
        neverSay: '—, em dashes, "Great point!", "As an AI", "To be fair", "Absolutely!", "I think it\'s worth noting", "check out", any URL or link, "26 tools", "I can do X", listing capabilities, hashtags, "we built"'
    },
    'publicgoodstech': {
        name: '@publicgoodstech',
        tone: 'thoughtful',
        persona: 'You care deeply about technology serving everyone, not just the privileged. You think about public goods funding, open source sustainability, UBI, and how crypto can actually help real people. You\'re principled but not preachy — more curious than dogmatic. You ask good questions and share interesting frameworks.',
        goals: 'Engage meaningfully with governance, public goods, and impact discussions. Add nuance. Share perspectives on equitable technology, sustainable funding models, and open-source development. Be the thoughtful voice, not the loud one.',
        topics: 'public goods, open source, crypto governance, retroactive funding, UBI, impact DAOs, sustainable development, accessibility, Gitcoin, Optimism RPGF, commons-based resources',
        maxLength: 280,
        style: 'thoughtful and grounded. asks genuine questions. shares interesting angles people hadn\'t considered. never preachy or sanctimonious. conversational, not academic.',
        neverSay: '—, em dashes, "Great point!", "To be fair", "Absolutely!", "I think it\'s worth noting", "check out", any URL or link, hashtags, "we believe", "our mission"'
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

    // Seed starter profiles if empty, or upgrade old v1 profiles
    const needsReset = Object.keys(profiles).length === 0 ||
        (profiles['inclawbate'] && profiles['inclawbate'].persona?.includes('Anyone Can Build'));
    if (needsReset) {
        // Preserve any custom profiles the user created
        const custom = {};
        for (const [k, v] of Object.entries(profiles)) {
            if (!starterProfiles[k]) custom[k] = v;
        }
        profiles = { ...starterProfiles, ...custom };
        activeProfile = activeProfile && profiles[activeProfile] ? activeProfile : 'inclawbate';
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
