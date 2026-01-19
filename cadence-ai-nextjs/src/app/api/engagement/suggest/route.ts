/**
 * Suggest Engagement Config from User Settings
 * POST - Use AI to extract keywords from brand voice and settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Fetch user settings
        const { data: settings } = await supabase
            .from('cadence_user_settings')
            .select('brand_voice, default_hashtags')
            .eq('telegram_id', telegramId)
            .single()

        const brandVoice = settings?.brand_voice || ''
        const defaultHashtags = settings?.default_hashtags || ''

        // Parse existing hashtags
        const hashtags: string[] = defaultHashtags
            .split(/[,\s]+/)
            .map((h: string) => h.trim())
            .filter((h: string) => h.length > 0)
            .map((h: string) => h.startsWith('#') ? h : `#${h}`)

        // If no brand voice, return just the hashtags
        if (!brandVoice.trim()) {
            return NextResponse.json({
                success: true,
                suggestions: {
                    keywords: [],
                    hashtags,
                    targetAccounts: []
                },
                message: 'No brand voice set. Add one in Settings for better suggestions.'
            })
        }

        // Use AI to extract keywords and suggest accounts
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `Based on this brand voice/description, extract relevant keywords and suggest Twitter accounts to follow/engage with.

BRAND VOICE:
"${brandVoice}"

Return a JSON object with:
1. "keywords" - Array of 5-8 relevant single-word or short-phrase keywords that people in this niche would tweet about
2. "targetAccounts" - Array of 3-5 real Twitter handles (without @) of thought leaders or accounts relevant to this niche

Focus on:
- Keywords that indicate the person is building something, sharing insights, or asking questions in this space
- Accounts that have engaged communities and post about related topics

Return ONLY valid JSON, no markdown:
{
    "keywords": ["keyword1", "keyword2"],
    "targetAccounts": ["handle1", "handle2"]
}`

        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text().trim()

        // Clean up markdown if present
        if (text.startsWith('```json')) text = text.slice(7)
        if (text.startsWith('```')) text = text.slice(3)
        if (text.endsWith('```')) text = text.slice(0, -3)
        text = text.trim()

        const parsed = JSON.parse(text)

        return NextResponse.json({
            success: true,
            suggestions: {
                keywords: parsed.keywords || [],
                hashtags,
                targetAccounts: (parsed.targetAccounts || []).map((a: string) =>
                    a.startsWith('@') ? a : `@${a}`
                )
            }
        })

    } catch (error) {
        console.error('Suggest engagement config error:', error)
        return NextResponse.json({
            error: 'Failed to generate suggestions'
        }, { status: 500 })
    }
}
