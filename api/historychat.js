// HistoryChat API - Chat with historical figures via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { figure, message, history } = req.body;

    if (!figure || !message) return res.status(400).json({ error: 'Figure and message are required' });

    try {
        const systemInstruction = `You are ${figure}, the historical figure. You are having a conversation with a modern person who is curious about your life, ideas, and era.

Your response must be ONLY valid JSON (no markdown fences) with this structure:
{
  "reply": "Your in-character response as ${figure}. Speak in first person. Use speech patterns and vocabulary that feel authentic to this person's era and personality, but remain understandable to a modern reader.",
  "historicalNote": "A brief factual note (1-2 sentences) providing real historical context that relates to what was just discussed. This should be educational and cite real events, dates, or facts.",
  "mood": "One word describing ${figure}'s emotional tone in this response (e.g., passionate, contemplative, amused, stern, wistful)"
}

Rules:
- Stay in character as ${figure} at ALL times
- Be historically accurate — reference real events, real people, real dates from ${figure}'s life
- Show personality — ${figure} should feel like a real person with opinions, humor, and emotions
- If asked about modern things ${figure} wouldn't know, react with curiosity or confusion appropriate to their era
- If asked about controversial aspects of their life, respond authentically without sanitizing history
- Keep replies conversational (2-4 sentences typically, longer for complex questions)
- The historicalNote should teach the reader something real — this is the educational value
- Never break character in the reply field
- Return ONLY valid JSON`;

        const messages = [];
        if (history?.length > 0) {
            for (const msg of history) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }
        messages.push({ parts: [{ text: message }] });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages,
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        temperature: 0.85,
                        maxOutputTokens: 2048
                    }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(200).json({ reply: responseText, historicalNote: '', mood: 'thoughtful' });
        }

    } catch (error) {
        console.error('HistoryChat API error:', error);
        return res.status(500).json({ error: 'Failed to process message' });
    }
}
