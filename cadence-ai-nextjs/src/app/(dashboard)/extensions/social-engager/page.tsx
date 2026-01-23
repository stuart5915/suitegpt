'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Search,
    Settings2,
    TrendingUp,
    Users,
    SkipForward,
    MessageCircle,
    Heart,
    Repeat2,
    ExternalLink,
    Clock,
    Sparkles,
    Send,
    X,
    ChevronDown,
    AlertCircle,
    CheckCircle,
    Loader2,
    RefreshCw,
    Target,
    Hash,
    AtSign,
    Twitter,
    Instagram,
    ChevronLeft
} from 'lucide-react'
import InstagramEngagement from '@/components/InstagramEngagement'

// Platform tabs
type Platform = 'twitter' | 'instagram'

// Types
interface EngagementConfig {
    keywords: string[]
    hashtags: string[]
    targetAccounts: string[]
    minFollowers: number
    maxFollowers: number
    minEngagement: number
    maxAgeHours: number
}

interface EngagementStats {
    totalEngaged: number
    totalSkipped: number
    skipRate: number
}

interface EngagementOpportunity {
    id: string
    tweetId: string
    tweetUrl: string
    authorHandle: string
    authorName: string
    authorFollowers: number
    authorAvatar?: string
    content: string
    postedAt: string
    likes: number
    retweets: number
    replies: number
    relevanceScore: number
    engagementPotential: 'high' | 'medium' | 'low'
    suggestedAngle: string
    matchedKeywords: string[]
}

interface ReplySuggestion {
    id: string
    text: string
    approach: string
    characterCount: number
}

const SKIP_REASONS = [
    { value: 'not_relevant', label: 'Not relevant' },
    { value: 'wrong_audience', label: 'Wrong audience' },
    { value: 'too_big', label: 'Author too big' },
    { value: 'too_small', label: 'Author too small' },
    { value: 'already_crowded', label: 'Too many replies' }
] as const

const DEFAULT_CONFIG: EngagementConfig = {
    keywords: [],
    hashtags: [],
    targetAccounts: [],
    minFollowers: 100,
    maxFollowers: 100000,
    minEngagement: 5,
    maxAgeHours: 24
}

