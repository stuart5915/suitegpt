const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AutoVault with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const AutoVault = await ethers.getContractFactory("AutoVault");
  console.log("\nDeploying AutoVault (no proxy, no admin, permissionless)...");

  const vault = await AutoVault.deploy();
  await vault.waitForDeployment();
  const addr = await vault.getAddress();

  console.log("\n═══════════════════════════════════════════");
  console.log("  AUTOVAULT DEPLOYED");
  console.log("═══════════════════════════════════════════");
  console.log("Address:    ", addr);
  console.log("Deployer:   ", deployer.address);
  console.log("Name:       ", await vault.name());
  console.log("Symbol:     ", await vault.symbol());
  console.log("TokenId:    ", (await vault.tokenId()).toString());
  console.log("EthReserve: ", (await vault.ethReserve()).toString());

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${addr}`);
  console.log("");
  console.log("2. Test deposit ($100 USDC):");
  console.log("   - Approve USDC to vault: USDC.approve(vault, 100e6)");
  console.log("   - Call: vault.deposit(100e6, 0)");
  console.log("");
  console.log("3. Check position:");
  console.log("   - vault.getVaultInfo()");
  console.log("   - vault.isInRange()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
