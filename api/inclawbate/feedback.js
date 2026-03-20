// Community Feedback Board API
// GET  ?status=open           — list feedback (optional status filter)
// GET  ?wallet=0x...          — list user's feedback
// POST action:"submit"        — submit feedback (JWT auth, 1 per 24h)
// POST action:"vote"          — upvote (JWT auth, 1 per idea per wallet)
// POST action:"reply"         — admin reply + status change (admin only)
// POST action:"delete"        — delete feedback (admin or owner)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500',
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
const MAX_TITLE_LENGTH = 100;
const MAX_DESC_LENGTH = 500;
const MAX_REPLY_LENGTH = 500;
const COOLDOWN_HOURS = 24;

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    // ── GET — list feedback ──
    if (req.method === 'GET') {
        const { status, wallet } = req.query;

        let query = supabase
            .from('community_feedback')
            .select('*')
            .order('vote_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100);

        if (status && ['open', 'building', 'shipped', 'closed'].includes(status)) {
            query = query.eq('status', status);
        }

        if (wallet) {
            query = query.eq('wallet', wallet.toLowerCase());
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        // Mask wallets for privacy
        const items = (data || []).map(f => ({
            ...f,
            wallet_short: f.wallet ? f.wallet.slice(0, 6) + '…' + f.wallet.slice(-4) : '???',
        }));

        // If user is authenticated, include their votes
        const user = authenticateRequest(req);
        if (user) {
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (userWallet) {
                const { data: votes } = await supabase
                    .from('community_votes')
                    .select('feedback_id')
                    .eq('wallet', userWallet);

                const votedIds = new Set((votes || []).map(v => v.feedback_id));
                items.forEach(f => { f.user_voted = votedIds.has(f.id); });
            }
        }

        return res.status(200).json({ feedback: items });
    }

    // ── POST — actions ──
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Sign in first' });

        const wallet = (user.wallet_address || '').toLowerCase();
        if (!wallet) {
            // Try profile lookup
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('wallet_address')
                .eq('id', user.sub)
                .single();
            if (!profile?.wallet_address) {
                return res.status(400).json({ error: 'Connect a wallet first' });
            }
            var userWallet = profile.wallet_address.toLowerCase();
        } else {
            var userWallet = wallet;
        }

        const isAdmin = ADMIN_WALLETS.includes(userWallet);
        const { action } = req.body;

        // ── Submit feedback ──
        if (action === 'submit') {
            const { title, description } = req.body;

            const trimTitle = (title || '').trim();
            if (!trimTitle || trimTitle.length < 5) {
                return res.status(400).json({ error: 'Title too short (min 5 characters)' });
            }
            if (trimTitle.length > MAX_TITLE_LENGTH) {
                return res.status(400).json({ error: 'Title too long (max ' + MAX_TITLE_LENGTH + ')' });
            }

            const trimDesc = (description || '').trim();
            if (trimDesc.length > MAX_DESC_LENGTH) {
                return res.status(400).json({ error: 'Description too long (max ' + MAX_DESC_LENGTH + ')' });
            }

            // Rate limit: 1 submission per 24 hours (admins exempt)
            if (!isAdmin) {
                const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600000).toISOString();
                const { count } = await supabase
                    .from('community_feedback')
                    .select('id', { count: 'exact', head: true })
                    .eq('wallet', userWallet)
                    .gte('created_at', cutoff);

                if ((count || 0) >= 1) {
                    return res.status(429).json({ error: 'You can submit 1 request per 24 hours. Try again later.' });
                }
            }

            const { data, error } = await supabase
                .from('community_feedback')
                .insert({
                    title: trimTitle,
                    description: trimDesc || null,
                    wallet: userWallet,
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });

            // Auto-upvote your own submission
            await supabase.from('community_votes').insert({
                feedback_id: data.id,
                wallet: userWallet,
            });
            await supabase
                .from('community_feedback')
                .update({ vote_count: 1 })
                .eq('id', data.id);

            data.vote_count = 1;
            data.user_voted = true;
            data.wallet_short = userWallet.slice(0, 6) + '…' + userWallet.slice(-4);

            return res.status(201).json({ feedback: data });
        }

        // ── Vote ──
        if (action === 'vote') {
            const { feedback_id } = req.body;
            if (!feedback_id) return res.status(400).json({ error: 'feedback_id required' });

            // Check exists
            const { data: existing } = await supabase
                .from('community_feedback')
                .select('id, vote_count')
                .eq('id', feedback_id)
                .single();

            if (!existing) return res.status(404).json({ error: 'Not found' });

            // Try insert vote (unique constraint catches duplicates)
            const { error: voteErr } = await supabase
                .from('community_votes')
                .insert({ feedback_id, wallet: userWallet });

            if (voteErr) {
                if (voteErr.code === '23505') {
                    return res.status(409).json({ error: 'Already voted' });
                }
                return res.status(500).json({ error: voteErr.message });
            }

            // Increment count
            const newCount = (existing.vote_count || 0) + 1;
            await supabase
                .from('community_feedback')
                .update({ vote_count: newCount })
                .eq('id', feedback_id);

            return res.status(200).json({ vote_count: newCount });
        }

        // ── Unvote ──
        if (action === 'unvote') {
            const { feedback_id } = req.body;
            if (!feedback_id) return res.status(400).json({ error: 'feedback_id required' });

            const { data: vote } = await supabase
                .from('community_votes')
                .select('id')
                .eq('feedback_id', feedback_id)
                .eq('wallet', userWallet)
                .single();

            if (!vote) return res.status(404).json({ error: 'No vote to remove' });

            await supabase.from('community_votes').delete().eq('id', vote.id);

            // Decrement count
            const { data: fb } = await supabase
                .from('community_feedback')
                .select('vote_count')
                .eq('id', feedback_id)
                .single();

            const newCount = Math.max(0, (fb?.vote_count || 1) - 1);
            await supabase
                .from('community_feedback')
                .update({ vote_count: newCount })
                .eq('id', feedback_id);

            return res.status(200).json({ vote_count: newCount });
        }

        // ── Admin reply + status ──
        if (action === 'reply') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

            const { feedback_id, reply, status } = req.body;
            if (!feedback_id) return res.status(400).json({ error: 'feedback_id required' });

            const update = {};
            if (reply !== undefined) {
                const trimReply = (reply || '').trim();
                if (trimReply.length > MAX_REPLY_LENGTH) {
                    return res.status(400).json({ error: 'Reply too long' });
                }
                update.admin_reply = trimReply || null;
                update.admin_reply_at = new Date().toISOString();
            }
            if (status && ['open', 'building', 'shipped', 'closed'].includes(status)) {
                update.status = status;
            }

            if (!Object.keys(update).length) {
                return res.status(400).json({ error: 'Nothing to update' });
            }

            const { data, error } = await supabase
                .from('community_feedback')
                .update(update)
                .eq('id', feedback_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ feedback: data });
        }

        // ── Delete ──
        if (action === 'delete') {
            const { feedback_id } = req.body;
            if (!feedback_id) return res.status(400).json({ error: 'feedback_id required' });

            const { data: fb } = await supabase
                .from('community_feedback')
                .select('wallet')
                .eq('id', feedback_id)
                .single();

            if (!fb) return res.status(404).json({ error: 'Not found' });
            if (fb.wallet !== userWallet && !isAdmin) {
                return res.status(403).json({ error: 'Not yours' });
            }

            await supabase.from('community_feedback').delete().eq('id', feedback_id);
            return res.status(200).json({ deleted: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
