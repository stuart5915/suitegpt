import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface GeneratePostRequest {
    // Content info
    title: string
    url?: string
    summary?: string
    keyPoints?: string

    // Brand info (can be passed directly or fetched from settings)
    brandVoice?: string
    brandTone?: string
    emojiStyle?: string
    speakingPerspective?: string
    exclusionWords?: string
    hashtags?: string[]
    projectName?: string

    // Context
    platform: 'x' | 'linkedin' | 'instagram'
    previousPosts?: string[] // Avoid repetition

    // Mode
    mode?: 'single' | 'thread' | 'poll' | 'ai_fleet'
    pollOptions?: string[] // For poll mode - the 4 app ideas
    buildNumber?: string // For ai_fleet mode
    freeFeatures?: string[] // For ai_fleet mode - free features
    proFeatures?: string[] // For ai_fleet mode - paid features

    // Audience targeting (supports both legacy and new format)
    audience?: {
        name: string
        description: string
        painPoints: string[]
        desires: string[]
        messagingAngle?: string           // Legacy single angle
        messagingAngles?: string[]        // New array of angles
        cta: string
        referenceLinks?: {
            url: string
            title: string
            notes?: string
        }[]
        usageHistory?: {
            lastAngleIndex: number
            lastLinkIndex: number
            generatedCount: number
        }
    }
    variant?: {
        hook?: string
        keyPoints?: string[]
        cta?: string
    }
}

interface PollResponse {
    success: true
    mode: 'poll'
    mainPost: string
    poll: {
        question: string
        options: string[]
        durationMinutes: number
    }
    platform: string
}

interface SingleResponse {
    success: true
    mode: 'single'
    post: string
    platform: string
    characterCount: number
    withinLimit: boolean
    // For audience cycling - return updated history to persist
    updatedUsageHistory?: {
        lastAngleIndex: number
        lastLinkIndex: number
        generatedCount: number
    }
    selectedAngle?: string
    selectedReferenceLink?: {
        url: string
        title: string
        notes?: string
    }
}

interface ThreadResponse {
    success: true
    mode: 'thread'
    mainPost: string
    replyPost: string
    platform: string
}

