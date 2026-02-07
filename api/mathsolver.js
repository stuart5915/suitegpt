// MathSolver — Photo math equation, AI solves step by step via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'solve') {
            if (!image && !description) return res.status(400).json({ error: 'Image or problem is required' });

            systemInstruction = `You are a world-class math tutor and problem solver. Analyze the math problem from the photo or text and solve it step by step. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "problemDetected": "The math problem restated clearly using plain text symbols (², √, ×, ÷, ±, π, ≤, ≥, ≠, ∫, Σ, ∞)",
  "category": "Arithmetic|Algebra|Geometry|Trigonometry|Calculus|Statistics|Linear Algebra|Number Theory|Other",
  "topic": "Specific topic (e.g. Quadratic Equations, Derivatives, Matrix Multiplication)",
  "difficulty": "elementary|middle school|high school|college|advanced",
  "solution": {
    "steps": [
      {
        "stepNumber": 1,
        "title": "Step title",
        "work": "Show the math work using plain text symbols (², √, ×, ÷, ±). Each line on a new line.",
        "explanation": "Why we do this step — the reasoning",
        "rule": "Math rule or formula applied (or null)"
      }
    ],
    "finalAnswer": "The final answer, clearly stated",
    "verification": "Quick check that the answer is correct (plug back in, sanity check, etc.)"
  },
  "alternativeMethods": [
    {
      "method": "Name of alternative approach",
      "brief": "Quick explanation of how it works"
    }
  ],
  "keyFormulas": [
    {
      "name": "Formula name",
      "formula": "The formula in plain text",
      "when": "When to use it"
    }
  ],
  "commonMistakes": [
    "Mistake students often make on this type of problem"
  ],
  "practiceProblems": [
    {
      "problem": "A similar practice problem",
      "hint": "A hint",
      "answer": "The answer"
    }
  ],
  "graphDescription": "If the problem involves a function, describe what the graph looks like (or null)"
}

Rules:
- Problem: ${description || 'See uploaded image'}
- Show EVERY step — no skipping, no shortcuts
- Use plain text math symbols: ², ³, √, ×, ÷, ±, π, ≤, ≥, ≠, →, ∫, Σ, ∞, θ
- For fractions use a/b format, for exponents use ^ (e.g. x^2)
- Explain the WHY, not just the WHAT
- Name the specific math rule or theorem at each step
- Verify the answer at the end
- Include 2-3 practice problems
- Return ONLY valid JSON`;

            const parts = [{ text: 'Solve this math problem step by step, showing all work and explaining the reasoning.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Problem: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a world-class math tutor. The student solved a math problem and has follow-up questions. Explain clearly with examples. Use plain text math symbols (², √, ×, ÷). Use markdown for formatting.`;

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
                        temperature: 0.2,
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
        console.error('MathSolver API error:', error);
        return res.status(500).json({ error: 'Failed to solve problem' });
    }
}
