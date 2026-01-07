import { NextRequest, NextResponse } from 'next/server';
import { createApp } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt || prompt.length < 10) {
            return NextResponse.json(
                { error: 'Please provide a more detailed app description' },
                { status: 400 }
            );
        }

        console.log('Creating app from prompt:', prompt.substring(0, 50) + '...');

        const result = await createApp(prompt);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to generate app' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            app: {
                id: `app_${Date.now()}`,
                name: result.spec.name,
                description: result.spec.description,
                spec: result.spec,
                files: result.files,
                createdAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('App creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create app' },
            { status: 500 }
        );
    }
}
