import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://suitegpt.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { wallet, chainId } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    try {
        let query = supabase.from('lp_monitors')
            .select('*')
            .eq('wallet_address', wallet.toLowerCase())
            .eq('is_active', true);

        if (chainId) query = query.eq('chain_id', parseInt(chainId));

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ alerts: data || [] });
    } catch (e) {
        console.error('Get alerts error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
