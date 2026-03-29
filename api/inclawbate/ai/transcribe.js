// Inclawbate Studio API — Audio Transcription
// Uses Groq Whisper (free, fast)
// Future: route to community GPU nodes running Whisper locally

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

    const GROQ_KEY = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',')[0]?.trim();
    if (!GROQ_KEY) {
        return res.status(500).json({ error: 'Transcription not configured' });
    }

    try {
        const { audio, language } = req.body;
        if (!audio) {
            return res.status(400).json({ error: 'audio (base64) is required' });
        }

        // Strip data URI prefix if present
        const base64Data = audio.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
        const audioBuffer = Buffer.from(base64Data, 'base64');

        // Build multipart form data
        const boundary = '----IncBoundary' + Date.now();
        const parts = [];

        // File part
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);
        const filePart = Buffer.from(parts[0]);
        const fileEnd = Buffer.from('\r\n');

        // Model part
        const modelPart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`);

        // Language part (optional)
        let langPart = Buffer.alloc(0);
        if (language) {
            langPart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`);
        }

        // Response format
        const formatPart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`);

        const ending = Buffer.from(`--${boundary}--\r\n`);

        const body = Buffer.concat([filePart, audioBuffer, fileEnd, modelPart, langPart, formatPart, ending]);

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_KEY}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Groq Whisper error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Transcription failed'
            });
        }

        return res.status(200).json({
            text: data.text,
            language: data.language,
            duration: data.duration,
            segments: data.segments,
            model: 'whisper-large-v3-turbo',
            source: 'inclawbate-studio'
        });

    } catch (error) {
        console.error('Studio transcribe error:', error);
        return res.status(500).json({ error: 'Failed to transcribe audio' });
    }
}
