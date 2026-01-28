// Groq API Proxy - keeps API key secure on server
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Groq API key not configured' });
    }

    try {
        const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.7, max_tokens = 8192 } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle rate limiting gracefully
            if (response.status === 429) {
                return res.status(429).json({
                    error: 'Rate limit reached. Please wait a moment and try again.',
                    retryAfter: response.headers.get('retry-after') || 60
                });
            }
            return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
        }

        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ text, choices: data.choices, usage: data.usage });

    } catch (error) {
        console.error('Groq API error:', error);
        return res.status(500).json({ error: 'Failed to call Groq API' });
    }
}
