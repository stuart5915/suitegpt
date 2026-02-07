// StoryForge — AI Story Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, premise, genre, length, tone, audience, characters, setting, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!premise) return res.status(400).json({ error: 'Premise is required' });

            systemInstruction = `You are a masterful storyteller and creative writing expert. Generate a complete story and return ONLY valid JSON (no markdown fences) with this structure:
{
  "title": "Compelling story title",
  "genre": "${genre || 'general fiction'}",
  "hookLine": "One gripping opening hook sentence that pulls readers in",
  "story": "The full story text. Use proper paragraphs separated by \\n\\n. Include vivid descriptions, dialogue (in quotes), and a satisfying arc. Make it engaging and well-paced.",
  "wordCount": 1500,
  "characters": [
    { "name": "Character Name", "role": "Protagonist/Antagonist/Supporting", "description": "Brief character summary" }
  ],
  "themes": ["Theme 1", "Theme 2", "Theme 3"],
  "writingNotes": "Brief note on the narrative choices, style, and techniques used",
  "continuePrompt": "A hook or question that could lead to a sequel or continuation"
}

Rules:
- Premise: ${premise}
- Genre: ${genre || 'general fiction'}
- Target length: ${length || 'medium (1000-2000 words)'}
- Tone: ${tone || 'engaging'}
- Target audience: ${audience || 'general adult'}
${characters ? `- Key characters to include: ${characters}` : ''}
${setting ? `- Setting: ${setting}` : ''}
- Write vivid, immersive prose with strong sensory details
- Include natural dialogue where appropriate
- Build tension and deliver a satisfying resolution
- Use varied sentence structure and pacing
- Show, don't tell — use actions and details over exposition
- The story must have a clear beginning, middle, and end
- Match the tone and style to the genre
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Write the story based on the specifications.' }] }];

        } else if (mode === 'continue') {
            if (!context) return res.status(400).json({ error: 'Story context is required' });

            systemInstruction = `You are a masterful storyteller. The user has a story and wants you to continue it. Write the next section that naturally continues the narrative. Return ONLY valid JSON (no markdown fences):
{
  "continuation": "The next section of the story. Use proper paragraphs separated by \\n\\n. Maintain the same voice, tone, and style as the original.",
  "wordCount": 800,
  "writingNotes": "Brief note on where the story is heading"
}

Rules:
- Maintain consistent voice, characters, and tone
- Advance the plot meaningfully
- Keep the same writing quality and style
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Original story:\n${context.slice(0, 50000)}\n\nContinue this story naturally.` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert creative writing coach. The user generated a story and has questions about improving it, analyzing it, or getting writing advice. Give specific, constructive feedback. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's story: ${context.slice(0, 50000)}` }] });
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
        console.error('StoryForge API error:', error);
        return res.status(500).json({ error: 'Failed to generate story' });
    }
}
