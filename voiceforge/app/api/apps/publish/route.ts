import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PublishRequest {
    app: {
        id: string;
        name: string;
        description: string;
        spec: {
            name: string;
            description: string;
            features: string[];
            screens: string[];
        };
        files: { path: string; content: string }[];
    };
    creatorName?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { app, creatorName = 'Web User' }: PublishRequest = await request.json();

        if (!app?.name) {
            return NextResponse.json(
                { error: 'App name is required' },
                { status: 400 }
            );
        }

        // Generate slug from app name
        const slug = app.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            + '-' + Date.now().toString(36);

        // Package the app code as JSON
        const codePackage = JSON.stringify({
            spec: app.spec,
            files: app.files,
            generatedAt: new Date().toISOString(),
            source: 'web-builder',
        });

        // Insert into Supabase apps table
        const { data, error } = await supabase
            .from('apps')
            .insert({
                name: app.name,
                slug: slug,
                description: app.description || app.spec.description,
                creator_name: creatorName,
                status: 'pending',
                category: detectCategory(app.spec.features),
                // Store the full code package
                code: codePackage,
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to save app: ' + error.message },
                { status: 500 }
            );
        }

        console.log('App published to Supabase:', data.id, data.name);

        return NextResponse.json({
            success: true,
            app: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                status: data.status,
            },
            message: `${app.name} submitted for review!`,
        });
    } catch (error) {
        console.error('Publish error:', error);
        return NextResponse.json(
            { error: 'Failed to publish app' },
            { status: 500 }
        );
    }
}

// Detect category based on features
function detectCategory(features: string[]): string {
    const featureText = features.join(' ').toLowerCase();

    if (featureText.includes('workout') || featureText.includes('fitness') || featureText.includes('exercise')) {
        return 'fitness';
    }
    if (featureText.includes('health') || featureText.includes('nutrition') || featureText.includes('meal')) {
        return 'health';
    }
    if (featureText.includes('budget') || featureText.includes('expense') || featureText.includes('money')) {
        return 'finance';
    }
    if (featureText.includes('task') || featureText.includes('todo') || featureText.includes('habit')) {
        return 'productivity';
    }
    if (featureText.includes('recipe') || featureText.includes('cook') || featureText.includes('food')) {
        return 'lifestyle';
    }
    if (featureText.includes('note') || featureText.includes('journal') || featureText.includes('diary')) {
        return 'productivity';
    }

    return 'utility';
}
