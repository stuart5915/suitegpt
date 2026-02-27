const { ethers } = require("hardhat");

const LITE_IMPL = "0xffA96A8e75fe6560D0b53E6b3aC18CFe23f875Db";
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";
const DEPLOY_FEE = ethers.parseEther("1000000");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  console.log("Deploying StakingFactory...");
  console.log("  impl:", LITE_IMPL);
  console.log("  burnToken:", INCLAWNCH);
  console.log("  fee:", ethers.formatEther(DEPLOY_FEE), "INCLAWNCH");

  const Factory = await ethers.getContractFactory("StakingFactory");
  const factory = await Factory.deploy(LITE_IMPL, INCLAWNCH, DEPLOY_FEE);
  await factory.waitForDeployment();
  const addr = await factory.getAddress();

  console.log("\nStakingFactory deployed to:", addr);
  console.log("Verify:", `npx hardhat verify --network base ${addr} ${LITE_IMPL} ${INCLAWNCH} ${DEPLOY_FEE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
