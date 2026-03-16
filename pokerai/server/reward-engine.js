/**
 * PokerAI Reward Engine
 *
 * Tracks POKERAI token earnings for wallets based on their share of chips IN PLAY.
 * Uses Synthetix-style per-second accumulator math for fair, continuous distribution.
 * Only chips actively at tables count — idle wallet balance earns nothing.
 *
 * Emission is fully dynamic — admin can set any totalRewards and durationDays at will.
 * Two pools (configurable split):
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
    // Dynamic emission config — can be changed at any time via setEmission()
    this.totalRewards = opts.totalRewards || 0;
    this.durationDays = opts.durationDays || 90;
    this.usdcSplit = opts.usdcSplit || 0.15;
    this.pokeraiSplit = opts.pokeraiSplit || 0.85;

    const totalPerDay = this.totalRewards / this.durationDays;
    this.usdcEmissionPerDay = totalPerDay * this.usdcSplit;
    this.pokeraiEmissionPerDay = totalPerDay * this.pokeraiSplit;

    this.store = opts.store || null;

    // Excluded wallets (platform wallets that shouldn't earn rewards)
    this.excludedWallets = new Set((opts.excludedWallets || []).map(w => w.toLowerCase()));

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
   * Dynamically change emission rate. Settles all existing rewards at the old rate
   * before switching, so nothing is lost.
   *
   * @param {number} totalRewards - total POKERAI tokens to distribute
   * @param {number} durationDays - over how many days
   * @param {number} [usdcSplit=0.15] - fraction of rewards for USDC pool
   * @param {number} [pokeraiSplit=0.85] - fraction of rewards for POKERAI pool
   */
  setEmission(totalRewards, durationDays, usdcSplit, pokeraiSplit) {
    // Settle all wallets at current rate before changing
    for (const [, pool] of Object.entries(this.pools)) {
      for (const [wallet] of pool.wallets) {
        this._updateReward(pool, wallet);
      }
    }

    this.totalRewards = totalRewards;
    this.durationDays = durationDays;
    if (usdcSplit !== undefined) this.usdcSplit = usdcSplit;
    if (pokeraiSplit !== undefined) this.pokeraiSplit = pokeraiSplit;

    const totalPerDay = this.totalRewards / this.durationDays;
    this.usdcEmissionPerDay = totalPerDay * this.usdcSplit;
    this.pokeraiEmissionPerDay = totalPerDay * this.pokeraiSplit;

    this.pools.usdc.emissionPerSecond = this.usdcEmissionPerDay / SECONDS_PER_DAY;
    this.pools.pokerai.emissionPerSecond = this.pokeraiEmissionPerDay / SECONDS_PER_DAY;

    console.log(`[RewardEngine] Emission updated: ${totalRewards.toLocaleString()} POKERAI over ${durationDays} days (${(totalPerDay).toLocaleString()}/day, split ${this.usdcSplit * 100}/${this.pokeraiSplit * 100})`);
  }

  /**
   * Get current emission config
   */
  getEmissionConfig() {
    return {
      totalRewards: this.totalRewards,
      durationDays: this.durationDays,
      usdcSplit: this.usdcSplit,
      pokeraiSplit: this.pokeraiSplit,
      usdcPerDay: this.usdcEmissionPerDay,
      pokeraiPerDay: this.pokeraiEmissionPerDay,
      totalPerDay: this.usdcEmissionPerDay + this.pokeraiEmissionPerDay,
      active: this.totalRewards > 0
    };
  }

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

    // Platform wallets are excluded — they earn nothing
    if (this.excludedWallets.has(wallet)) return;

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
        totalRewards: this.totalRewards,
        durationDays: this.durationDays,
        usdcPerDay: this.usdcEmissionPerDay,
        pokeraiPerDay: this.pokeraiEmissionPerDay,
        usdcPerSecond: usdcPool.emissionPerSecond,
        pokeraiPerSecond: pokeraiPool.emissionPerSecond,
        totalPerSecond: usdcPool.emissionPerSecond + pokeraiPool.emissionPerSecond,
        active: this.totalRewards > 0
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
    const snapshot = {
      pools: {},
      claimed: {},
      config: {
        totalRewards: this.totalRewards,
        durationDays: this.durationDays,
        usdcSplit: this.usdcSplit,
        pokeraiSplit: this.pokeraiSplit
      }
    };

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

    // Restore emission config if saved (preserves dynamic settings across restarts)
    if (snapshot.config) {
      this.totalRewards = snapshot.config.totalRewards || 0;
      this.durationDays = snapshot.config.durationDays || 90;
      this.usdcSplit = snapshot.config.usdcSplit || 0.15;
      this.pokeraiSplit = snapshot.config.pokeraiSplit || 0.85;

      const totalPerDay = this.totalRewards / this.durationDays;
      this.usdcEmissionPerDay = totalPerDay * this.usdcSplit;
      this.pokeraiEmissionPerDay = totalPerDay * this.pokeraiSplit;
    }

    for (const [poolType, poolData] of Object.entries(snapshot.pools || {})) {
      const pool = this.pools[poolType];
      if (!pool) continue;

      pool.rewardPerTokenStored = poolData.rewardPerTokenStored || 0;
      pool.lastUpdateTime = poolData.lastUpdateTime || Date.now() / 1000;
      pool.totalValue = poolData.totalValue || 0;
      // Apply restored emission rates
      if (poolType === 'usdc') pool.emissionPerSecond = this.usdcEmissionPerDay / SECONDS_PER_DAY;
      if (poolType === 'pokerai') pool.emissionPerSecond = this.pokeraiEmissionPerDay / SECONDS_PER_DAY;

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

    console.log(`[RewardEngine] Loaded snapshot: ${this.pools.usdc.wallets.size} USDC wallets, ${this.pools.pokerai.wallets.size} POKERAI wallets, emission: ${this.totalRewards.toLocaleString()} over ${this.durationDays} days`);
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
