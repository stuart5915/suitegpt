const { ethers } = require("hardhat");

const LITE_IMPL = "0xffA96A8e75fe6560D0b53E6b3aC18CFe23f875Db";
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";
const DEPLOY_FEE = ethers.parseEther("1000000");
const FEE_RECIPIENT = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd"; // inclawbate.base.eth

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  console.log("\nDeploying StakingFactory v2 (fee to recipient instead of burn)...");
  console.log("  impl:", LITE_IMPL);
  console.log("  burnToken:", INCLAWNCH);
  console.log("  fee:", ethers.formatEther(DEPLOY_FEE), "INCLAWNCH");
  console.log("  feeRecipient:", FEE_RECIPIENT);

  const Factory = await ethers.getContractFactory("StakingFactory");
  const factory = await Factory.deploy(LITE_IMPL, INCLAWNCH, DEPLOY_FEE, FEE_RECIPIENT);
  await factory.waitForDeployment();
  const addr = await factory.getAddress();

  console.log("\nStakingFactory v2 deployed to:", addr);
  console.log("Verify:", `npx hardhat verify --network base ${addr} ${LITE_IMPL} ${INCLAWNCH} ${DEPLOY_FEE} ${FEE_RECIPIENT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
