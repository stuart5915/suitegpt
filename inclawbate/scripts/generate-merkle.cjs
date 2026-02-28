#!/usr/bin/env node
// Generate Merkle tree from snapshot for AngelNFT eligibility proofs
// Usage: node generate-merkle.js
// Output: merkle-tree.json (root + per-address proofs)

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Simple Merkle tree implementation (no external deps beyond ethers)
function hashLeaf(address, amount) {
    return ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [address, amount]
    );
}

function hashPair(a, b) {
    // Sort to ensure deterministic ordering
    const sorted = [a, b].sort();
    return ethers.solidityPackedKeccak256(
        ['bytes32', 'bytes32'],
        sorted
    );
}

function buildTree(leaves) {
    if (leaves.length === 0) return { root: ethers.ZeroHash, layers: [] };
    if (leaves.length === 1) return { root: leaves[0], layers: [leaves] };

    const layers = [leaves.slice()];

    while (layers[layers.length - 1].length > 1) {
        const current = layers[layers.length - 1];
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
            if (i + 1 < current.length) {
                next.push(hashPair(current[i], current[i + 1]));
            } else {
                next.push(current[i]); // odd node promotes
            }
        }
        layers.push(next);
    }

    return { root: layers[layers.length - 1][0], layers };
}

function getProof(layers, index) {
    const proof = [];
    let idx = index;
    for (let i = 0; i < layers.length - 1; i++) {
        const layer = layers[i];
        const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        if (pairIdx < layer.length) {
            proof.push(layer[pairIdx]);
        }
        idx = Math.floor(idx / 2);
    }
    return proof;
}

function toWei(amount) {
    return ethers.parseEther(amount.toFixed(18));
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

    console.log(`Building Merkle tree for ${eligible.length} addresses...`);

    // Build leaves: keccak256(abi.encodePacked(address, amount))
    // Amount = their INCLAWNCH total (wallet + staked) in wei
    const entries = eligible.map(e => ({
        address: ethers.getAddress(e.address), // checksum
        amount: toWei(e.total),
        amountRaw: e.total,
    }));

    const leaves = entries.map(e => hashLeaf(e.address, e.amount));

    const { root, layers } = buildTree(leaves);

    console.log(`Merkle root: ${root}`);
    console.log(`Total leaves: ${leaves.length}`);

    // Generate proofs for each address
    const proofs = {};
    for (let i = 0; i < entries.length; i++) {
        const proof = getProof(layers, i);
        proofs[entries[i].address.toLowerCase()] = {
            address: entries[i].address,
            amount: entries[i].amount.toString(),
            amountFormatted: entries[i].amountRaw,
            proof,
            leaf: leaves[i],
        };
    }

    // Output
    const output = {
        root,
        totalLeaves: leaves.length,
        generated: new Date().toISOString(),
        snapshotFile: 'snapshot-2026-02-28.json',
        proofs,
    };

    const outPath = path.join(__dirname, 'merkle-tree.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Written to ${outPath}`);

    // Also write a minimal proofs file for the frontend (just address → proof + amount)
    const frontendProofs = {};
    for (const [addr, data] of Object.entries(proofs)) {
        frontendProofs[addr] = {
            amount: data.amount,
            proof: data.proof,
        };
    }

    const frontendPath = path.join(__dirname, 'merkle-proofs.json');
    fs.writeFileSync(frontendPath, JSON.stringify({ root, proofs: frontendProofs }));
    console.log(`Frontend proofs written to ${frontendPath}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
