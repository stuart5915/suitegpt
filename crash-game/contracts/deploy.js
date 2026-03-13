const hre = require('hardhat');

// CLAWS token on Base
const CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const operatorAddress = process.env.OPERATOR_ADDRESS;
  if (!operatorAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that will process withdrawals)');
  }

  // Revenue wallet = deployer by default
  const revenueWallet = process.env.REVENUE_WALLET || deployer.address;

  console.log(`Deploying CrashVault on ${hre.network.name}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Operator (server): ${operatorAddress}`);
  console.log(`  Revenue wallet: ${revenueWallet}`);
  console.log(`  CLAWS: ${CLAWS}`);

  const Vault = await hre.ethers.getContractFactory('CrashVault');
  const vault = await Vault.deploy(CLAWS, operatorAddress, revenueWallet);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log(`\nCrashVault deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set CRASH_VAULT_ADDRESS=${address} in server .env`);
  console.log(`  2. Players approve CLAWS spending: claws.approve("${address}", amount)`);
  console.log(`  3. Players deposit: vault.deposit(amount)`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${hre.network.name} ${address} ${CLAWS} ${operatorAddress} ${revenueWallet}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
