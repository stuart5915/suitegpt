// TranslateDoc — Upload text/doc, AI translates with formatting preserved
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, text, image, mimeType, sourceLang, targetLang, tone, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'translate') {
            if (!text && !image) return res.status(400).json({ error: 'Text or image is required' });
            if (!targetLang) return res.status(400).json({ error: 'Target language is required' });

            systemInstruction = `You are an expert translator fluent in all major world languages. Translate the provided text while preserving formatting, structure, and meaning. Adapt idioms and cultural references appropriately.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "sourceLanguage": "Detected source language",
  "targetLanguage": "${targetLang}",
  "sourceText": "Original text (first 500 chars)",
  "translatedText": "The full translation with formatting preserved",
  "wordCount": { "source": 123, "translated": 130 },
  "sections": [
    {
      "id": 1,
      "original": "Original paragraph/section",
      "translated": "Translated paragraph/section",
      "notes": "Any translation notes (idioms, cultural adaptations, etc.)"
    }
  ],
  "glossary": [
    { "source": "Term in source", "translated": "Term in target", "context": "How it's used" }
  ],
  "culturalNotes": [
    "Any cultural adaptations or notes about the translation"
  ],
  "formality": "${tone || 'neutral'}",
  "confidence": "high|medium",
  "alternativeTranslations": [
    { "phrase": "A phrase with multiple valid translations", "alternatives": ["Option 1", "Option 2"], "recommended": "Option 1", "reason": "Why this is preferred" }
  ]
}

Rules:
- Source language: ${sourceLang || 'auto-detect'}
- Target language: ${targetLang}
- Tone: ${tone || 'neutral'} (formal/neutral/casual)
- Preserve all formatting: headers, lists, paragraphs, emphasis
- Translate idioms to equivalent expressions in target language
- Flag any ambiguous translations with alternatives
- Keep proper nouns unchanged unless they have standard translations
- Maintain the document's structure and flow
- Return ONLY valid JSON`;

            const parts = [{ text: `Translate this content to ${targetLang}. Preserve all formatting and structure.` }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
            }
            if (text) {
                parts[0].text += ` Content: ${text}`;
            }
            contents = [{ parts }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert translator and language specialist. The user translated a document and has questions about specific translations, alternative phrasings, or cultural context. Help them understand and refine the translation. Use markdown for formatting.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Previous translation: ${context.slice(0, 50000)}` }] });
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
        console.error('TranslateDoc API error:', error);
        return res.status(500).json({ error: 'Failed to translate' });
    }
}
