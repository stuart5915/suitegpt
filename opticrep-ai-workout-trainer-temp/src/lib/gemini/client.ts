import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
    console.warn(
        '[Gemini] Missing API key. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.'
    );
}

const genAI = new GoogleGenerativeAI(apiKey || 'placeholder-key');

/**
 * Gemini 1.5 Pro model for text and multimodal generation
 */
export const geminiPro = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
});

/**
 * Gemini embedding model for text embeddings
 */
export const geminiEmbedding = genAI.getGenerativeModel({
    model: 'text-embedding-004',
});

/**
 * Check if Gemini is properly configured
 */
export function isGeminiConfigured(): boolean {
    return Boolean(apiKey);
}

/**
 * Generate text embeddings for semantic search
 * @param text - Text to embed
 * @returns 768-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const result = await geminiEmbedding.embedContent(text);
    return result.embedding.values;
}

/**
 * Generate a chat response with optional context
 */
export async function generateChatResponse(
    userMessage: string,
    systemPrompt: string,
    context?: string
): Promise<string> {
    const parts: Part[] = [];

    if (context) {
        parts.push({ text: `Context from memory:\n${context}\n\n` });
    }

    parts.push({ text: userMessage });

    const chat = geminiPro.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: 'You are starting a new conversation.' }],
            },
            {
                role: 'model',
                parts: [{ text: systemPrompt }],
            },
        ],
    });

    const result = await chat.sendMessage(parts);
    return result.response.text();
}

/**
 * Generate workout summary from session data and audio reflection
 * Uses Gemini's multimodal capabilities
 */
export async function generateWorkoutSummary(
    sessionDataJson: string,
    audioBase64?: string,
    audioMimeType: string = 'audio/m4a'
): Promise<string> {
    const parts: Part[] = [];

    // Add audio if provided
    if (audioBase64) {
        parts.push({
            inlineData: {
                mimeType: audioMimeType,
                data: audioBase64,
            },
        });
    }

    // Add session data
    parts.push({
        text: `
Analyze this workout session and provide a performance summary.

Session Data:
${sessionDataJson}

Please provide:
1. Overall performance score (1-100)
2. Key highlights (what went well)
3. Areas for improvement
4. Recommendations for next session
5. Any form concerns based on the rep data

${audioBase64 ? 'Also incorporate any insights from the user\'s spoken reflection.' : ''}
    `.trim(),
    });

    const result = await geminiPro.generateContent(parts);
    return result.response.text();
}

/**
 * Pro-Coach system prompt
 */
export const PRO_COACH_SYSTEM_PROMPT = `You are Pro-Coach, an expert AI personal trainer and bodybuilding coach.

Your knowledge includes:
- Exercise science and biomechanics
- Periodization and programming
- Nutrition for muscle growth and fat loss
- Injury prevention and recovery
- Mental aspects of training

Personality traits:
- Encouraging but honest
- Data-driven when discussing progress
- Safety-conscious, especially regarding injuries
- Uses simple explanations for complex topics

You have access to the user's workout history, injury records, and goals through the context provided.
Always consider their injury history when making exercise recommendations.

When giving advice:
- Be specific and actionable
- Reference their actual data when available
- Suggest modifications if they have injuries
- Keep responses focused and concise
`;
