// SymptomMap — AI Symptom Analyzer via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, symptoms, age, sex, duration, medicalHistory, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!symptoms) return res.status(400).json({ error: 'Symptoms are required' });

            systemInstruction = `You are a medical information assistant (NOT a doctor). Analyze symptoms and return ONLY valid JSON (no markdown fences) with this structure:
{
  "urgencyLevel": "low|moderate|high|emergency",
  "urgencyExplanation": "Brief explanation of why this urgency level",
  "possibleCauses": [
    {
      "name": "Condition name",
      "likelihood": "likely|possible|less likely",
      "description": "Brief explanation of this condition",
      "keySymptoms": ["symptom that matches", "another match"],
      "typicalDuration": "How long this usually lasts",
      "whenToWorry": "When this becomes serious"
    }
  ],
  "immediateActions": ["What to do right now", "Another action"],
  "homeRemedies": ["Safe home remedy 1", "Another remedy"],
  "redFlags": ["Symptom that means go to ER immediately", "Another red flag"],
  "questionsForDoctor": ["Question to ask if you see a doctor", "Another question"],
  "lifestyleFactors": ["Relevant lifestyle consideration", "Another factor"],
  "disclaimer": "This is informational only — not medical advice. Always consult a healthcare professional for diagnosis and treatment."
}

Rules:
- Symptoms described: ${symptoms}
- Patient age: ${age || 'not specified'}
- Patient sex: ${sex || 'not specified'}
- Duration: ${duration || 'not specified'}
- Medical history: ${medicalHistory || 'none provided'}
- List 3-6 possible causes ranked by likelihood
- ALWAYS include a disclaimer that this is NOT medical advice
- For ANY potentially serious symptoms, set urgency to high or emergency
- Be thorough but not alarmist — provide balanced information
- Include red flags that warrant immediate medical attention
- Suggest practical questions to ask a doctor
- Temperature 0.4 for medical accuracy
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Analyze the symptoms and provide possible causes with urgency assessment.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a medical information assistant (NOT a doctor). The user received a symptom analysis and has follow-up questions. Provide helpful, balanced medical information. Always remind users to consult a healthcare professional for actual diagnosis. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's symptom analysis: ${context.slice(0, 50000)}` }] });
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
        console.error('SymptomMap API error:', error);
        return res.status(500).json({ error: 'Failed to analyze symptoms' });
    }
}
