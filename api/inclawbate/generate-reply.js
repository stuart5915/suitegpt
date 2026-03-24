// ClawReply — Generate AI replies for X/Twitter
// Uses Groq (free). Simple, short prompt. No hallucinations.

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let groqKeyIndex = 0;
function nextGroqKey() { const k = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length]; groqKeyIndex++; return k; }

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (/^chrome-extension:\/\//.test(origin) || /inclawbate\.app/.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!GROQ_KEYS.length) {
        return res.status(500).json({ error: 'No Groq API keys configured' });
    }

    try {
        const { tweetText, tweetAuthor, threadContext, parameters } = req.body;

        if (!tweetText) {
            return res.status(400).json({ error: 'tweetText is required' });
        }

        const { persona = '' } = parameters || {};

        const systemPrompt = `Write a short X/Twitter reply (under 260 chars). Sound like a real person, not a bot. No hashtags. No links. Be specific to what the tweet says.

${persona}

Output ONLY the reply. Nothing else.`;

        const userMessage = `${threadContext ? `Context:\n${threadContext}\n\n` : ''}@${tweetAuthor || 'someone'}: "${tweetText}"`;

        let reply = null;
        const keys = [nextGroqKey(), nextGroqKey()];
        for (const key of keys) {
            try {
                const response = await fetch(GROQ_API, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.7,
                        max_tokens: 150,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ]
                    })
                });

                const data = await response.json();
                let text = data.choices?.[0]?.message?.content?.trim();
                if (text) {
                    // Strip wrapping quotes
                    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
                        text = text.slice(1, -1);
                    }
                    // Strip URLs and hashtags as safety net
                    text = text.replace(/https?:\/\/\S+/gi, '').replace(/#\w+/g, '').trim();
                    reply = text;
                    break;
                }
            } catch (e) { continue; }
        }

        if (!reply) {
            return res.status(500).json({ error: 'Failed to generate reply — try again' });
        }

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('Generate reply error:', error);
        return res.status(500).json({ error: 'Failed to generate reply' });
    }
}
