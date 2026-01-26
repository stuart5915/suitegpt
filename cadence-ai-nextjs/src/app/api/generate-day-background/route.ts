import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const FAL_API_KEY = process.env.FAL_API_KEY!

interface GenerateRequest {
    date: string // YYYY-MM-DD
    prompt: string
    aspectRatio?: '16:9' | '1:1' | '9:16'
}

/**
 * Generate a background image using Flux via fal.ai
 */
async function generateFluxImage(prompt: string, aspectRatio: string): Promise<string> {
    console.log('[generate-day-background] Calling Flux API...')

    // Map aspect ratio to image size
    const sizeMap: Record<string, { width: number; height: number }> = {
        '16:9': { width: 1344, height: 768 },
        '1:1': { width: 1024, height: 1024 },
        '9:16': { width: 768, height: 1344 }
    }
    const size = sizeMap[aspectRatio] || sizeMap['16:9']

    // Enhance prompt for background use
    const enhancedPrompt = `${prompt}. High quality, visually striking, suitable as a social media background. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WRITING OF ANY KIND.`

    const response = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: enhancedPrompt,
            image_size: size,
            num_images: 1,
            enable_safety_checker: true,
            safety_tolerance: '2'
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[generate-day-background] Flux API error:', errorText)
        throw new Error(`Flux API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('[generate-day-background] Flux response:', JSON.stringify(data).substring(0, 200))

    // fal.ai returns images array with url
    if (data.images && data.images[0]?.url) {
        return data.images[0].url
    }

    throw new Error('No image URL in Flux response')
}

export async function POST(req: NextRequest) {
    console.log('[generate-day-background] API called')

    if (!FAL_API_KEY) {
        return NextResponse.json(
            { error: 'FAL_API_KEY not configured' },
            { status: 500 }
        )
    }

    try {
        const body: GenerateRequest = await req.json()
        const { date, prompt, aspectRatio = '16:9' } = body

        if (!date || !prompt) {
            return NextResponse.json(
                { error: 'Date and prompt are required' },
                { status: 400 }
            )
        }

        console.log('[generate-day-background] Generating for date:', date, 'prompt:', prompt)

        // Generate image with Flux
        const fluxImageUrl = await generateFluxImage(prompt, aspectRatio)

        // Download the image and upload to Supabase storage
        const imageResponse = await fetch(fluxImageUrl)
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

        const fileName = `day-backgrounds/${date}-${Date.now()}.png`

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

        if (!uploadResponse.ok) {
            console.error('Storage upload failed:', await uploadResponse.text())
            // Fall back to using Flux URL directly
            return NextResponse.json({
                success: true,
                imageUrl: fluxImageUrl,
                date
            })
        }

        const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${fileName}`
        console.log('[generate-day-background] Uploaded to:', imageUrl)

        // Save to day_images table (upsert by date)
        const supabase = await createClient()

        await supabase
            .from('day_images')
            .upsert(
                { date, image_url: imageUrl },
                { onConflict: 'date' }
            )

        // Apply to all posts scheduled for this date
        const startOfDay = `${date}T00:00:00`
        const endOfDay = `${date}T23:59:59`

        await fetch(
            `${SUPABASE_URL}/rest/v1/scheduled_posts?scheduled_for=gte.${startOfDay}&scheduled_for=lte.${endOfDay}`,
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
            imageUrl,
            date
        })

    } catch (error) {
        console.error('Error generating day background:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate background' },
            { status: 500 }
        )
    }
}
