import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            topic,
            type = 'blog',
            projectContext, // Includes brand voice, tone, etc.
            keywords = [],
            wordCount = '1000'
        } = body

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

        // Read the global style guide
        let styleGuide = ''
        try {
            const fs = require('fs')
            const path = require('path')
            const styleGuidePath = path.join(process.cwd(), 'content', 'articles', 'style_guide.md')
            if (fs.existsSync(styleGuidePath)) {
                styleGuide = fs.readFileSync(styleGuidePath, 'utf8')
            }
        } catch (e) {
            console.warn('Could not read style guide:', e)
        }

        const prompt = `
        You are an expert content writer for the brand "${projectContext.name}".
        
        Write a high-quality ${type} article about: "${topic}"
        
        =================================================================
        CRITICAL STYLE GUIDE (MUST FOLLOW STRICTLY):
        ${styleGuide}
        =================================================================

        PROJECT CONTEXT:
        - Voice: ${projectContext.brand_voice || 'Professional'}
        - Tone: ${projectContext.brand_tone || 'Informative'}
        - Perspective: ${projectContext.speaking_perspective || 'we'}
        - Emoji Usage: ${projectContext.emoji_style || 'minimal'}
        - Target Audience: ${projectContext.target_audience || 'General audience'}
        
        ${projectContext.banned_words ? `ADDITIONAL AVODANCE: ${projectContext.banned_words}` : ''}

        REQUIREMENTS:
        - Length: Approximately ${wordCount} words
        - Keywords to include: ${keywords.join(', ')}
        - Format: Markdown
        
        STRUCTURE:
        1. Engaging Title (H1)
        2. Brief Introduction with a hook
        3. Well-structured body with H2 and H3 subheadings
        4. Practical takeaways or examples
        5. Conclusion with valid Call-to-Action (CTA)

        FRONTMATTER:
        Start the file with YAML frontmatter included between --- lines:
        ---
        title: (The article title)
        description: (A 150-char meta description)
        date: ${new Date().toISOString().split('T')[0]}
        status: draft
        ---

        Return ONLY the markdown content including the frontmatter.
        `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        return NextResponse.json({ content: text })

    } catch (error) {
        console.error('Article generation error:', error)
        return NextResponse.json({ error: 'Failed to generate article' }, { status: 500 })
    }
}
