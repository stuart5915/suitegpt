/**
 * PokerAI Reward Engine
 *
 * Tracks POKERAI token earnings for wallets based on their share of chips IN PLAY.
 * Uses Synthetix-style per-second accumulator math for fair, continuous distribution.
 * Only chips actively at tables count — idle wallet balance earns nothing.
 *
 * Round 1: 2.5B tokens (2.5% of 100B supply) over 90 days (~0.028%/day sell pressure)
 * Total allocation: 25B (25%). Starting small, ramping up as platform matures.
 * Two pools:
 *   - USDC pool:    15% of rewards → drips to USDC table players
 *   - POKERAI pool: 85% of rewards → drips to POKERAI table players
 *
 * Earnings = (your in-play chips / total in-play TVL) * emission rate * time
 */

const SECONDS_PER_DAY = 86400;

class RewardEngine {
  /**
   * @param {object} opts
   * @param {number} opts.usdcEmissionPerDay  - POKERAI tokens per day for USDC players
   * @param {number} opts.pokeraiEmissionPerDay - POKERAI tokens per day for POKERAI players
   * @param {object} store - persistence store (supabase or agent-store)
   */
  constructor(opts = {}) {
    // Default: 25B over 90 days, 15/85 split
    const totalPerDay = (opts.totalRewards || 25_000_000_000) / (opts.durationDays || 90);
    this.usdcEmissionPerDay = opts.usdcEmissionPerDay || totalPerDay * 0.15;
    this.pokeraiEmissionPerDay = opts.pokeraiEmissionPerDay || totalPerDay * 0.85;

    this.store = opts.store || null;

    // Synthetix accumulator state — separate for USDC and POKERAI pools
    this.pools = {
      usdc: {
        rewardPerTokenStored: 0,
        lastUpdateTime: Date.now() / 1000,
        totalValue: 0,                      // total chips across all USDC wallets
        emissionPerSecond: this.usdcEmissionPerDay / SECONDS_PER_DAY,
        wallets: new Map()                   // wallet → { value, rewardPerTokenPaid, earned }
      },
      pokerai: {
        rewardPerTokenStored: 0,
        lastUpdateTime: Date.now() / 1000,
        totalValue: 0,
        emissionPerSecond: this.pokeraiEmissionPerDay / SECONDS_PER_DAY,
        wallets: new Map()
      }
    };

    // Claimed amounts (synced with on-chain contract)
    this.claimed = new Map(); // wallet → total claimed

    // Persist snapshots periodically
    this._snapshotInterval = null;
  }

  // =========== Core Synthetix Math ===========

  _rewardPerToken(pool) {
    if (pool.totalValue === 0) return pool.rewardPerTokenStored;
    const now = Date.now() / 1000;
    const elapsed = now - pool.lastUpdateTime;
    return pool.rewardPerTokenStored + (elapsed * pool.emissionPerSecond) / pool.totalValue;
  }

  _earned(pool, wallet) {
    const w = pool.wallets.get(wallet);
    if (!w) return 0;
    const rpt = this._rewardPerToken(pool);
    return w.earned + w.value * (rpt - w.rewardPerTokenPaid);
  }

  _updateReward(pool, wallet) {
    pool.rewardPerTokenStored = this._rewardPerToken(pool);
    pool.lastUpdateTime = Date.now() / 1000;

    if (wallet) {
      const w = pool.wallets.get(wallet);
      if (w) {
        w.earned = this._earned(pool, wallet);
        w.rewardPerTokenPaid = pool.rewardPerTokenStored;
      }
    }
  }

  // =========== Public API ===========

  /**
   * Update a wallet's value in a pool. Called whenever balance changes
   * (deposit, withdrawal, hand completion, backing update, etc.)
   *
   * @param {string} wallet - wallet address (lowercase)
   * @param {number} newValue - total chip value (wallet balance + agent chips + backings)
   * @param {string} poolType - 'usdc' or 'pokerai'
   */
  updateWalletValue(wallet, newValue, poolType = 'usdc') {
    const pool = this.pools[poolType];
    if (!pool) return;

    wallet = wallet.toLowerCase();
    this._updateReward(pool, wallet);

    let w = pool.wallets.get(wallet);
    if (!w) {
      w = { value: 0, rewardPerTokenPaid: pool.rewardPerTokenStored, earned: 0 };
      pool.wallets.set(wallet, w);
    }

    // Update total
    pool.totalValue = pool.totalValue - w.value + newValue;
    w.value = newValue;
  }

  /**
   * Get total earned POKERAI for a wallet (across both pools)
   */
  getEarned(wallet) {
    wallet = wallet.toLowerCase();
    const usdcEarned = this._earned(this.pools.usdc, wallet);
    const pokeraiEarned = this._earned(this.pools.pokerai, wallet);
    return usdcEarned + pokeraiEarned;
  }

