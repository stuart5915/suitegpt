// Inclawbate — Brand Config Endpoint
// GET /api/inclawbate/brand-config?token_address=0x...
// PUT /api/inclawbate/brand-config — upsert brand settings

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

async function verifyTokenOwner(wallet, tokenAddress) {
    const tokens = await fetchAllTokens();
    const token = tokens.find(t =>
        (t.address || '').toLowerCase() === tokenAddress.toLowerCase()
    );
    if (!token) return null;
    if ((token.agent || '').toLowerCase() !== wallet.toLowerCase()) return null;
    return token;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const wallet = user.wallet.toLowerCase();

    // GET — fetch brand config for a token
    if (req.method === 'GET') {
        const { token_address } = req.query;
        if (!token_address) return res.status(400).json({ error: 'Missing token_address' });

        const token = await verifyTokenOwner(wallet, token_address);
        if (!token) return res.status(403).json({ error: 'Not your token' });

        const { data, error } = await supabase
            .from('token_brand_config')
            .select('*')
            .eq('wallet_address', wallet)
            .eq('token_address', token_address.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Brand config fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch config' });
        }

        // Return existing config or default template
        const config = data || {
            token_address: token_address.toLowerCase(),
            token_symbol: token.symbol,
            token_name: token.name,
            tone: 'playful and memetic',
            topics_focus: [],
            topics_avoid: [],
            sample_posts: [],
            hashtags: [],
            posting_frequency: 'moderate',
            autonomy_mode: 'review'
        };

        return res.status(200).json({ success: true, config });
    }

    // PUT — save brand config
    if (req.method === 'PUT') {
        const {
            token_address,
            tone,
            topics_focus,
            topics_avoid,
            sample_posts,
            hashtags,
            posting_frequency,
            autonomy_mode
        } = req.body;

        if (!token_address) return res.status(400).json({ error: 'Missing token_address' });

        const token = await verifyTokenOwner(wallet, token_address);
        if (!token) return res.status(403).json({ error: 'Not your token' });

        const record = {
            wallet_address: wallet,
            token_address: token_address.toLowerCase(),
            token_symbol: token.symbol,
            token_name: token.name,
            tone: tone || 'playful and memetic',
            topics_focus: topics_focus || [],
            topics_avoid: topics_avoid || [],
            sample_posts: (sample_posts || []).slice(0, 5),
            hashtags: hashtags || [],
            posting_frequency: posting_frequency || 'moderate',
            autonomy_mode: autonomy_mode || 'review',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('token_brand_config')
            .upsert(record, { onConflict: 'wallet_address,token_address' })
            .select()
            .single();

        if (error) {
            console.error('Brand config save error:', error);
            return res.status(500).json({ error: 'Failed to save config' });
        }

        return res.status(200).json({ success: true, config: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
