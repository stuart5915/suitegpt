import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const TREASURY_V4 = "0xf121C51E18aD8f8C9B38EEAA377aD4393E16e3d1";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Configuring TreasuryV4 with:", wallet.address);

    // Load Token ABI
    const tokenArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );

    const suiteToken = new ethers.Contract(SUITE_TOKEN, tokenArtifact.abi, wallet);

    // Add TreasuryV4 as minter
    console.log("\n1. Adding TreasuryV4 as minter...");
    let tx = await suiteToken.addMinter(TREASURY_V4);
    await tx.wait();
    console.log("✅ TreasuryV4 authorized as minter");

    // Add TreasuryV4 as burner
    console.log("\n2. Adding TreasuryV4 as burner...");
    tx = await suiteToken.addBurner(TREASURY_V4);
    await tx.wait();
    console.log("✅ TreasuryV4 authorized as burner");

    console.log("\n=== TREASURYV4 READY ===");
    console.log("\nContract addresses:");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV4:", TREASURY_V4);
    console.log("\nFeatures:");
    console.log("✅ Proportional share model (always solvent)");
    console.log("✅ 0x aggregator for best swap routes");
    console.log("✅ Accept any token on Base");
    console.log("✅ Withdraw = ETH only");
    console.log("✅ No time lock");
    console.log("\nBasescan:");
    console.log(`https://basescan.org/address/${TREASURY_V4}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
