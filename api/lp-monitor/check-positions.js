// Cron job: checks monitored LP positions and sends Telegram alerts
// Runs every minute via Vercel Cron
//
// Required Supabase table — run this SQL once:
//
// CREATE TABLE lp_monitors (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     wallet_address text NOT NULL,
//     telegram_chat_id text NOT NULL,
//     chain_id integer NOT NULL,
//     token_id text NOT NULL,
//     pool_address text NOT NULL,
//     token0_symbol text,
//     token1_symbol text,
//     fee integer NOT NULL,
//     tick_lower integer NOT NULL,
//     tick_upper integer NOT NULL,
//     is_active boolean DEFAULT true,
//     last_status text DEFAULT 'unknown',
//     last_alert_at timestamptz,
//     created_at timestamptz DEFAULT now(),
//     UNIQUE(wallet_address, chain_id, token_id)
// );

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const CHAIN_RPC = {
    1:     'https://eth.llamarpc.com',
    42161: 'https://arb1.arbitrum.io/rpc',
    8453:  'https://mainnet.base.org',
    137:   'https://polygon-rpc.com'
};

const CHAIN_NAME = {
    1: 'Ethereum', 42161: 'Arbitrum', 8453: 'Base', 137: 'Polygon'
};

// slot0() function selector
const SLOT0_SELECTOR = '0x3850c7bd';

export default async function handler(req, res) {
    // Verify this is a cron call or authorized request
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get all active monitors
        const { data: monitors, error } = await supabase
            .from('lp_monitors')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;
        if (!monitors || monitors.length === 0) {
            return res.status(200).json({ checked: 0 });
        }

        // Group by chain + pool for efficient RPC calls
        const poolGroups = {};
        for (const m of monitors) {
            const key = `${m.chain_id}:${m.pool_address}`;
            if (!poolGroups[key]) {
                poolGroups[key] = { chain_id: m.chain_id, pool_address: m.pool_address, monitors: [] };
            }
            poolGroups[key].monitors.push(m);
        }

        // Fetch current tick for each unique pool
        const poolTicks = {};
        await Promise.all(Object.entries(poolGroups).map(async ([key, group]) => {
            try {
                const tick = await getPoolTick(group.chain_id, group.pool_address);
                poolTicks[key] = tick;
            } catch (e) {
                console.error(`Failed to get tick for ${key}:`, e.message);
                poolTicks[key] = null;
            }
        }));

        // Check each monitor and send alerts
        let alertsSent = 0;
        const now = new Date();

        for (const m of monitors) {
            const key = `${m.chain_id}:${m.pool_address}`;
            const currentTick = poolTicks[key];
            if (currentTick === null) continue;

            const inRange = currentTick >= m.tick_lower && currentTick <= m.tick_upper;
            const newStatus = inRange ? 'in_range' : 'out_of_range';

            // Only alert on status change
            if (newStatus === m.last_status) continue;

            // Respect cooldown
            if (m.last_alert_at) {
                const timeSinceLastAlert = now - new Date(m.last_alert_at);
                if (timeSinceLastAlert < ALERT_COOLDOWN_MS) continue;
            }

            // Send Telegram notification
            const feePercent = m.fee / 10000;
            const pair = `${m.token0_symbol || '?'}/${m.token1_symbol || '?'} (${feePercent}%)`;
            const chainName = CHAIN_NAME[m.chain_id] || `Chain ${m.chain_id}`;

            let message;
            if (newStatus === 'out_of_range') {
                const direction = currentTick < m.tick_lower ? 'below your lower bound' : 'above your upper bound';
                message = [
                    `\u26A0\uFE0F *LP Position Out of Range*`,
                    ``,
                    `Pool: ${pair}`,
                    `Chain: ${chainName}`,
                    `Position ID: #${m.token_id}`,
                    `Current Tick: ${currentTick}`,
                    `Your Range: [${m.tick_lower}, ${m.tick_upper}]`,
                    `Status: OUT OF RANGE`,
                    ``,
                    `The price has moved ${direction}.`
                ].join('\n');
            } else {
                message = [
                    `\u2705 *LP Position Back In Range*`,
                    ``,
                    `Pool: ${pair}`,
                    `Chain: ${chainName}`,
                    `Position ID: #${m.token_id}`,
                    `Current Tick: ${currentTick}`,
                    `Your Range: [${m.tick_lower}, ${m.tick_upper}]`,
                    `Status: IN RANGE`
                ].join('\n');
            }

            const sent = await sendTelegram(m.telegram_chat_id, message);
            if (sent) alertsSent++;

            // Update status in DB
            await supabase.from('lp_monitors')
                .update({ last_status: newStatus, last_alert_at: now.toISOString() })
                .eq('id', m.id);
        }

        return res.status(200).json({
            checked: monitors.length,
            pools: Object.keys(poolGroups).length,
            alerts_sent: alertsSent
        });

    } catch (e) {
        console.error('Check positions error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Raw JSON-RPC call to get pool's current tick from slot0()
async function getPoolTick(chainId, poolAddress) {
    const rpc = CHAIN_RPC[chainId];
    if (!rpc) throw new Error(`No RPC for chain ${chainId}`);

    const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: poolAddress, data: SLOT0_SELECTOR }, 'latest']
        })
    });

    const json = await response.json();
    if (json.error) throw new Error(json.error.message);

    // slot0 returns: sqrtPriceX96 (32 bytes), tick (32 bytes), ...
    // tick is at offset 32 bytes = characters 66..130 in the hex string
    const result = json.result;
    if (!result || result === '0x') throw new Error('Empty result');

    const tickHex = '0x' + result.slice(66, 130);
    let tick = parseInt(tickHex, 16);

    // Handle signed int24 (tick can be negative)
    if (tick >= 2 ** 255) {
        tick = tick - 2 ** 256;
    }

    return tick;
}

async function sendTelegram(chatId, message) {
    if (!BOT_TOKEN || !chatId) return false;

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        return response.ok;
    } catch (e) {
        console.error('Telegram send error:', e);
        return false;
    }
}
