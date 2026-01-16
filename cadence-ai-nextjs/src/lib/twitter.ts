/**
 * Twitter API v2 Client
 * Handles posting tweets and checking account status
 */

import { TwitterApi } from 'twitter-api-v2'

// Create Twitter client with OAuth 1.0a User Context (for posting)
export function getTwitterClient() {
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    })

    return client
}

// Create read-only client with Bearer Token
export function getTwitterReadOnlyClient() {
    return new TwitterApi(process.env.TWITTER_BEARER_TOKEN!)
}

// Post a tweet
export async function postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
        const client = getTwitterClient()
        const tweet = await client.v2.tweet(text)

        return {
            success: true,
            tweetId: tweet.data.id
        }
    } catch (error: any) {
        console.error('Twitter post error:', error)
        return {
            success: false,
            error: error.message || 'Failed to post tweet'
        }
    }
}

// Get authenticated user info
export async function getAuthenticatedUser(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
        const client = getTwitterClient()
        const me = await client.v2.me({
            'user.fields': ['profile_image_url', 'username', 'name', 'public_metrics']
        })

        return {
            success: true,
            user: me.data
        }
    } catch (error: any) {
        console.error('Twitter auth check error:', error)
        return {
            success: false,
            error: error.message || 'Failed to get user info'
        }
    }
}

// Verify credentials are valid
export async function verifyCredentials(): Promise<boolean> {
    try {
        const result = await getAuthenticatedUser()
        return result.success
    } catch {
        return false
    }
}
