import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini at module level (matches working routes)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
    try {
        const { content } = await request.json()

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `Based on this article content, suggest a compelling title.

RULES:
- Keep it concise (5-10 words max)
- Make it engaging and intriguing
- Capture the main theme or insight
- Don't use clickbait or clichés
- No quotes around the title

Article:
${content.slice(0, 2000)}

Return ONLY the title, nothing else.`

        const result = await model.generateContent(prompt)
        const response = await result.response
        let title = response.text().trim()

        // Clean up any quotes
        if ((title.startsWith('"') && title.endsWith('"')) ||
            (title.startsWith("'") && title.endsWith("'"))) {
            title = title.slice(1, -1)
        }

        return NextResponse.json({ title })
    } catch (error: any) {
        console.error('Generate title error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to generate title' },
            { status: 500 }
        )
    }
}
