import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
    try {
        const { content, instructions, stylePrompts, isFirstPass } = await request.json()

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `You are a skilled writing assistant helping refine articles.

YOUR JOB:
- ${isFirstPass ? 'Take this raw draft and clean it up into a polished article' : 'Refine this article based on the instructions'}
- Keep the author's voice and vibe intact - don't make it sound corporate or generic
- Improve flow and clarity without losing the conversational, thinking-out-loud quality
- Output ONLY the refined article content, no preamble or explanation
${stylePrompts || ''}

${isFirstPass ? 'ORIGINAL DRAFT' : 'CURRENT ARTICLE'}:
${content}

INSTRUCTIONS: ${instructions || 'Clean this up and make it flow better'}

Output the refined article:`

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4000
            }
        })

        const refined = result.response.text()

        return NextResponse.json({ refined })
    } catch (error) {
        console.error('Article refinement error:', error)
        return NextResponse.json(
            { error: 'Failed to refine article' },
            { status: 500 }
        )
    }
}
