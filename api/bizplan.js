// BizPlan AI API - Business plan generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, answers, question, history } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!answers) return res.status(400).json({ error: 'Business answers are required' });

            systemInstruction = `You are a top-tier business consultant and startup advisor. Generate a comprehensive business plan based on the provided answers. Return a JSON object with exactly this structure:
{
  "companyName": "Suggested or provided company name",
  "tagline": "One-line business tagline",
  "executiveSummary": "3-4 paragraph executive summary covering the opportunity, solution, target market, and competitive advantage",
  "problemStatement": "Clear articulation of the problem being solved (2-3 paragraphs)",
  "solution": "How this business solves the problem, unique value proposition (2-3 paragraphs)",
  "targetMarket": {
    "overview": "Description of target market",
    "segments": [
      { "name": "Segment name", "description": "Who they are", "size": "Estimated size", "priority": "Primary/Secondary" }
    ],
    "tam": "Total addressable market estimate",
    "sam": "Serviceable addressable market",
    "som": "Serviceable obtainable market (realistic year 1-2)"
  },
  "competitiveAnalysis": {
    "overview": "Competitive landscape summary",
    "competitors": [
      { "name": "Competitor", "strengths": "Their strengths", "weaknesses": "Their weaknesses", "differentiation": "How you're different" }
    ],
    "moat": "Your competitive moat / defensibility"
  },
  "revenueModel": {
    "overview": "How the business makes money",
    "streams": [
      { "name": "Revenue stream", "description": "How it works", "pricing": "Pricing structure" }
    ],
    "projections": {
      "year1": "Revenue estimate with assumptions",
      "year2": "Revenue estimate",
      "year3": "Revenue estimate"
    }
  },
  "marketingStrategy": {
    "positioning": "Brand positioning statement",
    "channels": [
      { "channel": "Marketing channel", "strategy": "How to use it", "budget": "Estimated budget %" }
    ],
    "launchPlan": "Go-to-market strategy for first 90 days"
  },
  "operations": {
    "team": "Key roles needed and when to hire",
    "technology": "Tech stack and infrastructure needs",
    "milestones": [
      { "timeframe": "Month X-Y", "milestone": "What to accomplish" }
    ]
  },
  "financials": {
    "startupCosts": "Estimated startup costs breakdown",
    "monthlyBurn": "Estimated monthly operating costs",
    "breakeven": "Estimated breakeven timeline",
    "fundingNeeded": "How much funding needed and what for"
  },
  "risks": [
    { "risk": "Risk description", "mitigation": "How to mitigate" }
  ],
  "nextSteps": ["Immediate action item 1", "Action item 2", "Action item 3"]
}

Rules:
- Be specific and actionable, not generic
- Use realistic numbers and estimates based on the industry
- Identify real competitors in the space
- Financial projections should include assumptions
- Marketing channels should be specific to the business type
- Return ONLY valid JSON, no markdown fences`;

            const prompt = Object.entries(answers)
                .map(([key, val]) => `${key}: ${val}`)
                .join('\n');

            contents = [{ parts: [{ text: `Generate a business plan based on these details:\n\n${prompt}` }] }];

        } else if (mode === 'qa') {
            if (!answers) return res.status(400).json({ error: 'Business context is required' });
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are a top-tier business consultant. The user has shared their business idea and you generated a business plan. Help them refine it, answer questions, and provide deeper analysis on specific sections. Be specific and actionable.`;

            const context = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n');
            const messages = [{ parts: [{ text: `Business context:\n\n${context}` }] }];
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

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'generate' ? 0.4 : 0.7,
                maxOutputTokens: mode === 'generate' ? 8192 : 4096
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'qa') {
            return res.status(200).json({ answer: responseText });
        }

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(200).json({ raw: responseText });
        }

    } catch (error) {
        console.error('BizPlan API error:', error);
        return res.status(500).json({ error: 'Failed to generate business plan' });
    }
}
