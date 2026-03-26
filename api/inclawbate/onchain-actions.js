// Server-side on-chain actions for the Inclawbator
// Uses operator wallet to sign transactions on behalf of users
import { ethers } from 'ethers';

const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY;
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const INCLAWBATE_TREASURY = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';

// ── Clanker V4 Addresses ──
const CLANKER_V4 = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const CLANKER_HOOK_DYNAMIC_V2 = '0xd60D6B218116cFd801E28F78d011a203D2b068Cc';
const CLANKER_LP_LOCKER = '0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496';
const CLANKER_SNIPER_AUCTION = '0xebB25BB797D82CB78E1bc70406b13233c0854413';

// ── Disperse Contract ──
const DISPERSE_CONTRACT = '0xD152f549545093347A162Dce210e7293f1452150';

// ── Staking Factory ──
const STAKING_FACTORY = '0x7AE0768D9F36088fB967e530A8F4A3936b40B621';
const CLAWS_TOKEN = '0x7ca47B141639B893C6782823C0b219f872056379';

const DEPLOY_TOKEN_ABI = [{
  name: 'deployToken', type: 'function', stateMutability: 'payable',
  inputs: [{
    name: 'deploymentConfig', type: 'tuple', components: [
      { name: 'tokenConfig', type: 'tuple', components: [
        { name: 'tokenAdmin', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'salt', type: 'bytes32' },
        { name: 'image', type: 'string' },
        { name: 'metadata', type: 'string' },
        { name: 'context', type: 'string' },
        { name: 'originatingChainId', type: 'uint256' }
      ]},
      { name: 'poolConfig', type: 'tuple', components: [
        { name: 'hook', type: 'address' },
        { name: 'pairedToken', type: 'address' },
        { name: 'tickIfToken0IsClanker', type: 'int24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'poolData', type: 'bytes' }
      ]},
      { name: 'lockerConfig', type: 'tuple', components: [
        { name: 'locker', type: 'address' },
        { name: 'rewardAdmins', type: 'address[]' },
        { name: 'rewardRecipients', type: 'address[]' },
        { name: 'rewardBps', type: 'uint16[]' },
        { name: 'tickLower', type: 'int24[]' },
        { name: 'tickUpper', type: 'int24[]' },
        { name: 'positionBps', type: 'uint16[]' },
        { name: 'lockerData', type: 'bytes' }
      ]},
      { name: 'mevModuleConfig', type: 'tuple', components: [
        { name: 'mevModule', type: 'address' },
        { name: 'mevModuleData', type: 'bytes' }
      ]},
      { name: 'extensionConfigs', type: 'tuple[]', components: [
        { name: 'extension', type: 'address' },
        { name: 'msgValue', type: 'uint256' },
        { name: 'extensionBps', type: 'uint16' },
        { name: 'extensionData', type: 'bytes' }
      ]}
    ]
  }],
  outputs: [{ name: 'tokenAddress', type: 'address' }]
}];

const TOKEN_CREATED_TOPIC = '0x9299d1d1a88d8e1abdc591ae7a167a6bc63a8f17d695804e9091ee33aa89fb67';

const DYNAMIC_FEE_POOL_DATA = '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000007800000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000001dcd65000000000000000000000000000000000000000000000000000000000000001d4c';

// feePreference: [1, 1] = Paired (WETH only) for both recipients
const LOCKER_DATA = '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001';

function getProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC);
}

function getOperatorWallet() {
  if (!OPERATOR_KEY) throw new Error('OPERATOR_PRIVATE_KEY not set');
  return new ethers.Wallet(OPERATOR_KEY, getProvider());
}

