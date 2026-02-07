// TravelPlanner AI API - Trip itinerary generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, destination, days, budget, travelers, interests, startDate, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!destination) return res.status(400).json({ error: 'Destination is required' });

            systemInstruction = `You are an expert travel planner with deep knowledge of destinations worldwide. Generate a complete trip itinerary and return ONLY valid JSON (no markdown fences) with this structure:
{
  "tripName": "Catchy trip title",
  "destination": "${destination}",
  "overview": "2-3 sentence trip overview highlighting the experience",
  "bestTimeToVisit": "When is ideal and why",
  "estimatedBudget": {
    "total": "$2,500",
    "accommodation": "$800",
    "food": "$500",
    "activities": "$600",
    "transport": "$400",
    "misc": "$200"
  },
  "packingEssentials": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
  "days": [
    {
      "day": 1,
      "title": "Day theme/title",
      "activities": [
        {
          "time": "9:00 AM",
          "activity": "Activity name",
          "description": "What you'll do and why it's worth it (1-2 sentences)",
          "duration": "2 hours",
          "cost": "$15",
          "tip": "Insider tip for this activity"
        }
      ],
      "meals": {
        "breakfast": { "name": "Restaurant/food name", "cuisine": "Type", "priceRange": "$$", "tip": "What to order" },
        "lunch": { "name": "Restaurant name", "cuisine": "Type", "priceRange": "$$", "tip": "What to order" },
        "dinner": { "name": "Restaurant name", "cuisine": "Type", "priceRange": "$$", "tip": "What to order" }
      },
      "transport": "How to get around this day"
    }
  ],
  "localTips": ["Cultural tip 1", "Money-saving tip 2", "Safety tip 3", "Local phrase/custom 4"],
  "accommodationTips": [
    { "type": "Budget", "area": "Neighborhood name", "priceRange": "$50-80/night", "tip": "Why this area" },
    { "type": "Mid-Range", "area": "Neighborhood", "priceRange": "$100-180/night", "tip": "Why" },
    { "type": "Luxury", "area": "Neighborhood", "priceRange": "$250+/night", "tip": "Why" }
  ]
}

Rules:
- Destination: ${destination}
- Trip length: ${days || 5} days
- Budget level: ${budget || 'moderate'}
- Travelers: ${travelers || '2 adults'}
- Interests: ${interests || 'general sightseeing'}
- Start date: ${startDate || 'flexible'}
- Each day should have 3-5 activities with realistic timing
- Include specific restaurant names (real, well-known places)
- Include specific attraction names (real places)
- Budget estimates should match the budget level
- Transport tips should be practical (subway, walk, taxi, etc.)
- Local tips should include cultural etiquette and money-saving advice
- Make the itinerary flow logically (group nearby activities)
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the travel itinerary based on the specifications.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert travel advisor. The user generated a trip itinerary and has follow-up questions. Give specific, practical advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's trip plan: ${context.slice(0, 50000)}` }] });
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
        console.error('TravelPlanner API error:', error);
        return res.status(500).json({ error: 'Failed to generate itinerary' });
    }
}
