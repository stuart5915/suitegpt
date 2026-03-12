const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  const pokeraiTokenAddress = process.env.POKERAI_TOKEN_ADDRESS;
  if (!pokeraiTokenAddress) {
    throw new Error('Set POKERAI_TOKEN_ADDRESS in .env (the POKERAI token contract on Base)');
  }

  const operatorAddress = process.env.OPERATOR_ADDRESS;
  if (!operatorAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that will distribute rewards)');
  }

  console.log(`Deploying PokerAIRewards on ${network}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Operator (server): ${operatorAddress}`);
  console.log(`  POKERAI token: ${pokeraiTokenAddress}`);

  const Rewards = await hre.ethers.getContractFactory('PokerAIRewards');
  const rewards = await Rewards.deploy(pokeraiTokenAddress, operatorAddress);
  await rewards.waitForDeployment();

  const address = await rewards.getAddress();
  console.log(`\nPokerAIRewards deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Approve POKERAI spending: pokeraiToken.approve("${address}", amount)`);
  console.log(`  2. Deposit rewards: rewards.depositRewards(amount)`);
  console.log(`  3. Set POKERAI_REWARDS_ADDRESS=${address} in server .env`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${network} ${address} ${pokeraiTokenAddress} ${operatorAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
