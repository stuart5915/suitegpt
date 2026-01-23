'use client'

import { useState, useEffect } from 'react'
import { PanelContentProps } from '../ExtensionPanelManager'
import InstagramEngagement from '@/components/InstagramEngagement'
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
    Instagram
} from 'lucide-react'

type Platform = 'twitter' | 'instagram'

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

export default function SocialEngagerPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const [activePlatform, setActivePlatform] = useState<Platform>('twitter')
    const [config, setConfig] = useState<EngagementConfig>(DEFAULT_CONFIG)
    const [stats, setStats] = useState<EngagementStats>({ totalEngaged: 0, totalSkipped: 0, skipRate: 0 })
    const [opportunities, setOpportunities] = useState<EngagementOpportunity[]>([])

    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [isFindingPosts, setIsFindingPosts] = useState(false)
    const [isSuggesting, setIsSuggesting] = useState(false)
    const [configDirty, setConfigDirty] = useState(false)

    const [keywordInput, setKeywordInput] = useState('')
    const [hashtagInput, setHashtagInput] = useState('')
    const [accountInput, setAccountInput] = useState('')

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

    const [openSkipDropdown, setOpenSkipDropdown] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

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
                setConfig(prev => ({
                    ...prev,
                    keywords: [...new Set([...prev.keywords, ...suggestions.keywords])],
                    hashtags: [...new Set([...prev.hashtags, ...suggestions.hashtags])],
                    targetAccounts: [...new Set([...prev.targetAccounts, ...suggestions.targetAccounts])]
                }))
                setConfigDirty(true)
                setSuccessMessage(data.message || 'Suggestions added from your settings')
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
            setOpportunities(prev => prev.filter(o => o.id !== opportunity.id))
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
                setReplyModal(prev => ({ ...prev, suggestions: data.suggestions, isLoading: false }))
            } else {
                setReplyModal(prev => ({ ...prev, error: data.error || 'Failed to generate suggestions', isLoading: false }))
            }
        } catch (err) {
            setReplyModal(prev => ({ ...prev, error: 'Failed to generate suggestions', isLoading: false }))
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
                setReplyModal(prev => ({ ...prev, isPosting: false, success: 'Reply posted successfully!' }))
                setOpportunities(prev => prev.filter(o => o.id !== replyModal.opportunity?.id))
                setStats(prev => ({
                    ...prev,
                    totalEngaged: prev.totalEngaged + 1,
                    skipRate: Math.round((prev.totalSkipped / (prev.totalEngaged + 1 + prev.totalSkipped)) * 100)
                }))
                setTimeout(() => setReplyModal(prev => ({ ...prev, isOpen: false })), 2000)
            } else {
                setReplyModal(prev => ({ ...prev, isPosting: false, error: data.error || 'Failed to post reply' }))
            }
        } catch (err) {
            setReplyModal(prev => ({ ...prev, isPosting: false, error: 'Failed to post reply' }))
        }
    }

    const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && keywordInput.trim()) {
            e.preventDefault()
            if (!config.keywords.includes(keywordInput.trim())) {
                setConfig(prev => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }))
                setConfigDirty(true)
            }
            setKeywordInput('')
        }
    }

    const addHashtag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && hashtagInput.trim()) {
            e.preventDefault()
            let tag = hashtagInput.trim()
            if (!tag.startsWith('#')) tag = '#' + tag
            if (!config.hashtags.includes(tag)) {
                setConfig(prev => ({ ...prev, hashtags: [...prev.hashtags, tag] }))
                setConfigDirty(true)
            }
            setHashtagInput('')
        }
    }

    const addAccount = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && accountInput.trim()) {
            e.preventDefault()
            let account = accountInput.trim()
            if (!account.startsWith('@')) account = '@' + account
            if (!config.targetAccounts.includes(account)) {
                setConfig(prev => ({ ...prev, targetAccounts: [...prev.targetAccounts, account] }))
                setConfigDirty(true)
            }
            setAccountInput('')
        }
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

    const hasSearchCriteria = config.keywords.length > 0 || config.hashtags.length > 0 || config.targetAccounts.length > 0

    if (isLoadingConfig) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Platform Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActivePlatform('twitter')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activePlatform === 'twitter'
                            ? 'bg-blue-500 text-white'
                            : 'bg-[var(--surface)] text-[var(--foreground-muted)]'
                    }`}
                >
                    <Twitter className="w-4 h-4" />
                    Twitter
                </button>
                <button
                    onClick={() => setActivePlatform('instagram')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activePlatform === 'instagram'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                            : 'bg-[var(--surface)] text-[var(--foreground-muted)]'
                    }`}
                >
                    <Instagram className="w-4 h-4" />
                    Instagram
                </button>
            </div>

            {/* Instagram Tab */}
            {activePlatform === 'instagram' && <InstagramEngagement />}

            {/* Twitter Tab */}
            {activePlatform === 'twitter' && (
                <>
                    {/* Messages */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400">{error}</span>
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-green-400">{successMessage}</span>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[var(--surface)] rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-green-400">{stats.totalEngaged}</p>
                            <p className="text-xs text-[var(--foreground-muted)]">Engaged</p>
                        </div>
                        <div className="bg-[var(--surface)] rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-[var(--foreground)]">{stats.totalSkipped}</p>
                            <p className="text-xs text-[var(--foreground-muted)]">Skipped</p>
                        </div>
                        <div className="bg-[var(--surface)] rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-amber-400">{stats.skipRate}%</p>
                            <p className="text-xs text-[var(--foreground-muted)]">Skip Rate</p>
                        </div>
                    </div>

                    {/* Config */}
                    <div className="bg-[var(--surface)] rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Settings2 className="w-4 h-4 text-purple-400" />
                            Search Config
                        </div>

                        {/* Keywords */}
                        <div>
                            <label className="text-xs text-[var(--foreground-muted)] flex items-center gap-1 mb-1">
                                <Search className="w-3 h-3" /> Keywords
                            </label>
                            <div className="flex flex-wrap gap-1 mb-1">
                                {config.keywords.map(k => (
                                    <span key={k} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded flex items-center gap-1">
                                        {k}
                                        <button onClick={() => setConfig(prev => ({ ...prev, keywords: prev.keywords.filter(x => x !== k) }))} className="hover:text-white">
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
                                placeholder="Type + Enter"
                                className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm"
                            />
                        </div>

                        {/* Hashtags */}
                        <div>
                            <label className="text-xs text-[var(--foreground-muted)] flex items-center gap-1 mb-1">
                                <Hash className="w-3 h-3" /> Hashtags
                            </label>
                            <div className="flex flex-wrap gap-1 mb-1">
                                {config.hashtags.map(h => (
                                    <span key={h} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded flex items-center gap-1">
                                        {h}
                                        <button onClick={() => setConfig(prev => ({ ...prev, hashtags: prev.hashtags.filter(x => x !== h) }))} className="hover:text-white">
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
                                className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm"
                            />
                        </div>

                        {/* Target Accounts */}
                        <div>
                            <label className="text-xs text-[var(--foreground-muted)] flex items-center gap-1 mb-1">
                                <AtSign className="w-3 h-3" /> Target Accounts
                            </label>
                            <div className="flex flex-wrap gap-1 mb-1">
                                {config.targetAccounts.map(a => (
                                    <span key={a} className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded flex items-center gap-1">
                                        {a}
                                        <button onClick={() => setConfig(prev => ({ ...prev, targetAccounts: prev.targetAccounts.filter(x => x !== a) }))} className="hover:text-white">
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
                                className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={suggestFromSettings}
                                disabled={isSuggesting}
                                className="flex-1 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-xs flex items-center justify-center gap-1"
                            >
                                {isSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-400" />}
                                Suggest
                            </button>
                            {configDirty && (
                                <button
                                    onClick={saveConfig}
                                    disabled={isSavingConfig}
                                    className="flex-1 py-2 bg-purple-500 text-white rounded-lg text-xs flex items-center justify-center gap-1"
                                >
                                    {isSavingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                    Save
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Find Posts Button */}
                    <button
                        onClick={findPosts}
                        disabled={isFindingPosts || !hasSearchCriteria}
                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                    >
                        {isFindingPosts ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Finding...
                            </>
                        ) : (
                            <>
                                <Search className="w-5 h-5" />
                                Find Me Posts
                            </>
                        )}
                    </button>
                    {!hasSearchCriteria && (
                        <p className="text-center text-xs text-[var(--foreground-muted)]">
                            Add keywords, hashtags, or accounts to search
                        </p>
                    )}

                    {/* Opportunities */}
                    {opportunities.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                Opportunities ({opportunities.length})
                            </h3>

                            {opportunities.map(opp => (
                                <div key={opp.id} className="bg-[var(--surface)] rounded-lg p-3">
                                    {/* Author */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-medium text-white">
                                            {opp.authorName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 text-sm">
                                                <span className="font-medium truncate">{opp.authorName}</span>
                                                <span className="text-[var(--foreground-muted)] text-xs">@{opp.authorHandle}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                                <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{formatFollowers(opp.authorFollowers)}</span>
                                                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatTimeAgo(opp.postedAt)}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                                            opp.engagementPotential === 'high' ? 'bg-green-500/20 text-green-400' :
                                            opp.engagementPotential === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {opp.relevanceScore}%
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <p className="text-sm mb-2 line-clamp-3">{opp.content}</p>

                                    {/* Suggested Angle */}
                                    <div className="mb-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
                                        <Sparkles className="w-3 h-3 text-purple-400 inline mr-1" />
                                        <span className="text-purple-300">{opp.suggestedAngle}</span>
                                    </div>

                                    {/* Metrics */}
                                    <div className="flex items-center gap-3 text-xs text-[var(--foreground-muted)] mb-2">
                                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{opp.likes}</span>
                                        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{opp.retweets}</span>
                                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{opp.replies}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openReplyModal(opp)}
                                            className="flex-1 py-2 bg-purple-500 text-white rounded text-sm flex items-center justify-center gap-1"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            Engage
                                        </button>
                                        <div className="relative">
                                            <button
                                                onClick={() => setOpenSkipDropdown(openSkipDropdown === opp.id ? null : opp.id)}
                                                className="px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm flex items-center gap-1"
                                            >
                                                <SkipForward className="w-4 h-4" />
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                            {openSkipDropdown === opp.id && (
                                                <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg shadow-xl z-10">
                                                    {SKIP_REASONS.map(r => (
                                                        <button
                                                            key={r.value}
                                                            onClick={() => handleSkip(opp, r.value)}
                                                            className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-hover)]"
                                                        >
                                                            {r.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <a
                                            href={opp.tweetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={findPosts}
                                disabled={isFindingPosts}
                                className="w-full py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm flex items-center justify-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${isFindingPosts ? 'animate-spin' : ''}`} />
                                Load More
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {opportunities.length === 0 && hasSearchCriteria && !isFindingPosts && (
                        <div className="text-center py-8">
                            <Search className="w-10 h-10 text-[var(--foreground-muted)] mx-auto mb-2" />
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Click "Find Me Posts" to discover opportunities
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Reply Modal */}
            {replyModal.isOpen && replyModal.opportunity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] w-full max-w-md max-h-[80vh] overflow-y-auto">
                        <div className="p-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                            <h3 className="font-medium">Reply to @{replyModal.opportunity.authorHandle}</h3>
                            <button onClick={() => setReplyModal(prev => ({ ...prev, isOpen: false }))}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-[var(--background)] border-b border-[var(--surface-border)]">
                            <p className="text-sm line-clamp-3">{replyModal.opportunity.content}</p>
                        </div>

                        <div className="p-3">
                            {replyModal.error && (
                                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                                    {replyModal.error}
                                </div>
                            )}
                            {replyModal.success && (
                                <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {replyModal.success}
                                </div>
                            )}

                            {replyModal.isLoading ? (
                                <div className="py-6 flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                                    <span className="text-sm text-[var(--foreground-muted)]">Generating suggestions...</span>
                                </div>
                            ) : (
                                <>
                                    {replyModal.suggestions.length > 0 && (
                                        <div className="mb-3">
                                            <h4 className="text-xs font-medium mb-2">Suggestions</h4>
                                            <div className="space-y-2">
                                                {replyModal.suggestions.map((s) => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => setReplyModal(prev => ({ ...prev, customReply: s.text }))}
                                                        className={`w-full p-2 text-left rounded border text-xs ${
                                                            replyModal.customReply === s.text
                                                                ? 'border-purple-500 bg-purple-500/10'
                                                                : 'border-[var(--surface-border)]'
                                                        }`}
                                                    >
                                                        <p className="mb-1">{s.text}</p>
                                                        <p className="text-[var(--foreground-muted)]">{s.approach} · {s.characterCount} chars</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <h4 className="text-xs font-medium mb-1">Your Reply</h4>
                                        <textarea
                                            value={replyModal.customReply}
                                            onChange={(e) => setReplyModal(prev => ({ ...prev, customReply: e.target.value }))}
                                            placeholder="Write your reply..."
                                            rows={3}
                                            className="w-full px-2 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm resize-none"
                                        />
                                        <div className="flex justify-end">
                                            <span className={`text-xs ${replyModal.customReply.length > 280 ? 'text-red-400' : 'text-[var(--foreground-muted)]'}`}>
                                                {replyModal.customReply.length}/280
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => postReply(replyModal.customReply)}
                                        disabled={replyModal.isPosting || !replyModal.customReply.trim() || replyModal.customReply.length > 280}
                                        className="w-full py-2 bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {replyModal.isPosting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" />Posting...</>
                                        ) : (
                                            <><Send className="w-4 h-4" />Post Reply</>
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
