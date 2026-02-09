// Inclawbate — Token Data Endpoint
// GET /api/inclawbate/token-data?ticker=TICKER
// Finds token from Clawnch, enriches with DexScreener data (price, mcap, image)

const CLAWNCH_BASE = 'https://clawn.ch/api';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

let tokenCache = null;
let cacheTime = 0;
const CACHE_TTL = 120_000;

async function fetchAllTokens() {
    if (tokenCache && Date.now() - cacheTime < CACHE_TTL) return tokenCache;
    const res = await fetch(`${CLAWNCH_BASE}/tokens`);
    if (!res.ok) throw new Error(`Clawnch API: ${res.status}`);
    const data = await res.json();
    tokenCache = data.tokens || [];
    cacheTime = Date.now();
    return tokenCache;
}

async function fetchDexScreenerData(address) {
    try {
        const res = await fetch(`${DEXSCREENER_BASE}/${address}`);
        if (!res.ok) return null;
        const data = await res.json();
        const pairs = data.pairs || [];
        if (pairs.length === 0) return null;
        // Use the highest-liquidity pair
        pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        return pairs[0];
    } catch {
        return null;
    }
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

        // Build base token data from Clawnch
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

        // Social links from Clawnch
        if (token.twitterUrl) tokenData.socialLinks.twitter = token.twitterUrl;
        if (token.websiteUrl) tokenData.socialLinks.website = token.websiteUrl;
        if (token.source_url) tokenData.socialLinks.source = token.source_url;

        // Enrich with DexScreener data (price, mcap, volume, image)
        if (token.address) {
            const dex = await fetchDexScreenerData(token.address);
            if (dex) {
                tokenData.analytics = {
                    price: dex.priceUsd ? parseFloat(dex.priceUsd) : null,
                    marketCap: dex.marketCap || dex.fdv || null,
                    volume24h: dex.volume?.h24 || null,
                    liquidity: dex.liquidity?.usd || null,
                    priceChange24h: dex.priceChange?.h24 || null
                };

                // DexScreener image (community-uploaded, usually high quality)
                if (dex.info?.imageUrl) {
                    tokenData.logoUrl = dex.info.imageUrl;
                }

                // DexScreener social links
                if (dex.info?.websites) {
                    for (const w of dex.info.websites) {
                        if (w.url && !tokenData.socialLinks.website) tokenData.socialLinks.website = w.url;
                    }
                }
                if (dex.info?.socials) {
                    for (const s of dex.info.socials) {
                        if (s.type === 'twitter' && s.url && !tokenData.socialLinks.twitter) tokenData.socialLinks.twitter = s.url;
                        if (s.type === 'telegram' && s.url) tokenData.socialLinks.telegram = s.url;
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            token: tokenData
        });

    } catch (err) {
        console.error('Token data error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
