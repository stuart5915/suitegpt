const { ethers, upgrades } = require("hardhat");

const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  console.log("\n--- Deploying InclawnchStaking (UUPS Proxy) ---");

  const InclawnchStaking = await ethers.getContractFactory("InclawnchStaking");

  const proxy = await upgrades.deployProxy(
    InclawnchStaking,
    [INCLAWNCH, deployer.address],
    { kind: "uups" }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Proxy deployed to:          ", proxyAddress);
  console.log("Implementation deployed to: ", implAddress);
  console.log("Admin (you):                ", deployer.address);
  console.log("Version:                    ", (await proxy.version()).toString());
  console.log("Migration open:             ", await proxy.migrationOpen());

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddress}`);
  console.log("2. Approve proxy to spend your INCLAWNCH:");
  console.log(`   INCLAWNCH.approve(${proxyAddress}, MAX_UINT256)`);
  console.log("3. Migrate stakers:  npx hardhat run scripts/migrate-staking.js --network base");
  console.log("4. Deposit first rewards:  depositRewards(amount, 86400)");
  console.log("5. Update frontend to point to:", proxyAddress);
  console.log("6. After testing, call renounceUpgradeability() to lock forever");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
