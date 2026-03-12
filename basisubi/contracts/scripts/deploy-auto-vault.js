const { ethers, upgrades } = require("hardhat");

// ═══════════════════════════════════════════════════════════════
//  Base Mainnet Addresses
// ═══════════════════════════════════════════════════════════════

const USDC  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH  = "0x4200000000000000000000000000000000000006";

// Aerodrome CL
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER      = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const AERO_POOL        = "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59"; // WETH/USDC CL pool (tick spacing 100)

// Aave V3 on Base
const AAVE_POOL    = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const A_WETH       = "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7"; // aBasWETH
const A_USDC       = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB"; // aBasUSDbC → actually aBasUSDC
const V_DEBT_USDC  = "0x59dca05b6c26dbd64b5381374aAaC5CD05644C28"; // variableDebtBasUSDbC → USDC variable debt
const V_DEBT_WETH  = "0x24e6e0795b3c7c71D965fCc4f371803d1c1DcA1E"; // variableDebtBasWETH

// Config
const DEPOSIT_CAP = ethers.parseUnits("50000", 6); // $50K USDC starting cap

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AutoBasisVault with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ───────────────────────────────────────────
  //  Deploy AutoBasisVault (UUPS Proxy)
  // ───────────────────────────────────────────

  console.log("\n--- Deploying AutoBasisVault (UUPS Proxy) ---");

  const AutoBasisVault = await ethers.getContractFactory("AutoBasisVault");
  const vault = await upgrades.deployProxy(
    AutoBasisVault,
    [{
      usdc: USDC,
      weth_: WETH,
      positionManager_: POSITION_MANAGER,
      swapRouter_: SWAP_ROUTER,
      aeroPool_: AERO_POOL,
      aavePool_: AAVE_POOL,
      aWeth_: A_WETH,
      aUsdc_: A_USDC,
      vDebtUsdc_: V_DEBT_USDC,
      vDebtWeth_: V_DEBT_WETH,
      admin_: deployer.address,
      depositCap_: DEPOSIT_CAP
    }],
    {
      kind: "uups",
      constructorArgs: [],
      unsafeAllow: ["constructor"]
    }
  );

  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  const vaultImpl = await upgrades.erc1967.getImplementationAddress(vaultAddr);

  console.log("AutoBasisVault Proxy:          ", vaultAddr);
  console.log("AutoBasisVault Implementation: ", vaultImpl);
  console.log("Version:                       ", (await vault.version()).toString());
  console.log("Deposit Cap:                   ", ethers.formatUnits(DEPOSIT_CAP, 6), "USDC");
  console.log("Admin/Strategist:              ", deployer.address);

  // ───────────────────────────────────────────
  //  Summary & Next Steps
  // ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("AutoBasisVault:", vaultAddr);
  console.log("Admin:         ", deployer.address);

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${vaultImpl}`);
  console.log("");
  console.log("2. Set strategist to keeper wallet (if different from admin):");
  console.log("   vault.setStrategist(KEEPER_ADDRESS)");
  console.log("");
  console.log("3. Deploy keeper to Railway with these env vars:");
  console.log("   AUTO_VAULT_ADDRESS=" + vaultAddr);
  console.log("   KEEPER_PRIVATE_KEY=<private key>");
  console.log("   BASE_RPC_URL=https://mainnet.base.org");
  console.log("");
  console.log("4. Update the Basis UI with the vault address:");
  console.log("   basisubi/index.html → av-deposit-btn → depositAutoVault()");
  console.log("");
  console.log("5. Test: deposit small amount (10 USDC), then trigger rebalance");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
