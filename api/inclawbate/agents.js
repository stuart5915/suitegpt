// Inclawbate — User Agents API
// GET ?wallet=0x... → list agents
// POST { action: "create", wallet, name, persona } → create agent
// POST { action: "update", agent_id, wallet, ... } → update agent
// POST { action: "delete", agent_id, wallet } → delete agent
// POST { action: "add_connection", agent_id, wallet, type, label, value } → add connection
// POST { action: "remove_connection", connection_id, wallet } → remove connection
// POST { action: "add_capability", agent_id, wallet, type, config } → add capability
// POST { action: "toggle_capability", capability_id, wallet, enabled } → enable/disable
// POST { action: "toggle_status", agent_id, wallet } → activate/pause agent

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list agents for a wallet
    if (req.method === 'GET') {
        const wallet = (req.query.wallet || '').toLowerCase();
        if (!wallet) return res.status(400).json({ error: 'wallet required' });

        const { data: agents, error } = await supabase
            .from('user_agents')
            .select('*')
            .eq('owner_wallet', wallet)
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        // Fetch connections and capabilities for each agent
        const agentIds = (agents || []).map(a => a.id);
        const [connRes, capRes] = await Promise.all([
            supabase.from('agent_connections').select('*').in('agent_id', agentIds),
            supabase.from('agent_capabilities').select('*').in('agent_id', agentIds)
        ]);

        const result = (agents || []).map(a => ({
            ...a,
            connections: (connRes.data || []).filter(c => c.agent_id === a.id),
            capabilities: (capRes.data || []).filter(c => c.agent_id === a.id)
        }));

        return res.status(200).json({ agents: result });
    }

    // POST — actions
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const { action, wallet, agent_id } = req.body || {};
    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'wallet required' });

    // Verify ownership for agent-level actions
    async function verifyOwner(agentId) {
        const { data } = await supabase.from('user_agents').select('owner_wallet').eq('id', agentId).single();
        return data && data.owner_wallet === w;
    }

    if (action === 'create') {
        const { name, persona, avatar_url } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });

        const { data, error } = await supabase.from('user_agents').insert({
            owner_wallet: w,
            name,
            persona: persona || null,
            avatar_url: avatar_url || null,
            status: 'setup'
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ agent: data });
    }

    if (action === 'update') {
        if (!agent_id) return res.status(400).json({ error: 'agent_id required' });
        if (!await verifyOwner(agent_id)) return res.status(403).json({ error: 'Not your agent' });

        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.persona !== undefined) updates.persona = req.body.persona;
        if (req.body.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url;
        if (req.body.status) updates.status = req.body.status;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase.from('user_agents').update(updates).eq('id', agent_id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ agent: data });
    }

    if (action === 'delete') {
        if (!agent_id) return res.status(400).json({ error: 'agent_id required' });
        if (!await verifyOwner(agent_id)) return res.status(403).json({ error: 'Not your agent' });

        const { error } = await supabase.from('user_agents').delete().eq('id', agent_id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ deleted: true });
    }

    if (action === 'toggle_status') {
        if (!agent_id) return res.status(400).json({ error: 'agent_id required' });
        if (!await verifyOwner(agent_id)) return res.status(403).json({ error: 'Not your agent' });

        const { data: agent } = await supabase.from('user_agents').select('status').eq('id', agent_id).single();
        const newStatus = agent.status === 'active' ? 'paused' : 'active';

        const { data, error } = await supabase.from('user_agents').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', agent_id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ agent: data });
    }

    if (action === 'add_connection') {
        const { type, label, value, metadata } = req.body;
        if (!agent_id || !type || !value) return res.status(400).json({ error: 'agent_id, type, value required' });
        if (!await verifyOwner(agent_id)) return res.status(403).json({ error: 'Not your agent' });

        const { data, error } = await supabase.from('agent_connections').insert({
            agent_id, type, label: label || null, value, metadata: metadata || {}
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ connection: data });
    }

    if (action === 'remove_connection') {
        const { connection_id } = req.body;
        if (!connection_id) return res.status(400).json({ error: 'connection_id required' });

        // Verify ownership through agent
        const { data: conn } = await supabase.from('agent_connections').select('agent_id').eq('id', connection_id).single();
        if (!conn || !await verifyOwner(conn.agent_id)) return res.status(403).json({ error: 'Not your connection' });

        const { error } = await supabase.from('agent_connections').delete().eq('id', connection_id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ deleted: true });
    }

    if (action === 'add_capability') {
        const { type, config } = req.body;
        if (!agent_id || !type) return res.status(400).json({ error: 'agent_id, type required' });
        if (!await verifyOwner(agent_id)) return res.status(403).json({ error: 'Not your agent' });

        const { data, error } = await supabase.from('agent_capabilities').upsert({
            agent_id, type, config: config || {}, enabled: true
        }, { onConflict: 'agent_id,type' }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ capability: data });
    }

    if (action === 'toggle_capability') {
        const { capability_id, enabled } = req.body;
        if (!capability_id) return res.status(400).json({ error: 'capability_id required' });

        const { data: cap } = await supabase.from('agent_capabilities').select('agent_id').eq('id', capability_id).single();
        if (!cap || !await verifyOwner(cap.agent_id)) return res.status(403).json({ error: 'Not your capability' });

        const { data, error } = await supabase.from('agent_capabilities').update({ enabled: enabled !== false }).eq('id', capability_id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ capability: data });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
}
