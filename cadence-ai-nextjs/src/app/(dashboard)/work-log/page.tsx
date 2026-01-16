'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    GitCommit,
    Loader2,
    Sparkles,
    Copy,
    RefreshCw,
    CalendarPlus,
    Check,
    Folder,
    Clock,
    Image,
    Download,
    Zap,
    Settings
} from 'lucide-react'

interface CommitInfo {
    hash: string
    message: string
    timestamp: string
    filesChanged: string[]
    folder: string
}

interface WorkLogSummary {
    totalCommits: number
    commits: CommitInfo[]
    projects: string[]
    filesChanged: number
}

interface AutomationConfig {
    enabled: boolean
    post_time: string
    platform: 'x' | 'linkedin'
    auto_approve: boolean
    generate_image: boolean
    last_run?: string
    last_result?: string
    next_run?: string
}

export default function WorkLogPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState<WorkLogSummary | null>(null)
    const [scopeMovingForward, setScopeMovingForward] = useState('')
    const [generatingPost, setGeneratingPost] = useState(false)
    const [generatedPost, setGeneratedPost] = useState('')
    const [selectedPlatform, setSelectedPlatform] = useState<'x' | 'linkedin'>('x')
    const [addingToQueue, setAddingToQueue] = useState(false)
    const [copied, setCopied] = useState(false)
    const [generatingImage, setGeneratingImage] = useState(false)
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

    // Automation state
    const [automationConfig, setAutomationConfig] = useState<AutomationConfig | null>(null)
    const [savingConfig, setSavingConfig] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    // App name mapping for image generation
    const appNameMap: Record<string, string> = {
        'foodvitals-full': 'FoodVitals',
        'food-vitals-ai-temp': 'FoodVitals',
        'cheshbon-reflections-temp': 'Cheshbon',
        'opticrep-ai-workout-trainer-temp': 'OpticRep',
        'trueform-ai-physiotherapist-temp': 'TrueForm',
        'trueform-full': 'TrueForm',
        'remcast-temp': 'RemCast',
        'cadence-ai-nextjs': 'Cadence AI',
        'stuart-hollinger-landing': 'SUITE Platform'
    }

    useEffect(() => {
        loadCommits()
        loadAutomationConfig()
    }, [])

    const loadAutomationConfig = async () => {
        try {
            const response = await fetch('/api/work-log/config')
            const data = await response.json()
            if (data.success && data.config) {
                setAutomationConfig(data.config)
            }
        } catch (error) {
            console.error('Error loading automation config:', error)
        }
    }

    const toggleAutomation = async () => {
        if (!automationConfig) return

        setSavingConfig(true)
        const newEnabled = !automationConfig.enabled

        try {
            const response = await fetch('/api/work-log/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: newEnabled,
                    postTime: automationConfig.post_time,
                    platform: automationConfig.platform,
                    autoApprove: automationConfig.auto_approve,
                    generateImage: automationConfig.generate_image
                })
            })

            const data = await response.json()
            if (data.success) {
                setAutomationConfig(prev => prev ? { ...prev, enabled: newEnabled } : null)
            }
        } catch (error) {
            console.error('Error toggling automation:', error)
        } finally {
            setSavingConfig(false)
        }
    }

    const saveAutomationSettings = async (updates: Partial<AutomationConfig>) => {
        if (!automationConfig) return

        setSavingConfig(true)
        const newConfig = { ...automationConfig, ...updates }

        try {
            const response = await fetch('/api/work-log/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: newConfig.enabled,
                    postTime: newConfig.post_time,
                    platform: newConfig.platform,
                    autoApprove: newConfig.auto_approve,
                    generateImage: newConfig.generate_image
                })
            })

            const data = await response.json()
            if (data.success) {
                setAutomationConfig(newConfig)
            }
        } catch (error) {
            console.error('Error saving automation settings:', error)
        } finally {
            setSavingConfig(false)
        }
    }

    const loadCommits = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/work-log')
            const data = await response.json()
            if (data.success) {
                setSummary(data.summary || { totalCommits: 0, commits: [], projects: [], filesChanged: 0 })
            }
        } catch (error) {
            console.error('Error loading commits:', error)
        } finally {
            setLoading(false)
        }
    }

    const generatePost = async () => {
        setGeneratingPost(true)
        setGeneratedPost('')
        try {
            // Generate the post
            const response = await fetch('/api/work-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scopeMovingForward,
                    generatePost: true,
                    platform: selectedPlatform
                })
            })

            const data = await response.json()
            if (data.success && data.generatedPost) {
                // Auto-add to queue
                const queueResponse = await fetch('/api/queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: selectedPlatform,
                        content_type: 'work_log',
                        post_text: data.generatedPost,
                        status: 'draft',
                        images: []
                    })
                })

                if (queueResponse.ok) {
                    // Navigate to calendar
                    router.push('/calendar')
                } else {
                    // If queue fails, still show the post
                    setGeneratedPost(data.generatedPost)
                    setGeneratingPost(false)
                }
            }
        } catch (error) {
            console.error('Error generating post:', error)
            setGeneratingPost(false)
        }
    }

    const generateImage = async () => {
        setGeneratingImage(true)
        setGeneratedImageUrl(null)
        try {
            // Map folder names to proper app names
            const appsUpdated = summary?.projects
                .map(p => appNameMap[p] || p)
                .filter((v, i, a) => a.indexOf(v) === i) || []

            const response = await fetch('/api/generate-dev-update-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commits: summary?.totalCommits || 0,
                    appsUpdated,
                    filesChanged: summary?.filesChanged || 0
                })
            })

            const data = await response.json()
            if (data.success && data.imageUrl) {
                setGeneratedImageUrl(data.imageUrl)
            }
        } catch (error) {
            console.error('Error generating image:', error)
        } finally {
            setGeneratingImage(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedPost)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const addToQueue = async () => {
        if (!generatedPost.trim()) return

        setAddingToQueue(true)
        try {
            const response = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    content_type: 'work_log',
                    post_text: generatedPost,
                    status: 'draft',
                    images: []
                })
            })

            if (response.ok) {
                alert('Added to queue! View in Calendar.')
                setGeneratedPost('')
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to add to queue')
            }
        } catch (error) {
            console.error('Error adding to queue:', error)
            alert('Failed to add to queue')
        } finally {
            setAddingToQueue(false)
        }
    }

    const formatTime = (timestamp: string) => {
        try {
            const date = new Date(timestamp)
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        } catch {
            return ''
        }
    }

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
                    <GitCommit className="w-7 h-7 text-[var(--primary)]" />
                    Work Log
                </h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    Generate "build in public" posts from today's git commits
                </p>
            </div>

            {/* Automation Toggle Panel */}
            {automationConfig && (
                <div className="card p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${automationConfig.enabled ? 'bg-green-500/20' : 'bg-[var(--surface)]'}`}>
                                <Zap className={`w-5 h-5 ${automationConfig.enabled ? 'text-green-500' : 'text-[var(--foreground-muted)]'}`} />
                            </div>
                            <div>
                                <h3 className="font-medium text-[var(--foreground)]">Daily Auto-Post</h3>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    {automationConfig.enabled
                                        ? `Posts daily at ${automationConfig.post_time} (skips if no commits)`
                                        : 'Automatically post work logs when you have commits'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                                title="Settings"
                            >
                                <Settings className="w-4 h-4 text-[var(--foreground-muted)]" />
                            </button>
                            {/* Toggle Switch */}
                            <button
                                onClick={toggleAutomation}
                                disabled={savingConfig}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    automationConfig.enabled ? 'bg-green-500' : 'bg-[var(--surface-border)]'
                                } ${savingConfig ? 'opacity-50' : ''}`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        automationConfig.enabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Expanded Settings */}
                    {showSettings && (
                        <div className="mt-4 pt-4 border-t border-[var(--surface-border)] space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Post Time */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                        Post Time
                                    </label>
                                    <input
                                        type="time"
                                        value={automationConfig.post_time}
                                        onChange={(e) => saveAutomationSettings({ post_time: e.target.value })}
                                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                    />
                                </div>
                                {/* Platform */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                        Platform
                                    </label>
                                    <select
                                        value={automationConfig.platform}
                                        onChange={(e) => saveAutomationSettings({ platform: e.target.value as 'x' | 'linkedin' })}
                                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                    >
                                        <option value="x">𝕏 Twitter</option>
                                        <option value="linkedin">LinkedIn</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-6">
                                {/* Generate Image */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={automationConfig.generate_image}
                                        onChange={(e) => saveAutomationSettings({ generate_image: e.target.checked })}
                                        className="w-4 h-4 rounded border-[var(--surface-border)] text-[var(--primary)]"
                                    />
                                    <span className="text-sm text-[var(--foreground)]">Generate image</span>
                                </label>
                                {/* Auto Approve */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={automationConfig.auto_approve}
                                        onChange={(e) => saveAutomationSettings({ auto_approve: e.target.checked })}
                                        className="w-4 h-4 rounded border-[var(--surface-border)] text-[var(--primary)]"
                                    />
                                    <span className="text-sm text-[var(--foreground)]">Auto-approve (skip review)</span>
                                </label>
                            </div>
                            {automationConfig.last_run && (
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    Last run: {new Date(automationConfig.last_run).toLocaleString()}
                                    {automationConfig.last_result && ` (${automationConfig.last_result})`}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--foreground-muted)]" />
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Column - Commits */}
                    <div className="space-y-6">
                        {/* Stats Card */}
                        <div className="card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-[var(--foreground)]">
                                    Today's Work
                                </h2>
                                <button
                                    onClick={loadCommits}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className="w-4 h-4 text-[var(--foreground-muted)]" />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-[var(--background)] rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-[var(--primary)]">
                                        {summary?.totalCommits || 0}
                                    </div>
                                    <div className="text-xs text-[var(--foreground-muted)] mt-1">Commits</div>
                                </div>
                                <div className="bg-[var(--background)] rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-[var(--secondary)]">
                                        {summary?.projects.length || 0}
                                    </div>
                                    <div className="text-xs text-[var(--foreground-muted)] mt-1">Projects</div>
                                </div>
                                <div className="bg-[var(--background)] rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-[var(--accent)]">
                                        {summary?.filesChanged || 0}
                                    </div>
                                    <div className="text-xs text-[var(--foreground-muted)] mt-1">Files Changed</div>
                                </div>
                            </div>
                        </div>

                        {/* Commits List */}
                        <div className="card p-5">
                            <h3 className="font-semibold text-[var(--foreground)] mb-4">
                                Commit History
                            </h3>

                            {!summary?.commits.length ? (
                                <div className="text-center py-8 text-[var(--foreground-muted)]">
                                    <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No commits found for today</p>
                                    <p className="text-sm mt-1">Start coding to generate content!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {summary.commits.map((commit, idx) => (
                                        <div
                                            key={commit.hash + idx}
                                            className="flex items-start gap-3 p-3 bg-[var(--background)] rounded-lg"
                                        >
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                                                <GitCommit className="w-4 h-4 text-[var(--primary)]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                                    {commit.message}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                                        <Folder className="w-3 h-3" />
                                                        {commit.folder}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTime(commit.timestamp)}
                                                    </span>
                                                </div>
                                                {commit.filesChanged.length > 0 && (
                                                    <div className="mt-2 text-xs text-[var(--foreground-muted)]">
                                                        {commit.filesChanged.slice(0, 3).join(', ')}
                                                        {commit.filesChanged.length > 3 && ` +${commit.filesChanged.length - 3} more`}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="flex-shrink-0 text-xs font-mono text-[var(--foreground-muted)]">
                                                {commit.hash}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Generator */}
                    <div className="space-y-6">
                        {/* Generator Card */}
                        <div className="card p-5">
                            <h2 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                                Generate Post
                            </h2>

                            {/* Platform Selector */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Platform
                                </label>
                                <div className="flex gap-2">
                                    {(['x', 'linkedin'] as const).map(platform => (
                                        <button
                                            key={platform}
                                            onClick={() => setSelectedPlatform(platform)}
                                            className={`px-4 py-2 rounded-lg capitalize ${
                                                selectedPlatform === platform
                                                    ? 'bg-[var(--primary)] text-white'
                                                    : 'bg-[var(--background)] text-[var(--foreground)]'
                                            }`}
                                        >
                                            {platform === 'x' ? '𝕏 Twitter' : 'LinkedIn'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scope Moving Forward */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Scope Moving Forward (optional)
                                </label>
                                <textarea
                                    value={scopeMovingForward}
                                    onChange={(e) => setScopeMovingForward(e.target.value)}
                                    placeholder="What's next? e.g., 'Tomorrow: finishing the calendar view'"
                                    rows={2}
                                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* Generate Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={generatePost}
                                    disabled={generatingPost}
                                    className="flex-1 btn btn-primary"
                                >
                                    {generatingPost ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Post
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={generateImage}
                                    disabled={generatingImage}
                                    className="flex-1 btn btn-secondary"
                                >
                                    {generatingImage ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Image className="w-4 h-4" />
                                            Generate Image
                                        </>
                                    )}
                                </button>
                            </div>
                            {!summary?.totalCommits && (
                                <p className="text-xs text-[var(--foreground-muted)] mt-2 text-center">
                                    No commits found today - you can still generate a post about your plans
                                </p>
                            )}
                        </div>

                        {/* Generated Image Preview */}
                        {generatedImageUrl && (
                            <div className="card p-5">
                                <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                    <Image className="w-5 h-5 text-[var(--primary)]" />
                                    Generated Image
                                </h3>
                                <div className="rounded-xl overflow-hidden border border-[var(--surface-border)]">
                                    <img
                                        src={generatedImageUrl}
                                        alt="Dev Update"
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <a
                                        href={generatedImageUrl}
                                        download="ai-fleet-dev-update.png"
                                        className="flex-1 btn btn-secondary"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </a>
                                    <button
                                        onClick={generateImage}
                                        disabled={generatingImage}
                                        className="flex-1 btn btn-ghost"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Generated Post Preview */}
                        {generatedPost && (
                            <div className="card p-5">
                                <h3 className="font-semibold text-[var(--foreground)] mb-4">
                                    Generated Post
                                </h3>

                                <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--surface-border)]">
                                    <pre className="text-[var(--foreground)] whitespace-pre-wrap font-sans text-sm">
                                        {generatedPost}
                                    </pre>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--surface-border)]">
                                        <span className="text-xs text-[var(--foreground-muted)]">
                                            {generatedPost.length} characters
                                            {selectedPlatform === 'x' && generatedPost.length > 280 && (
                                                <span className="text-red-400 ml-2">
                                                    (over 280 limit)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex-1 btn btn-secondary"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={addToQueue}
                                        disabled={addingToQueue}
                                        className="flex-1 btn btn-primary"
                                    >
                                        {addingToQueue ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <CalendarPlus className="w-4 h-4" />
                                                Add to Queue
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Regenerate */}
                                <button
                                    onClick={generatePost}
                                    disabled={generatingPost}
                                    className="w-full btn btn-ghost text-sm mt-3"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Generate Different Version
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
