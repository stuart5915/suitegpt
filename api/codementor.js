// CodeMentor API - Code review and improvement via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, code, language, question, history } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'review') {
            if (!code) return res.status(400).json({ error: 'Code is required' });

            systemInstruction = `You are a senior software engineer and code reviewer with 15+ years of experience. Analyze the provided code and return a JSON object with exactly this structure:
{
  "language": "Detected programming language",
  "overallScore": 75,
  "scoreSummary": "Brief 2-sentence assessment",
  "scores": {
    "readability": 80,
    "performance": 70,
    "security": 85,
    "bestPractices": 75,
    "maintainability": 72
  },
  "bugs": [
    { "line": "approximate line or code snippet", "severity": "critical|warning|info", "description": "What's wrong", "fix": "How to fix it" }
  ],
  "improvements": [
    { "category": "performance|readability|security|style|logic", "original": "original code snippet", "improved": "improved version", "explanation": "Why this is better" }
  ],
  "securityIssues": [
    { "issue": "Security concern", "severity": "high|medium|low", "recommendation": "How to fix" }
  ],
  "strengths": ["What the code does well"],
  "summary": {
    "linesOfCode": 42,
    "complexity": "low|medium|high",
    "testability": "easy|moderate|difficult"
  },
  "nextSteps": ["Top priority improvement 1", "Improvement 2", "Improvement 3"]
}

Rules:
- Language context: ${language || 'auto-detect'}
- overallScore: 0-100 holistic quality
- scores: Each 0-100. readability=naming/formatting/clarity, performance=efficiency/complexity, security=vulnerability exposure, bestPractices=idiomatic patterns, maintainability=modularity/testability
- bugs: Find actual bugs, not style preferences. Include line references
- improvements: Pick 3-6 specific code snippets and rewrite them better. Show original and improved
- securityIssues: SQL injection, XSS, hardcoded secrets, unsafe deserialization, etc.
- Be specific — reference actual code from the input
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Review this ${language || ''} code:\n\n\`\`\`\n${code.slice(0, 100000)}\n\`\`\`` }] }];

        } else if (mode === 'qa') {
            if (!code) return res.status(400).json({ error: 'Code context required' });
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a senior software engineer. The user has shared their code and wants specific advice. Give clear, actionable feedback with code examples when relevant. Use markdown code blocks for any code snippets.`;

            const messages = [{ parts: [{ text: `User's code:\n\n\`\`\`\n${code.slice(0, 100000)}\n\`\`\`` }] }];
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

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'review' ? 0.3 : 0.7,
                maxOutputTokens: 8192
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'qa') {
            return res.status(200).json({ answer: responseText });
        }

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(200).json({ raw: responseText });
        }

    } catch (error) {
        console.error('CodeMentor API error:', error);
        return res.status(500).json({ error: 'Failed to review code' });
    }
}
