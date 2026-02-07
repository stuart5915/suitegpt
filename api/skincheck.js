// SkinCheck — Photo skin concern, AI analyzes and provides dermatology insights
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, concern, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an AI dermatology assistant trained to analyze skin concerns from photos and descriptions. You provide educational information about potential skin conditions. You are NOT a doctor and cannot diagnose conditions.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "conditionDetected": "Most likely condition name",
  "confidence": "low|medium|high",
  "category": "Acne|Rash|Mole|Dryness|Irritation|Infection|Pigmentation|Other",
  "urgencyLevel": "routine|soon|urgent",
  "description": "Plain-language explanation of what this might be",
  "possibleConditions": [
    {
      "name": "Condition name",
      "likelihood": "high|medium|low",
      "description": "What it is and why it matches",
      "commonCauses": ["cause1", "cause2"]
    }
  ],
  "characteristics": {
    "appearance": { "observation": "What it looks like", "significance": "What this means" },
    "color": { "observation": "Color description", "significance": "What this suggests" },
    "texture": { "observation": "Texture description", "significance": "What this indicates" },
    "pattern": { "observation": "Distribution/pattern", "significance": "What this tells us" },
    "size": { "observation": "Size estimate", "significance": "Relevance to condition" }
  },
  "homeRemedies": [
    { "remedy": "What to try", "howTo": "How to do it", "timeline": "When to expect results" }
  ],
  "whenToSeeDoctor": [
    { "sign": "Warning sign", "reason": "Why this matters", "urgency": "routine|soon|urgent" }
  ],
  "skinCareTips": [
    { "tip": "Preventive tip", "why": "Why this helps" }
  ],
  "avoidList": [
    { "item": "What to avoid", "reason": "Why to avoid it" }
  ],
  "similarConditions": [
    { "name": "Similar condition", "howToDifferentiate": "Key differences" }
  ],
  "disclaimer": "This is AI-generated educational information, NOT a medical diagnosis. Always consult a board-certified dermatologist for proper diagnosis and treatment. If you notice rapid changes, bleeding, or pain, seek medical attention promptly."
}

Rules:
- Concern type: ${concern || 'auto-detect from image'}
- Description: ${description || 'See image'}
- NEVER claim to diagnose — use language like "this may be", "this appears similar to", "consistent with"
- Always recommend seeing a dermatologist for definitive diagnosis
- Prioritize safety — flag urgent signs prominently
- Be informative but cautious
- Include home remedies only for minor, common conditions
- Return ONLY valid JSON`;

            const parts = [{ text: `Analyze this skin concern. Identify possible conditions, provide educational information, and recommend when to see a doctor.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (description) {
                parts[0].text += ` Additional context from user: ${description}`;
            }
            if (concern) {
                parts[0].text += ` Concern type: ${concern}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an AI dermatology education assistant. The user received a skin analysis and has follow-up questions about skin conditions, treatments, prevention, or skincare. Be informative but always note you cannot replace a dermatologist visit. Use markdown formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Skin analysis context: ${context.slice(0, 50000)}` }] });
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
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.3, maxOutputTokens: 8192 } })
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
        console.error('SkinCheck API error:', error);
        return res.status(500).json({ error: 'Failed to analyze skin concern' });
    }
}
