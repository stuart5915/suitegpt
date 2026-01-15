import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const body = await req.json()

        const {
            platform = 'x',
            content_type,
            app_id,
            post_text,
            images = [],
            scheduled_for
        } = body

        if (!post_text || !content_type) {
            return NextResponse.json(
                { error: 'post_text and content_type are required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('scheduled_posts')
            .insert({
                platform,
                content_type,
                app_id: app_id || null,
                post_text,
                images,
                scheduled_for: scheduled_for || null,
                status: scheduled_for ? 'queued' : 'draft'
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, post: data })
    } catch (error) {
        console.error('Error adding to queue:', error)
        return NextResponse.json(
            { error: 'Failed to add to queue' },
            { status: 500 }
        )
    }
}

export async function GET() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('*, apps(name, icon_url)')
            .in('status', ['draft', 'queued'])
            .order('scheduled_for', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ posts: data })
    } catch (error) {
        console.error('Error fetching queue:', error)
        return NextResponse.json(
            { error: 'Failed to fetch queue' },
            { status: 500 }
        )
    }
}
