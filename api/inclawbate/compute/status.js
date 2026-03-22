// Inclawbate Compute — Network Status
// Public endpoint showing live compute network stats.
// Powers the stats bar on the Inclawbator page and compute docs.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
        // Count online nodes (heartbeat within last 2 minutes)
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const [onlineRes, totalRes, statsRes] = await Promise.all([
            // Online nodes
            supabase
                .from('compute_nodes')
                .select('wallet, gpu_name, gpu_vram_gb, jobs_completed, compute_units, current_task', { count: 'exact' })
                .eq('status', 'online')
                .gte('last_heartbeat', twoMinAgo),

            // Total registered nodes
            supabase
                .from('compute_nodes')
                .select('*', { count: 'exact', head: true }),

            // Aggregate stats
            supabase
                .from('compute_nodes')
                .select('compute_units, jobs_completed')
        ]);

        const onlineNodes = onlineRes.data || [];
        const totalNodes = totalRes.count || 0;

        // Sum up stats
        let totalComputeUnits = 0;
        let totalJobs = 0;
        let totalVram = 0;

        for (const node of (statsRes.data || [])) {
            totalComputeUnits += node.compute_units || 0;
            totalJobs += node.jobs_completed || 0;
        }

        for (const node of onlineNodes) {
            totalVram += node.gpu_vram_gb || 0;
        }

        return res.status(200).json({
            network: {
                nodes_online: onlineNodes.length,
                nodes_total: totalNodes,
                total_vram_gb: totalVram,
                total_compute_units: totalComputeUnits,
                total_jobs_completed: totalJobs
            },
            nodes: onlineNodes.map(n => ({
                wallet: n.wallet.slice(0, 6) + '...' + n.wallet.slice(-4),
                gpu: n.gpu_name,
                vram_gb: n.gpu_vram_gb,
                jobs: n.jobs_completed || 0,
                task: n.current_task || 'idle'
            }))
        });

    } catch (error) {
        console.error('Compute status error:', error);
        return res.status(500).json({ error: 'Failed to fetch network status' });
    }
}
