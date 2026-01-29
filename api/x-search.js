// Search recent tweets via X API v2
// Requires: X_BEARER_TOKEN environment variable

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { X_BEARER_TOKEN } = process.env;

    if (!X_BEARER_TOKEN) {
        return res.status(500).json({ error: 'X_BEARER_TOKEN not configured' });
    }

    try {
        const q = req.query.q;
        const maxResults = Math.min(parseInt(req.query.max_results) || 20, 100);

        if (!q) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        // Filter out retweets and replies for cleaner results
        const query = `${q} -is:retweet -is:reply lang:en`;

        const params = new URLSearchParams({
            query,
            max_results: maxResults.toString(),
            'tweet.fields': 'created_at,public_metrics,author_id',
            'user.fields': 'name,username,public_metrics,profile_image_url',
            expansions: 'author_id'
        });

        const url = `https://api.twitter.com/2/tweets/search/recent?${params}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${X_BEARER_TOKEN}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('X search error:', data);
            return res.status(response.status).json({
                error: data.detail || data.title || 'Failed to search tweets',
                details: data
            });
        }

        if (!data.data || !data.data.length) {
            return res.status(200).json({ tweets: [] });
        }

        // Build user lookup map
        const users = {};
        if (data.includes && data.includes.users) {
            for (const u of data.includes.users) {
                users[u.id] = u;
            }
        }

        // Map tweets with author info
        const tweets = data.data.map(tweet => {
            const author = users[tweet.author_id] || {};
            return {
                id: tweet.id,
                text: tweet.text,
                created_at: tweet.created_at,
                author_name: author.name || 'Unknown',
                author_username: author.username || 'unknown',
                followers: author.public_metrics?.followers_count || 0,
                profile_image_url: author.profile_image_url || null,
                metrics: tweet.public_metrics || {}
            };
        });

        return res.status(200).json({ tweets });

    } catch (error) {
        console.error('X search error:', error);
        return res.status(500).json({ error: 'Failed to search tweets' });
    }
}