export default function SocialEngagerPage() {
    // Platform tab state
    const [activePlatform, setActivePlatform] = useState<Platform>('twitter')

    // State
    const [config, setConfig] = useState<EngagementConfig>(DEFAULT_CONFIG)
    const [stats, setStats] = useState<EngagementStats>({ totalEngaged: 0, totalSkipped: 0, skipRate: 0 })
    const [opportunities, setOpportunities] = useState<EngagementOpportunity[]>([])

    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [isFindingPosts, setIsFindingPosts] = useState(false)
    const [isSuggesting, setIsSuggesting] = useState(false)
    const [configDirty, setConfigDirty] = useState(false)

    // Input states for tag-style inputs
    const [keywordInput, setKeywordInput] = useState('')
    const [hashtagInput, setHashtagInput] = useState('')
    const [accountInput, setAccountInput] = useState('')

    // Reply modal state
    const [replyModal, setReplyModal] = useState<{
        isOpen: boolean
        opportunity: EngagementOpportunity | null
        suggestions: ReplySuggestion[]
        isLoading: boolean
        isPosting: boolean
        customReply: string
        error?: string
        success?: string
    }>({
        isOpen: false,
        opportunity: null,
        suggestions: [],
        isLoading: false,
        isPosting: false,
        customReply: ''
    })

    // Skip dropdown state
    const [openSkipDropdown, setOpenSkipDropdown] = useState<string | null>(null)

    // Error/success messages
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Load config on mount
    useEffect(() => {
        loadConfig()
    }, [])

    // Auto-clear messages
    useEffect(() => {
        if (error || successMessage) {
            const timer = setTimeout(() => {
                setError(null)
                setSuccessMessage(null)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [error, successMessage])

    const loadConfig = async () => {
        setIsLoadingConfig(true)
        try {
            const res = await fetch('/api/engagement/config')
            if (res.ok) {
                const data = await res.json()
                setConfig(data.config)
                setStats(data.stats)
            }
        } catch (err) {
            console.error('Failed to load config:', err)
        } finally {
            setIsLoadingConfig(false)
        }
    }

    const saveConfig = async () => {
        setIsSavingConfig(true)
        try {
            const res = await fetch('/api/engagement/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            if (res.ok) {
                setConfigDirty(false)
                setSuccessMessage('Configuration saved')
            } else {
                const data = await res.json()
                setError(data.error || 'Failed to save config')
            }
        } catch (err) {
            setError('Failed to save configuration')
        } finally {
            setIsSavingConfig(false)
        }
    }

    const suggestFromSettings = async () => {
        setIsSuggesting(true)
        setError(null)
        try {
            const res = await fetch('/api/engagement/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await res.json()
            if (res.ok && data.success) {
                const { suggestions } = data
                // Merge suggestions with existing config (don't overwrite)
                setConfig(prev => ({
                    ...prev,
                    keywords: [...new Set([...prev.keywords, ...suggestions.keywords])],
                    hashtags: [...new Set([...prev.hashtags, ...suggestions.hashtags])],
                    targetAccounts: [...new Set([...prev.targetAccounts, ...suggestions.targetAccounts])]
                }))
                setConfigDirty(true)
                if (data.message) {
                    setSuccessMessage(data.message)
                } else {
                    setSuccessMessage('Suggestions added from your settings')
                }
            } else {
                setError(data.error || 'Failed to get suggestions')
            }
        } catch (err) {
            setError('Failed to get suggestions')
        } finally {
            setIsSuggesting(false)
        }
    }

    const findPosts = async () => {
        setIsFindingPosts(true)
        setError(null)
        try {
            const res = await fetch('/api/engagement/find', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setOpportunities(data.opportunities)
                if (data.opportunities.length === 0) {
                    setError('No matching posts found. Try adjusting your search criteria.')
                }
            } else {
                if (data.needsConfig) {
                    setError('Please add keywords, hashtags, or target accounts first')
                } else {
                    setError(data.error || 'Failed to find posts')
                }
            }
        } catch (err) {
            setError('Failed to find posts')
        } finally {
            setIsFindingPosts(false)
        }
    }

    const handleSkip = async (opportunity: EngagementOpportunity, reason: string) => {
        setOpenSkipDropdown(null)
        try {
            await fetch('/api/engagement/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tweetId: opportunity.tweetId,
                    action: 'skipped',
                    skipReason: reason,
                    authorHandle: opportunity.authorHandle,
                    authorFollowers: opportunity.authorFollowers,
                    matchedKeywords: opportunity.matchedKeywords,
                    contentPreview: opportunity.content
                })
            })

            // Remove from list
            setOpportunities(prev => prev.filter(o => o.id !== opportunity.id))

            // Update stats
            setStats(prev => ({
                ...prev,
                totalSkipped: prev.totalSkipped + 1,
                skipRate: Math.round(((prev.totalSkipped + 1) / (prev.totalEngaged + prev.totalSkipped + 1)) * 100)
            }))
        } catch (err) {
            console.error('Failed to record skip:', err)
        }
    }

    const openReplyModal = async (opportunity: EngagementOpportunity) => {
        setReplyModal({
            isOpen: true,
            opportunity,
            suggestions: [],
            isLoading: true,
            isPosting: false,
            customReply: ''
        })

        try {
            const res = await fetch('/api/engagement/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    tweetContent: opportunity.content,
                    authorHandle: opportunity.authorHandle,
                    suggestedAngle: opportunity.suggestedAngle
                })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setReplyModal(prev => ({
                    ...prev,
                    suggestions: data.suggestions,
                    isLoading: false
                }))
            } else {
                setReplyModal(prev => ({
                    ...prev,
                    error: data.error || 'Failed to generate suggestions',
                    isLoading: false
                }))
            }
        } catch (err) {
            setReplyModal(prev => ({
                ...prev,
                error: 'Failed to generate suggestions',
                isLoading: false
            }))
        }
    }

    const postReply = async (replyText: string) => {
        if (!replyModal.opportunity) return

        setReplyModal(prev => ({ ...prev, isPosting: true, error: undefined }))

        try {
            const res = await fetch('/api/engagement/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'post',
                    tweetId: replyModal.opportunity.tweetId,
                    replyText,
                    authorHandle: replyModal.opportunity.authorHandle,
                    authorFollowers: replyModal.opportunity.authorFollowers,
                    matchedKeywords: replyModal.opportunity.matchedKeywords,
                    contentPreview: replyModal.opportunity.content
                })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setReplyModal(prev => ({
                    ...prev,
                    isPosting: false,
                    success: 'Reply posted successfully!'
                }))

                // Remove from opportunities
                setOpportunities(prev => prev.filter(o => o.id !== replyModal.opportunity?.id))

                // Update stats
                setStats(prev => ({
                    ...prev,
                    totalEngaged: prev.totalEngaged + 1,
                    skipRate: Math.round((prev.totalSkipped / (prev.totalEngaged + 1 + prev.totalSkipped)) * 100)
                }))

                // Close modal after delay
                setTimeout(() => {
                    setReplyModal(prev => ({ ...prev, isOpen: false }))
                }, 2000)
            } else {
                setReplyModal(prev => ({
                    ...prev,
                    isPosting: false,
                    error: data.error || 'Failed to post reply'
                }))
            }
        } catch (err) {
            setReplyModal(prev => ({
                ...prev,
                isPosting: false,
                error: 'Failed to post reply'
            }))
        }
    }

    // Tag input handlers
    const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && keywordInput.trim()) {
            e.preventDefault()
            if (!config.keywords.includes(keywordInput.trim())) {
                setConfig(prev => ({
                    ...prev,
                    keywords: [...prev.keywords, keywordInput.trim()]
                }))
                setConfigDirty(true)
            }
            setKeywordInput('')
        }
    }

    const removeKeyword = (keyword: string) => {
        setConfig(prev => ({
            ...prev,
            keywords: prev.keywords.filter(k => k !== keyword)
        }))
        setConfigDirty(true)
    }

    const addHashtag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && hashtagInput.trim()) {
            e.preventDefault()
            let tag = hashtagInput.trim()
            if (!tag.startsWith('#')) tag = '#' + tag
            if (!config.hashtags.includes(tag)) {
                setConfig(prev => ({
                    ...prev,
                    hashtags: [...prev.hashtags, tag]
                }))
                setConfigDirty(true)
            }
            setHashtagInput('')
        }
    }

    const removeHashtag = (hashtag: string) => {
        setConfig(prev => ({
            ...prev,
            hashtags: prev.hashtags.filter(h => h !== hashtag)
        }))
        setConfigDirty(true)
    }

    const addAccount = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && accountInput.trim()) {
            e.preventDefault()
            let account = accountInput.trim()
            if (!account.startsWith('@')) account = '@' + account
            if (!config.targetAccounts.includes(account)) {
                setConfig(prev => ({
                    ...prev,
                    targetAccounts: [...prev.targetAccounts, account]
                }))
                setConfigDirty(true)
            }
            setAccountInput('')
        }
    }

    const removeAccount = (account: string) => {
        setConfig(prev => ({
            ...prev,
            targetAccounts: prev.targetAccounts.filter(a => a !== account)
        }))
        setConfigDirty(true)
    }

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${Math.floor(diffHours / 24)}d ago`
    }

    const formatFollowers = (count: number) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
        return count.toString()
    }

    if (isLoadingConfig) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] p-6 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    const hasSearchCriteria = config.keywords.length > 0 || config.hashtags.length > 0 || config.targetAccounts.length > 0

    return (
        <div className="min-h-screen bg-[#0a0a0f] p-6">
            <div className="max-w-6xl mx-auto">
                {/* Back Link */}
                <Link
                    href="/extensions"
                    className="inline-flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Extensions
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Social Engager</h1>
                            <p className="text-[var(--foreground-muted)]">Find high-quality posts to grow your reach</p>
                        </div>
                    </div>

                    {/* Platform Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActivePlatform('twitter')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                activePlatform === 'twitter'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                            }`}
                        >
                            <Twitter className="w-4 h-4" />
                            X / Twitter
                        </button>
                        <button
                            onClick={() => setActivePlatform('instagram')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                activePlatform === 'instagram'
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                    : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                            }`}
                        >
                            <Instagram className="w-4 h-4" />
                            Instagram
                        </button>
                    </div>
                </div>

                {/* Instagram Engagement */}
                {activePlatform === 'instagram' && <InstagramEngagement />}

                {/* Twitter Engagement - only show when Twitter tab active */}
                {activePlatform === 'twitter' && (
                <>
                {/* Messages */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-400">{error}</span>
                    </div>
                )}
                {successMessage && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-green-400">{successMessage}</span>
                    </div>
                )}

                {/* Main Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Config Panel */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Config Panel */}
                        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Settings2 className="w-4 h-4 text-purple-400" />
                                <h2 className="font-medium text-white">Search Config</h2>
                            </div>

                            {/* Keywords */}
                            <div className="mb-4">
                                <label className="text-sm text-[var(--foreground-muted)] mb-2 flex items-center gap-1">
                                    <Search className="w-3 h-3" />
                                    Keywords
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {config.keywords.map(keyword => (
                                        <span
                                            key={keyword}
                                            className="px-2 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-lg flex items-center gap-1"
                                        >
                                            {keyword}
                                            <button
                                                onClick={() => removeKeyword(keyword)}
                                                className="hover:text-blue-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={addKeyword}
                                    placeholder="Type and press Enter"
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white text-sm placeholder:text-[var(--foreground-muted)]"
                                />
                            </div>

                            {/* Hashtags */}
                            <div className="mb-4">
                                <label className="text-sm text-[var(--foreground-muted)] mb-2 flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    Hashtags
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {config.hashtags.map(hashtag => (
                                        <span
                                            key={hashtag}
                                            className="px-2 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-lg flex items-center gap-1"
                                        >
                                            {hashtag}
                                            <button
                                                onClick={() => removeHashtag(hashtag)}
                                                className="hover:text-purple-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={hashtagInput}
                                    onChange={(e) => setHashtagInput(e.target.value)}
                                    onKeyDown={addHashtag}
                                    placeholder="#buildinpublic"
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white text-sm placeholder:text-[var(--foreground-muted)]"
                                />
                            </div>

                            {/* Target Accounts */}
                            <div className="mb-4">
                                <label className="text-sm text-[var(--foreground-muted)] mb-2 flex items-center gap-1">
                                    <AtSign className="w-3 h-3" />
                                    Target Accounts
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {config.targetAccounts.map(account => (
                                        <span
                                            key={account}
                                            className="px-2 py-1 bg-green-500/20 text-green-300 text-sm rounded-lg flex items-center gap-1"
                                        >
                                            {account}
                                            <button
                                                onClick={() => removeAccount(account)}
                                                className="hover:text-green-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={accountInput}
                                    onChange={(e) => setAccountInput(e.target.value)}
                                    onKeyDown={addAccount}
                                    placeholder="@naval"
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white text-sm placeholder:text-[var(--foreground-muted)]"
                                />
                            </div>

                            {/* Suggest from Settings Button */}
                            <button
                                onClick={suggestFromSettings}
                                disabled={isSuggesting}
                                className="w-full py-2 mb-2 bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground)] rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSuggesting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-yellow-400" />
                                )}
                                Suggest from Settings
                            </button>

                            {/* Save Button */}
                            {configDirty && (
                                <button
                                    onClick={saveConfig}
                                    disabled={isSavingConfig}
                                    className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isSavingConfig ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4" />
                                    )}
                                    Save Config
                                </button>
                            )}
                        </div>

                        {/* Stats Panel */}
                        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-green-400" />
                                <h2 className="font-medium text-white">Stats</h2>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--foreground-muted)]">Engaged</span>
                                    <span className="text-white font-medium">{stats.totalEngaged}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--foreground-muted)]">Skipped</span>
                                    <span className="text-white font-medium">{stats.totalSkipped}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--foreground-muted)]">Skip Rate</span>
                                    <span className="text-white font-medium">{stats.skipRate}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Find Posts & Opportunities */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Find Posts Button */}
                        <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6">
                            <button
                                onClick={findPosts}
                                disabled={isFindingPosts || !hasSearchCriteria}
                                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl flex items-center justify-center gap-3 text-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isFindingPosts ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Finding posts...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-6 h-6" />
                                        Find Me Posts
                                    </>
                                )}
                            </button>
                            {!hasSearchCriteria && (
                                <p className="text-center text-sm text-[var(--foreground-muted)] mt-3">
                                    Add keywords, hashtags, or target accounts to search
                                </p>
                            )}
                        </div>

                        {/* Opportunities */}
                        {opportunities.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-yellow-400" />
                                    Opportunities
                                </h3>

                                {opportunities.map(opportunity => (
                                    <div
                                        key={opportunity.id}
                                        className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-4"
                                    >
                                        {/* Author Info */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                                {opportunity.authorAvatar ? (
                                                    <img
                                                        src={opportunity.authorAvatar}
                                                        alt={opportunity.authorName}
                                                        className="w-10 h-10 rounded-full"
                                                    />
                                                ) : (
                                                    <span className="text-white font-medium">
                                                        {opportunity.authorName.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-white">{opportunity.authorName}</span>
                                                    <span className="text-[var(--foreground-muted)]">@{opportunity.authorHandle}</span>
                                                    <span className="text-[var(--foreground-muted)]">·</span>
                                                    <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {formatFollowers(opportunity.authorFollowers)}
                                                    </span>
                                                    <span className="text-[var(--foreground-muted)]">·</span>
                                                    <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTimeAgo(opportunity.postedAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-1 text-xs rounded-full ${
                                                opportunity.engagementPotential === 'high'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : opportunity.engagementPotential === 'medium'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {opportunity.relevanceScore}% match
                                            </div>
                                        </div>

                                        {/* Tweet Content */}
                                        <p className="text-[var(--foreground)] mb-3 whitespace-pre-wrap">
                                            {opportunity.content}
                                        </p>

                                        {/* Suggested Angle */}
                                        <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Sparkles className="w-4 h-4 text-purple-400" />
                                                <span className="text-purple-300">{opportunity.suggestedAngle}</span>
                                            </div>
                                        </div>

                                        {/* Matched Keywords */}
                                        {opportunity.matchedKeywords.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {opportunity.matchedKeywords.map(keyword => (
                                                    <span
                                                        key={keyword}
                                                        className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Engagement Metrics */}
                                        <div className="flex items-center gap-4 text-sm text-[var(--foreground-muted)] mb-4">
                                            <span className="flex items-center gap-1">
                                                <Heart className="w-4 h-4" />
                                                {opportunity.likes}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Repeat2 className="w-4 h-4" />
                                                {opportunity.retweets}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageCircle className="w-4 h-4" />
                                                {opportunity.replies}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openReplyModal(opportunity)}
                                                className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                Engage
                                            </button>

                                            {/* Skip Dropdown */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setOpenSkipDropdown(
                                                        openSkipDropdown === opportunity.id ? null : opportunity.id
                                                    )}
                                                    className="px-4 py-2 bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground-muted)] rounded-lg flex items-center gap-2 transition-colors"
                                                >
                                                    <SkipForward className="w-4 h-4" />
                                                    Skip
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>

                                                {openSkipDropdown === opportunity.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg shadow-xl z-10">
                                                        {SKIP_REASONS.map(reason => (
                                                            <button
                                                                key={reason.value}
                                                                onClick={() => handleSkip(opportunity, reason.value)}
                                                                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] first:rounded-t-lg last:rounded-b-lg"
                                                            >
                                                                {reason.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <a
                                                href={opportunity.tweetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground-muted)] rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))}

                                {/* Load More Button */}
                                <button
                                    onClick={findPosts}
                                    disabled={isFindingPosts}
                                    className="w-full py-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground-muted)] rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isFindingPosts ? 'animate-spin' : ''}`} />
                                    Load More Opportunities
                                </button>
                            </div>
                        )}

                        {/* Empty State */}
                        {opportunities.length === 0 && hasSearchCriteria && !isFindingPosts && (
                            <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-12 text-center">
                                <Search className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">Ready to find engagement opportunities</h3>
                                <p className="text-[var(--foreground-muted)]">
                                    Click "Find Me Posts" to discover high-quality posts to engage with
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                </>
                )}
            </div>

            {/* Reply Modal */}
            {replyModal.isOpen && replyModal.opportunity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
                            <h3 className="text-lg font-medium text-white">Reply to @{replyModal.opportunity.authorHandle}</h3>
                            <button
                                onClick={() => setReplyModal(prev => ({ ...prev, isOpen: false }))}
                                className="text-[var(--foreground-muted)] hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Original Tweet */}
                        <div className="p-4 bg-[var(--background)] border-b border-[var(--surface-border)]">
                            <p className="text-[var(--foreground)] text-sm">
                                {replyModal.opportunity.content}
                            </p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4">
                            {replyModal.error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {replyModal.error}
                                </div>
                            )}

                            {replyModal.success && (
                                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    {replyModal.success}
                                </div>
                            )}

                            {replyModal.isLoading ? (
                                <div className="py-8 flex items-center justify-center gap-3">
                                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                                    <span className="text-[var(--foreground-muted)]">Generating reply suggestions...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Suggestions */}
                                    {replyModal.suggestions.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-sm font-medium text-white mb-3">Suggested Replies</h4>
                                            <div className="space-y-2">
                                                {replyModal.suggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion.id}
                                                        onClick={() => setReplyModal(prev => ({
                                                            ...prev,
                                                            customReply: suggestion.text
                                                        }))}
                                                        className={`w-full p-3 text-left rounded-lg border transition-colors ${
                                                            replyModal.customReply === suggestion.text
                                                                ? 'border-purple-500 bg-purple-500/10'
                                                                : 'border-[var(--surface-border)] hover:border-purple-500/50'
                                                        }`}
                                                    >
                                                        <p className="text-[var(--foreground)] text-sm mb-1">
                                                            {suggestion.text}
                                                        </p>
                                                        <p className="text-xs text-[var(--foreground-muted)]">
                                                            {suggestion.approach} · {suggestion.characterCount} chars
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Reply */}
                                    <div className="mb-4">
                                        <h4 className="text-sm font-medium text-white mb-2">Your Reply</h4>
                                        <textarea
                                            value={replyModal.customReply}
                                            onChange={(e) => setReplyModal(prev => ({
                                                ...prev,
                                                customReply: e.target.value
                                            }))}
                                            placeholder="Write your reply..."
                                            rows={4}
                                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)] resize-none"
                                        />
                                        <div className="flex justify-end mt-1">
                                            <span className={`text-xs ${
                                                replyModal.customReply.length > 280
                                                    ? 'text-red-400'
                                                    : 'text-[var(--foreground-muted)]'
                                            }`}>
                                                {replyModal.customReply.length}/280
                                            </span>
                                        </div>
                                    </div>

                                    {/* Post Button */}
                                    <button
                                        onClick={() => postReply(replyModal.customReply)}
                                        disabled={
                                            replyModal.isPosting ||
                                            !replyModal.customReply.trim() ||
                                            replyModal.customReply.length > 280
                                        }
                                        className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {replyModal.isPosting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Posting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Post Reply
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
