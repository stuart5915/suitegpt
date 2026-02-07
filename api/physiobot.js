// PhysioBot — AI Rehab & Physical Therapy Plan via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, injury, bodyArea, painLevel, duration, activityLevel, goals, age, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!injury) return res.status(400).json({ error: 'Injury/pain description is required' });

            systemInstruction = `You are an expert physical therapist and rehabilitation specialist. Generate a rehab plan and return ONLY valid JSON (no markdown fences) with this structure:
{
  "planName": "Personalized rehab plan title",
  "assessment": "2-3 sentence assessment of the condition based on symptoms described",
  "severity": "mild|moderate|severe",
  "severityNote": "Brief explanation of severity and what it means",
  "seeDoctor": true/false,
  "doctorNote": "When/why they should see a doctor (if applicable)",
  "phases": [
    {
      "phase": 1,
      "name": "Phase name (e.g. Pain Management & Mobility)",
      "duration": "Week 1-2",
      "goal": "What this phase aims to achieve",
      "exercises": [
        {
          "name": "Exercise name",
          "targetArea": "Muscle/joint targeted",
          "instructions": "Step-by-step how to perform the exercise (2-3 sentences)",
          "sets": "3",
          "reps": "10-12",
          "holdTime": "30 seconds (if applicable, otherwise null)",
          "frequency": "2x daily",
          "difficulty": "beginner|intermediate|advanced",
          "tip": "Form tip or common mistake to avoid"
        }
      ]
    }
  ],
  "dailyRoutine": {
    "morning": ["Activity 1", "Activity 2"],
    "afternoon": ["Activity 1"],
    "evening": ["Activity 1", "Activity 2"]
  },
  "doList": ["Safe activity 1", "Safe activity 2", "Safe activity 3"],
  "dontList": ["Avoid this 1", "Avoid this 2", "Avoid this 3"],
  "iceOrHeat": "Specific guidance on when to use ice vs heat",
  "progressionSigns": ["Sign you're ready to advance 1", "Sign 2"],
  "warningSignals": ["Stop and see doctor if 1", "Red flag 2"],
  "timelineEstimate": "Expected recovery timeline",
  "disclaimer": "This is AI-generated guidance, not medical advice. Consult a licensed physical therapist or physician before starting any rehabilitation program."
}

Rules:
- Injury/pain: ${injury}
- Body area: ${bodyArea || 'not specified'}
- Pain level (1-10): ${painLevel || 'not specified'}
- Duration of symptoms: ${duration || 'not specified'}
- Activity level: ${activityLevel || 'moderately active'}
- Goals: ${goals || 'pain relief and return to normal activity'}
- Age: ${age || 'adult'}
- Create 2-3 phases of progressive rehabilitation
- Each phase should have 4-6 exercises
- Start with gentle exercises and progress to more challenging ones
- Include specific sets, reps, hold times, and frequency
- Be specific about form and common mistakes
- Include both strengthening and mobility exercises
- Recommend ice vs heat appropriately
- Include clear warning signs to stop exercising
- Always recommend seeing a doctor for severe or worsening symptoms
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the rehabilitation plan based on the information provided.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert physical therapist. The user has a rehab plan and wants more guidance about their recovery, exercises, or pain management. Give specific, practical advice. Always recommend seeing a professional for worsening symptoms. Use markdown for formatting. Include a brief disclaimer.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's rehab plan: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.4,
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
        console.error('PhysioBot API error:', error);
        return res.status(500).json({ error: 'Failed to generate rehab plan' });
    }
}
