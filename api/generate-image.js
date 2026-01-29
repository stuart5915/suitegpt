// Generate images via Google Imagen 4 API
// Uses the same GEMINI_API_KEY as the text generation endpoint

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: aspectRatio || '1:1'
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Imagen API error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Image generation failed',
                details: data
            });
        }

        if (!data.predictions || !data.predictions.length) {
            return res.status(500).json({ error: 'No image generated' });
        }

        const base64 = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';

        return res.status(200).json({
            image: `data:${mimeType};base64,${base64}`
        });

    } catch (error) {
        console.error('Image generation error:', error);
        return res.status(500).json({ error: 'Failed to generate image' });
    }
}
