// ProductDescriptor — Photo product, AI generates listing descriptions via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, platform, tone, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert e-commerce copywriter and product marketing specialist. Analyze the product photo or description and generate compelling listing copy for multiple platforms. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "productIdentified": "What the product is",
  "category": "Electronics|Clothing|Home|Beauty|Sports|Food|Toys|Books|Other",
  "keyFeatures": [
    "Feature or selling point identified from the image"
  ],
  "listings": {
    "amazon": {
      "title": "SEO-optimized Amazon product title (under 200 chars)",
      "bulletPoints": [
        "Key feature bullet point with benefit"
      ],
      "description": "Full product description paragraph (150-300 words)"
    },
    "ebay": {
      "title": "eBay listing title (under 80 chars)",
      "description": "eBay item description (conversational, detail-focused)"
    },
    "etsy": {
      "title": "Etsy listing title (creative, keyword-rich)",
      "description": "Etsy description (story-driven, artisan feel)"
    },
    "shopify": {
      "title": "Clean product title",
      "description": "Shopify product description (brand-forward, lifestyle-focused)"
    },
    "social": {
      "instagram": "Instagram caption with hashtags (engaging, visual)",
      "facebook": "Facebook Marketplace description (casual, informative)",
      "tiktok": "TikTok product caption (trendy, short, with hooks)"
    }
  },
  "seoKeywords": ["keyword1", "keyword2", "keyword3"],
  "pricingSuggestion": {
    "low": "$XX",
    "mid": "$XX",
    "high": "$XX",
    "reasoning": "Why this price range"
  },
  "targetAudience": "Who would buy this",
  "sellingTips": [
    "Tip for selling this product effectively"
  ]
}

Rules:
- Additional context: ${description || 'See uploaded image'}
- Platform focus: ${platform || 'all platforms'}
- Tone: ${tone || 'professional but engaging'}
- Make each platform listing unique — don't just copy/paste
- Amazon: keyword-rich, benefit-driven, scannable bullets
- eBay: detailed specs, condition-focused, trustworthy
- Etsy: story-driven, artisan/handmade feel, emotional
- Shopify: brand-forward, lifestyle imagery in words
- Social: platform-native voice, hashtags where appropriate
- Include 8-12 SEO keywords
- Price suggestion based on similar products in the market
- Return ONLY valid JSON`;

            const parts = [{ text: 'Analyze this product and generate compelling listing descriptions for multiple e-commerce platforms.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Product details: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert e-commerce copywriter. The user generated product listings and has follow-up questions. Help them refine copy, adjust tone, target different audiences, or optimize for specific platforms. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous listings: ${context.slice(0, 50000)}` }] });
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
        console.error('ProductDescriptor API error:', error);
        return res.status(500).json({ error: 'Failed to generate descriptions' });
    }
}
