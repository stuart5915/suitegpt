// AdCopy AI — AI Ad Copy Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, product, audience, platforms, goal, tone, keywords, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!product) return res.status(400).json({ error: 'Product description is required' });

            systemInstruction = `You are an elite advertising copywriter with expertise across all major ad platforms. Generate multiple ad copy variations and return ONLY valid JSON (no markdown fences) with this structure:
{
  "campaignName": "Catchy campaign name",
  "product": "${product.slice(0, 200)}",
  "ads": [
    {
      "platform": "Facebook/Instagram",
      "variations": [
        {
          "headline": "Attention-grabbing headline (max 40 chars for FB/Google, longer OK for others)",
          "primaryText": "Main ad copy body (platform-appropriate length)",
          "callToAction": "CTA button text",
          "description": "Optional description/link description"
        },
        {
          "headline": "Another variation",
          "primaryText": "Different angle or hook",
          "callToAction": "CTA",
          "description": "Description"
        },
        {
          "headline": "Third variation",
          "primaryText": "Yet another approach",
          "callToAction": "CTA",
          "description": "Description"
        }
      ]
    }
  ],
  "hooks": ["Attention hook 1", "Hook 2", "Hook 3", "Hook 4", "Hook 5"],
  "targetingTips": ["Audience targeting suggestion 1", "Tip 2", "Tip 3"],
  "bestPractices": ["Platform-specific tip 1", "Tip 2", "Tip 3"]
}

Rules:
- Product/service: ${product}
- Target audience: ${audience || 'general consumers'}
- Platforms: ${platforms || 'Facebook, Instagram, Google'}
- Campaign goal: ${goal || 'conversions'}
- Tone: ${tone || 'professional but engaging'}
${keywords ? `- Keywords to include: ${keywords}` : ''}
- Generate 3 variations per platform
- Each variation should use a DIFFERENT hook/angle (pain point, benefit, social proof, urgency, curiosity)
- Follow each platform's character limits and best practices:
  * Facebook: primary text ~125 chars ideal, headline ~40 chars
  * Instagram: engaging, emoji-friendly, hashtag-ready
  * Google Search: headline max 30 chars, description max 90 chars
  * Google Display: short punchy headlines
  * LinkedIn: professional tone, B2B focused
  * TikTok: casual, trend-aware, young audience
  * Twitter/X: concise, under 280 chars
- CTAs should be action-oriented and specific
- Include power words that drive clicks
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the ad copy variations based on the specifications.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert advertising strategist and copywriter. The user generated ad copy and has follow-up questions about optimizing, adjusting, or improving their ads. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's ad campaign: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.8,
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
        console.error('AdCopy API error:', error);
        return res.status(500).json({ error: 'Failed to generate ad copy' });
    }
}
