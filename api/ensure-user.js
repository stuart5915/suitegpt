// Ensure User Exists API
// POST /api/ensure-user
// Body: { walletAddress: string }
// Creates user in Supabase if not exists (uses service role key for security)

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for admin access
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app'
];

// Validate Ethereum wallet address (0x + 40 hex chars)
function isValidWalletAddress(address) {
    return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default async function handler(req, res) {
    // CORS headers - restrict to allowed origins
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { walletAddress } = req.body;

        if (!isValidWalletAddress(walletAddress)) {
            return res.status(400).json({ error: 'Valid wallet address required' });
        }

        const lowerWallet = walletAddress.toLowerCase();

        // Check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, credits')
            .eq('wallet_address', lowerWallet)
            .single();

        if (existingUser) {
            // User already exists
            return res.status(200).json({
                success: true,
                created: false,
                userId: existingUser.id
            });
        }

        // User doesn't exist - create them
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                wallet_address: lowerWallet,
                credits: 0,
                bonus_credits: 0
            })
            .select('id')
            .single();

        if (createError) {
            console.error('Failed to create user:', createError);
            return res.status(500).json({ error: 'Failed to create user' });
        }

        console.log('Created new user:', lowerWallet);

        return res.status(200).json({
            success: true,
            created: true,
            userId: newUser.id
        });

    } catch (error) {
        console.error('Ensure user error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