  /**
   * Get claimable amount (earned minus already claimed)
   */
  getClaimable(wallet) {
    wallet = wallet.toLowerCase();
    const earned = this.getEarned(wallet);
    const claimed = this.claimed.get(wallet) || 0;
    return Math.max(0, earned - claimed);
  }

  /**
   * Record a successful claim (after on-chain distribute() succeeds)
   */
  recordClaim(wallet, amount) {
    wallet = wallet.toLowerCase();
    const prev = this.claimed.get(wallet) || 0;
    this.claimed.set(wallet, prev + amount);
  }

  /**
   * Get a wallet's current earning rate (POKERAI per second)
   */
  getWalletRate(wallet) {
    wallet = wallet.toLowerCase();
    let rate = 0;

    for (const [, pool] of Object.entries(this.pools)) {
      const w = pool.wallets.get(wallet);
      if (w && w.value > 0 && pool.totalValue > 0) {
        rate += (w.value / pool.totalValue) * pool.emissionPerSecond;
      }
    }

    return rate;
  }

  /**
   * Get platform-wide stats
   */
  getStats() {
    const usdcPool = this.pools.usdc;
    const pokeraiPool = this.pools.pokerai;

    return {
      tvl: {
        usdc: usdcPool.totalValue,
        pokerai: pokeraiPool.totalValue,
        total: usdcPool.totalValue + pokeraiPool.totalValue
      },
      emission: {
        usdcPerDay: this.usdcEmissionPerDay,
        pokeraiPerDay: this.pokeraiEmissionPerDay,
        usdcPerSecond: usdcPool.emissionPerSecond,
        pokeraiPerSecond: pokeraiPool.emissionPerSecond,
        totalPerSecond: usdcPool.emissionPerSecond + pokeraiPool.emissionPerSecond
      },
      wallets: {
        usdc: usdcPool.wallets.size,
        pokerai: pokeraiPool.wallets.size
      }
    };
  }

  /**
   * Get full reward state for a specific wallet (sent to frontend)
   */
  getWalletRewards(wallet) {
    wallet = wallet.toLowerCase();
    const earned = this.getEarned(wallet);
    const claimed = this.claimed.get(wallet) || 0;
    const claimable = Math.max(0, earned - claimed);
    const ratePerSecond = this.getWalletRate(wallet);

    return {
      earned,
      claimed,
      claimable,
      ratePerSecond
    };
  }

  // =========== Persistence ===========

  /**
   * Get snapshot for persistence (save to Supabase periodically)
   */
  getSnapshot() {
    const snapshot = { pools: {}, claimed: {} };

    for (const [poolType, pool] of Object.entries(this.pools)) {
      snapshot.pools[poolType] = {
        rewardPerTokenStored: this._rewardPerToken(pool),
        lastUpdateTime: Date.now() / 1000,
        totalValue: pool.totalValue,
        wallets: {}
      };
      for (const [wallet, w] of pool.wallets) {
        snapshot.pools[poolType].wallets[wallet] = {
          value: w.value,
          earned: this._earned(pool, wallet),
          rewardPerTokenPaid: this._rewardPerToken(pool)
        };
      }
    }

    for (const [wallet, amount] of this.claimed) {
      snapshot.claimed[wallet] = amount;
    }

    return snapshot;
  }

  /**
   * Restore from snapshot (on server restart)
   */
  loadSnapshot(snapshot) {
    if (!snapshot) return;

    for (const [poolType, poolData] of Object.entries(snapshot.pools || {})) {
      const pool = this.pools[poolType];
      if (!pool) continue;

      pool.rewardPerTokenStored = poolData.rewardPerTokenStored || 0;
      pool.lastUpdateTime = poolData.lastUpdateTime || Date.now() / 1000;
      pool.totalValue = poolData.totalValue || 0;

      for (const [wallet, wData] of Object.entries(poolData.wallets || {})) {
        pool.wallets.set(wallet, {
          value: wData.value || 0,
          earned: wData.earned || 0,
          rewardPerTokenPaid: wData.rewardPerTokenPaid || 0
        });
      }
    }

    for (const [wallet, amount] of Object.entries(snapshot.claimed || {})) {
      this.claimed.set(wallet, amount);
    }

    console.log(`[RewardEngine] Loaded snapshot: ${this.pools.usdc.wallets.size} USDC wallets, ${this.pools.pokerai.wallets.size} POKERAI wallets`);
  }

  /**
   * Start periodic snapshot saves
   */
  startSnapshots(saveCallback, intervalMs = 300000) {
    this._snapshotInterval = setInterval(() => {
      try {
        const snapshot = this.getSnapshot();
        saveCallback(snapshot);
      } catch (e) {
        console.error('[RewardEngine] Snapshot save failed:', e.message);
      }
    }, intervalMs);
  }

  stop() {
    if (this._snapshotInterval) {
      clearInterval(this._snapshotInterval);
      this._snapshotInterval = null;
    }
  }
}

module.exports = { RewardEngine };
