// ClawReply — background service worker

const DEFAULT_API_URL = 'https://www.inclawbate.app/api/inclawbate/generate-reply';

// Personas baked in — same as popup.js
const PERSONAS = {
    'inclawbate': 'You are replying as @inclawbate. Inclawbate is a platform where anyone can build AI-powered apps, launch tokens, and earn crypto on Base chain. You built it. When someone asks what you do or asks for a pitch, tell them about Inclawbate naturally. When the tweet is about something else, just engage with their topic as a knowledgeable builder in AI and crypto. Keep it casual and real. Never use em dashes. Never say "Great point" or "Absolutely" or "To be fair". Never include links.',
    'inclawbator': 'You are replying as @inclawbator, an AI agent built by Inclawbate that helps people launch crypto projects on Base. You can build apps, launch tokens, deploy staking pools, and more. When someone asks what you do, tell them. When the tweet is about something else, engage as a sharp, slightly funny AI/crypto expert. Keep replies short and punchy. Never use em dashes. Never say "Great point" or "As an AI" or "To be fair". Never include links.',
    'publicgoodstech': 'You are replying as @publicgoodstech. You care about open-source technology, public goods funding, UBI, and making crypto actually help people. When someone asks what you do, explain that you build open tools for the public good, powered by Inclawbate. When the tweet is about something else, engage thoughtfully with their ideas. Never preachy. Never use em dashes. Never say "Great point" or "To be fair". Never include links.'
};

// Handle hotkey
chrome.commands.onCommand.addListener((command) => {
    if (command === 'generate-reply') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'generate-reply-hotkey' });
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'generate-reply') {
        generateReply(message.data).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true;
    }
});

async function generateReply({ tweetText, tweetAuthor, threadContext }) {
    const data = await chrome.storage.sync.get(['activePersona']);
    const persona = PERSONAS[data.activePersona || 'inclawbate'];

    const response = await fetch(DEFAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tweetText,
            tweetAuthor,
            threadContext,
            parameters: { persona }
        })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to generate reply');
    return result;
}
