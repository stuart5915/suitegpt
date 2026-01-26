import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Gemini config
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface GenerateAiBackgroundRequest {
    postId: string
    platform: string
    content: string
    customPrompt?: string  // User-defined or AI-extracted prompt
}

/**
 * Generate an AI image with Gemini based on prompt
 */
async function generateGeminiImage(prompt: string, platform: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        console.log('[generate-ai-background] Generating Gemini AI image...')
        console.log('[generate-ai-background] Using prompt:', prompt)

        // Add platform-specific orientation
        const orientationHint = platform === 'tiktok'
            ? 'Vertical/portrait orientation.'
            : platform === 'instagram'
                ? 'Square format.'
                : 'Landscape/wide format.'

        const imagePrompt = `${prompt}. ${orientationHint} No text in the image.`

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
        })

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Generate an image: ${imagePrompt}` }] }],
            generationConfig: {
                // @ts-ignore - Gemini image generation config
                responseModalities: ['image', 'text'],
            },
        })

        // Extract image from response
        const response = result.response
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
            (part: any) => part.inlineData?.mimeType?.startsWith('image/')
        )

        if (imagePart?.inlineData?.data) {
            console.log('[generate-ai-background] Gemini image generated successfully')
            return {
                data: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType
            }
        }

        console.log('[generate-ai-background] No image in Gemini response')
        return null
    } catch (error) {
        console.error('[generate-ai-background] Gemini image generation failed:', error)
        throw error
    }
}

export async function POST(req: NextRequest) {
    console.log('[generate-ai-background] API called')
    try {
        const body: GenerateAiBackgroundRequest = await req.json()
        const { postId, platform, content, customPrompt } = body
        console.log('[generate-ai-background] Request:', { postId, platform, contentLength: content?.length, hasCustomPrompt: !!customPrompt })

        if (!postId || !platform || !content) {
            console.log('[generate-ai-background] Missing fields')
            return NextResponse.json(
                { error: 'Missing required fields: postId, platform, content' },
                { status: 400 }
            )
        }

        // Use custom prompt if provided, otherwise use content directly
        const promptToUse = customPrompt || `Visual representation of: ${content.substring(0, 200)}`

        // Generate AI background image with Gemini
        const geminiResult = await generateGeminiImage(promptToUse, platform)

        if (!geminiResult) {
            return NextResponse.json(
                { error: 'Gemini failed to generate an image' },
                { status: 500 }
            )
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(geminiResult.data, 'base64')

        // Determine file extension from mime type
        const ext = geminiResult.mimeType.includes('jpeg') || geminiResult.mimeType.includes('jpg') ? 'jpg' : 'png'

        // Upload to Supabase storage
        const fileName = `ai-backgrounds/${postId}-${Date.now()}.${ext}`
        console.log('[generate-ai-background] Uploading to:', fileName)
        let imageUrl: string

        try {
            const uploadResponse = await fetch(
                `${SUPABASE_URL}/storage/v1/object/content/${fileName}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': geminiResult.mimeType,
                        'x-upsert': 'true'
                    },
                    body: imageBuffer
                }
            )

            if (uploadResponse.ok) {
                imageUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${fileName}`
            } else {
                console.error('Storage upload failed:', await uploadResponse.text())
                // Fallback to data URL
                imageUrl = `data:${geminiResult.mimeType};base64,${geminiResult.data}`
            }
        } catch (uploadError) {
            console.error('Storage upload error:', uploadError)
            imageUrl = `data:${geminiResult.mimeType};base64,${geminiResult.data}`
        }

        // Update the post with the AI background URL
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
                body: JSON.stringify({ ai_background_url: imageUrl })
            }
        )

        return NextResponse.json({
            success: true,
            aiBackgroundUrl: imageUrl,
        })

    } catch (error) {
        console.error('Error generating AI background:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate AI background' },
            { status: 500 }
        )
    }
}
