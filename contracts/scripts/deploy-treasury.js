import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Base Mainnet USDC address
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Our deployed SUITE Token
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";

async function main() {
    // Connect to Base mainnet with longer timeout
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true,
        batchMaxCount: 1
    });

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying Treasury with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Read the compiled contract artifacts
    const treasuryArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteTreasury.sol/SuiteTreasury.json", "utf8")
    );

    // Deploy the implementation
    console.log("\n1. Deploying Treasury Implementation...");
    const TreasuryFactory = new ethers.ContractFactory(
        treasuryArtifact.abi,
        treasuryArtifact.bytecode,
        wallet
    );

    const treasuryImpl = await TreasuryFactory.deploy({
        gasLimit: 5000000
    });
    console.log("Transaction sent, waiting for confirmation...");

    await treasuryImpl.waitForDeployment();
    const implAddress = await treasuryImpl.getAddress();
    console.log("✅ Treasury Implementation deployed to:", implAddress);

    console.log("\n=== TREASURY DEPLOYMENT COMPLETE ===");
    console.log("Implementation Address:", implAddress);
    console.log("\n📋 SAVE THESE ADDRESSES!");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("Treasury:", implAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
