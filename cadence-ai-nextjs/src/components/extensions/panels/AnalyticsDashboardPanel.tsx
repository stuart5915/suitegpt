'use client'

import { useState, useEffect } from 'react'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { PanelContentProps } from '../ExtensionPanelManager'
import {
    Loader2,
    TrendingUp,
    TrendingDown,
    Users,
    Eye,
    Heart,
    ArrowUpRight,
    RefreshCw
} from 'lucide-react'

const PLATFORMS = [
    { id: 'x', name: 'X', icon: '𝕏', color: 'from-gray-700 to-gray-900' },
    { id: 'instagram', name: 'IG', icon: '📷', color: 'from-pink-500 to-purple-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'from-blue-600 to-blue-800' }
]

export default function AnalyticsDashboardPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const { user, isLoading: authLoading } = useTelegramAuth()
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Mock data
    const [stats, setStats] = useState({
        totalFollowers: 3250,
        totalImpressions: 18500,
        avgEngagement: 3.8,
        linkClicks: 456
    })

    const [platformStats, setPlatformStats] = useState([
        { platform: 'x', followers: 1500, growth: 12.5, engagement: 4.2 },
        { platform: 'instagram', followers: 1200, growth: 8.3, engagement: 5.1 },
        { platform: 'linkedin', followers: 550, growth: 15.2, engagement: 2.8 }
    ])

    useEffect(() => {
        // Simulate loading
        const timer = setTimeout(() => setLoading(false), 500)
        return () => clearTimeout(timer)
    }, [])

    const handleRefresh = async () => {
        setRefreshing(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Simulate updated data
        setStats(prev => ({
            ...prev,
            totalFollowers: prev.totalFollowers + Math.floor(Math.random() * 50),
            totalImpressions: prev.totalImpressions + Math.floor(Math.random() * 500)
        }))
        setRefreshing(false)
    }

    if (loading || authLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Refresh */}
            <div className="flex justify-end">
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Users className="w-3 h-3" />
                        <span className="text-xs">Followers</span>
                    </div>
                    <p className="text-xl font-bold">{stats.totalFollowers.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        +12.5%
                    </div>
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Eye className="w-3 h-3" />
                        <span className="text-xs">Impressions</span>
                    </div>
                    <p className="text-xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        +8.3%
                    </div>
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Heart className="w-3 h-3" />
                        <span className="text-xs">Engagement</span>
                    </div>
                    <p className="text-xl font-bold">{stats.avgEngagement}%</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                        <TrendingUp className="w-3 h-3" />
                        +0.3%
                    </div>
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <ArrowUpRight className="w-3 h-3" />
                        <span className="text-xs">Link Clicks</span>
                    </div>
                    <p className="text-xl font-bold">{stats.linkClicks}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        +23%
                    </div>
                </div>
            </div>

            {/* Platform Breakdown */}
            <div className="space-y-2">
                <h3 className="text-sm font-medium">By Platform</h3>
                {platformStats.map(stat => {
                    const platform = PLATFORMS.find(p => p.id === stat.platform)
                    if (!platform) return null

                    return (
                        <div key={stat.platform} className="bg-[var(--surface)] rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-6 h-6 rounded bg-gradient-to-br ${platform.color} flex items-center justify-center text-xs`}>
                                    {platform.icon}
                                </div>
                                <span className="font-medium text-sm">{platform.name}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--foreground-muted)]">
                                    {stat.followers.toLocaleString()} followers
                                </span>
                                <span className={stat.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                                    {stat.growth >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                                    {Math.abs(stat.growth)}%
                                </span>
                            </div>

                            {/* Mini bar chart */}
                            <div className="mt-2 h-8 flex items-end gap-0.5">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex-1 bg-gradient-to-t ${platform.color} rounded-sm opacity-60`}
                                        style={{ height: `${30 + Math.random() * 70}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Top Posts */}
            <div className="space-y-2">
                <h3 className="text-sm font-medium">Top Posts</h3>
                {[
                    { content: 'How AI is changing content...', impressions: 12500, engagement: 4.2 },
                    { content: '5 tips for better productivity...', impressions: 8200, engagement: 3.8 },
                    { content: 'Behind the scenes of...', impressions: 6800, engagement: 5.1 }
                ].map((post, i) => (
                    <div key={i} className="bg-[var(--surface)] rounded-lg p-3">
                        <p className="text-sm truncate">{post.content}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-[var(--foreground-muted)]">
                            <span>{post.impressions.toLocaleString()} impressions</span>
                            <span>{post.engagement}% engagement</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
