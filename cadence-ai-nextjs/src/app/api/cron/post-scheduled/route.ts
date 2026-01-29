// POST /api/cron/post-scheduled
// Cron job to automatically post approved scheduled content
// Set up with Vercel Cron to run every 15 minutes
// Schedule: "0,15,30,45 * * * *"

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postTweet } from '@/lib/twitter'
import { postToLinkedIn } from '@/lib/linkedin'

export async function POST(req: NextRequest) {
    // Optional: Verify cron secret for security
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = await createClient()
        const now = new Date().toISOString()

        // Find approved posts that are due to be posted
        const { data: posts, error } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'approved')
            .lte('scheduled_for', now)
            .order('scheduled_for', { ascending: true })
            .limit(5) // Process up to 5 posts per run

        if (error) {
            console.error('Error fetching scheduled posts:', error)
            return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
        }

        if (!posts || posts.length === 0) {
            return NextResponse.json({ message: 'No posts to publish', posted: 0 })
        }

        const results = []

        for (const post of posts) {
            let postResult: { success: boolean; tweetId?: string; postId?: string; error?: string }

            if (post.platform === 'x') {
                const result = await postTweet(post.post_text)
                postResult = { success: result.success, tweetId: result.tweetId, error: result.error }
            } else if (post.platform === 'linkedin') {
                const result = await postToLinkedIn(post.post_text)
                postResult = { success: result.success, postId: result.postId, error: result.error }
            } else {
                results.push({ id: post.id, status: 'skipped', reason: `Unknown platform: ${post.platform}` })
                continue
            }

            if (postResult.success) {
                await supabase
                    .from('scheduled_posts')
                    .update({
                        status: 'posted',
                        twitter_post_id: postResult.tweetId || null,
                        linkedin_post_id: postResult.postId || null,
                        posted_at: new Date().toISOString()
                    })
                    .eq('id', post.id)

                results.push({
                    id: post.id,
                    status: 'posted',
                    tweetId: postResult.tweetId,
                    linkedinPostId: postResult.postId
                })
            } else {
                await supabase
                    .from('scheduled_posts')
                    .update({
                        status: 'failed',
                        error_message: postResult.error
                    })
                    .eq('id', post.id)

                results.push({
                    id: post.id,
                    status: 'failed',
                    error: postResult.error
                })
            }

            // Small delay between posts to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        const posted = results.filter(r => r.status === 'posted').length
        const failed = results.filter(r => r.status === 'failed').length

        return NextResponse.json({
            message: `Processed ${posts.length} posts`,
            posted,
            failed,
            results
        })

    } catch (error) {
        console.error('Cron job error:', error)
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
    }
}

// Also support GET for manual testing
export async function GET(req: NextRequest) {
    return POST(req)
}
