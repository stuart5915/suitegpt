import Anthropic from '@anthropic-ai/sdk';
import { AppSpec } from './gemini';

let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
    if (!anthropic) {
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || '',
        });
    }
    return anthropic;
}

export interface GeneratedApp {
    success: boolean;
    code: string;
    explanation: string;
    files: { path: string; content: string }[];
    error?: string;
}

/**
 * Generate full Expo app code from a spec
 */
export async function generateAppCode(spec: AppSpec): Promise<GeneratedApp> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return {
            success: false,
            code: '',
            explanation: '',
            files: [],
            error: 'Claude API not configured. Add ANTHROPIC_API_KEY to environment.',
        };
    }

    const client = getAnthropicClient();

    const prompt = `## Task: Generate a complete Expo React Native app

**App Name:** ${spec.name}
**Description:** ${spec.description}
**Tech Stack:** ${spec.techStack}

**Features:**
${spec.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

**Screens:**
${spec.screens.map(s => `- ${s}`).join('\n')}

**Data Models:**
${spec.dataModels.map(m => `- ${m}`).join('\n')}

## Requirements:
1. Generate a working Expo app with TypeScript
2. Use React Navigation for navigation
3. Create all screens listed above
4. Include basic styling that looks modern
5. Add placeholder data where needed
6. Make it production-ready

## Output Format:
Provide the code for each file in this format:

=== FILE: app/_layout.tsx ===
[code here]

=== FILE: app/(tabs)/index.tsx ===
[code here]

Continue for all necessary files.`;

    try {
        console.log('🤖 Calling Claude for app generation...');

        const message = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: `You are an expert React Native/Expo developer. Generate clean, well-structured, production-ready code.
Use Expo Router for navigation. Include proper TypeScript types. Make the UI look modern and polished.`,
            messages: [
                { role: 'user', content: prompt }
            ],
        });

        const response = message.content[0].type === 'text' ? message.content[0].text : '';

        // Parse files from response
        const files = parseFilesFromResponse(response);

        return {
            success: true,
            code: response,
            explanation: `Generated ${files.length} files for ${spec.name}`,
            files,
        };
    } catch (error) {
        console.error('Claude API error:', error);
        return {
            success: false,
            code: '',
            explanation: '',
            files: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Parse file blocks from Claude's response
 */
function parseFilesFromResponse(response: string): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];
    const fileRegex = /=== FILE: (.+?) ===([\s\S]*?)(?==== FILE:|$)/g;

    let match;
    while ((match = fileRegex.exec(response)) !== null) {
        const path = match[1].trim();
        let content = match[2].trim();

        // Remove markdown code blocks if present
        content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');

        files.push({ path, content });
    }

    return files;
}
