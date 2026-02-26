const { ethers, upgrades } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Base Mainnet Addresses
// ═══════════════════════════════════════════════════════════════

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

// Aerodrome CL on Base
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";

// Initial parameters
const DEPOSIT_CAP = ethers.parseUnits("25000", 6); // $25K USDC

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ───────────────────────────────────────────
  //  Step 1: Deploy BasisFeeManager
  // ───────────────────────────────────────────

  console.log("\n--- Deploying BasisFeeManager (UUPS Proxy) ---");

  const BasisFeeManager = await ethers.getContractFactory("BasisFeeManager");
  const feeManager = await upgrades.deployProxy(
    BasisFeeManager,
    [
      USDC,
      deployer.address,       // admin
      deployer.address,       // manager wallet (update later)
      deployer.address,       // buyback wallet (update later)
      5000                    // 50% to manager, 50% to buyback
    ],
    { kind: "uups" }
  );

  await feeManager.waitForDeployment();
  const feeManagerAddr = await feeManager.getAddress();
  const feeManagerImpl = await upgrades.erc1967.getImplementationAddress(feeManagerAddr);

  console.log("FeeManager Proxy:          ", feeManagerAddr);
  console.log("FeeManager Implementation: ", feeManagerImpl);

  // ───────────────────────────────────────────
  //  Step 2: Deploy BasisVault
  // ───────────────────────────────────────────

  console.log("\n--- Deploying BasisVault (UUPS Proxy) ---");

  const BasisVault = await ethers.getContractFactory("BasisVault");
  const vault = await upgrades.deployProxy(
    BasisVault,
    [
      USDC,
      WETH,
      POSITION_MANAGER,
      SWAP_ROUTER,
      deployer.address,       // admin
      feeManagerAddr,         // fee manager
      DEPOSIT_CAP
    ],
    { kind: "uups" }
  );

  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  const vaultImpl = await upgrades.erc1967.getImplementationAddress(vaultAddr);

  console.log("Vault Proxy:          ", vaultAddr);
  console.log("Vault Implementation: ", vaultImpl);
  console.log("Vault Version:        ", (await vault.version()).toString());
  console.log("Deposit Cap:          ", ethers.formatUnits(DEPOSIT_CAP, 6), "USDC");

  // ───────────────────────────────────────────
  //  Summary & Next Steps
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("BasisFeeManager: ", feeManagerAddr);
  console.log("BasisVault:      ", vaultAddr);
  console.log("Admin:           ", deployer.address);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network base ${feeManagerImpl}`);
  console.log(`   npx hardhat verify --network base ${vaultImpl}`);
  console.log("");
  console.log("2. Set strategy parameters on BasisVault:");
  console.log("   vault.setParameters(");
  console.log("     1000,   // rangeWidth: ±500 ticks ≈ ±5%");
  console.log("     200,    // rebalanceBuffer: 200 extra ticks");
  console.log("     POOL,   // Aerodrome WETH/USDC CL pool address");
  console.log("     1000000, // compoundMinimum: 1 USDC");
  console.log("     50      // slippageTolerance: 0.5%");
  console.log("   )");
  console.log("");
  console.log("3. Update FeeManager wallets:");
  console.log("   feeManager.setManagerWallet(MANAGER_ADDRESS)");
  console.log("   feeManager.setBuybackWallet(BUYBACK_ADDRESS)");
  console.log("");
  console.log("4. Test deposit flow:");
  console.log("   USDC.approve(vault, amount)");
  console.log("   vault.deposit(amount, receiver)");
  console.log("   vault.compound()  // deploy to LP");
  console.log("");
  console.log("5. Deploy BasisStaking (separate script):");
  console.log("   npm run deploy:staking");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
