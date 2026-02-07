// MockupAI — Describe your app/website, AI generates wireframe mockups with SVG
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, description, appType, style, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!description) return res.status(400).json({ error: 'Description is required' });

            systemInstruction = `You are an expert UI/UX designer specializing in wireframes and mockups. Generate detailed wireframe mockups as SVG code for app and website ideas.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "projectName": "Descriptive project name",
  "projectType": "mobile-app|web-app|landing-page|dashboard|e-commerce",
  "screens": [
    {
      "name": "Screen name (e.g., Home, Login, Dashboard)",
      "description": "What this screen does",
      "svg": "<svg viewBox='0 0 375 812' xmlns='http://www.w3.org/2000/svg'>...wireframe SVG code...</svg>",
      "components": ["List of UI components used"],
      "userFlow": "How user gets to/from this screen"
    }
  ],
  "colorScheme": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "suggestion": "Why these colors work"
  },
  "typography": {
    "headingFont": "Font suggestion for headings",
    "bodyFont": "Font suggestion for body",
    "reasoning": "Why these fonts"
  },
  "designPrinciples": [
    { "principle": "Design principle used", "application": "How it's applied" }
  ],
  "userFlowDiagram": "Text description of the main user flow through screens",
  "improvementSuggestions": [
    { "area": "What to improve", "suggestion": "How to improve it", "impact": "high|medium|low" }
  ]
}

SVG Guidelines:
- App type: ${appType || 'auto-detect'}
- Style: ${style || 'modern minimal'}
- For mobile: use viewBox='0 0 375 812' (iPhone proportions)
- For web/dashboard: use viewBox='0 0 1200 800'
- For landing page: use viewBox='0 0 1200 900'
- Use wireframe style: #f8f9fa backgrounds, #dee2e6 for containers, #6c757d for text placeholders, #0d6efd for primary actions
- Include realistic placeholder text (not lorem ipsum)
- Show navigation bars, buttons, cards, forms, icons as simple shapes
- Use rect for containers, text for labels, circle for avatars/icons
- Make SVGs detailed with proper spacing and hierarchy
- Generate 3-4 key screens
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Design wireframe mockups for this app/website idea: ${description}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert UI/UX designer. The user generated wireframe mockups and has follow-up questions about design, layout, user experience, or implementation. Be specific and provide actionable advice. Use markdown.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Mockup context: ${context.slice(0, 50000)}` }] });
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
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.9, maxOutputTokens: 8192 } })
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
        console.error('MockupAI API error:', error);
        return res.status(500).json({ error: 'Failed to generate mockups' });
    }
}
