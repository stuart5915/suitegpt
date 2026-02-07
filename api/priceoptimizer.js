// PriceOptimizer — Describe product/service, AI suggests optimal pricing
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, product, currentPrice, targetMarket, businessModel, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!product) return res.status(400).json({ error: 'Product description is required' });

            systemInstruction = `You are an expert pricing strategist and behavioral economist. Analyze a product/service and recommend optimal pricing based on market dynamics, psychology, and value perception.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "productAnalysis": {
    "name": "Product/service name",
    "category": "Category",
    "valueProposition": "Core value offered",
    "targetCustomer": "Ideal customer profile",
    "costStructure": "Estimated cost considerations"
  },
  "pricingRecommendation": {
    "optimal": { "price": "$XX", "reasoning": "Why this is optimal" },
    "budget": { "price": "$XX", "reasoning": "For price-sensitive customers" },
    "premium": { "price": "$XX", "reasoning": "For value-focused customers" }
  },
  "pricingStrategies": [
    {
      "strategy": "Strategy name",
      "description": "How it works",
      "example": "Specific implementation for this product",
      "pros": ["Advantage"],
      "cons": ["Disadvantage"],
      "bestFor": "When to use this"
    }
  ],
  "psychologicalPricing": [
    { "technique": "Charm pricing", "example": "$9.99 instead of $10", "impact": "5-8% increase in conversions", "applicable": true }
  ],
  "tierStructure": {
    "recommended": true,
    "tiers": [
      { "name": "Tier name", "price": "$XX/mo", "features": ["Feature 1", "Feature 2"], "targetCustomer": "Who this tier serves", "margin": "estimated %" }
    ]
  },
  "competitorPricing": [
    { "competitor": "Name", "price": "$XX", "positioning": "How they position", "comparison": "How you compare" }
  ],
  "revenueProjection": {
    "conservative": { "monthly": "$XX", "annual": "$XX", "assumptions": "100 customers" },
    "moderate": { "monthly": "$XX", "annual": "$XX", "assumptions": "250 customers" },
    "aggressive": { "monthly": "$XX", "annual": "$XX", "assumptions": "500 customers" }
  },
  "discountStrategy": {
    "recommended": ["Annual billing (20% off)", "First month free trial"],
    "avoid": ["Deep discounts that devalue the product"],
    "timing": "When to run promotions"
  },
  "keyInsights": [
    "Most important pricing insight for this product"
  ]
}

Rules:
- Product: ${product}
- Current price: ${currentPrice || 'not set yet'}
- Target market: ${targetMarket || 'general'}
- Business model: ${businessModel || 'auto-detect'}
- Be specific with dollar amounts, not ranges
- Consider psychological pricing principles
- Include competitor context
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Analyze pricing for: ${product}. Current price: ${currentPrice || 'not set'}. Market: ${targetMarket || 'general'}. Model: ${businessModel || 'auto-detect'}.` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });
            systemInstruction = `You are an expert pricing strategist. Help the user refine their pricing strategy with specific advice. Use markdown for formatting.`;
            const messages = [];
            if (context) messages.push({ parts: [{ text: `Pricing analysis: ${context.slice(0, 50000)}` }] });
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
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.6, maxOutputTokens: 8192 } })
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
        console.error('PriceOptimizer API error:', error);
        return res.status(500).json({ error: 'Failed to analyze pricing' });
    }
}
