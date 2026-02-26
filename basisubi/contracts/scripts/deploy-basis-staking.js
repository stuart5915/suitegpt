const { ethers, upgrades } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Addresses — Update after $BASIS launch on Clanker
// ═══════════════════════════════════════════════════════════════

// ⚠️  REPLACE with actual $BASIS token address after Clanker Direct launch
const BASIS     = "0x0000000000000000000000000000000000000000";
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";

async function main() {
  if (BASIS === "0x0000000000000000000000000000000000000000") {
    console.error("ERROR: Replace BASIS address with the actual token address from Clanker!");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Staking token (BASIS):", BASIS);
  console.log("Reward token (INCLAWNCH):", INCLAWNCH);

  // ───────────────────────────────────────────
  //  Deploy BasisStaking (reuses ClawnchRewards.sol)
  // ───────────────────────────────────────────

  console.log("\n--- Deploying BasisStaking (UUPS Proxy) ---");
  console.log("Reusing ClawnchRewards contract (same dual-token staking logic)");

  // NOTE: ClawnchRewards.sol must be in the contracts/ directory.
  // Copy from inclawbate/contracts/contracts/ClawnchRewards.sol
  const ClawnchRewards = await ethers.getContractFactory("ClawnchRewards");

  const proxy = await upgrades.deployProxy(
    ClawnchRewards,
    [BASIS, INCLAWNCH, deployer.address],
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
  console.log("");
  console.log("2. Approve INCLAWNCH to the proxy:");
  console.log(`   INCLAWNCH.approve(${proxyAddress}, MAX_UINT256)`);
  console.log("");
  console.log("3. Deposit initial rewards:");
  console.log(`   depositRewards(AMOUNT, DURATION_SECONDS)`);
  console.log("   e.g. depositRewards(1000000e18, 2592000) for 30-day drip");
  console.log("");
  console.log("4. Update basisubi/stake.html with:");
  console.log(`   TOKEN_ADDRESS = '${BASIS}'`);
  console.log(`   STAKING_ADDRESS = '${proxyAddress}'`);
  console.log("");
  console.log("5. git push to deploy frontend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
