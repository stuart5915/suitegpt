import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { prompt, model = 'veo-2' } = body

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
        }

        // Map user-friendly model names to actual model IDs
        const modelMap: Record<string, string> = {
            'veo-2': 'veo-2.0-generate-preview',
            'veo-3': 'veo-3.0-generate-preview',
            'veo-3.1': 'veo-3.1-generate-preview',
        }
        const modelId = modelMap[model] || 'veo-2.0-generate-preview'

        console.log(`Starting Veo video generation with model: ${modelId}`)
        console.log(`Prompt: ${prompt}`)

        // Start the video generation operation
        let operation = await ai.models.generateVideos({
            model: modelId,
            prompt: prompt,
        })

        // Poll until video is ready (with timeout)
        const startTime = Date.now()
        const maxWaitMs = 5 * 60 * 1000 // 5 minutes max

        while (!operation.done) {
            if (Date.now() - startTime > maxWaitMs) {
                return NextResponse.json({ error: 'Video generation timed out' }, { status: 408 })
            }

            console.log('Waiting for video generation...')
            await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds

            operation = await ai.operations.getVideosOperation({
                operation: operation,
            })
        }

        // Get the generated video
        const generatedVideos = operation.response?.generatedVideos
        if (!generatedVideos || generatedVideos.length === 0) {
            return NextResponse.json({ error: 'No video generated' }, { status: 500 })
        }

        const videoFile = generatedVideos[0].video

        // Return the video URL for client to download
        return NextResponse.json({
            success: true,
            video: {
                uri: videoFile?.uri,
                mimeType: videoFile?.mimeType,
                name: videoFile?.name,
            },
            message: 'Video generated successfully'
        })

    } catch (error: any) {
        console.error('Veo video generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate video' },
            { status: 500 }
        )
    }
}
