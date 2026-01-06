import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed SUITE Token
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";

// Base Mainnet addresses
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Uniswap V3 Router on Base
const WETH = "0x4200000000000000000000000000000000000006"; // WETH on Base

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying TreasuryV3 with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/TreasuryV3.sol/TreasuryV3.json", "utf8")
    );

    // Deploy TreasuryV3
    console.log("=== DEPLOYING TREASURYV3 ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("Uniswap Router:", UNISWAP_ROUTER);
    console.log("WETH:", WETH);
    console.log("Owner:", wallet.address);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const treasury = await factory.deploy(
        SUITE_TOKEN,
        UNISWAP_ROUTER,
        WETH,
        wallet.address,
        { gasLimit: 3000000 }
    );

    console.log("\nTransaction sent, waiting for confirmation...");
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    console.log("\n✅ TreasuryV3 deployed to:", treasuryAddress);

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("SUITE Token:", SUITE_TOKEN);
    console.log("TreasuryV3:", treasuryAddress);
    console.log("\nFeatures:");
    console.log("✅ Proportional share model (always solvent)");
    console.log("✅ Accept any token → swap to ETH");
    console.log("✅ Withdraw = ETH only");
    console.log("✅ No time lock");
    console.log("\n📋 NEXT: Run configure-v3.js to set up minter/burner");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
