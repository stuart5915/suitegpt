import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Platform-specific aspect ratios and dimensions
const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number; aspectRatio: string }> = {
    instagram: { width: 1080, height: 1080, aspectRatio: '1:1' },
    tiktok: { width: 1080, height: 1920, aspectRatio: '9:16' },
    x: { width: 1200, height: 675, aspectRatio: '16:9' },
    linkedin: { width: 1200, height: 628, aspectRatio: '1.91:1' },
}

interface GenerateImageRequest {
    postId: string
    platform: string
    content: string
}

export async function POST(req: NextRequest) {
    try {
        const body: GenerateImageRequest = await req.json()
        const { postId, platform, content } = body

        if (!postId || !platform || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: postId, platform, content' },
                { status: 400 }
            )
        }

        const dimensions = PLATFORM_DIMENSIONS[platform] || PLATFORM_DIMENSIONS.x
        const geminiApiKey = process.env.GEMINI_API_KEY

        if (!geminiApiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY not configured' },
                { status: 500 }
            )
        }

        // Extract key themes from the post content for the image prompt
        const contentPreview = content.substring(0, 500)

        // Create an image prompt based on the post content
        const imagePrompt = `Create a professional, eye-catching social media graphic for ${platform}.
The image should be modern, clean, and visually striking.
Theme/context from the post: "${contentPreview}"

Style guidelines:
- Use bold, vibrant colors with good contrast
- Include abstract tech/digital elements if relevant
- No text in the image (the post text will be added separately)
- Professional and polished look suitable for a tech/AI product
- Aspect ratio: ${dimensions.aspectRatio}
- Modern gradient backgrounds work well
- Subtle geometric patterns or shapes are good`

        // Call Gemini's Imagen 3 API for image generation
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instances: [{ prompt: imagePrompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: dimensions.aspectRatio,
                        safetyFilterLevel: 'block_few',
                        personGeneration: 'dont_allow',
                    }
                })
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Gemini API error:', response.status, errorText)

            // Fallback: Generate a placeholder image URL
            // Using a gradient placeholder service
            const fallbackUrl = await generateFallbackImage(platform, dimensions)

            if (fallbackUrl) {
                // Update the post with the fallback image
                const supabase = await createClient()
                await supabase
                    .from('scheduled_posts')
                    .update({ images: [fallbackUrl] })
                    .eq('id', postId)

                return NextResponse.json({
                    success: true,
                    imageUrl: fallbackUrl,
                    note: 'Used fallback image generation'
                })
            }

            return NextResponse.json(
                { error: 'Image generation failed', details: errorText },
                { status: 500 }
            )
        }

        const data = await response.json()

        // Extract the generated image (base64 encoded)
        const generatedImage = data.predictions?.[0]?.bytesBase64Encoded

        if (!generatedImage) {
            console.error('No image in response:', data)
            return NextResponse.json(
                { error: 'No image generated' },
                { status: 500 }
            )
        }

        // Upload to Supabase Storage
        const supabase = await createClient()
        const fileName = `post-images/${postId}-${Date.now()}.png`
        const imageBuffer = Buffer.from(generatedImage, 'base64')

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('content')
            .upload(fileName, imageBuffer, {
                contentType: 'image/png',
                upsert: true
            })

        if (uploadError) {
            console.error('Storage upload error:', uploadError)
            // Try to use a data URL as fallback
            const dataUrl = `data:image/png;base64,${generatedImage}`

            // Update the post with data URL (not ideal but works)
            await supabase
                .from('scheduled_posts')
                .update({ images: [dataUrl] })
                .eq('id', postId)

            return NextResponse.json({
                success: true,
                imageUrl: dataUrl,
                note: 'Stored as data URL (storage upload failed)'
            })
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('content')
            .getPublicUrl(fileName)

        // Update the post with the image URL
        await supabase
            .from('scheduled_posts')
            .update({ images: [publicUrl] })
            .eq('id', postId)

        return NextResponse.json({
            success: true,
            imageUrl: publicUrl
        })

    } catch (error) {
        console.error('Error generating image:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate image' },
            { status: 500 }
        )
    }
}

// Fallback image generation using a placeholder service
async function generateFallbackImage(
    platform: string,
    dimensions: { width: number; height: number }
): Promise<string | null> {
    // Use placeholder.com or similar service for a gradient background
    // This creates a simple colored placeholder
    const colors = [
        '8B5CF6', // Purple
        '3B82F6', // Blue
        '10B981', // Green
        'F59E0B', // Orange
        'EC4899', // Pink
    ]
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    // Create a simple placeholder URL
    // Using placehold.co which supports custom colors and sizes
    const placeholderUrl = `https://placehold.co/${dimensions.width}x${dimensions.height}/${randomColor}/ffffff?text=SuiteGPT`

    return placeholderUrl
}

// GET endpoint for API documentation
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/generate-image',
        method: 'POST',
        description: 'Generate an AI image for a social media post',
        requiredFields: {
            postId: 'The ID of the scheduled post',
            platform: 'The target platform (x, linkedin, instagram, tiktok)',
            content: 'The post content to base the image on'
        },
        dimensions: PLATFORM_DIMENSIONS,
        example: {
            postId: 'abc123',
            platform: 'instagram',
            content: 'Your post content here...'
        }
    })
}
