// Deploy FounderAuction contract on Base
// Usage: npx hardhat run scripts/deploy-founder-auction.js --network base

const hre = require("hardhat");

async function main() {
    const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
    const TREASURY = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd"; // inclawbate.base.eth

    console.log("Deploying FounderAuction...");
    console.log("  USDC:", USDC_BASE);
    console.log("  Treasury:", TREASURY);

    const FounderAuction = await hre.ethers.getContractFactory("FounderAuction");
    const auction = await FounderAuction.deploy(USDC_BASE, TREASURY);
    await auction.waitForDeployment();

    const address = await auction.getAddress();
    console.log("\n✅ FounderAuction deployed to:", address);

    console.log("\n📋 NEXT STEPS:");
    console.log("1. Verify on Basescan:");
    console.log(`   npx hardhat verify --network base ${address} ${USDC_BASE} ${TREASURY}`);
    console.log("2. When launching a token via Clanker, set the airdrop address to:", address);
    console.log("3. After Clanker deploys, call startAuction(tokenAddress, 86400, 50000000)");
    console.log("   → 86400 = 24 hours, 50000000 = $50 min bid");
    console.log("4. Share the token site — users approve USDC + call bid(tokenAddress, amount)");
    console.log("5. After 24h, anyone calls settle(tokenAddress) → winner gets tokens, treasury gets USDC");
}

main().catch(console.error);
