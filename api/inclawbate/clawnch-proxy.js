// Inclawbate — Clawnch API Proxy
// Proxies /api/tokens and /api/launches from clawn.ch, returns paginated results

const CLAWNCH_BASE = 'https://clawn.ch/api';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

// Cache tokens in memory for the serverless instance lifetime (~5 min on Vercel)
let tokenCache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60s

async function fetchAllTokens() {
    if (tokenCache && Date.now() - cacheTime < CACHE_TTL) return tokenCache;

    const res = await fetch(`${CLAWNCH_BASE}/tokens`);
    if (!res.ok) throw new Error(`Clawnch API: ${res.status}`);
    const data = await res.json();
    tokenCache = data;
    cacheTime = Date.now();
    return data;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { action, offset, limit, search, sort } = req.query;

    try {
        const data = await fetchAllTokens();
        const allTokens = data.tokens || [];

        // Stats action — just return counts
        if (action === 'stats') {
            const sources = new Set(allTokens.map(t => t.source).filter(Boolean));
            return res.status(200).json({
                success: true,
                data: {
                    totalTokens: data.count || allTokens.length,
                    sources: [...sources],
                    sourceCount: sources.size
                }
            });
        }

        // Default: paginated token list
        let tokens = [...allTokens];

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            tokens = tokens.filter(t =>
                (t.symbol || '').toLowerCase().includes(q) ||
                (t.name || '').toLowerCase().includes(q)
            );
        }

        // Sort
        const sortBy = sort || 'newest';
        if (sortBy === 'newest') {
            tokens.sort((a, b) => new Date(b.launchedAt || 0) - new Date(a.launchedAt || 0));
        } else if (sortBy === 'oldest') {
            tokens.sort((a, b) => new Date(a.launchedAt || 0) - new Date(b.launchedAt || 0));
        } else if (sortBy === 'alpha') {
            tokens.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
        }

        // Paginate
        const start = parseInt(offset) || 0;
        const pageSize = Math.min(parseInt(limit) || 48, 200);
        const page = tokens.slice(start, start + pageSize);

        return res.status(200).json({
            success: true,
            total: tokens.length,
            offset: start,
            limit: pageSize,
            hasMore: start + pageSize < tokens.length,
            tokens: page
        });

    } catch (err) {
        console.error('Clawnch proxy error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch from Clawnch', message: err.message });
    }
}
