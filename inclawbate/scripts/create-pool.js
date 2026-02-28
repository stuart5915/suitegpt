#!/usr/bin/env node
// Create Uniswap V3 pool for CLAWS/WETH on Base + add initial liquidity
// Usage: PRIVATE_KEY=0x... CLAWS_ADDRESS=0x... ETH_AMOUNT=1 CLAWS_AMOUNT=3000000000 node create-pool.js
//
// Stuart decides: ETH_AMOUNT (sets starting price), CLAWS_AMOUNT for LP, fee tier

const { ethers } = require('ethers');

// ── Config ──
const BASE_RPC = 'https://mainnet.base.org';
const WETH = '0x4200000000000000000000000000000000000006'; // Base WETH

// Uniswap V3 on Base
const FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';

const CLAWS_ADDRESS = process.env.CLAWS_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETH_AMOUNT = process.env.ETH_AMOUNT || '1';         // ETH to pair
const CLAWS_AMOUNT = process.env.CLAWS_AMOUNT || '3000000000'; // CLAWS to pair
const FEE_TIER = parseInt(process.env.FEE_TIER || '3000'); // 0.3% = 3000

if (!CLAWS_ADDRESS || !PRIVATE_KEY) {
    console.error('Usage: PRIVATE_KEY=0x... CLAWS_ADDRESS=0x... [ETH_AMOUNT=1] [CLAWS_AMOUNT=3000000000] node create-pool.js');
    process.exit(1);
}

// ── ABIs (minimal) ──
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
];

const FACTORY_ABI = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
];

const POSITION_MANAGER_ABI = [
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
    'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

// ── Helpers ──

// Calculate sqrtPriceX96 from price ratio
// price = token1/token0 (WETH per CLAWS if token0=CLAWS)
// sqrtPriceX96 = sqrt(price) * 2^96
function calcSqrtPriceX96(clawsAmount, ethAmount) {
    // price = ethAmount / clawsAmount (WETH per CLAWS)
    const price = Number(ethAmount) / Number(clawsAmount);
    const sqrtPrice = Math.sqrt(price);
    // sqrtPriceX96 = sqrtPrice * 2^96
    const Q96 = 2n ** 96n;
    // Use BigInt math for precision
    const sqrtPriceBN = BigInt(Math.floor(sqrtPrice * 1e18));
    const sqrtPriceX96 = (sqrtPriceBN * Q96) / BigInt(1e18);
    return sqrtPriceX96;
}

// Full range ticks for the fee tier
function getFullRangeTicks(feeTier) {
    const tickSpacing = feeTier === 500 ? 10 : feeTier === 3000 ? 60 : feeTier === 10000 ? 200 : 60;
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;
    const tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
    const tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    return { tickLower, tickUpper };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Wallet: ${wallet.address}`);

    const claws = new ethers.Contract(CLAWS_ADDRESS, ERC20_ABI, wallet);
    const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
    const positionManager = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, wallet);

    const clawsWei = ethers.parseEther(CLAWS_AMOUNT);
    const ethWei = ethers.parseEther(ETH_AMOUNT);

    // Sort tokens (Uniswap requires token0 < token1)
    const [token0, token1] = CLAWS_ADDRESS.toLowerCase() < WETH.toLowerCase()
        ? [CLAWS_ADDRESS, WETH]
        : [WETH, CLAWS_ADDRESS];

    const [amount0, amount1] = token0.toLowerCase() === CLAWS_ADDRESS.toLowerCase()
        ? [clawsWei, ethWei]
        : [ethWei, clawsWei];

    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Amount0: ${ethers.formatEther(amount0)}`);
    console.log(`Amount1: ${ethers.formatEther(amount1)}`);
    console.log(`Fee tier: ${FEE_TIER / 10000}%`);

    // Check if pool already exists
    const existingPool = await factory.getPool(CLAWS_ADDRESS, WETH, FEE_TIER);
    if (existingPool !== ethers.ZeroAddress) {
        console.log(`Pool already exists at ${existingPool}. Skipping creation, adding liquidity only.`);
    }

    // Calculate initial price
    // If token0 = CLAWS, price = WETH/CLAWS
    let sqrtPriceX96;
    if (token0.toLowerCase() === CLAWS_ADDRESS.toLowerCase()) {
        sqrtPriceX96 = calcSqrtPriceX96(CLAWS_AMOUNT, ETH_AMOUNT);
    } else {
        // token0 = WETH, price = CLAWS/WETH
        sqrtPriceX96 = calcSqrtPriceX96(ETH_AMOUNT, CLAWS_AMOUNT);
    }

    console.log(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);

    // Create and initialize pool
    if (existingPool === ethers.ZeroAddress) {
        console.log('\nCreating pool...');
        const createTx = await positionManager.createAndInitializePoolIfNecessary(
            token0, token1, FEE_TIER, sqrtPriceX96,
            { value: 0n }
        );
        console.log(`Create tx: ${createTx.hash}`);
        await createTx.wait();
        console.log('Pool created!');
    }

    // Approve CLAWS for Position Manager
    console.log('\nApproving CLAWS...');
    const approveTx = await claws.approve(POSITION_MANAGER, clawsWei);
    await approveTx.wait();
    console.log('CLAWS approved.');

    // Add liquidity (full range)
    const { tickLower, tickUpper } = getFullRangeTicks(FEE_TIER);
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

    console.log(`\nAdding liquidity: ticks [${tickLower}, ${tickUpper}]`);

    const mintTx = await positionManager.mint(
        {
            token0,
            token1,
            fee: FEE_TIER,
            tickLower,
            tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0, // Accept any slippage for initial LP
            amount1Min: 0,
            recipient: wallet.address,
            deadline,
        },
        { value: token0.toLowerCase() === WETH.toLowerCase() ? amount0 : amount1 }
    );

    console.log(`Mint tx: ${mintTx.hash}`);
    const receipt = await mintTx.wait();
    console.log(`Liquidity added in block ${receipt.blockNumber}`);

    const pricePerClaws = Number(ETH_AMOUNT) / Number(CLAWS_AMOUNT);
    console.log(`\nStarting price: ~${pricePerClaws.toExponential(4)} ETH per CLAWS`);
    console.log('Done! Check DEX Screener in a few minutes for the pool to appear.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
