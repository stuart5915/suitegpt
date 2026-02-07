// PortfolioGPT — AI Portfolio Analyzer via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, portfolio, riskTolerance, investmentGoal, timeHorizon, age, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!portfolio) return res.status(400).json({ error: 'Portfolio description is required' });

            systemInstruction = `You are an expert financial analyst and portfolio strategist. Analyze the user's investment portfolio and return ONLY valid JSON (no markdown fences) with this structure:
{
  "riskScore": 7,
  "riskLabel": "Moderate-High",
  "riskExplanation": "Brief explanation of the overall risk profile",
  "allocation": {
    "current": [
      { "category": "US Stocks", "percentage": 60, "color": "#3b82f6" },
      { "category": "International Stocks", "percentage": 15, "color": "#8b5cf6" },
      { "category": "Bonds", "percentage": 15, "color": "#10b981" },
      { "category": "Cash", "percentage": 10, "color": "#94a3b8" }
    ],
    "suggested": [
      { "category": "US Stocks", "percentage": 45, "color": "#3b82f6" },
      { "category": "International Stocks", "percentage": 20, "color": "#8b5cf6" },
      { "category": "Bonds", "percentage": 25, "color": "#10b981" },
      { "category": "Cash", "percentage": 10, "color": "#94a3b8" }
    ]
  },
  "strengths": ["Portfolio strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Portfolio weakness 1", "Weakness 2", "Weakness 3"],
  "diversificationScore": 6,
  "diversificationNotes": "Assessment of diversification across sectors, geographies, asset classes",
  "rebalancingActions": [
    {
      "action": "Reduce|Increase|Add|Remove",
      "asset": "Asset or category name",
      "detail": "Specific recommendation with reasoning",
      "priority": "high|medium|low"
    }
  ],
  "projections": {
    "conservative": { "oneYear": "+3-5%", "fiveYear": "+15-25%", "tenYear": "+35-55%" },
    "moderate": { "oneYear": "+6-9%", "fiveYear": "+30-50%", "tenYear": "+65-100%" },
    "aggressive": { "oneYear": "+10-15%", "fiveYear": "+50-80%", "tenYear": "+100-180%" }
  },
  "sectorExposure": [
    { "sector": "Technology", "percentage": 35, "assessment": "overweight|underweight|balanced" }
  ],
  "keyRisks": ["Specific risk 1", "Risk 2", "Risk 3"],
  "taxConsiderations": ["Tax tip 1", "Tax tip 2"],
  "disclaimer": "This is for informational purposes only — not financial advice. Consult a licensed financial advisor before making investment decisions."
}

Rules:
- Portfolio: ${portfolio}
- Risk tolerance: ${riskTolerance || 'moderate'}
- Investment goal: ${investmentGoal || 'long-term growth'}
- Time horizon: ${timeHorizon || 'not specified'}
- Investor age: ${age || 'not specified'}
- Risk score is 1-10 (1=very conservative, 10=very aggressive)
- Diversification score is 1-10
- Provide realistic, balanced analysis — not overly optimistic or pessimistic
- Suggested allocation should match the stated risk tolerance and goals
- Include 3-5 specific rebalancing actions with priorities
- ALWAYS include disclaimer that this is NOT financial advice
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Analyze the investment portfolio and provide comprehensive assessment.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert financial analyst. The user received a portfolio analysis and has follow-up questions about investing, asset allocation, risk management, or market strategy. Provide specific, balanced financial information. Always remind users to consult a licensed financial advisor. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's portfolio analysis: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.5,
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
        console.error('PortfolioGPT API error:', error);
        return res.status(500).json({ error: 'Failed to analyze portfolio' });
    }
}
