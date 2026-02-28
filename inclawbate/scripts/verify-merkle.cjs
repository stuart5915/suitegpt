const { ethers } = require('ethers');
const tree = require('./merkle-tree.json');
const root = tree.root;

console.log('Merkle root:', root);
console.log('Total proofs:', Object.keys(tree.proofs).length);

function hashLeaf(address, amount) {
    return ethers.solidityPackedKeccak256(['address', 'uint256'], [address, amount]);
}
function hashPair(a, b) {
    const sorted = [a, b].sort();
    return ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], sorted);
}
function verifyProof(proof, root, leaf) {
    let hash = leaf;
    for (const p of proof) {
        hash = hashPair(hash, p);
    }
    return hash === root;
}

const addrs = Object.keys(tree.proofs);

// Verify ALL 828 proofs
let failCount = 0;
let passCount = 0;
for (const addr of addrs) {
    const data = tree.proofs[addr];
    const leaf = hashLeaf(data.address, BigInt(data.amount));
    const valid = verifyProof(data.proof, root, leaf);
    if (valid) {
        passCount++;
    } else {
        failCount++;
        console.log('FAIL:', data.address, data.amount);
    }
}

console.log('\nResults: ' + passCount + ' passed, ' + failCount + ' failed out of ' + addrs.length);
if (failCount === 0) {
    console.log('ALL 828 MERKLE PROOFS VERIFIED SUCCESSFULLY');
} else {
    console.log('WARNING: ' + failCount + ' proofs failed verification!');
    process.exit(1);
}

// Also check Stuart's wallet specifically
const stuart = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
if (tree.proofs[stuart]) {
    const d = tree.proofs[stuart];
    console.log('\nStuart (inclawbate.base.eth):');
    console.log('  Amount:', d.amountFormatted, 'INCLAWNCH');
    console.log('  Proof length:', d.proof.length, 'hashes');
}
