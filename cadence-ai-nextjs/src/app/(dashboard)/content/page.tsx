'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    Search,
    Filter,
    Calendar,
    Clock,
    Copy,
    ExternalLink,
    Check,
    MoreHorizontal,
    ChevronDown,
    Image as ImageIcon,
    FileText,
    Video,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { ContentType, Platform, CONTENT_TYPE_CONFIG, PLATFORM_CONFIG } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'

// Mock data
const mockContent = [
    {
        id: '1',
        project: { id: '1', name: 'FoodApp' },
        platform: 'instagram' as Platform,
        content_type: 'image' as ContentType,
        caption: '🌅 Starting the week right! Your Monday reminder that small steps lead to big changes...',
        scheduled_date: '2025-01-06',
        scheduled_time: '09:00',
        status: 'approved',
        hashtags: ['MondayMotivation', 'HealthyLiving'],
    },
    {
        id: '2',
        project: { id: '1', name: 'FoodApp' },
        platform: 'x' as Platform,
        content_type: 'thread' as ContentType,
        caption: '🧵 5 meal prep mistakes that are sabotaging your nutrition goals...',
        scheduled_date: '2025-01-06',
        scheduled_time: '12:00',
        status: 'approved',
        hashtags: ['MealPrep', 'NutritionTips'],
    },
    {
        id: '3',
        project: { id: '2', name: 'FitTrack Pro' },
        platform: 'linkedin' as Platform,
        content_type: 'knowledge' as ContentType,
        caption: 'The real ROI of investing in employee nutrition programs...',
        scheduled_date: '2025-01-06',
        scheduled_time: '15:00',
        status: 'scheduled',
        hashtags: ['WorkplaceWellness', 'EmployeeHealth'],
    },
    {
        id: '4',
        project: { id: '1', name: 'FoodApp' },
        platform: 'tiktok' as Platform,
        content_type: 'video_script' as ContentType,
        caption: '[HOOK] "This 30-second breakfast hack changed my mornings"...',
        scheduled_date: '2025-01-07',
        scheduled_time: '10:00',
        status: 'draft',
        hashtags: ['BreakfastHack', 'MealPrep'],
    },
    {
        id: '5',
        project: { id: '3', name: 'BiblApp' },
        platform: 'instagram' as Platform,
        content_type: 'carousel' as ContentType,
        caption: 'SWIPE → to see 7 verses for when you\'re feeling anxious...',
        scheduled_date: '2025-01-07',
        scheduled_time: '18:00',
        status: 'posted',
        hashtags: ['DailyScripture', 'Faith'],
    },
]

const statusConfig = {
    draft: { label: 'Draft', color: 'var(--foreground-subtle)', icon: AlertCircle },
    approved: { label: 'Approved', color: 'var(--primary)', icon: Check },
    scheduled: { label: 'Scheduled', color: 'var(--warning)', icon: Clock },
    posted: { label: 'Posted', color: 'var(--success)', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'var(--error)', icon: AlertCircle },
}

