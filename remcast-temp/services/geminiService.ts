import { GoogleGenerativeAI } from '@google/generative-ai';

// Expo automatically bundles EXPO_PUBLIC_* env vars into process.env
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
console.log('🔑 Gemini API Key loaded:', GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Session-level cache for expensive operations (resets on app restart)
let sessionThemesCache: { themes: string[]; timestamp: number } | null = null;
const SESSION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes within session

export function getSessionThemesCache(): string[] | null {
    if (!sessionThemesCache) return null;
    if (Date.now() - sessionThemesCache.timestamp > SESSION_CACHE_TTL) {
        sessionThemesCache = null;
        return null;
    }
    return sessionThemesCache.themes;
}

export function setSessionThemesCache(themes: string[]): void {
    sessionThemesCache = { themes, timestamp: Date.now() };
}

// Generate reflection prompts based on scripture
export async function generateReflectionPrompts(
    reference: string,
    scriptureText: string
): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Given this Bible passage:

Reference: ${reference}
Text: ${scriptureText}

Generate exactly 3 thoughtful, personal reflection questions that help someone journal about this passage. The questions should:
1. Be open-ended and encourage deep thinking
2. Connect to personal life application
3. Be varied in focus (theological, practical, emotional)

Format your response as a numbered list (1., 2., 3.) with just the questions, no additional commentary.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the numbered list into an array
        const prompts = text
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .slice(0, 3);

        // Fallback prompts if generation fails
        if (prompts.length < 3) {
            return [
                'What does this passage reveal about God\'s character?',
                'How does this scripture challenge or encourage you today?',
                'What specific action or change is God calling you to through this passage?',
            ];
        }

        return prompts;
    } catch (error) {
        console.error('Error generating reflection prompts:', error);
        // Return fallback prompts
        return [
            'What does this passage reveal about God\'s character?',
            'How does this scripture challenge or encourage you today?',
            'What specific action is God calling you to through this passage?',
        ];
    }
}

export async function generateTLDR(reference: string, text: string): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Summarize the following Bible passage in 1-2 concise sentences. Focus on the main theme or key message.

Reference: ${reference}
Text: ${text}


Instructions:
1. Include specific verse citations in brackets using chapter:verse format like [1:3] or [2:14] when referencing specific lines.
2. For single-chapter passages, just use the verse number like [1:3].
3. Provide only the summary, no additional commentary.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text().trim();

        return summary;
    } catch (error) {
        console.error('Error generating TL;DR:', error);
        return 'A summary of this passage will help you understand its key message.';
    }
}

export async function generateExpandedTLDR(reference: string, text: string): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Provide a rich, nuanced summary of the following Bible passage.
Reference: ${reference}
Text: ${text}

Your summary should be 2-3 paragraphs long. It should:
1. Capture the core narrative or theological argument.
2. Highlight the emotional or spiritual depth of the passage.
3. Be written in a warm, inviting tone suitable for reflection.
4. IMPORTANT: Include specific verse citations in brackets using chapter:verse format like [1:14] or [2:3] throughout the text to ground the insights in the scripture.

Provide only the summary text, no headings or bullet points.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error generating expanded TL;DR:', error);
        return 'Unable to expand summary at this time.';
    }
}

// Analyze journal entries to find themes
export async function analyzeJournalThemes(
    entries: Array<{ date: string; book: string; chapter: number; reflection: string }>
): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Apply entry cap (most recent first for relevance)
        const cappedEntries = entries.slice(-MAX_CHAT_ENTRIES);
        console.log(`📊 Analyzing themes: ${cappedEntries.length} entries (capped from ${entries.length})`);

        const journalText = cappedEntries
            .map(e => `${e.date} - ${e.book} ${e.chapter}: ${e.reflection}`)
            .join('\n\n');

        const prompt = `Analyze these Bible journal entries and identify the top 5 recurring themes or patterns in the person's spiritual journey:

${journalText}

Return only a numbered list of themes (1., 2., 3., etc.) without explanations.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const themes = text
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .slice(0, 5);

        return themes.length > 0 ? themes : ['No clear themes identified yet. Keep journaling!'];
    } catch (error) {
        console.error('Error analyzing themes:', error);
        return ['Unable to analyze themes at this time.'];
    }
}

// Reflection filter types for chat context
export type ReflectionFilter = 'plan' | 'verse' | 'all';

// Maximum entries to send to AI (cost control)
const MAX_CHAT_ENTRIES = 1000;

// Chat with past journal entries
export async function chatWithPastSelf(
    question: string,
    entries: Array<{ date: string; book: string; chapter: number; reflection: string }>,
    filter: ReflectionFilter = 'all'
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Apply entry cap (most recent first for relevance)
        const cappedEntries = entries.slice(-MAX_CHAT_ENTRIES);

        console.log(`💬 Chat with past self: ${cappedEntries.length} entries (filter: ${filter}, capped from ${entries.length})`);

        const journalContext = cappedEntries
            .map(e => `${e.date} - ${e.book} ${e.chapter}: ${e.reflection}`)
            .join('\n\n');

        const prompt = `You are analyzing someone's Bible journal entries to answer their question about their spiritual journey. Be warm, insightful, and specific.

