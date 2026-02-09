// Inclawbate — Activity Feed Endpoint
// GET /api/inclawbate/activity-feed?token_address=0x...&limit=30

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const wallet = user.wallet.toLowerCase();
    const { token_address, limit } = req.query;

    if (!token_address) return res.status(400).json({ error: 'Missing token_address' });

    const token = await verifyTokenOwner(wallet, token_address);
    if (!token) return res.status(403).json({ error: 'Not your token' });

    const pageLimit = Math.min(parseInt(limit) || 30, 100);

    try {
        // Fetch recent posts activity
        const { data: posts } = await supabase
            .from('scheduled_posts')
            .select('id, post_text, platform, status, created_at, approved_at, scheduled_for')
            .eq('token_address', token_address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(pageLimit);

        // Fetch agent messages for this token
        const { data: messages } = await supabase
            .from('agent_messages')
            .select('id, from_agent, message_type, content, created_at')
            .eq('token_address', token_address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(pageLimit);

        // Merge into unified feed
        const feed = [];

        for (const p of (posts || [])) {
            feed.push({
                type: 'post',
                id: p.id,
                summary: p.status === 'draft'
                    ? `New draft post for ${p.platform || 'unknown'}`
                    : p.status === 'approved'
                    ? `Post approved for ${p.platform || 'unknown'}`
                    : p.status === 'rejected'
                    ? `Post rejected for ${p.platform || 'unknown'}`
                    : p.status === 'posted'
                    ? `Post published on ${p.platform || 'unknown'}`
                    : `Post updated (${p.status})`,
                preview: (p.post_text || '').slice(0, 120),
                platform: p.platform,
                status: p.status,
                timestamp: p.approved_at || p.created_at
            });
        }

        for (const m of (messages || [])) {
            feed.push({
                type: 'message',
                id: m.id,
                summary: `Agent ${m.from_agent || 'unknown'}: ${m.message_type || 'message'}`,
                preview: typeof m.content === 'string' ? m.content.slice(0, 120) : JSON.stringify(m.content).slice(0, 120),
                agent: m.from_agent,
                timestamp: m.created_at
            });
        }

        // Sort by timestamp descending
        feed.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        return res.status(200).json({
            success: true,
            feed: feed.slice(0, pageLimit)
        });

    } catch (err) {
        console.error('Activity feed error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
