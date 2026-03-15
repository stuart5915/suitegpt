const { ethers, upgrades } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Base Mainnet Addresses
// ═══════════════════════════════════════════════════════════════

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

// Aerodrome CL on Base
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";

// ETH/USDC CL Pool
const POOL = "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";

// Fee manager (reuse from BasisVault deployment, or set to deployer)
const FEE_MANAGER = process.env.BASIS_FEE_MANAGER || "";

// Initial parameters
const DEPOSIT_CAP = ethers.parseUnits("50000", 6); // $50K USDC

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const feeManagerAddr = FEE_MANAGER || deployer.address;
  console.log("Fee Manager:", feeManagerAddr);

  // ───────────────────────────────────────────
  //  Deploy MirrorVault (UUPS Proxy)
  // ───────────────────────────────────────────

  console.log("\n--- Deploying MirrorVault (UUPS Proxy) ---");

  const MirrorVault = await ethers.getContractFactory("MirrorVault");
  const vault = await upgrades.deployProxy(
    MirrorVault,
    [
      USDC,
      WETH,
      POSITION_MANAGER,
      SWAP_ROUTER,
      POOL,
      deployer.address, // admin
      feeManagerAddr,
      DEPOSIT_CAP,
    ],
    { kind: "uups" }
  );

  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  const vaultImpl = await upgrades.erc1967.getImplementationAddress(vaultAddr);

  console.log("MirrorVault Proxy:         ", vaultAddr);
  console.log("MirrorVault Implementation:", vaultImpl);
  console.log("Version:                   ", (await vault.version()).toString());
  console.log(
    "Deposit Cap:               ",
    ethers.formatUnits(DEPOSIT_CAP, 6),
    "USDC"
  );

  // ───────────────────────────────────────────
  //  Summary & Next Steps
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  MIRROR VAULT DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("MirrorVault:", vaultAddr);
  console.log("Admin:      ", deployer.address);
  console.log("Pool:       ", POOL);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network base ${vaultImpl}`);
  console.log("");
  console.log("2. Set tracked position:");
  console.log(
    "   vault.setTrackedPosition(TRACKED_WALLET, TRACKED_TOKEN_ID)"
  );
  console.log("   OR auto-discover:");
  console.log("   vault.discoverTrackedPosition(TRACKED_WALLET)");
  console.log("");
  console.log("3. Deploy mirror-keeper cron (Vercel or Railway)");
  console.log("   Calls vault.needsMirror() → vault.mirror()");
  console.log("   Calls vault.compound() when idle USDC available");
  console.log("");
  console.log("4. Approve USDC and deposit:");
  console.log("   USDC.approve(vault, amount)");
  console.log("   vault.deposit(amount, receiver)");
  console.log("");
  console.log("5. Add env vars:");
  console.log(`   MIRROR_VAULT_ADDRESS=${vaultAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
