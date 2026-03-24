// ClawReply — background service worker
// No auth needed, no credits — just generates replies via Groq (free)

const DEFAULT_API_URL = 'https://www.inclawbate.app/api/inclawbate/generate-reply';

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
    if (message.action === 'generate-reply') {
        generateReply(message.data).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // Keep channel open for async response
    }
});

async function generateReply({ tweetText, tweetAuthor, threadContext }) {
    const data = await chrome.storage.sync.get(['profiles', 'activeProfile']);

    let params;
    if (data.profiles && data.activeProfile && data.profiles[data.activeProfile]) {
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
        params = { tone: 'casual', persona: '', goals: '', topics: '', maxLength: 280, style: '', neverSay: '' };
    }

    const response = await fetch(DEFAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tweetText,
            tweetAuthor,
            threadContext,
            parameters: params
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || 'Failed to generate reply');
    }

    return result;
}
