// Fetch scheduled posts for calendar display
// GET ?from=2026-01-29&to=2026-02-05

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://suitegpt.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { from, to } = req.query;

    try {
        // Build query URL with filters
        let url = `${SUPABASE_URL}/rest/v1/scheduled_posts?select=*&order=scheduled_for.asc`;

        if (from) url += `&date_key=gte.${from}`;
        if (to) url += `&date_key=lte.${to}`;

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Supabase fetch error:', data);
            return res.status(response.status).json({ error: data.message || 'Failed to fetch posts' });
        }

        return res.status(200).json({ posts: data || [] });

    } catch (error) {
        console.error('Fetch scheduled posts error:', error);
        return res.status(500).json({ error: 'Failed to fetch scheduled posts' });
    }
}
