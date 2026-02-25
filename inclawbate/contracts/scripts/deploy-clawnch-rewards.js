const { ethers, upgrades } = require("hardhat");

const CLAWNCH  = "0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be";  // staking token
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808"; // reward token

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Staking token (CLAWNCH):", CLAWNCH);
  console.log("Reward token (INCLAWNCH):", INCLAWNCH);

  console.log("\n--- Deploying ClawnchRewards (UUPS Proxy) ---");

  const ClawnchRewards = await ethers.getContractFactory("ClawnchRewards");

  const proxy = await upgrades.deployProxy(
    ClawnchRewards,
    [CLAWNCH, INCLAWNCH, deployer.address],
    { kind: "uups" }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Proxy deployed to:          ", proxyAddress);
  console.log("Implementation deployed to: ", implAddress);
  console.log("Admin (you):                ", deployer.address);
  console.log("Version:                    ", (await proxy.version()).toString());

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddress}`);
  console.log("2. Approve INCLAWNCH (reward token) to the proxy:");
  console.log(`   INCLAWNCH.approve(${proxyAddress}, MAX_UINT256)`);
  console.log("3. Deposit rewards (1B INCLAWNCH over 30 days = 2592000 sec):");
  console.log(`   depositRewards(1000000000e18, 2592000)`);
  console.log("4. Update stake-app.js POOLS.clawnch.staking to:", proxyAddress);
  console.log("5. git push to deploy frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
