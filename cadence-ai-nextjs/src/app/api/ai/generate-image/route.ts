import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Gemini with Imagen model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const { prompt, projectId, contentItemId, style, quality = 'standard' } = await request.json()

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        const supabase = await createClient()

        // Auth check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Build enhanced prompt for social media images
        const styleGuides: Record<string, string> = {
            'vibrant': 'Vibrant colors, high saturation, energetic mood, eye-catching for social media',
            'minimal': 'Clean minimalist design, lots of white space, modern aesthetic',
            'professional': 'Corporate style, polished look, business appropriate',
            'creative': 'Artistic, creative composition, unique perspective, visually striking',
            'lifestyle': 'Warm natural lighting, authentic lifestyle photography style',
        }

        const styleGuide = styleGuides[style] || styleGuides['vibrant']

        const enhancedPrompt = `Create a high-quality social media image: ${prompt}. 
Style: ${styleGuide}. 
The image should be optimized for Instagram/social media viewing, with strong visual impact and professional quality.
No text overlays unless specifically requested. Square format preferred.`

        // Choose model based on quality tier
        // HD = Imagen 3 (higher quality, ~$0.04/image)
        // Standard = Gemini 2.0 Flash (good quality, much cheaper/free tier)
        const modelName = quality === 'hd' ? 'imagen-3.0-generate-002' : 'gemini-2.0-flash-exp'

        const model = genAI.getGenerativeModel({
            model: modelName,
        })

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
            generationConfig: {
                // @ts-ignore - Imagen-specific config
                responseModalities: ['image', 'text'],
                responseMimeType: 'image/png',
            },
        })

        // Extract image from response
        const response = result.response
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
            (part: any) => part.inlineData?.mimeType?.startsWith('image/')
        )

        if (!imagePart?.inlineData) {
            // Fallback: try Gemini 2.0 Flash experimental which also supports image generation
            const geminiModel = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
            })

            const geminiResult = await geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: `Generate an image: ${enhancedPrompt}` }] }],
                generationConfig: {
                    // @ts-ignore
                    responseModalities: ['image', 'text'],
                },
            })

            const geminiImagePart = geminiResult.response.candidates?.[0]?.content?.parts?.find(
                (part: any) => part.inlineData?.mimeType?.startsWith('image/')
            )

            if (!geminiImagePart?.inlineData) {
                return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
            }

            // Upload generated image to Supabase Storage
            const imageBuffer = Buffer.from(geminiImagePart.inlineData.data, 'base64')
            const fileName = `${user.id}/${projectId}/generated-${Date.now()}.png`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('content-media')
                .upload(fileName, imageBuffer, {
                    contentType: 'image/png',
                    upsert: false
                })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('content-media')
                .getPublicUrl(fileName)

            // Update content item with image URL if provided
            if (contentItemId) {
                const { data: existingItem } = await supabase
                    .from('content_items')
                    .select('media_urls')
                    .eq('id', contentItemId)
                    .single()

                const existingUrls = existingItem?.media_urls || []

                await supabase
                    .from('content_items')
                    .update({
                        media_urls: [...existingUrls, urlData.publicUrl],
                        media_prompt: prompt, // Store the prompt used to generate the image
                    })
                    .eq('id', contentItemId)
            }

            return NextResponse.json({
                url: urlData.publicUrl,
                prompt: prompt,
            })
        }

        // Upload generated image to Supabase Storage
        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
        const fileName = `${user.id}/${projectId}/generated-${Date.now()}.png`

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('content-media')
            .upload(fileName, imageBuffer, {
                contentType: imagePart.inlineData.mimeType,
                upsert: false
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('content-media')
            .getPublicUrl(fileName)

        // Update content item with image URL if provided
        if (contentItemId) {
            const { data: existingItem } = await supabase
                .from('content_items')
                .select('media_urls')
                .eq('id', contentItemId)
                .single()

            const existingUrls = existingItem?.media_urls || []

            await supabase
                .from('content_items')
                .update({
                    media_urls: [...existingUrls, urlData.publicUrl],
                    media_prompt: prompt,
                })
                .eq('id', contentItemId)
        }

        return NextResponse.json({
            url: urlData.publicUrl,
            prompt: prompt,
        })

    } catch (error: any) {
        console.error('Image generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate image' },
            { status: 500 }
        )
    }
}
