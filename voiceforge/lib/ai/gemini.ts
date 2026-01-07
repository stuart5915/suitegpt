import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AppSpec {
    name: string;
    description: string;
    features: string[];
    techStack: string;
    screens: string[];
    dataModels: string[];
}

export interface GeneratedApp {
    success: boolean;
    spec: AppSpec;
    code: string;
    files: { path: string; content: string }[];
    error?: string;
}

/**
 * Refine a user's app idea into a structured specification
 */
export async function refineAppIdea(prompt: string): Promise<AppSpec> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = `You are an expert mobile app product manager. A user wants to create an app.
    
Analyze their idea and create a structured specification.

User's idea: "${prompt}"

Respond in this exact JSON format (no markdown, just JSON):
{
    "name": "CamelCase app name (e.g., FitnessTracker)",
    "description": "One sentence description of what the app does",
    "features": ["feature 1", "feature 2", "feature 3"],
    "techStack": "React Native + Expo + Supabase",
    "screens": ["HomeScreen", "ProfileScreen", etc],
    "dataModels": ["User", "Workout", etc]
}

Keep it focused - max 5 features, max 6 screens. Make it buildable.`;

    try {
        const result = await model.generateContent(systemPrompt);
        const response = result.response.text();

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON in Gemini response');
        }

        const spec = JSON.parse(jsonMatch[0]);
        return spec;
    } catch (error) {
        console.error('Gemini refinement error:', error);
        return {
            name: 'MyApp',
            description: prompt.slice(0, 100),
            features: ['Core functionality'],
            techStack: 'React Native + Expo',
            screens: ['HomeScreen'],
            dataModels: ['User'],
        };
    }
}

/**
 * Generate full Expo app code from a spec using Gemini
 */
export async function generateAppCode(spec: AppSpec): Promise<GeneratedApp> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
2. Use Expo Router for navigation (app/ directory structure)
3. Create all screens listed above
4. Include modern, clean styling
5. Add placeholder data where needed
6. Make it production-ready

## Output Format:
Provide the code for each file in this EXACT format:

=== FILE: app/_layout.tsx ===
[code here]

=== FILE: app/(tabs)/index.tsx ===
[code here]

=== FILE: app/(tabs)/_layout.tsx ===
[code here]

Continue for all necessary files. Include package.json, app.json, and all screen components.`;

    try {
        console.log('🤖 Calling Gemini for app generation...');

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse files from response
        const files = parseFilesFromResponse(response);

        return {
            success: true,
            spec,
            code: response,
            files,
        };
    } catch (error) {
        console.error('Gemini generation error:', error);
        return {
            success: false,
            spec,
            code: '',
            files: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Full pipeline: refine idea + generate code
 */
export async function createApp(prompt: string): Promise<GeneratedApp> {
    console.log('Step 1: Refining app idea...');
    const spec = await refineAppIdea(prompt);

    console.log('Step 2: Generating app code...');
    const result = await generateAppCode(spec);

    return result;
}

/**
 * Parse file blocks from Gemini's response
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
