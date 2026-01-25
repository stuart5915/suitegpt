import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
    PLATFORM_DIMENSIONS,
    TEMPLATES,
    selectTemplate,
    extractHeadline,
    extractSubheadline,
} from '@/lib/image-templates'

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Gemini config
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface GenerateImageRequest {
    postId: string
    platform: string
    content: string
    templateId?: string  // Optional: force a specific template
}

/**
 * Generate an AI image with Gemini based on post content
 */
async function generateGeminiImage(content: string, platform: string): Promise<string | null> {
    try {
        console.log('[generate-image] Generating Gemini AI image...')

        // Create a prompt for image generation based on post content
        const imagePrompt = `Create a visually striking, professional social media background image that represents this concept: "${content.substring(0, 200)}".
Style: Modern, tech-forward, clean aesthetic with subtle gradients.
DO NOT include any text in the image.
The image should work well as a background with text overlay.
Make it visually interesting but not too busy - leave space for text.
Use a color palette that works with purple/magenta accents.
${platform === 'tiktok' ? 'Vertical orientation, portrait mode.' : platform === 'instagram' ? 'Square format.' : 'Landscape, wide format.'}`

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
            console.log('[generate-image] Gemini image generated successfully')
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
        }

        console.log('[generate-image] No image in Gemini response')
        return null
    } catch (error) {
        console.error('[generate-image] Gemini image generation failed:', error)
        return null
    }
}

