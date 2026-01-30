// Gemini API Proxy - keeps API key secure on server
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

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    try {
        const { prompt, model = 'gemini-2.0-flash', contents, generationConfig, systemInstruction, enableSearch } = req.body;

        // Build request body - support both simple prompt and full contents structure
        let requestBody;
        if (contents) {
            // Full structure provided
            requestBody = {
                contents,
                generationConfig: generationConfig || { temperature: 0.7, maxOutputTokens: 8192 }
            };
        } else if (prompt) {
            // Simple prompt string
            requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: generationConfig || { temperature: 0.7, maxOutputTokens: 8192 }
            };
        } else {
            return res.status(400).json({ error: 'Prompt or contents is required' });
        }

        // Add system instruction if provided
        if (systemInstruction) {
            requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        // Enable Google Search grounding for real-time info
        if (enableSearch !== false) {
            requestBody.tools = [{ googleSearch: {} }];
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
        const searchQueries = groundingMetadata?.searchEntryPoint?.renderedContent;
        const groundingChunks = groundingMetadata?.groundingChunks;
        return res.status(200).json({ text, candidates: data.candidates, groundingMetadata, groundingChunks, searchQueries });

    } catch (error) {
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'Failed to call Gemini API' });
    }
}
