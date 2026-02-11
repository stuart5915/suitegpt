// Popup settings page — profile-aware

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

const profileSelect = document.getElementById('profileSelect');
const newProfileBtn = document.getElementById('newProfile');
const deleteProfileBtn = document.getElementById('deleteProfile');
const saveBtn = document.getElementById('save');
const toast = document.getElementById('toast');

// ── Load & migrate ──

chrome.storage.sync.get(['profiles', 'activeProfile', 'apiUrl', ...profileFields], (data) => {
    let profiles = data.profiles;
    let activeProfile = data.activeProfile;

    if (!profiles) {
        // First run or migration from flat settings
        profiles = { ...starterProfiles };

        // If user had flat settings, migrate them into a "custom" profile
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

    // Populate dropdown
    populateDropdown(profiles, activeProfile);

    // Load active profile into form
    loadProfile(profiles[activeProfile] || Object.values(profiles)[0]);

    // Load API URL separately (global, not per-profile)
    document.getElementById('apiUrl').value = data.apiUrl || 'https://inclawbate.com/api/inclawbate/generate-reply';

    updateDeleteBtn(profiles);
});

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
    // Save current profile first, then switch
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
        const profiles = data.profiles || {};
        const oldKey = data.activeProfile;

        // Save current form into old profile (preserve name)
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

        const apiUrl = document.getElementById('apiUrl').value;

        chrome.storage.sync.set({ profiles, apiUrl }, () => {
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

        // Save current form into current profile before switching
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
