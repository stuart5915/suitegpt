#!/usr/bin/env node
// Batch airdrop $CLAWS to snapshot holders via Disperse.app on Base
// Usage: PRIVATE_KEY=0x... CLAWS_ADDRESS=0x... node airdrop-claws.js
//
// Reads snapshot-2026-02-28.json, filters eligible entries with total > 0,
// batches into groups of 200, and calls disperseToken() for each batch.

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// ── Config ──
const DISPERSE_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150';
const BASE_RPC = 'https://mainnet.base.org';
const BATCH_SIZE = 200;

const CLAWS_ADDRESS = process.env.CLAWS_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!CLAWS_ADDRESS || !PRIVATE_KEY) {
    console.error('Usage: PRIVATE_KEY=0x... CLAWS_ADDRESS=0x... node airdrop-claws.js');
    process.exit(1);
}

// ── ABIs ──
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
];

const DISPERSE_ABI = [
    'function disperseToken(address token, address[] recipients, uint256[] values)',
];

// ── Helpers ──
function toWei(amount) {
    // amount is a float like 3544453618.84 — convert to 18-decimal BigInt
    // Use string math to avoid floating-point precision loss
    const str = amount.toFixed(18);
    return ethers.parseEther(str);
}

async function main() {
    // Load snapshot
    const snapshotPath = path.join(__dirname, 'snapshot-2026-02-28.json');
    if (!fs.existsSync(snapshotPath)) {
        console.error('Snapshot not found:', snapshotPath);
        process.exit(1);
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const eligible = snapshot.eligible.filter(e => e.total > 0);

    console.log(`Loaded ${eligible.length} eligible addresses`);
    console.log(`Total tokens to airdrop: ${eligible.reduce((s, e) => s + e.total, 0).toLocaleString()}`);

    // Connect
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Sending from: ${wallet.address}`);

    const claws = new ethers.Contract(CLAWS_ADDRESS, ERC20_ABI, wallet);
    const disperse = new ethers.Contract(DISPERSE_ADDRESS, DISPERSE_ABI, wallet);

    // Check balance
    const balance = await claws.balanceOf(wallet.address);
    const totalNeeded = eligible.reduce((sum, e) => sum + toWei(e.total), 0n);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} CLAWS`);
    console.log(`Total needed:   ${ethers.formatEther(totalNeeded)} CLAWS`);

    if (balance < totalNeeded) {
        console.error('Insufficient CLAWS balance!');
        process.exit(1);
    }

    // Approve Disperse if needed
    const allowance = await claws.allowance(wallet.address, DISPERSE_ADDRESS);
    if (allowance < totalNeeded) {
        console.log('Approving Disperse contract...');
        const tx = await claws.approve(DISPERSE_ADDRESS, ethers.MaxUint256);
        console.log(`Approve tx: ${tx.hash}`);
        await tx.wait();
        console.log('Approved.');
    }

    // Batch and send
    const batches = [];
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        batches.push(eligible.slice(i, i + BATCH_SIZE));
    }

    console.log(`\nSending ${batches.length} batches of up to ${BATCH_SIZE} addresses each...\n`);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const addresses = batch.map(e => e.address);
        const amounts = batch.map(e => toWei(e.total));

        const batchTotal = amounts.reduce((s, a) => s + a, 0n);
        console.log(`Batch ${i + 1}/${batches.length}: ${batch.length} addresses, ${ethers.formatEther(batchTotal)} CLAWS`);

        try {
            const tx = await disperse.disperseToken(CLAWS_ADDRESS, addresses, amounts);
            console.log(`  tx: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);
        } catch (err) {
            console.error(`  FAILED batch ${i + 1}:`, err.message);
            console.error('  Addresses in failed batch:', addresses.join(', '));
            // Continue with next batch — can retry failed ones later
        }
    }

    console.log('\nAirdrop complete!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
