// Backfill logo_url / avatar_url for PGT tables using unavatar.io
// POST { action: "backfill" }        — fill all null logos
// POST { action: "refresh" }         — re-check all entries (even ones with logos)
// POST { action: "preview" }         — dry run, return what would be updated
// GET                                — show current stats (how many have logos)
// Requires CRON_SECRET header for auth

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRON_SECRET = process.env.CRON_SECRET;

// Try unavatar sources in priority order
async function findLogo(entry) {
    const { x_handle, website, github, name } = entry;

    // 1. X profile pic (best for agents + people)
    if (x_handle) {
        const handle = x_handle.replace(/^@/, '');
        const url = `https://unavatar.io/x/${handle}`;
        if (await checkImage(url)) return url;
    }

    // 2. GitHub avatar
    if (github) {
        // github could be full URL or just username
        const ghUser = github.replace(/^https?:\/\/github\.com\/?/, '').replace(/\/.*$/, '');
        if (ghUser) {
            const url = `https://unavatar.io/github/${ghUser}`;
            if (await checkImage(url)) return url;
        }
    }

    // 3. Website domain (clearbit-style via unavatar)
    if (website) {
        try {
            const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
            const url = `https://unavatar.io/${domain}`;
            if (await checkImage(url)) return url;
        } catch {}
    }

    return null;
}

// Check if a URL returns a valid image (not a fallback/error)
async function checkImage(url) {
    try {
        const resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return false;
        const ct = resp.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) return false;
        // unavatar returns a tiny fallback image when it can't find anything — check content-length
        const cl = parseInt(resp.headers.get('content-length') || '0');
        // Fallback images are typically very small (< 1KB)
        if (cl > 0 && cl < 500) return false;
        return true;
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — stats
    if (req.method === 'GET') {
        const [agents, goods, builders] = await Promise.all([
            supabase.from('pgt_agents').select('id, name, logo_url, x_handle, website'),
            supabase.from('pgt_public_goods').select('id, name, logo_url, x_handle, website'),
            supabase.from('pgt_builders').select('id, name, avatar_url, x_handle, website, github'),
        ]);
        const stats = {
            agents: { total: (agents.data||[]).length, with_logo: (agents.data||[]).filter(a => a.logo_url).length },
            goods: { total: (goods.data||[]).length, with_logo: (goods.data||[]).filter(g => g.logo_url).length },
            builders: { total: (builders.data||[]).length, with_avatar: (builders.data||[]).filter(b => b.avatar_url).length },
        };
        stats.coverage = {
            agents: stats.agents.total ? Math.round(stats.agents.with_logo / stats.agents.total * 100) + '%' : 'n/a',
            goods: stats.goods.total ? Math.round(stats.goods.with_logo / stats.goods.total * 100) + '%' : 'n/a',
            builders: stats.builders.total ? Math.round(stats.builders.with_avatar / stats.builders.total * 100) + '%' : 'n/a',
        };
        return res.json(stats);
    }

    // POST — backfill/refresh/preview
    if (req.method === 'POST') {
        const secret = req.headers['x-cron-secret'] || req.body?.secret;
        if (secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

        const action = req.body?.action || 'backfill';
        const dryRun = action === 'preview';
        const refreshAll = action === 'refresh';

        const results = { agents: [], goods: [], builders: [], errors: [] };

        // Fetch all entries
        const [agentsRes, goodsRes, buildersRes] = await Promise.all([
            supabase.from('pgt_agents').select('id, name, logo_url, x_handle, website, github'),
            supabase.from('pgt_public_goods').select('id, name, logo_url, x_handle, website, github'),
            supabase.from('pgt_builders').select('id, name, avatar_url, x_handle, website, github'),
        ]);

        const agents = (agentsRes.data || []).filter(a => refreshAll || !a.logo_url);
        const goods = (goodsRes.data || []).filter(g => refreshAll || !g.logo_url);
        const builders = (buildersRes.data || []).filter(b => refreshAll || !b.avatar_url);

        // Process agents
        for (const agent of agents) {
            try {
                const logoUrl = await findLogo(agent);
                if (logoUrl) {
                    if (!dryRun) {
                        await supabase.from('pgt_agents').update({ logo_url: logoUrl }).eq('id', agent.id);
                    }
                    results.agents.push({ name: agent.name, logo_url: logoUrl });
                }
            } catch (e) {
                results.errors.push({ table: 'agents', name: agent.name, error: e.message });
            }
        }

        // Process public goods
        for (const good of goods) {
            try {
                const logoUrl = await findLogo(good);
                if (logoUrl) {
                    if (!dryRun) {
                        await supabase.from('pgt_public_goods').update({ logo_url: logoUrl }).eq('id', good.id);
                    }
                    results.goods.push({ name: good.name, logo_url: logoUrl });
                }
            } catch (e) {
                results.errors.push({ table: 'goods', name: good.name, error: e.message });
            }
        }

        // Process builders
        for (const builder of builders) {
            try {
                const logoUrl = await findLogo(builder);
                if (logoUrl) {
                    if (!dryRun) {
                        await supabase.from('pgt_builders').update({ avatar_url: logoUrl }).eq('id', builder.id);
                    }
                    results.builders.push({ name: builder.name, avatar_url: logoUrl });
                }
            } catch (e) {
                results.errors.push({ table: 'builders', name: builder.name, error: e.message });
            }
        }

        return res.json({
            action: dryRun ? 'preview (dry run)' : action,
            updated: {
                agents: results.agents.length,
                goods: results.goods.length,
                builders: results.builders.length,
            },
            details: results,
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
