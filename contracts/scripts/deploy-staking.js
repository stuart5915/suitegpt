import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// SUITE Token address on Base Mainnet
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying AppStaking with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/AppStaking.sol/AppStaking.json", "utf8")
    );

    // Deploy AppStaking
    console.log("Deploying...");

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const appStaking = await factory.deploy(
        SUITE_TOKEN,
        wallet.address,
        { gasLimit: 3000000 }
    );

    console.log("Transaction sent, waiting for confirmation...");
    await appStaking.waitForDeployment();
    const stakingAddress = await appStaking.getAddress();

    console.log("AppStaking deployed to:", stakingAddress);

    // SAVE ADDRESS TO FILE
    const deployResult = {
        network: "base",
        suiteToken: SUITE_TOKEN,
        appStaking: stakingAddress,
        deployer: wallet.address,
        timestamp: new Date().toISOString()
    };

    writeFileSync("staking-deployed.json", JSON.stringify(deployResult, null, 2));
    console.log("Saved to staking-deployed.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
