// ================================
// CADENCE EXTENSIONS - TYPES
// ================================

export type ExtensionSlug =
    | 'social-engager'
    | 'image-generator'
    | 'thread-writer'
    | 'analytics-dashboard'
    | 'hashtag-optimizer'
    | 'comment-responder'
    | 'trend-surfer'
    | 'link-in-bio'
    | 'dm-sequence-builder'

export type ExtensionCategory =
    | 'engagement'
    | 'content'
    | 'analytics'
    | 'growth'

export interface ExtensionCreditCost {
    per_use?: number
    per_day?: number
    per_month?: number
    free?: boolean
}

export interface Extension {
    id: string
    slug: ExtensionSlug
    name: string
    description: string
    icon: string
    category: ExtensionCategory
    credit_cost: ExtensionCreditCost
    features: string[]
    is_active: boolean
    is_premium: boolean
}

export interface UserExtension {
    user_id: string
    extension_slug: ExtensionSlug
    enabled: boolean
    settings: Record<string, unknown>
    credits_used_today: number
    credits_used_month: number
    last_used_at: string | null
}

export interface ExtensionUsage {
    id: string
    user_id: string
    extension_slug: ExtensionSlug
    action: string
    credits_spent: number
    metadata?: Record<string, unknown>
    created_at: string
}

// ================================
// SOCIAL ENGAGER TYPES
// ================================

export interface EngagementRule {
    id: string
    user_id: string
    name: string
    platform: 'x' | 'instagram' | 'linkedin'
    type: 'keyword' | 'account' | 'hashtag'
    target: string // The keyword, account handle, or hashtag
    action: 'like' | 'reply' | 'retweet' | 'follow'
    reply_template?: string // For auto-replies
    is_active: boolean
    daily_limit: number
    actions_today: number
    created_at: string
}

export interface EngagementLog {
    id: string
    rule_id: string
    post_url: string
    action_taken: string
    success: boolean
    error_message?: string
    created_at: string
}

// ================================
// IMAGE GENERATOR TYPES
// ================================

export interface ImageTemplate {
    id: string
    user_id: string
    name: string
    style: string // 'minimal' | 'bold' | 'professional' | 'playful'
    brand_colors: string[]
    font_style: string
    layout: string
}

export interface GeneratedImage {
    id: string
    user_id: string
    template_id?: string
    prompt: string
    image_url: string
    credits_used: number
    created_at: string
}

// ================================
// THREAD WRITER TYPES
// ================================

export interface Thread {
    id: string
    user_id: string
    project_id?: string
    title: string
    source_content?: string // Original blog/article
    tweets: ThreadTweet[]
    status: 'draft' | 'scheduled' | 'posted'
    scheduled_at?: string
    created_at: string
}

export interface ThreadTweet {
    index: number
    content: string
    media_url?: string
    char_count: number
}

// ================================
// ANALYTICS DASHBOARD TYPES
// ================================

export interface AnalyticsSnapshot {
    id: string
    user_id: string
    platform: string
    date: string
    followers: number
    following: number
    posts: number
    engagement_rate: number
    impressions: number
    profile_visits: number
    link_clicks: number
}

export interface PostAnalytics {
    id: string
    content_item_id: string
    platform: string
    impressions: number
    likes: number
    comments: number
    shares: number
    saves: number
    engagement_rate: number
    reach: number
    captured_at: string
}

// ================================
// EXTENSION REGISTRY
// ================================

