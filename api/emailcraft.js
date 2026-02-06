// EmailCraft API - Professional email generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, situation, tone, recipient, context, emailText, instruction } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!situation) return res.status(400).json({ error: 'Situation description is required' });

            systemInstruction = `You are an expert email writer who crafts clear, professional, and effective emails. Return a JSON object with exactly this structure:
{
  "subject": "Email subject line",
  "body": "Full email body with proper greeting, paragraphs, and sign-off",
  "alternateSubjects": ["Alternative subject 1", "Alternative subject 2"],
  "tips": ["Tip about this email", "Another tip"]
}

Rules:
- Write in the specified tone: ${tone || 'professional'}
- Recipient context: ${recipient || 'colleague'}
- Keep it concise but complete — no fluff, every sentence earns its place
- Use proper email structure: greeting, body paragraphs, call to action, sign-off
- Sign off with [Your Name] as placeholder
- alternateSubjects: 2 alternative subject lines with different angles
- tips: 2-3 brief tips specific to this type of email (timing, follow-up, etc.)
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Write a ${tone || 'professional'} email for this situation:\n\n${situation}${context ? '\n\nAdditional context: ' + context : ''}` }] }];

        } else if (mode === 'refine') {
            if (!emailText || !instruction) return res.status(400).json({ error: 'Email text and instruction are required' });

            systemInstruction = `You are an expert email editor. Refine the given email based on the user's instruction. Return a JSON object:
{
  "subject": "Updated subject line (or same if not changing)",
  "body": "The refined email body",
  "changes": ["What changed 1", "What changed 2"]
}
Return ONLY valid JSON, no markdown fences.`;

            contents = [{ parts: [{ text: `Original email:\n${emailText}\n\nInstruction: ${instruction}` }] }];

        } else if (mode === 'reply') {
            if (!emailText) return res.status(400).json({ error: 'Original email is required' });

            systemInstruction = `You are an expert email writer. Write a reply to the given email. Return a JSON object:
{
  "subject": "Re: [original subject or inferred subject]",
  "body": "Full reply email with greeting, body, sign-off",
  "tips": ["Tip 1", "Tip 2"]
}
- Tone: ${tone || 'professional'}
- Context from user: ${situation || 'none provided'}
- Return ONLY valid JSON, no markdown fences`;

            contents = [{ parts: [{ text: `Write a ${tone || 'professional'} reply to this email:\n\n${emailText}${situation ? '\n\nContext for reply: ' + situation : ''}` }] }];

        } else {
            return res.status(400).json({ error: 'Invalid mode. Use "generate", "refine", or "reply"' });
        }

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.6, maxOutputTokens: 4096 }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(200).json({ subject: '', body: responseText, tips: [] });
        }

    } catch (error) {
        console.error('EmailCraft API error:', error);
        return res.status(500).json({ error: 'Failed to generate email' });
    }
}
