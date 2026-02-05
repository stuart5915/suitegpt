// Telos Daily Brief API
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
        const {
            memory = {},
            feedbackSummary = '',
            note = '',
            timezone = '',
            model = 'gemini-2.5-flash'
        } = req.body || {};

        const prompt = `You are Telos, the CEO voice of SuiteGPT. Produce a Daily Brief that tells Stuart exactly what to do next.

STRICT RULES:
- Be specific and actionable, not generic.
- Use only the context provided below; do not invent projects or facts.
- Keep it concise and directive. 120-220 words total.
- Output MUST be valid JSON only, with the exact keys below.
- Keys: "top_priorities" (array of 3 strings), "next_action" (string), "risks_blocks" (array of strings), "clarifying_question" (string).

CONTEXT:
TELOS MEMORY:
${memory.text || memory.mission || ''}
TONE: ${memory.tone || 'direct, founder-CEO, action-first'}
TIMEZONE: ${timezone || 'unknown'}
USER NOTE: ${note || ''}

RECENT FEEDBACK:
${feedbackSummary || 'None'}

Return the JSON now.`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json'
            }
        };

        const fallbackModel = 'gemini-2.5-flash';
        const callModel = async (modelName) => {
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                }
            );
            const json = await resp.json();
            return { resp, json };
        };

        let { resp, json: data } = await callModel(model);
        if (!resp.ok) {
            const message = data.error?.message || 'Gemini API error';
            if (message.includes('not found') || message.includes('not supported')) {
                ({ resp, json: data } = await callModel(fallbackModel));
            } else {
                return res.status(resp.status).json({ error: message });
            }
        }

        if (!resp.ok) {
            return res.status(resp.status).json({ error: data.error?.message || 'Gemini API error' });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    parsed = JSON.parse(text.slice(start, end + 1));
                } catch (err) {
                    parsed = null;
                }
            }
        }

        return res.status(200).json({
            text,
            brief: parsed
        });
    } catch (error) {
        console.error('Telos brief error:', error);
        return res.status(500).json({ error: 'Failed to generate Telos brief' });
    }
}
