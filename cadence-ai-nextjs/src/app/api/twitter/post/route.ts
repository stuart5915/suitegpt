/**
 * POST /api/twitter/post
 * Post a tweet to Twitter/X
 */

import { NextRequest, NextResponse } from 'next/server'
import { postTweet } from '@/lib/twitter'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { text, postId } = body

        if (!text) {
            return NextResponse.json(
                { error: 'Tweet text is required' },
                { status: 400 }
            )
        }

        // Check character limit (280 for tweets)
        if (text.length > 280) {
            return NextResponse.json(
                { error: 'Tweet exceeds 280 character limit' },
                { status: 400 }
            )
        }

        // Post to Twitter
        const result = await postTweet(text)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        // If postId provided, update the scheduled_posts record
        if (postId) {
            const supabase = await createClient()
            await supabase
                .from('scheduled_posts')
                .update({
                    status: 'posted',
                    twitter_post_id: result.tweetId,
                    posted_at: new Date().toISOString()
                })
                .eq('id', postId)
        }

        return NextResponse.json({
            success: true,
            tweetId: result.tweetId,
            tweetUrl: `https://twitter.com/i/web/status/${result.tweetId}`
        })

    } catch (error) {
        console.error('Twitter post API error:', error)
        return NextResponse.json(
            { error: 'Failed to post tweet' },
            { status: 500 }
        )
    }
}
