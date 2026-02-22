const { ethers } = require("hardhat");

const PROXY = process.env.STAKING_CONTRACT || "0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6";
const NEW_ADMIN = process.env.NEW_ADMIN || "0x91b5c0d07859cfeafeb67d9694121cd741f049bd";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== TRANSFER ADMIN ===");
  console.log("");

  const staking = await ethers.getContractAt(
    [
      "function admin() view returns (address)",
      "function transferAdmin(address)",
      "function totalStaked() view returns (uint256)",
      "function stakerCount() view returns (uint256)",
      "function paused() view returns (bool)",
    ],
    PROXY
  );

  // ── PRE-FLIGHT CHECKS ──
  const currentAdmin = await staking.admin();
  console.log("Current admin:   ", currentAdmin);
  console.log("Deployer (you):  ", deployer.address);
  console.log("New admin target:", NEW_ADMIN);
  console.log("");

  // Check 1: deployer IS current admin
  if (currentAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ABORT: Your deployer wallet is NOT the current admin!");
    console.error("       Current admin is", currentAdmin);
    console.error("       Your wallet is", deployer.address);
    process.exit(1);
  }
  console.log("[OK] Deployer is current admin");

  // Check 2: new admin is not zero address
  if (NEW_ADMIN === "0x0000000000000000000000000000000000000000") {
    console.error("ABORT: Cannot transfer to zero address!");
    process.exit(1);
  }
  console.log("[OK] New admin is not zero address");

  // Check 3: new admin is not same as current
  if (currentAdmin.toLowerCase() === NEW_ADMIN.toLowerCase()) {
    console.log("Admin is already set to this address. Nothing to do.");
    return;
  }
  console.log("[OK] New admin is different from current");

  // Check 4: contract state looks healthy
  const totalStaked = await staking.totalStaked();
  const stakerCount = await staking.stakerCount();
  const isPaused = await staking.paused();
  console.log("[OK] Total staked:", ethers.formatEther(totalStaked), "INCLAWNCH");
  console.log("[OK] Staker count:", stakerCount.toString());
  console.log("[OK] Paused:", isPaused);
  console.log("");

  // ── CONFIRM ──
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  TRANSFERRING ADMIN — THIS CANNOT BE UNDONE         ║");
  console.log("║                                                      ║");
  console.log("║  From: " + currentAdmin.slice(0, 20) + "...  ║");
  console.log("║  To:   " + NEW_ADMIN.slice(0, 20) + "...  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Sending transferAdmin transaction...");

  const tx = await staking.transferAdmin(NEW_ADMIN);
  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  console.log("");

  // ── POST-TRANSFER VERIFICATION ──
  const newAdmin = await staking.admin();
  console.log("=== VERIFICATION ===");
  console.log("Admin is now:", newAdmin);

  if (newAdmin.toLowerCase() === NEW_ADMIN.toLowerCase()) {
    console.log("");
    console.log("SUCCESS! Admin transferred to", NEW_ADMIN);
    console.log("You can now use the /airdrop page with this wallet to manage the contract.");
  } else {
    console.error("");
    console.error("WARNING: Admin address doesn't match expected!");
    console.error("Expected:", NEW_ADMIN);
    console.error("Got:     ", newAdmin);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
