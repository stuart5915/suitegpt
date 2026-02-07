// PhotoRestore — Upload old/damaged photo, AI analyzes and provides restoration guidance
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

        if (mode === 'analyze') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert photo restoration and enhancement specialist. Analyze old, damaged, or low-quality photos and provide detailed restoration guidance. You understand photo aging, damage types, color correction, and digital restoration techniques.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "photoAssessment": {
    "era": "Estimated decade/era the photo was taken",
    "originalFormat": "Estimated original format (daguerreotype, tintype, film, Polaroid, digital, etc.)",
    "condition": "poor|fair|good",
    "conditionScore": 65
  },
  "damageDetected": [
    {
      "type": "Damage type (scratches, fading, water damage, tears, foxing, discoloration, etc.)",
      "severity": "minor|moderate|severe",
      "location": "Where on the image",
      "restorable": true,
      "difficulty": "easy|moderate|hard"
    }
  ],
  "colorAnalysis": {
    "currentState": "Description of current color state (faded sepia, yellowed, color-shifted, etc.)",
    "originalColors": "Best guess at original colors",
    "corrections": [
      { "adjustment": "What to adjust", "direction": "How to adjust", "amount": "Subtle/moderate/significant" }
    ]
  },
  "restorationSteps": [
    {
      "step": 1,
      "title": "Step name",
      "description": "Detailed instructions",
      "tool": "Recommended software/tool",
      "difficulty": "beginner|intermediate|advanced",
      "timeEstimate": "Estimated time"
    }
  ],
  "enhancementTips": [
    {
      "tip": "Enhancement suggestion",
      "impact": "What it improves",
      "priority": "high|medium|low"
    }
  ],
  "softwareRecommendations": [
    {
      "name": "Software name",
      "type": "free|paid|freemium",
      "bestFor": "What it excels at",
      "skillLevel": "beginner|intermediate|advanced"
    }
  ],
  "aiToolRecommendations": [
    {
      "name": "AI tool name",
      "capability": "What it can do",
      "bestFor": "When to use it"
    }
  ],
  "preservationTips": [
    { "tip": "How to preserve the original", "why": "Why this matters" }
  ],
  "overallPlan": "A 2-3 sentence summary of the recommended restoration approach"
}

Rules:
- Additional context: ${description || 'See image'}
- Score condition 0-100
- Be specific about damage locations and types
- Recommend both free and paid tools
- Include AI-powered restoration tools
- Order restoration steps logically (clean first, then repair, then enhance)
- Consider the photo's era when recommending color corrections
- Return ONLY valid JSON`;

            const parts = [{ text: `Analyze this photo for restoration. Identify damage, assess condition, and provide step-by-step restoration guidance.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (description) {
                parts[0].text += ` Additional context: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert photo restoration specialist. The user analyzed a photo and has follow-up questions about restoration techniques, software, or preservation. Be specific and helpful. Use markdown formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Photo analysis context: ${context.slice(0, 50000)}` }] });
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
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } })
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
        console.error('PhotoRestore API error:', error);
        return res.status(500).json({ error: 'Failed to analyze photo' });
    }
}
