// LogoForge — Describe brand, AI generates logo concepts with SVG code
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, brandName, industry, style, colorPreference, description, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!brandName) return res.status(400).json({ error: 'Brand name is required' });

            systemInstruction = `You are an expert brand designer and logo creator. Generate creative, professional logo concepts. For each concept, provide actual SVG code that can be rendered directly in a browser.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "brandAnalysis": {
    "personality": "Brand personality traits",
    "targetAudience": "Who this brand appeals to",
    "moodKeywords": ["keyword1", "keyword2"]
  },
  "concepts": [
    {
      "id": 1,
      "name": "Concept name",
      "description": "Why this concept works for the brand",
      "style": "modern|classic|playful|minimal|bold|geometric|organic",
      "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'>...</svg>",
      "colorPalette": [
        { "hex": "#XXXXXX", "name": "Color name", "usage": "Primary/Secondary/Accent" }
      ],
      "fontSuggestion": {
        "primary": "Font name for headings",
        "secondary": "Font name for body text",
        "style": "Why these fonts work"
      },
      "useCases": ["Website header", "Business card", "Social media avatar"]
    }
  ],
  "typography": {
    "recommended": ["Font 1", "Font 2", "Font 3"],
    "avoid": ["Font to avoid"],
    "reasoning": "Why these fonts match the brand"
  },
  "brandGuidelines": {
    "dosAndDonts": ["Do: use consistent colors", "Don't: stretch the logo"],
    "minimumSize": "Recommended minimum display size",
    "spacing": "Clear space recommendations"
  }
}

Rules:
- Brand: ${brandName}
- Industry: ${industry || 'General'}
- Style preference: ${style || 'modern'}
- Color preference: ${colorPreference || 'auto'}
- Description: ${description || 'No additional details'}
- Generate exactly 4 logo concepts with different approaches
- SVG must be valid, self-contained, and use viewBox="0 0 200 200"
- SVGs should be creative — use shapes, paths, gradients, text elements
- Include the brand name or initials in at least 2 of the SVGs
- Each concept should have a distinct visual approach (icon-based, lettermark, abstract, combination)
- Color palettes should be cohesive and professional
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Create 4 logo concepts for: ${brandName}. ${description || ''} Industry: ${industry || 'General'}. Style: ${style || 'modern'}. Color preference: ${colorPreference || 'let the AI decide based on brand personality'}.` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert brand designer. The user generated logo concepts and has questions about branding, design refinements, or wants variations. Help them refine their brand identity. Use markdown for formatting. If they ask for SVG modifications, provide the updated SVG code in a code block.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous logo concepts: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.9,
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
        console.error('LogoForge API error:', error);
        return res.status(500).json({ error: 'Failed to generate logos' });
    }
}
