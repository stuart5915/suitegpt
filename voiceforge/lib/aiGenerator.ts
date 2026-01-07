interface AppElement {
    id: string;
    type: 'div' | 'button' | 'text' | 'input' | 'image' | 'container';
    props: Record<string, string>;
    content?: string;
}

export async function generateElementWithAI(command: string): Promise<AppElement[]> {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('API error:', error);
            return [];
        }

        const { elements } = await response.json();
        return elements || [];
    } catch (error) {
        console.error('AI generation error:', error);
        return [];
    }
}
