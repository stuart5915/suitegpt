// Proxy for fetching 3D model files from Meshy CDN (bypasses CORS)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter is required' });

    // Only allow Meshy CDN URLs
    if (!url.startsWith('https://assets.meshy.ai/')) {
        return res.status(403).json({ error: 'Only Meshy asset URLs are allowed' });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
