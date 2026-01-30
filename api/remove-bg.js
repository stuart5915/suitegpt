// Gemini-powered background removal API
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    try {
        const { image, background } = req.body;
        if (!image) return res.status(400).json({ error: 'image (base64) is required' });

        // Strip data URI prefix if present
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

        // Build prompt based on background type
        let prompt;
        if (background === 'transparent') {
            prompt = 'Remove the background from this image, making it fully transparent. Output as PNG with alpha channel. Keep the subject exactly as-is with clean edges.';
        } else {
            prompt = `Remove the background from this image and replace it with a solid ${background} color. Keep the subject exactly as-is with clean edges.`;
        }

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE']
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
            console.error('Gemini API error:', JSON.stringify(data));
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        }

        // Extract base64 image from response
        const parts = data.candidates?.[0]?.content?.parts;
        if (!parts || parts.length === 0) {
            return res.status(500).json({ error: 'No image returned from Gemini' });
        }

        const imagePart = parts.find(p => p.inlineData);
        if (!imagePart) {
            return res.status(500).json({ error: 'No image data in Gemini response' });
        }

        return res.status(200).json({
            image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
        });

    } catch (error) {
        console.error('Remove-bg error:', error);
        return res.status(500).json({ error: 'Failed to process image' });
    }
}
