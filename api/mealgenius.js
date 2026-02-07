// MealGenius — Photo fridge, AI generates meals from ingredients via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, dietary, servings, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!image && !description) return res.status(400).json({ error: 'Image or ingredient list is required' });

            systemInstruction = `You are a creative chef and meal planner. Look at the photo of a fridge/pantry/ingredients (or read the ingredient list) and suggest meals that can be made with what's available. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "ingredientsFound": [
    { "name": "Ingredient name", "category": "protein|vegetable|fruit|dairy|grain|condiment|other", "freshness": "fresh|good|use soon|expired" }
  ],
  "meals": [
    {
      "name": "Meal name",
      "type": "breakfast|lunch|dinner|snack|dessert",
      "difficulty": "easy|medium|advanced",
      "prepTime": "15 min",
      "cookTime": "20 min",
      "servings": ${servings || 2},
      "ingredientsUsed": ["ingredient1", "ingredient2"],
      "ingredientsMissing": ["optional ingredient you might not have"],
      "instructions": [
        { "step": 1, "action": "Step description", "tip": "Helpful tip or null" }
      ],
      "nutrition": {
        "calories": 450,
        "protein": "25g",
        "carbs": "40g",
        "fat": "18g"
      },
      "tags": ["quick", "healthy", "comfort food"]
    }
  ],
  "shoppingList": [
    { "item": "Item to buy", "reason": "Which meals it's for" }
  ],
  "storageTips": [
    "Tip about storing the ingredients you have"
  ],
  "wasteReduction": [
    "Tip to use up ingredients before they go bad"
  ]
}

Rules:
- Additional context: ${description || 'See uploaded image'}
- Dietary preferences: ${dietary || 'none specified'}
- Servings: ${servings || 2}
- Suggest 3-5 meals ranging from quick/easy to more involved
- Prioritize ingredients that need to be used soon
- Be creative but realistic — don't assume exotic ingredients
- Include estimated nutrition per serving
- Shopping list should only include things that would significantly improve the meals
- Return ONLY valid JSON`;

            const parts = [{ text: 'Look at these ingredients and suggest meals I can make with them.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Available ingredients: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a creative chef. The user generated meal ideas from their ingredients and has follow-up questions. Give specific, helpful cooking advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous meal suggestions: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.7,
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
        console.error('MealGenius API error:', error);
        return res.status(500).json({ error: 'Failed to generate meals' });
    }
}
