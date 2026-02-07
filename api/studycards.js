// StudyCards — Photo notes/textbook, AI generates flashcards via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, cardCount, difficulty, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!image && !description) return res.status(400).json({ error: 'Image or text is required' });

            systemInstruction = `You are an expert educator and study coach. Analyze the notes, textbook page, or study material and generate effective flashcards. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "sourceDetected": "What the source material covers",
  "subject": "The subject area",
  "topic": "Specific topic",
  "totalCards": 15,
  "cards": [
    {
      "id": 1,
      "front": "Question or term (clear, concise)",
      "back": "Answer or definition (detailed but memorable)",
      "hint": "A helpful hint if the student is stuck",
      "difficulty": "easy|medium|hard",
      "category": "vocabulary|concept|fact|formula|process|comparison"
    }
  ],
  "studyTips": [
    "Tip for studying this material effectively"
  ],
  "keyTerms": [
    { "term": "Important term", "definition": "Brief definition" }
  ],
  "connections": [
    "How concepts in these cards connect to each other"
  ]
}

Rules:
- Source material: ${description || 'See uploaded image'}
- Generate ${cardCount || 15} flashcards
- Difficulty focus: ${difficulty || 'mixed'}
- Mix card types: definitions, concepts, applications, comparisons
- Front should be a clear question or prompt
- Back should be a complete but concise answer
- Include hints for harder cards
- Cards should build on each other (basics first, then complex)
- For formulas: front = "what's the formula for X", back = the formula + when to use it
- For vocabulary: front = term, back = definition + example sentence
- Return ONLY valid JSON`;

            const parts = [{ text: 'Create flashcards from this study material. Extract the key concepts, terms, and facts.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Study material: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert study coach. The student generated flashcards and has follow-up questions about the material, study strategies, or wants to test themselves. Help them learn effectively. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous flashcards: ${context.slice(0, 50000)}` }] });
            if (history?.length > 0) {
                for (const msg of history) {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
                }
            }
            messages.push({ parts: [{ text: question }] });
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
                        temperature: 0.5,
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
        console.error('StudyCards API error:', error);
        return res.status(500).json({ error: 'Failed to generate cards' });
    }
}
