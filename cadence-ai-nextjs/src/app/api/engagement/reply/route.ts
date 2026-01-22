/**
 * Engagement Reply API
 * POST - Generate reply suggestions OR post a reply
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'
import { postReply } from '@/lib/twitter'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { deductCredits, CREDIT_COSTS } from '@/lib/credits'

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

    try {
        const body = await request.json()
        const { action } = body

        if (action === 'generate') {
            return handleGenerate(body, telegramId)
        } else if (action === 'post') {
            return handlePost(body, telegramId)
        } else {
            return NextResponse.json({ error: 'Invalid action. Use "generate" or "post"' }, { status: 400 })
        }

    } catch (error) {
        console.error('Reply API error:', error)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

// Generate reply suggestions
async function handleGenerate(
    body: {
        tweetContent: string
        authorHandle: string
        suggestedAngle?: string
    },
    telegramId: string
): Promise<NextResponse> {
    const { tweetContent, authorHandle, suggestedAngle } = body

    if (!tweetContent || !authorHandle) {
        return NextResponse.json({ error: 'tweetContent and authorHandle are required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's brand voice settings
    const { data: settings } = await supabase
        .from('cadence_user_settings')
        .select('brand_voice, tone, speaking_perspective, emoji_style')
        .eq('telegram_id', telegramId)
        .single()

    const brandVoice = settings?.brand_voice || ''
    const tone = settings?.tone || 'casual'
    const speakingPerspective = settings?.speaking_perspective || 'I'
    const emojiStyle = settings?.emoji_style || 'moderate'

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are helping craft replies to tweets. Generate 3 different reply options that would be valuable contributions to the conversation.

TWEET TO REPLY TO:
@${authorHandle}: "${tweetContent}"

${suggestedAngle ? `SUGGESTED ANGLE: ${suggestedAngle}` : ''}

BRAND CONTEXT:
${brandVoice ? `- Brand/Expertise: ${brandVoice}` : '- Be helpful and authentic'}
- Tone: ${tone}
- Perspective: Use "${speakingPerspective}" voice
- Emoji Style: ${emojiStyle === 'heavy' ? 'Use 1-2 emojis' : emojiStyle === 'minimal' ? 'Use sparingly or none' : emojiStyle === 'none' ? 'No emojis' : 'Use 1 emoji if natural'}

REPLY GUIDELINES:
1. Add genuine value - share insight, ask a good question, or build on their point
2. Be conversational and human, not salesy
3. Keep replies under 200 characters for impact
4. Don't be sycophantic or overly agreeable
5. Different replies should take different approaches:
   - One that shares personal experience/insight
   - One that asks a thoughtful question
   - One that offers a complementary perspective or adds context

Return ONLY a JSON array with 3 reply options, nothing else:
[
    {"text": "Reply option 1", "approach": "brief description of approach"},
    {"text": "Reply option 2", "approach": "brief description of approach"},
    {"text": "Reply option 3", "approach": "brief description of approach"}
]`

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text().trim()

        // Clean up markdown if present
        if (text.startsWith('```json')) {
            text = text.slice(7)
        }
        if (text.startsWith('```')) {
            text = text.slice(3)
        }
        if (text.endsWith('```')) {
            text = text.slice(0, -3)
        }
        text = text.trim()

        const suggestions = JSON.parse(text)

        // Deduct credits (will be free for demo mode if no wallet linked)
        await deductCredits(
            { telegramId },
            'twitter_reply_suggestion',
            `Twitter reply suggestions for @${authorHandle}`
        )

        return NextResponse.json({
            success: true,
            suggestions: suggestions.map((s: { text: string; approach: string }, i: number) => ({
                id: `suggestion-${i}`,
                text: s.text,
                approach: s.approach,
                characterCount: s.text.length
            })),
            creditsUsed: CREDIT_COSTS.twitter_reply_suggestion
        })
    } catch (error) {
        console.error('Error generating replies:', error)
        return NextResponse.json({ error: 'Failed to generate replies' }, { status: 500 })
    }
}

// Post a reply to Twitter
async function handlePost(
    body: {
        tweetId: string
        replyText: string
        authorHandle: string
        authorFollowers: number
        matchedKeywords: string[]
        contentPreview: string
    },
    telegramId: string
): Promise<NextResponse> {
    const { tweetId, replyText, authorHandle, authorFollowers, matchedKeywords, contentPreview } = body

    if (!tweetId || !replyText) {
        return NextResponse.json({ error: 'tweetId and replyText are required' }, { status: 400 })
    }

    // Check character limit
    if (replyText.length > 280) {
        return NextResponse.json({ error: 'Reply exceeds 280 character limit' }, { status: 400 })
    }

    // Post to Twitter
    const result = await postReply(replyText, tweetId)

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Record in history
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase
        .from('engagement_history')
        .insert({
            telegram_id: telegramId,
            tweet_id: tweetId,
            action: 'engaged',
            reply_content: replyText,
            author_handle: authorHandle,
            author_followers: authorFollowers,
            matched_keywords: matchedKeywords || [],
            content_preview: contentPreview?.slice(0, 200)
        })

    return NextResponse.json({
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl
    })
}
