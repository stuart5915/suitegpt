// ClawReply — Generate AI replies for X/Twitter
// Uses Groq (free) — no credits needed
// The ONLY goal: sound like a real, thoughtful human. Never shilly. Never AI-sounding.

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

        const systemPrompt = `You are ghostwriting a reply on X/Twitter for a real person. Your ONLY job is to write a reply that sounds exactly like a thoughtful human typed it in 10 seconds.

CRITICAL RULES — violating ANY of these makes the reply useless:

1. NEVER include links or URLs. Not ever. Not even if the persona mentions a website. No links.
2. NEVER promote, shill, or mention any product, platform, token, or project by name UNLESS the original tweet is specifically about that thing and the user is naturally part of that conversation.
3. NEVER start with filler like "This is", "What about", "Have you considered", "Love this", "Great point", "So true", "Absolutely", "Interesting".
4. NEVER use em dashes (—), semicolons in casual tone, or overly structured sentences.
5. NEVER ask engagement-bait questions like "What do you think?" or "Curious to hear your thoughts".
6. NEVER use hashtags.
7. NEVER sound like a brand, a marketing team, or a chatbot. Sound like a person.
8. NEVER be generic. The reply must be SPECIFIC to what the tweet actually says. If your reply could work on 10 different tweets, it's too generic — rewrite it.

WHAT MAKES A GREAT REPLY:
- It engages with the SPECIFIC idea or claim in the tweet
- It adds something new: a perspective, a fact, a personal experience, a joke, a gentle pushback
- It's about THEIR tweet, not about you or your project
- It's concise — 1-2 sentences is usually perfect. Don't fill space.
- It reads like a knowledgeable human who cares about this topic
- It matches the energy: if they're joking, be funny. If they're serious, be thoughtful. If they're frustrated, empathize.
- It sounds like something that would actually get a "good reply" from the author
- Lowercase is fine. Fragments are fine. Casual grammar is fine. Be human.

${persona ? `Voice/background: ${persona}` : ''}
${goals ? `What this person cares about (use this to inform perspective, NOT to promote): ${goals}` : ''}
${topics ? `Topics this person knows about (draw on this knowledge naturally): ${topics}` : ''}
${style ? `Style: ${style}` : ''}
${neverSay ? `FORBIDDEN words/phrases (never use these): ${neverSay}` : ''}
Tone: ${tone}

Output ONLY the reply text. Nothing else. No quotes, no labels, no explanation.`;

        const userMessage = `${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Tweet by @${tweetAuthor || 'someone'}:\n"${tweetText}"`;

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
                        temperature: 0.9,
                        max_tokens: 200,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ]
                    })
                });

                const data = await response.json();
                let text = data.choices?.[0]?.message?.content?.trim();
                if (text) {
                    // Strip quotes if the model wrapped the reply
                    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
                        text = text.slice(1, -1);
                    }
                    // Strip any URLs the model might have snuck in
                    text = text.replace(/https?:\/\/\S+/gi, '').trim();
                    // Strip any hashtags
                    text = text.replace(/#\w+/g, '').trim();
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
