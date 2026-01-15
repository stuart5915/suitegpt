import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { content, filename } = body

        if (!content || !filename) {
            return NextResponse.json({ error: 'Content and filename are required' }, { status: 400 })
        }

        // Clean filename and ensure .md extension
        const cleanName = filename.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
        const finalName = cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`

        // Define path: project root/content/articles
        const articlesDir = path.join(process.cwd(), 'content', 'articles')

        // Ensure directory exists
        if (!fs.existsSync(articlesDir)) {
            fs.mkdirSync(articlesDir, { recursive: true })
        }

        const filePath = path.join(articlesDir, finalName)

        // Write file
        fs.writeFileSync(filePath, content, 'utf8')

        return NextResponse.json({ success: true, path: filePath })

    } catch (error) {
        console.error('Save article error:', error)
        return NextResponse.json({ error: 'Failed to save article' }, { status: 500 })
    }
}
