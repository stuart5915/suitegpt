'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { AnalyticsSnapshot, PostAnalytics } from '@/lib/extensions/types'
import {
    Loader2,
    ChevronLeft,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Users,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    Calendar,
    Download,
    RefreshCw,
    ArrowUpRight,
    Zap,
    Twitter,
    Instagram,
    Linkedin
} from 'lucide-react'

const PLATFORMS = [
    { id: 'x', name: 'X (Twitter)', icon: '𝕏', color: 'from-gray-700 to-gray-900' },
    { id: 'instagram', name: 'Instagram', icon: '📷', color: 'from-pink-500 to-purple-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'from-blue-600 to-blue-800' }
]

const TIME_RANGES = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
]

// Mock data for demo - in production this would come from the database
const generateMockData = () => {
    const days = 30
    const snapshots: AnalyticsSnapshot[] = []
    const baseDate = new Date()

    for (let i = days; i >= 0; i--) {
        const date = new Date(baseDate)
        date.setDate(date.getDate() - i)

        PLATFORMS.forEach(platform => {
            snapshots.push({
                id: `${platform.id}-${i}`,
                user_id: 'user',
                platform: platform.id,
                date: date.toISOString().split('T')[0],
                followers: 1000 + Math.floor(Math.random() * 50) * (days - i),
                following: 500,
                posts: 100 + (days - i) * 2,
                engagement_rate: 2 + Math.random() * 3,
                impressions: 5000 + Math.floor(Math.random() * 2000),
                profile_visits: 100 + Math.floor(Math.random() * 50),
                link_clicks: 20 + Math.floor(Math.random() * 30),
                metadata: {},
                created_at: date.toISOString()
            })
        })
    }

    return snapshots
}

