// Inclawbate — Clawnch + Clanker API Proxy
// Fetches tokens from Clawnch, enriches with Clanker data (images, social links)

const CLAWNCH_BASE = 'https://clawn.ch/api';
const CLANKER_BASE = 'https://clanker.world/api';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

// ── Cache ──
let tokenCache = null;
let cacheTime = 0;
const CACHE_TTL = 120_000; // 2 min

async function fetchAllTokens() {
    if (tokenCache && Date.now() - cacheTime < CACHE_TTL) return tokenCache;

    const res = await fetch(`${CLAWNCH_BASE}/tokens`);
    if (!res.ok) throw new Error(`Clawnch API: ${res.status}`);
    const data = await res.json();
    tokenCache = { count: data.count, tokens: data.tokens || [] };
    cacheTime = Date.now();
    return tokenCache;
}

// Fetch Clanker data for a batch of addresses (up to 30)
let clankerCache = new Map();
let clankerCacheTime = 0;
const CLANKER_CACHE_TTL = 300_000; // 5 min

async function fetchClankerBatch(addresses) {
    // Check if we need to clear stale cache
    if (Date.now() - clankerCacheTime > CLANKER_CACHE_TTL) {
        clankerCache = new Map();
        clankerCacheTime = Date.now();
    }

    const uncached = addresses.filter(a => !clankerCache.has(a.toLowerCase()));
    if (uncached.length === 0) return;

    // Clanker doesn't have a batch endpoint, but we can search by contract
    // Fetch page by page — for now just get the ones we need
    const promises = uncached.slice(0, 10).map(async (addr) => {
        try {
            const res = await fetch(`${CLANKER_BASE}/tokens/${addr}`);
            if (!res.ok) return;
            const data = await res.json();
            const t = data.data || data;
            if (t && t.contract_address) {
                clankerCache.set(t.contract_address.toLowerCase(), {
                    imgUrl: t.img_url || null,
                    startingMcap: t.starting_market_cap || null,
                    socialLinks: t.socialLinks || [],
                    clankerUrl: `https://clanker.world/clanker/${t.contract_address}`
                });
            }
        } catch {}
    });

    await Promise.all(promises);
}

function enrichToken(token) {
    const clanker = clankerCache.get((token.address || '').toLowerCase());
    if (clanker) {
        token.imgUrl = clanker.imgUrl;
        token.startingMcap = clanker.startingMcap;
        if (clanker.socialLinks && clanker.socialLinks.length > 0) {
            token.socialLinksArr = clanker.socialLinks;
        }
    }
    return token;
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
        const allTokens = data.tokens;

        // Stats action
        if (action === 'stats') {
            return res.status(200).json({
                success: true,
                data: { totalTokens: data.count || allTokens.length }
            });
        }

        // Filter & sort
        let tokens = [...allTokens];

        if (search) {
            const q = search.toLowerCase();
            tokens = tokens.filter(t =>
                (t.symbol || '').toLowerCase().includes(q) ||
                (t.name || '').toLowerCase().includes(q)
            );
        }

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

        // Enrich page with Clanker data (images, socials)
        const addresses = page.map(t => t.address).filter(Boolean);
        await fetchClankerBatch(addresses);
        const enriched = page.map(enrichToken);

        return res.status(200).json({
            success: true,
            total: tokens.length,
            offset: start,
            limit: pageSize,
            hasMore: start + pageSize < tokens.length,
            tokens: enriched
        });

    } catch (err) {
        console.error('Proxy error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch tokens', message: err.message });
    }
}
