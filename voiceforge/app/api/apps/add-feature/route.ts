import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AppSpec {
    name: string;
    description: string;
    features: string[];
    screens: string[];
}

interface AppFile {
    path: string;
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        const { appId, currentSpec, currentFiles, newFeature } = await request.json();

        if (!newFeature) {
            return NextResponse.json(
                { error: 'No feature specified' },
                { status: 400 }
            );
        }

        console.log('Adding feature:', newFeature);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `## Task: Add a feature to an existing Expo app

**Current App:** ${currentSpec.name}
**Current Description:** ${currentSpec.description}
**Current Features:**
${currentSpec.features.map((f: string) => `- ${f}`).join('\n')}

**New Feature to Add:** ${newFeature}

## Current Files:
${currentFiles.slice(0, 3).map((f: AppFile) => `
=== ${f.path} ===
${f.content.substring(0, 500)}...
`).join('\n')}

## Instructions:
1. Add the new feature to the existing app
2. Update only the files that need changes
3. Keep the app structure intact

## Output Format:
First, output the updated spec as JSON:
=== SPEC ===
{
    "name": "${currentSpec.name}",
    "description": "updated description",
    "features": [...existing features..., "new feature"],
    "screens": [...]
}

Then output each modified file:
=== FILE: path/to/file.tsx ===
[complete file content]

Only include files that were actually modified.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse updated spec
        const specMatch = response.match(/=== SPEC ===([\s\S]*?)(?==== FILE:|$)/);
        let updatedSpec = currentSpec;
        if (specMatch) {
            try {
                const jsonMatch = specMatch[1].match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    updatedSpec = JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                // Keep current spec if parsing fails
            }
        }

        // Parse updated files
        const fileRegex = /=== FILE: (.+?) ===([\s\S]*?)(?==== FILE:|=== SPEC|$)/g;
        const updatedFiles = [...currentFiles];

        let match;
        while ((match = fileRegex.exec(response)) !== null) {
            const path = match[1].trim();
            let content = match[2].trim();
            content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');

            // Update or add file
            const existingIndex = updatedFiles.findIndex((f: AppFile) => f.path === path);
            if (existingIndex >= 0) {
                updatedFiles[existingIndex].content = content;
            } else {
                updatedFiles.push({ path, content });
            }
        }

        // Add feature to spec if not already added
        if (!updatedSpec.features.includes(newFeature)) {
            updatedSpec.features.push(newFeature);
        }

        // Ensure screens is preserved (Gemini sometimes drops it)
        if (!updatedSpec.screens || updatedSpec.screens.length === 0) {
            updatedSpec.screens = currentSpec.screens || ['HomeScreen', 'SettingsScreen'];
        }

        return NextResponse.json({
            success: true,
            app: {
                id: appId,
                name: updatedSpec.name,
                description: updatedSpec.description,
                spec: updatedSpec,
                files: updatedFiles,
            },
        });
    } catch (error) {
        console.error('Add feature error:', error);
        return NextResponse.json(
            { error: 'Failed to add feature' },
            { status: 500 }
        );
    }
}
