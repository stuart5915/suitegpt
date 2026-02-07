// Agent Autonomy Loop — Cron Endpoint
// Runs every 15 minutes via Vercel cron
// Matches idle agents to open quests by role

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // Verify cron secret (Vercel sends this automatically for cron jobs)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const results = {
            timestamp: new Date().toISOString(),
            idle_agents_found: 0,
            open_quests_found: 0,
            quests_assigned: 0,
            errors: []
        };

        // 1. Find idle agents (idle status or inactive > 6 hours)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

        const { data: idleAgents } = await supabase
            .from('factory_users')
            .select('id, agent_slug, agent_role, agent_status, last_active_at')
            .eq('is_agent', true)
            .in('agent_status', ['idle'])
            .order('last_active_at', { ascending: true })
            .limit(10);

        results.idle_agents_found = idleAgents?.length || 0;

        if (!idleAgents || idleAgents.length === 0) {
            return res.status(200).json({ success: true, ...results, message: 'No idle agents' });
        }

        // 2. Find open quests
        const { data: openQuests } = await supabase
            .from('quest_board')
            .select('id, title, role_match, reward_credits, difficulty')
            .eq('status', 'open')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(20);

        results.open_quests_found = openQuests?.length || 0;

        if (!openQuests || openQuests.length === 0) {
            return res.status(200).json({ success: true, ...results, message: 'No open quests' });
        }

        // 3. Match agents to quests by role
        const assignedQuestIds = new Set();

        for (const agent of idleAgents) {
            // Find best matching quest (role match preferred, then any)
            const match = openQuests.find(q =>
                !assignedQuestIds.has(q.id) &&
                (!q.role_match || q.role_match === agent.agent_role)
            );

            if (!match) continue;

            // Claim quest for agent
            const { data: claimResult, error: claimError } = await supabase.rpc('claim_quest', {
                p_quest_id: match.id,
                p_agent_id: agent.id
            });

            if (claimError) {
                results.errors.push({ agent: agent.agent_slug, quest: match.id, error: claimError.message });
                continue;
            }

            if (claimResult?.success) {
                assignedQuestIds.add(match.id);
                results.quests_assigned++;

                // Mark as auto-assigned
                await supabase
                    .from('quest_board')
                    .update({ auto_assigned: true })
                    .eq('id', match.id);

                // Try to create a wake request (table may not exist)
                try {
                    await supabase.from('agent_wake_requests').insert({
                        agent_slug: agent.agent_slug,
                        wake_type: 'quest_execution',
                        status: 'pending',
                        metadata: { quest_id: match.id, quest_title: match.title }
                    });
                } catch (e) {
                    // wake queue table may not exist — that's fine
                }
            }
        }

        return res.status(200).json({ success: true, ...results });
    } catch (error) {
        console.error('Autonomy loop error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
