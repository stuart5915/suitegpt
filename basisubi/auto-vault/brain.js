/**
 * Basis Auto Vault — Brain Logic
 *
 * Pure function: takes price history in, outputs allocation decision.
 * No side effects, no network calls. Used by both backtester and live keeper.
 *
 * Regime detection → allocation targets → rebalance decision.
 */

// ── Allocation Targets per Regime ──

const REGIMES = {
  STRONG_UP: {
    name: 'Strong Uptrend',
    lp: 25, long: 60, short: 0, hold: 15,
    lpRange: 400    // ±2% tight range (calm market = max fee capture)
  },
  RANGING: {
    name: 'Ranging / Mild Up',
    lp: 55, long: 20, short: 5, hold: 20,
    lpRange: 600    // ±3% moderate range
  },
  HIGH_VOL: {
    name: 'High Volatility',
    lp: 25, long: 12, short: 13, hold: 50,
    lpRange: 1600   // ±8% wide range (stay in range during swings)
  },
  STRONG_DOWN: {
    name: 'Strong Downtrend',
    lp: 15, long: 5, short: 50, hold: 30,
    lpRange: 800    // ±4% moderate-wide
  }
};

// ── Helper: Simple Moving Average ──

function sma(prices, period) {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── Helper: Rolling Volatility (annualized std dev of daily returns) ──

function volatility(prices, period) {
  if (prices.length < period + 1) return 0;
  const slice = prices.slice(-(period + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  return dailyVol * Math.sqrt(365); // annualized
}

// ── Helper: Momentum Score ──
// Weighted sum of recent daily returns. Positive = bullish, negative = bearish.

function momentum(prices, period) {
  if (prices.length < period + 1) return 0;
  const slice = prices.slice(-(period + 1));
  let score = 0;
  for (let i = 1; i < slice.length; i++) {
    const ret = (slice[i] - slice[i - 1]) / slice[i - 1];
    // More recent days weighted higher
    const weight = i / slice.length;
    score += ret * weight;
  }
  return score;
}

// ── Core: Detect Market Regime ──

function detectRegime(prices) {
  const price = prices[prices.length - 1];
  const sma7 = sma(prices, 7);
  const sma30 = sma(prices, 30);
  const vol = volatility(prices, 14);
  const mom = momentum(prices, 7);

  // High volatility overrides trend signals
  // annualized vol > 80% = very volatile
  if (vol > 0.80) {
    return {
      regime: REGIMES.HIGH_VOL,
      signals: { price, sma7, sma30, vol, mom, reason: 'vol > 80% annualized' }
    };
  }

  // Strong uptrend: price above both MAs, MAs aligned up, positive momentum
  if (price > sma7 && sma7 > sma30 && mom > 0.005) {
    return {
      regime: REGIMES.STRONG_UP,
      signals: { price, sma7, sma30, vol, mom, reason: 'price > 7d > 30d, mom > 0.5%' }
    };
  }

  // Strong downtrend: price below both MAs, MAs aligned down, negative momentum
  if (price < sma7 && sma7 < sma30 && mom < -0.005) {
    return {
      regime: REGIMES.STRONG_DOWN,
      signals: { price, sma7, sma30, vol, mom, reason: 'price < 7d < 30d, mom < -0.5%' }
    };
  }

  // Default: ranging / mild up
  return {
    regime: REGIMES.RANGING,
    signals: { price, sma7, sma30, vol, mom, reason: 'no strong signal — ranging' }
  };
}

// ── Core: Decide Allocation ──
// Returns { lp, long, short, hold, lpRange, regime, signals }

function decide(priceHistory) {
  if (!priceHistory || priceHistory.length < 7) {
    // Not enough data — stay in hold
    return {
      lp: 0, long: 0, short: 0, hold: 100,
      lpRange: 800,
      regime: 'Insufficient Data',
      signals: {}
    };
  }

  const { regime, signals } = detectRegime(priceHistory);

  return {
    lp: regime.lp,
    long: regime.long,
    short: regime.short,
    hold: regime.hold,
    lpRange: regime.lpRange,
    regime: regime.name,
    signals
  };
}

// ── Core: Should Rebalance? ──
// Compares current allocation to target. Returns true if any position drifted > threshold.

function shouldRebalance(current, target, driftThresholdPct = 10) {
  const drift = Math.max(
    Math.abs(current.lp - target.lp),
    Math.abs(current.long - target.long),
    Math.abs(current.short - target.short),
    Math.abs(current.hold - target.hold)
  );
  return drift >= driftThresholdPct;
}

export {
  REGIMES,
  sma,
  volatility,
  momentum,
  detectRegime,
  decide,
  shouldRebalance
};
