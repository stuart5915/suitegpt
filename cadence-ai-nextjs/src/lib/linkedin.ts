/**
 * LinkedIn API Client
 * Handles posting to LinkedIn via OAuth 2.0
 */

export async function postToLinkedIn(text: string): Promise<{ success: boolean; postId?: string; error?: string }> {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
    const personUrn = process.env.LINKEDIN_PERSON_URN

    if (!accessToken || !personUrn) {
        return { success: false, error: 'LinkedIn credentials not configured' }
    }

    try {
        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify({
                author: personUrn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: { text },
                        shareMediaCategory: 'NONE'
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('LinkedIn post error:', error)
            return { success: false, error: `LinkedIn API error: ${response.status}` }
        }

        const postId = response.headers.get('x-restli-id') || undefined

        return { success: true, postId }
    } catch (error: any) {
        console.error('LinkedIn post error:', error)
        return { success: false, error: error.message || 'Failed to post to LinkedIn' }
    }
}
