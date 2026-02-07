// PitchDeck AI — AI Pitch Deck Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, business, industry, stage, askAmount, audience, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!business) return res.status(400).json({ error: 'Business description is required' });

            systemInstruction = `You are an elite startup advisor and pitch deck strategist who has helped raise billions in funding. Generate a complete pitch deck and return ONLY valid JSON (no markdown fences) with this structure:
{
  "deckTitle": "Company Name — Pitch Deck",
  "subtitle": "One-line company description",
  "slideCount": 12,
  "slides": [
    {
      "slideNumber": 1,
      "type": "title",
      "title": "Company Name",
      "subtitle": "Tagline or one-liner",
      "speakerNotes": "How to present this slide (2-3 sentences)",
      "bullets": [],
      "dataPoint": null
    },
    {
      "slideNumber": 2,
      "type": "problem",
      "title": "The Problem",
      "subtitle": "Why this matters",
      "bullets": ["Problem point 1 with specific data", "Problem point 2", "Problem point 3"],
      "speakerNotes": "How to present this slide",
      "dataPoint": { "stat": "$4.2B", "label": "Market pain point quantified" }
    },
    {
      "slideNumber": 3,
      "type": "solution",
      "title": "Our Solution",
      "subtitle": "How we solve it",
      "bullets": ["Solution aspect 1", "Solution aspect 2", "Solution aspect 3"],
      "speakerNotes": "Presentation guidance",
      "dataPoint": null
    }
  ],
  "presentationTips": [
    "Tip for delivering the pitch",
    "Timing suggestion",
    "Common mistake to avoid"
  ],
  "anticipatedQuestions": [
    { "question": "Investor question 1", "suggestedAnswer": "How to answer" },
    { "question": "Investor question 2", "suggestedAnswer": "How to answer" },
    { "question": "Investor question 3", "suggestedAnswer": "How to answer" }
  ]
}

Required slides (10-14 slides total):
1. Title Slide — company name, tagline, optional founding date
2. Problem — the pain point with data
3. Solution — how you solve it
4. Market Size — TAM, SAM, SOM with numbers
5. Product — key features and demo points
6. Business Model — how you make money
7. Traction — metrics, growth, milestones
8. Competition — competitive landscape/advantages
9. Go-to-Market — growth strategy
10. Team — key team members and why they're right
11. Financials — projections, unit economics
12. The Ask — funding amount, use of funds, timeline

Rules:
- Business: ${business}
- Industry: ${industry || 'technology'}
- Stage: ${stage || 'seed'}
- Ask amount: ${askAmount || 'not specified'}
- Audience: ${audience || 'VC investors'}
- Each slide must have a clear title, 2-4 bullet points, and speaker notes
- Include realistic-looking data points and metrics where appropriate
- Bullets should be concise (under 15 words each)
- Speaker notes should guide delivery (tone, emphasis, timing)
- Tailor language to the funding stage
- Make financial projections realistic for the stage
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the complete pitch deck based on the business description.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert startup advisor and pitch coach. The user generated a pitch deck and has questions about improving it, preparing for investor meetings, or refining their story. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's pitch deck: ${context.slice(0, 50000)}` }] });
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
        console.error('PitchDeck API error:', error);
        return res.status(500).json({ error: 'Failed to generate pitch deck' });
    }
}
