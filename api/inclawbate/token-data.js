// Inclawbate — Public Token Data
// GET /api/inclawbate/token-data?ticker=TICKER
// Returns token brand data + analytics for the dynamic landing page

const CLAWS_BASE = 'https://clawn.ch/api/memory';
const CLAWNCH_BASE = 'https://clawn.ch/api';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

async function clawsCall(body) {
    const res = await fetch(CLAWS_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CLAWS_API_KEY}`
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return res.json();
}

async function clawnchGet(path) {
    const res = await fetch(`${CLAWNCH_BASE}${path}`, {
        headers: {
            'X-Moltbook-Key': process.env.CLAWNCH_API_KEY || ''
        }
    });
    if (!res.ok) return null;
    return res.json();
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { ticker } = req.query;
    if (!ticker) {
        return res.status(400).json({ error: 'Missing ticker parameter' });
    }

    try {
        // Try to get incubation data from CLAWS
        let tokenData = null;

        const clawsResult = await clawsCall({
            action: 'getByTag',
            tag: `ticker:${ticker.toUpperCase()}`,
            limit: 10
        });

        if (clawsResult && clawsResult.episodes && clawsResult.episodes.length > 0) {
            // Parse stored documents
            const docs = clawsResult.episodes
                .map(ep => {
                    try { return JSON.parse(ep.text || ep.content); } catch { return null; }
                })
                .filter(Boolean);

            const project = docs.find(d => d.docType === 'project');
            const brand = docs.find(d => d.docType === 'brand-option' && d.selected);
            const launchRecord = docs.find(d => d.docType === 'launch-record');

            if (brand || launchRecord) {
                tokenData = {
                    name: brand?.name || launchRecord?.ticker || ticker,
                    ticker: ticker.toUpperCase(),
                    tagline: brand?.tagline || '',
                    colorPrimary: brand?.colorPrimary || '#8b5cf6',
                    colorSecondary: brand?.colorSecondary || '#06b6d4',
                    logoUrl: brand?.logoUrl || null,
                    narrative: brand?.narrative || '',
                    tokenAddress: launchRecord?.tokenAddress || null,
                    launchedAt: launchRecord?.launchedAt || null,
                    socialLinks: launchRecord?.socialLinks || {},
                    analytics: {}
                };
            }
        }

        // If no CLAWS data, try Clawnch API directly
        if (!tokenData) {
            const launches = await clawnchGet(`/launches?symbol=${ticker.toUpperCase()}`);
            if (launches && launches.data && launches.data.length > 0) {
                const launch = launches.data[0];
                tokenData = {
                    name: launch.name || ticker,
                    ticker: ticker.toUpperCase(),
                    tagline: launch.description || '',
                    colorPrimary: '#8b5cf6',
                    colorSecondary: '#06b6d4',
                    logoUrl: launch.image || null,
                    narrative: launch.description || '',
                    tokenAddress: launch.tokenAddress || null,
                    launchedAt: launch.createdAt || null,
                    socialLinks: {
                        twitter: launch.twitter || null,
                        website: launch.website || null
                    },
                    analytics: {}
                };
            }
        }

        if (!tokenData) {
            return res.status(404).json({ success: false, error: 'Token not found' });
        }

        // Enrich with live analytics if we have a token address
        if (tokenData.tokenAddress) {
            const analytics = await clawnchGet(`/analytics/token?address=${tokenData.tokenAddress}`);
            if (analytics && analytics.data) {
                tokenData.analytics = {
                    price: analytics.data.price || null,
                    marketCap: analytics.data.marketCap || null,
                    holders: analytics.data.holders || null,
                    volume24h: analytics.data.volume24h || null
                };
            }
        }

        return res.status(200).json({
            success: true,
            token: tokenData
        });

    } catch (err) {
        console.error('Token data error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
