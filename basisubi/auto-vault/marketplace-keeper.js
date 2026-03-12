/**
 * Basis Vault Marketplace — Multi-Vault Keeper
 *
 * Iterates all vaults from the factory, fetches each vault's brain config
 * from Supabase, runs the brain, and rebalances if needed.
 *
 * Also snapshots vault metrics to Supabase for the leaderboard.
 *
 * Env vars:
 *   FACTORY_ADDRESS     — BasisVaultFactory address
 *   KEEPER_PRIVATE_KEY  — wallet with manager role on vaults
 *   BASE_RPC_URL        — Base mainnet RPC
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Supabase service role key
 */

import { decide, shouldRebalance } from './brain.js';
import { ethers } from 'ethers';

// ── Config ──

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRIFT_THRESHOLD = 10;

// ── ABIs ──

const FACTORY_ABI = [
  'function totalVaults() view returns (uint256)',
  'function getVaults(uint256 offset, uint256 limit) view returns (address[])'
];

const VAULT_ABI = [
  'function rebalance(uint256 lpBps, uint256 longBps, uint256 shortBps, uint256 holdBps, int24 newRangeWidth) external',
  'function currentAllocation() view returns (uint256 lpBps, uint256 longBps, uint256 shortBps, uint256 holdBps)',
  'function getVaultInfo() view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256)',
  'function lastRebalanceTime() view returns (uint256)',
  'function rebalanceCooldown() view returns (uint256)',
  'function circuitBreakerTripped() view returns (bool)',
  'function manager() view returns (address)',
  'function sharePrice() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function name() view returns (string)'
];

// ── Fetch ETH prices from Binance ──

