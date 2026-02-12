// Background service worker — handles API calls, hotkey commands, and badge

const DEFAULT_API_URL = 'https://www.inclawbate.com/api/inclawbate/generate-reply';
const CREDITS_URL = 'https://inclawbate.com/api/inclawbate/credits';

// ── Badge: poll for unread messages ──
async function updateBadge() {
    try {
        const data = await chrome.storage.sync.get(['apiKey', 'token']);
        if (!data.apiKey && !data.token) {
            chrome.action.setBadgeText({ text: '' });
            return;
        }
        let resp;
        if (data.apiKey) {
            resp = await fetch(`${CREDITS_URL}?key=${encodeURIComponent(data.apiKey)}`);
        } else {
            resp = await fetch(CREDITS_URL, { headers: { 'Authorization': `Bearer ${data.token}` } });
        }
        if (!resp.ok) return;
        const result = await resp.json();
        const unread = result.unread || 0;
        chrome.action.setBadgeText({ text: unread > 0 ? String(unread) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#e85d4a' });
    } catch (e) {
        // Silent — don't break extension on network errors
    }
}

// Check on install/startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('check-unread', { periodInMinutes: 1 });
    updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('check-unread', { periodInMinutes: 1 });
    updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'check-unread') updateBadge();
});

// Handle hotkey command
chrome.commands.onCommand.addListener((command) => {
    if (command === 'generate-reply') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'generate-reply-hotkey' });
            }
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'set-api-key') {
        // Relay from auth-relay.js on inclawbate.com after wallet connect or OAuth
        const toStore = {};
        if (message.apiKey) toStore.apiKey = message.apiKey;
        if (message.token) toStore.token = message.token;
        if (message.xHandle) toStore.xHandle = message.xHandle;
        if (message.walletAddress) toStore.walletAddress = message.walletAddress;
        chrome.storage.sync.set(toStore, () => {
            updateBadge();
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === 'generate-reply') {
        generateReply(message.data).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // Keep channel open for async response
    }
});

async function generateReply({ tweetText, tweetAuthor, threadContext }) {
    const data = await chrome.storage.sync.get(['profiles', 'activeProfile', 'apiUrl', 'apiKey', 'token', 'tone', 'persona', 'goals', 'topics', 'maxLength', 'style']);

    let params;
    if (data.profiles && data.activeProfile && data.profiles[data.activeProfile]) {
        // Profile-aware path
        const prof = data.profiles[data.activeProfile];
        params = {
            tone: prof.tone || 'casual',
            persona: prof.persona || '',
            goals: prof.goals || '',
            topics: prof.topics || '',
            maxLength: prof.maxLength || 280,
            style: prof.style || '',
            neverSay: prof.neverSay || ''
        };
    } else {
        // Backwards-compat: flat keys (pre-migration)
        params = {
            tone: data.tone || 'casual',
            persona: data.persona || '',
            goals: data.goals || '',
            topics: data.topics || '',
            maxLength: data.maxLength || 280,
            style: data.style || '',
            neverSay: data.neverSay || ''
        };
    }

    const apiUrl = data.apiUrl || DEFAULT_API_URL;

    const headers = { 'Content-Type': 'application/json' };
    if (data.apiKey) {
        headers['X-API-Key'] = data.apiKey;
    } else if (data.token) {
        headers['Authorization'] = `Bearer ${data.token}`;
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            tweetText,
            tweetAuthor,
            threadContext,
            parameters: params
        })
    });

    const result = await response.json();

    if (!response.ok) {
        if (response.status === 402) {
            throw new Error('NO_CREDITS');
        }
        throw new Error(result.error || 'Failed to generate reply');
    }

    return result;
}
