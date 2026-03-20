const { ethers } = require("hardhat");

const CLAWS     = "0x7ca47B141639B893C6782823C0b219f872056379";
const ANGEL_NFT = "0x14d44d4d9f7898be1b9e1184a116502061eff5e7";

// Treasury wallet (inclawbate.base.eth) — will be the permanent admin
const TREASURY  = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Treasury (new admin):", TREASURY);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ── 1. Deploy AngelRewards ──
  console.log("\n--- Deploying AngelRewards ---");
  const AngelRewards = await ethers.getContractFactory("AngelRewards");
  const angel = await AngelRewards.deploy(CLAWS, ANGEL_NFT);
  await angel.waitForDeployment();
  const angelAddress = await angel.getAddress();
  console.log("AngelRewards deployed to:", angelAddress);

  // ── 2. Enumerate Angel NFT holders on-chain ──
  console.log("\n--- Fetching Angel NFT holders ---");
  const nft = await ethers.getContractAt("IERC721", ANGEL_NFT);

  // Get totalMinted via low-level call (AngelNFT custom function)
  const totalMintedData = await ethers.provider.call({
    to: ANGEL_NFT,
    data: "0xa2309ff8" // totalMinted()
  });
  const totalMinted = Number(BigInt(totalMintedData));
  console.log("Total Angel NFTs minted:", totalMinted);

  const holdersSet = new Set();
  for (let id = 1; id <= totalMinted; id++) {
    try {
      const owner = await nft.ownerOf(id);
      if (owner !== ethers.ZeroAddress) {
        holdersSet.add(owner);
      }
    } catch (e) {
      // Token may have been burned
    }
  }

  const holders = Array.from(holdersSet);
  console.log("Unique holders:", holders.length);
  holders.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  if (holders.length === 0) {
    console.log("WARNING: No holders found! Cannot proceed with syncBatch.");
    console.log("You'll need to syncBatch manually after holders mint.");
  } else {
    // ── 3. Sync all holders (sets totalWeight > 0) ──
    console.log("\n--- Syncing all holders ---");
    const tx1 = await angel.syncBatch(holders);
    await tx1.wait();
    const totalWeight = await angel.totalWeight();
    console.log("syncBatch done. totalWeight:", totalWeight.toString());
  }

  // ── 4. Transfer admin to treasury (inclawbate.base.eth) ──
  console.log("\n--- Transferring admin to treasury ---");
  const tx2 = await angel.transferAdmin(TREASURY);
  await tx2.wait();
  console.log("Admin transferred to:", TREASURY);
  console.log("Deployer wallet no longer has admin access.");

  // ── Summary ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           AngelRewards — DEPLOYED                ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║ Contract:  ", angelAddress);
  console.log("║ CLAWS:     ", CLAWS);
  console.log("║ Angel NFT: ", ANGEL_NFT);
  console.log("║ Admin:     ", TREASURY, "(inclawbate.base.eth)");
  console.log("║ Holders:   ", holders.length);
  console.log("╚══════════════════════════════════════════════════╝");

  console.log("\n--- NEXT STEPS (from inclawbate.base.eth wallet) ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${angelAddress} ${CLAWS} ${ANGEL_NFT}`);
  console.log("2. Go to /stake → Angel Rewards admin panel");
  console.log("3. Approve CLAWS + Deposit Rewards (amount + duration)");
  console.log("4. Update ANGEL_REWARDS address in stake.html");
  console.log("5. git push to deploy frontend");
  console.log("6. Announce to Angel holders");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
