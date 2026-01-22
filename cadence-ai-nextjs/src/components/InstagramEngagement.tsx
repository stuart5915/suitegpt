'use client'

import { useState, useEffect } from 'react'
import {
    Search,
    Settings2,
    TrendingUp,
    Users,
    SkipForward,
    MessageCircle,
    Heart,
    ExternalLink,
    Clock,
    Sparkles,
    X,
    ChevronDown,
    AlertCircle,
    CheckCircle,
    Loader2,
    RefreshCw,
    Hash,
    AtSign,
    Copy,
    Instagram,
    Link as LinkIcon
} from 'lucide-react'

// Types
interface InstagramConfig {
    hashtags: string[]
    targetAccounts: string[]
    minFollowers: number
    maxFollowers: number
    maxAgeHours: number
}

interface InstagramStats {
    totalEngaged: number
    totalSkipped: number
    skipRate: number
}

interface InstagramPost {
    id: string
    postUrl: string
    authorHandle: string
    authorName?: string
    authorFollowers?: number
    authorAvatar?: string
    caption: string
    postedAt?: string
    likes?: number
    comments?: number
}

interface CommentSuggestion {
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
    { value: 'already_crowded', label: 'Too many comments' }
] as const

const DEFAULT_CONFIG: InstagramConfig = {
    hashtags: [],
    targetAccounts: [],
    minFollowers: 1000,
    maxFollowers: 100000,
    maxAgeHours: 48
}

