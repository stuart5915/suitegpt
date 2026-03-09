const hre = require('hardhat');

// USDC addresses
const USDC = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // Circle test USDC
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const usdcAddress = USDC[network];

  if (!usdcAddress) {
    throw new Error(`No USDC address for network: ${network}`);
  }

  const operatorAddress = process.env.OPERATOR_ADDRESS;
  if (!operatorAddress) {
    throw new Error('Set OPERATOR_ADDRESS in .env (server wallet that will process withdrawals)');
  }

  // Rake recipient 1 = inclawbate (defaults to deployer if not set)
  const rakeRecipient1 = process.env.RAKE_RECIPIENT_1 || deployer.address;

  console.log(`Deploying PokerChipVault on ${network}...`);
  console.log(`  Deployer (admin): ${deployer.address}`);
  console.log(`  Operator (server): ${operatorAddress}`);
  console.log(`  Rake Recipient 1: ${rakeRecipient1}`);
  console.log(`  USDC: ${usdcAddress}`);

  const Vault = await hre.ethers.getContractFactory('PokerChipVault');
  const vault = await Vault.deploy(usdcAddress, operatorAddress, rakeRecipient1);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log(`\nPokerChipVault deployed: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set VAULT_CONTRACT_ADDRESS=${address} in server .env`);
  console.log(`  2. Approve USDC spending: usdc.approve("${address}", amount)`);
  console.log(`  3. Fund house pool: vault.depositHousePool(amount)`);
  console.log(`  4. Later: vault.setRakeRecipient2(partnerAddress)`);
  console.log(`  5. Later: vault.setRakeSplit(70, 30) — or whatever split`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network ${network} ${address} ${usdcAddress} ${operatorAddress} ${rakeRecipient1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
