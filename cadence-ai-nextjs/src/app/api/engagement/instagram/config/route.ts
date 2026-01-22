/**
 * Instagram Engagement Config API
 * GET - Fetch config and stats
 * PUT - Update config
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

interface InstagramConfig {
    hashtags: string[]
    targetAccounts: string[]
    minFollowers: number
    maxFollowers: number
    maxAgeHours: number
}

const DEFAULT_CONFIG: InstagramConfig = {
    hashtags: [],
    targetAccounts: [],
    minFollowers: 1000,
    maxFollowers: 100000,
    maxAgeHours: 48
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
    const { data: configData } = await supabase
        .from('instagram_engagement_config')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()

    // Fetch stats from history
    const { data: historyData } = await supabase
        .from('instagram_engagement')
        .select('status')
        .eq('telegram_id', telegramId)

    const totalEngaged = historyData?.filter(h => h.status === 'posted' || h.status === 'copied').length || 0
    const totalSkipped = historyData?.filter(h => h.status === 'skipped').length || 0
    const total = totalEngaged + totalSkipped
    const skipRate = total > 0 ? Math.round((totalSkipped / total) * 100) : 0

    const config: InstagramConfig = configData ? {
        hashtags: configData.hashtags || [],
        targetAccounts: configData.target_accounts || [],
        minFollowers: configData.min_followers || 1000,
        maxFollowers: configData.max_followers || 100000,
        maxAgeHours: configData.max_age_hours || 48
    } : DEFAULT_CONFIG

    return NextResponse.json({
        config,
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
        const config: InstagramConfig = await request.json()
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Upsert config
        const { error } = await supabase
            .from('instagram_engagement_config')
            .upsert({
                telegram_id: telegramId,
                hashtags: config.hashtags,
                target_accounts: config.targetAccounts,
                min_followers: config.minFollowers,
                max_followers: config.maxFollowers,
                max_age_hours: config.maxAgeHours,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'telegram_id'
            })

        if (error) {
            console.error('Failed to save Instagram config:', error)
            return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Instagram config PUT error:', error)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
