import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import {
    PLATFORM_DIMENSIONS,
    TEMPLATES,
    selectTemplate,
    extractHeadline,
    extractSubheadline,
} from '@/lib/image-templates'
import { SUITEGPT_LOGO_BASE64 } from '@/lib/logo-base64'

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface GenerateTemplateRequest {
    postId: string
    platform: string
    content: string
    templateId?: string
}

export async function POST(req: NextRequest) {
    console.log('[generate-template-only] API called')
    try {
        const body: GenerateTemplateRequest = await req.json()
        const { postId, platform, content, templateId } = body
        console.log('[generate-template-only] Request:', { postId, platform, contentLength: content?.length, templateId })

        if (!postId || !platform || !content) {
            console.log('[generate-template-only] Missing fields')
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
        console.log('[generate-template-only] Selected template:', template.id, template.name)

        // Extract text for the image
        let headline = extractHeadline(content, platform === 'x' ? 50 : 60)
        let subheadline = extractSubheadline(content, platform === 'x' ? 80 : 100)

        // WORKAROUND: The word "spent" crashes next/og - replace with "used"
        headline = headline.replace(/spent/gi, 'used')
        subheadline = subheadline.replace(/spent/gi, 'used')

        console.log('[generate-template-only] Headline:', headline)
        console.log('[generate-template-only] Subheadline:', subheadline)

        // Generate the template image using next/og with gradient background (NO AI)
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
                                src={SUITEGPT_LOGO_BASE64}
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
                            }}
                        >
                            suitegpt.app - Real apps, not answers.
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
        console.log('[generate-template-only] Converting ImageResponse to buffer...')
        const imageBuffer = await imageResponse.arrayBuffer()
        console.log('[generate-template-only] Buffer size:', imageBuffer.byteLength)
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        // Upload to Supabase storage
        const fileName = `post-images/template-${postId}-${Date.now()}.png`
        console.log('[generate-template-only] Uploading to:', fileName)
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
                imageUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${fileName}`
            } else {
                console.error('Storage upload failed:', await uploadResponse.text())
                imageUrl = `data:image/png;base64,${base64Image}`
            }
        } catch (uploadError) {
            console.error('Storage upload error:', uploadError)
            imageUrl = `data:image/png;base64,${base64Image}`
        }

        // Update the post with the template image URL
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
                body: JSON.stringify({ template_image_url: imageUrl })
            }
        )

        return NextResponse.json({
            success: true,
            templateImageUrl: imageUrl,
            template: template.id,
            templateName: template.name,
        })

    } catch (error) {
        console.error('Error generating template image:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate template image' },
            { status: 500 }
        )
    }
}
