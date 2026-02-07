// NewsletterAI — AI Email Newsletter Generator via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, topic, audience, tone, format, frequency, brandName, cta, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!topic) return res.status(400).json({ error: 'Topic is required' });

            systemInstruction = `You are an expert email marketing strategist and newsletter writer. Generate a complete email newsletter and return ONLY valid JSON (no markdown fences) with this structure:
{
  "subjectLine": "Compelling email subject line",
  "previewText": "Preview text that shows in inbox (under 90 chars)",
  "subjectAlts": ["Alt subject line 1", "Alt subject line 2"],
  "newsletter": {
    "greeting": "Opening greeting",
    "hook": "Attention-grabbing opening paragraph (2-3 sentences)",
    "sections": [
      {
        "heading": "Section heading",
        "body": "Section content (2-4 paragraphs). Use engaging prose, not bullet lists. Include specific examples, data, or stories where relevant.",
        "callout": "Optional pull-quote or key stat to highlight (or null)"
      }
    ],
    "cta": {
      "text": "Call-to-action text",
      "buttonText": "CTA button label",
      "context": "Brief sentence before the CTA"
    },
    "closing": "Sign-off paragraph",
    "psLine": "P.S. line (engaging afterthought or bonus tip)"
  },
  "metrics": {
    "wordCount": 650,
    "readTime": "3 min",
    "sections": 3
  },
  "sendingTips": [
    "Best time to send this type of newsletter",
    "Subject line A/B test suggestion",
    "Segmentation tip"
  ],
  "nextIssueIdeas": ["Follow-up topic 1", "Topic 2", "Topic 3"]
}

Rules:
- Topic/theme: ${topic}
- Target audience: ${audience || 'general subscribers'}
- Tone: ${tone || 'professional but friendly'}
- Format: ${format || 'educational / value-driven'}
${brandName ? `- Brand/sender name: ${brandName}` : ''}
${cta ? `- Desired CTA: ${cta}` : ''}
- Frequency context: ${frequency || 'weekly'}
- Write in a conversational, engaging style — not corporate speak
- Include 2-4 content sections with clear headings
- Each section should provide genuine value (insights, tips, stories)
- Subject line should drive opens (curiosity, benefit, or urgency)
- Include a clear CTA that ties to the content
- P.S. line should feel natural and add value
- Target 500-800 words for the full newsletter
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: 'Generate the email newsletter based on the specifications.' }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert email marketing strategist. The user generated a newsletter and has questions about improving it, email strategy, or growing their list. Give specific, actionable advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `User's newsletter: ${context.slice(0, 50000)}` }] });
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
        console.error('NewsletterAI API error:', error);
        return res.status(500).json({ error: 'Failed to generate newsletter' });
    }
}
