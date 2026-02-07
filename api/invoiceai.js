// InvoiceAI — Receipt/Invoice Data Extraction via Gemini Vision
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, image, mimeType, description, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'extract') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert accountant and data extraction specialist. Analyze the receipt, invoice, or bill photo and extract all data. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "documentType": "receipt|invoice|bill|statement|other",
  "vendor": {
    "name": "Business name",
    "address": "Full address if visible",
    "phone": "Phone if visible",
    "website": "Website if visible"
  },
  "date": "YYYY-MM-DD",
  "time": "HH:MM if visible",
  "invoiceNumber": "Invoice/receipt number if visible",
  "paymentMethod": "cash|credit card|debit card|other",
  "currency": "USD",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 9.99,
      "total": 9.99,
      "category": "food|transport|office|utilities|entertainment|healthcare|clothing|electronics|services|other"
    }
  ],
  "subtotal": 29.97,
  "tax": 2.40,
  "taxRate": "8%",
  "tip": 0,
  "total": 32.37,
  "expenseCategory": "meals|travel|office supplies|utilities|entertainment|medical|groceries|shopping|subscription|other",
  "businessExpense": true,
  "deductible": "Potentially deductible as business meal expense",
  "notes": "Any additional observations about the receipt",
  "confidence": "high|medium|low",
  "warnings": ["Any issues with readability or missing data"]
}

Rules:
- Additional context: ${description || 'See uploaded image'}
- Extract EVERY line item visible
- Calculate totals if they're not clearly shown
- Categorize each item and the overall expense
- Flag if it could be a business/tax deductible expense
- If text is partially unreadable, note it in warnings
- Use the currency symbol visible on the receipt
- Return ONLY valid JSON`;

            const parts = [{ text: 'Extract all data from this receipt/invoice. Identify every line item, totals, vendor info, and categorize the expense.' }];
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: image
                    }
                });
            }
            if (description) {
                parts[0].text += ` Additional context: ${description}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert accountant. The user extracted data from a receipt/invoice and has follow-up questions about categorization, tax deductions, expense tracking, or the data. Give specific, helpful advice. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous extraction: ${context.slice(0, 50000)}` }] });
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
        console.error('InvoiceAI API error:', error);
        return res.status(500).json({ error: 'Failed to extract data' });
    }
}
