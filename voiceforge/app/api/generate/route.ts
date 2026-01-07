import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const systemPrompt = `You are a UI component generator. Given a user's natural language description, output JSON describing UI element(s) to create.

For SIMPLE requests (single element), output one object:
{"type":"button","props":{"color":"#ef4444"},"content":"Click Me"}

For COMPLEX requests (like "make a landing page" or "build a form"), output an ARRAY of elements:
[
  {"type":"text","props":{"size":"large","color":"#1f2937"},"content":"Welcome to My Site"},
  {"type":"text","props":{"size":"medium","color":"#6b7280"},"content":"The best place for..."},
  {"type":"button","props":{"color":"#3b82f6","rounded":"true"},"content":"Get Started"}
]

Available types: button, text, input, div, container
Props: color (hex), size (small/medium/large), rounded (true/false/full), width, height

Examples:
- "red button" → {"type":"button","props":{"color":"#ef4444","rounded":"true"},"content":"Button"}
- "blue circle" → {"type":"div","props":{"color":"#3b82f6","rounded":"full","width":"100px","height":"100px"},"content":""}
- "landing page" → [{"type":"text","props":{"size":"large"},"content":"Welcome"},{"type":"text","props":{"size":"medium","color":"#6b7280"},"content":"Build amazing things"},{"type":"button","props":{"color":"#f97316"},"content":"Get Started"}]

Respond ONLY with JSON (object or array), nothing else.`;

export async function POST(request: NextRequest) {
    try {
        const { command } = await request.json();

        if (!command) {
            return NextResponse.json({ error: 'No command provided' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent([
            { text: systemPrompt },
            { text: `User request: "${command}"` }
        ]);

        const response = result.response.text();
        console.log('AI Response:', response);

        // Try to parse JSON from response (array or object)
        const jsonMatch = response.match(/[\[\{][\s\S]*[\]\}]/);
        if (!jsonMatch) {
            console.error('No JSON found in:', response);
            return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize to array
        const items = Array.isArray(parsed) ? parsed : [parsed];

        // Create elements with IDs
        const elements = items.map((item: { type?: string; props?: Record<string, string>; content?: string }) => ({
            id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: item.type || 'div',
            props: item.props || {},
            content: item.content || '',
        }));

        return NextResponse.json({ elements });
    } catch (error) {
        console.error('AI generation error:', error);
        return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }
}
