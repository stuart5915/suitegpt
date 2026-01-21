import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const SYSTEM_PROMPT = `You are SUITEHub AI, a helpful personal assistant with access to the user's data from multiple SUITE apps:

- TrueForm AI: Exercise and workout data
- OpticRep: Gym workout logs and form analysis
- FoodVitals: Nutrition tracking and meal logs
- Cheshbon: Personal reflections and insights
- REMcast: Sleep tracking and dream journals
- Cadence AI: Content marketing and social media
- DeFi Hub: Cryptocurrency portfolio and staking

You have access to the user's recent memories (activities, logs, reflections) and can help them:
1. Understand patterns in their data
2. Get personalized insights and recommendations
3. Answer questions about their health, fitness, and lifestyle
4. Provide encouragement and support

Be helpful, personalized, and encouraging. If you don't have specific data, suggest which SUITE app they could use to track that information.

Always be concise but thorough. Use markdown formatting when helpful.`

interface LifeMemory {
    id: string
    source_app: string
    event_type: string
    content: string
    metadata?: Record<string, unknown>
    created_at: string
}

function formatMemoriesForContext(memories: LifeMemory[]): string {
    if (!memories || memories.length === 0) {
        return 'No recent activity data available.'
    }

    return memories.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
        return `[${m.source_app}] ${date}: ${m.content}`
    }).join('\n')
}

export async function POST(request: NextRequest) {
    try {
        const { message, history = [] } = await request.json()

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            )
        }

        // Try to fetch recent memories from Supabase
        let memoriesContext = 'No recent activity data available.'
        try {
            const supabase = await createClient()
            const { data: memories } = await supabase
                .from('life_memories')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10)

            if (memories && memories.length > 0) {
                memoriesContext = formatMemoriesForContext(memories as LifeMemory[])
            }
        } catch (dbError) {
            console.log('Could not fetch memories:', dbError)
            // Continue without memories
        }

        // Build conversation for Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        // Create chat with history
        const chat = model.startChat({
            history: history.map((msg: { role: string; content: string }) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            })),
        })

        // Build the prompt with context
        const promptWithContext = `${SYSTEM_PROMPT}

Recent user activity:
${memoriesContext}

User message: ${message}`

        // Generate response
        const result = await chat.sendMessage(promptWithContext)
        const response = result.response.text()

        return NextResponse.json({
            response,
            success: true,
        })

    } catch (error) {
        console.error('Chat API error:', error)

        // Fallback response if AI fails
        return NextResponse.json({
            response: "I'm having trouble processing your request right now. Please try again in a moment.",
            success: false,
        })
    }
}
