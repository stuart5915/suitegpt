#!/usr/bin/env node
// Deploy ClawsStaking contract to Base and transfer admin to inclawbate.base.eth
// Usage: node deploy-claws-staking.js

const { ethers } = require('ethers');

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const INCLAWBATE_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const BASE_RPC = 'https://mainnet.base.org';

// ClawsStaking compiled bytecode + ABI — we'll compile inline
// For simplicity, use the Hardhat artifacts if available, otherwise compile via solc

async function main() {
    const PRIVATE_KEY = process.env.UNSTAKE_WALLET_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!PRIVATE_KEY) {
        console.error('Set UNSTAKE_WALLET_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Deployer:', wallet.address);
    console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH');

    // Compile ClawsStaking using hardhat from the contracts directory
    console.log('\nCompiling via Hardhat...');
    const { execSync } = require('child_process');
    execSync('npx hardhat compile', {
        cwd: require('path').join(__dirname, '..', 'contracts'),
        env: { ...process.env, DEPLOYER_PRIVATE_KEY: PRIVATE_KEY },
        stdio: 'inherit'
    });

    // Load artifact
    const fs = require('fs');
    const path = require('path');
    const artifactPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'ClawsStaking.sol', 'ClawsStaking.json');

    if (!fs.existsSync(artifactPath)) {
        // Try moving the contract to the right place
        const contractSrc = path.join(__dirname, '..', 'contracts', 'ClawsStaking.sol');
        const contractDst = path.join(__dirname, '..', 'contracts', 'contracts', 'ClawsStaking.sol');
        if (fs.existsSync(contractSrc) && !fs.existsSync(contractDst)) {
            fs.copyFileSync(contractSrc, contractDst);
            console.log('Copied ClawsStaking.sol to contracts/contracts/');
            execSync('npx hardhat compile', {
                cwd: path.join(__dirname, '..', 'contracts'),
                env: { ...process.env, DEPLOYER_PRIVATE_KEY: PRIVATE_KEY },
                stdio: 'inherit'
            });
        }
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Deploy
    console.log('\nDeploying ClawsStaking...');
    console.log('CLAWS token:', CLAWS_ADDRESS);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(CLAWS_ADDRESS);
    console.log('Deploy tx:', contract.deploymentTransaction().hash);

    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log('ClawsStaking deployed to:', address);

    // Transfer admin to inclawbate.base.eth
    console.log('\nTransferring admin to', INCLAWBATE_WALLET, '...');
    const tx = await contract.transferAdmin(INCLAWBATE_WALLET);
    console.log('Transfer tx:', tx.hash);
    await tx.wait();
    console.log('Admin transferred!');

    // Verify
    const newAdmin = await contract.admin();
    console.log('Verified admin:', newAdmin);

    console.log('\n=== DONE ===');
    console.log('ClawsStaking:', address);
    console.log('Admin:', newAdmin);
    console.log('CLAWS token:', CLAWS_ADDRESS);
    console.log('\nNext: add to stake page + deposit rewards from inclawbate.base.eth');
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
