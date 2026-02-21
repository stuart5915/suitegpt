// Deploy InclawnchStaking proxy for a partner token
// Usage: TOKEN_ADDRESS=0x... npx hardhat run scripts/deploy-partner-staking.js --network base

const { ethers, upgrades } = require("hardhat");

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    console.error("ERROR: Set TOKEN_ADDRESS env var to the partner's ERC-20 token address");
    console.error("Usage: TOKEN_ADDRESS=0x... npx hardhat run scripts/deploy-partner-staking.js --network base");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Partner token:", tokenAddress);

  console.log("\n--- Deploying InclawnchStaking (UUPS Proxy) for partner token ---");

  const InclawnchStaking = await ethers.getContractFactory("InclawnchStaking");

  const proxy = await upgrades.deployProxy(
    InclawnchStaking,
    [tokenAddress, deployer.address],
    { kind: "uups" }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n--- DEPLOYED ---");
  console.log("Proxy deployed to:          ", proxyAddress);
  console.log("Implementation deployed to: ", implAddress);
  console.log("Admin (you):                ", deployer.address);
  console.log("Staking token:              ", tokenAddress);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddress}`);
  console.log("2. Partner deposits reward tokens:");
  console.log(`   token.approve(${proxyAddress}, amount)`);
  console.log(`   staking.depositRewards(amount, duration_in_seconds)`);
  console.log("3. Add to POOLS config in stake-app.js:");
  console.log(`   ticker: { staking: '${proxyAddress}', token: '${tokenAddress}', ... }`);
  console.log("4. Push to deploy updated frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
