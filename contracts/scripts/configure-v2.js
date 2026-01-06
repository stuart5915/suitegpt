import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const TREASURY_V2 = "0x790557530fA5b4d4d0DBec45Ec8A1D04431c5bBE";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Configuring TreasuryV2 with:", wallet.address);

    // Load Token ABI
    const tokenArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );

    const suiteToken = new ethers.Contract(SUITE_TOKEN, tokenArtifact.abi, wallet);

    // Add TreasuryV2 as minter
    console.log("\n1. Adding TreasuryV2 as minter...");
    let tx = await suiteToken.addMinter(TREASURY_V2);
    await tx.wait();
    console.log("✅ TreasuryV2 authorized as minter");

    // Add TreasuryV2 as burner
    console.log("\n2. Adding TreasuryV2 as burner...");
    tx = await suiteToken.addBurner(TREASURY_V2);
    await tx.wait();
    console.log("✅ TreasuryV2 authorized as burner");

    console.log("\n=== TREASURYV2 READY ===");
    console.log("\nContract addresses:");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV2:", TREASURY_V2);
    console.log("\nFeatures enabled:");
    console.log("✅ ETH deposits");
    console.log("✅ USDC deposits");
    console.log("✅ Tiny amounts (< $1)");
    console.log("\nBasescan:");
    console.log(`https://basescan.org/address/${TREASURY_V2}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
