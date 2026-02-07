// QuizMaker API - Generate quizzes from study material via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, material, subject, difficulty, questionCount, questionTypes, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!material) return res.status(400).json({ error: 'Study material is required' });

            systemInstruction = `You are an expert educator and test designer. Generate a quiz from the provided study material and return ONLY valid JSON (no markdown fences) with this structure:
{
  "quizTitle": "Quiz title based on the material",
  "subject": "Detected or provided subject area",
  "difficulty": "${difficulty || 'medium'}",
  "totalQuestions": ${questionCount || 10},
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "The question text",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "B",
      "explanation": "Why this answer is correct, referencing the source material"
    },
    {
      "id": 2,
      "type": "true_false",
      "question": "Statement to evaluate as true or false",
      "correctAnswer": "True",
      "explanation": "Why this is true/false"
    },
    {
      "id": 3,
      "type": "short_answer",
      "question": "Question requiring a brief written response",
      "correctAnswer": "Expected answer or key points",
      "explanation": "What a complete answer should include"
    },
    {
      "id": 4,
      "type": "fill_blank",
      "question": "The _____ is the powerhouse of the cell.",
      "correctAnswer": "mitochondria",
      "explanation": "Brief explanation"
    }
  ],
  "studyTips": ["Tip 1 for mastering this material", "Tip 2", "Tip 3"]
}

Rules:
- Subject context: ${subject || 'auto-detect from material'}
- Difficulty: ${difficulty || 'medium'} (easy=recall/definition, medium=application/analysis, hard=synthesis/evaluation)
- Generate exactly ${questionCount || 10} questions
- Question type distribution: ${questionTypes ? questionTypes.join(', ') : 'mix of multiple_choice (50%), true_false (20%), short_answer (20%), fill_blank (10%)'}
- Multiple choice must have exactly 4 options (A, B, C, D)
- correctAnswer for multiple_choice should be the letter only (A, B, C, or D)
- Every question MUST have an explanation referencing the source material
- Questions should test understanding, not just memorization (especially at medium/hard difficulty)
- Cover the breadth of the material, don't cluster questions on one topic
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Generate a quiz from this study material:\n\n${material.slice(0, 80000)}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert educator. The user generated a quiz from study material and has follow-up questions. Help them understand concepts, explain answers, or generate additional practice questions. Use markdown formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Quiz context: ${context.slice(0, 50000)}` }] });
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
                        temperature: mode === 'generate' ? 0.5 : 0.7,
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
        console.error('QuizMaker API error:', error);
        return res.status(500).json({ error: 'Failed to generate quiz' });
    }
}
