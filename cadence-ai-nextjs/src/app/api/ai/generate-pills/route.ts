import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
    try {
        const { content, lastInstruction } = await request.json()

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `Based on this article and the last refinement instruction, suggest 5 short prompts (max 6 words each) for areas the author could expand on.

Consider:
- Unexplored themes or angles in the content
- Places needing more depth, examples, or personal touches
- Connections to broader philosophical/spiritual ideas
- Ways to make it more vivid or engaging

Return ONLY a valid JSON array:
[{"emoji": "💭", "label": "short label", "prompt": "Full instruction for the AI..."}]

Article:
${content}

Last instruction: ${lastInstruction || 'Initial refinement'}`

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 500
            }
        })

        const responseText = result.response.text()
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)

        if (jsonMatch) {
            try {
                const pills = JSON.parse(jsonMatch[0])
                return NextResponse.json({ pills })
            } catch (parseError) {
                console.error('JSON parse error:', parseError)
                return NextResponse.json({ pills: null })
            }
        }

        return NextResponse.json({ pills: null })
    } catch (error) {
        console.error('Generate pills error:', error)
        return NextResponse.json(
            { error: 'Failed to generate pills' },
            { status: 500 }
        )
    }
}
