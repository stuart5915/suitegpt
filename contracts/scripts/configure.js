import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const TREASURY = "0xdaD37C8A7610eD4572f5F5Db4e0b38308482c8F7";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Configuring contracts with:", wallet.address);

    // Load Token ABI
    const tokenArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );
    const treasuryArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteTreasury.sol/SuiteTreasury.json", "utf8")
    );

    const suiteToken = new ethers.Contract(SUITE_TOKEN, tokenArtifact.abi, wallet);
    const treasury = new ethers.Contract(TREASURY, treasuryArtifact.abi, wallet);

    // Step 1: Add Treasury as minter on Token
    console.log("\n1. Adding Treasury as minter on SUITE Token...");
    let tx = await suiteToken.addMinter(TREASURY);
    await tx.wait();
    console.log("✅ Treasury authorized as minter");

    // Step 2: Add Treasury as burner on Token (for withdrawals)
    console.log("\n2. Adding Treasury as burner on SUITE Token...");
    tx = await suiteToken.addBurner(TREASURY);
    await tx.wait();
    console.log("✅ Treasury authorized as burner");

    // Step 3: Initialize Treasury
    console.log("\n3. Initializing Treasury...");
    try {
        tx = await treasury.initialize(SUITE_TOKEN, USDC_BASE, wallet.address);
        await tx.wait();
        console.log("✅ Treasury initialized");
    } catch (e) {
        console.log("Treasury may already be initialized:", e.message);
    }

    console.log("\n=== CONFIGURATION COMPLETE ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("Treasury:", TREASURY);
    console.log("Owner:", wallet.address);
    console.log("\nBasescan links:");
    console.log(`Token: https://basescan.org/address/${SUITE_TOKEN}`);
    console.log(`Treasury: https://basescan.org/address/${TREASURY}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
