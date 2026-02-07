// GymPlan AI API - Personalized workout programs via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, goal, level, daysPerWeek, equipment, duration, limitations, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!goal) return res.status(400).json({ error: 'Fitness goal is required' });

            systemInstruction = `You are a certified personal trainer and strength coach with 15+ years of experience. Generate a complete workout program and return ONLY valid JSON (no markdown fences) with this structure:
{
  "programName": "Catchy program name",
  "overview": "2-3 sentence description of the program's approach",
  "goal": "${goal}",
  "level": "${level || 'intermediate'}",
  "daysPerWeek": ${daysPerWeek || 4},
  "programDuration": "${duration || '4 weeks'}",
  "warmup": {
    "duration": "5-10 min",
    "exercises": ["Exercise 1 — 30 sec", "Exercise 2 — 30 sec"]
  },
  "days": [
    {
      "day": "Day 1",
      "name": "Upper Body Push",
      "focus": "Chest, Shoulders, Triceps",
      "estimatedTime": "45-55 min",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 4,
          "reps": "8-10",
          "rest": "90 sec",
          "notes": "Brief form tip or tempo instruction",
          "muscleGroup": "Primary muscle targeted"
        }
      ]
    }
  ],
  "cooldown": {
    "duration": "5 min",
    "exercises": ["Stretch 1 — 30 sec each side", "Stretch 2 — 30 sec"]
  },
  "progressionPlan": [
    "Week 1-2: Focus on form, use moderate weight",
    "Week 3-4: Increase weight by 5-10%"
  ],
  "tips": ["Recovery tip", "Nutrition tip", "Form tip"]
}

Rules:
- Goal: ${goal}
- Experience level: ${level || 'intermediate'} (beginner=simple compound movements, intermediate=mix of compound+isolation, advanced=periodization+advanced techniques)
- Training days per week: ${daysPerWeek || 4}
- Equipment available: ${equipment || 'full gym'}
- Session duration target: ${duration || '45-60 minutes'}
- Limitations/injuries: ${limitations || 'none'}
- Each day should have 5-8 exercises
- Include proper warm-up and cool-down
- Exercises must match available equipment
- If beginner: focus on compound movements, lighter volume
- If advanced: include supersets, drop sets, or tempo variations
- Progression plan should span 4 weeks
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the workout program based on the specifications in your instructions.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a certified personal trainer. The user generated a workout program and has follow-up questions. Give specific, actionable advice about form, alternatives, progression, or modifications. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's workout program: ${context.slice(0, 50000)}` }] });
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
                        temperature: mode === 'generate' ? 0.6 : 0.7,
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
        console.error('GymPlan API error:', error);
        return res.status(500).json({ error: 'Failed to generate workout plan' });
    }
}
