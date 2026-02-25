const { ethers, upgrades } = require("hardhat");

// ⚠️  REPLACE WITH ACTUAL S4H TOKEN ADDRESS AFTER CLANKER LAUNCH
const S4H      = "0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07";  // staking token (S4H)
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808"; // reward token

async function main() {
  if (S4H === "0x0000000000000000000000000000000000000000") {
    console.error("ERROR: Replace S4H address with the actual token address from Clanker!");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Staking token (S4H):", S4H);
  console.log("Reward token (INCLAWNCH):", INCLAWNCH);

  console.log("\n--- Deploying S4H Rewards (UUPS Proxy) ---");
  console.log("Reusing ClawnchRewards contract (same dual-token logic)");

  const ClawnchRewards = await ethers.getContractFactory("ClawnchRewards");

  const proxy = await upgrades.deployProxy(
    ClawnchRewards,
    [S4H, INCLAWNCH, deployer.address],
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
  console.log("2. Transfer admin to inclawbate.base.eth:");
  console.log(`   transferAdmin(0x91B5C0D07859CFeAfEB67d9694121CD741F049bd)`);
  console.log("3. Approve INCLAWNCH (reward token) to the proxy:");
  console.log(`   INCLAWNCH.approve(${proxyAddress}, MAX_UINT256)`);
  console.log("4. Deposit rewards:");
  console.log(`   depositRewards(AMOUNT, DURATION_SECONDS)`);
  console.log("5. Update stake-app.js — move S4H from COMING_SOON to POOLS with:");
  console.log(`   token: '${S4H}'`);
  console.log(`   staking: '${proxyAddress}'`);
  console.log("6. git push to deploy frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
