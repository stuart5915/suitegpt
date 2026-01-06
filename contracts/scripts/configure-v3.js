import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const TREASURY_V3 = "0x0Ab69cEFf754c90BD8126bE2B46bE978d28159FC";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Configuring TreasuryV3 with:", wallet.address);

    // Load Token ABI
    const tokenArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );

    const suiteToken = new ethers.Contract(SUITE_TOKEN, tokenArtifact.abi, wallet);

    // Add TreasuryV3 as minter
    console.log("\n1. Adding TreasuryV3 as minter...");
    let tx = await suiteToken.addMinter(TREASURY_V3);
    await tx.wait();
    console.log("✅ TreasuryV3 authorized as minter");

    // Add TreasuryV3 as burner
    console.log("\n2. Adding TreasuryV3 as burner...");
    tx = await suiteToken.addBurner(TREASURY_V3);
    await tx.wait();
    console.log("✅ TreasuryV3 authorized as burner");

    console.log("\n=== TREASURYV3 READY ===");
    console.log("\nContract addresses:");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV3:", TREASURY_V3);
    console.log("\nFeatures:");
    console.log("✅ Proportional share model");
    console.log("✅ Always solvent");
    console.log("✅ Accept any token → swap to ETH");
    console.log("✅ Withdraw = ETH only");
    console.log("✅ No time lock");
    console.log("\nBasescan:");
    console.log(`https://basescan.org/address/${TREASURY_V3}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