export default function InstagramEngagement() {
    // State
    const [config, setConfig] = useState<InstagramConfig>(DEFAULT_CONFIG)
    const [stats, setStats] = useState<InstagramStats>({ totalEngaged: 0, totalSkipped: 0, skipRate: 0 })

    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [configDirty, setConfigDirty] = useState(false)

    // Input states
    const [hashtagInput, setHashtagInput] = useState('')
    const [accountInput, setAccountInput] = useState('')

    // Manual post entry
    const [postUrlInput, setPostUrlInput] = useState('')
    const [postCaptionInput, setPostCaptionInput] = useState('')
    const [isLoadingPost, setIsLoadingPost] = useState(false)

    // Current post state
    const [currentPost, setCurrentPost] = useState<InstagramPost | null>(null)
    const [suggestions, setSuggestions] = useState<CommentSuggestion[]>([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [selectedComment, setSelectedComment] = useState('')

    // Skip dropdown state
    const [openSkipDropdown, setOpenSkipDropdown] = useState(false)

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
            const res = await fetch('/api/engagement/instagram/config')
            if (res.ok) {
                const data = await res.json()
                if (data.config) {
                    setConfig(data.config)
                }
                if (data.stats) {
                    setStats(data.stats)
                }
            }
        } catch (err) {
            console.error('Failed to load Instagram config:', err)
        } finally {
            setIsLoadingConfig(false)
        }
    }

    const saveConfig = async () => {
        setIsSavingConfig(true)
        try {
            const res = await fetch('/api/engagement/instagram/config', {
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

    const loadPost = async () => {
        if (!postUrlInput.trim()) {
            setError('Please enter an Instagram post URL')
            return
        }

        // Validate URL format
        if (!postUrlInput.includes('instagram.com')) {
            setError('Please enter a valid Instagram URL')
            return
        }

        setIsLoadingPost(true)
        setError(null)

        try {
            // Extract post info from URL (basic parsing)
            const urlParts = postUrlInput.split('/')
            const postIdIndex = urlParts.findIndex(part => part === 'p' || part === 'reel')

            // For manual entry, we use the caption the user provides
            const post: InstagramPost = {
                id: `ig-${Date.now()}`,
                postUrl: postUrlInput.trim(),
                authorHandle: 'instagram_user', // Will be extracted if possible
                caption: postCaptionInput || 'No caption provided'
            }

            // Try to extract username from URL if in format instagram.com/username/p/...
            if (urlParts.length > 3 && !['p', 'reel', 'reels'].includes(urlParts[3])) {
                post.authorHandle = urlParts[3]
            }

            setCurrentPost(post)
            setSuggestions([])
            setSelectedComment('')

            // Auto-generate suggestions if we have caption
            if (postCaptionInput) {
                generateSuggestions(post)
            }
        } catch (err) {
            setError('Failed to load post')
        } finally {
            setIsLoadingPost(false)
        }
    }

    const generateSuggestions = async (post?: InstagramPost) => {
        const targetPost = post || currentPost
        if (!targetPost) {
            setError('No post loaded')
            return
        }

        setIsLoadingSuggestions(true)
        setError(null)

        try {
            const res = await fetch('/api/engagement/instagram/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postUrl: targetPost.postUrl,
                    postCaption: targetPost.caption,
                    authorHandle: targetPost.authorHandle
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuggestions(data.suggestions)
                if (data.suggestions.length > 0) {
                    setSelectedComment(data.suggestions[0].text)
                }
            } else {
                setError(data.error || 'Failed to generate suggestions')
            }
        } catch (err) {
            setError('Failed to generate comment suggestions')
        } finally {
            setIsLoadingSuggestions(false)
        }
    }

    const copyComment = async () => {
        if (!selectedComment) {
            setError('No comment selected')
            return
        }

        try {
            await navigator.clipboard.writeText(selectedComment)
            setSuccessMessage('Comment copied to clipboard!')

            // Record in history
            await recordHistory('copied', selectedComment)
        } catch (err) {
            setError('Failed to copy to clipboard')
        }
    }

    const openInInstagram = () => {
        if (currentPost?.postUrl) {
            window.open(currentPost.postUrl, '_blank')
        }
    }

    const markAsPosted = async () => {
        await recordHistory('posted', selectedComment)
        setSuccessMessage('Marked as posted!')

        // Update stats
        setStats(prev => ({
            ...prev,
            totalEngaged: prev.totalEngaged + 1,
            skipRate: Math.round((prev.totalSkipped / (prev.totalEngaged + 1 + prev.totalSkipped)) * 100)
        }))

        // Clear current post
        setCurrentPost(null)
        setSuggestions([])
        setSelectedComment('')
        setPostUrlInput('')
        setPostCaptionInput('')
    }

    const handleSkip = async (reason: string) => {
        setOpenSkipDropdown(false)

        await recordHistory('skipped', '', reason)

        // Update stats
        setStats(prev => ({
            ...prev,
            totalSkipped: prev.totalSkipped + 1,
            skipRate: Math.round(((prev.totalSkipped + 1) / (prev.totalEngaged + prev.totalSkipped + 1)) * 100)
        }))

        // Clear current post
        setCurrentPost(null)
        setSuggestions([])
        setSelectedComment('')
        setPostUrlInput('')
        setPostCaptionInput('')
    }

    const recordHistory = async (status: string, commentText: string, skipReason?: string) => {
        if (!currentPost) return

        try {
            await fetch('/api/engagement/instagram/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postUrl: currentPost.postUrl,
                    postAuthor: currentPost.authorHandle,
                    postCaption: currentPost.caption,
                    commentText,
                    status,
                    skipReason
                })
            })
        } catch (err) {
            console.error('Failed to record history:', err)
        }
    }

    // Tag input handlers
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

    if (isLoadingConfig) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Config Panel */}
            <div className="lg:col-span-1 space-y-4">
                {/* Config Panel */}
                <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="w-4 h-4 text-pink-400" />
                        <h2 className="font-medium text-white">Instagram Config</h2>
                    </div>

                    {/* Hashtags */}
                    <div className="mb-4">
                        <label className="text-sm text-[var(--foreground-muted)] mb-2 flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            Target Hashtags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {config.hashtags.map(hashtag => (
                                <span
                                    key={hashtag}
                                    className="px-2 py-1 bg-pink-500/20 text-pink-300 text-sm rounded-lg flex items-center gap-1"
                                >
                                    {hashtag}
                                    <button
                                        onClick={() => removeHashtag(hashtag)}
                                        className="hover:text-pink-100"
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
                            placeholder="#woodworking"
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
                                    className="px-2 py-1 bg-pink-500/20 text-pink-300 text-sm rounded-lg flex items-center gap-1"
                                >
                                    {account}
                                    <button
                                        onClick={() => removeAccount(account)}
                                        className="hover:text-pink-100"
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
                            placeholder="@woodmagazine"
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white text-sm placeholder:text-[var(--foreground-muted)]"
                        />
                    </div>

                    {/* Save Button */}
                    {configDirty && (
                        <button
                            onClick={saveConfig}
                            disabled={isSavingConfig}
                            className="w-full py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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

            {/* Right Column - Post Entry & Engagement */}
            <div className="lg:col-span-2 space-y-4">
                {/* Messages */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-400">{error}</span>
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-green-400">{successMessage}</span>
                    </div>
                )}

                {/* Post Entry Panel */}
                <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Instagram className="w-5 h-5 text-pink-400" />
                        <h2 className="font-medium text-white">Enter Instagram Post</h2>
                    </div>

                    <div className="space-y-4">
                        {/* URL Input */}
                        <div>
                            <label className="text-sm text-[var(--foreground-muted)] mb-2 flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" />
                                Post URL
                            </label>
                            <input
                                type="text"
                                value={postUrlInput}
                                onChange={(e) => setPostUrlInput(e.target.value)}
                                placeholder="https://instagram.com/p/ABC123..."
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)]"
                            />
                        </div>

                        {/* Caption Input */}
                        <div>
                            <label className="text-sm text-[var(--foreground-muted)] mb-2 block">
                                Post Caption (paste from Instagram)
                            </label>
                            <textarea
                                value={postCaptionInput}
                                onChange={(e) => setPostCaptionInput(e.target.value)}
                                placeholder="Paste the post caption here for better AI suggestions..."
                                rows={4}
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)] resize-none"
                            />
                        </div>

                        <button
                            onClick={loadPost}
                            disabled={isLoadingPost || !postUrlInput.trim()}
                            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoadingPost ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate Comment Suggestions
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Current Post & Suggestions */}
                {currentPost && (
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-6">
                        {/* Post Preview */}
                        <div className="mb-6 p-4 bg-[var(--background)] rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                                    <Instagram className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-medium text-white">@{currentPost.authorHandle}</span>
                            </div>
                            <p className="text-[var(--foreground)] text-sm whitespace-pre-wrap line-clamp-4">
                                {currentPost.caption}
                            </p>
                        </div>

                        {/* Loading Suggestions */}
                        {isLoadingSuggestions && (
                            <div className="py-8 flex items-center justify-center gap-3">
                                <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
                                <span className="text-[var(--foreground-muted)]">Generating comment suggestions...</span>
                            </div>
                        )}

                        {/* Suggestions */}
                        {!isLoadingSuggestions && suggestions.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-yellow-400" />
                                    AI Suggested Comments
                                </h4>
                                <div className="space-y-2">
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.id}
                                            onClick={() => setSelectedComment(suggestion.text)}
                                            className={`w-full p-3 text-left rounded-lg border transition-colors ${
                                                selectedComment === suggestion.text
                                                    ? 'border-pink-500 bg-pink-500/10'
                                                    : 'border-[var(--surface-border)] hover:border-pink-500/50'
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

                        {/* No suggestions - show generate button */}
                        {!isLoadingSuggestions && suggestions.length === 0 && (
                            <button
                                onClick={() => generateSuggestions()}
                                className="w-full py-3 mb-6 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Comment Suggestions
                            </button>
                        )}

                        {/* Custom Comment */}
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-white mb-2">Your Comment</h4>
                            <textarea
                                value={selectedComment}
                                onChange={(e) => setSelectedComment(e.target.value)}
                                placeholder="Select a suggestion above or write your own..."
                                rows={3}
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-white placeholder:text-[var(--foreground-muted)] resize-none"
                            />
                            <div className="flex justify-end mt-1">
                                <span className={`text-xs ${
                                    selectedComment.length > 2200
                                        ? 'text-red-400'
                                        : 'text-[var(--foreground-muted)]'
                                }`}>
                                    {selectedComment.length}/2200
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={copyComment}
                                disabled={!selectedComment}
                                className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Copy className="w-4 h-4" />
                                Copy Comment
                            </button>

                            <button
                                onClick={openInInstagram}
                                className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open in Instagram
                            </button>

                            <button
                                onClick={markAsPosted}
                                disabled={!selectedComment}
                                className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Mark Posted
                            </button>

                            {/* Skip Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setOpenSkipDropdown(!openSkipDropdown)}
                                    className="px-4 py-3 bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground-muted)] rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <SkipForward className="w-4 h-4" />
                                    Skip
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {openSkipDropdown && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg shadow-xl z-10">
                                        {SKIP_REASONS.map(reason => (
                                            <button
                                                key={reason.value}
                                                onClick={() => handleSkip(reason.value)}
                                                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] first:rounded-t-lg last:rounded-b-lg"
                                            >
                                                {reason.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!currentPost && (
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] p-12 text-center">
                        <Instagram className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">Ready to Engage</h3>
                        <p className="text-[var(--foreground-muted)]">
                            Paste an Instagram post URL above to generate AI-powered comment suggestions
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
