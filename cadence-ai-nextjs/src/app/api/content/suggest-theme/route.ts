import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(req: NextRequest) {
    try {
        const { researchFindings, githubActivity } = await req.json()

        if (!researchFindings && !githubActivity) {
            return NextResponse.json(
                { error: 'Provide research findings or GitHub activity to suggest a theme' },
                { status: 400 }
            )
        }

        const prompt = `Based on the following research and context, suggest 3 potential weekly content themes for SuiteGPT (an AI app concierge that builds real working apps, not just gives answers).

${researchFindings ? `RESEARCH FINDINGS:
${researchFindings}` : ''}

${githubActivity ? `RECENT DEVELOPMENT ACTIVITY:
${githubActivity}` : ''}

For each theme suggestion, provide:
1. A short theme title (5-7 words max)
2. One sentence explaining why this theme would resonate this week

Format your response as JSON:
{
  "themes": [
    { "title": "Theme title here", "reason": "Why this theme works" },
    { "title": "Theme title here", "reason": "Why this theme works" },
    { "title": "Theme title here", "reason": "Why this theme works" }
  ]
}

Only respond with valid JSON, no other text.`

        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }]
        })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

        // Parse JSON response
        const parsed = JSON.parse(responseText)

        return NextResponse.json({
            success: true,
            themes: parsed.themes
        })
    } catch (error) {
        console.error('Error suggesting theme:', error)
        return NextResponse.json(
            { error: 'Failed to suggest theme' },
            { status: 500 }
        )
    }
}
