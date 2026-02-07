// NutriScan — AI Food Photo Analyzer via Gemini Vision
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

            systemInstruction = `You are an expert nutritionist and food analyst. Analyze the food in the image (or description) and return ONLY valid JSON (no markdown fences) with this structure:
{
  "mealName": "Name of the dish/meal",
  "mealDescription": "Brief description of what you see",
  "totalCalories": 650,
  "macros": {
    "protein": { "grams": 35, "percentage": 22, "rating": "good|low|high" },
    "carbs": { "grams": 70, "percentage": 43, "rating": "good|low|high" },
    "fat": { "grams": 25, "percentage": 35, "rating": "good|low|high" },
    "fiber": { "grams": 8, "percentage": null, "rating": "good|low|high" }
  },
  "items": [
    {
      "name": "Food item name",
      "portion": "Estimated portion size",
      "calories": 250,
      "protein": 15,
      "carbs": 30,
      "fat": 8
    }
  ],
  "micronutrients": [
    { "name": "Vitamin C", "amount": "45mg", "dailyValue": "50%", "source": "from the tomatoes" }
  ],
  "healthScore": 7,
  "healthNotes": "Brief assessment of nutritional balance",
  "suggestions": [
    "How to make this meal healthier",
    "What's missing nutritionally",
    "Portion adjustment tip"
  ],
  "dietCompatibility": {
    "keto": { "compatible": false, "reason": "Too many carbs from rice" },
    "vegan": { "compatible": false, "reason": "Contains chicken" },
    "glutenFree": { "compatible": true, "reason": "No gluten-containing ingredients" },
    "dairyFree": { "compatible": true, "reason": "No dairy detected" }
  },
  "mealTiming": "Best consumed as lunch or post-workout meal"
}

Rules:
- Identify ALL food items visible in the image
- Estimate portions based on visual cues (plate size, utensils for scale)
- Provide realistic calorie and macro estimates — don't guess too high or low
- Health score is 1-10 (10 = perfectly balanced meal)
- Include 3-5 micronutrients that are notable in this meal
- Suggestions should be practical and specific
- If image is unclear, make best estimates and note uncertainty
- Return ONLY valid JSON`;

            const parts = [{ text: 'Analyze the nutritional content of this food.' }];
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

            systemInstruction = `You are an expert nutritionist. The user analyzed a meal and has follow-up questions about nutrition, calories, diet compatibility, or healthier alternatives. Give specific, evidence-based advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's meal analysis: ${context.slice(0, 50000)}` }] });
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
        console.error('NutriScan API error:', error);
        return res.status(500).json({ error: 'Failed to analyze food' });
    }
}
