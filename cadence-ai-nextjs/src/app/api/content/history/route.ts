import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const searchParams = req.nextUrl.searchParams
        const days = parseInt(searchParams.get('days') || '30')
        const platform = searchParams.get('platform') // optional filter
        const contentType = searchParams.get('content_type') // optional filter

        // Calculate date 30 days ago
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - days)

        let query = supabase
            .from('scheduled_posts')
            .select('id, platform, post_text, content_type, scheduled_for, status, created_at')
            .gte('created_at', sinceDate.toISOString())
            .order('created_at', { ascending: false })

        // Apply optional filters
        if (platform) {
            query = query.eq('platform', platform)
        }
        if (contentType) {
            query = query.eq('content_type', contentType)
        }

        const { data, error } = await query

        if (error) {
            console.error('Supabase error:', error)
            throw error
        }

        // Group by platform for easier reading
        const byPlatform = (data || []).reduce((acc, post) => {
            const p = post.platform || 'unknown'
            if (!acc[p]) acc[p] = []
            acc[p].push(post)
            return acc
        }, {} as Record<string, typeof data>)

        // Format for prompt inclusion
        const formattedForPrompt = (data || []).map(post => {
            const date = post.scheduled_for
                ? new Date(post.scheduled_for).toLocaleDateString()
                : new Date(post.created_at).toLocaleDateString()
            return `[${post.platform?.toUpperCase()}] (${date}): ${post.post_text?.substring(0, 200)}${(post.post_text?.length || 0) > 200 ? '...' : ''}`
        }).join('\n')

        return NextResponse.json({
            success: true,
            count: data?.length || 0,
            days,
            posts: data,
            byPlatform,
            formattedForPrompt,
            summary: {
                total: data?.length || 0,
                byPlatform: Object.fromEntries(
                    Object.entries(byPlatform).map(([k, v]) => [k, (v as any[]).length])
                )
            }
        })
    } catch (error) {
        console.error('Error fetching content history:', error)
        return NextResponse.json(
            { error: 'Failed to fetch content history' },
            { status: 500 }
        )
    }
}