// ══════════════════════════════════════
// LAUNCH TOKEN via Clanker V4
// ══════════════════════════════════════
export async function launchToken({ name, symbol, creator_wallet, description, image_url, website_url, x_handle, telegram_url, reward_recipients, reward_bps }) {
  if (!name || !symbol) throw new Error('Token name and symbol are required');
  if (!creator_wallet) throw new Error('Creator wallet address is required');

  const wallet = getOperatorWallet();
  const iface = new ethers.Interface(DEPLOY_TOKEN_ABI);

  // Generate random salt
  const saltBytes = ethers.randomBytes(32);
  const salt = ethers.hexlify(saltBytes);

  // Build metadata
  const metadata = JSON.stringify({
    description: description || '',
    website: website_url || '',
    twitter: x_handle || '',
    telegram: telegram_url || ''
  });

  // Sniper MEV data: startingFee=666777, endingFee=41673, secondsToDecay=15
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const sniperMevData = coder.encode(['uint256', 'uint256', 'uint256'], [666777, 41673, 15]);

  // Reward recipients: custom split if provided, otherwise 80% creator / 20% Inclawbate
  const rewardRecipients = reward_recipients || [creator_wallet, INCLAWBATE_TREASURY];
  const rewardBps = reward_bps || [8000, 2000];

  const deploymentConfig = {
    tokenConfig: {
      tokenAdmin: creator_wallet,
      name,
      symbol: symbol.toUpperCase(),
      salt,
      image: image_url || '',
      metadata,
      context: JSON.stringify({ interface: 'Inclawbator Agent' }),
      originatingChainId: 8453
    },
    poolConfig: {
      hook: CLANKER_HOOK_DYNAMIC_V2,
      pairedToken: WETH_BASE,
      tickIfToken0IsClanker: -230400,
      tickSpacing: 200,
      poolData: DYNAMIC_FEE_POOL_DATA
    },
    lockerConfig: {
      locker: CLANKER_LP_LOCKER,
      rewardAdmins: rewardRecipients,
      rewardRecipients,
      rewardBps,
      tickLower: [-230400],
      tickUpper: [-120000],
      positionBps: [10000],
      lockerData: LOCKER_DATA
    },
    mevModuleConfig: {
      mevModule: CLANKER_SNIPER_AUCTION,
      mevModuleData: sniperMevData
    },
    extensionConfigs: []
  };

  const data = iface.encodeFunctionData('deployToken', [deploymentConfig]);

  const tx = await wallet.sendTransaction({
    to: CLANKER_V4,
    data,
    value: 0,
    gasLimit: 5000000
  });

  const receipt = await tx.wait();

  // Parse token address from logs
  let tokenAddress = null;
  for (const log of receipt.logs) {
    if (log.topics && log.topics[0] === TOKEN_CREATED_TOPIC && log.topics.length >= 2) {
      tokenAddress = '0x' + log.topics[1].slice(26);
      break;
    }
  }

  // Fallback: find Transfer from zero address (mint)
  if (!tokenAddress) {
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const ZERO_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (const log of receipt.logs) {
      if (log.topics && log.topics[0] === TRANSFER_TOPIC && log.topics[1] === ZERO_TOPIC) {
        tokenAddress = log.address;
        break;
      }
    }
  }

  // Auto-register on inclawbate.app tokens page
  if (tokenAddress) {
    try {
      await fetch('https://www.inclawbate.app/api/inclawbate/inclawbator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet': '0x91b5c0d07859cfeafeb67d9694121cd741f049bd' },
        body: JSON.stringify({
          action: 'register',
          token_name: name,
          token_symbol: symbol.toUpperCase(),
          token_address: tokenAddress,
          deploy_tx_hash: receipt.hash,
          creator_wallet: creator_wallet,
          description: description || '',
          website_url: website_url || '',
          x_handle: x_handle || '',
          telegram_url: telegram_url || '',
          logo_url: image_url || '',
          chain: 'base',
          tier: 'permissionless',
          fee_split_bps: 10000
        })
      });
    } catch (regErr) {
      console.error('Token registration failed (non-fatal):', regErr.message);
    }
  }

  return {
    success: true,
    token_address: tokenAddress,
    tx_hash: receipt.hash,
    chain: 'base',
    clanker_url: tokenAddress ? `https://www.clanker.world/clanker/${tokenAddress}` : null,
    basescan_url: `https://basescan.org/tx/${receipt.hash}`,
    registered: true
  };
}

