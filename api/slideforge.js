// SlideForge — AI Presentation Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, notes, topic, slideCount, style, audience, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!notes && !topic) return res.status(400).json({ error: 'Notes or topic is required' });

            systemInstruction = `You are an expert presentation designer and storytelling strategist. Generate a complete slide deck and return ONLY valid JSON (no markdown fences) with this structure:
{
  "title": "Presentation title",
  "subtitle": "Subtitle or tagline",
  "slideCount": 12,
  "slides": [
    {
      "slideNumber": 1,
      "type": "title|agenda|content|data|quote|comparison|timeline|summary|cta|section-break",
      "title": "Slide title",
      "subtitle": "Optional subtitle (or null)",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"],
      "speakerNotes": "What to say when presenting this slide — 2-3 sentences of guidance",
      "visualSuggestion": "What image, chart, or visual would work here (e.g., 'bar chart showing growth', 'team photo', 'process diagram')",
      "transition": "How to transition to the next slide (or null for last slide)"
    }
  ],
  "designTips": [
    "Color palette suggestion",
    "Font pairing recommendation",
    "Visual style tip"
  ],
  "presentationTips": [
    "Delivery tip 1",
    "Timing suggestion",
    "Audience engagement tip"
  ],
  "estimatedDuration": "15-20 minutes",
  "outline": ["Section 1 name", "Section 2 name", "Section 3 name"]
}

Rules:
- Source material: ${notes || topic}
- Requested slide count: ${slideCount || '10-14 slides'}
- Style: ${style || 'professional'}
- Target audience: ${audience || 'general'}
- Create a logical narrative arc — opening hook, body sections, strong close
- Each slide should have 3-5 concise bullet points (not paragraphs)
- Include a title slide, agenda/overview slide, and closing/CTA slide
- Speaker notes should be conversational coaching, not scripts
- Visual suggestions should be specific and actionable
- Transitions should create natural flow between slides
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the presentation slides based on the source material.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert presentation coach. The user generated a slide deck and has questions about improving it, presenting, design, or storytelling. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's presentation: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.7,
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
        console.error('SlideForge API error:', error);
        return res.status(500).json({ error: 'Failed to generate presentation' });
    }
}
