const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying SuiteYieldVault with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Your admin wallets
    const admins = [
        "0x92D67D8ad8B986e78b369bE0272E121AE5ACAd59",  // Laptop MetaMask
        "0xDEfc3AE5a990206101463d208E7e1446c58a72bD",  // PC MetaMask
        "0x53cf707eF11cD213D8f1710996C22049a45B8215"   // PC Hardware Wallet
    ];

    console.log("\nAdmin addresses:");
    admins.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

    // Deploy the contract
    console.log("\nDeploying SuiteYieldVault...");
    const SuiteYieldVault = await ethers.getContractFactory("SuiteYieldVault");
    const vault = await SuiteYieldVault.deploy(admins);

    await vault.waitForDeployment();
    const contractAddress = await vault.getAddress();

    console.log("\n✅ SuiteYieldVault deployed to:", contractAddress);
    console.log("\n📋 Next steps:");
    console.log("1. Update SUITE_YIELD_VAULT_ADDRESS in wallet.html to:", contractAddress);
    console.log("2. Verify on BaseScan:");
    console.log(`   npx hardhat verify --network base ${contractAddress} "${admins.join('" "')}"`);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const liquidBalance = await vault.getLiquidBalance();
    console.log("   Liquid balance:", ethers.formatUnits(liquidBalance, 6), "USDC");

    for (const admin of admins) {
        const isAdmin = await vault.isAdmin(admin);
        console.log(`   ${admin.slice(0, 8)}... is admin:`, isAdmin);
    }

    return contractAddress;
}

main()
    .then((address) => {
        console.log("\n🎉 Deployment complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
