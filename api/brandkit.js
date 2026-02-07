// BrandKit AI — AI Brand Identity Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, brandName, industry, vibe, audience, values, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!brandName) return res.status(400).json({ error: 'Brand name is required' });

            systemInstruction = `You are an elite brand strategist and designer. Generate a complete brand identity kit and return ONLY valid JSON (no markdown fences) with this structure:
{
  "brandName": "${brandName}",
  "tagline": "A memorable tagline (5-8 words)",
  "taglineAlts": ["Alt tagline 1", "Alt tagline 2"],
  "missionStatement": "One clear sentence defining the brand's purpose",
  "brandStory": "A 2-3 sentence brand origin story / narrative",
  "colorPalette": {
    "primary": { "hex": "#3B82F6", "name": "Brand Blue", "usage": "Primary buttons, headers, key elements" },
    "secondary": { "hex": "#10B981", "name": "Fresh Green", "usage": "Accents, success states, CTAs" },
    "accent": { "hex": "#F59E0B", "name": "Warm Gold", "usage": "Highlights, badges, special elements" },
    "dark": { "hex": "#1E293B", "name": "Deep Navy", "usage": "Text, dark backgrounds" },
    "light": { "hex": "#F8FAFC", "name": "Cloud White", "usage": "Backgrounds, cards" },
    "neutral": { "hex": "#94A3B8", "name": "Soft Gray", "usage": "Secondary text, borders" }
  },
  "typography": {
    "heading": { "font": "Font Name", "style": "Bold/Black", "reason": "Why this font fits the brand" },
    "body": { "font": "Font Name", "style": "Regular/Medium", "reason": "Why this font fits" },
    "accent": { "font": "Font Name", "style": "Style", "reason": "For special elements" }
  },
  "voiceAndTone": {
    "personality": ["Trait 1", "Trait 2", "Trait 3", "Trait 4"],
    "toneDescriptors": ["Descriptor 1", "Descriptor 2", "Descriptor 3"],
    "doSay": ["Example phrase 1", "Example phrase 2", "Example phrase 3"],
    "dontSay": ["Avoid this 1", "Avoid this 2", "Avoid this 3"],
    "sampleSentence": "A sample sentence written in the brand's voice"
  },
  "socialBios": {
    "twitter": "Under 160 chars bio for Twitter/X",
    "instagram": "Instagram bio with relevant emojis and line breaks (use \\n)",
    "linkedin": "Professional LinkedIn summary (2-3 sentences)",
    "tiktok": "Short punchy TikTok bio"
  },
  "visualStyle": {
    "imageStyle": "Description of photography/imagery style",
    "iconStyle": "Icon style recommendation",
    "patterns": "Pattern/texture suggestions",
    "moodWords": ["Mood word 1", "Mood word 2", "Mood word 3", "Mood word 4"]
  },
  "brandDoDont": {
    "do": ["Brand guideline 1", "Guideline 2", "Guideline 3"],
    "dont": ["Avoid this 1", "Avoid this 2", "Avoid this 3"]
  },
  "elevatorPitch": "A compelling 30-second elevator pitch for the brand"
}

Rules:
- Brand name: ${brandName}
- Industry: ${industry || 'general'}
- Vibe/personality: ${vibe || 'modern and professional'}
- Target audience: ${audience || 'general consumers'}
${values ? `- Core values: ${values}` : ''}
- Colors must be harmonious and accessible (good contrast ratios)
- Choose real, available Google Fonts for typography
- Social bios should be ready to copy-paste
- Voice guidelines should be specific and actionable
- Everything should feel cohesive and intentional
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the complete brand identity kit.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert brand strategist. The user generated a brand kit and has follow-up questions about their brand identity, marketing, or design. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's brand kit: ${context.slice(0, 50000)}` }] });
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
        console.error('BrandKit API error:', error);
        return res.status(500).json({ error: 'Failed to generate brand kit' });
    }
}
