// CompetitorSpy — Describe business/paste URL, AI analyzes competitive landscape
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, business, industry, competitors, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!business) return res.status(400).json({ error: 'Business description is required' });

            systemInstruction = `You are an expert business strategist and competitive intelligence analyst. Analyze a business and its competitive landscape. Provide actionable insights based on publicly available information and industry knowledge.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "businessSummary": {
    "name": "Business name",
    "industry": "${industry || 'General'}",
    "positioning": "How the business is positioned",
    "targetMarket": "Who they serve",
    "uniqueValueProp": "What makes them unique"
  },
  "competitors": [
    {
      "name": "Competitor name",
      "website": "URL if known",
      "size": "startup|small|medium|large|enterprise",
      "positioning": "How they position themselves",
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "pricing": "Pricing model/range if known",
      "keyDifferentiator": "What sets them apart",
      "threatLevel": "high|medium|low"
    }
  ],
  "competitiveMatrix": {
    "dimensions": ["Price", "Features", "UX", "Support", "Market Share"],
    "ratings": {
      "Your Business": [3, 4, 4, 3, 2],
      "Competitor 1": [4, 3, 3, 4, 5]
    }
  },
  "swot": {
    "strengths": ["Internal strength"],
    "weaknesses": ["Internal weakness"],
    "opportunities": ["External opportunity"],
    "threats": ["External threat"]
  },
  "marketGaps": [
    { "gap": "Unserved need", "opportunity": "How to exploit it", "difficulty": "easy|medium|hard" }
  ],
  "strategies": [
    { "strategy": "Competitive strategy", "type": "pricing|product|marketing|positioning", "impact": "high|medium", "timeframe": "short|medium|long" }
  ],
  "pricingAnalysis": {
    "marketRange": "Low — High",
    "yourPosition": "Where you sit",
    "recommendation": "Pricing strategy recommendation"
  },
  "keyTakeaways": [
    "Most important insight"
  ]
}

Rules:
- Business: ${business}
- Industry: ${industry || 'auto-detect'}
- Known competitors: ${competitors || 'identify automatically'}
- Identify 4-6 relevant competitors
- Be specific with strengths/weaknesses — no generic advice
- Rate competitive matrix on 1-5 scale
- Focus on actionable strategies
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Analyze the competitive landscape for: ${business}. Industry: ${industry || 'auto-detect'}. ${competitors ? 'Known competitors: ' + competitors : 'Identify key competitors automatically.'}`}] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert business strategist. The user analyzed their competitive landscape and has questions about strategy, positioning, pricing, or specific competitors. Provide actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Competitive analysis: ${context.slice(0, 50000)}` }] });
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
                    generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (mode === 'qa') return res.status(200).json({ answer: responseText });

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            return res.status(200).json(JSON.parse(cleaned));
        } catch (parseError) {
            return res.status(200).json({ raw: responseText });
        }

    } catch (error) {
        console.error('CompetitorSpy API error:', error);
        return res.status(500).json({ error: 'Failed to analyze competitors' });
    }
}
