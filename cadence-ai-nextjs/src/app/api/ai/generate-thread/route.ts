import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const THREAD_PROMPT = `You are a viral Twitter thread expert. Your job is to convert content into engaging, educational Twitter threads that get high engagement.

Rules:
1. First tweet must be a HOOK - make it irresistible to click
2. Each tweet should be 1-2 sentences max
3. Use short paragraphs and line breaks for readability
4. Include 1-2 relevant emojis per tweet (don't overdo it)
5. End with a strong CTA (call to action)
6. Total thread should be 5-12 tweets
7. Each tweet MUST be under 280 characters
8. Number each tweet (1/, 2/, etc.) but you'll provide just the content
9. Add a "follow for more" or similar at the end
10. Make it educational but entertaining

Convert the following content into a Twitter thread. Return ONLY a JSON object with this format:
{
  "title": "A catchy title for the thread",
  "tweets": ["tweet 1 content", "tweet 2 content", ...]
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.

Content to convert:`

export async function POST(request: NextRequest) {
    try {
        const { source, sourceType, userId } = await request.json()

        if (!source) {
            return NextResponse.json(
                { error: 'Source content is required' },
                { status: 400 }
            )
        }

        let contentToConvert = source

        // If it's a URL, fetch the content (simplified for now)
        if (sourceType === 'url') {
            try {
                const response = await fetch(source)
                const html = await response.text()
                // Simple extraction - in production, use a proper parser
                const textContent = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 5000) // Limit content length
                contentToConvert = textContent
            } catch (error) {
                return NextResponse.json(
                    { error: 'Failed to fetch URL content' },
                    { status: 400 }
                )
            }
        }

        // Generate thread using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `${THREAD_PROMPT}\n\n${contentToConvert}`

        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text()

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        // Parse the JSON response
        let threadData
        try {
            threadData = JSON.parse(text)
        } catch (parseError) {
            console.error('Failed to parse thread response:', text)
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            )
        }

        // Validate tweet lengths
        const validatedTweets = threadData.tweets.map((tweet: string, index: number) => {
            if (tweet.length > 280) {
                // Truncate and add ellipsis
                return tweet.slice(0, 277) + '...'
            }
            return tweet
        })

        return NextResponse.json({
            title: threadData.title || 'Untitled Thread',
            tweets: validatedTweets
        })

    } catch (error) {
        console.error('Thread generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate thread' },
            { status: 500 }
        )
    }
}
