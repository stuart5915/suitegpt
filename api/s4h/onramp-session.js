import crypto from 'crypto';

const CDP_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
const WALLET = '0xA00e81ECEDD4D007965997C6cC64D9372beC397E';

const ALLOWED_ORIGINS = [
    'https://salvation4humanity.com',
    'https://www.salvation4humanity.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

function base64url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateJwt() {
    const header = {
        alg: 'EdDSA',
        kid: CDP_KEY_NAME,
        typ: 'JWT',
        nonce: crypto.randomBytes(16).toString('hex')
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: CDP_KEY_NAME,
        iss: 'cdp',
        aud: ['cdp_service'],
        nbf: now,
        exp: now + 120,
        uris: ['POST api.developer.coinbase.com/onramp/v1/token']
    };

    const msg = base64url(Buffer.from(JSON.stringify(header))) + '.' + base64url(Buffer.from(JSON.stringify(payload)));

    // Decode base64 Ed25519 private key and wrap in PKCS8 DER
    const seed = Buffer.from(CDP_KEY_SECRET.replace(/\s/g, ''), 'base64');
    const pkcs8 = Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'),
        seed
    ]);
    const key = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
    const sig = crypto.sign(null, Buffer.from(msg), key);

    return msg + '.' + base64url(sig);
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!CDP_KEY_NAME || !CDP_KEY_SECRET) {
        return res.status(500).json({ error: 'CDP credentials not configured' });
    }

    try {
        const jwt = generateJwt();

        const response = await fetch('https://api.developer.coinbase.com/onramp/v1/token', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + jwt,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                addresses: [{ address: WALLET, blockchains: ['base'] }],
                assets: ['USDC']
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Coinbase token API error:', response.status, errText);
            return res.status(502).json({ error: 'Failed to generate session token' });
        }

        const data = await response.json();
        return res.status(200).json({ token: data.token });
    } catch (error) {
        console.error('Session token error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
