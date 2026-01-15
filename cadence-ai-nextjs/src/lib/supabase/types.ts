// ================================
// CADENCE AI - DATABASE TYPES
// ================================

export type Platform = 'x' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'

export type ContentType =
    | 'text'
    | 'image'
    | 'carousel'
    | 'infographic'
    | 'comparison'
    | 'collage'
    | 'knowledge'
    | 'testimonial'
    | 'behind_scenes'
    | 'video_script'
    | 'ai_video'
    | 'story'
    | 'thread'
    | 'poll'
    | 'live_prompt'

export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'posted' | 'failed'

export type WeeklyPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed'

// ================================
// DATABASE TABLES
// ================================

export interface Project {
    id: string
    user_id: string
    name: string
    description: string | null
    brand_voice: string | null
    brand_tone: string | null // e.g. 'casual', 'professional', 'inspirational', 'educational'
    emoji_style: string | null // e.g. 'heavy', 'minimal', 'none'
    default_hashtags: string[] | null
    target_audience: string | null
    content_pillars: string[]
    platforms: Platform[]
    posting_schedule: PostingSchedule | null
    logo_url: string | null
    created_at: string
    updated_at: string
}

export interface PostingSchedule {
    [platform: string]: {
        days: number[] // 0-6, Sunday-Saturday
        times: string[] // HH:mm format
    }
}

export interface WeeklyPlan {
    id: string
    project_id: string
    week_start: string // YYYY-MM-DD (Monday)
    status: WeeklyPlanStatus
    ai_proposal: string | null
    user_feedback: string | null
    created_at: string
    updated_at: string
}

export interface ContentItem {
    id: string
    weekly_plan_id: string
    project_id: string

    // Scheduling
    scheduled_date: string // YYYY-MM-DD
    scheduled_time: string | null // HH:mm
    platform: Platform

    // Content
    content_type: ContentType
    caption: string | null
    media_urls: string[]
    hashtags: string[]

    // Status
    status: ContentStatus
    posted_at: string | null

    // AI context
    ai_reasoning: string | null

    created_at: string
    updated_at: string
}

export interface Conversation {
    id: string
    weekly_plan_id: string | null
    content_item_id: string | null
    role: 'user' | 'assistant'
    message: string
    created_at: string
}

// ================================
// API RESPONSE TYPES
// ================================

export interface WeeklyProposal {
    summary: string
    content_items: ProposedContentItem[]
}

export interface ProposedContentItem {
    day: string // 'monday', 'tuesday', etc.
    platform: Platform
    content_type: ContentType
    caption: string
    hashtags: string[]
    reasoning: string
    media_prompt?: string // For AI image generation
}

// ================================
// UI HELPER TYPES
// ================================

export interface ProjectWithStats extends Project {
    content_count: number
    posts_this_week: number
    next_post_date: string | null
}

export interface ContentItemWithProject extends ContentItem {
    project: Pick<Project, 'id' | 'name' | 'logo_url'>
}

// Platform metadata
export const PLATFORM_CONFIG: Record<Platform, {
    name: string
    icon: string
    color: string
    maxLength: number
    supportsMedia: boolean
    supportsCarousel: boolean
    supportsStory: boolean
}> = {
    x: {
        name: 'X',
        icon: '𝕏',
        color: '#000000',
        maxLength: 280,
        supportsMedia: true,
        supportsCarousel: false,
        supportsStory: false,
    },
    instagram: {
        name: 'Instagram',
        icon: '📷',
        color: '#E4405F',
        maxLength: 2200,
        supportsMedia: true,
        supportsCarousel: true,
        supportsStory: true,
    },
    linkedin: {
        name: 'LinkedIn',
        icon: '💼',
        color: '#0A66C2',
        maxLength: 3000,
        supportsMedia: true,
        supportsCarousel: true,
        supportsStory: false,
    },
    tiktok: {
        name: 'TikTok',
        icon: '🎵',
        color: '#000000',
        maxLength: 2200,
        supportsMedia: true,
        supportsCarousel: false,
        supportsStory: false,
    },
    youtube: {
        name: 'YouTube',
        icon: '▶️',
        color: '#FF0000',
        maxLength: 5000,
        supportsMedia: true,
        supportsCarousel: false,
        supportsStory: false,
    },
}

// Content type metadata
export const CONTENT_TYPE_CONFIG: Record<ContentType, {
    name: string
    description: string
    icon: string
    color: string
    platforms: Platform[]
}> = {
    text: {
        name: 'Text Post',
        description: 'Plain text content',
        icon: '📝',
        color: '#6366f1',
        platforms: ['x', 'linkedin'],
    },
    image: {
        name: 'Image',
        description: 'Single image with caption',
        icon: '🖼️',
        color: '#14b8a6',
        platforms: ['x', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
    carousel: {
        name: 'Carousel',
        description: 'Multiple swipeable images',
        icon: '🎠',
        color: '#8b5cf6',
        platforms: ['instagram', 'linkedin'],
    },
    infographic: {
        name: 'Infographic',
        description: 'Data visualization or educational graphic',
        icon: '📊',
        color: '#06b6d4',
        platforms: ['x', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
    comparison: {
        name: 'Comparison',
        description: 'Side-by-side comparison',
        icon: '⚖️',
        color: '#f97316',
        platforms: ['x', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
    collage: {
        name: 'Collage',
        description: 'Multiple images in one',
        icon: '🎨',
        color: '#ec4899',
        platforms: ['instagram', 'x'],
    },
    knowledge: {
        name: 'Knowledge',
        description: 'Educational or informational',
        icon: '💡',
        color: '#eab308',
        platforms: ['linkedin', 'x'],
    },
    testimonial: {
        name: 'Testimonial',
        description: 'Customer review or social proof',
        icon: '⭐',
        color: '#f59e0b',
        platforms: ['x', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
    behind_scenes: {
        name: 'Behind the Scenes',
        description: 'Authentic and personal content',
        icon: '🎬',
        color: '#a855f7',
        platforms: ['instagram', 'tiktok'],
    },
    video_script: {
        name: 'Video Script',
        description: 'Script for you to record',
        icon: '🎥',
        color: '#f97316',
        platforms: ['tiktok', 'youtube', 'instagram'],
    },
    ai_video: {
        name: 'AI Video',
        description: 'AI-generated video content',
        icon: '🤖',
        color: '#6366f1',
        platforms: ['tiktok', 'youtube'],
    },
    story: {
        name: 'Story',
        description: 'Ephemeral vertical content',
        icon: '📱',
        color: '#ec4899',
        platforms: ['instagram', 'tiktok'],
    },
    thread: {
        name: 'Thread',
        description: 'Multi-part connected posts',
        icon: '🧵',
        color: '#3b82f6',
        platforms: ['x'],
    },
    poll: {
        name: 'Poll',
        description: 'Interactive poll',
        icon: '📊',
        color: '#22c55e',
        platforms: ['x', 'linkedin'],
    },
    live_prompt: {
        name: 'Live Prompt',
        description: 'Suggested topics for live stream',
        icon: '🔴',
        color: '#ef4444',
        platforms: ['instagram', 'tiktok', 'youtube'],
    },
}
