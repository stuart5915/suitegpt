// Schedule Suggestions — community-sourced tweet ideas for @inclawbator
// GET  ?date=YYYY-MM-DD&hour=13     — list suggestions for a slot
// GET  ?wallet=0x...                 — list user's suggestions
// POST action:"suggest"              — submit a suggestion (JWT auth)
// POST action:"choose"               — pick a suggestion (JWT auth, slot booker only)

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

const VALID_HOURS = [13, 16, 18, 20, 23]; // Union of all account hours
const MAX_SUGGESTIONS_PER_SLOT = 20;
const MAX_SUGGESTION_LENGTH = 300;

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — list suggestions for a slot or by wallet
    if (req.method === 'GET') {
        const { date, hour, wallet } = req.query;

        // By slot
        if (date && hour) {
            const h = parseInt(hour);
            if (!VALID_HOURS.includes(h)) {
                return res.status(400).json({ error: 'Invalid hour' });
            }

            const { data, error } = await supabase
                .from('schedule_suggestions')
                .select('id, slot_date, slot_hour, wallet, suggestion_text, status, created_at')
                .eq('slot_date', date)
                .eq('slot_hour', h)
                .order('created_at', { ascending: false })
                .limit(MAX_SUGGESTIONS_PER_SLOT);

            if (error) return res.status(500).json({ error: error.message });

            // Mask wallets for privacy (show first 6 + last 4)
            const masked = (data || []).map(s => ({
                ...s,
                wallet_short: s.wallet ? s.wallet.slice(0, 6) + '…' + s.wallet.slice(-4) : '???',
            }));

            return res.status(200).json({ suggestions: masked });
        }

        // By wallet
        if (wallet) {
            const { data, error } = await supabase
                .from('schedule_suggestions')
                .select('*')
                .eq('wallet', wallet.toLowerCase())
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ suggestions: data || [] });
        }

        // Recent suggestions across all slots (for the feed)
        const { data, error } = await supabase
            .from('schedule_suggestions')
            .select('id, slot_date, slot_hour, wallet, suggestion_text, status, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) return res.status(500).json({ error: error.message });

        const masked = (data || []).map(s => ({
            ...s,
            wallet_short: s.wallet ? s.wallet.slice(0, 6) + '…' + s.wallet.slice(-4) : '???',
        }));

        return res.status(200).json({ suggestions: masked });
    }

    // POST — actions
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Sign in first' });

        const { action } = req.body;

        // Submit a suggestion
        if (action === 'suggest') {
            const { date, hour, text } = req.body;

            if (!date || !hour || !text) {
                return res.status(400).json({ error: 'date, hour, and text are required' });
            }

            const h = parseInt(hour);
            if (!VALID_HOURS.includes(h)) {
                return res.status(400).json({ error: 'Invalid slot hour' });
            }

            const trimmed = (text || '').trim();
            if (!trimmed || trimmed.length < 10) {
                return res.status(400).json({ error: 'Suggestion too short (min 10 characters)' });
            }
            if (trimmed.length > MAX_SUGGESTION_LENGTH) {
                return res.status(400).json({ error: 'Suggestion too long (max ' + MAX_SUGGESTION_LENGTH + ' characters)' });
            }

            // Look up wallet from profile
            const wallet = (user.wallet_address || '').toLowerCase();
            if (!wallet) {
                // Try to find wallet from human_profiles
                const { data: profile } = await supabase
                    .from('human_profiles')
                    .select('wallet_address')
                    .eq('id', user.sub)
                    .single();
                if (!profile || !profile.wallet_address) {
                    return res.status(400).json({ error: 'Connect a wallet to your profile first' });
                }
                var walletAddr = profile.wallet_address.toLowerCase();
            } else {
                var walletAddr = wallet;
            }

            // Check if this slot is in the future
            const slotDate = new Date(date + 'T00:00:00Z');
            slotDate.setUTCHours(h);
            if (slotDate.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Cannot suggest for past slots' });
            }

            // Check suggestion limit per slot per wallet (max 2 per person per slot)
            const { count } = await supabase
                .from('schedule_suggestions')
                .select('id', { count: 'exact', head: true })
                .eq('slot_date', date)
                .eq('slot_hour', h)
                .eq('wallet', walletAddr);

            if (count >= 2) {
                return res.status(400).json({ error: 'Max 2 suggestions per slot' });
            }

            // Check total suggestions for this slot
            const { count: totalCount } = await supabase
                .from('schedule_suggestions')
                .select('id', { count: 'exact', head: true })
                .eq('slot_date', date)
                .eq('slot_hour', h);

            if (totalCount >= MAX_SUGGESTIONS_PER_SLOT) {
                return res.status(400).json({ error: 'This slot has max suggestions already' });
            }

            const { data: suggestion, error } = await supabase
                .from('schedule_suggestions')
                .insert({
                    slot_date: date,
                    slot_hour: h,
                    wallet: walletAddr,
                    suggestion_text: trimmed,
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ suggestion });
        }

        // Choose a suggestion (slot booker picks it)
        if (action === 'choose') {
            const { suggestion_id } = req.body;
            if (!suggestion_id) return res.status(400).json({ error: 'suggestion_id required' });

            const wallet = (user.wallet_address || '').toLowerCase();

            // Get the suggestion
            const { data: suggestion } = await supabase
                .from('schedule_suggestions')
                .select('*')
                .eq('id', suggestion_id)
                .single();

            if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

            // Update suggestion status
            const { data, error } = await supabase
                .from('schedule_suggestions')
                .update({
                    status: 'chosen',
                    chosen_at: new Date().toISOString(),
                    chosen_by: wallet,
                })
                .eq('id', suggestion_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ suggestion: data });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
