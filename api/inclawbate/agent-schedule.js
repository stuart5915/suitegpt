// Agent Schedule API — Book/view/cancel/takeover @inclawbator tweet slots
// Payment: user sends CLAWS to admin wallet, server verifies on-chain.
// GET  ?start=ISO&end=ISO  — list slots in date range
// POST {action:"book"}     — book a slot (JWT auth + on-chain CLAWS payment)
// POST {action:"takeover"} — outbid an existing slot (pay 2x what they paid)
// POST {action:"cancel"}   — cancel your slot (JWT auth, no refund)

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
const MAX_ACTIVE_BOOKINGS = 3;
const SLOT_COST_USD = 0.01;  // actual cost: ~$0.01 X API + ~$0.001 Haiku
const VALID_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const FREE_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const CLAWS_TOKEN = '0x7ca47b141639b893c6782823c0b219f872056379';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

// ── On-chain helpers ──

async function rpcCall(method, params) {
    for (const rpc of BASE_RPCS) {
        try {
            const resp = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { continue; }
    }
    return null;
}

async function getClawsPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_TOKEN);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            return parseFloat(data.pairs[0].priceUsd) || 0;
        }
    } catch (e) {}
    return 0;
}

async function verifyPayment(txHash, minClawsAmount) {
    // Get receipt (may need to wait for confirmation)
    let receipt = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!receipt) return { valid: false, error: 'Transaction not confirmed yet. Try again in a moment.' };
    if (receipt.status !== '0x1') return { valid: false, error: 'Transaction failed on-chain' };
    if (receipt.to?.toLowerCase() !== CLAWS_TOKEN) return { valid: false, error: 'Not a CLAWS token transfer' };

    // Find Transfer event to admin wallet
    const log = (receipt.logs || []).find(l =>
        l.topics?.[0] === TRANSFER_TOPIC &&
        l.topics?.[2]?.toLowerCase().endsWith(ADMIN_WALLET.replace('0x', ''))
    );

    if (!log) return { valid: false, error: 'Payment not sent to the correct wallet' };

    // Decode amount (18 decimals)
    const raw = BigInt(log.data);
    const amount = Number(raw / BigInt(1e14)) / 10000;

    if (amount < minClawsAmount * 0.9) {
        return { valid: false, error: 'Payment too low. Sent ' + amount.toFixed(0) + ' but need ' + minClawsAmount.toFixed(0) + ' CLAWS' };
    }

    return { valid: true, amount };
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
        paid_amount: s.paid_amount || 0,
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
            const { project_id, scheduled_at, content_angle, tone, catchphrase, tx_hash } = req.body;

            if (!project_id || !scheduled_at) {
                return res.status(400).json({ error: 'project_id and scheduled_at required' });
            }

            // Validate project
            const { data: project } = await supabase
                .from('projects')
                .select('id, name, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            if (project.creator_wallet !== wallet) {
                return res.status(403).json({ error: 'Only the project owner can book slots' });
            }

            // Validate time
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
            let paidClaws = 0;

            // Verify on-chain CLAWS payment (skip for admin)
            if (!isFree) {
                if (!tx_hash) {
                    return res.status(400).json({ error: 'Payment required. Send CLAWS to book.' });
                }

                // Check tx not already used
                const { count: txUsed } = await supabase
                    .from('agent_schedule')
                    .select('id', { count: 'exact', head: true })
                    .eq('tx_hash', tx_hash);

                if (txUsed > 0) {
                    return res.status(409).json({ error: 'This transaction was already used for a booking' });
                }

                // Get CLAWS price and verify payment amount
                const clawsPrice = await getClawsPrice();
                if (!clawsPrice) {
                    return res.status(503).json({ error: 'Could not fetch CLAWS price. Try again.' });
                }
                const minClaws = SLOT_COST_USD / clawsPrice;

                const verification = await verifyPayment(tx_hash, minClaws);
                if (!verification.valid) {
                    return res.status(402).json({ error: verification.error });
                }
                paidClaws = verification.amount;
            }

            // Check active booking limit
            if (!isFree) {
                const { count } = await supabase
                    .from('agent_schedule')
                    .select('id', { count: 'exact', head: true })
                    .eq('booked_by_wallet', wallet)
                    .eq('status', 'scheduled');

                if ((count || 0) >= MAX_ACTIVE_BOOKINGS) {
                    return res.status(429).json({ error: 'Max ' + MAX_ACTIVE_BOOKINGS + ' active bookings. Cancel one first.' });
                }
            }

            // Insert slot
            const insertData = {
                project_id,
                booked_by_wallet: wallet,
                scheduled_at: slotDate.toISOString(),
                content_angle: (content_angle || '').slice(0, 200) || null,
                tone: ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default',
                catchphrase: (catchphrase || '').slice(0, 100) || null,
                status: 'scheduled',
                paid_amount: paidClaws
            };
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
            const { slot_id, content_angle, tone } = req.body;
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
                return res.status(400).json({ error: 'Cannot edit past slots' });
            }

            const updates = {};
            if (content_angle !== undefined) updates.content_angle = (content_angle || '').slice(0, 200) || null;
            if (tone !== undefined) updates.tone = ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default';

            const { error: updateErr } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id);

            if (updateErr) return res.status(500).json({ error: updateErr.message });
            return res.status(200).json({ updated: true });
        }

        // ── Takeover a slot (outbid) ──
        if (action === 'takeover') {
            const { slot_id, project_id, content_angle, tone, tx_hash } = req.body;
            if (!slot_id || !project_id || !tx_hash) {
                return res.status(400).json({ error: 'slot_id, project_id, and tx_hash required' });
            }

            // Fetch the existing slot
            const { data: existing } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .eq('status', 'scheduled')
                .single();

            if (!existing) return res.status(404).json({ error: 'Slot not found or already posted' });

            // Can't takeover your own slot
            if (existing.booked_by_wallet === wallet) {
                return res.status(400).json({ error: 'You already own this slot. Use edit instead.' });
            }

            // Can't takeover admin/free wallet slots
            if (FREE_WALLETS.includes(existing.booked_by_wallet)) {
                return res.status(403).json({ error: 'This slot cannot be taken over.' });
            }

            // Must be 2+ hours before posting
            const slotTime = new Date(existing.scheduled_at).getTime();
            if (slotTime <= Date.now() + 2 * 3600000) {
                return res.status(400).json({ error: 'Slots lock 2 hours before posting. Too late to takeover.' });
            }

            // Validate project ownership
            const { data: project } = await supabase
                .from('projects')
                .select('id, name, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            if (project.creator_wallet !== wallet) {
                return res.status(403).json({ error: 'Only the project owner can book slots' });
            }

            // Check tx not already used
            const { count: txUsed } = await supabase
                .from('agent_schedule')
                .select('id', { count: 'exact', head: true })
                .eq('tx_hash', tx_hash);

            if (txUsed > 0) {
                return res.status(409).json({ error: 'This transaction was already used' });
            }

            // Must pay 2x the CLAWS amount current holder paid (minimum $0.01 worth)
            const currentPaidClaws = existing.paid_amount || 0;

            const clawsPrice = await getClawsPrice();
            if (!clawsPrice) {
                return res.status(503).json({ error: 'Could not fetch CLAWS price. Try again.' });
            }
            const minFromBase = SLOT_COST_USD / clawsPrice;
            const minClaws = Math.max(currentPaidClaws * 2, minFromBase);

            const verification = await verifyPayment(tx_hash, minClaws);
            if (!verification.valid) {
                return res.status(402).json({ error: verification.error });
            }

            // Find next available slot for the outbid person
            const now = Date.now();
            const maxTime = now + MAX_DAYS_AHEAD * 86400000;
            let movedTo = null;

            // Get all booked slots in the window
            const { data: bookedSlots } = await supabase
                .from('agent_schedule')
                .select('scheduled_at')
                .eq('status', 'scheduled')
                .gte('scheduled_at', new Date(now).toISOString())
                .lte('scheduled_at', new Date(maxTime).toISOString());

            const bookedTimes = new Set((bookedSlots || []).map(s => new Date(s.scheduled_at).getTime()));

            // Walk through every 2-hour slot starting from the current slot time
            for (let t = slotTime + 2 * 3600000; t < maxTime; t += 2 * 3600000) {
                const d = new Date(t);
                if (!VALID_HOURS.includes(d.getUTCHours())) continue;
                if (d.getTime() <= now) continue;
                if (!bookedTimes.has(d.getTime())) {
                    movedTo = d.toISOString();
                    break;
                }
            }

            // Update existing slot → takeover (replace with new booker)
            const { error: updateErr } = await supabase
                .from('agent_schedule')
                .update({
                    project_id,
                    booked_by_wallet: wallet,
                    content_angle: (content_angle || '').slice(0, 200) || null,
                    tone: ['hype', 'chill', 'degen', 'professional', 'meme'].includes(tone) ? tone : 'default',
                    tx_hash,
                    paid_amount: verification.amount
                })
                .eq('id', slot_id);

            if (updateErr) return res.status(500).json({ error: updateErr.message });

            // Move outbid person to next available slot (if one exists)
            let movedSlot = null;
            if (movedTo) {
                const { data: newSlot } = await supabase
                    .from('agent_schedule')
                    .insert({
                        project_id: existing.project_id,
                        booked_by_wallet: existing.booked_by_wallet,
                        scheduled_at: movedTo,
                        content_angle: existing.content_angle,
                        tone: existing.tone,
                        catchphrase: existing.catchphrase,
                        status: 'scheduled',
                        paid_amount: existing.paid_amount || 0
                    })
                    .select('*, projects(name, logo_url, slug, token_symbol)')
                    .single();

                movedSlot = newSlot ? sanitizeSlot(newSlot) : null;
            }
            // If no available slot, the outbid person just loses out (no refund — on-chain payment)

            // Return the updated slot
            const { data: updatedSlot } = await supabase
                .from('agent_schedule')
                .select('*, projects(name, logo_url, slug, token_symbol)')
                .eq('id', slot_id)
                .single();

            return res.status(200).json({
                slot: sanitizeSlot(updatedSlot),
                outbid_moved_to: movedSlot
            });
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
