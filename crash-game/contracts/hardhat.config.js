require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    base: {
      url: 'https://mainnet.base.org',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453
    }
  },
  etherscan: {
    apiKey: 'C6WMY6JWVYDGI9QZBEDNUH86E7A5PIZACC',
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: { apiURL: 'https://api.etherscan.io/v2/api?chainid=8453', browserURL: 'https://basescan.org' }
      }
    ]
  }
};
