// Post to LinkedIn API
// Requires environment variables:
// - LINKEDIN_ACCESS_TOKEN (OAuth 2.0 access token)
// - LINKEDIN_PERSON_URN (e.g., urn:li:person:ABC123)

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN } = process.env;

    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_PERSON_URN) {
        return res.status(500).json({ error: 'LinkedIn API credentials not configured' });
    }

    try {
        const { text, postId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // LinkedIn Share API v2
        const shareBody = {
            author: LINKEDIN_PERSON_URN,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: text
                    },
                    shareMediaCategory: 'NONE'
                }
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
        };

        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify(shareBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LinkedIn API error:', response.status, errorText);

            // Try to parse error
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: errorText };
            }

            return res.status(response.status).json({
                error: errorData.message || 'Failed to post to LinkedIn',
                details: errorData
            });
        }

        // LinkedIn returns the post ID in the x-restli-id header
        const linkedinPostId = response.headers.get('x-restli-id');

        return res.status(200).json({
            success: true,
            postId: linkedinPostId,
            originalPostId: postId
        });

    } catch (error) {
        console.error('LinkedIn posting error:', error);
        return res.status(500).json({ error: 'Failed to post to LinkedIn' });
    }
}
