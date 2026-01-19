/**
 * Latest Poll API
 * Fetches the most recent poll tweet from @getSUITE
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTwitterReadOnlyClient } from '@/lib/twitter'

const TWITTER_HANDLE = 'getsuiteapp'

// Cache the result for 5 minutes to avoid hitting rate limits
let cachedPoll: { tweetId: string; text: string; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// CORS headers for cross-origin requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
}

// Handle preflight requests
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
    try {
        // Check cache first
        if (cachedPoll && Date.now() - cachedPoll.timestamp < CACHE_DURATION) {
            return NextResponse.json({
                success: true,
                tweetId: cachedPoll.tweetId,
                text: cachedPoll.text,
                cached: true
            }, { headers: corsHeaders })
        }

        const client = getTwitterReadOnlyClient()

        // Get user ID first
        const user = await client.v2.userByUsername(TWITTER_HANDLE)
        if (!user.data) {
            return NextResponse.json({
                success: false,
                error: 'User not found'
            }, { status: 404, headers: corsHeaders })
        }

        // Fetch recent tweets from the user
        const tweets = await client.v2.userTimeline(user.data.id, {
            max_results: 20,
            'tweet.fields': ['created_at', 'text', 'attachments'],
            expansions: ['attachments.poll_ids'],
            'poll.fields': ['options', 'end_datetime', 'voting_status']
        })

        // Get tweets as array (handle empty/undefined cases)
        const tweetList = tweets.data?.data ? tweets.data.data : (Array.isArray(tweets.data) ? tweets.data : [])

        // If no tweets, return early
        if (!tweetList || tweetList.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No tweets found - account may be empty'
            }, { status: 404, headers: corsHeaders })
        }

        // Look for tweets with polls
        let pollTweet = null

        // First priority: tweets with actual poll attachments
        if (tweets.includes?.polls && tweets.includes.polls.length > 0) {
            for (const tweet of tweetList) {
                if (tweet.attachments?.poll_ids && tweet.attachments.poll_ids.length > 0) {
                    pollTweet = tweet
                    break
                }
            }
        }

        // Second priority: tweets that look like polls (keywords)
        if (!pollTweet) {
            const pollKeywords = ['vote', 'poll', 'which', 'should we', 'what should', '🗳️', 'build next', '?']
            for (const tweet of tweetList) {
                const textLower = tweet.text.toLowerCase()
                if (pollKeywords.some(keyword => textLower.includes(keyword))) {
                    pollTweet = tweet
                    break
                }
            }
        }

        // Fallback: just use the latest tweet
        if (!pollTweet && tweetList.length > 0) {
            pollTweet = tweetList[0]
        }

        if (!pollTweet) {
            return NextResponse.json({
                success: false,
                error: 'No tweets found'
            }, { status: 404, headers: corsHeaders })
        }

        // Cache the result
        cachedPoll = {
            tweetId: pollTweet.id,
            text: pollTweet.text,
            timestamp: Date.now()
        }

        return NextResponse.json({
            success: true,
            tweetId: pollTweet.id,
            text: pollTweet.text,
            embedUrl: `https://twitter.com/${TWITTER_HANDLE}/status/${pollTweet.id}`,
            cached: false
        }, { headers: corsHeaders })

    } catch (error: any) {
        console.error('Latest poll error:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch poll'
        }, { status: 500, headers: corsHeaders })
    }
}
