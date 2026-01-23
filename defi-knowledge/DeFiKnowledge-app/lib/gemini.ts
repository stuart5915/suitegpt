// Gemini AI Service for article summaries
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface ArticleSummary {
    summary: string;
    keyPoints: string[];
    readingTime: string;
}

export async function generateArticleSummary(
    title: string,
    source: string,
    url: string
): Promise<ArticleSummary | null> {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured');
        return null;
    }

    try {
        const prompt = `You are a helpful DeFi and cryptocurrency education assistant. Based on this article title and source, provide a brief educational summary:

Article: "${title}"
Source: ${source}

Respond in this exact JSON format:
{
  "summary": "A 2-3 sentence summary explaining what this article is about and why it matters for someone learning about crypto/DeFi",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "readingTime": "X min read"
}

Keep the summary beginner-friendly and educational. If the article seems unrelated to crypto/finance, still provide a helpful summary but note that it may not be directly about cryptocurrency.`;

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return null;
        }

        // Parse JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            summary: parsed.summary || 'Summary not available',
            keyPoints: parsed.keyPoints || [],
            readingTime: parsed.readingTime || '2 min read',
        };
    } catch (error) {
        console.error('Failed to generate summary:', error);
        return null;
    }
}
// ... existing code ...

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export async function sendChatMessage(history: ChatMessage[], newMessage: string): Promise<string | null> {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured');
        return "Error: API Key not configured";
    }

    try {
        // Format history for Gemini API
        const contents = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        // Add new message
        contents.push({
            role: 'user',
            parts: [{ text: newMessage }]
        });

        // Add system instruction as the first part if needed, 
        // but for flash model usually we can just prepend context to the first message 
        // or use system_instruction if supported. 
        // For simplicity and compatibility with standard generateContent, 
        // we'll rely on the context being implicit or added to the first message if we were doing a rigorous system prompt.
        // But here we'll just send the conversation flow.

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                },
                // Optional: Add safety settings here
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return "Sorry, I'm having trouble connecting right now. Please try again.";
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return text || "I didn't quite get that.";
    } catch (error) {
        console.error('Failed to send chat message:', error);
        return "Connection error. Please check your internet.";
    }
}
