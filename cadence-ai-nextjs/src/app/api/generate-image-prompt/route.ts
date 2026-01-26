import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface GeneratePromptRequest {
    postId: string
    content: string
}

/**
 * Analyze post text and extract the core visual concept/meaning
 */
async function extractVisualMeaning(content: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `Analyze this social media post and extract the core visual concept that would make a compelling background image.

POST TEXT:
"${content}"

Your task:
1. Understand what this post is really about - the emotion, concept, or message
2. Think about what visual scene or imagery would represent this meaning
3. Output ONLY a concise image generation prompt (1-2 sentences max)

Rules:
- Focus on the MEANING, not literal text
- Describe a visual scene, mood, or abstract concept
- NO text in the image
- Make it visually interesting and artistic
- Be specific about colors, lighting, or composition if relevant

Examples:
- Post about productivity → "A serene minimalist workspace at golden hour with soft light streaming through windows"
- Post about crypto gains → "Abstract flowing golden particles rising upward against a deep purple void"
- Post about feeling stuck → "A single door of light at the end of a long dark corridor"

Output ONLY the image prompt, nothing else:`

    const result = await model.generateContent(prompt)
    const response = result.response.text().trim()

    return response
}

export async function POST(req: NextRequest) {
    console.log('[generate-image-prompt] API called')
    try {
        const body: GeneratePromptRequest = await req.json()
        const { postId, content } = body
        console.log('[generate-image-prompt] Request:', { postId, contentLength: content?.length })

        if (!postId || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: postId, content' },
                { status: 400 }
            )
        }

        // Extract visual meaning using Gemini
        const imagePrompt = await extractVisualMeaning(content)
        console.log('[generate-image-prompt] Generated prompt:', imagePrompt)

        // Save to database
        await fetch(
            `${SUPABASE_URL}/rest/v1/scheduled_posts?id=eq.${postId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ ai_image_prompt: imagePrompt })
            }
        )

        return NextResponse.json({
            success: true,
            imagePrompt
        })

    } catch (error) {
        console.error('Error generating image prompt:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate prompt' },
            { status: 500 }
        )
    }
}
