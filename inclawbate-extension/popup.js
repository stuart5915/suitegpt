// Popup — two-state: connect screen vs settings

const profileFields = ['tone', 'persona', 'goals', 'topics', 'maxLength', 'style'];

const defaultProfileData = {
    tone: 'casual',
    persona: '',
    goals: '',
    topics: '',
    maxLength: 280,
    style: ''
};

const starterProfiles = {
    'inclawbate-admin': {
        name: 'inclawbate admin',
        tone: 'professional',
        persona: 'I run inclawbate, the platform where AI agents hire humans for micro-tasks. Building the future of human-AI collaboration.',
        goals: 'Grow the platform, attract builders and workers, establish inclawbate as the go-to human-in-the-loop marketplace.',
        topics: 'AI agents, human-AI collaboration, gig economy, crypto, Base chain',
        maxLength: 280,
        style: ''
    },
    'inclawbate-x': {
        name: '@inclawbate',
        tone: 'friendly',
        persona: 'The official inclawbate account. We connect AI agents with humans for real work. Humans get paid, agents get things done.',
        goals: 'Promote the platform, highlight humans doing great work, share updates and wins from the community.',
        topics: 'AI agents, human tasks, crypto payments, community wins',
        maxLength: 280,
        style: 'brand voice, upbeat, supportive'
    },
    'artstu': {
        name: '@artstu',
        tone: 'casual',
        persona: 'Designer and creative builder working at the intersection of AI, crypto, and culture. Based in the real world.',
        goals: 'Build audience, share perspectives on AI/crypto/design, connect with interesting people.',
        topics: 'AI, design, crypto, startups, culture',
        maxLength: 280,
        style: 'lowercase ok, conversational'
    }
};

const connectScreen = document.getElementById('connectScreen');
const connectedUI = document.getElementById('connectedUI');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const userHandle = document.getElementById('userHandle');
const creditsCount = document.getElementById('creditsCount');
const profileSelect = document.getElementById('profileSelect');
const newProfileBtn = document.getElementById('newProfile');
const deleteProfileBtn = document.getElementById('deleteProfile');
const saveBtn = document.getElementById('save');
const toast = document.getElementById('toast');

// ── Init: check for API key ──

chrome.storage.sync.get(['apiKey', 'xHandle', 'profiles', 'activeProfile', ...profileFields], (data) => {
    if (data.apiKey) {
        showConnected(data);
    } else {
        showConnectScreen();
    }
});

// ── Listen for storage changes (auto-update if auth-relay sets key while popup is open) ──

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.apiKey && changes.apiKey.newValue) {
        chrome.storage.sync.get(['apiKey', 'xHandle', 'profiles', 'activeProfile', ...profileFields], (data) => {
            showConnected(data);
        });
    }
});

// ── Connect screen ──

function showConnectScreen() {
    connectScreen.classList.remove('hidden');
    connectedUI.classList.add('hidden');
}

connectBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://inclawbate.com/connect' });
});

// ── Connected state ──

function showConnected(data) {
    connectScreen.classList.add('hidden');
    connectedUI.classList.remove('hidden');

    // Show wallet or handle
    if (data.walletAddress) {
        userHandle.textContent = data.walletAddress.slice(0, 6) + '...' + data.walletAddress.slice(-4);
    } else if (data.xHandle) {
        userHandle.textContent = '@' + data.xHandle;
    } else {
        userHandle.textContent = 'Connected';
    }

    // Fetch credits
    fetchCredits(data.apiKey);

    // Load profiles
    let profiles = data.profiles;
    let activeProfile = data.activeProfile;

    if (!profiles) {
        profiles = { ...starterProfiles };

        const hadFlatSettings = profileFields.some(f => data[f] && data[f] !== defaultProfileData[f]);
        if (hadFlatSettings) {
            const migrated = {};
            profileFields.forEach(f => { migrated[f] = data[f] ?? defaultProfileData[f]; });
            migrated.name = 'My Settings';
            profiles['custom'] = migrated;
            activeProfile = 'custom';
        } else {
            activeProfile = 'inclawbate-admin';
        }

        chrome.storage.sync.set({ profiles, activeProfile });
    }

    populateDropdown(profiles, activeProfile);
    loadProfile(profiles[activeProfile] || Object.values(profiles)[0]);
    updateDeleteBtn(profiles);
}

