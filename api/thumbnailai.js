// ThumbnailAI — Describe video, AI generates thumbnail concepts with layouts
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, title, description, platform, style, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!title && !description) return res.status(400).json({ error: 'Title or description is required' });

            systemInstruction = `You are an expert YouTube thumbnail designer and visual marketing specialist. Generate creative, click-worthy thumbnail concepts. For each concept, provide an SVG layout that shows the composition, text placement, and visual elements.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "videoAnalysis": {
    "topic": "What the video is about",
    "targetEmotion": "The emotion to trigger (curiosity, shock, excitement, etc.)",
    "clickTrigger": "What makes someone click"
  },
  "thumbnails": [
    {
      "id": 1,
      "name": "Concept name",
      "description": "Why this concept works — the psychology behind it",
      "layout": "face-left|center-text|split|dramatic|minimal|comparison",
      "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180' width='320' height='180'>...</svg>",
      "textOverlay": {
        "headline": "Big text on the thumbnail",
        "subtext": "Optional smaller text"
      },
      "colorScheme": {
        "background": "#XXXXXX",
        "textColor": "#XXXXXX",
        "accent": "#XXXXXX"
      },
      "elements": ["Person reaction", "Arrow pointing", "Bold text", "Before/after split"],
      "ctr_prediction": "high|medium",
      "platform_fit": "YouTube|TikTok|Instagram"
    }
  ],
  "bestPractices": [
    "Tip for this type of content"
  ],
  "textRules": {
    "maxWords": 5,
    "fontStyle": "Bold sans-serif, outlined",
    "placement": "Top-right or center"
  },
  "avoidList": [
    "Things that hurt CTR for this niche"
  ]
}

Rules:
- Video title: ${title || 'Not provided'}
- Description: ${description || 'Not provided'}
- Platform: ${platform || 'YouTube'}
- Style: ${style || 'attention-grabbing'}
- Generate exactly 4 thumbnail concepts
- SVG should be 320x180 (16:9 ratio) and show layout/composition
- Include bold text overlays, color blocks, face/emoji placeholders, arrows
- SVGs should be visually distinct — different compositions and color schemes
- Think about thumbnail psychology: curiosity gap, contrast, emotional faces, numbers
- Make text BIG and readable even at small sizes (max 4-5 words)
- Use high-contrast colors that pop
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Create 4 thumbnail concepts for: "${title || ''}". ${description || ''} Platform: ${platform || 'YouTube'}. Style: ${style || 'attention-grabbing'}.` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert thumbnail designer and YouTube growth specialist. The user generated thumbnail concepts and has questions about design, CTR optimization, or wants variations. Help them create click-worthy thumbnails. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous thumbnail concepts: ${context.slice(0, 50000)}` }] });
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
        console.error('ThumbnailAI API error:', error);
        return res.status(500).json({ error: 'Failed to generate thumbnails' });
    }
}
