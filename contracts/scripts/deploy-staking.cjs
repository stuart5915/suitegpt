// Hardhat 3 deploy script with proper API usage
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying AppStaking with:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

    // SUITE Token address on Base Mainnet
    const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";

    console.log("\nDeploying AppStaking...");
    const AppStaking = await hre.ethers.getContractFactory("AppStaking");
    const appStaking = await AppStaking.deploy(SUITE_TOKEN, deployer.address);
    await appStaking.waitForDeployment();

    const stakingAddress = await appStaking.getAddress();
    console.log("\n✅ AppStaking deployed to:", stakingAddress);

    console.log("\n=== NEXT STEPS ===");
    console.log("1. Update APP_STAKING_ADDRESS in wallet.html with:", stakingAddress);
    console.log("2. Verify on Basescan:");
    console.log(`   npx hardhat verify --network base ${stakingAddress} ${SUITE_TOKEN} ${deployer.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
