// PetHealth AI — Pet Symptom Analyzer via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, petType, breed, age, weight, symptoms, duration, behavior, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!symptoms) return res.status(400).json({ error: 'Symptoms are required' });

            systemInstruction = `You are a knowledgeable veterinary health advisor. Analyze pet symptoms and return ONLY valid JSON (no markdown fences) with this structure:
{
  "urgencyLevel": "low|moderate|high|emergency",
  "urgencyLabel": "Monitor at Home|Schedule Vet Visit|See Vet Soon|Emergency — Go Now",
  "summary": "2-3 sentence overview of what might be happening",
  "possibleCauses": [
    {
      "condition": "Condition name",
      "likelihood": "Common|Possible|Less Likely",
      "description": "Brief explanation of the condition and why it matches the symptoms",
      "signsToWatch": "What specific signs would confirm or rule this out"
    }
  ],
  "immediateActions": [
    "What the owner should do right now — step 1",
    "Step 2",
    "Step 3"
  ],
  "homeRemedies": [
    {
      "remedy": "Safe home care tip",
      "details": "How to do it and why it helps"
    }
  ],
  "dietAdvice": "Any dietary changes or restrictions during this time",
  "warningSignals": [
    "Symptom that means go to the vet immediately",
    "Another red flag to watch for"
  ],
  "preventionTips": [
    "How to prevent this in the future"
  ],
  "disclaimer": "This is AI-generated guidance, not a veterinary diagnosis. Always consult a licensed veterinarian for your pet's health concerns."
}

Rules:
- Pet type: ${petType || 'dog'}
- Breed: ${breed || 'unknown'}
- Age: ${age || 'unknown'}
- Weight: ${weight || 'unknown'}
${duration ? `- Symptom duration: ${duration}` : ''}
${behavior ? `- Behavior changes: ${behavior}` : ''}
- Symptoms: ${symptoms}
- Provide 3-5 possible causes ranked by likelihood
- Be specific to the pet type and breed when relevant
- Include breed-specific considerations if applicable
- Urgency should be honest — don't over-alarm but don't understate emergencies
- Home remedies must be SAFE for the specific animal type
- Always include warning signals that warrant immediate vet attention
- Be empathetic — pet owners are worried
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Analyze the pet symptoms based on the information provided.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a knowledgeable veterinary health advisor. The user has a pet with health concerns and wants more guidance. Give specific, practical advice while always recommending professional vet care for serious issues. Be empathetic and reassuring. Use markdown for formatting. Always include a brief disclaimer that this is not a substitute for veterinary care.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Pet health analysis: ${context.slice(0, 50000)}` }] });
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
        console.error('PetHealth API error:', error);
        return res.status(500).json({ error: 'Failed to analyze symptoms' });
    }
}
