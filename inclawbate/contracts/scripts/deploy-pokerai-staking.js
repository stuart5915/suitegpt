const { ethers, upgrades } = require("hardhat");

const POKERAI = "0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07"; // staking token (POKERAI)
const CLAWS   = "0x7ca47B141639B893C6782823C0b219f872056379"; // reward token (CLAWS)

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Staking token (POKERAI):", POKERAI);
  console.log("Reward token (CLAWS):", CLAWS);

  console.log("\n--- Deploying POKERAI Staking (UUPS Proxy) ---");
  console.log("Reusing ClawnchRewards contract (same dual-token logic)");

  const ClawnchRewards = await ethers.getContractFactory("ClawnchRewards");

  const proxy = await upgrades.deployProxy(
    ClawnchRewards,
    [POKERAI, CLAWS, deployer.address],
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
  console.log("3. Approve CLAWS (reward token) to the proxy:");
  console.log(`   CLAWS.approve(${proxyAddress}, MAX_UINT256)`);
  console.log("4. Deposit rewards:");
  console.log(`   depositRewards(AMOUNT, DURATION_SECONDS)`);
  console.log("5. Update stake-app.js — set pokerai staking address to:");
  console.log(`   staking: '${proxyAddress}'`);
  console.log("6. git push to deploy frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