export default function AnalyticsDashboardPage() {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [timeRange, setTimeRange] = useState('30d')
    const [selectedPlatform, setSelectedPlatform] = useState<string | 'all'>('all')
    const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([])
    const [topPosts, setTopPosts] = useState<PostAnalytics[]>([])

    useEffect(() => {
        async function loadData() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            // In production, fetch real data from Supabase
            // For now, use mock data
            const mockData = generateMockData()
            setSnapshots(mockData)

            setLoading(false)
        }

        if (!authLoading) {
            loadData()
        }
    }, [supabase, user, authLoading])

    const handleRefresh = async () => {
        setRefreshing(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        const mockData = generateMockData()
        setSnapshots(mockData)
        setRefreshing(false)
    }

    // Calculate metrics
    const getLatestSnapshot = (platform: string) => {
        return snapshots
            .filter(s => s.platform === platform)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    }

    const getPreviousSnapshot = (platform: string, daysAgo: number = 7) => {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() - daysAgo)
        return snapshots
            .filter(s => s.platform === platform && new Date(s.date) <= targetDate)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    }

    const calculateGrowth = (current: number, previous: number) => {
        if (!previous) return 0
        return ((current - previous) / previous) * 100
    }

    const totalFollowers = PLATFORMS.reduce((sum, p) => {
        const latest = getLatestSnapshot(p.id)
        return sum + (latest?.followers || 0)
    }, 0)

    const totalImpressions = PLATFORMS.reduce((sum, p) => {
        const latest = getLatestSnapshot(p.id)
        return sum + (latest?.impressions || 0)
    }, 0)

    const avgEngagement = PLATFORMS.reduce((sum, p) => {
        const latest = getLatestSnapshot(p.id)
        return sum + (latest?.engagement_rate || 0)
    }, 0) / PLATFORMS.length

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Back Link */}
            <Link
                href="/extensions"
                className="inline-flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to Extensions
            </Link>

            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg">
                            📊
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--foreground)]">
                                Analytics Dashboard
                            </h1>
                            <p className="text-[var(--foreground-muted)]">
                                Cross-platform social media insights
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Time Range Selector */}
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                        >
                            {TIME_RANGES.map(range => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </select>

                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2 rounded-lg bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
                        >
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Export Button */}
                        <button className="btn bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Free Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-sm mt-4">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 font-medium">Free with Cadence AI</span>
                </div>
            </header>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--foreground-muted)] text-sm">Total Followers</span>
                        <Users className="w-4 h-4 text-[var(--foreground-muted)]" />
                    </div>
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                        {totalFollowers.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-green-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>+12.5% this month</span>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--foreground-muted)] text-sm">Total Impressions</span>
                        <Eye className="w-4 h-4 text-[var(--foreground-muted)]" />
                    </div>
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                        {totalImpressions.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-green-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>+8.3% this week</span>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--foreground-muted)] text-sm">Avg. Engagement</span>
                        <Heart className="w-4 h-4 text-[var(--foreground-muted)]" />
                    </div>
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                        {avgEngagement.toFixed(1)}%
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-amber-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>+0.3% this week</span>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--foreground-muted)] text-sm">Link Clicks</span>
                        <ArrowUpRight className="w-4 h-4 text-[var(--foreground-muted)]" />
                    </div>
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                        {(PLATFORMS.reduce((sum, p) => sum + (getLatestSnapshot(p.id)?.link_clicks || 0), 0)).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-green-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>+23.1% this week</span>
                    </div>
                </div>
            </div>

            {/* Platform Breakdown */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
                {PLATFORMS.map(platform => {
                    const latest = getLatestSnapshot(platform.id)
                    const previous = getPreviousSnapshot(platform.id)
                    const followerGrowth = calculateGrowth(
                        latest?.followers || 0,
                        previous?.followers || 0
                    )

                    return (
                        <div key={platform.id} className="card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-xl`}>
                                    {platform.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-[var(--foreground)]">{platform.name}</h3>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        Last updated: Today
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--foreground-muted)]">Followers</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[var(--foreground)]">
                                            {(latest?.followers || 0).toLocaleString()}
                                        </span>
                                        <span className={`text-xs flex items-center gap-0.5 ${followerGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {followerGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {Math.abs(followerGrowth).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--foreground-muted)]">Engagement Rate</span>
                                    <span className="font-bold text-[var(--foreground)]">
                                        {(latest?.engagement_rate || 0).toFixed(1)}%
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--foreground-muted)]">Impressions</span>
                                    <span className="font-bold text-[var(--foreground)]">
                                        {(latest?.impressions || 0).toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--foreground-muted)]">Profile Visits</span>
                                    <span className="font-bold text-[var(--foreground)]">
                                        {(latest?.profile_visits || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Mini Chart Placeholder */}
                            <div className="mt-4 pt-4 border-t border-[var(--surface-border)]">
                                <div className="h-16 bg-[var(--surface)] rounded-lg flex items-end justify-between px-2 pb-2">
                                    {Array.from({ length: 7 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-3 bg-gradient-to-t ${platform.color} rounded-sm opacity-60`}
                                            style={{ height: `${30 + Math.random() * 70}%` }}
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] text-center mt-2">
                                    Last 7 days
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Top Performing Posts */}
            <div className="card p-6">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Top Performing Posts
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-sm text-[var(--foreground-muted)] border-b border-[var(--surface-border)]">
                                <th className="pb-3 font-medium">Post</th>
                                <th className="pb-3 font-medium">Platform</th>
                                <th className="pb-3 font-medium text-right">Impressions</th>
                                <th className="pb-3 font-medium text-right">Engagement</th>
                                <th className="pb-3 font-medium text-right">Clicks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                            {[
                                { content: 'How AI is changing content creation...', platform: 'x', impressions: 12500, engagement: 4.2, clicks: 234 },
                                { content: '5 tips for better productivity...', platform: 'linkedin', impressions: 8200, engagement: 3.8, clicks: 156 },
                                { content: 'Behind the scenes of our latest...', platform: 'instagram', impressions: 6800, engagement: 5.1, clicks: 89 },
                                { content: 'The future of remote work thread...', platform: 'x', impressions: 5400, engagement: 3.5, clicks: 67 },
                                { content: 'Our journey to 10k followers...', platform: 'instagram', impressions: 4200, engagement: 6.2, clicks: 45 }
                            ].map((post, i) => (
                                <tr key={i} className="hover:bg-[var(--surface-hover)] transition-colors">
                                    <td className="py-4">
                                        <p className="text-[var(--foreground)] truncate max-w-xs">
                                            {post.content}
                                        </p>
                                    </td>
                                    <td className="py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${post.platform === 'x'
                                                ? 'bg-gray-500/10 text-gray-400'
                                                : post.platform === 'instagram'
                                                    ? 'bg-pink-500/10 text-pink-500'
                                                    : 'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            {post.platform}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right font-medium text-[var(--foreground)]">
                                        {post.impressions.toLocaleString()}
                                    </td>
                                    <td className="py-4 text-right font-medium text-[var(--foreground)]">
                                        {post.engagement}%
                                    </td>
                                    <td className="py-4 text-right font-medium text-[var(--foreground)]">
                                        {post.clicks}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Best Posting Times */}
            <div className="grid lg:grid-cols-2 gap-6 mt-6">
                <div className="card p-6">
                    <h3 className="font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Best Posting Times
                    </h3>
                    <div className="space-y-3">
                        {[
                            { day: 'Monday', time: '9:00 AM', engagement: 'High' },
                            { day: 'Wednesday', time: '12:00 PM', engagement: 'Very High' },
                            { day: 'Friday', time: '3:00 PM', engagement: 'High' },
                            { day: 'Saturday', time: '10:00 AM', engagement: 'Medium' }
                        ].map((slot, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">{slot.day}</p>
                                    <p className="text-sm text-[var(--foreground-muted)]">{slot.time}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${slot.engagement === 'Very High'
                                        ? 'bg-green-500/10 text-green-500'
                                        : slot.engagement === 'High'
                                            ? 'bg-blue-500/10 text-blue-500'
                                            : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                    {slot.engagement}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card p-6">
                    <h3 className="font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Content Performance by Type
                    </h3>
                    <div className="space-y-3">
                        {[
                            { type: 'Threads', avgEngagement: 5.2, posts: 12 },
                            { type: 'Images', avgEngagement: 4.8, posts: 24 },
                            { type: 'Videos', avgEngagement: 4.5, posts: 8 },
                            { type: 'Text Only', avgEngagement: 2.1, posts: 45 }
                        ].map((content, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">{content.type}</p>
                                    <p className="text-sm text-[var(--foreground-muted)]">{content.posts} posts</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-[var(--foreground)]">{content.avgEngagement}%</p>
                                    <p className="text-xs text-[var(--foreground-muted)]">avg engagement</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
