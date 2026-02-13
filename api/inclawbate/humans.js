// Inclawbate — Human Profiles API
// GET  /api/inclawbate/humans           — list/search profiles
// GET  /api/inclawbate/humans?handle=x  — get single profile by handle
// POST /api/inclawbate/humans           — update own profile (authed)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUBLIC_FIELDS = 'id,x_handle,x_name,x_avatar_url,bio,tagline,skills,wallet_address,available_capacity,availability,response_time,timezone,portfolio_links,hire_count,telegram_chat_id,metadata,created_at,updated_at,airdrop_banned,ubi_total_received';

const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list or fetch single profile
    if (req.method === 'GET') {
        try {
            const { handle, search, skill, availability, sort, offset, limit, include_banned, philanthropy } = req.query;

            // Philanthropy recipients only
            if (philanthropy === 'true') {
                const { data, error } = await supabase
                    .from('human_profiles')
                    .select('id,x_handle,x_name,x_avatar_url,wallet_address,philanthropy_note,is_philanthropy_recipient')
                    .eq('is_philanthropy_recipient', true)
                    .not('wallet_address', 'is', null);

                if (error) return res.status(500).json({ error: 'Failed to fetch philanthropy recipients' });
                return res.status(200).json({ profiles: data || [] });
            }

            // Single profile by handle
            if (handle) {
                const { data, error } = await supabase
                    .from('human_profiles')
                    .select(PUBLIC_FIELDS)
                    .eq('x_handle', handle.toLowerCase())
                    .single();

                if (error || !data) {
                    return res.status(404).json({ error: 'Profile not found' });
                }

                // Calculate capacity allocation from all payments
                const { data: convos } = await supabase
                    .from('inclawbate_conversations')
                    .select('agent_address, agent_name, payment_amount')
                    .eq('human_id', data.id);

                const agentTotals = {};
                (convos || []).forEach(c => {
                    const addr = c.agent_address;
                    if (!agentTotals[addr]) {
                        agentTotals[addr] = { agent_address: addr, agent_name: c.agent_name, total_paid: 0 };
                    }
                    agentTotals[addr].total_paid += parseFloat(c.payment_amount) || 0;
                    if (c.agent_name) agentTotals[addr].agent_name = c.agent_name;
                });

                const agents = Object.values(agentTotals);
                const totalPaid = agents.reduce((sum, a) => sum + a.total_paid, 0);

                const allocation = agents
                    .map(a => ({
                        agent_address: a.agent_address,
                        agent_name: a.agent_name,
                        total_paid: a.total_paid,
                        share: totalPaid > 0 ? Math.round((a.total_paid / totalPaid) * 100) : 0
                    }))
                    .filter(a => a.share >= 1)
                    .sort((a, b) => b.share - a.share);

                return res.status(200).json({ profile: data, allocation, total_allocated: totalPaid });
            }

            // List profiles
            let query = supabase
                .from('human_profiles')
                .select(PUBLIC_FIELDS, { count: 'exact' });

            // Filter out banned accounts unless admin requests them
            if (include_banned !== 'true') {
                query = query.eq('airdrop_banned', false);
            }

            // Search by name or handle — sanitize to prevent filter injection
            if (search) {
                const safe = String(search).replace(/[%_,().]/g, '').slice(0, 100);
                if (safe) {
                    query = query.or(`x_handle.ilike.%${safe}%,x_name.ilike.%${safe}%,bio.ilike.%${safe}%,tagline.ilike.%${safe}%`);
                }
            }

            // Filter by skill
            if (skill) {
                query = query.contains('skills', [skill]);
            }

            // Filter by availability
            if (availability) {
                query = query.eq('availability', availability);
            }

            // Pagination params
            const lim = Math.min(parseInt(limit) || 48, 100);
            const off = parseInt(offset) || 0;

            // Get total CLAWNCH paid to each human (for all sort modes)
            const { data: convos } = await supabase
                .from('inclawbate_conversations')
                .select('human_id, payment_amount');

            const paidMap = {};
            (convos || []).forEach(c => {
                if (!c.human_id) return;
                paidMap[c.human_id] = (paidMap[c.human_id] || 0) + (parseFloat(c.payment_amount) || 0);
            });

            function attachPaid(profiles) {
                return profiles.map(p => ({ ...p, total_paid: paidMap[p.id] || 0 }));
            }

            // Sort by wallet connected (wallet first, then newest)
            if (sort === 'wallet') {
                const { data: allProfiles, error: allErr } = await query.order('created_at', { ascending: false });
                if (allErr) {
                    return res.status(500).json({ error: 'Failed to fetch profiles' });
                }
                const sorted = attachPaid(allProfiles || []).sort((a, b) => {
                    const aHas = a.wallet_address ? 1 : 0;
                    const bHas = b.wallet_address ? 1 : 0;
                    return bHas - aHas;
                });
                const total = sorted.length;
                const page = sorted.slice(off, off + lim);
                return res.status(200).json({ profiles: page, total, hasMore: (off + lim) < total });
            }

            // Sort by earnings
            if (sort === 'earnings') {
                const { data: allProfiles, error: allErr } = await query.order('created_at', { ascending: false });
                if (allErr) {
                    return res.status(500).json({ error: 'Failed to fetch profiles' });
                }

                const withEarnings = attachPaid(allProfiles || []);
                withEarnings.sort((a, b) => b.total_paid - a.total_paid);

                const total = withEarnings.length;
                const page = withEarnings.slice(off, off + lim);

                return res.status(200).json({
                    profiles: page,
                    total,
                    hasMore: (off + lim) < total
                });
            }

            // Standard sorting
            const sortField = sort === 'oldest' ? 'created_at' : sort === 'alpha' ? 'x_handle' : sort === 'hires' ? 'hire_count' : 'created_at';
            const sortAsc = sort === 'oldest' || sort === 'alpha';
            query = query.order(sortField, { ascending: sortAsc });

            query = query.range(off, off + lim - 1);

            const { data, count, error } = await query;

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch profiles' });
            }

            return res.status(200).json({
                profiles: attachPaid(data || []),
                total: count || 0,
                hasMore: (off + lim) < (count || 0)
            });

        } catch (err) {
            // GET error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — update own profile or admin actions
    if (req.method === 'POST') {
        // Admin ban/unban action
        if (req.body?.action === 'ban') {
            const { wallet_address, x_handle, banned } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!x_handle) {
                return res.status(400).json({ error: 'x_handle required' });
            }

            const { data, error } = await supabase
                .from('human_profiles')
                .update({ airdrop_banned: banned !== false })
                .eq('x_handle', x_handle.toLowerCase())
                .select('x_handle, airdrop_banned')
                .single();

            if (error || !data) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            return res.status(200).json({ success: true, x_handle: data.x_handle, airdrop_banned: data.airdrop_banned });
        }

        // Admin set/unset philanthropy recipient
        if (req.body?.action === 'set-philanthropy') {
            const { wallet_address, x_handle, is_recipient, note } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!x_handle) {
                return res.status(400).json({ error: 'x_handle required' });
            }

            const updates = { is_philanthropy_recipient: is_recipient !== false };
            if (note !== undefined) updates.philanthropy_note = note ? String(note).slice(0, 500) : null;

            const { data, error } = await supabase
                .from('human_profiles')
                .update(updates)
                .eq('x_handle', x_handle.toLowerCase())
                .select('x_handle, is_philanthropy_recipient, philanthropy_note')
                .single();

            if (error || !data) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            return res.status(200).json({ success: true, ...data });
        }

        try {
            const user = authenticateRequest(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const {
                tagline, bio, skills,
                wallet_address, available_capacity,
                availability, creative_freedom
            } = req.body;

            const updates = {};
            if (tagline !== undefined) updates.tagline = String(tagline).slice(0, 200);
            if (bio !== undefined) updates.bio = String(bio).slice(0, 2000);
            if (skills !== undefined && Array.isArray(skills)) updates.skills = skills.slice(0, 20).map(s => String(s).slice(0, 50).toLowerCase());
            if (wallet_address !== undefined) {
                if (wallet_address && !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
                    return res.status(400).json({ error: 'Invalid wallet address format' });
                }
                updates.wallet_address = wallet_address || null;
            }
            if (available_capacity !== undefined) updates.available_capacity = Math.max(0, Math.min(100, parseInt(available_capacity) || 100));
            if (availability !== undefined && ['available', 'busy', 'unavailable'].includes(availability)) updates.availability = availability;
            if (creative_freedom !== undefined && ['full', 'guided', 'strict'].includes(creative_freedom)) updates.creative_freedom = creative_freedom;
            if (req.body.response_time !== undefined && ['under_1h', 'under_4h', 'under_24h', 'under_48h'].includes(req.body.response_time)) updates.response_time = req.body.response_time;
            if (req.body.timezone !== undefined) updates.timezone = String(req.body.timezone).slice(0, 100) || null;
            if (req.body.portfolio_links !== undefined && Array.isArray(req.body.portfolio_links)) {
                updates.portfolio_links = req.body.portfolio_links
                    .slice(0, 3)
                    .map(u => String(u).slice(0, 500))
                    .filter(u => /^https?:\/\/.+/.test(u));
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            const { data, error } = await supabase
                .from('human_profiles')
                .update(updates)
                .eq('id', user.sub)
                .select(PUBLIC_FIELDS)
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to update profile' });
            }

            return res.status(200).json({ success: true, profile: data });

        } catch (err) {
            // POST error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
