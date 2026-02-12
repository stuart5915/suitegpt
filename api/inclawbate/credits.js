// Inclawbate — Credits API
// GET  ?key=xxx              — check balance by API key (extension use)
// GET  (Bearer JWT)          — get own credits + api_key (dashboard use)
// POST {action:"generate-key"}  — generate/regenerate API key (JWT)
// POST {action:"add-credits", handle, amount, admin_secret} — admin top-up
// POST {action:"deposit", tx_hash} — self-service CLAWNCH deposit (JWT)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
import { randomBytes } from 'crypto';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

// Deposit constants
const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'.toLowerCase();
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd'.toLowerCase();
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CLAWNCH_PER_CREDIT = 50;

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify CLAWNCH transfer on Base chain (with retry + fallback RPC)
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function rpcCall(method, params) {
    for (let i = 0; i < BASE_RPCS.length; i++) {
        try {
            const resp = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            if (resp.status === 429) continue; // rate limited, try next
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next RPC */ }
    }
    return null;
}

async function verifyDepositTx(txHash) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }

    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWNCH_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWNCH transfer found in transaction' };
    }

    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;

    if (to !== PROTOCOL_WALLET) {
        return { valid: false, reason: 'Transfer was not sent to the protocol wallet' };
    }

    if (amount <= 0) {
        return { valid: false, reason: 'Transfer amount is zero' };
    }

    return { valid: true, amount };
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || /^chrome-extension:\/\//.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — check balance
    if (req.method === 'GET') {
        const apiKey = req.query.key;

        if (apiKey) {
            // Extension flow: lookup by API key
            const { data, error } = await supabase
                .from('human_profiles')
                .select('id, x_handle, credits')
                .eq('api_key', apiKey)
                .single();

            if (error || !data) {
                return res.status(401).json({ error: 'Invalid API key' });
            }

            // Count unread conversations (last message from agent, human hasn't replied)
            let unread = 0;
            try {
                const { data: convos } = await supabase
                    .from('inclawbate_conversations')
                    .select('id')
                    .eq('human_id', data.id)
                    .eq('status', 'active');

                if (convos && convos.length > 0) {
                    const { data: msgs } = await supabase
                        .from('inclawbate_messages')
                        .select('conversation_id, sender_type')
                        .in('conversation_id', convos.map(c => c.id));

                    const lastSender = {};
                    (msgs || []).forEach(m => { lastSender[m.conversation_id] = m.sender_type; });
                    unread = Object.values(lastSender).filter(s => s === 'agent').length;
                }
            } catch (e) { /* non-critical */ }

            return res.status(200).json({ credits: data.credits, handle: data.x_handle, unread });
        }

        // Dashboard flow: JWT auth
        const user = authenticateRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { data, error } = await supabase
            .from('human_profiles')
            .select('credits, api_key')
            .eq('id', user.sub)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        return res.status(200).json({ credits: data.credits, api_key: data.api_key });
    }

    // POST — actions
    if (req.method === 'POST') {
        const { action } = req.body;

        if (action === 'generate-key') {
            const user = authenticateRequest(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const newKey = 'inclw_' + randomBytes(24).toString('hex');

            const { data, error } = await supabase
                .from('human_profiles')
                .update({ api_key: newKey })
                .eq('id', user.sub)
                .select('api_key')
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to generate key' });
            }

            return res.status(200).json({ api_key: data.api_key });
        }

        if (action === 'add-credits') {
            const { handle, amount, admin_secret } = req.body;
            const expectedSecret = process.env.INCLAWBATE_ADMIN_SECRET;

            if (!expectedSecret || admin_secret !== expectedSecret) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            if (!handle || !amount || typeof amount !== 'number' || amount <= 0) {
                return res.status(400).json({ error: 'handle and positive amount required' });
            }

            const { data: newBalance, error } = await supabase
                .rpc('add_inclawbate_credits', {
                    target_handle: handle.toLowerCase(),
                    credit_amount: Math.floor(amount)
                });

            if (error) {
                return res.status(400).json({ error: error.message || 'Failed to add credits' });
            }

            return res.status(200).json({ credits: newBalance, handle: handle.toLowerCase() });
        }

        if (action === 'deposit') {
            const user = authenticateRequest(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required. Log in at inclawbate.com/launch first.' });
            }

            const { tx_hash } = req.body;
            if (!tx_hash || typeof tx_hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                return res.status(400).json({ error: 'Valid tx_hash required' });
            }

            // Check for duplicate
            const { data: existing } = await supabase
                .from('inclawbate_deposits')
                .select('id')
                .eq('tx_hash', tx_hash.toLowerCase())
                .single();

            if (existing) {
                return res.status(409).json({ error: 'This transaction has already been credited' });
            }

            // Verify on-chain
            const verification = await verifyDepositTx(tx_hash);
            if (!verification.valid) {
                return res.status(400).json({ error: verification.reason });
            }

            const credits = Math.floor(verification.amount / CLAWNCH_PER_CREDIT);
            if (credits <= 0) {
                return res.status(400).json({ error: `Deposit too small. Minimum ${CLAWNCH_PER_CREDIT} CLAWNCH for 1 credit.` });
            }

            // Get user's handle for add_inclawbate_credits RPC
            const { data: profile, error: profileErr } = await supabase
                .from('human_profiles')
                .select('id, x_handle')
                .eq('id', user.sub)
                .single();

            if (profileErr || !profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            // Record deposit
            const { error: insertErr } = await supabase
                .from('inclawbate_deposits')
                .insert({
                    profile_id: profile.id,
                    tx_hash: tx_hash.toLowerCase(),
                    clawnch_amount: verification.amount,
                    credits_granted: credits
                });

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This transaction has already been credited' });
                }
                return res.status(500).json({ error: 'Failed to record deposit' });
            }

            // Add credits
            const { data: newBalance, error: creditErr } = await supabase
                .rpc('add_inclawbate_credits', {
                    target_handle: profile.x_handle.toLowerCase(),
                    credit_amount: credits
                });

            if (creditErr) {
                return res.status(500).json({ error: 'Deposit recorded but failed to add credits. Contact support.' });
            }

            return res.status(200).json({
                credits_added: credits,
                credits_total: newBalance,
                clawnch_deposited: verification.amount
            });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
