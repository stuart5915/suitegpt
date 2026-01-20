import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying SuiteYieldVault with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Admin wallets
    const admins = [
        "0x92D67D8ad8B986e78b369bE0272E121AE5ACAd59",  // Laptop MetaMask
        "0xDEfc3AE5a990206101463d208E7e1446c58a72bD",  // PC MetaMask
        "0x53cf707eF11cD213D8f1710996C22049a45B8215"   // PC Hardware Wallet
    ];

    console.log("\nAdmin addresses:");
    admins.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteYieldVault.sol/SuiteYieldVault.json", "utf8")
    );

    // Deploy the contract
    console.log("\nDeploying SuiteYieldVault...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    const vault = await factory.deploy(admins);
    console.log("Transaction hash:", vault.deploymentTransaction().hash);

    console.log("Waiting for confirmation...");
    await vault.waitForDeployment();

    const contractAddress = await vault.getAddress();
    console.log("\n✅ SuiteYieldVault deployed to:", contractAddress);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const liquidBalance = await vault.getLiquidBalance();
    console.log("   Liquid balance:", ethers.formatUnits(liquidBalance, 6), "USDC");

    for (const admin of admins) {
        const isAdmin = await vault.isAdmin(admin);
        console.log(`   ${admin.slice(0, 10)}... is admin:`, isAdmin);
    }

    console.log("\n📋 Next steps:");
    console.log("1. Update SUITE_YIELD_VAULT_ADDRESS in wallet.html to:", contractAddress);
    console.log("2. Verify on BaseScan: https://basescan.org/address/" + contractAddress);

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
