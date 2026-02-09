// Inclawbate — Scheduled Posts Endpoint
// GET /api/inclawbate/scheduled-posts?token_address=0x...&status=draft
// PATCH /api/inclawbate/scheduled-posts — approve, reject, or edit a post

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const wallet = user.wallet.toLowerCase();

    // GET — list posts for a token
    if (req.method === 'GET') {
        const { token_address, status, limit, offset } = req.query;
        if (!token_address) return res.status(400).json({ error: 'Missing token_address' });

        const token = await verifyTokenOwner(wallet, token_address);
        if (!token) return res.status(403).json({ error: 'Not your token' });

        let query = supabase
            .from('scheduled_posts')
            .select('*')
            .eq('token_address', token_address.toLowerCase())
            .order('scheduled_for', { ascending: true, nullsFirst: false })
            .limit(Math.min(parseInt(limit) || 50, 100))
            .range(parseInt(offset) || 0, (parseInt(offset) || 0) + (Math.min(parseInt(limit) || 50, 100)) - 1);

        if (status) {
            const statuses = status.split(',').map(s => s.trim());
            query = query.in('status', statuses);
        }

        const { data: posts, error } = await query;

        if (error) {
            console.error('Fetch posts error:', error);
            return res.status(500).json({ error: 'Failed to fetch posts' });
        }

        return res.status(200).json({ success: true, posts: posts || [] });
    }

    // PATCH — update a post (approve, reject, edit)
    if (req.method === 'PATCH') {
        const { post_id, action, post_text, rejected_reason } = req.body;

        if (!post_id || !action) {
            return res.status(400).json({ error: 'Missing post_id or action' });
        }

        // Fetch the post first
        const { data: post, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('id', post_id)
            .single();

        if (fetchErr || !post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Verify ownership
        if (post.token_address) {
            const token = await verifyTokenOwner(wallet, post.token_address);
            if (!token) return res.status(403).json({ error: 'Not your token' });
        }

        let update = {};

        switch (action) {
            case 'approve':
                update = { status: 'approved', approved_by: wallet, approved_at: new Date().toISOString() };
                break;
            case 'reject':
                update = { status: 'rejected', rejected_reason: rejected_reason || null };
                break;
            case 'edit':
                if (!post_text) return res.status(400).json({ error: 'Missing post_text for edit' });
                update = { post_text };
                break;
            case 'revoke':
                update = { status: 'draft', approved_by: null, approved_at: null };
                break;
            default:
                return res.status(400).json({ error: 'Invalid action. Use: approve, reject, edit, revoke' });
        }

        const { data: updated, error: updateErr } = await supabase
            .from('scheduled_posts')
            .update(update)
            .eq('id', post_id)
            .select()
            .single();

        if (updateErr) {
            console.error('Update post error:', updateErr);
            return res.status(500).json({ error: 'Failed to update post' });
        }

        return res.status(200).json({ success: true, post: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
