// LanguageBuddy API - AI language practice conversations via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { language, level, scenario, message, history } = req.body;

    if (!language || !message) return res.status(400).json({ error: 'Language and message are required' });

    try {
        const systemInstruction = `You are a friendly, patient language tutor for ${language}. The student's level is ${level || 'beginner'}.${scenario ? ` The conversation scenario is: ${scenario}.` : ''}

Your response must be ONLY valid JSON (no markdown fences) with this structure:
{
  "reply": "Your response in ${language} (the target language)",
  "translation": "English translation of your reply",
  "corrections": [
    {
      "original": "what the student wrote wrong",
      "corrected": "the correct version in ${language}",
      "explanation": "Brief explanation in English of why"
    }
  ],
  "vocabulary": [
    {
      "word": "key word/phrase from your reply in ${language}",
      "translation": "English meaning",
      "pronunciation": "approximate pronunciation guide"
    }
  ],
  "tip": "A brief grammar or usage tip relevant to this exchange (in English)"
}

Rules:
- ALWAYS reply primarily in ${language} (the reply field)
- Match complexity to the student's level: ${level || 'beginner'}
  - beginner (A1): Use simple present tense, basic vocabulary, short sentences
  - elementary (A2): Simple past/future, common expressions, 1-2 clauses
  - intermediate (B1): All common tenses, idioms, compound sentences
  - upper-intermediate (B2): Complex grammar, nuance, cultural references
  - advanced (C1): Native-like, slang, sophisticated vocabulary
- If the student writes in English, gently encourage them to try in ${language} and help them
- If the student makes mistakes, ALWAYS include corrections (don't skip them to be nice)
- Include 2-4 vocabulary words from your reply that the student should learn
- Keep the conversation natural and engaging — ask follow-up questions
- The tip should teach something useful related to what just came up in conversation
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
                        temperature: 0.8,
                        maxOutputTokens: 4096
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
            return res.status(200).json({ reply: responseText, translation: '', corrections: [], vocabulary: [], tip: '' });
        }

    } catch (error) {
        console.error('LanguageBuddy API error:', error);
        return res.status(500).json({ error: 'Failed to process message' });
    }
}
