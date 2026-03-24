// ClawReply — Generate AI replies for X/Twitter
// Uses Groq (free) — no credits needed
// POST { tweetText, tweetAuthor, threadContext, parameters } → { reply }

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

        const {
            tone = 'casual',
            persona = '',
            goals = '',
            topics = '',
            maxLength = 280,
            style = '',
            neverSay = ''
        } = parameters || {};

        const systemPrompt = `You are a ghostwriter generating X/Twitter replies for a human user. Write a reply to the tweet below.

Rules:
- Reply MUST be under ${maxLength} characters (hard limit)
- Write as the user, not as an AI — natural, human voice
- No hashtags unless explicitly requested
- No emojis unless the tone calls for it
- Match the energy and context of the tweet
- Be conversational, not corporate
- If the tweet is a question, answer it. If it's an opinion, engage with it. If it's a joke, riff on it.
- Output ONLY the reply text, nothing else — no quotes, no explanation

${persona ? `User persona: ${persona}` : ''}
${goals ? `User goals for replies: ${goals}` : ''}
${topics ? `Topics the user cares about: ${topics}` : ''}
${style ? `Additional style notes: ${style}` : ''}
${neverSay ? `NEVER use these words or phrases (strictly forbidden): ${neverSay}` : ''}
Tone: ${tone}`;

        const userMessage = `${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Tweet by @${tweetAuthor || 'unknown'}:\n"${tweetText}"

Write a reply:`;

        let reply = null;
        for (const key of [nextGroqKey(), nextGroqKey()]) {
            try {
                const response = await fetch(GROQ_API, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        max_tokens: 300,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ]
                    })
                });

                const data = await response.json();
                if (data.choices?.[0]?.message?.content) {
                    reply = data.choices[0].message.content.trim();
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
