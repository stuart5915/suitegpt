const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  const oddsTokenAddress = process.env.ODDS_TOKEN_ADDRESS;
  if (!oddsTokenAddress) {
    throw new Error('Set ODDS_TOKEN_ADDRESS in .env (the $ODDS token contract on Base)');
  }

  // Signer = server wallet that signs claim authorizations
  const signerAddress = process.env.OPERATOR_ADDRESS;
  if (!signerAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that signs reward claims)');
  }

  console.log(`Deploying OddsClawRewards on ${network}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Signer (server): ${signerAddress}`);
  console.log(`  ODDS token: ${oddsTokenAddress}`);

  const Rewards = await hre.ethers.getContractFactory('OddsClawRewards');
  const rewards = await Rewards.deploy(oddsTokenAddress, signerAddress);
  await rewards.waitForDeployment();

  const address = await rewards.getAddress();
  console.log(`\nOddsClawRewards deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set ODDS_REWARDS_ADDRESS=${address} in server .env`);
  console.log(`  2. Approve ODDS spending: oddsToken.approve("${address}", amount)`);
  console.log(`  3. Deposit rewards: rewards.depositRewards(amount) — from incentives allocation`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${network} ${address} ${oddsTokenAddress} ${signerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
