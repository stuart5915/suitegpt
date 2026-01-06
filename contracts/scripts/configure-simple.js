import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const SIMPLE_TREASURY = "0x13DC8dF5ab889ECE2B692256591e6Db63599ec7B";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Configuring with:", wallet.address);

    // Load Token ABI
    const tokenArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );

    const suiteToken = new ethers.Contract(SUITE_TOKEN, tokenArtifact.abi, wallet);

    // Add SimpleTreasury as minter
    console.log("\n1. Adding SimpleTreasury as minter...");
    let tx = await suiteToken.addMinter(SIMPLE_TREASURY);
    await tx.wait();
    console.log("✅ SimpleTreasury authorized as minter");

    // Add SimpleTreasury as burner
    console.log("\n2. Adding SimpleTreasury as burner...");
    tx = await suiteToken.addBurner(SIMPLE_TREASURY);
    await tx.wait();
    console.log("✅ SimpleTreasury authorized as burner");

    console.log("\n=== CONFIGURATION COMPLETE ===");
    console.log("SimpleTreasury is now ready to accept deposits!");
    console.log("\nContract addresses:");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("SimpleTreasury:", SIMPLE_TREASURY);
    console.log("\nBasescan links:");
    console.log(`Token: https://basescan.org/address/${SUITE_TOKEN}`);
    console.log(`Treasury: https://basescan.org/address/${SIMPLE_TREASURY}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
