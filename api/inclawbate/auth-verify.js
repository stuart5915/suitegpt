// Inclawbate — Wallet Authentication
// POST /api/inclawbate/auth-verify
// Verifies wallet signature and returns JWT

import { createHmac } from 'crypto';
import { ethers } from 'ethers';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const JWT_SECRET = process.env.INCLAWBATE_JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

function base64url(str) {
    return Buffer.from(str).toString('base64url');
}

function createJwt(payload) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const sig = createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expectedSig = createHmac('sha256', JWT_SECRET)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');
    if (parts[2] !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

export function authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.replace('Bearer ', '');
    return verifyJwt(token);
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { wallet, message, signature, chain } = req.body;

        if (!wallet || !message || !signature) {
            return res.status(400).json({ error: 'Missing wallet, message, or signature' });
        }

        // Validate message format: inclawbate-auth:{timestamp}
        const match = message.match(/^inclawbate-auth:(\d+)$/);
        if (!match) {
            return res.status(400).json({ error: 'Invalid message format' });
        }

        // Check timestamp is recent (prevent replay attacks)
        const timestamp = parseInt(match[1]);
        if (Math.abs(Date.now() - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
            return res.status(400).json({ error: 'Message timestamp expired' });
        }

        // Verify EVM signature
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        if (recoveredAddress !== wallet.toLowerCase()) {
            return res.status(401).json({ error: 'Signature does not match wallet' });
        }

        // Issue JWT
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = new Date(Date.now() + JWT_EXPIRY_MS).toISOString();
        const jwt = createJwt({
            wallet: wallet.toLowerCase(),
            iat: now,
            exp: now + Math.floor(JWT_EXPIRY_MS / 1000)
        });

        return res.status(200).json({
            success: true,
            token: jwt,
            wallet: wallet.toLowerCase(),
            expiresAt
        });

    } catch (err) {
        console.error('Auth verify error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
