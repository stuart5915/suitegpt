// MemeClaw — Voting API
// GET  ?slug=xxx           → { votes: { 1: n, 2: n, 3: n, 4: n } }
// POST { slug, option }    → increments vote, returns updated counts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'chrome-extension://'
];

function setCors(req, res) {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Allow any inclawbate subdomain or published app
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
}

async function getVoteCounts(slug) {
    const { data, error } = await supabase
        .from('memeclaw_votes')
        .select('option')
        .eq('slug', slug);

    if (error) throw error;

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const row of (data || [])) {
        if (counts.hasOwnProperty(row.option)) {
            counts[row.option]++;
        }
    }
    return counts;
}

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — fetch vote counts for a slug
    if (req.method === 'GET') {
        const slug = (req.query.slug || '').trim().toLowerCase();
        if (!slug) {
            return res.status(400).json({ error: 'Missing ?slug= parameter' });
        }

        try {
            const votes = await getVoteCounts(slug);
            return res.status(200).json({ votes });
        } catch (err) {
            console.error('memeclaw-vote GET error:', err);
            return res.status(500).json({ error: 'Failed to fetch votes' });
        }
    }

    // POST — cast a vote
    if (req.method === 'POST') {
        const { slug, option } = req.body || {};

        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({ error: 'Missing slug' });
        }

        const opt = parseInt(option, 10);
        if (!opt || opt < 1 || opt > 4) {
            return res.status(400).json({ error: 'option must be 1-4' });
        }

        const cleanSlug = slug.trim().toLowerCase();

        try {
            // Get voter IP for optional rate-limiting later
            const voterIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || null;

            const { error: insertErr } = await supabase
                .from('memeclaw_votes')
                .insert({
                    slug: cleanSlug,
                    option: opt,
                    voter_ip: voterIp
                });

            if (insertErr) throw insertErr;

            // Return updated counts
            const votes = await getVoteCounts(cleanSlug);
            return res.status(200).json({ success: true, votes });
        } catch (err) {
            console.error('memeclaw-vote POST error:', err);
            return res.status(500).json({ error: 'Failed to record vote' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
