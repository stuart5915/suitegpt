import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed SUITE Token
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying TreasuryV4 with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/TreasuryV4.sol/TreasuryV4.json", "utf8")
    );

    // Deploy TreasuryV4
    console.log("=== DEPLOYING TREASURYV4 (0x Aggregator) ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("0x Exchange Proxy: 0x0000000000001fF3684f28c67538d4D072C22734");
    console.log("Owner:", wallet.address);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const treasury = await factory.deploy(
        SUITE_TOKEN,
        wallet.address,
        { gasLimit: 2500000 }
    );

    console.log("\nTransaction sent, waiting for confirmation...");
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    console.log("\n✅ TreasuryV4 deployed to:", treasuryAddress);

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV4:", treasuryAddress);
    console.log("\nFeatures:");
    console.log("✅ Proportional share model (always solvent)");
    console.log("✅ 0x aggregator for best swap routes");
    console.log("✅ Accept any token on Base");
    console.log("✅ Withdraw = ETH only");
    console.log("✅ No time lock");
    console.log("\n📋 NEXT: Run configure-v4.js to set up minter/burner");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
