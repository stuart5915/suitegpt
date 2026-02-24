const { ethers, upgrades } = require("hardhat");

// ===== BASE MAINNET ADDRESSES =====
const CLAWNCH   = "0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be";
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";
const WETH_BASE = "0x4200000000000000000000000000000000000006";

// Uniswap V3 SwapRouter02 on Base
const SWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";

// Pool fee tier — check which pool exists for WETH/CLAWNCH on Uniswap Base
// 500 = 0.05%, 3000 = 0.3%, 10000 = 1%
const POOL_FEE = 10000;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Kingdom address — where Kingdom % donations go
  // TODO: set this to the actual Kingdom wallet before deploying
  const KINGDOM_ADDRESS = deployer.address; // placeholder: change this!

  console.log("\n--- Deploying InclawbateUBI (UUPS Proxy) ---");

  const InclawbateUBI = await ethers.getContractFactory("InclawbateUBI");

  const proxy = await upgrades.deployProxy(
    InclawbateUBI,
    [CLAWNCH, INCLAWNCH, WETH_BASE, SWAP_ROUTER, deployer.address, KINGDOM_ADDRESS, POOL_FEE],
    { kind: "uups" }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  console.log("Proxy deployed to:         ", proxyAddress);
  console.log("Implementation deployed to:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
  console.log("Admin (you):               ", deployer.address);
  console.log("Version:                   ", (await proxy.version()).toString());

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:  npx hardhat verify --network base", proxyAddress);
  console.log("2. Send CLAWNCH + inCLAWNCH from hot wallet to proxy address");
  console.log("3. Run migrate script:  npx hardhat run scripts/migrate.js --network base");
  console.log("4. Register Chainlink Automation at https://automation.chain.link/base");
  console.log("5. Point frontend to proxy address:", proxyAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
