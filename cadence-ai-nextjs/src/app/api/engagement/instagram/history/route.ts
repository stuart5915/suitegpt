/**
 * Instagram Engagement History API
 * POST - Record engagement action (copied, posted, skipped)
 * GET - Fetch engagement history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

function getAuthenticatedUser(request: NextRequest): string | null {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) return null

    const session = verifySessionToken(sessionToken, sessionSecret)
    return session?.telegram_id || null
}

export async function POST(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { postUrl, postAuthor, postCaption, commentText, status, skipReason, projectId } = body

        if (!postUrl || !status) {
            return NextResponse.json({ error: 'postUrl and status are required' }, { status: 400 })
        }

        const validStatuses = ['suggested', 'copied', 'posted', 'skipped']
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { error } = await supabase
            .from('instagram_engagement')
            .insert({
                telegram_id: telegramId,
                project_id: projectId || null,
                post_url: postUrl,
                post_author: postAuthor,
                post_caption: postCaption?.slice(0, 500), // Limit caption length
                comment_text: commentText,
                status,
                skip_reason: skipReason
            })

        if (error) {
            console.error('Failed to record Instagram engagement:', error)
            return NextResponse.json({ error: 'Failed to record engagement' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Instagram history POST error:', error)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

export async function GET(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
        .from('instagram_engagement')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
        console.error('Failed to fetch Instagram history:', error)
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // Also get stats
    const { data: allHistory } = await supabase
        .from('instagram_engagement')
        .select('status')
        .eq('telegram_id', telegramId)

    const totalEngaged = allHistory?.filter(h => h.status === 'posted' || h.status === 'copied').length || 0
    const totalSkipped = allHistory?.filter(h => h.status === 'skipped').length || 0
    const total = totalEngaged + totalSkipped
    const skipRate = total > 0 ? Math.round((totalSkipped / total) * 100) : 0

    return NextResponse.json({
        history: data?.map(item => ({
            id: item.id,
            postUrl: item.post_url,
            postAuthor: item.post_author,
            postCaption: item.post_caption,
            commentText: item.comment_text,
            status: item.status,
            skipReason: item.skip_reason,
            createdAt: item.created_at
        })),
        stats: {
            totalEngaged,
            totalSkipped,
            skipRate
        }
    })
}