export const EXTENSION_REGISTRY: Extension[] = [
    {
        id: 'ext-social-engager',
        slug: 'social-engager',
        name: 'Social Engager',
        description: 'Auto-like, reply, and engage with posts based on keywords and accounts',
        icon: '💬',
        category: 'engagement',
        credit_cost: { per_day: 100 },
        features: [
            'Keyword-based engagement',
            'Account targeting',
            'Auto-replies with AI',
            'Warm up leads before DMs',
            'Daily limits & safety controls'
        ],
        is_active: true,
        is_premium: false
    },
    {
        id: 'ext-image-generator',
        slug: 'image-generator',
        name: 'AI Image Generator',
        description: 'Generate stunning social media graphics with AI',
        icon: '🎨',
        category: 'content',
        credit_cost: { per_use: 50 },
        features: [
            'Brand template library',
            'Consistent visual style',
            'Multiple aspect ratios',
            'Auto-sync with Cadence posts',
            'Custom style training'
        ],
        is_active: true,
        is_premium: false
    },
    {
        id: 'ext-thread-writer',
        slug: 'thread-writer',
        name: 'Thread Writer',
        description: 'Turn blog posts and ideas into engaging Twitter threads',
        icon: '🧵',
        category: 'content',
        credit_cost: { per_use: 25 },
        features: [
            'Blog to thread conversion',
            'Hook optimization',
            'CTA insertion',
            'Character counting',
            'Schedule via Cadence'
        ],
        is_active: true,
        is_premium: false
    },
    {
        id: 'ext-analytics-dashboard',
        slug: 'analytics-dashboard',
        name: 'Analytics Dashboard',
        description: 'Cross-platform social analytics and insights',
        icon: '📊',
        category: 'analytics',
        credit_cost: { per_month: 500, free: true },
        features: [
            'Multi-platform metrics',
            'Post performance tracking',
            'Audience insights',
            'Best posting times',
            'Export reports'
        ],
        is_active: true,
        is_premium: false
    },
    {
        id: 'ext-hashtag-optimizer',
        slug: 'hashtag-optimizer',
        name: 'Hashtag Optimizer',
        description: 'AI-powered hashtag suggestions for maximum reach',
        icon: '#️⃣',
        category: 'growth',
        credit_cost: { free: true },
        features: [
            'Platform-specific tags',
            'Performance tracking',
            'Trending detection',
            'Competition analysis',
            'Auto-add to posts'
        ],
        is_active: true,
        is_premium: false
    },
    {
        id: 'ext-comment-responder',
        slug: 'comment-responder',
        name: 'Comment Responder',
        description: 'AI drafts replies to comments on your posts',
        icon: '💭',
        category: 'engagement',
        credit_cost: { per_use: 10 },
        features: [
            'AI-generated replies',
            'Tone matching',
            'Approval workflow',
            'Bulk respond',
            'Sentiment analysis'
        ],
        is_active: false,
        is_premium: true
    },
    {
        id: 'ext-trend-surfer',
        slug: 'trend-surfer',
        name: 'Trend Surfer',
        description: 'Monitor trending topics and create timely content',
        icon: '🌊',
        category: 'content',
        credit_cost: { per_day: 50 },
        features: [
            'Niche trend monitoring',
            'Content suggestions',
            'Auto-draft posts',
            'Viral potential scoring',
            'Real-time alerts'
        ],
        is_active: false,
        is_premium: true
    },
    {
        id: 'ext-link-in-bio',
        slug: 'link-in-bio',
        name: 'Link in Bio',
        description: 'Dynamic link-in-bio page with analytics',
        icon: '🔗',
        category: 'growth',
        credit_cost: { per_month: 200, free: true },
        features: [
            'Customizable page',
            'Click tracking',
            'A/B testing',
            'Auto-update from campaigns',
            'Custom domain support'
        ],
        is_active: false,
        is_premium: false
    },
    {
        id: 'ext-dm-sequence-builder',
        slug: 'dm-sequence-builder',
        name: 'DM Sequence Builder',
        description: 'Automated DM sequences for lead nurturing',
        icon: '📬',
        category: 'engagement',
        credit_cost: { per_use: 20 },
        features: [
            'Multi-step sequences',
            'AI personalization',
            'Trigger conditions',
            'Response handling',
            'Analytics & tracking'
        ],
        is_active: false,
        is_premium: true
    }
]

export function getExtension(slug: ExtensionSlug): Extension | undefined {
    return EXTENSION_REGISTRY.find(ext => ext.slug === slug)
}

export function getExtensionsByCategory(category: ExtensionCategory): Extension[] {
    return EXTENSION_REGISTRY.filter(ext => ext.category === category)
}

export function getActiveExtensions(): Extension[] {
    return EXTENSION_REGISTRY.filter(ext => ext.is_active)
}
