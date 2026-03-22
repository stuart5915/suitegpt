// Inclawbate Compute — Node Heartbeat
// Nodes ping this every 30s to prove they're online and report stats.
// Compute units accrue based on uptime + GPU power.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Compute units per heartbeat (30s) based on GPU VRAM tier
function computeUnitsForGpu(vram_gb) {
    if (vram_gb >= 24) return 10;   // 4090, A5000+
    if (vram_gb >= 12) return 6;    // 3060 12GB, 4070 Ti
    if (vram_gb >= 10) return 5;    // 3080
    if (vram_gb >= 8) return 4;     // 3060 8GB, 4060
    return 2;                        // lower tier
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { wallet, gpu_utilization, jobs_completed, current_task } = req.body;

    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    try {
        // Get current node
        const { data: node, error: fetchErr } = await supabase
            .from('compute_nodes')
            .select('*')
            .eq('wallet', wallet.toLowerCase())
            .single();

        if (fetchErr || !node) {
            return res.status(404).json({ error: 'Node not registered. POST /api/inclawbate/compute/register first.' });
        }

        // Calculate compute units earned this heartbeat
        const units = computeUnitsForGpu(node.gpu_vram_gb);
        const newTotal = (node.compute_units || 0) + units;
        const newUnclaimed = (node.unclaimed_units || 0) + units;

        // Update node status
        const { error: updateErr } = await supabase
            .from('compute_nodes')
            .update({
                status: 'online',
                last_heartbeat: new Date().toISOString(),
                gpu_utilization: gpu_utilization || 0,
                jobs_completed: jobs_completed || node.jobs_completed || 0,
                current_task: current_task || null,
                compute_units: newTotal,
                unclaimed_units: newUnclaimed
            })
            .eq('wallet', wallet.toLowerCase());

        if (updateErr) throw updateErr;

        return res.status(200).json({
            ok: true,
            compute_units_earned: units,
            total_compute_units: newTotal,
            unclaimed_units: newUnclaimed,
            status: 'online'
        });

    } catch (error) {
        console.error('Heartbeat error:', error);
        return res.status(500).json({ error: 'Heartbeat failed: ' + error.message });
    }
}