export async function POST(req: NextRequest) {
    console.log('[generate-image] API called - VERSION 3.0 WITH GEMINI AI')
    try {
        const body: GenerateImageRequest = await req.json()
        const { postId, platform, content, templateId } = body
        console.log('[generate-image] Request:', { postId, platform, contentLength: content?.length, templateId })

        if (!postId || !platform || !content) {
            console.log('[generate-image] Missing fields')
            return NextResponse.json(
                { error: 'Missing required fields: postId, platform, content' },
                { status: 400 }
            )
        }

        // Get dimensions for platform
        const dimensions = PLATFORM_DIMENSIONS[platform as keyof typeof PLATFORM_DIMENSIONS]
            || PLATFORM_DIMENSIONS.x

        // Select template (either forced or auto-selected)
        const template = templateId
            ? TEMPLATES.find(t => t.id === templateId) || selectTemplate(content)
            : selectTemplate(content)
        console.log('[generate-image] Selected template:', template.id, template.name)

        // Extract text for the image
        const headline = extractHeadline(content, platform === 'x' ? 50 : 60)
        const subheadline = extractSubheadline(content, platform === 'x' ? 80 : 100)
        console.log('[generate-image] Headline:', headline)
        console.log('[generate-image] Subheadline:', subheadline)

        // Generate AI background image with Gemini
        const aiBackgroundImage = await generateGeminiImage(content, platform)
        const hasAiBackground = !!aiBackgroundImage

        // Generate the image using next/og with AI background
        const imageResponse = new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: template.background,
                    }}
                >
                    {/* AI Generated Background Image */}
                    {hasAiBackground && (
                        <img
                            src={aiBackgroundImage}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    )}

                    {/* Dark overlay for text readability */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: hasAiBackground
                                ? 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.8) 100%)'
                                : 'transparent',
                        }}
                    />

                    {/* Content container */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: template.style === 'centered' ? 'center' : 'flex-start',
                            justifyContent: 'center',
                            textAlign: template.style === 'centered' ? 'center' : 'left',
                            maxWidth: '90%',
                            padding: '60px',
                            zIndex: 10,
                        }}
                    >
                        {/* Logo / Brand */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '30px',
                            }}
                        >
                            <img
                                src={`${req.nextUrl.origin}/suitegpt-logo.png`}
                                width={48}
                                height={48}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                }}
                            />
                            <span
                                style={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    letterSpacing: '-0.02em',
                                    textShadow: hasAiBackground ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                                }}
                            >
                                SuiteGPT
                            </span>
                        </div>

                        {/* Headline */}
                        <h1
                            style={{
                                fontSize: platform === 'tiktok' ? '64px' : platform === 'instagram' ? '56px' : '48px',
                                fontWeight: 800,
                                color: '#ffffff',
                                lineHeight: 1.1,
                                margin: 0,
                                marginBottom: '20px',
                                letterSpacing: '-0.03em',
                                maxWidth: '100%',
                                textShadow: hasAiBackground ? '0 2px 8px rgba(0,0,0,0.7)' : 'none',
                            }}
                        >
                            {headline}
                        </h1>

                        {/* Subheadline */}
                        <p
                            style={{
                                fontSize: platform === 'tiktok' ? '28px' : '24px',
                                color: 'rgba(255,255,255,0.9)',
                                lineHeight: 1.4,
                                margin: 0,
                                maxWidth: '90%',
                                textShadow: hasAiBackground ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
                            }}
                        >
                            {subheadline}
                        </p>

                        {/* Accent line */}
                        <div
                            style={{
                                width: '80px',
                                height: '4px',
                                background: template.accentColor,
                                borderRadius: '2px',
                                marginTop: '30px',
                            }}
                        />

                        {/* Tagline */}
                        <p
                            style={{
                                fontSize: '18px',
                                color: 'rgba(255,255,255,0.8)',
                                marginTop: '20px',
                                textShadow: hasAiBackground ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                            }}
                        >
                            suitegpt.app • Real apps, not answers.
                        </p>
                    </div>
                </div>
            ),
            {
                width: dimensions.width,
                height: dimensions.height,
            }
        )

        // Convert to buffer for storage
        console.log('[generate-image] Converting ImageResponse to buffer...')
        const imageBuffer = await imageResponse.arrayBuffer()
        console.log('[generate-image] Buffer size:', imageBuffer.byteLength)
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        // Try to upload to Supabase storage via REST API
        const fileName = `post-images/${postId}-${Date.now()}.png`
        console.log('[generate-image] Uploading to:', fileName)
        let imageUrl: string

        try {
            const uploadResponse = await fetch(
                `${SUPABASE_URL}/storage/v1/object/content/${fileName}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'image/png',
                        'x-upsert': 'true'
                    },
                    body: imageBuffer
                }
            )

            if (uploadResponse.ok) {
                // Get public URL
                imageUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${fileName}`
            } else {
                console.error('Storage upload failed:', await uploadResponse.text())
                // Fallback to data URL
                imageUrl = `data:image/png;base64,${base64Image}`
            }
        } catch (uploadError) {
            console.error('Storage upload error:', uploadError)
            // Fallback to data URL
            imageUrl = `data:image/png;base64,${base64Image}`
        }

        // Update the post with the image URL via REST API
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
                body: JSON.stringify({ images: [imageUrl] })
            }
        )

        return NextResponse.json({
            success: true,
            imageUrl,
            template: template.id,
            templateName: template.name,
            hasAiBackground
        })

    } catch (error) {
        console.error('Error generating image:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate image' },
            { status: 500 }
        )
    }
}

// GET endpoint for previewing templates
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams
    const templateId = searchParams.get('template') || 'launch'
    const platform = searchParams.get('platform') || 'instagram'
    const text = searchParams.get('text') || 'Your headline here'

    const dimensions = PLATFORM_DIMENSIONS[platform as keyof typeof PLATFORM_DIMENSIONS]
        || PLATFORM_DIMENSIONS.instagram

    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]

    // Return a preview image (without AI background for speed)
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: template.background,
                    padding: '60px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '30px',
                    }}
                >
                    <img
                        src={`${req.nextUrl.origin}/suitegpt-logo.png`}
                        width={48}
                        height={48}
                        style={{
                            width: '48px',
                            height: '48px',
                        }}
                    />
                    <span
                        style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            color: template.textColor,
                        }}
                    >
                        SuiteGPT
                    </span>
                </div>
                <h1
                    style={{
                        fontSize: '48px',
                        fontWeight: 800,
                        color: template.textColor,
                        textAlign: 'center',
                    }}
                >
                    {text}
                </h1>
                <p
                    style={{
                        fontSize: '20px',
                        color: template.secondaryTextColor,
                        marginTop: '20px',
                    }}
                >
                    suitegpt.app • Real apps, not answers.
                </p>
            </div>
        ),
        {
            width: dimensions.width,
            height: dimensions.height,
        }
    )
}
