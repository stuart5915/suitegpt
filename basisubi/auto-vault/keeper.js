/**
 * Basis Auto Vault — Keeper
 *
 * Runs every 4 hours (via cron or Railway).
 * Fetches ETH prices, runs brain logic, calls rebalance() if needed.
 *
 * Env vars:
 *   AUTO_VAULT_ADDRESS  — deployed AutoBasisVault proxy address
 *   KEEPER_PRIVATE_KEY  — wallet with strategist role
 *   BASE_RPC_URL        — Base mainnet RPC (default: https://mainnet.base.org)
 */

import { decide, shouldRebalance } from './brain.js';
import { ethers } from 'ethers';

// ── Config ──

const VAULT_ADDRESS = process.env.AUTO_VAULT_ADDRESS;
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/ethereum/market_chart';
const DRIFT_THRESHOLD = 10; // 10% drift before rebalance

// ── ABI (only what we need) ──

const VAULT_ABI = [
  'function rebalance(uint256 lpBps, uint256 longBps, uint256 shortBps, uint256 holdBps, int24 newRangeWidth) external',
  'function currentAllocation() view returns (uint256 lpBps, uint256 longBps, uint256 shortBps, uint256 holdBps)',
  'function getVaultInfo() view returns (uint256 totalAssets_, uint256 totalSupply_, uint256 lpVal, uint256 longVal, uint256 shortVal, uint256 holdVal, uint256 lpBps_, uint256 longBps_, uint256 shortBps_, uint256 holdBps_, bool circuitBroken, uint256 rebalances, uint256 lastRebal)',
  'function lastRebalanceTime() view returns (uint256)',
  'function rebalanceCooldown() view returns (uint256)',
  'function circuitBreakerTripped() view returns (bool)'
];

// ── Fetch 60 days of ETH prices for brain ──

async function fetchPriceHistory() {
  const url = `${COINGECKO_URL}?vs_currency=usd&days=60&interval=daily`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
  const data = await resp.json();
  return data.prices.map(([, price]) => price);
}

// ── Main ──

async function run() {
  // Validate env
  if (!VAULT_ADDRESS) throw new Error('AUTO_VAULT_ADDRESS not set');
  if (!PRIVATE_KEY) throw new Error('KEEPER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);

  console.log(`[${new Date().toISOString()}] Keeper running`);
  console.log(`  Vault:  ${VAULT_ADDRESS}`);
  console.log(`  Keeper: ${wallet.address}`);

  // 1. Check circuit breaker
  const circuitBroken = await vault.circuitBreakerTripped();
  if (circuitBroken) {
    console.log('  Circuit breaker is tripped — skipping. Admin must reset.');
    return;
  }

  // 2. Check cooldown
  const lastRebal = await vault.lastRebalanceTime();
  const cooldown = await vault.rebalanceCooldown();
  const now = Math.floor(Date.now() / 1000);
  const nextRebalAt = Number(lastRebal) + Number(cooldown);
  if (now < nextRebalAt) {
    const waitMins = Math.ceil((nextRebalAt - now) / 60);
    console.log(`  Cooldown active — ${waitMins} min remaining. Skipping.`);
    return;
  }

  // 3. Get current allocation from contract
  const [alloc] = await Promise.all([vault.currentAllocation()]);
  const current = {
    lp: Number(alloc.lpBps) / 100,
    long: Number(alloc.longBps) / 100,
    short: Number(alloc.shortBps) / 100,
    hold: Number(alloc.holdBps) / 100
  };
  console.log(`  Current: LP=${current.lp}% Long=${current.long}% Short=${current.short}% Hold=${current.hold}%`);

  // 4. Fetch prices and run brain
  const prices = await fetchPriceHistory();
  console.log(`  ETH price: $${prices[prices.length - 1].toFixed(2)} (${prices.length} days of data)`);

  const decision = decide(prices);
  console.log(`  Brain says: ${decision.regime}`);
  console.log(`  Target:  LP=${decision.lp}% Long=${decision.long}% Short=${decision.short}% Hold=${decision.hold}%`);

  // 5. Check if rebalance needed
  const target = { lp: decision.lp, long: decision.long, short: decision.short, hold: decision.hold };
  if (!shouldRebalance(current, target, DRIFT_THRESHOLD)) {
    console.log(`  Drift < ${DRIFT_THRESHOLD}% — no rebalance needed.`);
    return;
  }

  // 6. Execute rebalance
  console.log(`  Rebalancing...`);
  const tx = await vault.rebalance(
    decision.lp * 100,      // convert % to bps
    decision.long * 100,
    decision.short * 100,
    decision.hold * 100,
    decision.lpRange         // tick range width
  );

  console.log(`  TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);

  // 7. Log new state
  const info = await vault.getVaultInfo();
  console.log(`  New state:`);
  console.log(`    Total Assets: $${ethers.formatUnits(info.totalAssets_, 6)}`);
  console.log(`    LP: $${ethers.formatUnits(info.lpVal, 6)}`);
  console.log(`    Long: $${ethers.formatUnits(info.longVal, 6)}`);
  console.log(`    Short: $${ethers.formatUnits(info.shortVal, 6)}`);
  console.log(`    Hold: $${ethers.formatUnits(info.holdVal, 6)}`);
  console.log(`    Rebalances: ${info.rebalances.toString()}`);
}

run().catch(err => {
  console.error(`[${new Date().toISOString()}] Keeper error:`, err.message);
  process.exit(1);
});
