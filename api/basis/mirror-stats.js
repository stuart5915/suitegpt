import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RPC = 'https://mainnet.base.org';
const FACTORY = '0x27615125c72E1dBB707644051F6A0E4c175bC3B2';
const NPM = '0x827922686190790b37229fd06084350E74485b72';
const POOL = '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59';
const GAUGE = '0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8';

const VAULT_ABI = [
  'function getVaultInfo() view returns (uint256 _totalAssets, uint256 _totalSupply, int24 _tickLower, int24 _tickUpper, int24 _trackedTickLower, int24 _trackedTickUpper, bool _inRange, bool _needsMirror, address _trackedWallet, uint256 _trackedTokenId, uint256 _mirrorCount, uint256 _depositCap, uint256 _performanceFeeBps, bool _paused)',
  'function trackedWallet() view returns (address)',
  'function trackedTokenId() view returns (uint256)',
  'function tokenId() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function mirrorCount() view returns (uint256)',
  'function isInRange() view returns (bool)',
  'function needsMirror() view returns (bool)',
  'function currentTickLower() view returns (int24)',
  'function currentTickUpper() view returns (int24)',
  'function trackedTickLower() view returns (int24)',
  'function trackedTickUpper() view returns (int24)',
  'function depositCap() view returns (uint256)',
  'function performanceFeeBps() view returns (uint256)',
  'function paused() view returns (bool)'
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)'
];

