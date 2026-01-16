// Discord OAuth Code Exchange
// Exchanges authorization code for user info

const DISCORD_CLIENT_ID = '1457474266390986865';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://getsuite.app/oauth-callback.html';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    if (!DISCORD_CLIENT_SECRET) {
        console.error('DISCORD_CLIENT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            return res.status(400).json({ error: 'Failed to exchange code', details: errorText });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error('User fetch failed:', errorText);
            return res.status(400).json({ error: 'Failed to get user info' });
        }

        const user = await userResponse.json();

        // Return user info (id, username, avatar, email if scope includes it)
        return res.status(200).json({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            email: user.email || null,
        });

    } catch (error) {
        console.error('Discord OAuth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
