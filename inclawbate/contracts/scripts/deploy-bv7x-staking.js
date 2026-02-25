// Deploy InclawnchStaking proxy for BitVault Signal (BV7X)
// Usage: npx hardhat run scripts/deploy-bv7x-staking.js --network base

const { ethers, upgrades } = require("hardhat");

const BV7X_TOKEN = "0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC";
const BV7X_ADMIN = "0xd8B71d23e1a8da9867497C0E757A1143B94C3e1e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("BV7X token:", BV7X_TOKEN);
  console.log("Target admin:", BV7X_ADMIN);

  // --- Deploy InclawnchStaking proxy ---
  console.log("\n--- Deploying InclawnchStaking (UUPS Proxy) for BV7X ---");

  const InclawnchStaking = await ethers.getContractFactory("InclawnchStaking");

  const proxy = await upgrades.deployProxy(
    InclawnchStaking,
    [BV7X_TOKEN, deployer.address],
    { kind: "uups" }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n--- DEPLOYED ---");
  console.log("Proxy deployed to:          ", proxyAddress);
  console.log("Implementation deployed to: ", implAddress);

  // --- Transfer admin to BV7X team ---
  console.log("\n--- Transferring admin to BV7X team ---");
  const tx = await proxy.transferAdmin(BV7X_ADMIN);
  await tx.wait();
  console.log("Admin transferred to:       ", BV7X_ADMIN);

  // --- Verify ---
  const newAdmin = await proxy.admin();
  console.log("Verified new admin:         ", newAdmin);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify implementation on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddress}`);
  console.log("2. BV7X admin deposits reward tokens:");
  console.log(`   BV7X.approve(${proxyAddress}, amount)`);
  console.log(`   staking.depositRewards(amount, duration_in_seconds)`);
  console.log("3. Update POOLS config in stake-app.js:");
  console.log(`   bv7x: { staking: '${proxyAddress}', ... }`);
  console.log("4. git push to deploy updated frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
