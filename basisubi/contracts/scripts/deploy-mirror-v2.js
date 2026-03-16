const { ethers } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  MirrorVault V2 — Fresh Factory + Implementation with Gauge Staking
//  Replaces old factory entirely. New vaults auto-stake in gauge.
// ═══════════════════════════════════════════════════════════════

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const AERO_POOL = "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";   // ETH/USDC CL pool
const GAUGE = "0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8";       // ETH/USDC CL Gauge
const AERO = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";         // AERO token
const AERO_TICK_SPACING = 200;                                      // AERO/WETH pool tick spacing

const MAIN_WALLET = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd";
const BASIS_TOKEN = process.env.BASIS_TOKEN_ADDRESS || ethers.ZeroAddress;
const BURN_PER_VAULT = ethers.parseEther("1000");
const FREE_VAULT_LIMIT = 1;

// V2 implementation already deployed and verified
const EXISTING_IMPL = "0x913B19181eF4d37CEBe0ce46D943FcA4127262aF";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // Use existing V2 implementation (already deployed + verified)
  const implAddr = EXISTING_IMPL;
  console.log("\nUsing existing V2 implementation:", implAddr);

  // ───────────────────────────────────────────
  //  Deploy NEW MirrorVaultFactory with gauge config
  // ───────────────────────────────────────────

  console.log("\n--- Deploying MirrorVaultFactory V2 ---");
  const MirrorVaultFactory = await ethers.getContractFactory("MirrorVaultFactory");
  const factory = await MirrorVaultFactory.deploy({
    implementation: implAddr,
    usdc_: USDC,
    weth_: WETH,
    positionManager_: POSITION_MANAGER,
    swapRouter_: SWAP_ROUTER,
    aeroPool_: AERO_POOL,
    basisToken_: BASIS_TOKEN,
    feeManager_: ethers.ZeroAddress,
    burnPerVault_: BURN_PER_VAULT,
    freeVaultLimit_: FREE_VAULT_LIMIT,
    gauge_: GAUGE,
    aeroToken_: AERO,
    aeroSwapTickSpacing_: AERO_TICK_SPACING,
  });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("MirrorVaultFactory V2:", factoryAddr);

  // ───────────────────────────────────────────
  //  Transfer ownership to main wallet
  // ───────────────────────────────────────────

  console.log("\n--- Transferring ownership to main wallet ---");
  const tx = await factory.transferOwnership(MAIN_WALLET);
  await tx.wait();
  console.log("Ownership transfer initiated (Ownable2Step).");

  // ───────────────────────────────────────────
  //  Summary
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  MIRROR VAULT V2 — GAUGE STAKING");
  console.log("═══════════════════════════════════════════");
  console.log("Implementation:", implAddr);
  console.log("Factory:       ", factoryAddr);
  console.log("Gauge:         ", GAUGE);
  console.log("AERO Token:    ", AERO);
  console.log("AERO Spacing:  ", AERO_TICK_SPACING);
  console.log("Deployer:      ", deployer.address);
  console.log("Pending Owner: ", MAIN_WALLET);

  console.log("\n--- HOW IT WORKS ---");
  console.log("1. Accept ownership: factory.acceptOwnership() from", MAIN_WALLET);
  console.log("2. Create a vault — gauge staking is auto-configured");
  console.log("3. First deposit + compound → LP gets staked in gauge");
  console.log("4. AERO rewards auto-compound on every compound() call");
  console.log("");
  console.log("--- Verify ---");
  console.log(`npx hardhat verify --network base ${factoryAddr} --constructor-args scripts/verify-factory-v2-args.js`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
