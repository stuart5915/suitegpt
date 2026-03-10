const { ethers } = require('hardhat');

const VAULT_ADDRESS = '0x810a68b796D6C89F181133355EFe297A36e547D0';
const MANTO_WALLET = '0x496F68438493eb1CC632f7CeC6634f042c95e333';

const VAULT_ABI = [
  'function setRakeRecipient2(address _recipient) external',
  'function setRakeSplit(uint8 pct1, uint8 pct2) external',
  'function rakeInfo() external view returns (address, address, uint8, uint256, uint256, uint256)',
  'function admin() external view returns (address)'
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);

  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

  // Check admin
  const admin = await vault.admin();
  console.log('Vault admin:', admin);
  if (admin.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('ERROR: Signer is not the vault admin!');
    process.exit(1);
  }

  // Current state
  const [r1, r2, split1, unc1, unc2, total] = await vault.rakeInfo();
  console.log('\nCurrent rake config:');
  console.log('  Recipient 1:', r1, '| Split:', split1 + '%');
  console.log('  Recipient 2:', r2);
  console.log('  Unclaimed 1:', unc1.toString(), '| Unclaimed 2:', unc2.toString());

  // Set recipient 2
  console.log('\nSetting rake recipient 2 to:', MANTO_WALLET);
  const tx1 = await vault.setRakeRecipient2(MANTO_WALLET);
  await tx1.wait();
  console.log('  Done. TX:', tx1.hash);

  // Set split 75/25
  console.log('Setting rake split to 75/25...');
  const tx2 = await vault.setRakeSplit(75, 25);
  await tx2.wait();
  console.log('  Done. TX:', tx2.hash);

  // Verify
  const [nr1, nr2, nsplit1] = await vault.rakeInfo();
  console.log('\nUpdated rake config:');
  console.log('  Recipient 1:', nr1, '| Split:', nsplit1 + '%');
  console.log('  Recipient 2:', nr2, '| Split:', (100 - nsplit1) + '%');
}

main().catch(e => { console.error(e); process.exit(1); });
