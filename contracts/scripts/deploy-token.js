import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    // Connect to Base mainnet
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying contracts with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteToken.sol/SuiteToken.json", "utf8")
    );

    // Deploy SUITE Token
    console.log("\n1. Deploying SUITE Token...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const suiteToken = await factory.deploy(wallet.address);
    await suiteToken.waitForDeployment();
    const tokenAddress = await suiteToken.getAddress();
    console.log("✅ SUITE Token deployed to:", tokenAddress);

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("SUITE Token:", tokenAddress);
    console.log("\n📋 SAVE THIS ADDRESS!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
