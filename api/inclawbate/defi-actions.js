// Inclawbate — DeFi Actions
// Swap tokens, stake, lend — returns raw tx data for user to sign in browser

const BASE_CHAIN_ID = 8453;

// Common token addresses on Base
const TOKENS = {
  eth:   { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, symbol: 'ETH' },
  weth:  { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
  usdc:  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC' },
  claws: { address: '0x7ca47B141639B893C6782823C0b219f872056379', decimals: 18, symbol: 'CLAWS' },
  pokerai: { address: '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07', decimals: 18, symbol: 'POKERAI' },
};

// Resolve token symbol or address to { address, decimals, symbol }
function resolveToken(input) {
  if (!input) return null;
  const lower = input.toLowerCase().replace(/^\$/, '');

  // Check known symbols
  if (TOKENS[lower]) return TOKENS[lower];

  // Check if it's an address
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
    // Check if it matches a known token
    for (const t of Object.values(TOKENS)) {
      if (t.address.toLowerCase() === input.toLowerCase()) return t;
    }
    // Unknown token — assume 18 decimals (most common)
    return { address: input, decimals: 18, symbol: input.slice(0, 6) + '...' };
  }

  return null;
}

// Format token amount for display (human-readable)
function formatAmount(rawAmount, decimals) {
  const num = Number(rawAmount) / (10 ** decimals);
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  if (num < 0.001) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  return num.toFixed(2);
}

// Parse human amount to raw wei string
function parseAmount(amount, decimals) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return null;
  // Use string math to avoid floating point issues
  const factor = BigInt(10 ** decimals);
  const whole = BigInt(Math.floor(num));
  const fracStr = (num % 1).toFixed(decimals).slice(2);
  const frac = BigInt(fracStr.slice(0, decimals).padEnd(decimals, '0'));
  return (whole * factor + frac).toString();
}

// ── ParaSwap Integration ──

const PARASWAP_API = 'https://apiv5.paraswap.io';

