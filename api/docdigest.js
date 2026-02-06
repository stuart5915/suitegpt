// DocDigest API - PDF summarization via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, text, question, history } = req.body;

    if (!text) return res.status(400).json({ error: 'Document text is required' });
    if (!mode) return res.status(400).json({ error: 'Mode is required (summarize or qa)' });

    try {
        let systemInstruction, contents;

        if (mode === 'summarize') {
            systemInstruction = `You are a document analysis expert. Analyze the provided document and return a JSON object with exactly this structure:
{
  "summary": "A comprehensive 2-3 paragraph overview of the document",
  "keyPoints": ["Point 1", "Point 2", ...],
  "actionItems": ["Action 1", "Action 2", ...]
}

Rules:
- summary: Write a clear, well-structured overview covering the main topics and conclusions
- keyPoints: Extract 5-10 of the most important facts, findings, or arguments
- actionItems: Extract any tasks, recommendations, next steps, or calls to action. If none exist, return an empty array
- Return ONLY valid JSON, no markdown fences, no extra text`;

            contents = [{ parts: [{ text: `Analyze this document:\n\n${text.slice(0, 500000)}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required for qa mode' });

            systemInstruction = `You are a document Q&A expert. Answer questions about the provided document accurately and specifically. Reference relevant sections when possible. If the answer is not in the document, say so clearly.`;

            const messages = [{ parts: [{ text: `Document:\n\n${text.slice(0, 500000)}` }] }];

            // Add conversation history if provided
            if (history && history.length > 0) {
                for (const msg of history) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }

            messages.push({ parts: [{ text: question }] });
            contents = messages;

        } else {
            return res.status(400).json({ error: 'Invalid mode. Use "summarize" or "qa"' });
        }

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'summarize' ? 0.3 : 0.7,
                maxOutputTokens: mode === 'summarize' ? 8192 : 4096
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'summarize') {
            // Parse the JSON response
            try {
                const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return res.status(200).json({
                    summary: parsed.summary || '',
                    keyPoints: parsed.keyPoints || [],
                    actionItems: parsed.actionItems || []
                });
            } catch (parseError) {
                // If JSON parsing fails, return the raw text as summary
                return res.status(200).json({
                    summary: responseText,
                    keyPoints: [],
                    actionItems: []
                });
            }
        } else {
            return res.status(200).json({ answer: responseText });
        }

    } catch (error) {
        console.error('DocDigest API error:', error);
        return res.status(500).json({ error: 'Failed to analyze document' });
    }
}
