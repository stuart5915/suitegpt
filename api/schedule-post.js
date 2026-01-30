// Schedule a post for auto-publishing via cron
// Inserts into Supabase scheduled_posts table

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://suitegpt.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { platform, post_text, image_url, scheduled_for, cadence, date_key, theme } = req.body;

    if (!platform || !post_text || !scheduled_for) {
        return res.status(400).json({ error: 'platform, post_text, and scheduled_for are required' });
    }

    if (!['x', 'linkedin'].includes(platform)) {
        return res.status(400).json({ error: 'platform must be "x" or "linkedin"' });
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                platform,
                post_text,
                image_url: image_url || null,
                scheduled_for,
                cadence: cadence || null,
                date_key: date_key || null,
                theme: theme || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Supabase insert error:', data);
            return res.status(response.status).json({ error: data.message || 'Failed to schedule post' });
        }

        const post = Array.isArray(data) ? data[0] : data;
        return res.status(200).json({
            id: post.id,
            scheduled_for: post.scheduled_for,
            status: post.status
        });

    } catch (error) {
        console.error('Schedule post error:', error);
        return res.status(500).json({ error: 'Failed to schedule post' });
    }
}
