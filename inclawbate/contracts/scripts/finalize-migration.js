const { ethers } = require("hardhat");

const PROXY = "0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Admin:", deployer.address);

  const staking = await ethers.getContractAt(
    ["function finalizeMigration()", "function migrationOpen() view returns (bool)", "function totalStaked() view returns (uint256)", "function stakerCount() view returns (uint256)"],
    PROXY
  );

  const migOpen = await staking.migrationOpen();
  console.log("Migration open:", migOpen);

  if (!migOpen) {
    console.log("Migration already finalized!");
    return;
  }

  console.log("Total staked:", ethers.formatEther(await staking.totalStaked()));
  console.log("Staker count:", (await staking.stakerCount()).toString());

  console.log("\nFinalizing migration (permanently disabling stakeFor)...");
  const tx = await staking.finalizeMigration();
  await tx.wait();
  console.log("Done! tx:", tx.hash);
  console.log("Migration open:", await staking.migrationOpen());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