async function fetchPriceHistory() {
  const endTime = Date.now();
  const startTime = endTime - 60 * 24 * 60 * 60 * 1000; // 60 days
  const url = `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=61`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Binance API ${resp.status}`);
  const data = await resp.json();
  return data.map(k => parseFloat(k[4])); // close prices
}

// ── Supabase helpers ──

async function supabaseGet(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  for (const [key, val] of Object.entries(filters)) {
    url += `&${key}=eq.${val}`;
  }
  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return resp.json();
}

async function supabaseUpsert(table, data) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  return resp.json();
}

async function supabaseInsert(table, data) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return resp.json();
}

// ── Process a single vault ──

async function processVault(vaultAddr, wallet, provider, prices, ethPrice) {
  const vault = new ethers.Contract(vaultAddr, VAULT_ABI, wallet);

  try {
    const vaultName = await vault.name();
    console.log(`\n  [${vaultAddr.slice(0, 8)}...] ${vaultName}`);

    // Check if keeper is manager
    const manager = await vault.manager();
    if (manager.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log(`    Not manager (manager=${manager.slice(0, 8)}...) — snapshot only`);
    }

    // Check circuit breaker
    const circuitBroken = await vault.circuitBreakerTripped();
    if (circuitBroken) {
      console.log(`    Circuit breaker tripped — skipping rebalance`);
    }

    // Get vault info
    const info = await vault.getVaultInfo();
    const totalAssets = parseFloat(ethers.formatUnits(info[0], 6));
    const sharePrice = parseFloat(ethers.formatUnits(await vault.sharePrice(), 18));
    const lpBps = Number(info[6]);
    const longBps = Number(info[7]);
    const shortBps = Number(info[8]);
    const holdBps = Number(info[9]);
    const rebalances = Number(info[11]);

    console.log(`    TVL: $${totalAssets.toFixed(2)} | Share: ${sharePrice.toFixed(4)} | Rebal: ${rebalances}`);

    // Get brain config from Supabase
    const vaultData = await supabaseGet('vault_marketplace', { vault_address: vaultAddr.toLowerCase() });
    const brainConfig = vaultData[0]?.brain_config;

    // Run brain if we're the manager and have config
    const isManager = manager.toLowerCase() === wallet.address.toLowerCase();
    if (isManager && !circuitBroken && brainConfig) {
      // Check cooldown
      const lastRebal = await vault.lastRebalanceTime();
      const cooldown = await vault.rebalanceCooldown();
      const now = Math.floor(Date.now() / 1000);
      const nextRebalAt = Number(lastRebal) + Number(cooldown);

      if (now >= nextRebalAt) {
        const current = {
          lp: lpBps / 100,
          long: longBps / 100,
          short: shortBps / 100,
          hold: holdBps / 100
        };

        // Use brain config if it has regimes, otherwise use static allocation
        let target;
        if (brainConfig.regimes) {
          // Full brain config — run regime detection
          const decision = decide(prices);
          console.log(`    Brain: ${decision.regime}`);
          target = { lp: decision.lp, long: decision.long, short: decision.short, hold: decision.hold };
        } else {
          // Static allocation from config
          target = { lp: brainConfig.lp || 0, long: brainConfig.long || 0, short: brainConfig.short || 0, hold: brainConfig.hold || 0 };
        }
        console.log(`    Target: LP=${target.lp}% Long=${target.long}% Short=${target.short}% Hold=${target.hold}%`);

        if (shouldRebalance(current, target, DRIFT_THRESHOLD)) {
          console.log(`    Rebalancing...`);
          const tx = await vault.rebalance(
            target.lp * 100,
            target.long * 100,
            target.short * 100,
            target.hold * 100,
            0 // keep current LP range
          );
          const receipt = await tx.wait();
          console.log(`    TX: ${tx.hash} (block ${receipt.blockNumber})`);
        } else {
          console.log(`    No drift — skip`);
        }
      } else {
        const waitMins = Math.ceil((nextRebalAt - now) / 60);
        console.log(`    Cooldown: ${waitMins}min remaining`);
      }
    }

    // Snapshot to Supabase
    const initialSharePrice = 1.0;
    const totalReturn = ((sharePrice / initialSharePrice) - 1) * 100;

    // Update marketplace metrics
    await supabaseUpsert('vault_marketplace', {
      vault_address: vaultAddr.toLowerCase(),
      tvl_usdc: totalAssets,
      total_return_pct: totalReturn,
      share_price: sharePrice,
      rebalance_count: rebalances,
      alloc_lp_bps: lpBps,
      alloc_long_bps: longBps,
      alloc_short_bps: shortBps,
      alloc_hold_bps: holdBps,
      updated_at: new Date().toISOString()
    });

    // Insert snapshot
    await supabaseInsert('vault_snapshots', {
      vault_address: vaultAddr.toLowerCase(),
      tvl_usdc: totalAssets,
      share_price: sharePrice,
      total_return_pct: totalReturn,
      alloc_lp_bps: lpBps,
      alloc_long_bps: longBps,
      alloc_short_bps: shortBps,
      alloc_hold_bps: holdBps,
      eth_price: ethPrice
    });

    console.log(`    Snapshot saved`);
  } catch (err) {
    console.error(`    Error: ${err.message}`);
  }
}

// ── Main ──

async function run() {
  if (!FACTORY_ADDRESS) throw new Error('FACTORY_ADDRESS not set');
  if (!PRIVATE_KEY) throw new Error('KEEPER_PRIVATE_KEY not set');
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

  console.log(`[${new Date().toISOString()}] Marketplace Keeper`);
  console.log(`  Factory: ${FACTORY_ADDRESS}`);
  console.log(`  Keeper:  ${wallet.address}`);

  // Fetch prices once for all vaults
  const prices = await fetchPriceHistory();
  const ethPrice = prices[prices.length - 1];
  console.log(`  ETH: $${ethPrice.toFixed(2)} (${prices.length} days)`);

  // Get all vaults from factory
  const totalVaults = Number(await factory.totalVaults());
  console.log(`  Total vaults: ${totalVaults}`);

  if (totalVaults === 0) {
    console.log('  No vaults to process');
    return;
  }

  // Process in batches of 10
  const BATCH = 10;
  for (let offset = 0; offset < totalVaults; offset += BATCH) {
    const vaults = await factory.getVaults(offset, BATCH);
    for (const vaultAddr of vaults) {
      await processVault(vaultAddr, wallet, provider, prices, ethPrice);
    }
  }

  console.log(`\n[${new Date().toISOString()}] Done`);
}

run().catch(err => {
  console.error(`[${new Date().toISOString()}] Keeper error:`, err.message);
  process.exit(1);
});
