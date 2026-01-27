// Proto Golf Admin Auth - validates password server-side
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;
    const ADMIN_PASSWORD = process.env.PROTO_GOLF_ADMIN_PASSWORD || 'proto2026';

    if (password === ADMIN_PASSWORD) {
        // Generate a simple session token (in production, use proper JWT)
        const token = Buffer.from(`proto_admin_${Date.now()}`).toString('base64');
        return res.status(200).json({ success: true, token });
    }

    return res.status(401).json({ error: 'Invalid password' });
}
