import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying TreasuryV2 with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/TreasuryV2.sol/TreasuryV2.json", "utf8")
    );

    // Deploy TreasuryV2
    console.log("\n1. Deploying TreasuryV2 (with ETH support)...");
    console.log("   SUITE Token:", SUITE_TOKEN);
    console.log("   USDC:", USDC_BASE);
    console.log("   Owner:", wallet.address);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const treasury = await factory.deploy(SUITE_TOKEN, USDC_BASE, wallet.address, {
        gasLimit: 2500000
    });

    console.log("Transaction sent, waiting for confirmation...");
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    console.log("✅ TreasuryV2 deployed to:", treasuryAddress);

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV2:", treasuryAddress);
    console.log("\nFeatures:");
    console.log("- ETH deposits ✅");
    console.log("- USDC deposits ✅");
    console.log("- Tiny amounts < $1 ✅");
    console.log("\n📋 SAVE THIS ADDRESS!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