export default function ContentPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const filteredContent = mockContent.filter((item) => {
        const matchesSearch = item.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.project.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform
        const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus
        return matchesSearch && matchesPlatform && matchesStatus
    })

    const handleCopyCaption = async (id: string, caption: string) => {
        await navigator.clipboard.writeText(caption)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const getPlatformDeepLink = (platform: Platform) => {
        const links: Record<Platform, string> = {
            instagram: 'https://www.instagram.com/',
            x: 'https://twitter.com/compose/tweet',
            linkedin: 'https://www.linkedin.com/feed/',
            tiktok: 'https://www.tiktok.com/upload',
            youtube: 'https://studio.youtube.com/',
        }
        return links[platform]
    }

    const getContentIcon = (type: ContentType) => {
        switch (type) {
            case 'image':
            case 'carousel':
            case 'collage':
            case 'infographic':
                return <ImageIcon className="w-4 h-4" />
            case 'video_script':
            case 'ai_video':
                return <Video className="w-4 h-4" />
            case 'poll':
                return <BarChart3 className="w-4 h-4" />
            default:
                return <FileText className="w-4 h-4" />
        }
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Content Queue</h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    Manage and post your scheduled content
                </p>
            </header>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]" />
                    <input
                        type="text"
                        placeholder="Search content..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>

                {/* Platform Filter */}
                <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="input w-40"
                >
                    <option value="all">All Platforms</option>
                    <option value="instagram">Instagram</option>
                    <option value="x">X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                </select>

                {/* Status Filter */}
                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="input w-40"
                >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="posted">Posted</option>
                </select>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 mb-6 p-4 bg-[var(--surface)] rounded-xl">
                <div>
                    <p className="text-sm text-[var(--foreground-muted)]">Total</p>
                    <p className="text-2xl font-bold text-[var(--foreground)]">{mockContent.length}</p>
                </div>
                <div className="h-8 w-px bg-[var(--surface-border)]" />
                <div>
                    <p className="text-sm text-[var(--foreground-muted)]">Ready to Post</p>
                    <p className="text-2xl font-bold text-[var(--primary)]">
                        {mockContent.filter(c => c.status === 'approved').length}
                    </p>
                </div>
                <div className="h-8 w-px bg-[var(--surface-border)]" />
                <div>
                    <p className="text-sm text-[var(--foreground-muted)]">Posted</p>
                    <p className="text-2xl font-bold text-[var(--success)]">
                        {mockContent.filter(c => c.status === 'posted').length}
                    </p>
                </div>
            </div>

            {/* Content List */}
            <div className="space-y-4">
                {filteredContent.map((content) => {
                    const StatusIcon = statusConfig[content.status as keyof typeof statusConfig].icon

                    return (
                        <div
                            key={content.id}
                            className="card p-4 hover:transform-none"
                        >
                            <div className="flex items-start gap-4">
                                {/* Left: Platform & Type */}
                                <div className="flex flex-col items-center gap-2">
                                    <span className={`badge badge-${content.platform} flex items-center gap-1.5`}>
                                        <PlatformIcon platform={content.platform} size={12} colored={false} />
                                        {PLATFORM_NAMES[content.platform] || content.platform}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                        {getContentIcon(content.content_type)}
                                        <span>{CONTENT_TYPE_CONFIG[content.content_type].name}</span>
                                    </div>
                                </div>

                                {/* Center: Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-[var(--foreground)]">
                                            {content.project.name}
                                        </span>
                                        <span className="text-[var(--foreground-muted)]">•</span>
                                        <span className="text-sm text-[var(--foreground-muted)]">
                                            <Calendar className="w-3 h-3 inline mr-1" />
                                            {new Date(content.scheduled_date).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                        <span className="text-sm text-[var(--foreground-muted)]">
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {content.scheduled_time}
                                        </span>
                                    </div>

                                    <p className="text-[var(--foreground)] text-sm line-clamp-2 mb-2">
                                        {content.caption}
                                    </p>

                                    <div className="flex flex-wrap gap-1">
                                        {content.hashtags.slice(0, 3).map((tag) => (
                                            <span
                                                key={tag}
                                                className="text-xs text-[var(--primary)]"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                        {content.hashtags.length > 3 && (
                                            <span className="text-xs text-[var(--foreground-muted)]">
                                                +{content.hashtags.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Status & Actions */}
                                <div className="flex flex-col items-end gap-3">
                                    <div
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-full"
                                        style={{
                                            backgroundColor: `${statusConfig[content.status as keyof typeof statusConfig].color}20`,
                                            color: statusConfig[content.status as keyof typeof statusConfig].color
                                        }}
                                    >
                                        <StatusIcon className="w-3 h-3" />
                                        <span className="text-xs font-medium">
                                            {statusConfig[content.status as keyof typeof statusConfig].label}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleCopyCaption(content.id, content.caption)}
                                            className="btn btn-ghost p-2 text-sm"
                                            title="Copy caption"
                                        >
                                            {copiedId === content.id ? (
                                                <Check className="w-4 h-4 text-[var(--success)]" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>

                                        <a
                                            href={getPlatformDeepLink(content.platform)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost p-2 text-sm"
                                            title={`Open ${PLATFORM_CONFIG[content.platform].name}`}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>

                                        {content.status === 'approved' && (
                                            <button className="btn btn-primary text-sm py-1.5 px-3">
                                                Mark Posted
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Empty State */}
            {filteredContent.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-full bg-[var(--surface)] flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-[var(--foreground-muted)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        No Content Found
                    </h3>
                    <p className="text-[var(--foreground-muted)]">
                        Try adjusting your filters or generate new content
                    </p>
                </div>
            )}
        </div>
    )
}
