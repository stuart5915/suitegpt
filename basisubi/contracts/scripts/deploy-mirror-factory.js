const { ethers } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Base Mainnet Addresses
// ═══════════════════════════════════════════════════════════════

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const AERO_POOL = "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59"; // ETH/USDC CL

// Main admin wallet (inclawbate.base.eth) — ownership transferred here after deploy
const MAIN_WALLET = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd";

// BASIS token (set after Clanker launch, or address(0) for now)
const BASIS_TOKEN = process.env.BASIS_TOKEN_ADDRESS || ethers.ZeroAddress;

// Burn amount per extra vault (adjustable later)
const BURN_PER_VAULT = ethers.parseEther("1000"); // 1000 BASIS

// Free vaults per wallet
const FREE_VAULT_LIMIT = 1;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ───────────────────────────────────────────
  //  Step 1: Deploy MirrorVault implementation
  // ───────────────────────────────────────────

  console.log("\n--- Deploying MirrorVault implementation ---");
  const MirrorVault = await ethers.getContractFactory("MirrorVault");
  const impl = await MirrorVault.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("MirrorVault implementation:", implAddr);

  // ───────────────────────────────────────────
  //  Step 2: Deploy MirrorVaultFactory
  // ───────────────────────────────────────────

  console.log("\n--- Deploying MirrorVaultFactory ---");
  const MirrorVaultFactory = await ethers.getContractFactory(
    "MirrorVaultFactory"
  );
  const factory = await MirrorVaultFactory.deploy({
    implementation: implAddr,
    usdc_: USDC,
    weth_: WETH,
    positionManager_: POSITION_MANAGER,
    swapRouter_: SWAP_ROUTER,
    aeroPool_: AERO_POOL,
    basisToken_: BASIS_TOKEN,
    feeManager_: ethers.ZeroAddress, // no fee manager initially
    burnPerVault_: BURN_PER_VAULT,
    freeVaultLimit_: FREE_VAULT_LIMIT,
  });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("MirrorVaultFactory:", factoryAddr);

  // ───────────────────────────────────────────
  //  Step 3: Transfer ownership to main wallet
  // ───────────────────────────────────────────

  console.log("\n--- Transferring ownership to main wallet ---");
  console.log("Main wallet:", MAIN_WALLET);
  const tx = await factory.transferOwnership(MAIN_WALLET);
  await tx.wait();
  console.log("Ownership transfer initiated (Ownable2Step).");
  console.log("Main wallet must call factory.acceptOwnership() to finalize.");

  // ───────────────────────────────────────────
  //  Summary
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  MIRROR VAULT FACTORY DEPLOYED");
  console.log("═══════════════════════════════════════════");
  console.log("Implementation:", implAddr);
  console.log("Factory:       ", factoryAddr);
  console.log("Deployer:      ", deployer.address);
  console.log("Pending Owner: ", MAIN_WALLET);
  console.log("BASIS Token:   ", BASIS_TOKEN);
  console.log("Burn/Vault:    ", ethers.formatEther(BURN_PER_VAULT), "BASIS");
  console.log("Free Limit:    ", FREE_VAULT_LIMIT);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. IMPORTANT: Accept ownership from main wallet:");
  console.log(`   factory.acceptOwnership() from ${MAIN_WALLET}`);
  console.log("");
  console.log("2. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddr}`);
  console.log(`   npx hardhat verify --network base ${factoryAddr}`);
  console.log("");
  console.log("3. Launch BASIS token on Clanker, then:");
  console.log(`   factory.setBasisToken(BASIS_TOKEN_ADDRESS)`);
  console.log("");
  console.log("4. Create first mirror vault:");
  console.log(
    '   factory.createVault("Whale Mirror", 500, 50000e6, TRACKED_WALLET, TOKEN_ID)'
  );
  console.log("");
  console.log("5. Set env vars:");
  console.log(`   MIRROR_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`   MIRROR_IMPL_ADDRESS=${implAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
