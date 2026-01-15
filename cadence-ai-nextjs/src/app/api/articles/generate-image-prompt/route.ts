import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { articleTitle, articleContent, projectContext } = body

        if (!articleTitle) {
            return NextResponse.json({ error: 'Article title is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

        const prompt = `
        You are an expert art director for the brand "${projectContext.name}".
        
        Write a highly detailed DALL-E 3 prompt to generate a feature image for this article:
        Title: "${articleTitle}"
        Context: ${articleContent.substring(0, 500)}...

        BRAND VISUAL STYLE:
        - Voice/Tone: ${projectContext.brand_voice || 'Modern'}
        - Style Keywords: ${projectContext.brand_style || 'High quality, professional'}
        - Target Audience: ${projectContext.target_audience || 'General'}
        
        REQUIREMENTS:
        - The prompt must be optimized for DALL-E 3.
        - Start the prompt with "A high quality, 4k image of..."
        - Be specific about lighting, composition, and mood.
        - No text in the image unless absolutely necessary.
        
        Output ONLY the prompt text, nothing else.
        `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        return NextResponse.json({ prompt: text })

    } catch (error) {
        console.error('Image prompt generation error:', error)
        return NextResponse.json({ error: 'Failed to generate image prompt' }, { status: 500 })
    }
}
