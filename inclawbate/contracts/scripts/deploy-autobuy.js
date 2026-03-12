const { ethers } = require("hardhat");

// Base mainnet addresses
const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
const WETH = "0x4200000000000000000000000000000000000006";
const CLAWS = "0x7ca47B141639B893C6782823C0b219f872056379";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CLAWSAutoBuy with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const CLAWSAutoBuy = await ethers.getContractFactory("CLAWSAutoBuy");
  const autobuy = await CLAWSAutoBuy.deploy(UNISWAP_V2_ROUTER, WETH, CLAWS);
  await autobuy.waitForDeployment();

  const address = await autobuy.getAddress();
  console.log("\nCLAWSAutoBuy deployed to:", address);
  console.log("No fees - free for users");

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base ${address} ${UNISWAP_V2_ROUTER} ${WETH} ${CLAWS}`);
  console.log("2. Add to Vercel env vars:");
  console.log("   AUTOBUY_CONTRACT_ADDRESS=" + address);
  console.log("   AUTOBUY_KEEPER_KEY=<private key of keeper wallet>");
  console.log("3. Fund keeper wallet with 0.01 ETH on Base");
  console.log("4. Update CONTRACT_ADDRESS in autobuy.html");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
