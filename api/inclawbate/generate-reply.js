// Generate an AI reply to a tweet using Claude Sonnet
// Called by the Inclawbate Chrome extension

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { ANTHROPIC_API_KEY } = process.env;
    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
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
            style = ''
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
Tone: ${tone}`;

        const userMessage = `${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Tweet by @${tweetAuthor || 'unknown'}:\n"${tweetText}"

Write a reply:`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Failed to generate reply'
            });
        }

        const reply = data.content?.[0]?.text?.trim() || '';

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('Generate reply error:', error);
        return res.status(500).json({ error: 'Failed to generate reply' });
    }
}