export async function POST(request: NextRequest) {
    try {
        const body: GeneratePostRequest = await request.json()

        const {
            title,
            url,
            summary,
            keyPoints,
            brandVoice,
            brandTone,
            emojiStyle,
            speakingPerspective = 'I',
            exclusionWords,
            hashtags,
            projectName,
            platform,
            previousPosts = [],
            mode = 'single',
            pollOptions = [],
            buildNumber = '',
            freeFeatures = [],
            proFeatures = [],
            audience,
            variant
        } = body

        if (!title && mode !== 'poll') {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        if (mode === 'poll' && pollOptions.length !== 4) {
            return NextResponse.json({ error: 'Poll mode requires exactly 4 options' }, { status: 400 })
        }

        // Platform config
        const platformConfig = {
            x: { maxLength: 280, name: 'Twitter/X' },
            linkedin: { maxLength: 2000, name: 'LinkedIn' },
            instagram: { maxLength: 2200, name: 'Instagram' }
        }

        const config = platformConfig[platform] || platformConfig.x
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // Build brand context section
        const brandContext = `
BRAND VOICE & STYLE:
${brandVoice ? `- Brand Personality: ${brandVoice}` : '- Brand: Direct, helpful, building in public'}
${brandTone ? `- Tone: ${brandTone}` : '- Tone: Casual but knowledgeable'}
- Speaking Perspective: Use "${speakingPerspective}" (${speakingPerspective === 'I' ? 'solo founder' : speakingPerspective === 'We' ? 'team' : 'audience-focused'})
${emojiStyle === 'heavy' ? '- Emoji Style: Use emojis liberally (2-4 per post)' :
                emojiStyle === 'minimal' ? '- Emoji Style: Use 1 emoji max, or none' :
                    emojiStyle === 'none' ? '- Emoji Style: Do NOT use any emojis' : '- Emoji Style: Use 1-2 emojis naturally'}

${exclusionWords ? `
BANNED WORDS - NEVER USE THESE:
${exclusionWords}
If you catch yourself using any of these words, rewrite to avoid them.
` : ''}
`

        const qualityRules = `
QUALITY RULES:
1. Vary your hooks - don't always start with an emoji or "Just..."
2. Be specific and concrete, not generic or vague
3. Show personality - sound human, not corporate
4. Create curiosity or provide immediate value
5. Keep it conversational, not salesy
6. ${platform === 'x' ? 'Be punchy - every word must earn its place' : 'Be engaging but get to the point'}
`

        // POLL MODE - For AI Fleet "what to build next" polls
        if (mode === 'poll') {
            const pollPrompt = `You are helping create a Twitter poll for the AI Fleet - a project that ships AI-powered micro apps daily.

CONTEXT:
The AI Fleet is a collection of autonomous AI apps. The audience votes on what app the Fleet should build next.

THE 4 APP IDEAS FOR THE POLL:
1. ${pollOptions[0]}
2. ${pollOptions[1]}
3. ${pollOptions[2]}
4. ${pollOptions[3]}

TASK: Generate the poll question only. Keep it short and on-brand for AI Fleet.

Return your response in this EXACT JSON format (no markdown, no code blocks):
{
    "pollQuestion": "What should the AI Fleet ship next?",
    "pollOptions": ["Short name 1", "Short name 2", "Short name 3", "Short name 4"]
}

RULES:
- pollQuestion should reference "AI Fleet" - examples: "What should the AI Fleet ship next?", "Next AI Fleet build:", "Voting on the next Fleet app:"
- pollOptions should be SHORT (max 25 chars each) - just the app names, not descriptions
- Keep the question punchy and direct

Return ONLY the JSON object, nothing else.`

            const result = await model.generateContent(pollPrompt)
            const response = await result.response
            let text = response.text().trim()

            // Clean up markdown code blocks if present
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

            try {
                const parsed = JSON.parse(text)
                return NextResponse.json({
                    success: true,
                    mode: 'poll',
                    mainPost: '', // Main post is generated separately via ai_fleet mode
                    poll: {
                        question: parsed.pollQuestion || "What should the AI Fleet ship next?",
                        options: parsed.pollOptions || pollOptions.map(o => o.slice(0, 25)),
                        durationMinutes: 1440 // 24 hours
                    },
                    platform
                } as PollResponse)
            } catch (parseError) {
                console.error('Failed to parse poll response:', text)
                // Fallback response
                return NextResponse.json({
                    success: true,
                    mode: 'poll',
                    mainPost: '',
                    poll: {
                        question: "What should the AI Fleet ship next?",
                        options: pollOptions.map(o => o.slice(0, 25)),
                        durationMinutes: 1440
                    },
                    platform
                } as PollResponse)
            }
        }

        // THREAD MODE
        if (mode === 'thread') {
            const threadPrompt = `You are a social media expert creating a 2-part thread.

${brandContext}

CONTENT TO PROMOTE:
- Title: ${title}
${url ? `- URL: ${url}` : ''}
${summary ? `- Summary: ${summary}` : ''}
${keyPoints ? `- Key Points: ${keyPoints}` : ''}

${qualityRules}

TASK: Generate a 2-tweet thread.

Tweet 1 (Main): The hook that grabs attention and makes people want to read more. Max 280 chars.
Tweet 2 (Reply): The value/details and call-to-action. Can include the URL. Max 280 chars.

${previousPosts.length > 0 ? `
AVOID - These were already generated, be DIFFERENT:
${previousPosts.slice(0, 3).map((p, i) => `${i + 1}. "${p.slice(0, 100)}..."`).join('\n')}
` : ''}

Return your response in this EXACT JSON format (no markdown):
{
    "mainPost": "The attention-grabbing first tweet",
    "replyPost": "The follow-up with details and CTA"
}

Return ONLY the JSON object.`

            const result = await model.generateContent(threadPrompt)
            const response = await result.response
            let text = response.text().trim()

            // Clean up markdown
            if (text.startsWith('```json')) text = text.slice(7)
            if (text.startsWith('```')) text = text.slice(3)
            if (text.endsWith('```')) text = text.slice(0, -3)
            text = text.trim()

            try {
                const parsed = JSON.parse(text)
                return NextResponse.json({
                    success: true,
                    mode: 'thread',
                    mainPost: parsed.mainPost,
                    replyPost: parsed.replyPost,
                    platform
                } as ThreadResponse)
            } catch (parseError) {
                return NextResponse.json({ error: 'Failed to parse thread response' }, { status: 500 })
            }
        }

        // AI FLEET MODE - Punchy app launch announcement with features
        if (mode === 'ai_fleet') {
            // Extract app name from title (format: "AppName - tagline")
            const appName = title.split(' - ')[0] || title
            const tagline = title.split(' - ')[1] || summary || ''

            // Format features for prompt
            const hasFreeFeatures = freeFeatures && freeFeatures.length > 0
            const hasProFeatures = proFeatures && proFeatures.length > 0
            const freeList = hasFreeFeatures ? freeFeatures.slice(0, 3).join(', ') : ''
            const proList = hasProFeatures ? proFeatures.slice(0, 3).join(', ') : ''

            const aiFleetPrompt = `You are writing a punchy Twitter announcement for an AI Fleet app launch.

CONTEXT:
- The AI Fleet ships AI-powered micro apps daily
- This is Build #${buildNumber || '??'}
- App name: ${appName}
- What it does: ${tagline}
${hasFreeFeatures ? `- Free features: ${freeList}` : ''}
${hasProFeatures ? `- Pro features (paid): ${proList}` : ''}

TASK: Write a short announcement tweet that includes what's free and what's paid (if applicable). NO links. NO hashtags.

FORMAT (follow this structure):
Line 1: "AI Fleet #${buildNumber || '??'}: ${appName}"
Line 2: (blank)
Line 3: 1 line describing what the app does
Line 4: (blank)
Line 5: 🆓 [condensed free features]
Line 6: 💎 [condensed pro features] (only if pro features exist)

EXAMPLES OF GOOD POSTS:
"AI Fleet #47: FoodVitals

Scan meals → instant nutrition.

🆓 Meal scanning, basic nutrition
💎 AI meal plans, macro tracking"

"AI Fleet #48: HabitStack

Stack tiny habits. Track streaks.

🆓 Habit tracking, daily streaks
💎 AI coaching, analytics"

RULES:
- Maximum 280 characters total
- NO links
- NO hashtags
- Use 🆓 for free features, 💎 for pro features
- Condense features to short phrases (2-4 words each)
- If no pro features, skip the 💎 line entirely
- Be specific, not generic

Return ONLY the tweet text, nothing else.`

            const result = await model.generateContent(aiFleetPrompt)
            const response = await result.response
            let text = response.text().trim()

            // Clean up any surrounding quotes
            if ((text.startsWith('"') && text.endsWith('"')) ||
                (text.startsWith("'") && text.endsWith("'"))) {
                text = text.slice(1, -1)
            }

            return NextResponse.json({
                success: true,
                mode: 'single',
                post: text,
                platform,
                characterCount: text.length,
                withinLimit: text.length <= config.maxLength
            } as SingleResponse)
        }

        // Build audience targeting context with cycling logic
        let selectedAngle: string | undefined
        let selectedReferenceLink: { url: string; title: string; notes?: string } | undefined
        let updatedUsageHistory: { lastAngleIndex: number; lastLinkIndex: number; generatedCount: number } | undefined

        let audienceContext = ''
        if (audience) {
            // Get messaging angles array (support legacy single string)
            const messagingAngles = audience.messagingAngles && audience.messagingAngles.length > 0
                ? audience.messagingAngles
                : audience.messagingAngle
                    ? [audience.messagingAngle]
                    : ['Address their needs directly']

            // Calculate next angle index (round-robin cycling)
            const currentAngleIndex = audience.usageHistory?.lastAngleIndex ?? -1
            const nextAngleIndex = (currentAngleIndex + 1) % messagingAngles.length
            selectedAngle = messagingAngles[nextAngleIndex]

            // Calculate next reference link index (if any)
            let nextLinkIndex = audience.usageHistory?.lastLinkIndex ?? -1
            if (audience.referenceLinks && audience.referenceLinks.length > 0) {
                nextLinkIndex = (nextLinkIndex + 1) % audience.referenceLinks.length
                selectedReferenceLink = audience.referenceLinks[nextLinkIndex]
            }

            // Build updated usage history
            const currentGeneratedCount = audience.usageHistory?.generatedCount ?? 0
            updatedUsageHistory = {
                lastAngleIndex: nextAngleIndex,
                lastLinkIndex: nextLinkIndex,
                generatedCount: currentGeneratedCount + 1
            }

            // Build the context string
            audienceContext = `
TARGET AUDIENCE: ${audience.name}
${audience.description}

Their Pain Points:
${audience.painPoints.map(p => `- ${p}`).join('\n')}

What They Want:
${audience.desires.map(d => `- ${d}`).join('\n')}

MESSAGING ANGLE FOR THIS POST: ${selectedAngle}
${selectedReferenceLink ? `
REFERENCE ARTICLE (use if relevant, don't force it):
- Title: ${selectedReferenceLink.title}
- URL: ${selectedReferenceLink.url}
${selectedReferenceLink.notes ? `- Context: ${selectedReferenceLink.notes}` : ''}
` : ''}
CALL TO ACTION: ${audience.cta}

VARIATION REQUIREMENTS:
- This is post #${updatedUsageHistory.generatedCount} for ${audience.name}
- You are using messaging angle ${nextAngleIndex + 1} of ${messagingAngles.length}
${messagingAngles.length > 1 ? `- Other angles NOT to use this time: ${messagingAngles.filter((_, i) => i !== nextAngleIndex).slice(0, 2).map(a => `"${a.slice(0, 50)}..."`).join(', ')}` : ''}
- Create something fresh and novel for this audience

IMPORTANT: Write this post specifically for ${audience.name}. Address their pain points and desires directly. Use the messaging angle provided.
`
        }

        // Build variant overrides
        const variantContext = variant ? `
CONTENT OVERRIDES FOR THIS AUDIENCE:
${variant.hook ? `- Custom Hook: "${variant.hook}"` : ''}
${variant.keyPoints && variant.keyPoints.length > 0 ? `- Key Points to Emphasize:\n${variant.keyPoints.map(k => `  • ${k}`).join('\n')}` : ''}
${variant.cta ? `- Custom CTA: "${variant.cta}"` : ''}
` : ''

        // SINGLE MODE (default)
        const singlePrompt = `You are a social media copywriter creating a ${config.name} post.

${brandContext}

CONTENT TO PROMOTE:
- Title: ${title}
${url ? `- URL: ${url}` : ''}
${summary ? `- Summary: ${summary}` : ''}
${keyPoints ? `- Key Points: ${keyPoints}` : ''}
${projectName ? `- For: ${projectName}` : ''}

${audienceContext}
${variantContext}

${qualityRules}

PLATFORM: ${config.name}
MAX LENGTH: ${config.maxLength} characters

${previousPosts.length > 0 ? `
AVOID REPETITION - These were already generated, create something DIFFERENT:
${previousPosts.slice(0, 5).map((p, i) => `${i + 1}. "${p.slice(0, 80)}..."`).join('\n')}

Use a completely different angle, hook, or framing.
` : ''}

${hashtags && hashtags.length > 0 ? `INCLUDE HASHTAGS: ${hashtags.join(' ')}` : ''}

Generate a single engaging post. Return ONLY the post text, no quotes, no explanation.`

        const result = await model.generateContent(singlePrompt)
        const response = await result.response
        let text = response.text().trim()

        // Clean up any surrounding quotes
        if ((text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))) {
            text = text.slice(1, -1)
        }

        return NextResponse.json({
            success: true,
            mode: 'single',
            post: text,
            platform,
            characterCount: text.length,
            withinLimit: text.length <= config.maxLength,
            // Include cycling info for caller to update audience
            ...(updatedUsageHistory && { updatedUsageHistory }),
            ...(selectedAngle && { selectedAngle }),
            ...(selectedReferenceLink && { selectedReferenceLink })
        } as SingleResponse)

    } catch (error) {
        console.error('Generate post error:', error)
        return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 })
    }
}
