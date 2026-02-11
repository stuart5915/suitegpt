// Background service worker — handles API calls and hotkey commands

const DEFAULT_API_URL = 'https://inclawbate.com/api/inclawbate/generate-reply';

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
    const settings = await chrome.storage.sync.get({
        apiUrl: DEFAULT_API_URL,
        tone: 'casual',
        persona: '',
        goals: '',
        topics: '',
        maxLength: 280,
        style: ''
    });

    const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tweetText,
            tweetAuthor,
            threadContext,
            parameters: {
                tone: settings.tone,
                persona: settings.persona,
                goals: settings.goals,
                topics: settings.topics,
                maxLength: settings.maxLength,
                style: settings.style
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reply');
    }

    return data;
}
