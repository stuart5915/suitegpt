// Inclawbate — UBI Requests
// GET              → list open requests (with comment counts, author handles)
// GET ?id=123      → single request + all comments
// POST action:"create"  → new request (wallet required, max 1 open per wallet)
// POST action:"comment" → add comment
// POST action:"close"   → close own request

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const requestId = req.query.id;

        if (requestId) {
            // Single request with all comments
            const { data: request, error } = await supabase
                .from('inclawbate_ubi_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (error || !request) {
                return res.status(404).json({ error: 'Request not found' });
            }

            // Fetch comments
            const { data: comments } = await supabase
                .from('inclawbate_ubi_request_comments')
                .select('*')
                .eq('request_id', requestId)
                .order('created_at', { ascending: true });

            // Fetch author handles
            const wallets = [request.wallet_address, ...(comments || []).map(c => c.wallet_address)];
            const uniqueWallets = [...new Set(wallets)];
            const handles = await getHandles(uniqueWallets);

            return res.status(200).json({
                request: { ...request, handle: handles[request.wallet_address] || null },
                comments: (comments || []).map(c => ({
                    ...c,
                    handle: handles[c.wallet_address] || null
                }))
            });
        }

        // List open requests (optionally filtered by type)
        const requestType = req.query.type;
        let query = supabase
            .from('inclawbate_ubi_requests')
            .select('*')
            .eq('status', 'open');
        if (requestType) query = query.eq('request_type', requestType);
        const { data: requests, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch requests' });
        }

        // Fetch comment counts
        const ids = (requests || []).map(r => r.id);
        let commentCounts = {};
        if (ids.length > 0) {
            const { data: counts } = await supabase
                .from('inclawbate_ubi_request_comments')
                .select('request_id')
                .in('request_id', ids);

            for (const c of (counts || [])) {
                commentCounts[c.request_id] = (commentCounts[c.request_id] || 0) + 1;
            }
        }

        // Fetch author handles
        const wallets = (requests || []).map(r => r.wallet_address);
        const handles = wallets.length > 0 ? await getHandles([...new Set(wallets)]) : {};

        const result = (requests || []).map(r => ({
            id: r.id,
            wallet_address: r.wallet_address,
            title: r.title,
            description: r.description,
            amount_requested: r.amount_requested,
            total_funded: r.total_funded,
            request_type: r.request_type || 'goclawnchme',
            created_at: r.created_at,
            comment_count: commentCounts[r.id] || 0,
            handle: handles[r.wallet_address] || null
        }));

        return res.status(200).json({ requests: result });
    }

    if (req.method === 'POST') {
        const { action, wallet_address } = req.body;

        if (!wallet_address || typeof wallet_address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({ error: 'Valid wallet_address required' });
        }

        const w = wallet_address.toLowerCase();

        if (action === 'create') {
            const { title, description, amount_requested, socials, request_type } = req.body;
            const rtype = (request_type === 'ubi') ? 'ubi' : 'goclawnchme';

            // Validate title
            if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
                return res.status(400).json({ error: 'Title must be 3-100 characters' });
            }

            // Validate description
            if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 5000) {
                return res.status(400).json({ error: 'Description must be 10-5000 characters' });
            }

            // Validate amount
            const amount = Number(amount_requested);
            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Amount must be greater than 0' });
            }

            // Check max 1 open per wallet per type
            const { data: existing } = await supabase
                .from('inclawbate_ubi_requests')
                .select('id')
                .eq('wallet_address', w)
                .eq('status', 'open')
                .eq('request_type', rtype)
                .limit(1);

            if (existing && existing.length > 0) {
                return res.status(409).json({ error: 'You already have an open ' + (rtype === 'ubi' ? 'UBI request' : 'fundraiser') + '. Close it before creating a new one.' });
            }

            // Validate socials (optional, object with string values)
            let cleanSocials = null;
            if (socials && typeof socials === 'object') {
                cleanSocials = {};
                const allowedKeys = ['x', 'instagram', 'youtube', 'discord', 'telegram', 'github'];
                for (const k of allowedKeys) {
                    if (socials[k] && typeof socials[k] === 'string') {
                        cleanSocials[k] = socials[k].trim().substring(0, 200);
                    }
                }
                if (Object.keys(cleanSocials).length === 0) cleanSocials = null;
            }

            const { data: created, error } = await supabase
                .from('inclawbate_ubi_requests')
                .insert({
                    wallet_address: w,
                    title: title.trim(),
                    description: description.trim(),
                    amount_requested: amount,
                    request_type: rtype,
                    ...(cleanSocials ? { socials: cleanSocials } : {})
                })
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to create request' });
            }

            return res.status(200).json({ success: true, request: created });
        }

        if (action === 'comment') {
            const { request_id, comment } = req.body;

            if (!request_id) {
                return res.status(400).json({ error: 'request_id required' });
            }

            if (!comment || typeof comment !== 'string' || comment.trim().length < 1 || comment.trim().length > 1000) {
                return res.status(400).json({ error: 'Comment must be 1-1000 characters' });
            }

            // Verify request exists and is open
            const { data: request } = await supabase
                .from('inclawbate_ubi_requests')
                .select('id, status')
                .eq('id', request_id)
                .single();

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }
            if (request.status !== 'open') {
                return res.status(400).json({ error: 'Cannot comment on a closed request' });
            }

            const { data: created, error } = await supabase
                .from('inclawbate_ubi_request_comments')
                .insert({
                    request_id: request_id,
                    wallet_address: w,
                    comment: comment.trim()
                })
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to add comment' });
            }

            return res.status(200).json({ success: true, comment: created });
        }

        if (action === 'fund') {
            const { request_id, amount, tx_hash } = req.body;

            if (!request_id) {
                return res.status(400).json({ error: 'request_id required' });
            }

            const fundAmount = Number(amount);
            if (!fundAmount || fundAmount <= 0) {
                return res.status(400).json({ error: 'Amount must be greater than 0' });
            }

            if (!tx_hash || typeof tx_hash !== 'string') {
                return res.status(400).json({ error: 'tx_hash required' });
            }

            // Verify request exists and is open
            const { data: request } = await supabase
                .from('inclawbate_ubi_requests')
                .select('id, status, total_funded, wallet_address')
                .eq('id', request_id)
                .single();

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }
            if (request.status !== 'open') {
                return res.status(400).json({ error: 'Cannot fund a closed request' });
            }

            // Update total_funded
            const newTotal = (Number(request.total_funded) || 0) + fundAmount;
            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_requests')
                .update({ total_funded: newTotal, updated_at: new Date().toISOString() })
                .eq('id', request_id);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to record funding' });
            }

            // Auto-post a comment recording the funding
            await supabase
                .from('inclawbate_ubi_request_comments')
                .insert({
                    request_id: request_id,
                    wallet_address: w,
                    comment: 'Funded ' + fundAmount.toLocaleString() + ' CLAWNCH (tx: ' + tx_hash.substring(0, 10) + '...)'
                });

            return res.status(200).json({ success: true, total_funded: newTotal });
        }

        if (action === 'close') {
            const { request_id } = req.body;

            if (!request_id) {
                return res.status(400).json({ error: 'request_id required' });
            }

            // Verify ownership
            const { data: request } = await supabase
                .from('inclawbate_ubi_requests')
                .select('id, wallet_address, status')
                .eq('id', request_id)
                .single();

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }
            if (request.wallet_address !== w) {
                return res.status(403).json({ error: 'Only the author can close this request' });
            }
            if (request.status !== 'open') {
                return res.status(400).json({ error: 'Request is already closed' });
            }

            const { error } = await supabase
                .from('inclawbate_ubi_requests')
                .update({ status: 'closed', updated_at: new Date().toISOString() })
                .eq('id', request_id);

            if (error) {
                return res.status(500).json({ error: 'Failed to close request' });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown action. Use create, comment, or close.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function getHandles(wallets) {
    if (wallets.length === 0) return {};
    const { data } = await supabase
        .from('human_profiles')
        .select('wallet_address, x_handle')
        .in('wallet_address', wallets);

    const map = {};
    for (const row of (data || [])) {
        if (row.x_handle) map[row.wallet_address] = row.x_handle;
    }
    return map;
}
