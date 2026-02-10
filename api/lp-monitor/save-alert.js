import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://suitegpt.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        wallet_address, telegram_chat_id, chain_id, token_id,
        pool_address, token0_symbol, token1_symbol, fee,
        tick_lower, tick_upper, is_active
    } = req.body;

    if (!wallet_address || !chain_id || !token_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (is_active) {
            if (!telegram_chat_id) {
                return res.status(400).json({ error: 'Link your Telegram account to enable alerts' });
            }

            const { error } = await supabase.from('lp_monitors').upsert({
                wallet_address: wallet_address.toLowerCase(),
                telegram_chat_id,
                chain_id,
                token_id,
                pool_address,
                token0_symbol,
                token1_symbol,
                fee,
                tick_lower,
                tick_upper,
                is_active: true,
                last_status: 'unknown'
            }, { onConflict: 'wallet_address,chain_id,token_id' });

            if (error) throw error;
        } else {
            const { error } = await supabase.from('lp_monitors')
                .update({ is_active: false })
                .eq('wallet_address', wallet_address.toLowerCase())
                .eq('chain_id', chain_id)
                .eq('token_id', token_id);

            if (error) throw error;
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('Save alert error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
