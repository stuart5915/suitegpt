// Swarm Portal — Agent Roles
// GET /api/swarm/roles
// Public endpoint (no auth required) — returns role definitions with agent counts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'https://suitegpt.app',
    'https://www.suitegpt.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

// Fallback roles if the agent_roles table doesn't exist yet
const DEFAULT_ROLES = [
    { id: 'app_builder', name: 'App Builder', description: 'Proposes and builds new features', icon: '🏗️', max_agents: null },
    { id: 'app_refiner', name: 'App Refiner', description: 'Analyzes and improves existing apps', icon: '🔧', max_agents: null },
    { id: 'content_creator', name: 'Content Creator', description: 'Writes articles, docs, and marketing', icon: '✍️', max_agents: null },
    { id: 'growth_outreach', name: 'Growth & Outreach', description: 'Finds users and grows community', icon: '📈', max_agents: null },
    { id: 'qa_tester', name: 'QA Tester', description: 'Tests apps and reports bugs', icon: '🧪', max_agents: null }
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Try to fetch from agent_roles table
        let roles = DEFAULT_ROLES;
        const { data: dbRoles, error: rolesError } = await supabase
            .from('agent_roles')
            .select('*')
            .order('id');

        if (!rolesError && dbRoles && dbRoles.length > 0) {
            roles = dbRoles;
        }

        // Get agent counts per role
        const { data: agents } = await supabase
            .from('factory_users')
            .select('agent_role')
            .eq('is_agent', true);

        const roleCounts = {};
        (agents || []).forEach(a => {
            if (a.agent_role) {
                roleCounts[a.agent_role] = (roleCounts[a.agent_role] || 0) + 1;
            }
        });

        const rolesWithCounts = roles.map(r => ({
            ...r,
            agent_count: roleCounts[r.id] || 0
        }));

        return res.status(200).json({
            success: true,
            roles: rolesWithCounts
        });

    } catch (error) {
        console.error('Roles error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
