const { ethers } = require('ethers');

const TOKEN_VAULT_ABI = [
  'event Deposit(address indexed player, uint256 tokenAmount, uint256 chips)',
  'event Withdraw(address indexed player, uint256 tokenAmount, uint256 chips, uint256 nonce)',
  'function processWithdraw(address player, uint256 chips) external',
  'function vaultBalance() external view returns (uint256)',
  'function vaultBalanceChips() external view returns (uint256)',
  'function chipsToTokens(uint256 chips) external pure returns (uint256)',
  'function tokensToChips(uint256 tokenAmount) external pure returns (uint256)',
  'function playerStats(address player) external view returns (uint256 deposited, uint256 withdrawn, uint256 nonce)',
  'function paused() external view returns (bool)'
];

const REWARDS_ABI = [
  'function claim(uint256 amount, uint256 nonce, bytes signature) external',
  'function poolRemaining() external view returns (uint256)',
  'function playerInfo(address player) external view returns (uint256 claimed, uint256 nonce)',
  'function rewardStats() external view returns (uint256 deposited, uint256 distributed, uint256 remaining)',
  'function claimNonce(address player) external view returns (uint256)'
];

const TOKEN_DECIMALS = BigInt('1000000000000000000'); // 1e18

class TokenChainService {
  constructor(config) {
    this._rpcUrl = config.rpcUrl;
    this._operatorKey = config.operatorKey;
    this._tokenVaultAddress = config.tokenVaultAddress;
    this._rewardsAddress = config.rewardsAddress;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.operatorWallet = new ethers.Wallet(config.operatorKey, this.provider);

    // Token vault (deposits/withdrawals)
    if (config.tokenVaultAddress) {
      this.vault = new ethers.Contract(config.tokenVaultAddress, TOKEN_VAULT_ABI, this.operatorWallet);
      this.vaultReadOnly = new ethers.Contract(config.tokenVaultAddress, TOKEN_VAULT_ABI, this.provider);
      console.log(`[TokenChain] Vault: ${config.tokenVaultAddress}`);
    }

    // Rewards contract (read-only — server signs, user submits claim tx)
    if (config.rewardsAddress) {
      this.rewardsReadOnly = new ethers.Contract(config.rewardsAddress, REWARDS_ABI, this.provider);
      console.log(`[TokenChain] Rewards: ${config.rewardsAddress}`);
    }

    this.onDeposit = null;
    console.log(`[TokenChain] Signer: ${this.operatorWallet.address}`);
  }

  // =========== Deposit Listener ===========

  startListening() {
    if (!this.vaultReadOnly) return;
    this._attachDepositListener();
    console.log('[TokenChain] Listening for POKERAI Deposit events...');

    // Health check — verify provider is alive, reconnect if stale
    this._healthInterval = setInterval(async () => {
      try {
        await this.provider.getBlockNumber();
      } catch (e) {
        console.error('[TokenChain] Health check failed, reconnecting...', e.message);
        this._reconnect();
      }
    }, 60000);
  }

  _attachDepositListener() {
    this.vaultReadOnly.on('Deposit', (player, tokenAmount, chips) => {
      const addr = player.toLowerCase();
      const tokens = Number(tokenAmount) / Number(TOKEN_DECIMALS);
      const chipAmt = Number(chips);
      console.log(`[TokenChain] Deposit: ${addr} → ${tokens} POKERAI → ${chipAmt} chips`);
      if (this.onDeposit) {
        this.onDeposit(addr, chipAmt, Number(tokenAmount));
      }
    });
  }

  _reconnect() {
    try {
      if (this.vaultReadOnly) this.vaultReadOnly.removeAllListeners();
      this.provider = new ethers.JsonRpcProvider(this._rpcUrl);
      this.operatorWallet = new ethers.Wallet(this._operatorKey, this.provider);
      if (this._tokenVaultAddress) {
        this.vault = new ethers.Contract(this._tokenVaultAddress, TOKEN_VAULT_ABI, this.operatorWallet);
        this.vaultReadOnly = new ethers.Contract(this._tokenVaultAddress, TOKEN_VAULT_ABI, this.provider);
        this._attachDepositListener();
      }
      if (this._rewardsAddress) {
        this.rewardsReadOnly = new ethers.Contract(this._rewardsAddress, REWARDS_ABI, this.provider);
      }
      console.log('[TokenChain] Reconnected successfully');
    } catch (e) {
      console.error('[TokenChain] Reconnect failed:', e.message);
    }
  }

