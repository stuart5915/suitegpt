// Agent Schedule API — Book/view/cancel @inclawbator tweet slots
// Token-gated: hold CLAWS to book. No credits, no deductions.
// GET  ?start=ISO&end=ISO  — list slots in date range
// POST {action:"book"}     — book a slot (JWT auth + CLAWS balance gate)
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

const MAX_DAYS_AHEAD = 7;
const MIN_CLAWS = 50000;        // must hold at least 50K CLAWS
const MAX_ACTIVE_BOOKINGS = 3;  // per wallet

// Valid slot hours (UTC): every 2 hours
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

// Admin wallets bypass balance checks
const FREE_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];

// ── On-chain CLAWS balance check ──

const CLAWS_TOKEN = '0x7ca47B141639B893C6782823C0b219f872056379';
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function getClawsBalance(wallet) {
    const paddedAddr = '0x000000000000000000000000' + wallet.replace('0x', '').toLowerCase();
    const callData = '0x70a08231' + paddedAddr.replace('0x', '');

    for (const rpc of BASE_RPCS) {
        try {
            const resp = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1,
                    method: 'eth_call',
                    params: [{ to: CLAWS_TOKEN, data: callData }, 'latest']
                })
            });
            const data = await resp.json();
            if (data.result && data.result !== '0x') {
                const raw = BigInt(data.result);
                return Number(raw / BigInt(1e14)) / 10000; // 18 decimals
            }
            return 0;
        } catch (e) { continue; }
    }
    return 0;
}

function formatClaws(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.round(n).toLocaleString();
}

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

            if (!VALID_HOURS.includes(slotDate.getUTCHours()) || slotDate.getUTCMinutes() !== 0) {
                return res.status(400).json({ error: 'Slots are every 2 hours on the hour (UTC)' });
            }

            if (slotDate.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot book slots in the past' });
            }

            if (slotDate.getTime() > Date.now() + MAX_DAYS_AHEAD * 86400000) {
                return res.status(400).json({ error: 'Cannot book more than 7 days ahead' });
            }

            const isFree = FREE_WALLETS.includes(wallet);

            // Check on-chain CLAWS balance
            if (!isFree) {
                const balance = await getClawsBalance(wallet);
                if (balance < MIN_CLAWS) {
                    return res.status(402).json({
                        error: 'Hold at least ' + formatClaws(MIN_CLAWS) + ' CLAWS to book slots. You have ' + formatClaws(balance) + '.',
                        balance,
                        required: MIN_CLAWS
                    });
                }
            }

            // Check active booking limit
            if (!isFree) {
                const { count } = await supabase
                    .from('agent_schedule')
                    .select('id', { count: 'exact', head: true })
                    .eq('booked_by_wallet', wallet)
                    .eq('status', 'scheduled');

                if ((count || 0) >= MAX_ACTIVE_BOOKINGS) {
                    return res.status(429).json({
                        error: 'Max ' + MAX_ACTIVE_BOOKINGS + ' active bookings at a time. Cancel one to book another.'
                    });
                }
            }

            // Insert slot (unique constraint prevents double-booking)
            const { data: slot, error: insertErr } = await supabase
                .from('agent_schedule')
                .insert({
                    project_id,
                    booked_by_wallet: wallet,
                    scheduled_at: slotDate.toISOString(),
                    content_angle: (content_angle || '').slice(0, 200) || null,
                    tone: ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default',
                    catchphrase: (catchphrase || '').slice(0, 100) || null,
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

            if (slot.booked_by_wallet !== wallet) {
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

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
