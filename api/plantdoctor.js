// PlantDoctor — AI Plant Diagnosis via Gemini Vision
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

        if (mode === 'diagnose') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert botanist and plant pathologist. Analyze the plant photo or description and return ONLY valid JSON (no markdown fences) with this structure:
{
  "plantIdentified": "Common name (Scientific name)",
  "confidence": "high|medium|low",
  "healthStatus": "healthy|minor issues|moderate issues|severe issues|critical",
  "healthScore": 85,
  "diagnosis": [
    {
      "issue": "Issue name",
      "severity": "mild|moderate|severe",
      "description": "What's happening to the plant",
      "cause": "Most likely cause",
      "likelihood": "high|medium|low"
    }
  ],
  "immediateActions": [
    "Urgent step to take right now"
  ],
  "treatmentPlan": [
    {
      "step": 1,
      "action": "What to do",
      "details": "How to do it",
      "timeline": "When to do it"
    }
  ],
  "careGuide": {
    "water": "Watering instructions",
    "light": "Light requirements",
    "soil": "Soil preferences",
    "temperature": "Ideal temperature range",
    "humidity": "Humidity needs",
    "fertilizer": "Feeding schedule"
  },
  "preventionTips": [
    "How to prevent this in the future"
  ],
  "funFacts": [
    "Interesting fact about this plant"
  ],
  "commonProblems": [
    {
      "problem": "Common issue for this species",
      "signs": "What to look for",
      "fix": "How to fix it"
    }
  ]
}

Rules:
- Description: ${description || 'See uploaded image'}
- If healthy, still provide full care guide and common problems to watch for
- Be specific about watering amounts, light hours, soil pH where relevant
- Include both organic and chemical treatment options
- Be encouraging — most plant problems are fixable
- Return ONLY valid JSON`;

            const parts = [{ text: 'Diagnose this plant — identify it, assess its health, and provide care guidance.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Additional context: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert botanist. The user diagnosed a plant and has follow-up questions. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous diagnosis: ${context.slice(0, 50000)}` }] });
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
        console.error('PlantDoctor API error:', error);
        return res.status(500).json({ error: 'Failed to diagnose plant' });
    }
}
