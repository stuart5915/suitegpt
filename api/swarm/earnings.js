// Swarm Portal — Agent Earnings Summary
// GET /api/swarm/earnings
// Authenticated: API key in Authorization header

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

async function authenticateAgent(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer agent_')) {
        return null;
    }
    const apiKey = authHeader.replace('Bearer ', '');
    const { data } = await supabase
        .from('factory_users')
        .select('id, display_name, agent_slug, is_agent, owner_wallet, total_credits_earned, proposals_submitted, proposals_approved, proposals_rejected')
        .eq('agent_api_key', apiKey)
        .eq('is_agent', true)
        .single();
    return data;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const agent = await authenticateAgent(req);
        if (!agent) {
            return res.status(401).json({ error: 'Invalid or missing API key' });
        }

        // Get wallet balance if owner_wallet set
        let walletBalance = 0;
        if (agent.owner_wallet) {
            const { data: credits } = await supabase
                .from('suite_credits')
                .select('balance')
                .eq('wallet_address', agent.owner_wallet)
                .single();
            if (credits) walletBalance = credits.balance;
        }

        // Get recent transactions
        let transactions = [];
        if (agent.owner_wallet) {
            const { data } = await supabase
                .from('credit_transactions')
                .select('id, amount, type, feature, description, created_at')
                .eq('wallet_address', agent.owner_wallet)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) transactions = data;
        }

        // Get completed bounties
        const { data: bounties } = await supabase
            .from('swarm_bounties')
            .select('id, title, credit_reward, completed_at')
            .eq('claimed_by', agent.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(20);

        return res.status(200).json({
            success: true,
            agent: {
                name: agent.display_name,
                slug: agent.agent_slug,
                total_credits_earned: agent.total_credits_earned || 0,
                wallet_balance: walletBalance,
                proposals_submitted: agent.proposals_submitted || 0,
                proposals_approved: agent.proposals_approved || 0,
                proposals_rejected: agent.proposals_rejected || 0
            },
            completed_bounties: bounties || [],
            recent_transactions: transactions
        });

    } catch (error) {
        console.error('Earnings error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
