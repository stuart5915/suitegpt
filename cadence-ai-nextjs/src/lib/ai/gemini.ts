import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
    }
})

export async function generateContent(prompt: string): Promise<string> {
    try {
        const result = await geminiModel.generateContent(prompt)
        const response = result.response
        return response.text()
    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to generate content')
    }
}

export async function generateJSON<T>(prompt: string): Promise<T> {
    try {
        const result = await geminiModel.generateContent(prompt)
        const response = result.response
        const text = response.text()

        // Extract JSON from potential markdown code blocks
        let jsonStr = text
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim()
        }

        return JSON.parse(jsonStr) as T
    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to generate content')
    }
}
