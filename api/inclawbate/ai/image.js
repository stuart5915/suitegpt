// Inclawbate Studio API — Image Generation
// Uses Google Imagen 4 (free via Gemini API key)
// Future: route to community GPU nodes running FLUX/SDXL

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Image generation not configured' });
    }

    const { prompt, aspectRatio, style } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    // Optional style prefix
    const fullPrompt = style ? `${style} style: ${prompt}` : prompt;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: fullPrompt }],
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
                error: data.error?.message || 'Image generation failed'
            });
        }

        if (!data.predictions || !data.predictions.length) {
            return res.status(500).json({ error: 'No image generated' });
        }

        const base64 = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';

        return res.status(200).json({
            image: `data:${mimeType};base64,${base64}`,
            prompt: fullPrompt,
            model: 'imagen-4',
            source: 'inclawbate-studio'
        });

    } catch (error) {
        console.error('Studio image error:', error);
        return res.status(500).json({ error: 'Failed to generate image' });
    }
}
