// Deploy SUITE Bridge Contract
// Run: npx hardhat run scripts/deploy-bridge.js --network base

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying SuiteBridge with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // ============================================
    // CONFIGURATION - Update these before deploying!
    // ============================================

    // SUITE Token address (from your existing deployment)
    const SUITE_TOKEN_ADDRESS = "0xYOUR_SUITE_TOKEN_ADDRESS"; // TODO: Update this!

    // Signer address - this wallet will sign withdrawal approvals
    // Should be a secure backend wallet (e.g., Railway secrets)
    const SIGNER_ADDRESS = deployer.address; // TODO: Use a dedicated signer wallet in production!

    // ============================================

    console.log("\n📋 Deployment Configuration:");
    console.log("   SUITE Token:", SUITE_TOKEN_ADDRESS);
    console.log("   Signer:", SIGNER_ADDRESS);

    // Deploy bridge
    console.log("\n🚀 Deploying SuiteBridge...");
    const SuiteBridge = await hre.ethers.getContractFactory("SuiteBridge");
    const bridge = await SuiteBridge.deploy(SUITE_TOKEN_ADDRESS, SIGNER_ADDRESS);

    await bridge.waitForDeployment();
    const bridgeAddress = await bridge.getAddress();

    console.log("\n✅ SuiteBridge deployed to:", bridgeAddress);

    // Verify on block explorer (optional)
    console.log("\n📝 To verify on BaseScan, run:");
    console.log(`npx hardhat verify --network base ${bridgeAddress} ${SUITE_TOKEN_ADDRESS} ${SIGNER_ADDRESS}`);

    // Print next steps
    console.log("\n" + "=".repeat(50));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(50));
    console.log("\n📋 Next Steps:");
    console.log("1. Update BRIDGE_ADDRESS in wallet.html:");
    console.log(`   const BRIDGE_ADDRESS = '${bridgeAddress}';`);
    console.log("\n2. Run add-bridge-tables.sql in Supabase SQL Editor");
    console.log("\n3. Set up bridge-listener.js on Railway with:");
    console.log(`   BRIDGE_CONTRACT_ADDRESS=${bridgeAddress}`);
    console.log(`   SIGNER_PRIVATE_KEY=<your-signer-private-key>`);
    console.log("   SUPABASE_SERVICE_KEY=<your-supabase-service-key>");
    console.log("   RPC_URL=https://mainnet.base.org");
    console.log("\n4. Fund the bridge with SUITE tokens for withdrawals");
    console.log("   (Users deposit their own SUITE for the deposit direction)");

    return bridgeAddress;
}

main()
    .then((address) => {
        console.log("\n✅ Done! Bridge address:", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
