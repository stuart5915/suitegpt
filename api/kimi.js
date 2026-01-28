// Kimi K2 API Proxy - for agentic coding tasks (forking apps)
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

    const KIMI_API_KEY = process.env.KIMI_API_KEY;

    if (!KIMI_API_KEY) {
        return res.status(500).json({ error: 'Kimi API key not configured' });
    }

    try {
        const {
            messages,
            model = 'kimi-k2-0711-preview',
            temperature = 0.6,
            max_tokens = 16384,
            tools
        } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Build request body
        const requestBody = {
            model,
            messages,
            temperature,
            max_tokens
        };

        // Add tools if provided (for agentic tasks)
        if (tools && Array.isArray(tools)) {
            requestBody.tools = tools;
        }

        const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KIMI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
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
            return res.status(response.status).json({ error: data.error?.message || 'Kimi API error' });
        }

        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({
            text,
            choices: data.choices,
            usage: data.usage
        });

    } catch (error) {
        console.error('Kimi API error:', error);
        return res.status(500).json({ error: 'Failed to call Kimi API' });
    }
}
