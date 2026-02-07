// ReviewResponder API - Customer review response generation via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, reviews, businessName, businessType, tone, question, history } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'respond') {
            if (!reviews || !reviews.length) return res.status(400).json({ error: 'At least one review is required' });

            systemInstruction = `You are an expert at writing professional responses to customer reviews for businesses. Generate thoughtful, personalized responses for each review. Return a JSON object with this structure:
{
  "responses": [
    {
      "reviewIndex": 0,
      "sentiment": "positive|negative|mixed",
      "rating": 4,
      "response": "The full response text",
      "tone": "The tone used",
      "tips": "One specific tip for this situation"
    }
  ],
  "overallTips": ["General tip for managing reviews", "Another tip"]
}

Rules:
- Business name: ${businessName || 'our business'}
- Business type: ${businessType || 'business'}
- Desired tone: ${tone || 'professional and warm'}
- For POSITIVE reviews: Thank them specifically for what they mentioned, reinforce the positive experience, invite them back
- For NEGATIVE reviews: Apologize sincerely, acknowledge their specific concern, offer to make it right (without being defensive), provide a way to follow up offline
- For MIXED reviews: Thank for positives, address negatives constructively
- Never be defensive or argumentative
- Personalize each response — reference specific details from the review
- Keep responses 2-4 sentences for positive, 3-5 sentences for negative
- Never use generic templates — each response should feel unique
- Return ONLY valid JSON, no markdown fences`;

            const reviewText = reviews.map((r, i) => `Review ${i + 1}${r.rating ? ` (${r.rating}/5 stars)` : ''}${r.platform ? ` [${r.platform}]` : ''}:\n${r.text}`).join('\n\n');
            contents = [{ parts: [{ text: `Write responses for these customer reviews:\n\n${reviewText}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert in online reputation management and customer review strategy. Help the business owner with their review-related questions. Be specific and actionable. Business: ${businessName || 'their business'} (${businessType || 'general business'}).`;

            const messages = [];
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
                temperature: mode === 'respond' ? 0.6 : 0.7,
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
        console.error('ReviewResponder API error:', error);
        return res.status(500).json({ error: 'Failed to generate responses' });
    }
}
