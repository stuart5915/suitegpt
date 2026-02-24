const { ethers } = require("hardhat");

// ===== FILL THESE IN =====

// The proxy address from deploy step
const PROXY_ADDRESS = "TODO_PASTE_PROXY_ADDRESS_HERE";

// Current stakers from Supabase — export from your DB
// Format: { user: walletAddress, clawnchAmount: "amount in wei", inClawnchAmount: "amount in wei" }
//
// To get this data, query Supabase:
//   SELECT wallet_address, clawnch_staked, inclawnch_staked
//   FROM staking_positions WHERE clawnch_staked > 0 OR inclawnch_staked > 0
//
// Convert token amounts to wei (multiply by 1e18)
const STAKERS = [
  // Example:
  // { user: "0xABC...", clawnchAmount: ethers.parseEther("1000"), inClawnchAmount: ethers.parseEther("500") },
];

async function main() {
  if (PROXY_ADDRESS === "TODO_PASTE_PROXY_ADDRESS_HERE") {
    console.error("ERROR: Set PROXY_ADDRESS first!");
    process.exit(1);
  }

  if (STAKERS.length === 0) {
    console.error("ERROR: Add stakers to the STAKERS array first!");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Migrating with admin:", deployer.address);

  const contract = await ethers.getContractAt("InclawbateUBI", PROXY_ADDRESS);

  // Verify we're admin
  const admin = await contract.admin();
  if (admin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: You are not the admin! Admin is:", admin);
    process.exit(1);
  }

  // Check migration hasn't already happened
  const migrationDone = await contract.migrationComplete();
  if (migrationDone) {
    console.error("ERROR: Migration already completed!");
    process.exit(1);
  }

  // Check contract has enough tokens
  const clawnchToken = await ethers.getContractAt("IERC20", await contract.clawnchToken());
  const inClawnchToken = await ethers.getContractAt("IERC20", await contract.inClawnchToken());

  let totalClawnch = 0n;
  let totalInClawnch = 0n;
  for (const s of STAKERS) {
    totalClawnch += BigInt(s.clawnchAmount);
    totalInClawnch += BigInt(s.inClawnchAmount);
  }

  const contractClawnch = await clawnchToken.balanceOf(PROXY_ADDRESS);
  const contractInClawnch = await inClawnchToken.balanceOf(PROXY_ADDRESS);

  console.log("\nMigration summary:");
  console.log("  Stakers:", STAKERS.length);
  console.log("  Total CLAWNCH needed: ", ethers.formatEther(totalClawnch));
  console.log("  Total inCLAWNCH needed:", ethers.formatEther(totalInClawnch));
  console.log("  Contract CLAWNCH bal:  ", ethers.formatEther(contractClawnch));
  console.log("  Contract inCLAWNCH bal:", ethers.formatEther(contractInClawnch));

  if (contractClawnch < totalClawnch) {
    console.error("\nERROR: Not enough CLAWNCH in contract! Send", ethers.formatEther(totalClawnch - contractClawnch), "more");
    process.exit(1);
  }
  if (contractInClawnch < totalInClawnch) {
    console.error("\nERROR: Not enough inCLAWNCH in contract! Send", ethers.formatEther(totalInClawnch - contractInClawnch), "more");
    process.exit(1);
  }

  // Format entries for the contract call
  const entries = STAKERS.map(s => ({
    user: s.user,
    clawnchAmount: s.clawnchAmount,
    inClawnchAmount: s.inClawnchAmount
  }));

  console.log("\nSending migrateStakers transaction...");
  const tx = await contract.migrateStakers(entries);
  console.log("Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Verify
  const stakerCount = await contract.stakerCount();
  const migComplete = await contract.migrationComplete();
  console.log("\nMigration complete:", migComplete);
  console.log("Staker count:", stakerCount.toString());
  console.log("\nDone! Users are now staked on-chain.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