export async function getSwapQuote({ fromToken, toToken, amount, wallet }) {
  const src = resolveToken(fromToken);
  const dest = resolveToken(toToken);

  if (!src) return { error: `Unknown token: ${fromToken}. Try using the contract address.` };
  if (!dest) return { error: `Unknown token: ${toToken}. Try using the contract address.` };
  if (!wallet) return { error: 'I need your wallet address to build the swap. Connect your wallet or share your address.' };

  const rawAmount = parseAmount(amount, src.decimals);
  if (!rawAmount) return { error: `Invalid amount: ${amount}` };

  try {
    // Step 1: Get price quote
    const priceUrl = `${PARASWAP_API}/prices?` + new URLSearchParams({
      srcToken: src.address,
      destToken: dest.address,
      amount: rawAmount,
      srcDecimals: src.decimals,
      destDecimals: dest.decimals,
      side: 'SELL',
      network: BASE_CHAIN_ID,
      excludeDEXS: '',
    });

    const priceResp = await fetch(priceUrl);
    const priceData = await priceResp.json();

    if (priceData.error) {
      return { error: priceData.error || 'Failed to get swap quote. The pair may not have enough liquidity.' };
    }

    const priceRoute = priceData.priceRoute;
    if (!priceRoute) return { error: 'No route found for this swap. Try a different pair or amount.' };

    const destAmount = priceRoute.destAmount;
    const gasCostUSD = priceRoute.gasCostUSD || '0.01';

    // Step 2: Build transaction
    const txResp = await fetch(`${PARASWAP_API}/transactions/${BASE_CHAIN_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken: src.address,
        destToken: dest.address,
        srcAmount: rawAmount,
        destAmount,
        slippage: 150, // 1.5%
        userAddress: wallet,
        priceRoute,
        partner: 'inclawbate',
      }),
    });

    const txData = await txResp.json();

    if (txData.error) {
      return { error: txData.error || 'Failed to build swap transaction.' };
    }

    return {
      success: true,
      fromToken: src.symbol,
      toToken: dest.symbol,
      fromAmount: formatAmount(rawAmount, src.decimals),
      toAmount: formatAmount(destAmount, dest.decimals),
      toAmountRaw: destAmount,
      gasCostUSD,
      slippage: '1.5%',
      tx: {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0',
        chainId: BASE_CHAIN_ID,
        from: wallet,
      },
    };
  } catch (e) {
    console.error('Swap quote error:', e);
    return { error: 'Failed to get swap quote: ' + e.message };
  }
}

// ── CLAWS Staking ──

const CLAWS_STAKING = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';

// ERC-20 approve(address spender, uint256 amount)
function buildApproveTx(tokenAddress, spender, amount, wallet) {
  const amountHex = BigInt(amount).toString(16).padStart(64, '0');
  const spenderPadded = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  return {
    to: tokenAddress,
    data: '0x095ea7b3' + spenderPadded + amountHex,
    value: '0',
    chainId: BASE_CHAIN_ID,
    from: wallet,
  };
}

// stake(uint256 amount) — function selector: 0xa694fc3a
function buildStakeTx(amount, wallet) {
  const amountHex = BigInt(amount).toString(16).padStart(64, '0');
  return {
    to: CLAWS_STAKING,
    data: '0xa694fc3a' + amountHex,
    value: '0',
    chainId: BASE_CHAIN_ID,
    from: wallet,
  };
}

// withdraw(uint256 amount) — function selector: 0x2e1a7d4d
function buildUnstakeTx(amount, wallet) {
  const amountHex = BigInt(amount).toString(16).padStart(64, '0');
  return {
    to: CLAWS_STAKING,
    data: '0x2e1a7d4d' + amountHex,
    value: '0',
    chainId: BASE_CHAIN_ID,
    from: wallet,
  };
}

// getReward() — function selector: 0x3d18b912
function buildClaimRewardsTx(wallet) {
  return {
    to: CLAWS_STAKING,
    data: '0x3d18b912',
    value: '0',
    chainId: BASE_CHAIN_ID,
    from: wallet,
  };
}

export async function stakeClaws({ amount, wallet }) {
  if (!wallet) return { error: 'I need your wallet address to stake. Connect your wallet.' };
  if (!amount) return { error: 'How much CLAWS do you want to stake?' };

  const rawAmount = parseAmount(amount, 18);
  if (!rawAmount) return { error: `Invalid amount: ${amount}` };

  return {
    success: true,
    action: 'stake',
    amount: formatAmount(rawAmount, 18),
    symbol: 'CLAWS',
    // Two transactions: approve then stake
    txs: [
      { label: 'Approve CLAWS', tx: buildApproveTx(CLAWS_ADDRESS, CLAWS_STAKING, rawAmount, wallet) },
      { label: 'Stake CLAWS', tx: buildStakeTx(rawAmount, wallet) },
    ],
  };
}

export async function unstakeClaws({ amount, wallet }) {
  if (!wallet) return { error: 'I need your wallet address. Connect your wallet.' };
  if (!amount) return { error: 'How much CLAWS do you want to unstake?' };

  const rawAmount = parseAmount(amount, 18);
  if (!rawAmount) return { error: `Invalid amount: ${amount}` };

  return {
    success: true,
    action: 'unstake',
    amount: formatAmount(rawAmount, 18),
    symbol: 'CLAWS',
    txs: [
      { label: 'Unstake CLAWS', tx: buildUnstakeTx(rawAmount, wallet) },
    ],
  };
}

export async function claimStakingRewards({ wallet }) {
  if (!wallet) return { error: 'I need your wallet address. Connect your wallet.' };

  return {
    success: true,
    action: 'claim',
    txs: [
      { label: 'Claim CLAWS Rewards', tx: buildClaimRewardsTx(wallet) },
    ],
  };
}
