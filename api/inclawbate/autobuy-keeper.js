import { ethers } from 'ethers';

const CONTRACT_ADDRESS = process.env.AUTOBUY_CONTRACT_ADDRESS || '0x9b434Db8daD66AEbD81594C4C32ce5ba16709c0A';
const PRIVATE_KEY = process.env.UNSTAKE_WALLET_PRIVATE_KEY;
const RPC = 'https://mainnet.base.org';

const ABI = [
    'function getReadyUsers() view returns (address[])',
    'function executeAll()',
    'function executeBuy(address user)',
    'function activeUserCount() view returns (uint256)'
];

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

    // Cron/admin only — uses server-side private key
    const secret = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!secret || secret !== process.env.CRON_SECRET) {
        return res.status(403).json({ ok: false, error: 'Unauthorized' });
    }

    if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
        return res.status(500).json({ ok: false, error: 'Not configured' });
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

        // Check if anyone needs a buy executed
        const ready = await contract.getReadyUsers();

        if (ready.length === 0) {
            return res.status(200).json({ ok: true, executed: 0, message: 'No users ready' });
        }

        // Execute buys one at a time (executeAll silently swallows errors)
        const results = [];
        for (const user of ready) {
            try {
                const tx = await contract.executeBuy(user);
                const receipt = await tx.wait();
                results.push({ user, tx: receipt.hash, gasUsed: receipt.gasUsed.toString() });
            } catch (err) {
                results.push({ user, error: err.reason || err.message });
            }
        }

        return res.status(200).json({
            ok: true,
            executed: results.filter(r => r.tx).length,
            failed: results.filter(r => r.error).length,
            results
        });
    } catch (err) {
        console.error('AutoBuy keeper error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
