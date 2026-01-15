import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // Fetch the page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CadenceAI/1.0; +https://getsuite.app)'
            }
        })

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 })
        }

        const html = await response.text()

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : ''

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
        const description = descMatch ? descMatch[1].trim() : ''

        // Extract OG description as fallback
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
        const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : ''

        // Extract first paragraph or main content (simplified)
        const paragraphMatch = html.match(/<p[^>]*>([^<]{50,})<\/p>/i)
        const firstParagraph = paragraphMatch ? paragraphMatch[1].trim().substring(0, 500) : ''

        // Try to extract h1 if title is generic
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
        const h1 = h1Match ? h1Match[1].trim() : ''

        // Prefer h1 over title if title contains site name
        const finalTitle = (title.includes(' | ') || title.includes(' - ')) && h1 ? h1 : (title || h1)

        return NextResponse.json({
            title: finalTitle,
            description: description || ogDescription,
            summary: description || ogDescription,
            content: firstParagraph,
            url
        })

    } catch (error) {
        console.error('Scrape error:', error)
        return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 500 })
    }
}
