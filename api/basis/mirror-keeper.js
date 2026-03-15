import { ethers } from 'ethers';

const VAULT_ADDRESS = process.env.MIRROR_VAULT_ADDRESS;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC = 'https://mainnet.base.org';

const ABI = [
    'function needsMirror() view returns (bool)',
    'function mirror() external',
    'function compound() external',
    'function tokenId() view returns (uint256)',
    'function trackedTickLower() view returns (int24)',
    'function trackedTickUpper() view returns (int24)',
    'function compoundMinimum() view returns (uint256)',
    'function getVaultInfo() view returns (uint256 _totalAssets, uint256 _totalSupply, uint256 _sharePrice, int24 _currentTickLower, int24 _currentTickUpper, int24 _trackedTickLower, int24 _trackedTickUpper, address _trackedWallet, uint256 _trackedTokenId, bool _needsMirror, uint256 _idleUsdc, uint256 _depositCap)'
];

const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

    if (!VAULT_ADDRESS || !PRIVATE_KEY) {
        return res.status(500).json({ ok: false, error: 'Not configured — set MIRROR_VAULT_ADDRESS and DEPLOYER_PRIVATE_KEY' });
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const vault = new ethers.Contract(VAULT_ADDRESS, ABI, wallet);
        const usdc = new ethers.Contract(USDC, USDC_ABI, provider);

        // Read vault state
        const info = await vault.getVaultInfo();
        const idleUsdc = await usdc.balanceOf(VAULT_ADDRESS);
        const compoundMin = await vault.compoundMinimum();

        const actions = [];

        // 1. Mirror if range changed
        if (info._needsMirror) {
            try {
                const tx = await vault.mirror();
                const receipt = await tx.wait();
                actions.push({
                    action: 'mirror',
                    tx: receipt.hash,
                    gasUsed: receipt.gasUsed.toString(),
                    oldRange: `${info._currentTickLower}..${info._currentTickUpper}`,
                    newRange: `${info._trackedTickLower}..${info._trackedTickUpper}`
                });
            } catch (err) {
                actions.push({ action: 'mirror', error: err.reason || err.message });
            }
        }

        // 2. Compound idle USDC if above minimum
        if (idleUsdc >= compoundMin) {
            try {
                const tx = await vault.compound();
                const receipt = await tx.wait();
                actions.push({
                    action: 'compound',
                    tx: receipt.hash,
                    gasUsed: receipt.gasUsed.toString(),
                    idleUsdc: ethers.formatUnits(idleUsdc, 6)
                });
            } catch (err) {
                actions.push({ action: 'compound', error: err.reason || err.message });
            }
        }

        return res.status(200).json({
            ok: true,
            vault: VAULT_ADDRESS,
            totalAssets: ethers.formatUnits(info._totalAssets, 6),
            sharePrice: ethers.formatUnits(info._sharePrice, 6),
            trackedWallet: info._trackedWallet,
            trackedTokenId: info._trackedTokenId.toString(),
            needsMirror: info._needsMirror,
            idleUsdc: ethers.formatUnits(idleUsdc, 6),
            currentRange: `${info._currentTickLower}..${info._currentTickUpper}`,
            trackedRange: `${info._trackedTickLower}..${info._trackedTickUpper}`,
            actions: actions.length ? actions : 'none needed'
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
}
