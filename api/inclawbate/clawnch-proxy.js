// Inclawbate — Clawnch API Proxy
// Proxies whitelisted Clawnch API paths to avoid CORS issues
// GET /api/inclawbate/clawnch-proxy?path=/stats
// GET /api/inclawbate/clawnch-proxy?path=/analytics/leaderboard&sort=marketCap&limit=50

const CLAWNCH_BASE = 'https://clawn.ch/api';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const ALLOWED_PATHS = [
    '/stats',
    '/launches',
    '/tokens',
    '/analytics/leaderboard',
    '/analytics/token',
    '/analytics/agent',
    '/fees/available'
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { path, ...params } = req.query;
    if (!path) {
        return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Validate path against whitelist
    const isAllowed = ALLOWED_PATHS.some(p => path === p || path.startsWith(p + '/'));
    if (!isAllowed) {
        return res.status(403).json({ error: 'Path not allowed', path });
    }

    try {
        const qs = new URLSearchParams(params).toString();
        const url = `${CLAWNCH_BASE}${path}${qs ? '?' + qs : ''}`;

        const upstream = await fetch(url, {
            headers: {
                'X-Moltbook-Key': process.env.CLAWNCH_API_KEY || ''
            }
        });

        const text = await upstream.text();

        // Try to parse as JSON
        try {
            const data = JSON.parse(text);
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
            return res.status(upstream.status).json(data);
        } catch {
            // Not JSON — return debug info
            console.error('Clawnch non-JSON response:', upstream.status, text.slice(0, 500));
            return res.status(502).json({
                error: 'Upstream returned non-JSON',
                upstreamStatus: upstream.status,
                url,
                preview: text.slice(0, 200)
            });
        }

    } catch (err) {
        console.error('Clawnch proxy fetch error:', err.message);
        return res.status(502).json({ error: 'Upstream fetch failed', message: err.message });
    }
}
