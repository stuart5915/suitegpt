// Inclawbate — Perpetual Futures via Synthetix Perps v3 on Base
// Supports long/short any market with USDC margin

const BASE_RPC = 'https://mainnet.base.org';
const BASE_CHAIN_ID = 8453;

// Synthetix v3 Contracts (Base Andromeda)
const PERPS_MARKET_PROXY = '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce';
const SPOT_MARKET_PROXY = '0x18141523403e2595D31b22604AcB8Fc06a4CaA61';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Synth collateral IDs
const SUSD_COLLATERAL_ID = 0;
const SUSDC_COLLATERAL_ID = 1;

// Market IDs
const MARKETS = {
  eth: { id: 100, symbol: 'ETH', decimals: 18 },
  btc: { id: 200, symbol: 'BTC', decimals: 18 },
  sol: { id: 400, symbol: 'SOL', decimals: 18 },
  doge: { id: 800, symbol: 'DOGE', decimals: 18 },
  avax: { id: 900, symbol: 'AVAX', decimals: 18 },
  op: { id: 1000, symbol: 'OP', decimals: 18 },
  pepe: { id: 1200, symbol: 'PEPE', decimals: 18 },
  arb: { id: 1600, symbol: 'ARB', decimals: 18 },
  bnb: { id: 1800, symbol: 'BNB', decimals: 18 },
  link: { id: 1900, symbol: 'LINK', decimals: 18 },
  sui: { id: 2400, symbol: 'SUI', decimals: 18 },
  aave: { id: 3300, symbol: 'AAVE', decimals: 18 },
  ada: { id: 3400, symbol: 'ADA', decimals: 18 },
  apt: { id: 3600, symbol: 'APT', decimals: 18 },
  atom: { id: 3700, symbol: 'ATOM', decimals: 18 },
  dot: { id: 4300, symbol: 'DOT', decimals: 18 },
  fil: { id: 4900, symbol: 'FIL', decimals: 18 },
  snx: { id: 300, symbol: 'SNX', decimals: 18 },
};

function resolveMarket(input) {
  if (!input) return null;
  const lower = input.toLowerCase().replace(/[^a-z]/g, '').replace(/perp$/, '');
  return MARKETS[lower] || null;
}

function pad256(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function toHex256(n) { return BigInt(n).toString(16).padStart(64, '0'); }
function toInt128Hex(n) {
  const bi = BigInt(n);
  if (bi >= 0n) return bi.toString(16).padStart(64, '0');
  // Two's complement for negative
  return ((1n << 256n) + bi).toString(16).slice(-64);
}

async function rpcCall(to, data) {
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 })
    });
    const json = await res.json();
    return json.result || '0x0';
  } catch (e) { return '0x0'; }
}

// Get market index price
async function getMarketPrice(marketId) {
  // indexPrice(uint128 marketId) → 0xf14cae4b
  const data = '0xf14cae4b' + toHex256(marketId);
  const hex = await rpcCall(PERPS_MARKET_PROXY, data);
  return Number(BigInt(hex)) / 1e18;
}

// Get market summary (skew, size, funding rate, price)
async function getMarketSummary(marketId) {
  // Use batch call for price + funding rate
  const batch = [
    { jsonrpc: '2.0', method: 'eth_call', params: [{ to: PERPS_MARKET_PROXY, data: '0xf14cae4b' + toHex256(marketId) }, 'latest'], id: 1 },
    { jsonrpc: '2.0', method: 'eth_call', params: [{ to: PERPS_MARKET_PROXY, data: '0xd2120e52' + toHex256(marketId) }, 'latest'], id: 2 }, // currentFundingRate
  ];
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    const results = await res.json();
    results.sort((a, b) => a.id - b.id);
    const price = Number(BigInt(results[0].result || '0x0')) / 1e18;
    const rawFunding = results[1].result || '0x0';
    // Funding rate is int256
    let funding = Number(BigInt(rawFunding)) / 1e18;
    if (funding > 1e15) funding = (Number(BigInt(rawFunding) - (1n << 256n))) / 1e18; // handle negative
    return { price, fundingRate: funding };
  } catch (e) {
    return { price: 0, fundingRate: 0 };
  }
}

// Get open position for an account
async function getPosition(accountId, marketId) {
  // getOpenPosition(uint128 accountId, uint128 marketId) → 0x22a73967
  const data = '0x22a73967' + toHex256(accountId) + toHex256(marketId);
  const hex = await rpcCall(PERPS_MARKET_PROXY, data);
  if (!hex || hex === '0x0' || hex.length < 10) return null;
  // Returns: (int256 totalPnl, int256 accruedFunding, int128 positionSize, uint256 owedInterest)
  const chunks = hex.replace('0x', '').match(/.{64}/g) || [];
  if (chunks.length < 4) return null;
  const pnl = Number(BigInt('0x' + chunks[0])) / 1e18;
  const funding = Number(BigInt('0x' + chunks[1])) / 1e18;
  const sizeRaw = BigInt('0x' + chunks[2]);
  const size = sizeRaw > (1n << 127n) ? Number(sizeRaw - (1n << 256n)) / 1e18 : Number(sizeRaw) / 1e18;
  return { pnl, funding, size, owedInterest: Number(BigInt('0x' + chunks[3])) / 1e18 };
}

function formatAmount(n) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (Math.abs(n) < 0.001 && n !== 0) return n.toFixed(6);
  return n.toFixed(2);
}

