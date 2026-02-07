// SocialPost AI API - Social media content generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, business, tone, platforms, pillars, days, question, history } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!business) return res.status(400).json({ error: 'Business description is required' });

            const platformList = (platforms && platforms.length > 0) ? platforms.join(', ') : 'Twitter, Instagram, LinkedIn';
            const pillarList = (pillars && pillars.length > 0) ? pillars.join(', ') : 'educational, promotional, behind-the-scenes, engagement';
            const numDays = days || 7;

            systemInstruction = `You are an expert social media strategist and content creator. Generate a ${numDays}-day social media content calendar. Return a JSON object with exactly this structure:
{
  "strategy": "2-3 sentence content strategy overview",
  "contentPillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
  "calendar": [
    {
      "day": 1,
      "dayLabel": "Monday",
      "theme": "Content theme for the day",
      "posts": {
        "twitter": { "text": "Tweet text under 280 chars", "hashtags": ["tag1", "tag2"], "bestTime": "9:00 AM" },
        "instagram": { "caption": "Instagram caption with emojis", "hashtags": ["tag1", "tag2", "tag3"], "contentIdea": "Photo/reel/carousel idea", "bestTime": "12:00 PM" },
        "linkedin": { "text": "Professional LinkedIn post", "hashtags": ["tag1"], "bestTime": "8:00 AM" },
        "facebook": { "text": "Facebook post text", "contentIdea": "Link/photo/video idea", "bestTime": "10:00 AM" }
      }
    }
  ],
  "tips": ["Pro tip 1 for this specific business", "Pro tip 2", "Pro tip 3"],
  "hashtagStrategy": {
    "branded": ["#YourBrand hashtags"],
    "industry": ["Industry-specific hashtags"],
    "trending": ["Trending/popular hashtags to use"]
  }
}

Rules:
- Generate posts for exactly ${numDays} days (starting Monday)
- Only include platforms: ${platformList}
- Omit platform keys not in the list
- Content pillars to follow: ${pillarList}
- Tone: ${tone || 'professional but approachable'}
- Mix content types: educational, promotional (max 20%), engagement, storytelling, behind-the-scenes
- Twitter: under 280 characters, punchy
- Instagram: longer captions with line breaks, 5-10 relevant hashtags
- LinkedIn: professional, thought-leadership style, 1-3 hashtags
- Facebook: conversational, question-based for engagement
- Include specific content ideas (not just text)
- Vary the style day to day — don't be repetitive
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Create a ${numDays}-day social media content calendar for:\n\n${business.slice(0, 50000)}` }] }];

        } else if (mode === 'qa') {
            if (!business) return res.status(400).json({ error: 'Business context required' });
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert social media strategist. The user has shared their business details and you generated a content calendar. Help them refine posts, suggest new content ideas, or provide social media strategy advice. Be specific and actionable.`;

            const messages = [{ parts: [{ text: `Business context:\n\n${business.slice(0, 50000)}` }] }];
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
                temperature: mode === 'generate' ? 0.8 : 0.7,
                maxOutputTokens: 8192
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
        console.error('SocialPost API error:', error);
        return res.status(500).json({ error: 'Failed to generate social posts' });
    }
}
