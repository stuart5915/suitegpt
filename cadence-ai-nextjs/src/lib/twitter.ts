/**
 * Twitter API v2 Client
 * Handles posting tweets, searching, and checking account status
 */

import { TwitterApi, TweetSearchRecentV2Paginator, TweetV2, UserV2 } from 'twitter-api-v2'

// Types for engagement system
export interface SearchedTweet {
    id: string
    text: string
    authorId: string
    authorHandle: string
    authorName: string
    authorFollowers: number
    authorAvatar?: string
    createdAt: string
    likes: number
    retweets: number
    replies: number
    url: string
}

export interface SearchTweetsResult {
    success: boolean
    tweets?: SearchedTweet[]
    error?: string
    rateLimit?: {
        remaining: number
        reset: Date
    }
}

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

// Post a reply to a tweet
export async function postReply(
    text: string,
    replyToTweetId: string
): Promise<{ success: boolean; tweetId?: string; tweetUrl?: string; error?: string }> {
    try {
        const client = getTwitterClient()
        const tweet = await client.v2.reply(text, replyToTweetId)

        return {
            success: true,
            tweetId: tweet.data.id,
            tweetUrl: `https://twitter.com/i/web/status/${tweet.data.id}`
        }
    } catch (error: any) {
        console.error('Twitter reply error:', error)
        return {
            success: false,
            error: error.message || 'Failed to post reply'
        }
    }
}

// Search tweets using Twitter API v2
// Uses the Basic tier search endpoint (recent tweets, last 7 days)
export async function searchTweets(
    query: string,
    maxResults: number = 10,
    excludeTweetIds: string[] = []
): Promise<SearchTweetsResult> {
    try {
        const client = getTwitterReadOnlyClient()

        // Build exclusion query if we have seen tweet IDs
        // Note: Twitter limits query length, so we only exclude recent ones
        let fullQuery = query

        // Add -is:retweet and -is:reply to get original content
        if (!fullQuery.includes('-is:retweet')) {
            fullQuery += ' -is:retweet'
        }
        if (!fullQuery.includes('-is:reply')) {
            fullQuery += ' -is:reply'
        }

        // Search recent tweets (last 7 days)
        const result = await client.v2.search(fullQuery, {
            max_results: Math.min(maxResults, 100), // API max is 100
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
            'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
            expansions: ['author_id'],
        })

        // Build a map of users
        const usersMap = new Map<string, UserV2>()
        if (result.includes?.users) {
            for (const user of result.includes.users) {
                usersMap.set(user.id, user)
            }
        }

        // Transform tweets
        const tweets: SearchedTweet[] = []
        for (const tweet of result.data || []) {
            // Skip if we've already seen this tweet
            if (excludeTweetIds.includes(tweet.id)) {
                continue
            }

            const author = usersMap.get(tweet.author_id!)
            if (!author) continue

            tweets.push({
                id: tweet.id,
                text: tweet.text,
                authorId: tweet.author_id!,
                authorHandle: author.username,
                authorName: author.name,
                authorFollowers: author.public_metrics?.followers_count || 0,
                authorAvatar: author.profile_image_url,
                createdAt: tweet.created_at || new Date().toISOString(),
                likes: tweet.public_metrics?.like_count || 0,
                retweets: tweet.public_metrics?.retweet_count || 0,
                replies: tweet.public_metrics?.reply_count || 0,
                url: `https://twitter.com/${author.username}/status/${tweet.id}`
            })
        }

        // Get rate limit info
        const rateLimit = result.rateLimit

        return {
            success: true,
            tweets,
            rateLimit: rateLimit ? {
                remaining: rateLimit.remaining,
                reset: new Date(rateLimit.reset * 1000)
            } : undefined
        }
    } catch (error: any) {
        console.error('Twitter search error:', error)

        // Check for rate limit error
        if (error.code === 429 || error.message?.includes('rate limit')) {
            return {
                success: false,
                error: 'Rate limit exceeded. Please try again later.',
                rateLimit: error.rateLimit ? {
                    remaining: 0,
                    reset: new Date(error.rateLimit.reset * 1000)
                } : undefined
            }
        }

        return {
            success: false,
            error: error.message || 'Failed to search tweets'
        }
    }
}

// Build search query from engagement config
export function buildSearchQuery(config: {
    keywords: string[]
    hashtags: string[]
    targetAccounts: string[]
}): string {
    const parts: string[] = []

    // Add keywords (OR logic)
    if (config.keywords.length > 0) {
        // Group keywords with OR
        const keywordQuery = config.keywords
            .map(k => k.includes(' ') ? `"${k}"` : k)
            .join(' OR ')
        parts.push(`(${keywordQuery})`)
    }

    // Add hashtags
    if (config.hashtags.length > 0) {
        const hashtagQuery = config.hashtags
            .map(h => h.startsWith('#') ? h : `#${h}`)
            .join(' OR ')
        parts.push(`(${hashtagQuery})`)
    }

    // Add target accounts (from:)
    if (config.targetAccounts.length > 0) {
        const accountQuery = config.targetAccounts
            .map(a => {
                const handle = a.startsWith('@') ? a.slice(1) : a
                return `from:${handle}`
            })
            .join(' OR ')
        parts.push(`(${accountQuery})`)
    }

    // If we have multiple parts, OR them together
    // This gives us: tweets matching keywords OR hashtags OR from target accounts
    if (parts.length > 1) {
        return parts.join(' OR ')
    }

    return parts[0] || ''
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

// Get a single tweet by ID (for checking engagement results)
export async function getTweet(tweetId: string): Promise<{
    success: boolean
    tweet?: SearchedTweet
    error?: string
}> {
    try {
        const client = getTwitterReadOnlyClient()

        const result = await client.v2.singleTweet(tweetId, {
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
            'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
            expansions: ['author_id'],
        })

        const tweet = result.data
        const author = result.includes?.users?.[0]

        if (!tweet || !author) {
            return {
                success: false,
                error: 'Tweet not found'
            }
        }

        return {
            success: true,
            tweet: {
                id: tweet.id,
                text: tweet.text,
                authorId: tweet.author_id!,
                authorHandle: author.username,
                authorName: author.name,
                authorFollowers: author.public_metrics?.followers_count || 0,
                authorAvatar: author.profile_image_url,
                createdAt: tweet.created_at || new Date().toISOString(),
                likes: tweet.public_metrics?.like_count || 0,
                retweets: tweet.public_metrics?.retweet_count || 0,
                replies: tweet.public_metrics?.reply_count || 0,
                url: `https://twitter.com/${author.username}/status/${tweet.id}`
            }
        }
    } catch (error: any) {
        console.error('Twitter getTweet error:', error)
        return {
            success: false,
            error: error.message || 'Failed to get tweet'
        }
    }
}
