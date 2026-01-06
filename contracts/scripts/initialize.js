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

    console.log("Initializing Treasury with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Load Treasury ABI
    const treasuryArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteTreasury.sol/SuiteTreasury.json", "utf8")
    );

    const treasury = new ethers.Contract(TREASURY, treasuryArtifact.abi, wallet);

    console.log("\nInitializing Treasury...");
    console.log("- SUITE Token:", SUITE_TOKEN);
    console.log("- USDC:", USDC_BASE);
    console.log("- Owner:", wallet.address);

    try {
        const tx = await treasury.initialize(SUITE_TOKEN, USDC_BASE, wallet.address, {
            gasLimit: 500000
        });
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Treasury initialized successfully!");

    } catch (error) {
        if (error.message.includes("already initialized") || error.message.includes("Initializable")) {
            console.log("Treasury was already initialized - that's OK!");
        } else {
            throw error;
        }
    }

    console.log("\n=== TREASURY READY ===");
    console.log("Deposits are now enabled!");
    console.log("\nContract addresses:");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("Treasury:", TREASURY);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
