import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Load saved weekly content
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get today as the start (not Monday-based)
        const now = new Date()
        const weekStart = now.toISOString().split('T')[0]

        // Get next 7 days starting from today
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const weekDates = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(now)
            date.setDate(now.getDate() + i)
            weekDates.push({
                day: dayNames[date.getDay()],
                date: date.toISOString().split('T')[0]
            })
        }

        // Get weekly plan - find most recent plan for this project
        const { data: plan } = await supabase
            .from('weekly_plans')
            .select('id')
            .eq('project_id', projectId)
            .order('week_start', { ascending: false })
            .limit(1)
            .single()

        if (!plan) {
            return NextResponse.json({ exists: false, weekOf: weekStart })
        }

        // Get project name
        const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single()

        // Get content items for the next 7 days (today through 6 days from now)
        const endDate = new Date(now)
        endDate.setDate(now.getDate() + 6)
        const endDateStr = endDate.toISOString().split('T')[0]

        const { data: items } = await supabase
            .from('content_items')
            .select('*')
            .eq('project_id', projectId)
            .gte('scheduled_date', weekStart)
            .lte('scheduled_date', endDateStr)
            .order('scheduled_date')
            .order('scheduled_time')

        // Group by day
        const dayMap = new Map<string, any[]>()
        weekDates.forEach(d => dayMap.set(d.date, []))

        items?.forEach(item => {
            const existing = dayMap.get(item.scheduled_date) || []
            existing.push({
                id: item.id,
                platform: item.platform,
                contentType: item.content_type,
                title: item.ai_reasoning || 'Post',
                content: item.caption,
                suggestedTime: item.scheduled_time?.slice(0, 5) || '10:00',
                hashtags: item.hashtags || [],
                notes: item.media_prompt,
                status: item.status === 'approved' ? 'approved' :
                    item.status === 'draft' ? 'pending' : item.status,
                projectId: item.project_id,
                mediaUrls: item.media_urls || [],
                mediaPrompt: item.media_prompt,
            })
            dayMap.set(item.scheduled_date, existing)
        })

        const daysWithPosts = weekDates.map(d => ({
            day: d.day,
            date: d.date,
            posts: dayMap.get(d.date) || [],
        }))

        return NextResponse.json({
            exists: true,
            weekOf: weekStart,
            weeklyPlanId: plan.id,
            projectId,
            projectName: project?.name || 'Project',
            days: daysWithPosts,
        })
    } catch (error: any) {
        console.error('Load week error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete week or specific day
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')
        const day = searchParams.get('day') // Optional - if provided, only delete that day

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get today as starting point
        const now = new Date()
        const weekStart = now.toISOString().split('T')[0]

        // Get weekly plan - find most recent
        const { data: plan } = await supabase
            .from('weekly_plans')
            .select('id')
            .eq('project_id', projectId)
            .order('week_start', { ascending: false })
            .limit(1)
            .single()

        if (!plan) {
            return NextResponse.json({ success: true, message: 'No content to delete' })
        }

        if (day) {
            // Delete specific day - find the date based on day name relative to today
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const todayDayIndex = now.getDay()
            const targetDayIndex = dayNames.indexOf(day)

            if (targetDayIndex === -1) {
                return NextResponse.json({ error: 'Invalid day' }, { status: 400 })
            }

            // Calculate days difference (target day relative to today in next 7 days)
            let daysDiff = targetDayIndex - todayDayIndex
            if (daysDiff < 0) daysDiff += 7

            const targetDate = new Date(now)
            targetDate.setDate(now.getDate() + daysDiff)
            const dateStr = targetDate.toISOString().split('T')[0]

            await supabase
                .from('content_items')
                .delete()
                .eq('project_id', projectId)
                .eq('scheduled_date', dateStr)

            return NextResponse.json({ success: true, message: `Deleted content for ${day}` })
        } else {
            // Delete entire week - delete all content for next 7 days
            const endDate = new Date(now)
            endDate.setDate(now.getDate() + 6)
            const endDateStr = endDate.toISOString().split('T')[0]

            await supabase
                .from('content_items')
                .delete()
                .eq('project_id', projectId)
                .gte('scheduled_date', weekStart)
                .lte('scheduled_date', endDateStr)

            return NextResponse.json({ success: true, message: 'Deleted entire week' })
        }
    } catch (error: any) {
        console.error('Delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Update post status
export async function PATCH(request: NextRequest) {
    try {
        const { postId, status } = await request.json()

        if (!postId || !status) {
            return NextResponse.json({ error: 'Post ID and status required' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbStatus = status === 'approved' ? 'approved' :
            status === 'rejected' ? 'draft' : 'draft'

        const { error } = await supabase
            .from('content_items')
            .update({ status: dbStatus })
            .eq('id', postId)

        if (error) {
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
