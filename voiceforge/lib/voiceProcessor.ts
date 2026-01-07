// Fast local command pattern matching
// Designed for ~20ms processing time

interface AppElement {
    id: string;
    type: 'div' | 'button' | 'text' | 'input' | 'image';
    props: Record<string, string>;
    content?: string;
}

// Color mapping
const COLORS: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#a855f7',
    pink: '#ec4899',
    orange: '#f97316',
    black: '#1f2937',
    white: '#ffffff',
    gray: '#6b7280',
    grey: '#6b7280',
};

// Command patterns with regex
const patterns: Array<{
    regex: RegExp;
    handler: (match: RegExpMatchArray) => AppElement | null;
}> = [
        // "[add] a [color] button [that says X]" - prefix optional
        {
            regex: /(?:add|create|make)?\s*(?:a\s+)?(\w+)?\s*button(?:\s+(?:that\s+)?says?\s+["']?(.+?)["']?)?$/i,
            handler: (match) => ({
                id: generateId(),
                type: 'button',
                props: { color: COLORS[match[1]?.toLowerCase()] || '#3b82f6', rounded: 'true' },
                content: match[2] || 'Button',
            }),
        },

        // "add text/header [that says X]"
        {
            regex: /(?:add|create|make)\s+(?:a\s+)?(?:text|header|heading|title)(?:\s+(?:that\s+)?says?\s+["']?(.+?)["']?)?$/i,
            handler: (match) => ({
                id: generateId(),
                type: 'text',
                props: { size: 'large' },
                content: match[1] || 'Hello World',
            }),
        },

        // "add an input [field]"
        {
            regex: /(?:add|create|make)\s+(?:a|an)?\s*input(?:\s+field)?(?:\s+(?:for|with|placeholder)\s+["']?(.+?)["']?)?$/i,
            handler: (match) => ({
                id: generateId(),
                type: 'input',
                props: { rounded: 'true' },
                content: match[1] || 'Enter text...',
            }),
        },

        // "add a [color] box/div/container"
        {
            regex: /(?:add|create|make)\s+(?:a\s+)?(\w+)?\s*(?:box|div|container|rectangle|square)$/i,
            handler: (match) => ({
                id: generateId(),
                type: 'div',
                props: {
                    color: COLORS[match[1]?.toLowerCase()] || '#e5e7eb',
                    rounded: 'true'
                },
                content: '',
            }),
        },

        // "add an image/picture"
        {
            regex: /(?:add|create|make)\s+(?:a|an)?\s*(?:image|picture|photo)$/i,
            handler: () => ({
                id: generateId(),
                type: 'image',
                props: { color: '#f3f4f6', rounded: 'true' },
            }),
        },

        // "[add] a [color] circle" - catches "a red circle" or "red circle"
        {
            regex: /(?:add|create|make)?\s*(?:a\s+)?(\w+)?\s*circle$/i,
            handler: (match) => ({
                id: generateId(),
                type: 'div',
                props: {
                    color: COLORS[match[1]?.toLowerCase()] || '#3b82f6',
                    rounded: 'full'
                },
                content: '',
            }),
        },
    ];

// Generate unique ID
function generateId(): string {
    return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Process a voice command - returns new element or null
export async function processCommand(
    command: string,
    existingElements: AppElement[]
): Promise<AppElement | null> {
    const startTime = performance.now();

    // Normalize command
    const normalized = command.toLowerCase().trim();

    // Try pattern matching first (fast path)
    for (const pattern of patterns) {
        const match = normalized.match(pattern.regex);
        if (match) {
            const result = pattern.handler(match);
            console.log(`Pattern matched in ${(performance.now() - startTime).toFixed(1)}ms`);
            return result;
        }
    }

    // If no pattern matched, could fall back to AI here
    // For now, return null
    console.log(`No pattern matched for: "${command}" (${(performance.now() - startTime).toFixed(1)}ms)`);
    return null;
}

// Export for testing
export { patterns, COLORS };
