const { ethers } = require("hardhat");

const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";
const DEPLOY_FEE = ethers.parseEther("1000000"); // 1M INCLAWNCH burn per deployPaid

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Burn token (INCLAWNCH):", INCLAWNCH);
  console.log("Deploy fee:", ethers.formatEther(DEPLOY_FEE), "INCLAWNCH");

  // Step 1: Deploy ClawnchRewardsLite (implementation for clones)
  console.log("\n--- Step 1: Deploying ClawnchRewardsLite (implementation) ---");
  const Lite = await ethers.getContractFactory("ClawnchRewardsLite");
  const lite = await Lite.deploy();
  await lite.waitForDeployment();
  const liteAddr = await lite.getAddress();
  console.log("ClawnchRewardsLite deployed to:", liteAddr);

  // Step 2: Deploy StakingFactory
  console.log("\n--- Step 2: Deploying StakingFactory ---");
  const Factory = await ethers.getContractFactory("StakingFactory");
  const factory = await Factory.deploy(liteAddr, INCLAWNCH, DEPLOY_FEE);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("StakingFactory deployed to:", factoryAddr);

  console.log("\n--- SUMMARY ---");
  console.log("Implementation (ClawnchRewardsLite):", liteAddr);
  console.log("StakingFactory:                     ", factoryAddr);
  console.log("Owner:                              ", deployer.address);
  console.log("Deploy fee:                         ", ethers.formatEther(DEPLOY_FEE), "INCLAWNCH");

  console.log("\n--- VERIFY COMMANDS ---");
  console.log(`npx hardhat verify --network base ${liteAddr}`);
  console.log(`npx hardhat verify --network base ${factoryAddr} ${liteAddr} ${INCLAWNCH} ${DEPLOY_FEE}`);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Update inclawbator-app.js with STAKING_FACTORY =", factoryAddr);
  console.log("2. Update deployPaid/deployFree selectors in inclawbator-app.js");
  console.log("3. Test deployPaid: approve INCLAWNCH to factory, call deployPaid(tokenAddr, INCLAWNCH)");
  console.log("4. Transfer factory owner to multisig if desired");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
