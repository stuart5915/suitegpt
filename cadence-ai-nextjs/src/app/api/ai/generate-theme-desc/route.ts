import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const { themeName, projectName, projectDescription, brandVoice, targetAudience } = await request.json()

        if (!themeName) {
            return NextResponse.json({ error: 'Theme name is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `You are helping create a content theme for social media marketing.

Project Details:
- Business/Project Name: ${projectName || 'Unknown'}
- Description: ${projectDescription || 'No description provided'}
- Brand Voice: ${brandVoice || 'Professional and friendly'}
- Target Audience: ${targetAudience || 'General audience'}

The user wants to create a custom content theme called "${themeName}".

Generate a brief, clear description (1-2 sentences, max 100 characters) that explains what type of social media content should be created for this theme. The description should:
1. Be specific to this business/project
2. Help an AI understand what content to generate
3. Be actionable and clear

Respond with ONLY the description text, nothing else.`

        const result = await model.generateContent(prompt)
        const description = result.response.text().trim()

        return NextResponse.json({ description })
    } catch (error) {
        console.error('Error generating theme description:', error)
        return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 })
    }
}
