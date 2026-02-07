// SleepCoach AI API - Personalized sleep optimization via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, sleepData, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!sleepData) return res.status(400).json({ error: 'Sleep data is required' });

            systemInstruction = `You are a board-certified sleep medicine specialist and behavioral sleep coach. Analyze the user's sleep habits and return ONLY valid JSON (no markdown fences) with this structure:
{
  "sleepScore": 62,
  "scoreLabel": "Needs Improvement",
  "assessment": "2-3 sentence personalized assessment of their current sleep situation",
  "issues": [
    { "issue": "Specific sleep problem identified", "severity": "high|medium|low", "impact": "How this affects their sleep quality" }
  ],
  "eveningRoutine": {
    "startTime": "9:00 PM",
    "steps": [
      { "time": "9:00 PM", "action": "Specific action to take", "why": "Brief explanation of why this helps" }
    ]
  },
  "morningRoutine": {
    "wakeTime": "6:30 AM",
    "steps": [
      { "time": "6:30 AM", "action": "Specific morning action", "why": "Why this improves sleep long-term" }
    ]
  },
  "environment": [
    { "factor": "Temperature", "recommendation": "Set bedroom to 65-68°F (18-20°C)", "why": "Core body temperature drop triggers sleep" }
  ],
  "habits": [
    { "change": "Specific habit change", "priority": "high|medium|low", "timeline": "Start tonight|This week|Gradually over 2 weeks", "impact": "Expected improvement" }
  ],
  "supplements": [
    { "name": "Supplement name", "dosage": "Recommended amount", "timing": "When to take it", "note": "Important caveat or who should avoid it" }
  ],
  "weeklyPlan": {
    "week1": "Focus area and specific goals for week 1",
    "week2": "Week 2 progression",
    "week3": "Week 3 goals",
    "week4": "Week 4 maintenance"
  },
  "disclaimer": "This is general wellness guidance, not medical advice. Consult a healthcare provider for persistent sleep issues."
}

User's sleep profile:
- Bedtime: ${sleepData.bedtime || 'not specified'}
- Wake time: ${sleepData.wakeTime || 'not specified'}
- Hours of sleep: ${sleepData.hoursSlept || 'not specified'}
- Sleep quality (self-rated): ${sleepData.quality || 'not specified'}
- Main issues: ${sleepData.issues || 'not specified'}
- Caffeine: ${sleepData.caffeine || 'not specified'}
- Screen time before bed: ${sleepData.screenTime || 'not specified'}
- Exercise: ${sleepData.exercise || 'not specified'}
- Stress level: ${sleepData.stress || 'not specified'}
- Additional info: ${sleepData.additional || 'none'}

Rules:
- sleepScore: 0-100 (based on duration, consistency, quality, habits)
- Be specific to THEIR situation — don't give generic advice
- Evening routine should have 4-6 steps timed from their target bedtime
- Morning routine should have 3-5 steps
- Prioritize habit changes by impact (most effective first)
- Supplements should include safety notes
- Only suggest supplements with research backing
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Analyze my sleep profile and generate a personalized protocol.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a sleep medicine specialist. The user received a sleep analysis and has follow-up questions. Give specific, evidence-based advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's sleep analysis: ${context.slice(0, 50000)}` }] });
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
                        temperature: mode === 'analyze' ? 0.4 : 0.7,
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
        console.error('SleepCoach API error:', error);
        return res.status(500).json({ error: 'Failed to analyze sleep' });
    }
}