function formatUsd(n) { return '$' + formatAmount(Math.abs(n)); }

// ── Get Perps Market Info ──

export async function getPerpsMarkets() {
  const popular = ['eth', 'btc', 'sol', 'link', 'doge', 'pepe', 'arb', 'op', 'sui', 'bnb'];
  const results = [];

  // Batch price calls
  const batch = popular.map((sym, i) => ({
    jsonrpc: '2.0', method: 'eth_call',
    params: [{ to: PERPS_MARKET_PROXY, data: '0xf14cae4b' + toHex256(MARKETS[sym].id) }, 'latest'],
    id: i + 1
  }));

  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    const data = await res.json();
    data.sort((a, b) => a.id - b.id);

    for (let i = 0; i < popular.length; i++) {
      const sym = popular[i];
      const market = MARKETS[sym];
      const price = Number(BigInt(data[i].result || '0x0')) / 1e18;
      results.push({ symbol: market.symbol, marketId: market.id, price: formatUsd(price) });
    }
  } catch (e) {
    for (const sym of popular) {
      results.push({ symbol: MARKETS[sym].symbol, marketId: MARKETS[sym].id, price: '—' });
    }
  }

  return { success: true, markets: results, count: Object.keys(MARKETS).length };
}

// ── Open a Perps Position ──

export async function openPerpPosition({ market, direction, margin, leverage, wallet }) {
  const m = resolveMarket(market);
  if (!m) return { error: `Unknown market: "${market}". Available: ${Object.values(MARKETS).map(v => v.symbol).join(', ')}` };
  if (!wallet) return { error: 'Connect your wallet first.' };
  if (!direction || !['long', 'short'].includes(direction.toLowerCase())) return { error: 'Specify direction: long or short.' };
  if (!margin || parseFloat(margin) <= 0) return { error: 'How much USDC margin do you want to use?' };

  const lev = parseFloat(leverage) || 1;
  if (lev < 1 || lev > 50) return { error: 'Leverage must be between 1x and 50x.' };

  const marginUsd = parseFloat(margin);
  const isLong = direction.toLowerCase() === 'long';

  // Get current price
  const { price, fundingRate } = await getMarketSummary(m.id);
  if (price <= 0) return { error: 'Could not fetch market price. Try again.' };

  // Calculate position size in asset units
  const notional = marginUsd * lev;
  const sizeInAsset = notional / price;
  const sizeDelta = isLong ? sizeInAsset : -sizeInAsset;

  // Estimate liquidation price (simplified: margin / size ± entry)
  const liqDistance = marginUsd / Math.abs(sizeInAsset);
  const liqPrice = isLong ? price - liqDistance * 0.9 : price + liqDistance * 0.9;

  // Compute fees
  // computeOrderFees(uint128 marketId, int128 sizeDelta) → 0xf65a7905
  const sizeWei = BigInt(Math.round(Math.abs(sizeInAsset) * 1e18));
  const sizeDeltaHex = isLong ? toHex256(sizeWei) : toInt128Hex(-sizeWei);
  let fees = 0;
  try {
    const feeData = '0xf65a7905' + toHex256(m.id) + sizeDeltaHex;
    const feeHex = await rpcCall(PERPS_MARKET_PROXY, feeData);
    if (feeHex && feeHex.length > 10) {
      const chunks = feeHex.replace('0x', '').match(/.{64}/g) || [];
      fees = Number(BigInt('0x' + chunks[0])) / 1e18;
    }
  } catch (e) { fees = notional * 0.0006; } // fallback: ~6bps

  // Build transaction steps:
  // 1. Approve USDC on SpotMarketProxy (for wrapping)
  // 2. The actual perps flow requires: createAccount → wrap USDC → deposit margin → commitOrder
  // For simplicity, we return a summary and let the user proceed
  // Full multi-step tx would be complex — start with the info + confirmation

  return {
    success: true,
    market: m.symbol,
    direction: isLong ? 'Long' : 'Short',
    margin: formatUsd(marginUsd),
    leverage: lev + 'x',
    notional: formatUsd(notional),
    entryPrice: formatUsd(price),
    size: formatAmount(Math.abs(sizeInAsset)) + ' ' + m.symbol,
    liqPrice: formatUsd(liqPrice),
    fees: formatUsd(fees),
    fundingRate: (fundingRate * 100).toFixed(4) + '%/hr',
    // Note: full tx execution requires multi-step (account creation, USDC wrapping, margin deposit, order commit)
    // For v1, we provide the info and link to Kwenta for execution
    kwentaLink: `https://kwenta.eth.limo/market/?asset=${m.symbol}&accountType=cross_margin`,
    needsMultiTx: true,
  };
}

// ── Get User's Perps Positions ──

export async function getPerpsPositions({ wallet }) {
  if (!wallet) return { error: 'Connect your wallet first.' };

  // For v1, return market info — full position tracking requires knowing the user's accountId
  // which requires checking PerpsAccountProxy NFT ownership
  return {
    success: true,
    message: 'Perps position tracking coming soon. For now, check your positions on Kwenta.',
    kwentaLink: 'https://kwenta.eth.limo/dashboard/markets/',
  };
}

// List available markets for display
export function listPerpsMarkets() {
  return Object.values(MARKETS).map(m => ({ symbol: m.symbol, marketId: m.id }));
}