Journal Entries:
${journalContext}

Question: ${question}

Provide a thoughtful response that draws from the journal entries, citing specific dates or passages when relevant.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error in chat:', error);
        return 'I\'m having trouble analyzing your entries right now. Please try again later.';
    }
}

// Generate nuance/deep-dive questions with short title and expanded description
export interface NuancePrompt {
    title: string;      // Short (max 8 words) - shown in pill
    description: string; // Expanded (1-2 sentences) - shown when expanded
}

export async function generateNuancePrompts(reference: string, text: string): Promise<NuancePrompt[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Given this Bible passage (${reference}), generate exactly 2 "Points of Contemplation".

For each point, provide:
1. A SHORT TITLE (max 8 words) - intriguing, curiosity-sparking
2. An EXPANDED DESCRIPTION (1-2 sentences) - elaborating on the nuance, context, or question

Focus on:
- Cultural context or historical nuance
- Theological paradoxes or depth
- Commonly overlooked details

Format your response EXACTLY like this (including the labels):
1. TITLE: [short intriguing title]
   DESCRIPTION: [1-2 sentence elaboration]
2. TITLE: [short intriguing title]
   DESCRIPTION: [1-2 sentence elaboration]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();

        // Parse the structured response
        const prompts: NuancePrompt[] = [];
        const sections = rawText.split(/\d+\.\s*/).filter(s => s.trim());

        for (const section of sections) {
            const titleMatch = section.match(/TITLE:\s*(.+?)(?:\n|DESCRIPTION:)/i);
            const descMatch = section.match(/DESCRIPTION:\s*(.+)/is);

            if (titleMatch && descMatch) {
                prompts.push({
                    title: titleMatch[1].trim(),
                    description: descMatch[1].trim().replace(/\n+/g, ' ')
                });
            }
        }

        // Fallback: if parsing fails, try line-based approach
        if (prompts.length < 1) {
            const lines = rawText.split('\n').filter(l => l.trim());
            for (let i = 0; i < lines.length && prompts.length < 2; i++) {
                const line = lines[i].replace(/^\d+\.\s*/, '').trim();
                if (line && !line.startsWith('TITLE') && !line.startsWith('DESCRIPTION')) {
                    prompts.push({ title: line.slice(0, 50), description: line });
                }
            }
        }

        if (prompts.length < 1) {
            throw new Error('No prompts generated');
        }

        return prompts.slice(0, 2);
    } catch (error) {
        console.error('Error generating nuance prompts:', error);
        return [
            { title: 'Cultural framework', description: 'Consider the historical and cultural context in which this passage was written.' },
            { title: 'Hidden parallels', description: 'What connections to other scripture or historical events might be easily overlooked here?' }
        ];
    }
}

// Generate deep dive content for a specific nuance question
export async function generateNuanceDeepDive(question: string, reference: string, text: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Provide a 2-paragraph deep dive into this specific contemplation point: "${question}"
Based on the Bible passage: ${reference}.

Content guidelines:
- Paragraph 1: Context/History/Theology. Explain the depth, the original Greek/Hebrew nuance, or the historical setting.
- Paragraph 2: Significance. Why does this matter? What is the profound implication?

Tone: Academic but accessible, "Modern Sacred Space". High-quality, insightful commentary. No generic fluff.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error generating deep dive:', error);
        return 'We are unable to retrieve the deep dive for this point right now. Please try again later.';
    }
}
