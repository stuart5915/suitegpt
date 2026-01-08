/**
 * SUITE Bridge Listener
 * 
 * Watches for Deposited events on the SuiteBridge contract
 * and credits Discord balances in Supabase.
 * 
 * SECURITY FEATURES:
 * - Unique tx_hash constraint prevents duplicate credits
 * - Database function handles atomic updates
 * - Event replay from last processed block on restart
 * 
 * Usage: node bridge-listener.js
 * 
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (use service key, not anon key)
 * - RPC_URL (Base mainnet or testnet RPC)
 * - BRIDGE_CONTRACT_ADDRESS
 * - SIGNER_PRIVATE_KEY (for signing withdrawals)
 */

const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin access
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const BRIDGE_ADDRESS = process.env.BRIDGE_CONTRACT_ADDRESS;
const SIGNER_KEY = process.env.SIGNER_PRIVATE_KEY;

// Bridge contract ABI (only what we need)
const BRIDGE_ABI = [
    "event Deposited(address indexed wallet, string discordId, uint256 amount, uint256 timestamp)",
    "event Withdrawn(address indexed wallet, uint256 amount, bytes32 nonce, uint256 timestamp)"
];

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = SIGNER_KEY ? new ethers.Wallet(SIGNER_KEY, provider) : null;
const bridge = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, provider);

// State
let lastProcessedBlock = 0;
const CONFIRMATION_BLOCKS = 3; // Wait for confirmations

/**
 * Get the last processed block from database
 */
async function getLastProcessedBlock() {
    const { data, error } = await supabase
        .from('bridge_transactions')
        .select('block_number')
        .order('block_number', { ascending: false })
        .limit(1);
    
    if (error) {
        console.error('Error getting last block:', error);
        return 0;
    }
    
    return data?.[0]?.block_number || 0;
}

/**
 * Process a Deposited event
 */
async function processDeposit(event) {
    const { wallet, discordId, amount } = event.args;
    const txHash = event.transactionHash;
    const blockNumber = event.blockNumber;
    
    console.log(`Processing deposit: ${wallet} -> ${discordId}, ${ethers.formatEther(amount)} SUITE`);
    
    // Call the atomic credit function in Supabase
    const { data, error } = await supabase.rpc('credit_discord_balance', {
        p_discord_id: discordId,
        p_wallet_address: wallet.toLowerCase(),
        p_amount: amount.toString(), // Store as string to handle big numbers
        p_tx_hash: txHash,
        p_block_number: blockNumber
    });
    
    if (error) {
        console.error('Error crediting balance:', error);
        return false;
    }
    
    if (data === false) {
        console.log(`Transaction ${txHash} already processed, skipping`);
        return false;
    }
    
    console.log(`✅ Credited ${ethers.formatEther(amount)} SUITE to Discord ID: ${discordId}`);
    return true;
}

/**
 * Scan for new deposit events
 */
async function scanForDeposits() {
    try {
        const currentBlock = await provider.getBlockNumber();
        const safeBlock = currentBlock - CONFIRMATION_BLOCKS;
        
        if (safeBlock <= lastProcessedBlock) {
            return; // No new confirmed blocks
        }
        
        console.log(`Scanning blocks ${lastProcessedBlock + 1} to ${safeBlock}`);
        
        // Get Deposited events
        const events = await bridge.queryFilter(
            bridge.filters.Deposited(),
            lastProcessedBlock + 1,
            safeBlock
        );
        
        console.log(`Found ${events.length} deposit events`);
        
        for (const event of events) {
            await processDeposit(event);
        }
        
        lastProcessedBlock = safeBlock;
        
    } catch (error) {
        console.error('Error scanning for deposits:', error);
    }
}

/**
 * Sign a withdrawal request
 */
async function signWithdrawal(walletAddress, amount, nonce) {
    if (!signer) {
        throw new Error('Signer not configured');
    }
    
    const chainId = (await provider.getNetwork()).chainId;
    
    const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'bytes32', 'uint256'],
        [walletAddress, amount, nonce, chainId]
    );
    
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
}

/**
 * Process pending withdrawal requests
 */
async function processWithdrawals() {
    const { data: requests, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());
    
    if (error) {
        console.error('Error fetching withdrawal requests:', error);
        return;
    }
    
    for (const request of requests || []) {
        try {
            // Verify user has sufficient balance
            const { data: balance } = await supabase
                .from('user_balances')
                .select('balance')
                .eq('discord_id', request.discord_id)
                .single();
            
            if (!balance || BigInt(balance.balance) < BigInt(request.amount)) {
                console.log(`Insufficient balance for withdrawal request ${request.id}`);
                await supabase
                    .from('withdrawal_requests')
                    .update({ status: 'failed' })
                    .eq('id', request.id);
                continue;
            }
            
            // Sign the withdrawal
            const signature = await signWithdrawal(
                request.wallet_address,
                request.amount,
                request.nonce
            );
            
            // Deduct from Discord balance
            await supabase
                .from('user_balances')
                .update({ balance: (BigInt(balance.balance) - BigInt(request.amount)).toString() })
                .eq('discord_id', request.discord_id);
            
            // Update request with signature
            await supabase
                .from('withdrawal_requests')
                .update({ signature, status: 'signed' })
                .eq('id', request.id);
            
            console.log(`✅ Signed withdrawal for ${request.wallet_address}`);
            
        } catch (error) {
            console.error(`Error processing withdrawal ${request.id}:`, error);
        }
    }
}

/**
 * Main loop
 */
async function main() {
    console.log('🌉 SUITE Bridge Listener starting...');
    console.log(`Bridge contract: ${BRIDGE_ADDRESS}`);
    console.log(`RPC: ${RPC_URL}`);
    
    // Get last processed block
    lastProcessedBlock = await getLastProcessedBlock();
    console.log(`Starting from block ${lastProcessedBlock}`);
    
    // Poll every 15 seconds
    setInterval(async () => {
        await scanForDeposits();
        await processWithdrawals();
    }, 15000);
    
    // Initial scan
    await scanForDeposits();
    await processWithdrawals();
    
    console.log('🎧 Listening for bridge events...');
}

main().catch(console.error);
