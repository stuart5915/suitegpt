const { ethers } = require('ethers');

const VAULT_ABI = [
  'event Deposit(address indexed player, uint256 usdcAmount, uint256 chips)',
  'event Withdraw(address indexed player, uint256 usdcAmount, uint256 chips, uint256 nonce)',
  'function processWithdraw(address player, uint256 chips) external',
  'function recordRake(uint256 usdcAmount) external',
  'function vaultBalance() external view returns (uint256)',
  'function chipsToUsdc(uint256 chips) external pure returns (uint256)',
  'function usdcToChips(uint256 usdcAmount) external pure returns (uint256)',
  'function playerStats(address player) external view returns (uint256 deposited, uint256 withdrawn, uint256 nonce)',
  'function rakeInfo() external view returns (address recipient1, address recipient2, uint8 splitPct1, uint256 unclaimed1, uint256 unclaimed2, uint256 totalRecorded)',
  'function paused() external view returns (bool)'
];

const CHIPS_PER_USDC = 10_000;
const USDC_DECIMALS = 1_000_000; // 1e6

class ChainService {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.vaultAddress = config.vaultAddress;
    this.operatorKey = config.operatorKey;

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.operatorWallet = new ethers.Wallet(this.operatorKey, this.provider);
    this.vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.operatorWallet);
    this.vaultReadOnly = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.provider);

    // Callback for when a deposit is detected
    this.onDeposit = null;

    console.log(`[Chain] Vault: ${this.vaultAddress}`);
    console.log(`[Chain] Operator: ${this.operatorWallet.address}`);
  }

  /// Start listening for Deposit events on-chain
  startListening() {
    this.vaultReadOnly.on('Deposit', (player, usdcAmount, chips) => {
      const addr = player.toLowerCase();
      const usdc = Number(usdcAmount) / USDC_DECIMALS;
      const chipAmt = Number(chips);
      console.log(`[Chain] Deposit: ${addr} → ${usdc} USDC → ${chipAmt} chips`);
      if (this.onDeposit) {
        this.onDeposit(addr, chipAmt, Number(usdcAmount));
      }
    });
    console.log('[Chain] Listening for Deposit events...');
  }

  /// Process a player withdrawal — sends USDC from vault to player
  async processWithdraw(playerAddress, chipAmount) {
    const usdcAmount = Math.floor((chipAmount * USDC_DECIMALS) / CHIPS_PER_USDC);
    if (usdcAmount <= 0) {
      return { error: 'Amount too small to withdraw' };
    }

    // Check vault has enough
    const balance = await this.vaultReadOnly.vaultBalance();
    if (Number(balance) < usdcAmount) {
      return { error: 'Insufficient USDC in vault' };
    }

    // Check contract not paused
    const isPaused = await this.vaultReadOnly.paused();
    if (isPaused) {
      return { error: 'Contract is paused' };
    }

    try {
      const tx = await this.vault.processWithdraw(playerAddress, chipAmount);
      const receipt = await tx.wait();
      console.log(`[Chain] Withdrawal processed: ${playerAddress} → ${chipAmount} chips → ${usdcAmount / USDC_DECIMALS} USDC (tx: ${receipt.hash})`);
      return {
        success: true,
        txHash: receipt.hash,
        usdcAmount: usdcAmount / USDC_DECIMALS,
        chipAmount
      };
    } catch (e) {
      console.error(`[Chain] Withdrawal failed:`, e.message);
      return { error: `Transaction failed: ${e.reason || e.message}` };
    }
  }

  /// Record rake on-chain (converts chip rake to USDC units, splits between recipients)
  async recordRake(rakeChips) {
    if (rakeChips <= 0) return;
    // Convert chips → USDC smallest units: 1 chip = 100 USDC units
    const usdcAmount = Math.floor((rakeChips * USDC_DECIMALS) / CHIPS_PER_USDC);
    if (usdcAmount <= 0) return;

    try {
      const tx = await this.vault.recordRake(usdcAmount);
      await tx.wait();
      console.log(`[Chain] Rake recorded: ${rakeChips} chips → ${usdcAmount / USDC_DECIMALS} USDC`);
    } catch (e) {
      console.error(`[Chain] recordRake failed:`, e.message);
    }
  }

  /// Get vault stats
  async getVaultStats() {
    const balance = await this.vaultReadOnly.vaultBalance();
    const rakeInfo = await this.vaultReadOnly.rakeInfo();
    return {
      vaultBalanceUsdc: Number(balance) / USDC_DECIMALS,
      vaultBalanceChips: Number(balance) * CHIPS_PER_USDC / USDC_DECIMALS,
      rake: {
        recipient1: rakeInfo[0],
        recipient2: rakeInfo[1],
        splitPct1: Number(rakeInfo[2]),
        unclaimed1Usdc: Number(rakeInfo[3]) / USDC_DECIMALS,
        unclaimed2Usdc: Number(rakeInfo[4]) / USDC_DECIMALS,
        totalRecordedUsdc: Number(rakeInfo[5]) / USDC_DECIMALS
      }
    };
  }

  /// Convert between chips and USDC
  static chipsToUsdc(chips) {
    return (chips * USDC_DECIMALS) / CHIPS_PER_USDC / USDC_DECIMALS;
  }

  static usdcToChips(usdcHuman) {
    return usdcHuman * CHIPS_PER_USDC;
  }
}

module.exports = { ChainService, CHIPS_PER_USDC, USDC_DECIMALS };
