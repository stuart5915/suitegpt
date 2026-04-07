// Engagement Feed — surfaces X accounts to engage with for @inclawbate and @publicgoodstech
// GET ?account=publicgoodstech  — PGT engagement targets (agents, builders, goods, protocols)
// GET ?account=inclawbate       — Inclawbate engagement targets (projects, builders, ecosystem)
// GET (no param)                — returns both accounts
// Priority scoring: high (engage today), medium (this week), low (when time permits)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req) {
    const wallet = (req.query.wallet || '').toLowerCase();
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    return ADMIN_WALLETS.includes(wallet) || secret === CRON_SECRET;
}

function daysSince(dateStr) {
    if (!dateStr) return 999;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

async function getPgtTargets() {
    const now = new Date().toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fortyEightHours = new Date(Date.now() + 2 * 86400000).toISOString();

    const [agentsRes, buildersRes, goodsRes, protocolsRes, recentPostsRes, upcomingRes] = await Promise.all([
        supabase.from('pgt_agents').select('id, name, x_handle, category, mentions_count, last_mentioned, created_at, website').eq('approved', true).not('x_handle', 'is', null),
        supabase.from('pgt_builders').select('id, name, x_handle, mentions_count, last_mentioned, created_at, website').eq('approved', true).not('x_handle', 'is', null),
        supabase.from('pgt_public_goods').select('id, name, x_handle, category, mentions_count, last_mentioned, created_at, website').eq('approved', true).not('x_handle', 'is', null),
        supabase.from('pgt_protocols').select('id, name, x_handle, category, mentions_count, last_mentioned, created_at, website').eq('approved', true).not('x_handle', 'is', null),
        // Recent posted tweets
        supabase.from('agent_schedule').select('tweet_options, scheduled_at').eq('account', 'publicgoodstech').eq('status', 'posted').gte('scheduled_at', twoDaysAgo),
        // Upcoming scheduled tweets
        supabase.from('agent_schedule').select('tweet_options, scheduled_at').eq('account', 'publicgoodstech').in('status', ['scheduled', 'needs_review']).gte('scheduled_at', now).lte('scheduled_at', fortyEightHours),
    ]);

    // Extract handles from recent/upcoming posts
    const recentlyFeaturedHandles = new Set();
    (recentPostsRes.data || []).forEach(s => {
        const h = s.tweet_options?.pgt_project_handle;
        if (h) recentlyFeaturedHandles.add(h.toLowerCase().replace('@', ''));
    });
    const upcomingHandles = new Set();
    (upcomingRes.data || []).forEach(s => {
        const h = s.tweet_options?.pgt_project_handle;
        if (h) upcomingHandles.add(h.toLowerCase().replace('@', ''));
    });

    // Merge all into a unified map (deduped by handle)
    const targets = new Map();
    function addTarget(item, source) {
        const handle = (item.x_handle || '').toLowerCase().replace('@', '');
        if (!handle) return;
        if (targets.has(handle)) return; // first source wins
        targets.set(handle, {
            handle,
            name: item.name,
            source,
            category: item.category || null,
            mentions_count: item.mentions_count || 0,
            last_mentioned: item.last_mentioned || null,
            created_at: item.created_at,
            website: item.website || null,
        });
    }

    (agentsRes.data || []).forEach(a => addTarget(a, 'pgt_agents'));
    (buildersRes.data || []).forEach(b => addTarget(b, 'pgt_builders'));
    (goodsRes.data || []).forEach(g => addTarget(g, 'pgt_public_goods'));
    (protocolsRes.data || []).forEach(p => addTarget(p, 'pgt_protocols'));

    // Score each target
    const scored = [];
    for (const [handle, t] of targets) {
        let priority = 'low';
        let reason = 'In PGT database — engage when time permits';

        const daysOld = daysSince(t.created_at);
        const daysSinceMention = daysSince(t.last_mentioned);

        // High priority
        if (recentlyFeaturedHandles.has(handle)) {
            priority = 'high';
            reason = 'Featured in a PGT post in the last 48h — reciprocal engagement';
        } else if (upcomingHandles.has(handle)) {
            priority = 'high';
            reason = 'Has an upcoming scheduled post — pre-engagement builds relationship';
        } else if (daysOld <= 7 && t.mentions_count === 0) {
            priority = 'high';
            reason = 'New to the database (< 7 days) with 0 mentions — welcome engagement';
        }
        // Medium priority
        else if (t.mentions_count > 0 && daysSinceMention > 7) {
            priority = 'medium';
            reason = `${t.mentions_count} mentions but last mentioned ${daysSinceMention} days ago — re-engage`;
        } else if (daysOld <= 14) {
            priority = 'medium';
            reason = 'Recently added — still building relationship';
        }

        scored.push({ ...t, priority, reason });
    }

    // Sort: high > medium > low, then by mentions_count ascending (engage less-mentioned first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    scored.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return a.mentions_count - b.mentions_count;
    });

    return scored;
}

