// Inclawbate — X OAuth 2.0 Authorization URL
// GET /api/inclawbate/x-auth
// Returns the X OAuth authorization URL for PKCE flow

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const REDIRECT_URI = 'https://inclawbate.com/launch';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    if (!X_CLIENT_ID) {
        return res.status(500).json({ error: 'X_CLIENT_ID not configured' });
    }

    const { code_challenge, state } = req.query;

    if (!code_challenge) {
        return res.status(400).json({ error: 'Missing code_challenge parameter' });
    }

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: X_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'tweet.read users.read offline.access',
        state: state || '',
        code_challenge: code_challenge,
        code_challenge_method: 'S256'
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    return res.status(200).json({ url: authUrl });
}
