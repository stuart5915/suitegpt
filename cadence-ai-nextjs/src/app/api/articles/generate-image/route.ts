import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Note: Standard @google/generative-ai package might not support Imagen yet depending on version,
// but for standard implementation we'll use the proper model name 'imagen-3.0-generate-001'
// If the SDK doesn't support it, we might need to use direct fetch, but let's try assuming SDK support or standard REST fallback if needed.
// Actually, for Imagen specifically, the `google-genai` package is often preferred over `generative-ai` for beta features, 
// but let's stick to a reliable REST call if the SDK type definitions are missing, 
// OR use the `genai` import if available. 
// Since package.json has "@google/genai": "^1.34.0", we should use THAT for Imagen.

import { GoogleAuth } from 'google-auth-library'

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API Key not configured' }, { status: 500 })
        }

        const body = await request.json()
        const { prompt, size = '1024x1024', aspectRatio = '1:1' } = body

        if (!prompt) {
            return NextResponse.json({ error: 'Image prompt is required' }, { status: 400 })
        }

        // Using direct REST API for Imagen 3 as it's the most reliable way across SDK versions right now
        // Model: imagen-3.0-generate-001

        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [
                    { prompt: prompt }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: aspectRatio, // "1:1", "3:4", "4:3", "9:16", "16:9"
                    // safetyFilterLevel: "block_some"
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Gemini Image API Error:', errorText)
            throw new Error(`Gemini API Error: ${response.statusText}`)
        }

        const data = await response.json()

        // The API returns base64 encoded image
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded

        if (!base64Image) {
            throw new Error('No image data returned from API')
        }

        // Convert to data URL
        const imageUrl = `data:image/png;base64,${base64Image}`

        return NextResponse.json({ url: imageUrl, isBase64: true })

    } catch (error) {
        console.error('Gemini/Imagen generation error:', error)
        return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
    }
}
