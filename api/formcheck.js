// FormCheck — Photo exercise form, AI analyzes technique and gives corrections
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, exercise, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert personal trainer, physical therapist, and exercise biomechanics specialist. Analyze exercise form from photos and provide detailed, actionable feedback. Focus on safety first, then performance optimization.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "exerciseDetected": "Name of exercise",
  "muscleGroups": ["Primary muscles", "Secondary muscles"],
  "overallScore": 85,
  "overallGrade": "A|B|C|D|F",
  "safetyRating": "safe|caution|risk",
  "formAnalysis": {
    "posture": { "score": 90, "status": "good|needs-work|incorrect", "detail": "Specific observation about posture" },
    "alignment": { "score": 80, "status": "good|needs-work|incorrect", "detail": "Joint alignment assessment" },
    "range": { "score": 85, "status": "good|needs-work|incorrect", "detail": "Range of motion assessment" },
    "balance": { "score": 90, "status": "good|needs-work|incorrect", "detail": "Weight distribution and stability" },
    "breathing": { "score": 75, "status": "good|needs-work|incorrect", "detail": "Breathing pattern recommendation" }
  },
  "corrections": [
    {
      "priority": "high|medium|low",
      "issue": "What's wrong",
      "fix": "How to fix it",
      "why": "Why this matters (injury risk, muscle activation, etc.)",
      "cue": "Quick coaching cue to remember"
    }
  ],
  "whatYoureDoingWell": [
    "Positive reinforcement — what's already good"
  ],
  "injuryRisks": [
    { "risk": "Potential injury", "area": "Body part", "severity": "low|medium|high", "prevention": "How to prevent" }
  ],
  "progressionTips": [
    { "tip": "How to progress", "when": "When to progress" }
  ],
  "relatedExercises": [
    { "exercise": "Alternative or complementary exercise", "benefit": "Why this helps" }
  ],
  "disclaimer": "This is AI-generated guidance, not medical advice. Consult a certified trainer or physical therapist for personalized form assessment."
}

Rules:
- Exercise: ${exercise || 'auto-detect from image'}
- Description: ${description || 'See image'}
- Score 0-100 for overall and each component
- Prioritize SAFETY corrections first
- Be specific about body positioning (angles, alignment)
- Include coaching cues that are easy to remember
- Be encouraging — mention what they're doing well
- Always include injury risk assessment
- Return ONLY valid JSON`;

            const parts = [{ text: `Analyze this exercise form. Identify the exercise, assess technique, and provide corrections.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (description) {
                parts[0].text += ` Additional context: ${description}`;
            }
            if (exercise) {
                parts[0].text += ` Exercise being performed: ${exercise}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert personal trainer and exercise specialist. The user got a form check and has follow-up questions about technique, alternatives, programming, or injury prevention. Be specific and encouraging. Use markdown. Always note you're not a replacement for in-person assessment.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Form analysis: ${context.slice(0, 50000)}` }] });
            if (history?.length > 0) {
                for (const msg of history) messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
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
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (mode === 'qa') return res.status(200).json({ answer: responseText });
        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            return res.status(200).json(JSON.parse(cleaned));
        } catch (e) { return res.status(200).json({ raw: responseText }); }
    } catch (error) {
        console.error('FormCheck API error:', error);
        return res.status(500).json({ error: 'Failed to analyze form' });
    }
}
