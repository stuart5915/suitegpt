// Inclawbate Compute — Node Registration
// Registers a GPU node in Supabase, tracks specs and status.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { wallet, gpu_name, gpu_vram_gb, os, node_version } = req.body;

    if (!wallet) return res.status(400).json({ error: 'wallet is required' });
    if (!gpu_name) return res.status(400).json({ error: 'gpu_name is required' });

    try {
        // Upsert node registration
        const { data, error } = await supabase
            .from('compute_nodes')
            .upsert({
                wallet: wallet.toLowerCase(),
                gpu_name,
                gpu_vram_gb: gpu_vram_gb || 0,
                os: os || 'unknown',
                node_version: node_version || '0.1.0',
                status: 'online',
                last_heartbeat: new Date().toISOString(),
                registered_at: new Date().toISOString()
            }, { onConflict: 'wallet' })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            ok: true,
            node: {
                wallet: data.wallet,
                gpu_name: data.gpu_name,
                gpu_vram_gb: data.gpu_vram_gb,
                status: data.status,
                registered_at: data.registered_at
            },
            message: 'Node registered. Send heartbeats to /api/inclawbate/compute/heartbeat'
        });

    } catch (error) {
        console.error('Node registration error:', error);
        return res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
}
