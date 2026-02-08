// Inclawbate — Token Data Endpoint
// GET /api/inclawbate/token-data?ticker=TICKER
// Finds token by symbol from Clawnch's /api/tokens, returns formatted data

const CLAWNCH_BASE = 'https://clawn.ch/api';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

// Cache all tokens in memory (shared with proxy if same instance)
let tokenCache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

async function fetchAllTokens() {
    if (tokenCache && Date.now() - cacheTime < CACHE_TTL) return tokenCache;

    const res = await fetch(`${CLAWNCH_BASE}/tokens`);
    if (!res.ok) throw new Error(`Clawnch API: ${res.status}`);
    const data = await res.json();
    tokenCache = data.tokens || [];
    cacheTime = Date.now();
    return tokenCache;
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

    const { ticker } = req.query;
    if (!ticker) {
        return res.status(400).json({ error: 'Missing ticker parameter' });
    }

    try {
        const tokens = await fetchAllTokens();
        const symbol = ticker.toUpperCase();
        const token = tokens.find(t => (t.symbol || '').toUpperCase() === symbol);

        if (!token) {
            return res.status(404).json({ success: false, error: 'Token not found' });
        }

        // Format for the token page renderer
        const tokenData = {
            name: token.name || symbol,
            ticker: symbol,
            tagline: token.description || '',
            colorPrimary: '#8b5cf6',
            colorSecondary: '#06b6d4',
            logoUrl: null,
            narrative: token.description || '',
            tokenAddress: token.address || null,
            launchedAt: token.launchedAt || null,
            source: token.source || null,
            socialLinks: {},
            analytics: {},
            clankerUrl: token.clanker_url || null,
            explorerUrl: token.explorer_url || null
        };

        // Social links
        if (token.twitterUrl) tokenData.socialLinks.twitter = token.twitterUrl;
        if (token.websiteUrl) tokenData.socialLinks.website = token.websiteUrl;

        return res.status(200).json({
            success: true,
            token: tokenData
        });

    } catch (err) {
        console.error('Token data error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
