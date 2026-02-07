// MeetingMind — Paste meeting notes/transcript, AI generates summary + action items
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, text, image, mimeType, meetingType, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'analyze') {
            if (!text && !image) return res.status(400).json({ error: 'Meeting notes or image is required' });

            systemInstruction = `You are an expert executive assistant and meeting analyst. Analyze meeting notes/transcripts and extract all actionable intelligence. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "meetingTitle": "Inferred meeting title",
  "meetingType": "${meetingType || 'general'}",
  "date": "Detected date or 'Not specified'",
  "duration": "Estimated duration or 'Not specified'",
  "participants": ["Person 1", "Person 2"],
  "summary": {
    "oneLiner": "One sentence summary",
    "overview": "2-3 paragraph detailed summary",
    "keyOutcome": "The most important outcome"
  },
  "decisions": [
    { "decision": "What was decided", "context": "Why it was decided", "owner": "Who owns it" }
  ],
  "actionItems": [
    { "task": "What needs to be done", "owner": "Who's responsible", "deadline": "When (if mentioned)", "priority": "high|medium|low", "status": "pending" }
  ],
  "keyDiscussions": [
    { "topic": "Discussion topic", "summary": "What was discussed", "outcome": "What was resolved or next steps" }
  ],
  "risks": [
    { "risk": "Identified risk or concern", "mitigation": "Suggested mitigation" }
  ],
  "followUpEmail": {
    "subject": "Re: Meeting Title — Summary & Action Items",
    "body": "Professional follow-up email with summary and action items"
  },
  "nextMeeting": {
    "suggestedTopics": ["Topic 1", "Topic 2"],
    "suggestedDate": "Recommendation based on deadlines"
  },
  "sentiment": "positive|neutral|mixed|tense"
}

Rules:
- Meeting type: ${meetingType || 'general'}
- Extract EVERY action item with clear ownership
- Identify ALL decisions made
- Flag any unresolved issues as risks
- Generate a professional follow-up email
- Be specific — use names, dates, and numbers from the notes
- Return ONLY valid JSON`;

            const parts = [{ text: `Analyze these meeting notes and extract summary, decisions, action items, and generate a follow-up email.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (text) {
                parts[0].text += ` Meeting notes: ${text}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert executive assistant. The user analyzed meeting notes and has follow-up questions. Help them with clarifications, email drafts, action item refinements, or meeting prep. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Meeting analysis: ${context.slice(0, 50000)}` }] });
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
                        temperature: 0.3,
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
        console.error('MeetingMind API error:', error);
        return res.status(500).json({ error: 'Failed to analyze meeting' });
    }
}
