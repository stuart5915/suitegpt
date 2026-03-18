const { ethers } = require("hardhat");

const CLAWS     = "0x7ca47B141639B893C6782823C0b219f872056379";
const ANGEL_NFT = "0x14d44d4d9f7898be1b9e1184a116502061eff5e7";

// 5.1 billion CLAWS over ~718 days (remaining staking period)
const REWARD_AMOUNT = ethers.parseEther("5100000000");   // 5.1B * 1e18
const DURATION      = 718 * 24 * 60 * 60;                // 718 days in seconds

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
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
    console.log("WARNING: No holders found! Cannot proceed with syncBatch + deposit.");
    console.log("You'll need to syncBatch manually after holders mint.");
    return;
  }

  // ── 3. Sync all holders (sets totalWeight > 0) ──
  console.log("\n--- Syncing all holders ---");
  const tx1 = await angel.syncBatch(holders);
  await tx1.wait();
  const totalWeight = await angel.totalWeight();
  console.log("syncBatch done. totalWeight:", totalWeight.toString());

  // ── 4. Approve CLAWS spending ──
  console.log("\n--- Approving CLAWS ---");
  const claws = await ethers.getContractAt("IERC20", CLAWS);
  const balance = await claws.balanceOf(deployer.address);
  console.log("Your CLAWS balance:", ethers.formatEther(balance));

  if (balance < REWARD_AMOUNT) {
    console.log("WARNING: Insufficient CLAWS balance!");
    console.log("Need:", ethers.formatEther(REWARD_AMOUNT));
    console.log("Have:", ethers.formatEther(balance));
    console.log("\nContract deployed and holders synced. Fund manually later:");
    console.log(`  1. Transfer CLAWS to ${deployer.address}`);
    console.log(`  2. claws.approve(${angelAddress}, ${ethers.formatEther(REWARD_AMOUNT)})`);
    console.log(`  3. angelRewards.depositRewards(${ethers.formatEther(REWARD_AMOUNT)}, ${DURATION})`);
    return;
  }

  const tx2 = await claws.approve(angelAddress, REWARD_AMOUNT);
  await tx2.wait();
  console.log("Approved", ethers.formatEther(REWARD_AMOUNT), "CLAWS");

  // ── 5. Deposit rewards ──
  console.log("\n--- Depositing rewards ---");
  const tx3 = await angel.depositRewards(REWARD_AMOUNT, DURATION);
  await tx3.wait();
  const rate = await angel.rewardRate();
  console.log("depositRewards done!");
  console.log("Reward rate:", rate.toString(), "CLAWS/sec");
  console.log("Duration:", DURATION, "seconds (~718 days)");

  // ── Summary ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           AngelRewards — DEPLOYED                ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║ Contract:  ", angelAddress);
  console.log("║ CLAWS:     ", CLAWS);
  console.log("║ Angel NFT: ", ANGEL_NFT);
  console.log("║ Admin:     ", deployer.address);
  console.log("║ Holders:   ", holders.length);
  console.log("║ Weight:    ", totalWeight.toString());
  console.log("║ Rewards:    5.1B CLAWS over ~718 days");
  console.log("║ Rate:      ", rate.toString(), "CLAWS/sec");
  console.log("╚══════════════════════════════════════════════════╝");

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${angelAddress} ${CLAWS} ${ANGEL_NFT}`);
  console.log("2. Build claim UI on /stake page");
  console.log("3. Announce to Angel holders");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
