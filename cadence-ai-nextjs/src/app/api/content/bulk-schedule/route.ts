import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ScheduledPostInput {
    platform: 'x' | 'linkedin' | 'instagram' | 'tiktok'
    content: string
    scheduledDate: string  // ISO date string (YYYY-MM-DD or full ISO)
    scheduledTime?: string // Optional time in HH:MM format
    status?: 'draft' | 'queued' | 'approved'
    contentType?: string   // e.g., 'suitegpt_weekly', 'engagement', etc.
    imageUrl?: string      // Optional image URL
}

interface BulkScheduleRequest {
    posts: ScheduledPostInput[]
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const body: BulkScheduleRequest = await req.json()

        const { posts } = body

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json(
                { error: 'posts array is required and must not be empty' },
                { status: 400 }
            )
        }

        // Validate and transform posts for insertion
        const postsToInsert = posts.map((post, index) => {
            if (!post.platform || !post.content || !post.scheduledDate) {
                throw new Error(`Post at index ${index} is missing required fields (platform, content, scheduledDate)`)
            }

            // Parse the scheduled date/time
            let scheduledFor: string
            if (post.scheduledTime) {
                // Combine date and time
                const date = post.scheduledDate.split('T')[0]  // Get just the date part
                scheduledFor = `${date}T${post.scheduledTime}:00.000Z`
            } else if (post.scheduledDate.includes('T')) {
                // Full ISO string provided
                scheduledFor = post.scheduledDate
            } else {
                // Just date, default to 9am
                scheduledFor = `${post.scheduledDate}T09:00:00.000Z`
            }

            return {
                platform: post.platform,
                post_text: post.content,
                content_type: post.contentType || 'suitegpt_weekly',
                scheduled_for: scheduledFor,
                status: post.status || 'draft',
                images: post.imageUrl ? [post.imageUrl] : []
            }
        })

        // Insert all posts
        const { data, error } = await supabase
            .from('scheduled_posts')
            .insert(postsToInsert)
            .select()

        if (error) {
            console.error('Supabase error:', error)
            throw error
        }

        return NextResponse.json({
            success: true,
            message: `Successfully scheduled ${data?.length || 0} posts`,
            posts: data,
            summary: {
                total: data?.length || 0,
                byPlatform: postsToInsert.reduce((acc, p) => {
                    acc[p.platform] = (acc[p.platform] || 0) + 1
                    return acc
                }, {} as Record<string, number>),
                byStatus: postsToInsert.reduce((acc, p) => {
                    acc[p.status] = (acc[p.status] || 0) + 1
                    return acc
                }, {} as Record<string, number>)
            }
        })
    } catch (error) {
        console.error('Error bulk scheduling posts:', error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to bulk schedule posts',
                details: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}

// GET endpoint to verify the API is working
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/content/bulk-schedule',
        method: 'POST',
        description: 'Bulk schedule social media posts for Cadence AI calendar',
        requiredFields: {
            posts: 'Array of post objects'
        },
        postFields: {
            platform: 'Required: x | linkedin | instagram | tiktok',
            content: 'Required: The post content/text',
            scheduledDate: 'Required: ISO date (YYYY-MM-DD) or full ISO datetime',
            scheduledTime: 'Optional: Time in HH:MM format (defaults to 09:00)',
            status: 'Optional: draft | queued | approved (defaults to draft)',
            contentType: 'Optional: Content category (defaults to suitegpt_weekly)',
            imageUrl: 'Optional: URL of image to attach'
        },
        example: {
            posts: [
                {
                    platform: 'x',
                    content: 'Your tweet content here',
                    scheduledDate: '2025-01-27',
                    scheduledTime: '10:00',
                    status: 'draft'
                },
                {
                    platform: 'linkedin',
                    content: 'Your LinkedIn post here',
                    scheduledDate: '2025-01-28',
                    status: 'draft'
                }
            ]
        }
    })
}
