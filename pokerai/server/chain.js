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

// Fallback RPCs — tried in order if primary fails
const FALLBACK_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.drpc.org',
  'https://mainnet.base.org',
  'https://base.llamarpc.com'  // Moved to last — known to fall behind
];

// Wrap any promise with a timeout
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout')), ms))
  ]);
}

class ChainService {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.rpcList = [this.rpcUrl, ...FALLBACK_RPCS.filter(u => u !== this.rpcUrl)];
    this.vaultAddress = config.vaultAddress;
    this.operatorKey = config.operatorKey;

    // Primary provider + operator wallet (for write txs)
    // staticNetwork avoids network detection RPC call on startup (prevents rate limiting)
    // pollingInterval 15s to avoid overwhelming free RPCs (default 4s is too aggressive)
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl, 8453, { staticNetwork: true, pollingInterval: 15000 });
    this.operatorWallet = new ethers.Wallet(this.operatorKey, this.provider);
    this.vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.operatorWallet);

    // Callback for when a deposit is detected
    this.onDeposit = null;
    this._listenerActive = false;

    console.log(`[Chain] Vault: ${this.vaultAddress}`);
    console.log(`[Chain] Operator: ${this.operatorWallet.address}`);
    console.log(`[Chain] RPCs: ${this.rpcList.join(', ')}`);
  }

  // =========== Resilient RPC calls ===========

  // Try a read-only call across all RPCs until one works
  async _resilientCall(fn, timeoutMs = 8000) {
    for (const rpcUrl of this.rpcList) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
        const contract = new ethers.Contract(this.vaultAddress, VAULT_ABI, provider);
        const result = await withTimeout(fn(contract), timeoutMs);
        provider.destroy();
        return result;
      } catch (e) {
        // Try next RPC
      }
    }
    throw new Error('All RPCs failed');
  }

  // =========== Event Listener with auto-reconnect ===========

  startListening() {
    this._startListener();

    // Health check every 60s — restart listener if provider went stale
    this._healthInterval = setInterval(async () => {
      try {
        const bn = await withTimeout(this.provider.getBlockNumber(), 5000);
        if (!bn) throw new Error('No block number');
      } catch (e) {
        console.error('[Chain] Provider health check failed, reconnecting...', e.message);
        this._reconnectProvider();
      }
    }, 60_000);
  }

  _startListener() {
    try { this.provider.removeAllListeners(); } catch (e) { /* ignore */ }
    const readOnly = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.provider);
    readOnly.on('Deposit', (player, usdcAmount, chips, event) => {
      const addr = player.toLowerCase();
      const usdc = Number(usdcAmount) / USDC_DECIMALS;
      const chipAmt = Number(chips);
      const txHash = event?.log?.transactionHash || event?.transactionHash || null;
      console.log(`[Chain] Deposit: ${addr} → ${usdc} USDC → ${chipAmt} chips (tx: ${txHash || 'unknown'})`);
      if (this.onDeposit) {
        this.onDeposit(addr, chipAmt, Number(usdcAmount), txHash);
      }
    });
    // Catch polling errors from ethers event subscription (prevents unhandled rejections)
    readOnly.on('error', (err) => {
      console.error('[Chain] Listener error (will retry):', err.message?.slice(0, 80));
    });
    this._listenerActive = true;
    console.log('[Chain] Listening for Deposit events...');
  }

  _reconnectProvider() {
    try {
      this.provider.destroy();
    } catch (e) { /* ignore */ }

    // Cycle through RPCs to find one that works
    const currentIdx = this.rpcList.indexOf(this.rpcUrl);
    const nextIdx = (currentIdx + 1) % this.rpcList.length;
    const nextRpc = this.rpcList[nextIdx];

    console.log(`[Chain] Switching provider to: ${nextRpc}`);
    this.provider = new ethers.JsonRpcProvider(nextRpc, 8453, { staticNetwork: true, pollingInterval: 15000 });
    this.operatorWallet = new ethers.Wallet(this.operatorKey, this.provider);
    this.vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.operatorWallet);
    this.rpcUrl = nextRpc;

    this._startListener();
  }

  // =========== Deposit Poller (catches missed events) ===========

  // Scans recent blocks for Deposit events every 30s as a safety net.
  // Even if the event listener dies, this WILL catch every deposit.
  startDepositPoller(intervalMs = 30_000) {
    this._lastPolledBlock = 0;
    console.log(`[Chain] Deposit poller active (every ${intervalMs / 1000}s)`);

    const poll = async () => {
      try {
        // Get current block
        let currentBlock;
        try {
          currentBlock = await withTimeout(this.provider.getBlockNumber(), 5000);
        } catch (e) {
          // Try fallback
          for (const rpc of this.rpcList) {
            try {
              const p = new ethers.JsonRpcProvider(rpc, 8453, { staticNetwork: true });
              currentBlock = await withTimeout(p.getBlockNumber(), 5000);
              p.destroy();
              break;
            } catch (_) {}
          }
        }
        if (!currentBlock) return;

        // On first run, only look back 100 blocks (~3 minutes)
        if (this._lastPolledBlock === 0) {
          this._lastPolledBlock = currentBlock - 100;
        }

        // Don't scan if no new blocks
        if (currentBlock <= this._lastPolledBlock) return;

        // Cap scan range to 500 blocks to avoid RPC limits
        const fromBlock = Math.max(this._lastPolledBlock + 1, currentBlock - 500);

        // Query Deposit events in range using resilient call
        const events = await this._resilientCall(async (contract) => {
          return contract.queryFilter('Deposit', fromBlock, currentBlock);
        }, 15000);

        if (events && events.length > 0) {
          for (const evt of events) {
            const addr = evt.args[0].toLowerCase();
            const usdcAmt = Number(evt.args[1]);
            const chips = Number(evt.args[2]);
            const txHash = evt.transactionHash || null;
            console.log(`[Chain:Poller] Found deposit: ${addr} → ${chips} chips (block ${evt.blockNumber}, tx: ${txHash})`);
            if (this.onDeposit) {
              await this.onDeposit(addr, chips, usdcAmt, txHash);
            }
          }
        }

        this._lastPolledBlock = currentBlock;
      } catch (e) {
        console.error('[Chain:Poller] Error:', e.message?.slice(0, 100));
      }
    };

    // Run immediately, then on interval
    poll();
    this._pollInterval = setInterval(poll, intervalMs);
  }

  // =========== Read operations (resilient) ===========

  async playerStats(address) {
    return this._resilientCall(c => c.playerStats(address));
  }

  async getVaultStats() {
    return this._resilientCall(async (c) => {
      const [balance, rakeInfo] = await Promise.all([c.vaultBalance(), c.rakeInfo()]);
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
    });
  }

  // =========== Write operations (use primary provider) ===========

  async processWithdraw(playerAddress, chipAmount) {
    const usdcAmount = Math.floor((chipAmount * USDC_DECIMALS) / CHIPS_PER_USDC);
    if (usdcAmount <= 0) {
      return { error: 'Amount too small to withdraw' };
    }

    // Pre-check with resilient read
    try {
      const balance = await this._resilientCall(c => c.vaultBalance());
      if (Number(balance) < usdcAmount) return { error: 'Insufficient USDC in vault' };
      const isPaused = await this._resilientCall(c => c.paused());
      if (isPaused) return { error: 'Contract is paused' };
    } catch (e) {
      return { error: 'Cannot verify vault state — try again' };
    }

    try {
      const tx = await withTimeout(this.vault.processWithdraw(playerAddress, chipAmount), 30000);
      const receipt = await withTimeout(tx.wait(), 30000);
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

  async recordRake(rakeChips) {
    if (rakeChips <= 0) return;
    const usdcAmount = Math.floor((rakeChips * USDC_DECIMALS) / CHIPS_PER_USDC);
    if (usdcAmount <= 0) return;

    try {
      const tx = await withTimeout(this.vault.recordRake(usdcAmount), 30000);
      await withTimeout(tx.wait(), 30000);
      console.log(`[Chain] Rake recorded: ${rakeChips} chips → ${usdcAmount / USDC_DECIMALS} USDC`);
    } catch (e) {
      console.error(`[Chain] recordRake failed:`, e.message);
    }
  }

  static chipsToUsdc(chips) {
    return (chips * USDC_DECIMALS) / CHIPS_PER_USDC / USDC_DECIMALS;
  }

  static usdcToChips(usdcHuman) {
    return usdcHuman * CHIPS_PER_USDC;
  }
}

module.exports = { ChainService, CHIPS_PER_USDC, USDC_DECIMALS };
