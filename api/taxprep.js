// TaxPrep — Upload tax docs/receipts, AI extracts deductions and estimates
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, text, image, mimeType, filingStatus, income, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!text && !image) return res.status(400).json({ error: 'Tax info or document image is required' });

            systemInstruction = `You are an expert tax preparation assistant (US taxes). Analyze tax documents, receipts, W-2s, 1099s, and financial information to identify deductions, estimate taxes, and provide filing guidance. You are NOT a CPA — always recommend professional review.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "documentType": "W-2|1099|Receipt|Tax Summary|Other",
  "taxYear": "2025",
  "filingStatus": "${filingStatus || 'single'}",
  "income": {
    "gross": 0,
    "w2": 0,
    "selfEmployment": 0,
    "investments": 0,
    "other": 0,
    "total": 0
  },
  "deductions": [
    {
      "category": "Business Expenses|Medical|Charitable|Education|Home Office|etc.",
      "item": "Specific deduction",
      "amount": 0,
      "type": "above-the-line|itemized|credit",
      "confidence": "high|medium|low",
      "documentation": "What records you need"
    }
  ],
  "standardVsItemized": {
    "standardDeduction": 14600,
    "itemizedTotal": 0,
    "recommendation": "standard|itemized",
    "savings": 0
  },
  "taxEstimate": {
    "taxableIncome": 0,
    "federalTax": 0,
    "effectiveRate": "X%",
    "marginalBracket": "X%",
    "selfEmploymentTax": 0,
    "totalTax": 0,
    "withheld": 0,
    "estimatedRefund": 0
  },
  "credits": [
    { "credit": "Credit name", "amount": 0, "eligible": true, "reason": "Why eligible/not" }
  ],
  "filingTips": [
    "Actionable tip for this tax situation"
  ],
  "deadlines": [
    { "date": "Date", "description": "What's due" }
  ],
  "missingInfo": [
    "Information needed for a complete analysis"
  ],
  "disclaimer": "This is an estimate for educational purposes. Consult a licensed CPA or tax professional for filing."
}

Rules:
- Filing status: ${filingStatus || 'single'}
- Reported income: ${income || 'see documents'}
- Use current US tax brackets and standard deduction amounts
- Identify ALL possible deductions from the provided info
- Flag uncertain deductions with low confidence
- Be conservative with estimates
- ALWAYS include disclaimer
- Return ONLY valid JSON`;

            const parts = [{ text: `Analyze this tax information and identify deductions, estimate taxes, and provide filing guidance.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (text) {
                parts[0].text += ` Tax information: ${text}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert tax preparation assistant. The user analyzed tax documents and has questions. Help with deduction strategies, filing tips, or clarify tax concepts. Always note you're not a CPA and recommend professional review for actual filing. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Tax analysis: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.2,
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
        console.error('TaxPrep API error:', error);
        return res.status(500).json({ error: 'Failed to analyze tax info' });
    }
}
