// ScienceExplainer — AI Science Q&A via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, question, subject, level, question2, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'explain') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a brilliant science educator who makes complex topics simple and fascinating. Explain the topic and return ONLY valid JSON (no markdown fences) with this structure:
{
  "title": "Clear, engaging title for the explanation",
  "tldr": "One-sentence summary a 10-year-old could understand",
  "explanation": [
    {
      "heading": "Section heading",
      "content": "Clear explanation in 2-3 paragraphs. Use simple language, concrete examples, and vivid analogies. Build from basic to complex.",
      "analogy": "A relatable real-world analogy for this concept (or null)",
      "funFact": "An interesting or surprising fact related to this section (or null)"
    }
  ],
  "keyTerms": [
    { "term": "Technical term", "definition": "Simple definition" }
  ],
  "realWorldExamples": ["How this applies in everyday life 1", "Example 2", "Example 3"],
  "commonMisconceptions": [
    { "myth": "Common wrong belief", "reality": "The actual truth" }
  ],
  "goDeeper": ["Follow-up question to explore next", "Another deeper question", "Advanced topic to investigate"],
  "difficulty": "beginner|intermediate|advanced",
  "branch": "Physics|Chemistry|Biology|Earth Science|Astronomy|Math|Computer Science|Engineering|Environmental Science|General Science"
}

Rules:
- Question: ${question}
- Subject area: ${subject || 'auto-detect'}
- Explanation level: ${level || 'general audience'}
- Write like the best science communicator — engaging, clear, never condescending
- Use analogies liberally — they are the key to understanding
- Include 2-4 explanation sections that build logically
- Fun facts should be genuinely surprising and memorable
- Key terms should cover any jargon used in the explanation
- Common misconceptions should address real misunderstandings people have
- Real-world examples should be practical and relatable
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Explain the science topic clearly and engagingly.' }] }];

        } else if (mode === 'qa') {
            if (!question2) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a brilliant science educator. The user received a science explanation and wants to go deeper or ask follow-up questions. Explain clearly with analogies and examples. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous explanation: ${context.slice(0, 50000)}` }] });
            if (history?.length > 0) {
                for (const msg of history) {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
                }
            }
            messages.push({ parts: [{ text: question2 }] });
            contents = messages;

        } else {
            return res.status(400).json({ error: 'Invalid mode' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'qa') return res.status(200).json({ answer: responseText });

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(200).json({ raw: responseText });
        }

    } catch (error) {
        console.error('ScienceExplainer API error:', error);
        return res.status(500).json({ error: 'Failed to generate explanation' });
    }
}
