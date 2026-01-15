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

    // Brand info
    brandVoice?: string
    brandTone?: string
    emojiStyle?: string
    hashtags?: string[]
    projectName?: string

    // Context
    platform: 'x' | 'linkedin' | 'instagram'
    previousPosts?: string[] // Avoid repetition
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
            hashtags,
            projectName,
            platform,
            previousPosts = []
        } = body

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        // Build the prompt
        const platformConfig = {
            x: { maxLength: 280, name: 'Twitter/X' },
            linkedin: { maxLength: 2000, name: 'LinkedIn' },
            instagram: { maxLength: 2200, name: 'Instagram' }
        }

        const config = platformConfig[platform] || platformConfig.x

        const prompt = `You are a social media copywriter. Generate a unique, engaging ${config.name} post to promote this article/content.

CONTENT TO PROMOTE:
- Title: ${title}
${url ? `- URL: ${url}` : ''}
${summary ? `- Summary: ${summary}` : ''}
${keyPoints ? `- Key Points: ${keyPoints}` : ''}

BRAND GUIDELINES:
${projectName ? `- Brand: ${projectName}` : ''}
${brandVoice ? `- Voice: ${brandVoice}` : '- Voice: Professional but approachable'}
${brandTone ? `- Tone: ${brandTone}` : ''}
${emojiStyle === 'heavy' ? '- Use emojis liberally throughout the post' :
                emojiStyle === 'minimal' ? '- Use 1-2 emojis max' :
                    emojiStyle === 'none' ? '- Do not use any emojis' : '- Use emojis naturally where appropriate'}

PLATFORM CONSTRAINTS:
- Platform: ${config.name}
- Max Length: ${config.maxLength} characters
${platform === 'x' ? '- Be concise and punchy' : ''}
${platform === 'linkedin' ? '- Can be longer, more professional tone' : ''}
${platform === 'instagram' ? '- Engaging and visual-friendly language' : ''}

${previousPosts.length > 0 ? `
AVOID REPETITION - These posts were already generated for this content, create something DIFFERENT:
${previousPosts.map((p, i) => `${i + 1}. "${p}"`).join('\n')}

Make sure your new post has a completely different angle, hook, or framing.
` : ''}

${hashtags && hashtags.length > 0 ? `
HASHTAGS TO INCLUDE: ${hashtags.join(' ')}
` : ''}

Generate a single post that:
1. Has an attention-grabbing hook
2. Communicates the value clearly
3. ${url ? 'Includes a call-to-action to read/click the link' : 'Has a clear takeaway'}
4. Fits the platform style
5. Stays within the character limit

Return ONLY the post text, nothing else. Do not include quotes around it.`

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text().trim()

        // Clean up any surrounding quotes
        if ((text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))) {
            text = text.slice(1, -1)
        }

        return NextResponse.json({
            post: text,
            platform,
            characterCount: text.length,
            withinLimit: text.length <= config.maxLength
        })

    } catch (error) {
        console.error('Generate post error:', error)
        return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 })
    }
}
