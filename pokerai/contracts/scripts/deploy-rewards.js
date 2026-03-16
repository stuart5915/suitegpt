const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  const pokeraiTokenAddress = process.env.POKERAI_TOKEN_ADDRESS;
  if (!pokeraiTokenAddress) {
    throw new Error('Set POKERAI_TOKEN_ADDRESS in .env (the POKERAI token contract on Base)');
  }

  const signerAddress = process.env.OPERATOR_ADDRESS;
  if (!signerAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that signs claim authorizations)');
  }

  console.log(`Deploying PokerAIRewards on ${network}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Signer (server): ${signerAddress}`);
  console.log(`  POKERAI token: ${pokeraiTokenAddress}`);

  const Rewards = await hre.ethers.getContractFactory('PokerAIRewards');
  const rewards = await Rewards.deploy(pokeraiTokenAddress, signerAddress);
  await rewards.waitForDeployment();

  const address = await rewards.getAddress();
  console.log(`\nPokerAIRewards deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Approve POKERAI spending: pokeraiToken.approve("${address}", amount)`);
  console.log(`  2. Deposit rewards: rewards.depositRewards(amount)`);
  console.log(`  3. Set POKERAI_REWARDS_ADDRESS=${address} in server .env`);
  console.log(`\nClaim flow: Server signs → user calls claim() → user pays gas`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${network} ${address} ${pokeraiTokenAddress} ${signerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
