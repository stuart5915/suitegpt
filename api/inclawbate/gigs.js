// Inclawbate — Gig Marketplace API
// GET  → list recent gigs (public)
// POST → create a new gig request (authed)
// PATCH → claim a gig / update status (authed)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
import { notifyHuman, escHtml } from './notify.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_CATEGORIES = ['design', 'dev', 'marketing', 'content', 'strategy', 'other'];
const VALID_TIMELINES = ['asap', 'week', 'norush'];
const CATEGORY_SKILLS = {
    design: ['design', 'ui', 'ux', 'logo', 'branding', 'graphics', 'figma', 'illustration'],
    dev: ['solidity', 'react', 'javascript', 'python', 'smart contract', 'web3', 'coding', 'development', 'java', 'rust', 'nft', 'baseapp'],
    marketing: ['marketing', 'growth', 'twitter', 'x', 'community', 'outreach', 'shilling', 'promotion'],
    content: ['content', 'writing', 'copywriting', 'video', 'memes', 'shitposting'],
    strategy: ['strategy', 'tokenomics', 'consulting', 'advisor', 'trader', 'trading']
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list recent gigs
    if (req.method === 'GET') {
        try {
            const { status, category, limit } = req.query;
            let query = supabase
                .from('inclawbator_gigs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(Math.min(parseInt(limit) || 20, 50));

            if (status && ['open', 'claimed', 'delivered', 'completed', 'disputed'].includes(status)) {
                query = query.eq('status', status);
            }
            if (category && VALID_CATEGORIES.includes(category)) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Gigs fetch error:', error);
                return res.status(500).json({ error: 'Failed to fetch gigs' });
            }

            return res.status(200).json({ success: true, gigs: data || [] });
        } catch (err) {
            console.error('Gigs GET error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — create a new gig
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Login required' });

        const { description, category, budget_claws, timeline } = req.body || {};

        if (!description || typeof description !== 'string' || description.trim().length < 10) {
            return res.status(400).json({ error: 'Description must be at least 10 characters' });
        }
        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        if (!budget_claws || budget_claws < 100 || budget_claws > 1000000) {
            return res.status(400).json({ error: 'Budget must be between 100 and 1,000,000 CLAWS' });
        }
        if (!VALID_TIMELINES.includes(timeline)) {
            return res.status(400).json({ error: 'Invalid timeline' });
        }

        // Rate limit: max 5 open gigs per user
        const { count } = await supabase
            .from('inclawbator_gigs')
            .select('id', { count: 'exact', head: true })
            .eq('hirer_id', user.sub)
            .eq('status', 'open');

        if (count >= 5) {
            return res.status(429).json({ error: 'Max 5 open gigs at a time. Close or complete existing gigs first.' });
        }

        // Get hirer profile info
        const { data: hirerProfile } = await supabase
            .from('human_profiles')
            .select('x_handle, wallet_address')
            .eq('id', user.sub)
            .single();

        try {
            const { data: gig, error } = await supabase
                .from('inclawbator_gigs')
                .insert({
                    hirer_id: user.sub,
                    hirer_wallet: hirerProfile?.wallet_address || null,
                    hirer_handle: hirerProfile?.x_handle || user.handle || null,
                    description: description.trim().slice(0, 500),
                    category,
                    budget_claws: parseInt(budget_claws),
                    timeline,
                    status: 'open'
                })
                .select()
                .single();

            if (error) {
                console.error('Gig insert error:', error);
                return res.status(500).json({ error: 'Failed to create gig' });
            }

            // Notify matching inclawbators via Telegram
            notifyMatchingInclawbators(gig).catch(() => {});

            return res.status(200).json({ success: true, gig });
        } catch (err) {
            console.error('Gig POST error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // PATCH — claim a gig or update status
    if (req.method === 'PATCH') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Login required' });

        const { gig_id, action } = req.body || {};
        if (!gig_id || !action) {
            return res.status(400).json({ error: 'gig_id and action required' });
        }

        // Fetch gig
        const { data: gig, error: fetchErr } = await supabase
            .from('inclawbator_gigs')
            .select('*')
            .eq('id', gig_id)
            .single();

        if (fetchErr || !gig) return res.status(404).json({ error: 'Gig not found' });

        // Claim
        if (action === 'claim') {
            if (gig.status !== 'open') return res.status(400).json({ error: 'Gig is no longer open' });
            if (gig.hirer_id === user.sub) return res.status(400).json({ error: 'Cannot claim your own gig' });

            const { data: claimerProfile } = await supabase
                .from('human_profiles')
                .select('x_handle, wallet_address, telegram_chat_id')
                .eq('id', user.sub)
                .single();

            const { error: updateErr } = await supabase
                .from('inclawbator_gigs')
                .update({
                    status: 'claimed',
                    claimed_by_id: user.sub,
                    claimed_by_wallet: claimerProfile?.wallet_address || null,
                    claimed_by_handle: claimerProfile?.x_handle || user.handle || null,
                    claimed_at: new Date().toISOString()
                })
                .eq('id', gig_id)
                .eq('status', 'open'); // optimistic lock

            if (updateErr) return res.status(500).json({ error: 'Failed to claim gig' });

            // Notify the hirer
            const { data: hirerProfile } = await supabase
                .from('human_profiles')
                .select('telegram_chat_id')
                .eq('id', gig.hirer_id)
                .single();

            if (hirerProfile?.telegram_chat_id) {
                const claimerName = claimerProfile?.x_handle ? '@' + claimerProfile.x_handle : 'Someone';
                notifyHuman(hirerProfile.telegram_chat_id,
                    `🦞 <b>Gig claimed!</b>\n\n${claimerName} wants to work on your gig:\n<i>${escHtml(gig.description.slice(0, 100))}</i>\n\nBudget: ${Number(gig.budget_claws).toLocaleString()} CLAWS`
                ).catch(() => {});
            }

            return res.status(200).json({ success: true });
        }

        // Complete (hirer marks as done)
        if (action === 'complete') {
            if (gig.hirer_id !== user.sub) return res.status(403).json({ error: 'Only the hirer can complete' });
            if (gig.status !== 'claimed' && gig.status !== 'delivered') return res.status(400).json({ error: 'Gig must be claimed or delivered first' });

            const { error: updateErr } = await supabase
                .from('inclawbator_gigs')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', gig_id);

            if (updateErr) return res.status(500).json({ error: 'Failed to complete gig' });

            // Increment hire count for the claimer
            if (gig.claimed_by_id) {
                await supabase.rpc('increment_hire_count', { profile_id: gig.claimed_by_id }).catch(() => {});
            }

            return res.status(200).json({ success: true });
        }

        // Cancel (hirer can cancel open gigs)
        if (action === 'cancel') {
            if (gig.hirer_id !== user.sub) return res.status(403).json({ error: 'Only the hirer can cancel' });
            if (gig.status !== 'open') return res.status(400).json({ error: 'Can only cancel open gigs' });

            const { error: updateErr } = await supabase
                .from('inclawbator_gigs')
                .update({ status: 'cancelled' })
                .eq('id', gig_id);

            if (updateErr) return res.status(500).json({ error: 'Failed to cancel gig' });
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action. Use: claim, complete, cancel' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// Notify inclawbators whose skills match the gig category
async function notifyMatchingInclawbators(gig) {
    const skillKeywords = CATEGORY_SKILLS[gig.category] || [];
    if (!skillKeywords.length) return;

    // Get all profiles with telegram connected and matching skills
    const { data: profiles } = await supabase
        .from('human_profiles')
        .select('id, x_handle, telegram_chat_id, skills, availability')
        .not('telegram_chat_id', 'is', null)
        .neq('availability', 'unavailable');

    if (!profiles || !profiles.length) return;

    const matching = profiles.filter(p => {
        if (p.id === gig.hirer_id) return false; // don't notify the hirer
        const pSkills = (p.skills || []).map(s => s.toLowerCase());
        return skillKeywords.some(kw => pSkills.some(s => s.includes(kw)));
    });

    const TIMELINE_LABEL = { asap: 'ASAP', week: 'This week', norush: 'No rush' };
    const msg = `🦞 <b>New gig posted!</b>\n\n<i>${escHtml(gig.description.slice(0, 200))}</i>\n\nCategory: ${escHtml(gig.category)}\nBudget: ${Number(gig.budget_claws).toLocaleString()} CLAWS\nTimeline: ${TIMELINE_LABEL[gig.timeline] || gig.timeline}\nBy: ${gig.hirer_handle ? '@' + escHtml(gig.hirer_handle) : 'anonymous'}\n\nGo to inclawbate.app/inclawbator to apply!`;

    // Send to up to 20 matching inclawbators
    const toNotify = matching.slice(0, 20);
    for (const p of toNotify) {
        await notifyHuman(p.telegram_chat_id, msg);
    }
}
