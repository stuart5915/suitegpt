// Image template definitions for social media posts
// Each template has a unique style suited for different content types

export interface TemplateConfig {
    id: string
    name: string
    keywords: string[]  // Keywords that trigger this template
    background: string  // CSS gradient or color
    accentColor: string
    textColor: string
    secondaryTextColor: string
    pattern?: 'dots' | 'grid' | 'waves' | 'none'
    style: 'bold' | 'minimal' | 'split' | 'centered'
}

// Platform dimensions
export const PLATFORM_DIMENSIONS = {
    instagram: { width: 1080, height: 1080 },
    tiktok: { width: 1080, height: 1920 },
    x: { width: 1200, height: 675 },
    linkedin: { width: 1200, height: 628 },
} as const

// Template definitions
export const TEMPLATES: TemplateConfig[] = [
    {
        id: 'launch',
        name: 'Launch / Announcement',
        keywords: ['launch', 'live', 'announcing', 'introducing', 'new', 'released', 'shipped', 'just launched', 'now available'],
        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
        accentColor: '#34d399',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.8)',
        pattern: 'dots',
        style: 'bold'
    },
    {
        id: 'comparison',
        name: 'Comparison / VS',
        keywords: ['vs', 'versus', 'compared', 'difference', 'unlike', 'chatgpt', 'bolt', 'other', 'competition', 'alternative'],
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%)',
        accentColor: '#f43f5e',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.7)',
        pattern: 'grid',
        style: 'split'
    },
    {
        id: 'pain-point',
        name: 'Pain Point / Problem',
        keywords: ['problem', 'pain', 'frustrat', 'broken', 'fail', 'error', 'bug', 'crash', 'spent', 'wasted', 'tired', '$500', '$1000', 'expensive'],
        background: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
        accentColor: '#ef4444',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.6)',
        pattern: 'none',
        style: 'bold'
    },
    {
        id: 'value-prop',
        name: 'Value Proposition',
        keywords: ['real apps', 'working', 'solution', 'easy', 'simple', 'just works', 'no code', 'build', 'create', 'get'],
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0ea5e9 100%)',
        accentColor: '#38bdf8',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.8)',
        pattern: 'waves',
        style: 'centered'
    },
    {
        id: 'tips',
        name: 'Tips / Educational',
        keywords: ['tip', 'how to', 'learn', 'guide', 'steps', 'questions', 'ask', 'before', 'should', 'must', 'important'],
        background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',
        accentColor: '#c4b5fd',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.85)',
        pattern: 'dots',
        style: 'minimal'
    },
    {
        id: 'social-proof',
        name: 'Social Proof / Results',
        keywords: ['users', 'people', 'everyone', 'testimonial', 'review', 'result', 'success', 'built', 'created', 'made'],
        background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)',
        accentColor: '#99f6e4',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.85)',
        pattern: 'grid',
        style: 'centered'
    }
]

// Default template if no keywords match
export const DEFAULT_TEMPLATE = TEMPLATES[0] // Launch template

/**
 * Analyze post content and select the best matching template
 */
export function selectTemplate(content: string): TemplateConfig {
    const lowerContent = content.toLowerCase()

    // Score each template based on keyword matches
    let bestMatch = DEFAULT_TEMPLATE
    let highestScore = 0

    for (const template of TEMPLATES) {
        let score = 0
        for (const keyword of template.keywords) {
            if (lowerContent.includes(keyword.toLowerCase())) {
                // Longer keywords are more specific, give them more weight
                score += keyword.length
            }
        }
        if (score > highestScore) {
            highestScore = score
            bestMatch = template
        }
    }

    return bestMatch
}

/**
 * Extract a headline from post content
 * Takes the first impactful line or sentence
 */
export function extractHeadline(content: string, maxLength: number = 60): string {
    // Split by newlines and get first non-empty line
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length === 0) return 'SuiteGPT'

    let headline = lines[0].trim()

    // Remove common prefixes
    headline = headline.replace(/^(HOOK:|SCRIPT:|CAPTION:)\s*/i, '')

    // Remove hashtags
    headline = headline.replace(/#\w+/g, '').trim()

    // Remove URLs
    headline = headline.replace(/https?:\/\/\S+/g, '').trim()

    // Remove emojis at the start
    headline = headline.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*/u, '')

    // Truncate if too long
    if (headline.length > maxLength) {
        headline = headline.substring(0, maxLength - 3).trim() + '...'
    }

    return headline || 'SuiteGPT'
}

/**
 * Extract a subheadline or supporting text
 */
export function extractSubheadline(content: string, maxLength: number = 100): string {
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length < 2) return 'Your Personal App Concierge'

    // Get second or third line as subheadline
    let subheadline = lines[1]?.trim() || lines[2]?.trim() || ''

    // Clean up
    subheadline = subheadline.replace(/#\w+/g, '').trim()
    subheadline = subheadline.replace(/https?:\/\/\S+/g, '').trim()

    if (subheadline.length > maxLength) {
        subheadline = subheadline.substring(0, maxLength - 3).trim() + '...'
    }

    return subheadline || 'Real apps, not answers.'
}
