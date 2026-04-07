// Agent Schedule API — Book/view/cancel @inclawbator tweet slots (free)
// GET  ?start=ISO&end=ISO  — list slots in date range
// POST {action:"book"}     — book a slot (JWT auth, free)
// POST {action:"cancel"}   — cancel your slot (JWT auth)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500',
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_DAYS_AHEAD = 7;
const MAX_ACTIVE_BOOKINGS = 3;
const VALID_HOURS = [13, 18, 23]; // Default: 3 posts/day: 9 AM ET, 2 PM ET, 7 PM ET
const ACCOUNT_HOURS = {
    'inclawbate': [13, 18, 23],
    'inclawbator': [13, 18, 23],
    'publicgoodstech': [13, 16, 20, 23],
};

const FREE_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];

// ── Slot sanitizer ──

function sanitizeSlot(s) {
    if (!s) return s;
    return {
        id: s.id,
        project_id: s.project_id,
        scheduled_at: s.scheduled_at,
        content_angle: s.content_angle,
        tone: s.tone,
        status: s.status,
        tweet_text: s.tweet_text,
        tweet_id: s.tweet_id,
        created_at: s.created_at,
        project_name: s.projects?.name || null,
        project_logo: s.projects?.logo_url || null,
        project_slug: s.projects?.slug || null,
        project_symbol: s.projects?.token_symbol || null,
        booked_by_wallet: s.booked_by_wallet,
        paid_amount: s.paid_amount || 0,
        tweet_options: s.tweet_options || {},
        account: s.account || 'inclawbator',
    };
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — list schedule
    if (req.method === 'GET') {
        const start = req.query.start || new Date().toISOString();
        const end = req.query.end || new Date(Date.now() + MAX_DAYS_AHEAD * 86400000).toISOString();
        const account = req.query.account || 'inclawbator';

        // Admin review queue
        if (req.query.pending === 'true') {
            const { data, error } = await supabase
                .from('agent_schedule')
                .select('*, projects(name, logo_url, slug, token_symbol)')
                .eq('status', 'pending_review')
                .eq('account', account)
                .order('scheduled_at', { ascending: true });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ slots: (data || []).map(sanitizeSlot) });
        }

        const { data, error } = await supabase
            .from('agent_schedule')
            .select('*, projects(name, logo_url, slug, token_symbol)')
            .gte('scheduled_at', start)
            .lte('scheduled_at', end)
            .eq('account', account)
            .in('status', ['scheduled', 'posted', 'needs_review', 'needs_image', 'pending_review', 'expired', 'failed'])
            .order('scheduled_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ slots: (data || []).map(sanitizeSlot) });
    }

    // POST — actions
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Sign in to book slots' });

        const { action } = req.body || {};

        // JWT doesn't contain wallet_address — look it up from human_profiles
        let wallet = '';
        if (user.sub) {
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('wallet_address')
                .eq('id', user.sub)
                .single();
            wallet = (profile?.wallet_address || '').toLowerCase();
        }
        if (!wallet) {
            return res.status(400).json({ error: 'No wallet linked to your account. Connect your wallet in the dashboard first.' });
        }

        // ── Book a slot ──
        if (action === 'book') {
            const { project_id, scheduled_at, content_angle, tone, catchphrase, tx_hash, tweet_options, tweet_text, account: reqAccount } = req.body;
            const bookAccount = ['inclawbator', 'inclawbate', 'publicgoodstech'].includes(reqAccount) ? reqAccount : 'inclawbator';
            const isAdmin = FREE_WALLETS.includes(wallet);

            if (!scheduled_at) {
                return res.status(400).json({ error: 'scheduled_at required' });
            }
            if (!tweet_text || tweet_text.trim().length === 0) {
                return res.status(400).json({ error: 'Tweet text is required' });
            }
            if (tweet_text.length > 4000) {
                return res.status(400).json({ error: 'Tweet must be 4,000 characters or less' });
            }

            // Validate project if provided (optional — community members can book without one)
            if (project_id) {
                const { data: project } = await supabase
                    .from('projects')
                    .select('id, name, creator_wallet')
                    .eq('id', project_id)
                    .single();

                if (!project) return res.status(404).json({ error: 'Project not found' });
                if (project.creator_wallet !== wallet && !isAdmin) {
                    return res.status(403).json({ error: 'Only the project owner can book slots for this project' });
                }
            }

            // Validate time
            const slotDate = new Date(scheduled_at);
            if (isNaN(slotDate.getTime())) return res.status(400).json({ error: 'Invalid date' });
            const allowedHours = ACCOUNT_HOURS[bookAccount] || VALID_HOURS;
            if (!allowedHours.includes(slotDate.getUTCHours()) || slotDate.getUTCMinutes() !== 0) {
                return res.status(400).json({ error: 'Invalid slot time. Slots are at peak hours only.' });
            }
            if (slotDate.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot book slots in the past' });
            }
            if (slotDate.getTime() > Date.now() + MAX_DAYS_AHEAD * 86400000) {
                return res.status(400).json({ error: 'Cannot book more than 7 days ahead' });
            }

            // Free for everyone — no CLAWS payment required
            let paidClaws = 0;

            // Check active booking limit
            const { count } = await supabase
                .from('agent_schedule')
                .select('id', { count: 'exact', head: true })
                .eq('booked_by_wallet', wallet)
                .in('status', ['scheduled', 'pending_review']);

            if ((count || 0) >= MAX_ACTIVE_BOOKINGS) {
                return res.status(429).json({ error: 'Max ' + MAX_ACTIVE_BOOKINGS + ' active bookings. Cancel one first.' });
            }

            // Insert slot
            const insertData = {
                booked_by_wallet: wallet,
                scheduled_at: slotDate.toISOString(),
                content_angle: (content_angle || '').slice(0, 200) || null,
                tone: ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default',
                catchphrase: (catchphrase || '').slice(0, 100) || null,
                status: isAdmin ? 'scheduled' : 'pending_review',
                paid_amount: paidClaws,
                tweet_options: tweet_options || {},
                account: bookAccount,
            };
            if (project_id) insertData.project_id = project_id;
            if (tweet_text) insertData.tweet_text = tweet_text.trim();
            if (tx_hash) insertData.tx_hash = tx_hash;

            const { data: slot, error: insertErr } = await supabase
                .from('agent_schedule')
                .insert(insertData)
                .select()
                .single();

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This slot is already booked' });
                }
                return res.status(500).json({ error: insertErr.message });
            }

            return res.status(201).json({ slot: sanitizeSlot(slot) });
        }

        // ── Edit a slot ──
        if (action === 'edit') {
            const { slot_id, content_angle, tone, tweet_options, tweet_text } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .in('status', ['scheduled', 'pending_review'])
                .single();

            if (!slot) return res.status(404).json({ error: 'Slot not found or already posted' });
            const isAdmin = FREE_WALLETS.includes(wallet);
            if (slot.booked_by_wallet !== wallet && !isAdmin) {
                return res.status(403).json({ error: 'Not your slot' });
            }
            if (!isAdmin && slot.status === 'scheduled') {
                return res.status(403).json({ error: 'Cannot edit an approved slot' });
            }
            if (new Date(slot.scheduled_at).getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot edit past slots' });
            }

            const updates = {};
            if (content_angle !== undefined) updates.content_angle = (content_angle || '').slice(0, 200) || null;
            if (tone !== undefined) updates.tone = ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default';
            if (tweet_options !== undefined) updates.tweet_options = tweet_options || {};
            if (tweet_text !== undefined) {
                if (tweet_text.length > 4000) return res.status(400).json({ error: 'Tweet must be 4,000 characters or less' });
                updates.tweet_text = tweet_text.trim();
            }

            const { error: updateErr } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id);

            if (updateErr) return res.status(500).json({ error: updateErr.message });
            return res.status(200).json({ updated: true });
        }

        // Takeover removed — slots are free now
        if (action === 'takeover') {
            return res.status(400).json({ error: 'Takeover is no longer available. Slots are free — book an open one!' });
        }

        // ── Cancel a slot ──
        if (action === 'cancel') {
            const { slot_id } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .in('status', ['scheduled', 'pending_review'])
                .single();

            if (!slot) return res.status(404).json({ error: 'Slot not found or already posted' });
            if (slot.booked_by_wallet !== wallet && !FREE_WALLETS.includes(wallet)) {
                return res.status(403).json({ error: 'Not your slot' });
            }
            if (new Date(slot.scheduled_at).getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot cancel past slots' });
            }

            await supabase
                .from('agent_schedule')
                .update({ status: 'cancelled' })
                .eq('id', slot_id);

            return res.status(200).json({ cancelled: true });
        }

        // ── Review a pending slot (admin only) ──
        if (action === 'review') {
            if (!FREE_WALLETS.includes(wallet)) {
                return res.status(403).json({ error: 'Admin only' });
            }
            const { slot_id, decision, tweet_text } = req.body;
            if (!slot_id || !decision) return res.status(400).json({ error: 'slot_id and decision required' });
            if (!['approve', 'reject'].includes(decision)) {
                return res.status(400).json({ error: 'decision must be approve or reject' });
            }

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .eq('status', 'pending_review')
                .single();

            if (!slot) return res.status(404).json({ error: 'Slot not found or not pending review' });

            const updates = {};
            if (decision === 'approve') {
                updates.status = 'scheduled';
                if (tweet_text && tweet_text.trim().length > 0 && tweet_text.length <= 4000) {
                    updates.tweet_text = tweet_text.trim();
                }
            } else {
                updates.status = 'rejected';
            }

            const { error: updateErr } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id);

            if (updateErr) return res.status(500).json({ error: updateErr.message });
            return res.status(200).json({ updated: true, status: updates.status });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
