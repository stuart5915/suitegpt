// Inclawbate Studio API — Background Removal
// Uses Gemini 2.5 Flash (free via Gemini API key)
// Future: route to community GPU nodes running SAM/REMBG

const ALLOWED_ORIGINS = [
    'https://inclawbate.app', 'https://www.inclawbate.app',
    'https://suitegpt.app', 'https://www.suitegpt.app',
    'http://localhost:3000', 'http://localhost:5500'
];

const rateLimits = new Map();
const RATE_LIMIT = 30; // max 30 per 10 min per IP
const RATE_WINDOW = 10 * 60 * 1000;

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Rate limit by IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const now = Date.now();
    const entry = rateLimits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_WINDOW; }
    entry.count++;
    rateLimits.set(ip, entry);
    if (entry.count > RATE_LIMIT) return res.status(429).json({ error: 'Rate limited — try again later' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Background removal not configured' });

    try {
        const { image, background } = req.body;
        if (!image) return res.status(400).json({ error: 'image (base64) is required' });

        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

        let prompt;
        if (background === 'transparent' || !background) {
            prompt = 'Remove the background from this image, making it fully transparent. Output as PNG with alpha channel. Keep the subject exactly as-is with clean edges.';
        } else {
            prompt = `Remove the background from this image and replace it with a solid ${background} color. Keep the subject exactly as-is with clean edges.`;
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'image/png', data: base64Data } }
                        ]
                    }],
                    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', JSON.stringify(data));
            return res.status(response.status).json({ error: data.error?.message || 'Background removal failed' });
        }

        const parts = data.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData);
        if (!imagePart) {
            return res.status(500).json({ error: 'No image returned' });
        }

        return res.status(200).json({
            image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            model: 'gemini-2.5-flash',
            source: 'inclawbate-studio'
        });

    } catch (error) {
        console.error('Studio remove-bg error:', error);
        return res.status(500).json({ error: 'Failed to remove background' });
    }
}
