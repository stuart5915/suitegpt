import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
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

interface GenerateImageRequest {
    postId: string
    platform: string
    content: string
    templateId?: string  // Optional: force a specific template
}

// Pattern SVG generators
function generateDotsPattern(color: string): string {
    return `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='${encodeURIComponent(color)}' fill-opacity='0.15'/%3E%3C/svg%3E")`
}

function generateGridPattern(color: string): string {
    return `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='${encodeURIComponent(color)}' stroke-opacity='0.1' stroke-width='1'/%3E%3C/svg%3E")`
}

function generateWavesPattern(color: string): string {
    return `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q 25 0, 50 10 T 100 10' fill='none' stroke='${encodeURIComponent(color)}' stroke-opacity='0.1' stroke-width='2'/%3E%3C/svg%3E")`
}

function getPatternStyle(pattern: string | undefined, color: string): string {
    switch (pattern) {
        case 'dots':
            return generateDotsPattern(color)
        case 'grid':
            return generateGridPattern(color)
        case 'waves':
            return generateWavesPattern(color)
        default:
            return 'none'
    }
}

export async function POST(req: NextRequest) {
    console.log('[generate-image] API called - TEMPLATE VERSION 2.0')
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

        // Generate the image using @vercel/og
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
                        background: template.background,
                        backgroundImage: getPatternStyle(template.pattern, template.accentColor),
                        backgroundSize: template.pattern === 'waves' ? '100px 20px' : '20px 20px',
                        padding: '60px',
                        position: 'relative',
                    }}
                >
                    {/* Decorative accent shapes */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-100px',
                            right: '-100px',
                            width: '400px',
                            height: '400px',
                            borderRadius: '50%',
                            background: template.accentColor,
                            opacity: 0.1,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-150px',
                            left: '-150px',
                            width: '500px',
                            height: '500px',
                            borderRadius: '50%',
                            background: template.accentColor,
                            opacity: 0.08,
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
                            zIndex: 1,
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
                                    color: template.textColor,
                                    letterSpacing: '-0.02em',
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
                                color: template.textColor,
                                lineHeight: 1.1,
                                margin: 0,
                                marginBottom: '20px',
                                letterSpacing: '-0.03em',
                                maxWidth: '100%',
                            }}
                        >
                            {headline}
                        </h1>

                        {/* Subheadline */}
                        <p
                            style={{
                                fontSize: platform === 'tiktok' ? '28px' : '24px',
                                color: template.secondaryTextColor,
                                lineHeight: 1.4,
                                margin: 0,
                                maxWidth: '90%',
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
                                color: template.secondaryTextColor,
                                marginTop: '20px',
                                opacity: 0.8,
                            }}
                        >
                            suitegpt.app • Real apps, not answers. [v2]
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
            templateName: template.name
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

    // Return a preview image
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
                    suitegpt.app • Real apps, not answers. [v2]
                </p>
            </div>
        ),
        {
            width: dimensions.width,
            height: dimensions.height,
        }
    )
}
