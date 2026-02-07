// EssayCoach API - Essay feedback and improvement via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, essay, essayType, question, history } = req.body;

    if (!essay) return res.status(400).json({ error: 'Essay text is required' });
    if (!mode) return res.status(400).json({ error: 'Mode is required (review or qa)' });

    try {
        let systemInstruction, contents;

        if (mode === 'review') {
            systemInstruction = `You are an expert writing coach and English professor. Analyze the provided essay and return a JSON object with exactly this structure:
{
  "overallScore": 78,
  "scoreSummary": "Brief 2-sentence assessment of overall quality",
  "scores": {
    "clarity": 80,
    "structure": 75,
    "grammar": 85,
    "argument": 70,
    "style": 78
  },
  "strengths": ["Strength 1", "Strength 2", ...],
  "weaknesses": ["Weakness 1", "Weakness 2", ...],
  "grammarFixes": [
    { "original": "exact text with error", "fixed": "corrected text", "explanation": "why this is wrong" },
    ...
  ],
  "improvedSentences": [
    { "original": "weak sentence from essay", "improved": "stronger rewrite", "reason": "why this is better" },
    ...
  ],
  "structureSuggestions": ["Suggestion about essay organization 1", "Suggestion 2", ...],
  "nextSteps": ["Actionable improvement 1", "Actionable improvement 2", ...]
}

Rules:
- overallScore: 0-100 holistic quality score
- scores: Each sub-score 0-100. clarity=how clear the writing is, structure=organization and flow, grammar=correctness, argument=strength of thesis and evidence, style=voice and word choice
- strengths: 3-5 specific things done well with examples
- weaknesses: 3-5 specific areas to improve with examples
- grammarFixes: Find up to 8 actual grammar, spelling, or punctuation errors. Use the EXACT text from the essay
- improvedSentences: Pick 5-8 weak or awkward sentences and rewrite them stronger
- structureSuggestions: 2-4 suggestions about organization, transitions, or paragraph structure
- nextSteps: 3-5 concrete actions to improve this essay
- Essay type context: ${essayType || 'general'}
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Review this ${essayType || ''} essay:\n\n${essay.slice(0, 300000)}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required for qa mode' });

            systemInstruction = `You are an expert writing coach. The student has shared their essay and wants specific advice. Give clear, actionable feedback. Reference specific parts of their essay when relevant. Be encouraging but honest.`;

            const messages = [{ parts: [{ text: `Student's essay:\n\n${essay.slice(0, 300000)}` }] }];
            if (history?.length > 0) {
                for (const msg of history) {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
                }
            }
            messages.push({ parts: [{ text: question }] });
            contents = messages;

        } else {
            return res.status(400).json({ error: 'Invalid mode. Use "review" or "qa"' });
        }

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'review' ? 0.3 : 0.7,
                maxOutputTokens: mode === 'review' ? 8192 : 4096
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'review') {
            try {
                const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return res.status(200).json(parsed);
            } catch (parseError) {
                return res.status(200).json({ overallScore: 0, scoreSummary: responseText, scores: {}, strengths: [], weaknesses: [], grammarFixes: [], improvedSentences: [], structureSuggestions: [], nextSteps: [] });
            }
        } else {
            return res.status(200).json({ answer: responseText });
        }

    } catch (error) {
        console.error('EssayCoach API error:', error);
        return res.status(500).json({ error: 'Failed to review essay' });
    }
}
