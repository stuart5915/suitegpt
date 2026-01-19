/**
 * Engagement History API
 * POST - Record an engagement action (engaged/skipped)
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
        const {
            tweetId,
            action,      // 'engaged' | 'skipped'
            skipReason,  // 'not_relevant' | 'wrong_audience' | 'too_big' | 'too_small' | 'already_crowded'
            replyContent,
            authorHandle,
            authorFollowers,
            matchedKeywords,
            contentPreview,
            hadMedia
        } = body

        if (!tweetId || !action) {
            return NextResponse.json({ error: 'tweetId and action are required' }, { status: 400 })
        }

        if (!['engaged', 'skipped'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        if (action === 'skipped' && !skipReason) {
            return NextResponse.json({ error: 'skipReason is required for skipped action' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Record the action
        const { data, error } = await supabase
            .from('engagement_history')
            .insert({
                telegram_id: telegramId,
                tweet_id: tweetId,
                action,
                skip_reason: action === 'skipped' ? skipReason : null,
                reply_content: action === 'engaged' ? replyContent : null,
                author_handle: authorHandle,
                author_followers: authorFollowers,
                matched_keywords: matchedKeywords || [],
                content_preview: contentPreview?.slice(0, 200),
                had_media: hadMedia || false
            })
            .select()
            .single()

        if (error) {
            console.error('Error recording engagement history:', error)
            return NextResponse.json({ error: 'Failed to record action' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            history: data
        })

    } catch (error) {
        console.error('Error recording engagement history:', error)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

export async function GET(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get URL params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action') // 'engaged' | 'skipped' | null for all

    // Build query
    let query = supabase
        .from('engagement_history')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (action) {
        query = query.eq('action', action)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching engagement history:', error)
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // Get total counts
    const { count: totalCount } = await supabase
        .from('engagement_history')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId)

    const { count: engagedCount } = await supabase
        .from('engagement_history')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId)
        .eq('action', 'engaged')

    const { count: skippedCount } = await supabase
        .from('engagement_history')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId)
        .eq('action', 'skipped')

    return NextResponse.json({
        history: data,
        pagination: {
            total: totalCount || 0,
            limit,
            offset,
            hasMore: (offset + limit) < (totalCount || 0)
        },
        stats: {
            totalEngaged: engagedCount || 0,
            totalSkipped: skippedCount || 0,
            skipRate: (engagedCount || 0) + (skippedCount || 0) > 0
                ? Math.round(((skippedCount || 0) / ((engagedCount || 0) + (skippedCount || 0))) * 100)
                : 0
        }
    })
}
