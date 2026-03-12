const { ethers } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Base Mainnet Addresses (same as deploy-auto-vault.js)
// ═══════════════════════════════════════════════════════════════

const USDC  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH  = "0x4200000000000000000000000000000000000006";

// Aerodrome CL
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER      = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const AERO_POOL        = "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59";

// Aave V3 on Base
const AAVE_POOL    = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const A_WETH       = "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7";
const A_USDC       = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB";
const V_DEBT_USDC  = "0x59dca05b6c26dbd64b5381374aAaC5CD05644C28";
const V_DEBT_WETH  = "0x24e6e0795b3c7c71D965fCc4f371803d1c1DcA1E";

// Vault creation fee: 0.001 ETH (~$2 spam prevention)
const CREATION_FEE = ethers.parseEther("0.001");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Vault Marketplace with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ───────────────────────────────────────────
  //  Step 1: Deploy MarketplaceVault implementation
  // ───────────────────────────────────────────

  console.log("\n--- Deploying MarketplaceVault Implementation ---");
  const MarketplaceVault = await ethers.getContractFactory("MarketplaceVault");
  const impl = await MarketplaceVault.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("MarketplaceVault Implementation:", implAddr);

  // ───────────────────────────────────────────
  //  Step 2: Deploy BasisVaultFactory
  // ───────────────────────────────────────────

  console.log("\n--- Deploying BasisVaultFactory ---");
  const BasisVaultFactory = await ethers.getContractFactory("BasisVaultFactory");
  const factory = await BasisVaultFactory.deploy({
    implementation: implAddr,
    usdc_: USDC,
    weth_: WETH,
    positionManager_: POSITION_MANAGER,
    swapRouter_: SWAP_ROUTER,
    aeroPool_: AERO_POOL,
    aavePool_: AAVE_POOL,
    aWeth_: A_WETH,
    aUsdc_: A_USDC,
    vDebtUsdc_: V_DEBT_USDC,
    vDebtWeth_: V_DEBT_WETH,
    creationFee_: CREATION_FEE
  });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("BasisVaultFactory:", factoryAddr);

  // ───────────────────────────────────────────
  //  Summary
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  VAULT MARKETPLACE DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("Implementation:", implAddr);
  console.log("Factory:       ", factoryAddr);
  console.log("Creation Fee:  ", ethers.formatEther(CREATION_FEE), "ETH");
  console.log("Owner:         ", deployer.address);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network base ${implAddr}`);
  console.log(`   npx hardhat verify --network base ${factoryAddr} --constructor-args <args>`);
  console.log("");
  console.log("2. Update basisubi/index.html with factory address:");
  console.log("   VAULT_FACTORY_ADDRESS = '" + factoryAddr + "'");
  console.log("");
  console.log("3. Create first vault via UI or script:");
  console.log("   factory.createVault('Alpha Brain', 1000, 50000e6, { value: 0.001 ether })");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
