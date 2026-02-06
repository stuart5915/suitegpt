// ContractReader API - Contract/lease analysis via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, text, question, history } = req.body;

    if (!text) return res.status(400).json({ error: 'Document text is required' });
    if (!mode) return res.status(400).json({ error: 'Mode is required (analyze or qa)' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            systemInstruction = `You are an expert contract and legal document analyst. Analyze the provided contract, lease, or legal agreement and return a JSON object with exactly this structure:
{
  "summary": "A clear 2-3 paragraph plain-English overview of what this contract covers, who the parties are, and the key terms",
  "redFlags": ["Red flag 1", "Red flag 2", ...],
  "obligations": ["Obligation 1", "Obligation 2", ...],
  "keyDates": ["Date/deadline 1", "Date/deadline 2", ...],
  "financialTerms": ["Financial term 1", "Financial term 2", ...]
}

Rules:
- summary: Explain the contract in plain English as if to someone with no legal background. Identify the parties, the purpose, and the most important terms.
- redFlags: Identify clauses that could be problematic, unusual, or disadvantageous. Look for: auto-renewal traps, penalty clauses, liability waivers, non-compete restrictions, unilateral amendment rights, arbitration clauses, hidden fees, unfavorable termination terms. If none found, return an empty array.
- obligations: List what each party is required to do. Be specific about who owes what to whom.
- keyDates: Extract all deadlines, renewal dates, notice periods, effective dates, and expiration dates. If none found, return an empty array.
- financialTerms: Extract all payment amounts, fees, deposits, penalties, rate increases, and financial obligations.
- Return ONLY valid JSON, no markdown fences, no extra text
- Be thorough but concise — each item should be one clear sentence`;

            contents = [{ parts: [{ text: `Analyze this contract/legal document:\n\n${text.slice(0, 500000)}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required for qa mode' });

            systemInstruction = `You are an expert contract analyst answering questions about a legal document. Give clear, specific answers in plain English. Reference relevant clauses or sections when possible. If something is ambiguous or could be interpreted multiple ways, say so. Always note if a clause could be problematic for the user. If the answer is not in the document, say so clearly.`;

            const messages = [{ parts: [{ text: `Contract/Legal Document:\n\n${text.slice(0, 500000)}` }] }];

            if (history && history.length > 0) {
                for (const msg of history) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }

            messages.push({ parts: [{ text: question }] });
            contents = messages;

        } else {
            return res.status(400).json({ error: 'Invalid mode. Use "analyze" or "qa"' });
        }

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'analyze' ? 0.2 : 0.5,
                maxOutputTokens: mode === 'analyze' ? 8192 : 4096
            }
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

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        }

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (mode === 'analyze') {
            try {
                const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return res.status(200).json({
                    summary: parsed.summary || '',
                    redFlags: parsed.redFlags || [],
                    obligations: parsed.obligations || [],
                    keyDates: parsed.keyDates || [],
                    financialTerms: parsed.financialTerms || []
                });
            } catch (parseError) {
                return res.status(200).json({
                    summary: responseText,
                    redFlags: [],
                    obligations: [],
                    keyDates: [],
                    financialTerms: []
                });
            }
        } else {
            return res.status(200).json({ answer: responseText });
        }

    } catch (error) {
        console.error('ContractReader API error:', error);
        return res.status(500).json({ error: 'Failed to analyze document' });
    }
}
