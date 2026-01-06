import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

    // Deploy SUITE Token
    console.log("\n1. Deploying SUITE Token...");
    const SuiteToken = await hre.ethers.getContractFactory("SuiteToken");
    const suiteToken = await SuiteToken.deploy(deployer.address);
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