const NPM_ABI = [
  'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// WETH is token0 on Base
function tickToPrice(tick) {
  return Math.pow(1.0001, tick) * 1e12;
}

function sqrtPriceToEthUsd(sqrtPriceX96) {
  const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
  const ratio = sqrtPrice * sqrtPrice;
  return ratio * 1e12; // WETH is token0
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const pool = new ethers.Contract(POOL, POOL_ABI, provider);
    const npm = new ethers.Contract(NPM, NPM_ABI, provider);

    // Get current ETH price from pool
    const slot0 = await pool.slot0();
    const ethPrice = sqrtPriceToEthUsd(slot0.sqrtPriceX96);
    const currentTick = Number(slot0.tick);

    // Get all active vaults from Supabase
    const { data: vaults, error: fetchErr } = await supabase
      .from('mirror_vault_marketplace')
      .select('*')
      .eq('is_active', true);

    if (fetchErr) throw fetchErr;
    if (!vaults || vaults.length === 0) {
      return res.status(200).json({ ok: true, message: 'No vaults to refresh', ethPrice: ethPrice.toFixed(2) });
    }

    const results = [];

    for (const v of vaults) {
      try {
        const vaultContract = new ethers.Contract(v.vault_address, VAULT_ABI, provider);
        const usdcContract = new ethers.Contract(USDC, USDC_ABI, provider);

        // Read vault state — try getVaultInfo first, fall back to individual calls
        let totalAssets, totalSupply, inRange, needsMirror, mirrorCount;
        let trackedWallet, trackedTokenId;
        let trackedTickLower, trackedTickUpper;
        let vaultTickLower, vaultTickUpper;

        try {
          const info = await vaultContract.getVaultInfo();
          totalAssets = info._totalAssets;
          totalSupply = info._totalSupply;
          inRange = info._inRange;
          needsMirror = info._needsMirror;
          mirrorCount = Number(info._mirrorCount);
          trackedWallet = info._trackedWallet;
          trackedTokenId = info._trackedTokenId;
          trackedTickLower = Number(info._trackedTickLower);
          trackedTickUpper = Number(info._trackedTickUpper);
          vaultTickLower = Number(info._tickLower);
          vaultTickUpper = Number(info._tickUpper);
        } catch (e) {
          // Fallback to individual calls
          totalAssets = await vaultContract.totalAssets().catch(() => 0n);
          totalSupply = await vaultContract.totalSupply().catch(() => 0n);
          mirrorCount = Number(await vaultContract.mirrorCount().catch(() => 0));
          trackedWallet = await vaultContract.trackedWallet().catch(() => ethers.ZeroAddress);
          trackedTokenId = await vaultContract.trackedTokenId().catch(() => 0n);
          inRange = await vaultContract.isInRange().catch(() => false);
          needsMirror = await vaultContract.needsMirror().catch(() => false);
          trackedTickLower = Number(await vaultContract.trackedTickLower().catch(() => 0));
          trackedTickUpper = Number(await vaultContract.trackedTickUpper().catch(() => 0));
          vaultTickLower = Number(await vaultContract.currentTickLower().catch(() => 0));
          vaultTickUpper = Number(await vaultContract.currentTickUpper().catch(() => 0));
        }

        const tvlUsdc = Number(ethers.formatUnits(totalAssets, 6));
        const sharePrice = totalSupply > 0n
          ? Number(totalAssets) / Number(totalSupply)
          : 1.0;
        const idleUsdc = Number(ethers.formatUnits(await usdcContract.balanceOf(v.vault_address), 6));

        // Read tracked position from NPM if we have a token ID
        let posTickLower = trackedTickLower;
        let posTickUpper = trackedTickUpper;
        let posLiquidity = 0;
        let posStaked = false;
        const tid = Number(trackedTokenId);

        if (tid > 0) {
          try {
            const pos = await npm.positions(tid);
            posTickLower = Number(pos.tickLower);
            posTickUpper = Number(pos.tickUpper);
            posLiquidity = Number(pos.liquidity);
          } catch (e) {}

          // Check if position is in range based on tracked position ticks
          if (posTickLower !== 0 || posTickUpper !== 0) {
            inRange = currentTick >= posTickLower && currentTick < posTickUpper;
          }
        }

        // Calculate range prices
        const rangeLow = posTickLower !== 0 ? tickToPrice(posTickLower) : 0;
        const rangeHigh = posTickUpper !== 0 ? tickToPrice(posTickUpper) : 0;

        // Build update
        const update = {
          vault_address: v.vault_address,
          tvl_usdc: tvlUsdc,
          share_price: sharePrice,
          mirror_count: mirrorCount,
          is_in_range: inRange,
          needs_mirror: needsMirror,
          idle_usdc: idleUsdc,
          tracked_wallet: trackedWallet !== ethers.ZeroAddress ? trackedWallet.toLowerCase() : v.tracked_wallet,
          tracked_token_id: tid > 0 ? tid.toString() : v.tracked_token_id,
          tracked_position_tick_lower: posTickLower,
          tracked_position_tick_upper: posTickUpper,
          tracked_position_range_low_usd: rangeLow,
          tracked_position_range_high_usd: rangeHigh,
          tracked_position_staked: posStaked,
          _snapshot: true // trigger snapshot save
        };

        // Update via API (or directly)
        const { error: updateErr } = await supabase
          .from('mirror_vault_marketplace')
          .update({
            tvl_usdc: update.tvl_usdc,
            share_price: update.share_price,
            mirror_count: update.mirror_count,
            is_in_range: update.is_in_range,
            needs_mirror: update.needs_mirror,
            idle_usdc: update.idle_usdc,
            tracked_wallet: update.tracked_wallet,
            tracked_token_id: update.tracked_token_id,
            tracked_position_tick_lower: update.tracked_position_tick_lower,
            tracked_position_tick_upper: update.tracked_position_tick_upper,
            tracked_position_range_low_usd: update.tracked_position_range_low_usd,
            tracked_position_range_high_usd: update.tracked_position_range_high_usd,
            tracked_position_staked: update.tracked_position_staked,
            updated_at: new Date().toISOString()
          })
          .eq('vault_address', v.vault_address);

        if (updateErr) throw updateErr;

        // Save snapshot
        await supabase.from('mirror_vault_snapshots').insert({
          vault_address: v.vault_address,
          tvl_usdc: update.tvl_usdc,
          share_price: update.share_price,
          is_in_range: update.is_in_range,
          eth_price: ethPrice,
          tick_lower: posTickLower,
          tick_upper: posTickUpper
        });

        results.push({
          vault: v.vault_address,
          name: v.name,
          tvl: tvlUsdc,
          inRange: inRange,
          rangeLow: rangeLow.toFixed(0),
          rangeHigh: rangeHigh.toFixed(0),
          mirrorCount: mirrorCount,
          needsMirror: needsMirror
        });

      } catch (vaultErr) {
        results.push({
          vault: v.vault_address,
          name: v.name,
          error: vaultErr.message
        });
      }
    }

    return res.status(200).json({
      ok: true,
      ethPrice: ethPrice.toFixed(2),
      currentTick,
      vaultsRefreshed: results.length,
      results
    });

  } catch (err) {
    console.error('Mirror stats error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
