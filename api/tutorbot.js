// TutorBot — AI Homework Helper via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, subject, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'solve') {
            if (!image && !description) return res.status(400).json({ error: 'Image or problem description is required' });

            systemInstruction = `You are a patient, encouraging tutor who helps students learn by understanding, not just giving answers. Analyze the homework problem and return ONLY valid JSON (no markdown fences) with this structure:
{
  "problemDetected": "What the problem is asking (restate clearly)",
  "subject": "Math|Science|English|History|Geography|Computer Science|Other",
  "topic": "Specific topic (e.g. Quadratic Equations, Photosynthesis, Essay Structure)",
  "difficulty": "elementary|middle school|high school|college",
  "solution": {
    "steps": [
      {
        "stepNumber": 1,
        "title": "Step title",
        "explanation": "Clear explanation of what we're doing and WHY",
        "work": "The actual math/work shown (use plain text, not LaTeX). For math use symbols like ², √, ×, ÷, ±, π",
        "tip": "A helpful tip or common mistake to avoid (or null)"
      }
    ],
    "finalAnswer": "The final answer, clearly stated",
    "answerExplanation": "Why this answer makes sense — a sanity check"
  },
  "keyConceptsUsed": [
    { "concept": "Concept name", "explanation": "Brief explanation of this concept" }
  ],
  "commonMistakes": [
    "Mistake students often make on this type of problem"
  ],
  "practiceProblems": [
    {
      "problem": "A similar practice problem",
      "hint": "A hint for solving it",
      "answer": "The answer (hidden by default)"
    }
  ],
  "relatedTopics": ["Topic to study next", "Another related topic"]
}

Rules:
- Problem: ${description || 'See uploaded image'}
- Subject hint: ${subject || 'auto-detect'}
- Show ALL work step by step — no skipping
- Explain the WHY behind each step, not just the WHAT
- Use encouraging, patient language — like a great tutor
- For math: show every algebraic step, use clear notation
- For science: explain the underlying principles
- For English/essays: provide structural guidance and examples
- Include 2-3 practice problems of similar difficulty
- Return ONLY valid JSON`;

            const parts = [{ text: 'Solve this homework problem step by step, explaining the reasoning at each step.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Problem description: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a patient, encouraging tutor. The student solved a problem and has follow-up questions. Explain concepts clearly with examples. Use markdown for formatting. For math, use plain text symbols (², √, ×, ÷).`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous solution: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.3,
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
        console.error('TutorBot API error:', error);
        return res.status(500).json({ error: 'Failed to solve problem' });
    }
}