async function getInclawbateTargets() {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    // Inclawbate ecosystem: council members, app builders, incubation projects
    const [recentPostsRes, appsRes] = await Promise.all([
        supabase.from('agent_schedule').select('tweet_options, scheduled_at').eq('account', 'inclawbate').eq('status', 'posted').gte('scheduled_at', twoDaysAgo),
        supabase.from('user_apps').select('name, creator_x_handle').not('creator_x_handle', 'is', null).order('created_at', { ascending: false }).limit(50),
    ]);

    // Known ecosystem handles to engage with
    const ecosystemHandles = [
        { handle: 'itsEvilDuck', name: 'Red Foreman', source: 'council', reason: 'Council member — always engage' },
        { handle: 'abhiontwt', name: 'Abinav', source: 'council', reason: 'Council member — always engage' },
        { handle: 'FreefoRaLLey', name: 'FreefoRaLLey', source: 'council', reason: 'Council member — always engage' },
        { handle: 'sntrblck', name: 'sntrblck', source: 'community', reason: 'Active community contributor' },
    ];

    const targets = new Map();
    // Council + known handles are always high priority
    ecosystemHandles.forEach(h => {
        targets.set(h.handle.toLowerCase(), { ...h, priority: 'high', mentions_count: 0, category: 'ecosystem' });
    });

    // App builders
    (appsRes.data || []).forEach(app => {
        const handle = (app.creator_x_handle || '').toLowerCase().replace('@', '');
        if (!handle || targets.has(handle)) return;
        targets.set(handle, {
            handle,
            name: app.name + ' builder',
            source: 'app_builder',
            category: 'builder',
            priority: 'medium',
            reason: 'Built an app on Inclawbate — support builders',
            mentions_count: 0,
        });
    });

    // Extract handles mentioned in recent posts
    (recentPostsRes.data || []).forEach(s => {
        const text = s.tweet_options?.tweet_text || '';
        const mentions = text.match(/@\w+/g) || [];
        mentions.forEach(m => {
            const h = m.replace('@', '').toLowerCase();
            if (!targets.has(h) && h !== 'inclawbate' && h !== 'inclawbator') {
                targets.set(h, {
                    handle: h,
                    name: h,
                    source: 'recent_post_mention',
                    category: 'mentioned',
                    priority: 'medium',
                    reason: 'Mentioned in a recent Inclawbate post — follow up',
                    mentions_count: 0,
                });
            }
        });
    });

    return [...targets.values()].sort((a, b) => {
        const po = { high: 0, medium: 1, low: 2 };
        return (po[a.priority] || 2) - (po[b.priority] || 2);
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    if (!isAuthorized(req)) return res.status(403).json({ error: 'Admin/editor only' });

    const account = req.query.account;

    try {
        const result = {};

        if (!account || account === 'publicgoodstech') {
            const pgtTargets = await getPgtTargets();
            result.publicgoodstech = {
                targets: pgtTargets,
                stats: {
                    total: pgtTargets.length,
                    high: pgtTargets.filter(t => t.priority === 'high').length,
                    medium: pgtTargets.filter(t => t.priority === 'medium').length,
                    low: pgtTargets.filter(t => t.priority === 'low').length,
                },
            };
        }

        if (!account || account === 'inclawbate') {
            const inclawTargets = await getInclawbateTargets();
            result.inclawbate = {
                targets: inclawTargets,
                stats: {
                    total: inclawTargets.length,
                    high: inclawTargets.filter(t => t.priority === 'high').length,
                    medium: inclawTargets.filter(t => t.priority === 'medium').length,
                    low: inclawTargets.filter(t => t.priority === 'low').length,
                },
            };
        }

        result.date = new Date().toISOString().split('T')[0];
        result.tip = 'High priority = engage today. Focus on replying to their recent tweets, liking, and retweeting.';

        return res.json(result);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
