/**
 * Instagram Comment Suggestion API
 * POST - Generate AI comment suggestions for an Instagram post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkCredits, deductCredits, CREDIT_COSTS } from '@/lib/credits'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Use centralized credit costs
const COMMENT_SUGGESTION_COST = CREDIT_COSTS.instagram_comment_suggestion

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
        const { postUrl, postCaption, authorHandle, projectId } = body

        if (!postCaption) {
            return NextResponse.json({ error: 'Post caption is required for generating suggestions' }, { status: 400 })
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

        // Get project brand voice if projectId provided
        let projectBrandVoice = ''
        if (projectId) {
            const { data: project } = await supabase
                .from('projects')
                .select('brand_voice')
                .eq('id', projectId)
                .single()
            projectBrandVoice = project?.brand_voice || ''
        }

        const effectiveBrandVoice = projectBrandVoice || brandVoice

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `You are helping craft comments for Instagram posts. Generate 3 different comment options that would be valuable, authentic contributions that could lead to genuine connections and followers.

INSTAGRAM POST TO COMMENT ON:
Author: @${authorHandle || 'instagram_user'}
Caption: "${postCaption}"
${postUrl ? `URL: ${postUrl}` : ''}

BRAND CONTEXT:
${effectiveBrandVoice ? `- Brand/Expertise: ${effectiveBrandVoice}` : '- Be helpful and authentic'}
- Tone: ${tone}
- Perspective: Use "${speakingPerspective}" voice
- Emoji Style: ${emojiStyle === 'heavy' ? 'Use 1-3 emojis naturally' : emojiStyle === 'minimal' ? 'Use 1 emoji maximum' : emojiStyle === 'none' ? 'No emojis' : 'Use 1-2 emojis if natural'}

INSTAGRAM COMMENT GUIDELINES:
1. Comments should feel genuine and human, not like marketing copy
2. Add real value - share insight, ask a thoughtful question, or relate with personal experience
3. Keep comments between 30-150 characters for best engagement
4. Don't be salesy or self-promotional
5. Don't use excessive emojis or all caps
6. Don't start with generic phrases like "Great post!" or "Love this!"
7. Different comments should take different approaches:
   - One that shares a relevant personal insight or experience
   - One that asks a thoughtful, engaging question
   - One that adds context or a complementary perspective

IMPORTANT: Make comments feel authentic and like they come from a real person who genuinely relates to the content.

Return ONLY a JSON array with 3 comment options, nothing else:
[
    {"text": "Comment option 1", "approach": "brief description of approach"},
    {"text": "Comment option 2", "approach": "brief description of approach"},
    {"text": "Comment option 3", "approach": "brief description of approach"}
]`

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
            'instagram_comment_suggestion',
            `Instagram comment suggestions for @${authorHandle}`
        )

        return NextResponse.json({
            success: true,
            suggestions: suggestions.map((s: { text: string; approach: string }, i: number) => ({
                id: `suggestion-${i}`,
                text: s.text,
                approach: s.approach,
                characterCount: s.text.length
            })),
            creditsUsed: COMMENT_SUGGESTION_COST
        })
    } catch (error) {
        console.error('Instagram suggest error:', error)
        return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }
}
