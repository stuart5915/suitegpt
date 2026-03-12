/**
 * Basis Auto Vault — Backtester
 *
 * Fetches historical ETH prices from CoinGecko, runs the brain logic
 * day-by-day, simulates vault performance, and outputs results.
 *
 * Usage:  node backtest.js [days]
 * Default: 365 days
 */

import { decide, shouldRebalance } from './brain.js';

// ── Config ──

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/ethereum/market_chart';
const REBALANCE_COOLDOWN_DAYS = 0.167; // ~4 hours
const DRIFT_THRESHOLD = 10;            // 10% drift before rebalance
const LP_APY = 0.15;                   // 15% base APY for concentrated LP fees (conservative)
const AAVE_BORROW_RATE = 0.035;        // 3.5% annual borrow cost on Aave
const AAVE_SUPPLY_RATE = 0.03;         // 3% USDC supply rate
const SWAP_COST_BPS = 5;               // 0.05% per swap (very low on Base)
const REBALANCE_SWAPS = 4;             // avg swaps per rebalance

// ── Fetch Historical Prices ──

async function fetchPrices(days) {
  const url = `${COINGECKO_URL}?vs_currency=usd&days=${days}&interval=daily`;
  console.log(`Fetching ${days} days of ETH price data...`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CoinGecko API error: ${resp.status}`);

  const data = await resp.json();
  // data.prices = [[timestamp, price], ...]
  return data.prices.map(([ts, price]) => ({
    date: new Date(ts),
    price
  }));
}

// ── Simulate Position Returns ──
// Models real-world DeFi: leverage is rebalanced daily (like actual Aave positions),
// LP has impermanent loss, fees are realistic, borrow costs compound.

function dailyReturn(allocation, pricePrev, priceNow) {
  const ethReturn = (priceNow - pricePrev) / pricePrev;
  const dailyLPFee = LP_APY / 365;
  const dailyBorrowCost = AAVE_BORROW_RATE / 365;
  const dailySupplyRate = AAVE_SUPPLY_RATE / 365;

  // LP: earns fees + has ~50% ETH exposure
  // Concentrated LP IL is harsher: approximated as IL ≈ -(ethReturn^2) / 8
  // for a ±5% range (tighter range = more IL per price move)
  const ilFactor = -(ethReturn ** 2) / 8;
  const lpReturn = dailyLPFee + (ethReturn * 0.5) + ilFactor;

  // 2x Long via Aave:
  // Supply ETH, borrow USDC at ~50% LTV, buy more ETH
  // Effective leverage: ~1.5x (80% LTV * safe margin)
  // Volatility drag: daily rebalanced leverage loses on whipsaw
  const volDrag = (ethReturn ** 2) * 0.5; // leverage volatility cost
  const longReturn = (ethReturn * 1.5) - (dailyBorrowCost * 0.5) - volDrag;

  // 2x Short via Aave:
  // Supply USDC, borrow ETH at ~65% LTV, sell ETH
  // Effective short exposure: ~0.65x
  const shortReturn = (-ethReturn * 0.65) + (dailySupplyRate * 0.5) - (dailyBorrowCost * 0.65) - volDrag;

  // Hold: USDC, earns supply rate
  const holdReturn = dailySupplyRate;

  // Clamp: no position can lose more than 50% in a day (liquidation protection)
  const clampedLP = Math.max(lpReturn, -0.5);
  const clampedLong = Math.max(longReturn, -0.5);
  const clampedShort = Math.max(shortReturn, -0.5);

  // Weighted return
  const weightedReturn =
    (allocation.lp / 100) * clampedLP +
    (allocation.long / 100) * clampedLong +
    (allocation.short / 100) * clampedShort +
    (allocation.hold / 100) * holdReturn;

  return {
    total: weightedReturn,
    breakdown: {
      lp: clampedLP,
      long: clampedLong,
      short: clampedShort,
      hold: holdReturn
    }
  };
}

// ── Run Backtest ──

async function runBacktest(days = 365) {
  const priceData = await fetchPrices(days);
  if (priceData.length < 31) {
    console.error('Not enough price data. Need at least 31 days.');
    return;
  }

  console.log(`\nRunning backtest: ${priceData.length} days of ETH data`);
  console.log(`Start: ${priceData[0].date.toISOString().slice(0, 10)} @ $${priceData[0].price.toFixed(2)}`);
  console.log(`End:   ${priceData[priceData.length - 1].date.toISOString().slice(0, 10)} @ $${priceData[priceData.length - 1].price.toFixed(2)}`);
  console.log('─'.repeat(90));

  // Starting state
  let vaultValue = 10000; // $10,000 starting
  let ethHoldValue = 10000; // benchmark: just hold ETH
  let usdcHoldValue = 10000; // benchmark: just hold USDC
  const startEthPrice = priceData[0].price;
  const ethUnits = ethHoldValue / startEthPrice;

  let currentAllocation = { lp: 0, long: 0, short: 0, hold: 100 };
  let rebalanceCount = 0;
  let lastRebalanceDay = -999;
  let peakValue = vaultValue;
  let maxDrawdown = 0;
  let totalSwapCosts = 0;

  const dailyLog = [];
  const regimeCounts = {};

  // Process each day
  for (let i = 30; i < priceData.length; i++) {
    const priceHistory = priceData.slice(0, i + 1).map(d => d.price);
    const today = priceData[i];
    const yesterday = priceData[i - 1];

    // Brain decides
    const decision = decide(priceHistory);
    const target = { lp: decision.lp, long: decision.long, short: decision.short, hold: decision.hold };

    // Track regime
    regimeCounts[decision.regime] = (regimeCounts[decision.regime] || 0) + 1;

    // Check if rebalance needed
    const daysSinceRebalance = i - lastRebalanceDay;
    if (shouldRebalance(currentAllocation, target, DRIFT_THRESHOLD) &&
        daysSinceRebalance >= REBALANCE_COOLDOWN_DAYS) {
      // Apply swap costs (scales with current vault value)
      const rebalanceCost = vaultValue * (SWAP_COST_BPS / 10000) * REBALANCE_SWAPS;
      vaultValue -= rebalanceCost;
      totalSwapCosts += rebalanceCost;
      currentAllocation = { ...target };
      rebalanceCount++;
      lastRebalanceDay = i;
    }

    // Calculate daily return
    const ret = dailyReturn(currentAllocation, yesterday.price, today.price);
    vaultValue *= (1 + ret.total);

    // Benchmarks
    ethHoldValue = ethUnits * today.price;
    usdcHoldValue = 10000 * (1 + AAVE_SUPPLY_RATE * (i / 365)); // simple interest

    // Track drawdown
    if (vaultValue > peakValue) peakValue = vaultValue;
    const drawdown = (peakValue - vaultValue) / peakValue;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Circuit breaker check (informational)
    const circuitBreaker = drawdown > 0.15;

    dailyLog.push({
      date: today.date.toISOString().slice(0, 10),
      price: today.price,
      regime: decision.regime,
      allocation: { ...currentAllocation },
      vaultValue,
      ethHoldValue,
      return: ret.total,
      drawdown,
      circuitBreaker
    });
  }

  // ── Output Results ──

  console.log('\n' + '═'.repeat(90));
  console.log('  BACKTEST RESULTS');
  console.log('═'.repeat(90));

  const finalVault = dailyLog[dailyLog.length - 1].vaultValue;
  const finalEth = dailyLog[dailyLog.length - 1].ethHoldValue;
  const finalUsdc = usdcHoldValue;

  const vaultReturn = ((finalVault - 10000) / 10000 * 100);
  const ethReturn = ((finalEth - 10000) / 10000 * 100);
  const usdcReturn = ((finalUsdc - 10000) / 10000 * 100);

  console.log(`\n  Strategy         Final Value     Return`);
  console.log(`  ─────────────    ──────────      ──────`);
  console.log(`  Auto Vault       $${finalVault.toFixed(2).padStart(10)}    ${vaultReturn >= 0 ? '+' : ''}${vaultReturn.toFixed(2)}%`);
  console.log(`  Hold ETH         $${finalEth.toFixed(2).padStart(10)}    ${ethReturn >= 0 ? '+' : ''}${ethReturn.toFixed(2)}%`);
  console.log(`  Hold USDC        $${finalUsdc.toFixed(2).padStart(10)}    ${usdcReturn >= 0 ? '+' : ''}${usdcReturn.toFixed(2)}%`);

  console.log(`\n  Max Drawdown:    ${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Rebalances:      ${rebalanceCount}`);
  console.log(`  Swap Costs:      ~$${totalSwapCosts.toFixed(2)}`);

  console.log(`\n  Regime Distribution:`);
  const totalDays = Object.values(regimeCounts).reduce((a, b) => a + b, 0);
  for (const [regime, count] of Object.entries(regimeCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / totalDays * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / totalDays * 30));
    console.log(`    ${regime.padEnd(22)} ${String(count).padStart(4)} days (${pct.padStart(5)}%)  ${bar}`);
  }

  // Show monthly summary
  console.log(`\n  Monthly Breakdown:`);
  console.log(`  ${'Month'.padEnd(12)} ${'ETH Price'.padStart(10)} ${'Vault'.padStart(10)} ${'ETH Hold'.padStart(10)} ${'Regime'.padStart(22)}`);
  console.log(`  ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(22)}`);

  let lastMonth = '';
  for (const day of dailyLog) {
    const month = day.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      console.log(`  ${month.padEnd(12)} $${day.price.toFixed(0).padStart(9)} $${day.vaultValue.toFixed(0).padStart(9)} $${day.ethHoldValue.toFixed(0).padStart(9)} ${day.regime.padStart(22)}`);
    }
  }

  // Outperformance
  console.log('\n' + '═'.repeat(90));
  const vsEth = vaultReturn - ethReturn;
  const vsUsdc = vaultReturn - usdcReturn;
  console.log(`  vs Hold ETH:   ${vsEth >= 0 ? '+' : ''}${vsEth.toFixed(2)}%`);
  console.log(`  vs Hold USDC:  ${vsUsdc >= 0 ? '+' : ''}${vsUsdc.toFixed(2)}%`);
  console.log('═'.repeat(90));

  return { dailyLog, vaultReturn, ethReturn, maxDrawdown, rebalanceCount, regimeCounts };
}

// ── Main ──

const days = parseInt(process.argv[2]) || 365;
runBacktest(days).catch(err => {
  console.error('Backtest failed:', err.message);
  process.exit(1);
});