// ══════════════════════════════════════
// DISPERSE TOKENS (Airdrop)
// ══════════════════════════════════════
const DISPERSE_ABI = [
  'function disperseToken(address token, address[] recipients, uint256[] values)',
  'function disperseEther(address[] recipients, uint256[] values) payable'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// ══════════════════════════════════════
// DEPLOY STAKING POOL via Factory
// ══════════════════════════════════════
const STAKING_FACTORY_ABI = [
  'function deployPaid(address stakingToken, address rewardToken) payable returns (address pool)',
  'function poolCount() view returns (uint256)',
  'function allPools(uint256 index) view returns (address)',
  'event PoolDeployed(address indexed pool, address indexed stakingToken, address indexed admin, uint256 paid)'
];

const STAKING_POOL_ABI = [
  'function transferAdmin(address newAdmin)'
];

export async function deployStakingPool({ token_address, creator_wallet }) {
  if (!token_address) throw new Error('token_address is required');
  if (!creator_wallet) throw new Error('creator_wallet is required');

  const wallet = getOperatorWallet();
  const factory = new ethers.Contract(STAKING_FACTORY, STAKING_FACTORY_ABI, wallet);

  // Get pool count before deploy so we can find the new pool after
  const countBefore = await factory.poolCount();

  // Deploy: stake token_address, earn CLAWS
  const tx = await factory.deployPaid(token_address, CLAWS_TOKEN, { value: 0, gasLimit: 1000000 });
  const receipt = await tx.wait();

  // Get the new pool address: it's the last pool in the factory
  const countAfter = await factory.poolCount();
  if (countAfter <= countBefore) throw new Error('Factory pool count did not increase. Tx: ' + receipt.hash);
  const poolAddress = await factory.allPools(countAfter - 1n);

  // Transfer admin to creator so they can deposit rewards
  const pool = new ethers.Contract(poolAddress, STAKING_POOL_ABI, wallet);
  const transferTx = await pool.transferAdmin(creator_wallet);
  await transferTx.wait();

  // Auto-update staking address on inclawbate.app
  try {
    // Find the project by token address first
    const lookupRes = await fetch(`https://www.inclawbate.app/api/inclawbate/inclawbator?token_address=${token_address}`);
    const lookupData = await lookupRes.json();
    const projectId = lookupData?.project?.id || lookupData?.id;

    if (projectId) {
      await fetch('https://www.inclawbate.app/api/inclawbate/inclawbator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet': '0x91b5c0d07859cfeafeb67d9694121cd741f049bd' },
        body: JSON.stringify({
          action: 'update-staking',
          project_id: projectId,
          staking_address: poolAddress,
          staking_deploy_tx: receipt.hash
        })
      });
    }
  } catch (regErr) {
    console.error('Staking registration failed (non-fatal):', regErr.message);
  }

  return {
    success: true,
    pool_address: poolAddress,
    staking_token: token_address,
    reward_token: CLAWS_TOKEN,
    admin: creator_wallet,
    deploy_tx: receipt.hash,
    basescan_url: `https://basescan.org/tx/${receipt.hash}`,
    stake_url: `/dashboard`
  };
}

export async function disperseTokens({ token_address, recipients, amounts }) {
  if (!token_address || !recipients || !amounts) throw new Error('token_address, recipients[], and amounts[] are required');
  if (recipients.length !== amounts.length) throw new Error('recipients and amounts must be the same length');
  if (recipients.length === 0) throw new Error('At least one recipient is required');

  const wallet = getOperatorWallet();
  const token = new ethers.Contract(token_address, ERC20_ABI, wallet);
  const decimals = await token.decimals();

  // Convert amounts to wei
  const amountsWei = amounts.map(a => ethers.parseUnits(String(a), decimals));
  const total = amountsWei.reduce((sum, a) => sum + a, 0n);

  // Check and set allowance
  const allowance = await token.allowance(wallet.address, DISPERSE_CONTRACT);
  if (allowance < total) {
    const approveTx = await token.approve(DISPERSE_CONTRACT, total);
    await approveTx.wait();
  }

  // Disperse
  const disperse = new ethers.Contract(DISPERSE_CONTRACT, DISPERSE_ABI, wallet);
  const tx = await disperse.disperseToken(token_address, recipients, amountsWei);
  const receipt = await tx.wait();

  return {
    success: true,
    tx_hash: receipt.hash,
    recipients_count: recipients.length,
    total_distributed: ethers.formatUnits(total, decimals),
    basescan_url: `https://basescan.org/tx/${receipt.hash}`
  };
}
