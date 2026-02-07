// MealPlanner API - Weekly meal plans via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, diet, allergies, goal, people, days, preferences, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!diet && !goal) return res.status(400).json({ error: 'Diet or goal is required' });

            systemInstruction = `You are a certified nutritionist and meal planning expert. Generate a detailed weekly meal plan and return ONLY valid JSON (no markdown fences) with this structure:
{
  "planName": "Catchy name for this meal plan",
  "overview": "2-3 sentence summary of the plan's approach and benefits",
  "dailyCalories": 2000,
  "macroSplit": { "protein": "30%", "carbs": "40%", "fat": "30%" },
  "days": [
    {
      "day": "Monday",
      "meals": [
        {
          "type": "Breakfast",
          "name": "Meal name",
          "calories": 450,
          "prepTime": "15 min",
          "ingredients": ["ingredient 1", "ingredient 2"],
          "instructions": "Brief cooking instructions (2-3 sentences)",
          "macros": { "protein": "25g", "carbs": "30g", "fat": "15g" }
        }
      ],
      "dailyTotal": { "calories": 2000, "protein": "150g", "carbs": "200g", "fat": "67g" }
    }
  ],
  "groceryList": {
    "produce": ["item 1", "item 2"],
    "protein": ["item 1"],
    "dairy": ["item 1"],
    "grains": ["item 1"],
    "pantry": ["item 1"],
    "frozen": ["item 1"]
  },
  "tips": ["Meal prep tip 1", "Storage tip 2", "Budget tip 3"],
  "substitutions": [
    { "original": "ingredient", "substitute": "alternative", "reason": "Why this works" }
  ]
}

Rules:
- Diet type: ${diet || 'balanced'}
- Allergies/restrictions: ${allergies || 'none'}
- Goal: ${goal || 'general health'}
- Servings per meal: ${people || 1} person(s)
- Number of days: ${days || 7}
- Additional preferences: ${preferences || 'none'}
- Each day must have Breakfast, Lunch, Dinner, and 1-2 Snacks
- Keep meals practical — common ingredients, reasonable prep times
- Grocery list should be consolidated (no duplicates) and organized by store section
- Include variety — don't repeat the same meal twice in a week
- Calorie targets should match the stated goal
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the meal plan based on the specifications in your instructions.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a certified nutritionist. The user generated a meal plan and has follow-up questions. Give specific, actionable advice. Use markdown for formatting. Reference their specific meals when relevant.`;

            const messages = [];
            if (context) {
                messages.push({ parts: [{ text: `The user's current meal plan context: ${context.slice(0, 50000)}` }] });
            }
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
                        temperature: mode === 'generate' ? 0.7 : 0.7,
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
        console.error('MealPlanner API error:', error);
        return res.status(500).json({ error: 'Failed to generate meal plan' });
    }
}
