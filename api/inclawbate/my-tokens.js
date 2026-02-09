// Inclawbate — My Tokens Endpoint
// GET /api/inclawbate/my-tokens
// Returns tokens deployed by the authenticated wallet, enriched with ops metadata

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './auth-verify.js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLAWNCH_BASE = 'https://clawn.ch/api';

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

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const allTokens = await fetchAllTokens();
        const wallet = user.wallet.toLowerCase();

        // Find tokens where this wallet is the deployer (agent field)
        const myTokens = allTokens.filter(t =>
            (t.agent || '').toLowerCase() === wallet
        );

        if (myTokens.length === 0) {
            return res.status(200).json({ success: true, tokens: [] });
        }

        // Get brand configs for this wallet
        const { data: configs } = await supabase
            .from('token_brand_config')
            .select('token_address, autonomy_mode')
            .eq('wallet_address', wallet);

        const configMap = new Map((configs || []).map(c => [c.token_address.toLowerCase(), c]));

        // Get pending post counts per token
        const addresses = myTokens.map(t => t.address).filter(Boolean);
        const { data: postCounts } = await supabase
            .from('scheduled_posts')
            .select('token_address, status')
            .in('token_address', addresses)
            .eq('status', 'draft');

        const pendingMap = new Map();
        for (const p of (postCounts || [])) {
            const addr = (p.token_address || '').toLowerCase();
            pendingMap.set(addr, (pendingMap.get(addr) || 0) + 1);
        }

        // Build response
        const tokens = myTokens.map(t => {
            const addr = (t.address || '').toLowerCase();
            const config = configMap.get(addr);
            return {
                symbol: t.symbol,
                name: t.name,
                address: t.address,
                launchedAt: t.launchedAt,
                description: t.description,
                source: t.source,
                hasBrandConfig: !!config,
                autonomyMode: config ? config.autonomy_mode : null,
                pendingPosts: pendingMap.get(addr) || 0
            };
        });

        // Sort by most recently launched
        tokens.sort((a, b) => new Date(b.launchedAt || 0) - new Date(a.launchedAt || 0));

        return res.status(200).json({ success: true, tokens });

    } catch (err) {
        console.error('My tokens error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
