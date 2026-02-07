// HomeRepair AI — Photo broken thing, AI diagnoses + fix steps via Gemini Vision
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

        if (mode === 'diagnose') {
            if (!image && !description) return res.status(400).json({ error: 'Image or description is required' });

            systemInstruction = `You are an expert handyman, contractor, and home repair specialist. Analyze the photo of the broken/damaged item or area and provide a diagnosis and repair guide. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "issueIdentified": "What the problem is",
  "item": "What's broken (e.g. leaky faucet, cracked drywall, broken door hinge)",
  "category": "Plumbing|Electrical|Drywall|Flooring|Appliance|Furniture|Exterior|HVAC|Painting|Other",
  "severity": "cosmetic|minor|moderate|major|safety hazard",
  "diyDifficulty": "beginner|intermediate|advanced|call a pro",
  "estimatedTime": "30 minutes",
  "estimatedCost": "$10-25",
  "diagnosis": "Detailed explanation of what's wrong and why it happened",
  "repairSteps": [
    {
      "step": 1,
      "action": "What to do",
      "details": "How to do it in detail",
      "tip": "Pro tip or safety note (or null)",
      "tools": ["Tool needed"]
    }
  ],
  "toolsNeeded": [
    { "tool": "Tool name", "optional": false, "approximate_cost": "$5-10" }
  ],
  "materialsNeeded": [
    { "material": "Material name", "quantity": "Amount needed", "approximate_cost": "$5-10" }
  ],
  "safetyWarnings": [
    "Important safety precaution"
  ],
  "whenToCallPro": "When you should hire a professional instead of DIY",
  "preventionTips": [
    "How to prevent this from happening again"
  ],
  "relatedIssues": [
    "Other problems that often accompany this issue"
  ]
}

Rules:
- Additional context: ${description || 'See uploaded image'}
- Be specific about tools and materials — include sizes/types
- Give realistic cost and time estimates
- Include safety warnings where relevant (especially electrical, gas, structural)
- If it's a safety hazard, emphasize calling a professional
- Steps should be detailed enough for a beginner to follow
- Return ONLY valid JSON`;

            const parts = [{ text: 'Diagnose this home repair issue and provide a step-by-step fix guide with tools and materials needed.' }];
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

            systemInstruction = `You are an expert handyman. The user diagnosed a home repair issue and has follow-up questions. Give specific, safe, actionable advice. Emphasize safety. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous diagnosis: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.4,
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
        console.error('HomeRepair API error:', error);
        return res.status(500).json({ error: 'Failed to diagnose issue' });
    }
}
