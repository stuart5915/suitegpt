# SUITE Token Deployment Guide

## Prerequisites
1. MetaMask with your SUITE Admin wallet
2. ETH on Base Mainnet for gas (~$5 worth)
3. Node.js installed

## Quick Deploy with Remix (Easiest)

### Step 1: Deploy SUITE Token

1. Go to [Remix IDE](https://remix.ethereum.org)
2. Create new file `SuiteToken.sol` and paste the contract code
3. In "Solidity Compiler" tab:
   - Select compiler `0.8.20`
   - Click "Compile"
4. In "Deploy & Run" tab:
   - Environment: "Injected Provider - MetaMask"
   - Make sure MetaMask is on **Base Mainnet** (Chain ID: 8453)
   - Contract: `SuiteToken`
   - Constructor arg: Your admin wallet address
   - Click "Deploy"
5. **Save the deployed token address!**

### Step 2: Deploy Treasury (Upgradeable)

For upgradeable contracts, we need a proxy. Use OpenZeppelin Defender or Hardhat.

## Deploy with Hardhat (Recommended for Proxy)

### Setup

```bash
cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts @openzeppelin/contracts-upgradeable
npm install @openzeppelin/hardhat-upgrades
npx hardhat init  # Choose "Create a JavaScript project"
```

### Configure hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

module.exports = {
  solidity: "0.8.20",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532,
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY,
    }
  }
};
```

### Create .env file

```
PRIVATE_KEY=your_admin_wallet_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_for_verification
```

### Deploy Script (scripts/deploy.js)

```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Base Mainnet USDC address
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  // 1. Deploy SUITE Token
  console.log("\n1. Deploying SUITE Token...");
  const SuiteToken = await ethers.getContractFactory("SuiteToken");
  const suiteToken = await SuiteToken.deploy(deployer.address);
  await suiteToken.waitForDeployment();
  const tokenAddress = await suiteToken.getAddress();
  console.log("SUITE Token deployed to:", tokenAddress);

  // 2. Deploy Treasury (Upgradeable Proxy)
  console.log("\n2. Deploying SUITE Treasury (Upgradeable)...");
  const SuiteTreasury = await ethers.getContractFactory("SuiteTreasury");
  const treasury = await upgrades.deployProxy(
    SuiteTreasury,
    [tokenAddress, USDC_ADDRESS, deployer.address],
    { initializer: "initialize" }
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("SUITE Treasury deployed to:", treasuryAddress);

  // 3. Add Treasury as minter on Token
  console.log("\n3. Adding Treasury as minter...");
  await suiteToken.addMinter(treasuryAddress);
  console.log("Treasury authorized to mint SUITE");

  // 4. Add Treasury as burner on Token
  console.log("\n4. Adding Treasury as burner...");
  await suiteToken.addBurner(treasuryAddress);
  console.log("Treasury authorized to burn SUITE");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("SUITE Token:", tokenAddress);
  console.log("Treasury Proxy:", treasuryAddress);
  console.log("\nSave these addresses!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Run Deployment

```bash
# For Base Mainnet
npx hardhat run scripts/deploy.js --network base

# For testing on Base Sepolia first
npx hardhat run scripts/deploy.js --network baseSepolia
```

## After Deployment

1. **Verify contracts on Basescan:**
```bash
npx hardhat verify --network base <TOKEN_ADDRESS> <OWNER_ADDRESS>
npx hardhat verify --network base <TREASURY_PROXY_ADDRESS>
```

2. **Update wallet.html** with contract addresses

3. **Test with small deposit** before announcing

## Contract Addresses (Fill in after deploy)

```
Network: Base Mainnet (Chain ID: 8453)

SUITE Token: 0x_____________________________
Treasury Proxy: 0x_____________________________
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## Key Functions

| Function | Who Can Call | Purpose |
|----------|-------------|---------|
| `depositUSDC(amount)` | Anyone | Deposit USDC, get SUITE |
| `withdraw(suiteAmount)` | Anyone | Burn SUITE, get USDC back |
| `addMinter(address)` | Owner | Authorize minting (Treasury) |
| `addBurner(address)` | Owner | Authorize burning (Apps) |
| `authorizeApp(address)` | Owner | Let app charge users |
| `depositYield(amount)` | Owner | Add yield profits to treasury |
| `pause()` | Owner | Emergency pause |
