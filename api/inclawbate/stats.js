// Inclawbate — Platform Stats API
// GET /api/inclawbate/stats — public aggregate stats

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Fetch all profiles
        const { data: profiles, count: totalHumans } = await supabase
            .from('human_profiles')
            .select('id, wallet_address, skills, hire_count, availability, x_handle, x_name, x_avatar_url, created_at', { count: 'exact' });

        // Fetch all conversations for payment data
        const { data: convos } = await supabase
            .from('inclawbate_conversations')
            .select('human_id, payment_amount, created_at');

        const allProfiles = profiles || [];
        const allConvos = convos || [];

        // Aggregate stats
        const walletsConnected = allProfiles.filter(p => p.wallet_address).length;
        const totalHires = allConvos.length;
        const totalClawnch = allConvos.reduce((sum, c) => sum + (parseFloat(c.payment_amount) || 0), 0);
        const busyCount = allProfiles.filter(p => p.availability === 'busy').length;

        // Top skills
        const skillCounts = {};
        allProfiles.forEach(p => {
            (p.skills || []).forEach(s => {
                skillCounts[s] = (skillCounts[s] || 0) + 1;
            });
        });
        const topSkills = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([skill, count]) => ({ skill, count }));

        // Recent signups (last 10)
        const recentSignups = allProfiles
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10)
            .map(p => ({
                x_handle: p.x_handle,
                x_name: p.x_name,
                x_avatar_url: p.x_avatar_url,
                has_wallet: !!p.wallet_address
            }));

        // Top earners
        const earningsMap = {};
        allConvos.forEach(c => {
            if (!c.human_id) return;
            earningsMap[c.human_id] = (earningsMap[c.human_id] || 0) + (parseFloat(c.payment_amount) || 0);
        });
        const topEarners = Object.entries(earningsMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, earned]) => {
                const p = allProfiles.find(pr => pr.id === id);
                return {
                    x_handle: p?.x_handle,
                    x_name: p?.x_name,
                    x_avatar_url: p?.x_avatar_url,
                    total_earned: Math.round(earned)
                };
            })
            .filter(e => e.x_handle);

        return res.status(200).json({
            total_humans: totalHumans || allProfiles.length,
            wallets_connected: walletsConnected,
            total_hires: totalHires,
            total_clawnch: Math.round(totalClawnch),
            busy_count: busyCount,
            top_skills: topSkills,
            recent_signups: recentSignups,
            top_earners: topEarners
        });

    } catch (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
}
