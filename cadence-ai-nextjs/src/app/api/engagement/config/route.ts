/**
 * Engagement Config API
 * GET - Fetch user's engagement configuration
 * PUT - Update user's engagement configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

// Default config values
const DEFAULT_CONFIG = {
    keywords: [],
    hashtags: [],
    targetAccounts: [],
    minFollowers: 100,
    maxFollowers: 100000,
    minEngagement: 5,
    maxAgeHours: 24
}

function getAuthenticatedUser(request: NextRequest): string | null {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) return null

    const session = verifySessionToken(sessionToken, sessionSecret)
    return session?.telegram_id || null
}

export async function GET(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch config
    const { data: config, error } = await supabase
        .from('engagement_config')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching engagement config:', error)
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }

    // Fetch stats
    const { data: stats } = await supabase
        .from('engagement_history')
        .select('action')
        .eq('telegram_id', telegramId)

    const totalEngaged = stats?.filter(s => s.action === 'engaged').length || 0
    const totalSkipped = stats?.filter(s => s.action === 'skipped').length || 0
    const skipRate = totalEngaged + totalSkipped > 0
        ? Math.round((totalSkipped / (totalEngaged + totalSkipped)) * 100)
        : 0

    // Transform to frontend format
    const responseConfig = config ? {
        keywords: config.keywords || [],
        hashtags: config.hashtags || [],
        targetAccounts: config.target_accounts || [],
        minFollowers: config.min_followers || DEFAULT_CONFIG.minFollowers,
        maxFollowers: config.max_followers || DEFAULT_CONFIG.maxFollowers,
        minEngagement: config.min_engagement || DEFAULT_CONFIG.minEngagement,
        maxAgeHours: config.max_age_hours || DEFAULT_CONFIG.maxAgeHours
    } : DEFAULT_CONFIG

    return NextResponse.json({
        config: responseConfig,
        stats: {
            totalEngaged,
            totalSkipped,
            skipRate
        }
    })
}

export async function PUT(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Upsert config
        const { data, error } = await supabase
            .from('engagement_config')
            .upsert(
                {
                    telegram_id: telegramId,
                    keywords: body.keywords || [],
                    hashtags: body.hashtags || [],
                    target_accounts: body.targetAccounts || [],
                    min_followers: body.minFollowers || DEFAULT_CONFIG.minFollowers,
                    max_followers: body.maxFollowers || DEFAULT_CONFIG.maxFollowers,
                    min_engagement: body.minEngagement || DEFAULT_CONFIG.minEngagement,
                    max_age_hours: body.maxAgeHours || DEFAULT_CONFIG.maxAgeHours,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'telegram_id'
                }
            )
            .select()
            .single()

        if (error) {
            console.error('Error updating engagement config:', error)
            return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            config: {
                keywords: data.keywords || [],
                hashtags: data.hashtags || [],
                targetAccounts: data.target_accounts || [],
                minFollowers: data.min_followers,
                maxFollowers: data.max_followers,
                minEngagement: data.min_engagement,
                maxAgeHours: data.max_age_hours
            }
        })
    } catch (error) {
        console.error('Error updating engagement config:', error)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
