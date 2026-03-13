/**
 * Seed Vault Marketplace with demo vaults
 *
 * Fetches real ETH price history, backtests 8 different vault strategies,
 * and inserts them into Supabase with realistic performance metrics.
 *
 * Usage: node seed-vaults.js
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Backtest Config ──
const BASE_LP_APY = 0.15;       // Base LP APY at standard range
const LP_APY = BASE_LP_APY;
const AAVE_BORROW_RATE = 0.035;
const AAVE_SUPPLY_RATE = 0.03;
const SWAP_COST_BPS = 5;
const REBALANCE_SWAPS = 4;
const REBALANCE_COOLDOWN_DAYS = 0.167;
const DRIFT_THRESHOLD = 10;

// ── Brain helpers (inlined from brain.js) ──
function sma(prices, period) {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function volatility(prices, period) {
  if (prices.length < period + 1) return 0;
  const slice = prices.slice(-(period + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i++) returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(365);
}

function momentum(prices, period) {
  if (prices.length < period + 1) return 0;
  const slice = prices.slice(-(period + 1));
  let score = 0;
  for (let i = 1; i < slice.length; i++) {
    score += ((slice[i] - slice[i - 1]) / slice[i - 1]) * (i / slice.length);
  }
  return score;
}

// ── Vault Strategies ──
const VAULTS = [
  {
    name: 'Basis OG Vault',
    manager_name: 'Basis Protocol',
    manager_address: '0x0000000000000000000000000000000000ba5150',
    description: 'The original 0% fee vault. Automated brain detects market regimes and rotates between LP, leverage, and hold. Battle-tested strategy.',
    performance_fee_bps: 0,
    deposit_cap_usdc: 500000,
    brain_type: 'dynamic', // uses regime detection
    brain_config: { lp: 55, long: 20, short: 5, hold: 20, lp_range: 600 },
  },
  {
    name: 'Yield Maximizer',
    manager_name: 'LP_Maxi',
    manager_address: '0x0000000000000000000000000000000000111111',
    description: 'All-in on concentrated LP fees. Ultra-tight range for maximum fee capture. Higher IL risk but consistently high APY in ranging markets.',
    performance_fee_bps: 1000,
    deposit_cap_usdc: 200000,
    brain_type: 'static',
    brain_config: { lp: 80, long: 0, short: 0, hold: 20, lp_range: 200 },
  },
  {
    name: 'ETH Bull Brain',
    manager_name: 'CryptoAlpha',
    manager_address: '0x0000000000000000000000000000000000222222',
    description: 'Long-biased strategy for ETH believers. Heavy leverage exposure with LP fees as a yield baseline. Best in uptrends, risky in drawdowns.',
    performance_fee_bps: 1500,
    deposit_cap_usdc: 100000,
    brain_type: 'static',
    brain_config: { lp: 15, long: 60, short: 0, hold: 25, lp_range: 400 },
  },
  {
    name: 'Market Neutral',
    manager_name: 'DeltaZero',
    manager_address: '0x0000000000000000000000000000000000333333',
    description: 'Balanced long/short exposure to minimize directional risk. Earns from LP fees and funding rate arb. Steady returns, low drawdowns.',
    performance_fee_bps: 1000,
    deposit_cap_usdc: 300000,
    brain_type: 'static',
    brain_config: { lp: 40, long: 15, short: 25, hold: 20, lp_range: 800 },
  },
  {
    name: 'Conservative Yield',
    manager_name: 'SafeHands',
    manager_address: '0x0000000000000000000000000000000000444444',
    description: 'Capital preservation first. Mostly USDC hold with small LP allocation for yield. Lowest risk, lowest return. Sleep at night vault.',
    performance_fee_bps: 500,
    deposit_cap_usdc: 1000000,
    brain_type: 'static',
    brain_config: { lp: 20, long: 5, short: 5, hold: 70, lp_range: 1600 },
  },
  {
    name: 'Trend Surfer',
    manager_name: 'MomentumBot',
    manager_address: '0x0000000000000000000000000000000000555555',
    description: 'AI-driven regime detection. Goes long in uptrends, short in downtrends, holds in chop. Adapts allocation every 4 hours based on signals.',
    performance_fee_bps: 2000,
    deposit_cap_usdc: 150000,
    brain_type: 'dynamic',
    brain_config: { lp: 25, long: 30, short: 15, hold: 30, lp_range: 400 },
  },
  {
    name: 'Degen LP',
    manager_name: 'TickSniper',
    manager_address: '0x0000000000000000000000000000000000666666',
    description: 'Extremely tight LP range for insane fee APY. Rebalances aggressively. High IL risk but massive fee income when ETH is ranging. Not for the faint-hearted.',
    performance_fee_bps: 2500,
    deposit_cap_usdc: 50000,
    brain_type: 'static',
    brain_config: { lp: 90, long: 0, short: 0, hold: 10, lp_range: 100 },
  },
  {
    name: 'Hedge & Earn',
    manager_name: 'RiskParity',
    manager_address: '0x0000000000000000000000000000000000777777',
    description: 'Equal-weight across all four strategies. Natural hedge between long and short. LP fees provide baseline yield. Rebalances monthly.',
    performance_fee_bps: 800,
    deposit_cap_usdc: 250000,
    brain_type: 'static',
    brain_config: { lp: 25, long: 25, short: 25, hold: 25, lp_range: 600 },
  },
];

// ── Dynamic regime detection (for brain_type: 'dynamic') ──
function detectRegime(prices) {
  const price = prices[prices.length - 1];
  const sma7 = sma(prices, 7);
  const sma30 = sma(prices, 30);
  const vol = volatility(prices, 14);
  const mom = momentum(prices, 7);

  if (vol > 0.80) return 'HIGH_VOL';
  if (price > sma7 && sma7 > sma30 && mom > 0.005) return 'STRONG_UP';
  if (price < sma7 && sma7 < sma30 && mom < -0.005) return 'STRONG_DOWN';
  return 'RANGING';
}

const REGIME_ALLOCS = {
  STRONG_UP:   { lp: 25, long: 60, short: 0,  hold: 15, lp_range: 400 },
  RANGING:     { lp: 55, long: 20, short: 5,  hold: 20, lp_range: 600 },
  HIGH_VOL:    { lp: 25, long: 12, short: 13, hold: 50, lp_range: 1600 },
  STRONG_DOWN: { lp: 15, long: 5,  short: 50, hold: 30, lp_range: 800 },
};

// ── Simulate one day's return ──
function dailyReturn(alloc, pricePrev, priceNow, lpRangeTicks) {
  const ethReturn = (priceNow - pricePrev) / pricePrev;
  const dailyLPFee = LP_APY / 365;
  const dailyBorrowCost = AAVE_BORROW_RATE / 365;
  const dailySupplyRate = AAVE_SUPPLY_RATE / 365;

  // Tighter range = more fees but more IL
  const rangeMult = 400 / Math.max(lpRangeTicks, 100); // tight range = higher mult
  const adjustedLPFee = dailyLPFee * Math.min(rangeMult, 4);
  const ilSeverity = 8 / Math.max(rangeMult, 0.5); // tighter = harsher IL
  const ilFactor = -(ethReturn ** 2) / ilSeverity;

  const lpReturn = adjustedLPFee + (ethReturn * 0.5) + ilFactor;
  const volDrag = (ethReturn ** 2) * 0.5;
  const longReturn = (ethReturn * 1.5) - (dailyBorrowCost * 0.5) - volDrag;
  const shortReturn = (-ethReturn * 0.65) + (dailySupplyRate * 0.5) - (dailyBorrowCost * 0.65) - volDrag;
  const holdReturn = dailySupplyRate;

  return (alloc.lp / 100) * Math.max(lpReturn, -0.5) +
         (alloc.long / 100) * Math.max(longReturn, -0.5) +
         (alloc.short / 100) * Math.max(shortReturn, -0.5) +
         (alloc.hold / 100) * holdReturn;
}

// ── Backtest a single vault config ──
function backtest(priceData, vault) {
  let value = 10000;
  let peak = value;
  let maxDD = 0;
  let rebalances = 0;
  let lastRebalDay = -999;
  let currentAlloc = { ...vault.brain_config };

  for (let i = 30; i < priceData.length; i++) {
    const prices = priceData.slice(0, i + 1).map(d => d.price);
    const today = priceData[i];
    const yesterday = priceData[i - 1];

    // Get target allocation
    let target;
    if (vault.brain_type === 'dynamic') {
      const regime = detectRegime(prices);
      target = REGIME_ALLOCS[regime];
    } else {
      target = vault.brain_config;
    }

    // Check rebalance
    const daysSince = i - lastRebalDay;
    const drift = Math.max(
      Math.abs(currentAlloc.lp - target.lp),
      Math.abs(currentAlloc.long - target.long),
      Math.abs(currentAlloc.short - target.short),
      Math.abs(currentAlloc.hold - target.hold)
    );
    if (drift >= DRIFT_THRESHOLD && daysSince >= REBALANCE_COOLDOWN_DAYS) {
      value -= value * (SWAP_COST_BPS / 10000) * REBALANCE_SWAPS;
      currentAlloc = { ...target };
      rebalances++;
      lastRebalDay = i;
    }

    // Daily return
    const ret = dailyReturn(currentAlloc, yesterday.price, today.price, currentAlloc.lp_range || 400);
    value *= (1 + ret);

    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const totalDays = priceData.length - 30;
  const totalReturn = (value - 10000) / 10000;
  const annualizedReturn = ((value / 10000) ** (365 / totalDays) - 1);
  const sharpe = totalDays > 0 ? (annualizedReturn / Math.max(maxDD, 0.01)) : 0;

  return {
    total_return_pct: +(totalReturn * 100).toFixed(2),
    annualized_apy: +(annualizedReturn * 100).toFixed(2),
    max_drawdown_pct: +(maxDD * 100).toFixed(2),
    sharpe_ratio: +sharpe.toFixed(2),
    rebalance_count: rebalances,
    final_value: +value.toFixed(2),
  };
}

// ── Fetch prices from Binance (no API key needed) ──
async function fetchPrices(days) {
  const interval = '1d';
  const limit = Math.min(days, 365);
  const url = `https://api.binance.com/api/v3/klines?symbol=ETHUSDC&interval=${interval}&limit=${limit}`;
  console.log(`Fetching ${limit} days of ETH/USDC price data from Binance...`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status}`);

  const data = await resp.json();
  return data.map(k => ({
    date: new Date(k[0]),
    price: parseFloat(k[4]) // close price
  }));
}

// ── Estimate current APY from brain config ──
// Based on current DeFi rates, not historical performance
function estimateAPY(brainConfig) {
  const lp = brainConfig.lp / 100;
  const long = brainConfig.long / 100;
  const short = brainConfig.short / 100;
  const hold = brainConfig.hold / 100;
  const lpRange = brainConfig.lp_range || 400;

  // Tighter LP range = higher fee APY (more concentrated = more fees per $)
  const rangeMult = Math.min(400 / Math.max(lpRange, 100), 4);
  const lpAPY = BASE_LP_APY * rangeMult;

  // Long: earns when ETH goes up. In a neutral market, net is roughly:
  // ETH staking/appreciation (~4-8%) * leverage(1.5x) - borrow cost(3.5%)
  // Conservative estimate: ~5% in neutral, higher in bull
  const longAPY = 0.05;

  // Short: profitable when ETH declines. In neutral market:
  // Supply rate on collateral (~3%) - borrow cost (~3.5%) = slightly negative
  // But shorts provide hedge value, estimate ~1% net in neutral
  const shortAPY = 0.01;

  // Hold: USDC supply rate on Aave
  const holdAPY = AAVE_SUPPLY_RATE;

  const grossAPY = (lp * lpAPY) + (long * longAPY) + (short * shortAPY) + (hold * holdAPY);
  return +(grossAPY * 100).toFixed(1);
}

// ── Main ──
async function main() {
  const priceData = await fetchPrices(180);
  console.log(`Got ${priceData.length} days. ETH: $${priceData[0].price.toFixed(0)} → $${priceData[priceData.length - 1].price.toFixed(0)}\n`);

  const results = [];

  for (const vault of VAULTS) {
    const perf = backtest(priceData, vault);
    const estAPY = estimateAPY(vault.brain_config);

    // Also backtest shorter periods for 7d and 30d returns
    const perf7d = priceData.length > 37 ? backtest(priceData.slice(-37), vault) : perf;
    const perf30d = priceData.length > 60 ? backtest(priceData.slice(-60), vault) : perf;

    console.log(`${vault.name.padEnd(22)} | Est APY: ${estAPY}%  | 7d: ${perf7d.total_return_pct}%  | 30d: ${perf30d.total_return_pct}%  | 180d: ${perf.total_return_pct}%  | Max DD: -${perf.max_drawdown_pct}%`);

    // Simulate TVL (random but weighted by strategy appeal)
    const baseTVL = vault.deposit_cap_usdc * (0.1 + Math.random() * 0.4);
    const depositors = Math.floor(3 + Math.random() * 25);

    const row = {
      vault_address: vault.manager_address,
      manager_address: vault.manager_address,
      name: vault.name,
      description: vault.description,
      brain_config: vault.brain_config,
      config_hash: '',
      performance_fee_bps: vault.performance_fee_bps,
      deposit_cap_usdc: vault.deposit_cap_usdc,
      manager_name: vault.manager_name,
      tvl_usdc: Math.round(baseTVL),
      estimated_apy: estAPY,
      total_return_pct: perf.total_return_pct,
      return_7d: perf7d.total_return_pct,
      return_30d: perf30d.total_return_pct,
      max_drawdown_pct: perf.max_drawdown_pct,
      sharpe_ratio: perf.sharpe_ratio,
      share_price: +(1 + perf.total_return_pct / 100).toFixed(6),
      alloc_lp_bps: vault.brain_config.lp * 100,
      alloc_long_bps: vault.brain_config.long * 100,
      alloc_short_bps: vault.brain_config.short * 100,
      alloc_hold_bps: vault.brain_config.hold * 100,
      depositor_count: depositors,
      rebalance_count: perf.rebalance_count,
      is_active: true,
      is_demo: true,
      updated_at: new Date().toISOString(),
    };

    results.push(row);
  }

  // Upsert all vaults
  console.log(`\nUpserting ${results.length} vaults to Supabase...`);
  const { data, error } = await supabase
    .from('vault_marketplace')
    .upsert(results, { onConflict: 'vault_address' })
    .select();

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  console.log(`Done! ${data.length} vaults seeded.`);

  // Also insert some snapshots for each vault (last 7 days)
  console.log('\nSeeding 7-day snapshot history...');
  const snapshots = [];
  for (const vault of results) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      // Simulate gradual growth to current return
      const dayFrac = (7 - d) / 7;
      const dailyReturn = vault.total_return_pct * dayFrac;
      snapshots.push({
        vault_address: vault.vault_address,
        snapshot_date: date.toISOString().slice(0, 10),
        tvl_usdc: Math.round(vault.tvl_usdc * (0.85 + dayFrac * 0.15)),
        share_price: +(1 + dailyReturn / 100).toFixed(6),
        total_return_pct: +dailyReturn.toFixed(2),
        eth_price: priceData[priceData.length - 1 - d]?.price || priceData[priceData.length - 1].price,
      });
    }
  }

  const { error: snapErr } = await supabase
    .from('vault_snapshots')
    .upsert(snapshots, { onConflict: 'vault_address,snapshot_date' });

  if (snapErr) console.error('Snapshot error:', snapErr);
  else console.log(`${snapshots.length} snapshots inserted.`);

  console.log('\n✓ Marketplace seeded. Visit basisubi.com to see vaults.');
}

main().catch(e => { console.error(e); process.exit(1); });