  // =========== Withdrawal ===========

  async processWithdraw(playerAddress, chipAmount) {
    if (!this.vault) return { error: 'POKERAI vault not configured' };

    const tokenAmount = BigInt(chipAmount) * TOKEN_DECIMALS;

    const balance = await this.vaultReadOnly.vaultBalance();
    if (BigInt(balance) < tokenAmount) {
      return { error: 'Insufficient POKERAI in vault' };
    }

    const isPaused = await this.vaultReadOnly.paused();
    if (isPaused) {
      return { error: 'Contract is paused' };
    }

    try {
      const tx = await this.vault.processWithdraw(playerAddress, chipAmount);
      const receipt = await tx.wait();
      console.log(`[TokenChain] Withdrawal: ${playerAddress} → ${chipAmount} chips → ${chipAmount} POKERAI (tx: ${receipt.hash})`);
      return {
        success: true,
        txHash: receipt.hash,
        tokenAmount: chipAmount, // 1:1 ratio
        chipAmount
      };
    } catch (e) {
      console.error(`[TokenChain] Withdrawal failed:`, e.message);
      return { error: `Transaction failed: ${e.reason || e.message}` };
    }
  }

  // =========== Rewards Claim Signing ===========

  /**
   * Sign a claim authorization for the user to submit on-chain (user pays gas).
   * Returns { signature, amount (wei string), nonce, rewardsAddress } for client.
   */
  async signClaimAuthorization(playerAddress, amount) {
    if (!this.rewardsReadOnly) return { error: 'Rewards contract not configured' };

    // amount is in whole tokens (1:1 with chips earned)
    const tokenAmount = BigInt(Math.floor(amount)) * TOKEN_DECIMALS;

    try {
      const remaining = await this.rewardsReadOnly.poolRemaining();
      if (BigInt(remaining) < tokenAmount) {
        return { error: 'Insufficient reward pool' };
      }

      // Get current nonce for this player
      const nonce = await this.rewardsReadOnly.claimNonce(playerAddress);

      // Sign: keccak256(abi.encodePacked(player, amount, nonce, contractAddress))
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'address'],
        [playerAddress, tokenAmount, nonce, this._rewardsAddress]
      );
      const signature = await this.operatorWallet.signMessage(ethers.getBytes(messageHash));

      console.log(`[TokenChain] Signed claim: ${playerAddress} → ${amount} POKERAI (nonce: ${nonce})`);
      return {
        success: true,
        signature,
        amount: tokenAmount.toString(),
        nonce: Number(nonce),
        rewardsAddress: this._rewardsAddress
      };
    } catch (e) {
      console.error(`[TokenChain] signClaimAuthorization failed:`, e.message);
      return { error: `Signing failed: ${e.reason || e.message}` };
    }
  }

  // =========== Stats ===========

  async getVaultStats() {
    if (!this.vaultReadOnly) return { vaultBalanceTokens: '0', vaultBalanceChips: 0 };
    const balance = await this.vaultReadOnly.vaultBalance();
    return {
      vaultBalanceTokens: ethers.formatUnits(balance, 18),
      vaultBalanceChips: Number(BigInt(balance) / TOKEN_DECIMALS)
    };
  }

  async getRewardStats() {
    if (!this.rewardsReadOnly) return { deposited: '0', distributed: '0', remaining: '0' };
    const stats = await this.rewardsReadOnly.rewardStats();
    return {
      deposited: ethers.formatUnits(stats[0], 18),
      distributed: ethers.formatUnits(stats[1], 18),
      remaining: ethers.formatUnits(stats[2], 18)
    };
  }

  async getPlayerDepositStats(playerAddress) {
    if (!this.vaultReadOnly) return { deposited: '0', withdrawn: '0', nonce: 0 };
    const stats = await this.vaultReadOnly.playerStats(playerAddress);
    return {
      deposited: ethers.formatUnits(stats[0], 18),
      withdrawn: ethers.formatUnits(stats[1], 18),
      nonce: Number(stats[2])
    };
  }
}

module.exports = { TokenChainService, TOKEN_DECIMALS };
