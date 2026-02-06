// ResumeForge API - Resume tailoring via Gemini
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, resumeText, jobPosting, question, history } = req.body;

    if (!resumeText) return res.status(400).json({ error: 'Resume text is required' });
    if (!mode) return res.status(400).json({ error: 'Mode is required (tailor or qa)' });

    try {
        let systemInstruction, contents;

        if (mode === 'tailor') {
            if (!jobPosting) return res.status(400).json({ error: 'Job posting is required for tailor mode' });

            systemInstruction = `You are an expert resume consultant and career coach. Analyze the resume against the job posting and return a JSON object with exactly this structure:
{
  "matchScore": 82,
  "matchSummary": "Brief 2-3 sentence assessment of how well the resume matches this role",
  "keywordGaps": ["keyword 1 from job posting missing in resume", "keyword 2", ...],
  "strongMatches": ["skill/experience 1 that aligns well", "skill/experience 2", ...],
  "rewrittenBullets": [
    { "original": "Original bullet from resume", "improved": "Rewritten bullet tailored to this job" },
    ...
  ],
  "suggestedSummary": "A tailored professional summary/objective for the top of the resume, written for this specific role",
  "coverLetterDraft": "A full cover letter draft (3-4 paragraphs) tailored to this specific role and company"
}

Rules:
- matchScore: 0-100 integer based on how well qualifications match requirements
- keywordGaps: Important skills, tools, or qualifications from the job posting NOT found in the resume (max 10)
- strongMatches: Skills and experiences that directly align with job requirements (max 8)
- rewrittenBullets: Pick the 5-8 most impactful bullets from the resume and rewrite them to better match this job. Use strong action verbs, quantify results where possible, and incorporate relevant keywords
- suggestedSummary: 3-4 sentences, tailored specifically for this role
- coverLetterDraft: Professional, specific to the company and role, references actual experience from the resume
- Return ONLY valid JSON, no markdown fences, no extra text`;

            contents = [{ parts: [{ text: `RESUME:\n${resumeText.slice(0, 200000)}\n\nJOB POSTING:\n${jobPosting.slice(0, 50000)}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required for qa mode' });

            systemInstruction = `You are an expert resume consultant. Answer questions about resume optimization, job applications, and career strategy. You have the user's resume and the job posting they're targeting. Give specific, actionable advice based on their actual experience and the role requirements.`;

            const messages = [{ parts: [{ text: `RESUME:\n${resumeText.slice(0, 200000)}${jobPosting ? `\n\nJOB POSTING:\n${jobPosting.slice(0, 50000)}` : ''}` }] }];

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
            return res.status(400).json({ error: 'Invalid mode. Use "tailor" or "qa"' });
        }

        const requestBody = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: mode === 'tailor' ? 0.4 : 0.7,
                maxOutputTokens: mode === 'tailor' ? 8192 : 4096
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

        if (mode === 'tailor') {
            try {
                const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return res.status(200).json({
                    matchScore: parsed.matchScore || 0,
                    matchSummary: parsed.matchSummary || '',
                    keywordGaps: parsed.keywordGaps || [],
                    strongMatches: parsed.strongMatches || [],
                    rewrittenBullets: parsed.rewrittenBullets || [],
                    suggestedSummary: parsed.suggestedSummary || '',
                    coverLetterDraft: parsed.coverLetterDraft || ''
                });
            } catch (parseError) {
                return res.status(200).json({
                    matchScore: 0,
                    matchSummary: responseText,
                    keywordGaps: [],
                    strongMatches: [],
                    rewrittenBullets: [],
                    suggestedSummary: '',
                    coverLetterDraft: ''
                });
            }
        } else {
            return res.status(200).json({ answer: responseText });
        }

    } catch (error) {
        console.error('ResumeForge API error:', error);
        return res.status(500).json({ error: 'Failed to analyze resume' });
    }
}
