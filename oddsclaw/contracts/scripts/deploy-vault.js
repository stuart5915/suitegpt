const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  const oddsTokenAddress = process.env.ODDS_TOKEN_ADDRESS;
  if (!oddsTokenAddress) {
    throw new Error('Set ODDS_TOKEN_ADDRESS in .env (the $ODDS token contract on Base)');
  }

  const operatorAddress = process.env.OPERATOR_ADDRESS;
  if (!operatorAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that will process withdrawals)');
  }

  console.log(`Deploying OddsClawVault on ${network}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Operator (server): ${operatorAddress}`);
  console.log(`  ODDS token: ${oddsTokenAddress}`);

  const Vault = await hre.ethers.getContractFactory('OddsClawVault');
  const vault = await Vault.deploy(oddsTokenAddress, operatorAddress);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log(`\nOddsClawVault deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set ODDS_VAULT_ADDRESS=${address} in server .env`);
  console.log(`  2. Approve ODDS spending: oddsToken.approve("${address}", amount)`);
  console.log(`  3. Fund house pool: vault.depositHousePool(amount) — 10B tokens for agent funding`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${network} ${address} ${oddsTokenAddress} ${operatorAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
