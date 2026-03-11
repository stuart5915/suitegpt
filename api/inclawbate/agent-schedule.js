// Agent Schedule API — Book/view/cancel @inclawbator tweet slots
// GET  ?start=ISO&end=ISO  — list slots in date range
// POST {action:"book"}     — book a slot (JWT auth)
// POST {action:"cancel"}   — cancel your slot (JWT auth)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500',
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SLOTS_PER_DAY = 12;
const CREDIT_COST = 10;
const MAX_DAYS_AHEAD = 7;

// Valid slot hours (UTC): every 2 hours
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

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
        // Include project info if joined
        project_name: s.projects?.name || null,
        project_logo: s.projects?.logo_url || null,
        project_slug: s.projects?.slug || null,
        project_symbol: s.projects?.token_symbol || null,
        booked_by_wallet: s.booked_by_wallet,
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

        const { data, error } = await supabase
            .from('agent_schedule')
            .select('*, projects(name, logo_url, slug, token_symbol)')
            .gte('scheduled_at', start)
            .lte('scheduled_at', end)
            .in('status', ['scheduled', 'posted'])
            .order('scheduled_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ slots: (data || []).map(sanitizeSlot) });
    }

    // POST — actions
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Sign in to book slots' });

        const { action } = req.body || {};
        const wallet = (user.wallet_address || '').toLowerCase();

        // ── Book a slot ──
        if (action === 'book') {
            const { project_id, scheduled_at, content_angle, tone, catchphrase } = req.body;

            if (!project_id || !scheduled_at) {
                return res.status(400).json({ error: 'project_id and scheduled_at required' });
            }

            // Validate project exists
            const { data: project } = await supabase
                .from('projects')
                .select('id, name, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });

            // Only project owner can book slots for their project
            if (project.creator_wallet !== wallet) {
                return res.status(403).json({ error: 'Only the project owner can book slots' });
            }

            // Validate time slot
            const slotDate = new Date(scheduled_at);
            if (isNaN(slotDate.getTime())) return res.status(400).json({ error: 'Invalid date' });

            // Must be a valid 2-hour slot
            if (!VALID_HOURS.includes(slotDate.getUTCHours()) || slotDate.getUTCMinutes() !== 0) {
                return res.status(400).json({ error: 'Slots are every 2 hours on the hour (UTC)' });
            }

            // Must be in the future
            if (slotDate.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot book slots in the past' });
            }

            // Must be within 7 days
            if (slotDate.getTime() > Date.now() + MAX_DAYS_AHEAD * 86400000) {
                return res.status(400).json({ error: 'Cannot book more than 7 days ahead' });
            }

            // Check credits
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('id, credits, wallet_address')
                .eq('wallet_address', wallet)
                .single();

            const FREE_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
            const isFree = FREE_WALLETS.includes(wallet);

            if (!isFree && (!profile || (profile.credits || 0) < CREDIT_COST)) {
                return res.status(402).json({ error: 'Insufficient CLAWS. Need ' + CREDIT_COST + ' credits.' });
            }

            // Try to insert (unique constraint prevents double-booking)
            const { data: slot, error: insertErr } = await supabase
                .from('agent_schedule')
                .insert({
                    project_id,
                    booked_by_wallet: wallet,
                    scheduled_at: slotDate.toISOString(),
                    content_angle: (content_angle || '').slice(0, 200) || null,
                    tone: ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default',
                    catchphrase: (catchphrase || '').slice(0, 100) || null,
                    credits_cost: CREDIT_COST,
                    status: 'scheduled'
                })
                .select()
                .single();

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This slot is already booked' });
                }
                return res.status(500).json({ error: insertErr.message });
            }

            // Deduct credits
            if (!isFree && profile) {
                await supabase
                    .from('human_profiles')
                    .update({ credits: Math.max(0, (profile.credits || 0) - CREDIT_COST) })
                    .eq('id', profile.id);
            }

            return res.status(201).json({ slot: sanitizeSlot(slot) });
        }

        // ── Cancel a slot ──
        if (action === 'cancel') {
            const { slot_id } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .eq('status', 'scheduled')
                .single();

            if (!slot) return res.status(404).json({ error: 'Slot not found or already posted' });

            // Only the booker can cancel
            if (slot.booked_by_wallet !== wallet) {
                return res.status(403).json({ error: 'Not your slot' });
            }

            // Must be in the future
            if (new Date(slot.scheduled_at).getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot cancel past slots' });
            }

            await supabase
                .from('agent_schedule')
                .update({ status: 'cancelled' })
                .eq('id', slot_id);

            // Refund credits
            const FREE_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
            if (!FREE_WALLETS.includes(wallet)) {
                const { data: profile } = await supabase
                    .from('human_profiles')
                    .select('id, credits')
                    .eq('wallet_address', wallet)
                    .single();

                if (profile) {
                    await supabase
                        .from('human_profiles')
                        .update({ credits: (profile.credits || 0) + (slot.credits_cost || CREDIT_COST) })
                        .eq('id', profile.id);
                }
            }

            return res.status(200).json({ cancelled: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