// ── Disconnect ──

disconnectBtn.addEventListener('click', () => {
    if (!confirm('Disconnect your X account?')) return;
    chrome.storage.sync.remove(['apiKey', 'xHandle'], () => {
        showConnectScreen();
    });
});

// ── Profile helpers ──

function populateDropdown(profiles, activeKey) {
    profileSelect.innerHTML = '';
    for (const [key, prof] of Object.entries(profiles)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = prof.name || key;
        if (key === activeKey) opt.selected = true;
        profileSelect.appendChild(opt);
    }
}

function loadProfile(profile) {
    if (!profile) return;
    profileFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = profile[field] ?? defaultProfileData[field];
    });
}

function readFormProfile() {
    const profile = {};
    profileFields.forEach(field => {
        const el = document.getElementById(field);
        profile[field] = field === 'maxLength' ? (parseInt(el.value) || 280) : el.value;
    });
    return profile;
}

function updateDeleteBtn(profiles) {
    deleteProfileBtn.disabled = Object.keys(profiles).length <= 1;
    deleteProfileBtn.style.opacity = Object.keys(profiles).length <= 1 ? '0.4' : '1';
}

function showToast(msg) {
    toast.textContent = msg;
    setTimeout(() => { toast.textContent = ''; }, 2000);
}

// ── Profile switch ──

profileSelect.addEventListener('change', () => {
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
        const profiles = data.profiles || {};
        const oldKey = data.activeProfile;

        if (oldKey && profiles[oldKey]) {
            Object.assign(profiles[oldKey], readFormProfile());
        }

        const newKey = profileSelect.value;
        chrome.storage.sync.set({ profiles, activeProfile: newKey }, () => {
            loadProfile(profiles[newKey]);
        });
    });
});

// ── Save ──

saveBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
        const profiles = data.profiles || {};
        const key = data.activeProfile || profileSelect.value;

        if (profiles[key]) {
            Object.assign(profiles[key], readFormProfile());
        }

        chrome.storage.sync.set({ profiles }, () => {
            showToast('Settings saved!');
        });
    });
});

// ── New profile ──

newProfileBtn.addEventListener('click', () => {
    const name = prompt('Profile name:');
    if (!name || !name.trim()) return;

    const key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
        const profiles = data.profiles || {};

        if (profiles[key]) {
            showToast('Profile already exists');
            return;
        }

        const oldKey = data.activeProfile;
        if (oldKey && profiles[oldKey]) {
            Object.assign(profiles[oldKey], readFormProfile());
        }

        profiles[key] = { ...defaultProfileData, name: name.trim() };

        chrome.storage.sync.set({ profiles, activeProfile: key }, () => {
            populateDropdown(profiles, key);
            loadProfile(profiles[key]);
            updateDeleteBtn(profiles);
            showToast('Profile created!');
        });
    });
});

// ── Delete profile ──

deleteProfileBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
        const profiles = data.profiles || {};
        const key = data.activeProfile;

        if (Object.keys(profiles).length <= 1) return;

        if (!confirm(`Delete "${profiles[key]?.name || key}"?`)) return;

        delete profiles[key];
        const firstKey = Object.keys(profiles)[0];

        chrome.storage.sync.set({ profiles, activeProfile: firstKey }, () => {
            populateDropdown(profiles, firstKey);
            loadProfile(profiles[firstKey]);
            updateDeleteBtn(profiles);
            showToast('Profile deleted');
        });
    });
});

// ── Credits ──

function fetchCredits(key) {
    if (!key) return;
    fetch(`https://inclawbate.com/api/inclawbate/credits?key=${encodeURIComponent(key)}`)
        .then(r => r.json())
        .then(data => {
            if (data.credits !== undefined) {
                creditsCount.textContent = data.credits;
                creditsCount.className = data.credits > 0 ? 'credits-count has-credits' : 'credits-count no-credits';
            } else {
                creditsCount.textContent = 'Invalid key';
                creditsCount.className = 'credits-count no-credits';
            }
        })
        .catch(() => {
            creditsCount.textContent = '??';
            creditsCount.className = 'credits-count no-credits';
        });
}
