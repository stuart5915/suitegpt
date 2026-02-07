// CopyWriter AI API - Marketing copy generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, product, tone, audience, format, instruction, draft, history } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!product) return res.status(400).json({ error: 'Product/service description is required' });

            systemInstruction = `You are an elite marketing copywriter with 20 years of experience at top agencies. Generate compelling marketing copy and return a JSON object with exactly this structure:
{
  "headline": "One powerful headline for the product/service",
  "tagline": "Short memorable tagline (under 10 words)",
  "adCopy": {
    "google": ["3 Google ad variations (headline + description, 90 chars each)"],
    "facebook": ["3 Facebook/Instagram ad copy variations (2-3 sentences each)"],
    "linkedin": ["2 LinkedIn ad variations (professional tone)"]
  },
  "landingPage": {
    "hero": "Hero section headline + subheadline",
    "benefits": ["4-6 benefit statements with icons"],
    "cta": "Call-to-action button text + supporting line"
  },
  "socialPosts": {
    "twitter": ["3 tweet-length posts (under 280 chars)"],
    "instagram": ["2 Instagram caption variations with hashtags"],
    "linkedin": ["2 LinkedIn post variations"]
  },
  "emailSubjects": ["5 email subject line variations"],
  "elevatorPitch": "30-second elevator pitch (3-4 sentences)"
}

Rules:
- Tone: ${tone || 'professional'}
- Target audience: ${audience || 'general'}
- Use proven copywriting frameworks (AIDA, PAS, BAB) naturally
- Headlines should be benefit-driven, not feature-driven
- Include power words and emotional triggers
- Each variation should take a different angle
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Create marketing copy for:\n\n${product.slice(0, 50000)}` }] }];

        } else if (mode === 'refine') {
            if (!draft || !instruction) return res.status(400).json({ error: 'Draft and instruction required for refine mode' });

            systemInstruction = `You are an elite marketing copywriter. The user has marketing copy they want refined. Apply their specific instruction and return the improved version. Return a JSON object:
{
  "refined": "The refined/improved copy",
  "changes": ["What you changed and why", ...]
}
Return ONLY valid JSON, no markdown fences.`;

            contents = [{ parts: [{ text: `Original copy:\n${draft}\n\nInstruction: ${instruction}` }] }];

        } else if (mode === 'single') {
            if (!product) return res.status(400).json({ error: 'Product description is required' });

            const formatPrompts = {
                'google-ad': 'Write 5 Google Search ad variations. Each should have a headline (max 30 chars) and two description lines (max 90 chars each). Return as JSON: { "ads": [{ "headline": "", "desc1": "", "desc2": "" }] }',
                'facebook-ad': 'Write 5 Facebook/Instagram ad copy variations. Each 2-4 sentences, compelling hook + CTA. Return as JSON: { "ads": ["copy1", "copy2", ...] }',
                'landing-hero': 'Write 5 landing page hero section variations. Each with headline, subheadline, CTA button text. Return as JSON: { "heroes": [{ "headline": "", "subheadline": "", "cta": "" }] }',
                'email-subject': 'Write 10 email subject line variations using different approaches (curiosity, urgency, benefit, question, etc). Return as JSON: { "subjects": ["subject1", ...] }',
                'social-post': 'Write 8 social media posts: 3 for Twitter (under 280 chars), 3 for Instagram (with hashtags), 2 for LinkedIn (professional). Return as JSON: { "twitter": [], "instagram": [], "linkedin": [] }',
                'product-desc': 'Write 3 product description variations: short (50 words), medium (100 words), long (200 words). Return as JSON: { "short": "", "medium": "", "long": "" }',
                'tagline': 'Write 10 tagline/slogan variations. Mix styles: witty, emotional, bold, minimalist. Return as JSON: { "taglines": ["tagline1", ...] }'
            };

            systemInstruction = `You are an elite marketing copywriter. ${formatPrompts[format] || formatPrompts['social-post']}
Tone: ${tone || 'professional'}. Target audience: ${audience || 'general'}.
Return ONLY valid JSON, no markdown fences.`;

            contents = [{ parts: [{ text: `Product/service:\n\n${product.slice(0, 50000)}` }] }];

        } else if (mode === 'qa') {
            if (!product) return res.status(400).json({ error: 'Product description is required for qa mode' });
            const question = req.body.question;
            if (!question) return res.status(400).json({ error: 'Question is required for qa mode' });

            systemInstruction = `You are an expert marketing copywriter and strategist. The user has shared their product/service details and wants specific marketing advice. Give clear, actionable guidance with examples.`;

            const messages = [{ parts: [{ text: `Product/service:\n\n${product.slice(0, 50000)}` }] }];
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
                temperature: mode === 'qa' ? 0.7 : 0.8,
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
        console.error('CopyWriter API error:', error);
        return res.status(500).json({ error: 'Failed to generate copy' });
    }
}
