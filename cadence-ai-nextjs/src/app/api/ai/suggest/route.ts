import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            type,
            projectName,
            projectDescription,
            currentValue,
            // Additional context for self-referencing
            missionStatement,
            uniqueValueProp,
            brandVoice,
            targetAudience,
            contentPillars
        } = body

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // Build rich context from all available fields
        const contextParts = []
        if (projectName) contextParts.push(`Project Name: ${projectName}`)
        if (projectDescription) contextParts.push(`Description: ${projectDescription}`)
        if (missionStatement) contextParts.push(`Mission: ${missionStatement}`)
        if (uniqueValueProp) contextParts.push(`Unique Value: ${uniqueValueProp}`)
        if (brandVoice) contextParts.push(`Brand Voice: ${brandVoice}`)
        if (targetAudience) contextParts.push(`Target Audience: ${targetAudience}`)
        if (contentPillars?.length) contextParts.push(`Content Pillars: ${contentPillars.join(', ')}`)

        const context = contextParts.length > 0
            ? contextParts.join('\n')
            : 'No context provided yet'

        let prompt = ''

        switch (type) {
            case 'project_name':
                prompt = `You are a branding expert. Based on this context:
${context}

${currentValue ? `Current name (suggest something different): ${currentValue}` : ''}

Generate a creative, memorable project/brand name (1-4 words). It should be catchy and reflect the brand's essence.

Return ONLY the name, nothing else.`
                break

            case 'description':
                prompt = `You are a copywriter. Based on this context:
${context}

${currentValue ? `Current description (suggest something different): ${currentValue}` : ''}

Write a compelling project description (2-3 sentences). Explain what this project/brand does and its value proposition.

Return ONLY the description, nothing else.`
                break

            case 'brand_voice':
                prompt = `You are a branding expert. Based on this context:
${context}

${currentValue ? `Current voice (suggest something different): ${currentValue}` : ''}

Generate a concise brand voice description (2-3 sentences). Describe the tone, personality, and communication style. Be specific about formal/casual, serious/playful, etc.

Return ONLY the brand voice description, nothing else.`
                break

            case 'target_audience':
                prompt = `You are a marketing strategist. Based on this context:
${context}

${currentValue ? `Current audience (suggest something different): ${currentValue}` : ''}

Describe the ideal target audience in 2-3 sentences. Include demographics (age, profession), psychographics (interests, values), and pain points.

Return ONLY the target audience description, nothing else.`
                break

            case 'content_pillars':
                prompt = `You are a content strategist. Based on this context:
${context}

Suggest 4-5 content pillars (main themes) for social media. Each pillar should be 2-4 words.

Return ONLY a JSON array: ["Pillar One", "Pillar Two", "Pillar Three", "Pillar Four", "Pillar Five"]`
                break

            case 'mission_statement':
                prompt = `You are a business strategist. Based on this context:
${context}

${currentValue ? `Current mission (suggest something different): ${currentValue}` : ''}

Write a compelling mission statement (1-2 sentences). It should capture the core purpose and impact.

Return ONLY the mission statement, nothing else.`
                break

            case 'unique_value_prop':
                prompt = `You are a marketing expert. Based on this context:
${context}

${currentValue ? `Current UVP (suggest something different): ${currentValue}` : ''}

Write a unique value proposition (1-2 sentences). Explain what makes this brand different and why customers should choose them.

Return ONLY the UVP, nothing else.`
                break

            case 'key_messages':
                prompt = `You are a brand messaging expert. Based on this context:
${context}

Generate 5 key brand messages - short phrases (2-5 words each) that capture core themes to reinforce in all content.

Return ONLY a JSON array: ["Message One", "Message Two", "Message Three", "Message Four", "Message Five"]`
                break

            case 'hashtag_strategy':
                prompt = `You are a social media strategist. Based on this context:
${context}

${currentValue ? `Current strategy (suggest something different): ${currentValue}` : ''}

Create a hashtag strategy including:
- 3-5 branded hashtags to always use
- 3-5 industry hashtags relevant to the niche
- Any types of hashtags to avoid

Return a concise strategy in 2-3 sentences.`
                break

            case 'content_rules':
                prompt = `You are a brand safety expert. Based on this context:
${context}

${currentValue ? `Current rules (suggest something different): ${currentValue}` : ''}

Create content guidelines including:
- Topics to embrace (2-3)
- Topics to avoid or handle carefully (2-3)
- Tone/language rules (1-2)

Return concise guidelines in 3-4 sentences.`
                break

            default:
                return NextResponse.json({ error: 'Invalid suggestion type' }, { status: 400 })
        }

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // Parse JSON arrays for list types
        if (['content_pillars', 'key_messages'].includes(type)) {
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]/)
                if (jsonMatch) {
                    const items = JSON.parse(jsonMatch[0])
                    return NextResponse.json({ suggestion: items })
                }
            } catch {
                const items = text.split(',').map(p => p.trim().replace(/["[\]]/g, ''))
                return NextResponse.json({ suggestion: items.filter(p => p.length > 0) })
            }
        }

        return NextResponse.json({ suggestion: text.trim() })
    } catch (error: any) {
        console.error('AI suggestion error:', error)
        return NextResponse.json({ error: error.message || 'Failed to generate suggestion' }, { status: 500 })
    }
}
