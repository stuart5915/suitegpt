import { ethers } from 'ethers';

const CONTRACT_ADDRESS = process.env.AUTOBUY_CONTRACT_ADDRESS || '0x9b434Db8daD66AEbD81594C4C32ce5ba16709c0A';
const PRIVATE_KEY = process.env.UNSTAKE_WALLET_PRIVATE_KEY;
const RPC = 'https://mainnet.base.org';

const ABI = [
    'function getReadyUsers() view returns (address[])',
    'function executeAll()',
    'function activeUserCount() view returns (uint256)'
];

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

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

        // Execute all ready buys
        const tx = await contract.executeAll();
        const receipt = await tx.wait();

        return res.status(200).json({
            ok: true,
            executed: ready.length,
            tx: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });
    } catch (err) {
        console.error('AutoBuy keeper error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
