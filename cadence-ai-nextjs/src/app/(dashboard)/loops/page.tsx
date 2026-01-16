'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    Plus,
    Play,
    Pause,
    Settings,
    ChevronRight,
    Loader2,
    RefreshCw,
    Trash2,
    Edit3,
    GraduationCap,
    Rocket,
    Hammer,
    DollarSign,
    Flame,
    MessageCircle,
    X,
    Check,
    Clock,
    Calendar,
    ExternalLink,
    Link2,
    Sparkles,
    Copy,
    CalendarPlus,
    GitCommit,
    Zap,
    Image
} from 'lucide-react'
import { Project } from '@/lib/supabase/types'

// Global brand settings from Settings page
interface BrandSettings {
    brandVoice: string
    tone: string
    speakingPerspective: string
    emojiStyle: string
    exclusionWords: string
    defaultHashtags: string
}

// Loop type definition
interface ContentLoop {
    id: string
    name: string
    emoji: string
    color: string
    description: string
    rotationDays: number
    isActive: boolean
    items: LoopItem[]
    lastPosted?: string
    nextPost?: string
}

interface LoopItem {
    id: string
    title: string
    url?: string
    summary?: string
    keyPoints?: string[]
    content: string
    type: 'article' | 'post' | 'cta' | 'spotlight'
    lastUsed?: string
    usageCount: number
    previousPosts?: string[] // Track generated posts to avoid repetition
}

// Work Log automated loop configuration
interface WorkLogConfig {
    enabled: boolean
    postTime: string // HH:MM format
    platform: 'x' | 'linkedin'
    autoApprove: boolean
    generateImage: boolean
    lastRun?: string
    nextRun?: string
}

// Preset loop templates
const LOOP_TEMPLATES = [
    {
        name: 'Education',
        emoji: '🎓',
        color: '#3b82f6',
        description: 'Evergreen educational content about your product',
        rotationDays: 7
    },
    {
        name: 'App Spotlight',
        emoji: '🚀',
        color: '#22c55e',
        description: 'Cycle through featuring apps or products',
        rotationDays: 3
    },
    {
        name: 'Builder Stories',
        emoji: '🔨',
        color: '#f59e0b',
        description: 'How things were made, behind the scenes',
        rotationDays: 5
    },
    {
        name: 'Social Proof',
        emoji: '💬',
        color: '#ec4899',
        description: 'Testimonials, user wins, success stories',
        rotationDays: 4
    },
    {
        name: 'Growth CTAs',
        emoji: '📢',
        color: '#8b5cf6',
        description: 'Call-to-actions: join, try, earn',
        rotationDays: 1
    },
    {
        name: 'Hot Takes',
        emoji: '🔥',
        color: '#ef4444',
        description: 'Breaking news, launches, announcements',
        rotationDays: 0 // Manual only
    },
]

function LoopsPageContent() {
    const searchParams = useSearchParams()
    const supabase = createClient()

    const projectId = searchParams.get('project')

    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<string | null>(projectId)
    const [loops, setLoops] = useState<ContentLoop[]>([])
    const [showNewLoopModal, setShowNewLoopModal] = useState(false)
    const [showAddContentModal, setShowAddContentModal] = useState<string | null>(null)
    const [expandedLoop, setExpandedLoop] = useState<string | null>(null)
    const [scrapingUrl, setScrapingUrl] = useState(false)

    // Post preview state
    const [showPostPreview, setShowPostPreview] = useState<{ loopId: string, itemId: string } | null>(null)
    const [generatingPost, setGeneratingPost] = useState(false)
    const [generatedPost, setGeneratedPost] = useState<string>('')
    const [selectedPlatform, setSelectedPlatform] = useState<'x' | 'linkedin' | 'instagram'>('x')
    const [addingToQueue, setAddingToQueue] = useState(false)

    // Work Log automated loop state
    const [workLogConfig, setWorkLogConfig] = useState<WorkLogConfig>({
        enabled: false,
        postTime: '18:00',
        platform: 'x',
        autoApprove: true,
        generateImage: true
    })
    const [showWorkLogModal, setShowWorkLogModal] = useState(false)
    const [savingWorkLog, setSavingWorkLog] = useState(false)

    // Global brand settings from Settings page
    const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null)

    // New content form
    const [newContent, setNewContent] = useState({
        url: '',
        title: '',
        summary: '',
        content: '',
        type: 'article' as const
    })

    // Load brand settings from localStorage
    useEffect(() => {
        const brandSettingsJson = localStorage.getItem('cadence_brand_settings')
        if (brandSettingsJson) {
            try {
                setBrandSettings(JSON.parse(brandSettingsJson))
            } catch (e) {
                console.error('Failed to parse brand settings:', e)
            }
        }
    }, [])

    // Load work log config from API
    useEffect(() => {
        async function loadWorkLogConfig() {
            try {
                const response = await fetch('/api/work-log/config')
                const data = await response.json()
                if (data.success && data.config) {
                    setWorkLogConfig({
                        enabled: data.config.enabled || false,
                        postTime: data.config.post_time || '18:00',
                        platform: data.config.platform || 'x',
                        autoApprove: data.config.auto_approve ?? true,
                        generateImage: data.config.generate_image ?? true,
                        lastRun: data.config.last_run,
                        nextRun: data.config.next_run
                    })
                }
            } catch (e) {
                console.error('Failed to load work log config:', e)
            }
        }
        loadWorkLogConfig()
    }, [])

    // Load projects
    useEffect(() => {
        async function loadProjects() {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) throw error
                setProjects(data || [])

                // Auto-select first project if none selected
                if (!selectedProject && data && data.length > 0) {
                    setSelectedProject(data[0].id)
                }
            } catch (err) {
                console.error('Error loading projects:', err)
            } finally {
                setLoading(false)
            }
        }
        loadProjects()
    }, [supabase])

    // Load loops when project changes
    useEffect(() => {
        if (selectedProject) {
            loadLoops()
        }
    }, [selectedProject])

    const loadLoops = async () => {
        if (!selectedProject) return

        // For now, use localStorage until we add Supabase table
        const savedLoops = localStorage.getItem(`loops-${selectedProject}`)
        if (savedLoops) {
            setLoops(JSON.parse(savedLoops))
        } else {
            setLoops([])
        }
    }

    const saveLoops = (updatedLoops: ContentLoop[]) => {
        if (!selectedProject) return
        localStorage.setItem(`loops-${selectedProject}`, JSON.stringify(updatedLoops))
        setLoops(updatedLoops)
    }

    // Save work log configuration
    const saveWorkLogConfig = async (config: WorkLogConfig) => {
        setSavingWorkLog(true)
        try {
            const response = await fetch('/api/work-log/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: config.enabled,
                    postTime: config.postTime,
                    platform: config.platform,
                    autoApprove: config.autoApprove,
                    generateImage: config.generateImage
                })
            })

            const data = await response.json()
            if (data.success) {
                setWorkLogConfig({
                    ...config,
                    nextRun: data.config?.next_run
                })
                setShowWorkLogModal(false)
            } else {
                alert(data.error || 'Failed to save configuration')
            }
        } catch (error) {
            console.error('Error saving work log config:', error)
            alert('Failed to save configuration')
        } finally {
            setSavingWorkLog(false)
        }
    }

    // Run work log now (manual trigger)
    const runWorkLogNow = async () => {
        setSavingWorkLog(true)
        try {
            const response = await fetch('/api/work-log/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: workLogConfig.platform,
                    autoApprove: workLogConfig.autoApprove,
                    generateImage: workLogConfig.generateImage,
                    postTime: workLogConfig.postTime
                })
            })

            const data = await response.json()
            console.log('Work log run response:', data)
            if (response.ok) {
                if (data.skipped) {
                    alert('No commits found for today - nothing to post')
                } else {
                    const imageStatus = data.imageGenerated ? 'Image attached' : 'No image'
                    alert(`${data.message}\n\n${imageStatus}`)
                    // Update last run time in state
                    setWorkLogConfig(prev => ({
                        ...prev,
                        lastRun: new Date().toISOString()
                    }))
                }
            } else {
                alert(data.error || 'Failed to run work log')
            }
        } catch (error) {
            console.error('Error running work log:', error)
            alert('Failed to run work log')
        } finally {
            setSavingWorkLog(false)
        }
    }

    const createLoop = (template: typeof LOOP_TEMPLATES[0]) => {
        const newLoop: ContentLoop = {
            id: crypto.randomUUID(),
            name: template.name,
            emoji: template.emoji,
            color: template.color,
            description: template.description,
            rotationDays: template.rotationDays,
            isActive: true,
            items: []
        }

        saveLoops([...loops, newLoop])
        setShowNewLoopModal(false)
    }

    const toggleLoop = (loopId: string) => {
        const updatedLoops = loops.map(loop =>
            loop.id === loopId ? { ...loop, isActive: !loop.isActive } : loop
        )
        saveLoops(updatedLoops)
    }

    const deleteLoop = (loopId: string) => {
        if (!confirm('Delete this loop and all its content?')) return
        saveLoops(loops.filter(loop => loop.id !== loopId))
    }

    const addContentToLoop = (loopId: string) => {
        if (!newContent.title.trim()) return

        const newItem: LoopItem = {
            id: crypto.randomUUID(),
            title: newContent.title,
            url: newContent.url || undefined,
            summary: newContent.summary || undefined,
            content: newContent.content,
            type: newContent.type,
            usageCount: 0,
            previousPosts: []
        }

        const updatedLoops = loops.map(loop =>
            loop.id === loopId
                ? { ...loop, items: [...loop.items, newItem] }
                : loop
        )

        saveLoops(updatedLoops)
        setNewContent({ url: '', title: '', summary: '', content: '', type: 'article' })
        setShowAddContentModal(null)
    }

    const removeContentFromLoop = (loopId: string, itemId: string) => {
        const updatedLoops = loops.map(loop =>
            loop.id === loopId
                ? { ...loop, items: loop.items.filter(item => item.id !== itemId) }
                : loop
        )
        saveLoops(updatedLoops)
    }

    // Scrape URL to extract title and summary
    const scrapeUrl = async (url: string) => {
        if (!url.trim()) return

        setScrapingUrl(true)
        try {
            // Call our API to scrape the URL
            const response = await fetch('/api/scrape-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            })

            if (response.ok) {
                const data = await response.json()
                setNewContent(prev => ({
                    ...prev,
                    title: data.title || prev.title,
                    summary: data.summary || data.description || '',
                    content: data.content || ''
                }))
            }
        } catch (err) {
            console.error('Error scraping URL:', err)
        } finally {
            setScrapingUrl(false)
        }
    }

    // Generate a post for a content item
    const generatePost = async (loopId: string, itemId: string) => {
        const loop = loops.find(l => l.id === loopId)
        const item = loop?.items.find(i => i.id === itemId)
        const project = projects.find(p => p.id === selectedProject)

        if (!item || !project) return

        setGeneratingPost(true)
        setGeneratedPost('')

        try {
            // Use global brand settings as fallback for project-specific settings
            const response = await fetch('/api/generate-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: item.title,
                    url: item.url,
                    summary: item.summary,
                    keyPoints: item.content,
                    // Use project settings first, then global settings as fallback
                    brandVoice: project.brand_voice || brandSettings?.brandVoice,
                    brandTone: project.brand_tone || brandSettings?.tone,
                    emojiStyle: project.emoji_style || brandSettings?.emojiStyle,
                    speakingPerspective: brandSettings?.speakingPerspective || 'I',
                    exclusionWords: brandSettings?.exclusionWords,
                    hashtags: project.default_hashtags || brandSettings?.defaultHashtags?.split(' ').filter(Boolean),
                    projectName: project.name,
                    platform: selectedPlatform,
                    previousPosts: item.previousPosts || []
                })
            })

            if (response.ok) {
                const data = await response.json()
                setGeneratedPost(data.post)
            }
        } catch (err) {
            console.error('Error generating post:', err)
        } finally {
            setGeneratingPost(false)
        }
    }

    // Save generated post to item's history
    const savePostToHistory = (loopId: string, itemId: string, post: string) => {
        const updatedLoops = loops.map(loop => {
            if (loop.id !== loopId) return loop
            return {
                ...loop,
                items: loop.items.map(item => {
                    if (item.id !== itemId) return item
                    return {
                        ...item,
                        previousPosts: [...(item.previousPosts || []), post],
                        usageCount: item.usageCount + 1
                    }
                })
            }
        })
        saveLoops(updatedLoops)
    }

    // Add generated post to queue
    const addToQueue = async (postText: string, loopId?: string, itemId?: string) => {
        if (!postText.trim()) return

        setAddingToQueue(true)
        try {
            const response = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    content_type: 'loop',
                    post_text: postText,
                    status: 'draft',
                    images: []
                })
            })

            if (response.ok) {
                // Save to history as well if we have loop/item context
                if (loopId && itemId) {
                    savePostToHistory(loopId, itemId, postText)
                }
                alert('Added to queue! View in Queue page.')
                setShowPostPreview(null)
                setGeneratedPost('')
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to add to queue')
            }
        } catch (err) {
            console.error('Error adding to queue:', err)
            alert('Failed to add to queue')
        } finally {
            setAddingToQueue(false)
        }
    }

    const getNextPostDate = (loop: ContentLoop) => {
        if (loop.rotationDays === 0) return 'Manual'
        if (loop.items.length === 0) return 'No content'
        if (!loop.lastPosted) {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            return tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
        const next = new Date(loop.lastPosted)
        next.setDate(next.getDate() + loop.rotationDays)
        return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const getProgressPercent = (loop: ContentLoop) => {
        const targetItems = loop.rotationDays === 0 ? 5 : Math.max(5, loop.rotationDays * 2)
        return Math.min(100, (loop.items.length / targetItems) * 100)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    const selectedProjectData = projects.find(p => p.id === selectedProject)

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Content Loops</h1>
                    <p className="text-[var(--foreground-muted)]">
                        Automated and scheduled content generation
                    </p>
                </div>

                {/* Project Selector */}
                <div className="flex items-center gap-3">
                    <select
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                    >
                        {projects.map(project => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Automated Loops Section */}
            <div className="card p-5 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-[var(--foreground)]">Automated Loops</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">System-powered content that runs automatically</p>
                        </div>
                    </div>
                </div>

                {/* Work Log Loop Card */}
                <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--surface-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                <GitCommit className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-[var(--foreground)]">Daily Work Log</h3>
                                    {workLogConfig.enabled ? (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--surface)] text-[var(--foreground-muted)]">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    Auto-generates daily dev updates from git commits
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Status info */}
                            {workLogConfig.enabled && (
                                <div className="text-right mr-4">
                                    <div className="text-xs text-[var(--foreground-muted)]">Posts daily at</div>
                                    <div className="text-sm font-medium text-[var(--foreground)]">
                                        {workLogConfig.postTime}
                                    </div>
                                </div>
                            )}

                            {/* Quick actions */}
                            <div className="flex items-center gap-2">
                                {workLogConfig.enabled && (
                                    <button
                                        onClick={runWorkLogNow}
                                        disabled={savingWorkLog}
                                        className="btn btn-ghost text-sm"
                                        title="Run now"
                                    >
                                        {savingWorkLog ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4" />
                                                Run Now
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowWorkLogModal(true)}
                                    className="btn btn-primary text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Configure
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Config summary when enabled */}
                    {workLogConfig.enabled && (
                        <div className="mt-4 pt-4 border-t border-[var(--surface-border)] flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                                <Clock className="w-4 h-4" />
                                <span>Daily at {workLogConfig.postTime}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                                <span className="capitalize">{workLogConfig.platform === 'x' ? 'Twitter/X' : 'LinkedIn'}</span>
                            </div>
                            {workLogConfig.generateImage && (
                                <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                                    <Image className="w-4 h-4" />
                                    <span>With image</span>
                                </div>
                            )}
                            {workLogConfig.autoApprove ? (
                                <div className="flex items-center gap-2 text-green-500">
                                    <Check className="w-4 h-4" />
                                    <span>Auto-posts</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Clock className="w-4 h-4" />
                                    <span>Needs approval</span>
                                </div>
                            )}
                            {workLogConfig.lastRun && (
                                <div className="flex items-center gap-2 text-[var(--foreground-muted)] ml-auto">
                                    <span>Last run: {new Date(workLogConfig.lastRun).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Loops Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Content Loops</h2>
                    <p className="text-sm text-[var(--foreground-muted)]">Evergreen content that rotates on a schedule</p>
                </div>
                <button
                    onClick={() => setShowNewLoopModal(true)}
                    className="btn btn-secondary"
                >
                    <Plus className="w-4 h-4" />
                    New Loop
                </button>
            </div>

            {/* Loops Grid */}
            {loops.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center mx-auto mb-4">
                        <RefreshCw className="w-8 h-8 text-[var(--foreground-muted)]" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">No Content Loops Yet</h2>
                    <p className="text-[var(--foreground-muted)] mb-6 max-w-md mx-auto">
                        Create loops of evergreen content that automatically rotate on a schedule.
                    </p>
                    <button
                        onClick={() => setShowNewLoopModal(true)}
                        className="btn btn-primary"
                    >
                        <Plus className="w-4 h-4" />
                        Create Your First Loop
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {loops.map(loop => (
                        <div
                            key={loop.id}
                            className="card overflow-hidden"
                        >
                            {/* Loop Header */}
                            <div
                                className="p-5 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                                onClick={() => setExpandedLoop(expandedLoop === loop.id ? null : loop.id)}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Icon */}
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                        style={{ background: `${loop.color}20` }}
                                    >
                                        {loop.emoji}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-[var(--foreground)]">
                                                {loop.name} Loop
                                            </h3>
                                            {loop.isActive ? (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--surface)] text-[var(--foreground-muted)]">
                                                    Paused
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            {loop.description}
                                        </p>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-6">
                                        {/* Progress Bar */}
                                        <div className="w-32">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-[var(--foreground-muted)]">Content</span>
                                                <span className="font-medium" style={{ color: loop.color }}>
                                                    {loop.items.length} items
                                                </span>
                                            </div>
                                            <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${getProgressPercent(loop)}%`,
                                                        background: loop.color
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Next Post */}
                                        <div className="text-right">
                                            <div className="text-xs text-[var(--foreground-muted)]">Next</div>
                                            <div className="text-sm font-medium text-[var(--foreground)]">
                                                {getNextPostDate(loop)}
                                            </div>
                                        </div>

                                        {/* Rotation */}
                                        <div className="text-right">
                                            <div className="text-xs text-[var(--foreground-muted)]">Rotation</div>
                                            <div className="text-sm font-medium text-[var(--foreground)]">
                                                {loop.rotationDays === 0 ? 'Manual' : `${loop.rotationDays}d`}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleLoop(loop.id) }}
                                                className={`p-2 rounded-lg transition-colors ${loop.isActive
                                                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                                    : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                    }`}
                                                title={loop.isActive ? 'Pause loop' : 'Activate loop'}
                                            >
                                                {loop.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteLoop(loop.id) }}
                                                className="p-2 rounded-lg bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                                title="Delete loop"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ChevronRight
                                                className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform ${expandedLoop === loop.id ? 'rotate-90' : ''
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedLoop === loop.id && (
                                <div className="border-t border-[var(--surface-border)] p-5 bg-[var(--background)]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-medium text-[var(--foreground)]">
                                            Content Items ({loop.items.length})
                                        </h4>
                                        <button
                                            onClick={() => setShowAddContentModal(loop.id)}
                                            className="btn btn-ghost text-sm"
                                            style={{ color: loop.color }}
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Content
                                        </button>
                                    </div>

                                    {loop.items.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--foreground-muted)]">
                                            <p>No content in this loop yet.</p>
                                            <button
                                                onClick={() => setShowAddContentModal(loop.id)}
                                                className="text-[var(--primary)] hover:underline mt-2"
                                            >
                                                Add your first item
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {loop.items.map((item, idx) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg group"
                                                >
                                                    <span className="text-sm font-medium text-[var(--foreground-muted)] w-6">
                                                        {idx + 1}.
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-[var(--foreground)] truncate">
                                                                {item.title}
                                                            </p>
                                                            {item.url && (
                                                                <a
                                                                    href={item.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="p-1 hover:bg-[var(--primary)]/20 rounded text-[var(--primary)]"
                                                                    title="Open article"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            )}
                                                        </div>
                                                        {(item.summary || item.content) && (
                                                            <p className="text-sm text-[var(--foreground-muted)] truncate">
                                                                {item.summary || item.content}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {item.url && (
                                                        <span title="Has URL">
                                                            <Link2 className="w-4 h-4 text-[var(--primary)]" />
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-[var(--foreground-muted)]">
                                                        Used {item.usageCount}x
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setShowPostPreview({ loopId: loop.id, itemId: item.id })
                                                            setGeneratedPost('')
                                                        }}
                                                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--primary)]/20 text-[var(--primary)] transition-all"
                                                        title="Generate post"
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeContentFromLoop(loop.id, item.id)}
                                                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Week Preview - The Mixer */}
            {loops.length > 0 && (
                <div className="card p-6 mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-[var(--primary)]" />
                                Week Preview
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                How your loops combine into a daily schedule
                            </p>
                        </div>
                    </div>

                    {/* Days of the week */}
                    <div className="grid grid-cols-7 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIdx) => {
                            // Calculate which loops would post on this day based on rotation
                            const postsForDay = loops
                                .filter(loop => loop.isActive && loop.items.length > 0)
                                .filter(loop => {
                                    if (loop.rotationDays === 0) return false // Manual loops
                                    if (loop.rotationDays === 1) return true // Daily
                                    return dayIdx % loop.rotationDays === 0 // Rotation check
                                })

                            return (
                                <div key={day} className="text-center">
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mb-2">
                                        {day}
                                    </div>
                                    <div className="min-h-[100px] bg-[var(--surface)] rounded-xl p-2 space-y-1">
                                        {postsForDay.length === 0 ? (
                                            <div className="text-xs text-[var(--foreground-muted)] opacity-50 pt-8">
                                                No posts
                                            </div>
                                        ) : (
                                            postsForDay.map(loop => (
                                                <div
                                                    key={loop.id}
                                                    className="text-xs px-2 py-1.5 rounded-lg truncate"
                                                    style={{
                                                        background: `${loop.color}20`,
                                                        color: loop.color
                                                    }}
                                                    title={`${loop.emoji} ${loop.name}`}
                                                >
                                                    {loop.emoji} {loop.name}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-6 pt-6 border-t border-[var(--surface-border)]">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm text-[var(--foreground-muted)]">
                                {loops.filter(l => l.isActive).length} active loops
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 text-[var(--foreground-muted)]" />
                            <span className="text-sm text-[var(--foreground-muted)]">
                                {loops.reduce((acc, l) => acc + l.items.length, 0)} total content items
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[var(--foreground-muted)]" />
                            <span className="text-sm text-[var(--foreground-muted)]">
                                ~{Math.round(loops.filter(l => l.isActive && l.rotationDays > 0).reduce((acc, l) => acc + (7 / l.rotationDays), 0))} posts/week
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* New Loop Modal */}
            {showNewLoopModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--foreground)]">Create Content Loop</h2>
                                <button
                                    onClick={() => setShowNewLoopModal(false)}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                Choose a template to get started
                            </p>
                        </div>

                        <div className="p-4 space-y-2">
                            {LOOP_TEMPLATES.map(template => (
                                <button
                                    key={template.name}
                                    onClick={() => createLoop(template)}
                                    className="w-full p-4 bg-[var(--background)] hover:bg-[var(--surface-hover)] rounded-xl text-left transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                            style={{ background: `${template.color}20` }}
                                        >
                                            {template.emoji}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                                                {template.name}
                                            </div>
                                            <div className="text-sm text-[var(--foreground-muted)]">
                                                {template.description}
                                            </div>
                                        </div>
                                        <div className="text-sm text-[var(--foreground-muted)]">
                                            {template.rotationDays === 0 ? 'Manual' : `Every ${template.rotationDays}d`}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Content Modal */}
            {showAddContentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-lg w-full">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--foreground)]">Add Content</h2>
                                <button
                                    onClick={() => setShowAddContentModal(null)}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* URL Input */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Article URL (optional)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={newContent.url}
                                        onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                                        placeholder="https://docs.getsuite.app/article..."
                                        className="flex-1 px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                    />
                                    <button
                                        onClick={() => scrapeUrl(newContent.url)}
                                        disabled={!newContent.url.trim() || scrapingUrl}
                                        className="btn btn-secondary px-4"
                                    >
                                        {scrapingUrl ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Fetch'
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Add a URL and click Fetch to auto-fill title & summary
                                </p>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={newContent.title}
                                    onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                                    placeholder="e.g. What is $SUITE?"
                                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                            </div>

                            {/* Summary */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Summary
                                </label>
                                <textarea
                                    value={newContent.summary}
                                    onChange={(e) => setNewContent({ ...newContent, summary: e.target.value })}
                                    placeholder="Brief description of what this article covers..."
                                    rows={2}
                                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* Key Points / Content */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Key Points (optional)
                                </label>
                                <textarea
                                    value={newContent.content}
                                    onChange={(e) => setNewContent({ ...newContent, content: e.target.value })}
                                    placeholder="Main talking points for when AI generates posts..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAddContentModal(null)}
                                    className="flex-1 btn btn-ghost"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => addContentToLoop(showAddContentModal)}
                                    disabled={!newContent.title.trim()}
                                    className="flex-1 btn btn-primary"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add to Loop
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Post Preview Modal */}
            {showPostPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-lg w-full">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--foreground)]">Generate Post</h2>
                                <button
                                    onClick={() => setShowPostPreview(null)}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Platform Selector */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Platform
                                </label>
                                <div className="flex gap-2">
                                    {(['x', 'linkedin', 'instagram'] as const).map(platform => (
                                        <button
                                            key={platform}
                                            onClick={() => setSelectedPlatform(platform)}
                                            className={`px-4 py-2 rounded-lg capitalize ${selectedPlatform === platform
                                                    ? 'bg-[var(--primary)] text-white'
                                                    : 'bg-[var(--background)] text-[var(--foreground)]'
                                                }`}
                                        >
                                            {platform === 'x' ? '𝕏 Twitter' : platform}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Brand Settings Status */}
                            {brandSettings ? (
                                <p className="text-xs text-green-500 bg-green-500/10 rounded-lg p-2">
                                    Using your brand voice settings from Settings
                                </p>
                            ) : (
                                <p className="text-xs text-[var(--foreground-muted)] bg-[var(--background)] rounded-lg p-2">
                                    Tip: Set up your brand voice in <a href="/settings" className="text-[var(--primary)] hover:underline">Settings</a> for consistent content
                                </p>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={() => generatePost(showPostPreview.loopId, showPostPreview.itemId)}
                                disabled={generatingPost}
                                className="w-full btn btn-primary"
                            >
                                {generatingPost ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Generate {selectedPlatform === 'x' ? 'Tweet' : 'Post'}
                                    </>
                                )}
                            </button>

                            {/* Generated Post Preview */}
                            {generatedPost && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-[var(--foreground)]">
                                        Generated Post
                                    </label>
                                    <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--surface-border)]">
                                        <p className="text-[var(--foreground)] whitespace-pre-wrap">
                                            {generatedPost}
                                        </p>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--surface-border)]">
                                            <span className="text-xs text-[var(--foreground-muted)]">
                                                {generatedPost.length} characters
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedPost)
                                                    }}
                                                    className="btn btn-ghost text-sm"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    Copy
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        savePostToHistory(showPostPreview.loopId, showPostPreview.itemId, generatedPost)
                                                        setShowPostPreview(null)
                                                    }}
                                                    className="btn btn-secondary text-sm"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Use & Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add to Queue Button - Primary Action */}
                                    <button
                                        onClick={() => addToQueue(generatedPost, showPostPreview.loopId, showPostPreview.itemId)}
                                        disabled={addingToQueue}
                                        className="w-full btn btn-primary"
                                    >
                                        {addingToQueue ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Adding to Queue...
                                            </>
                                        ) : (
                                            <>
                                                <CalendarPlus className="w-4 h-4" />
                                                Add to Queue
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => generatePost(showPostPreview.loopId, showPostPreview.itemId)}
                                        className="w-full btn btn-ghost text-sm"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Generate Different Version
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Work Log Configuration Modal */}
            {showWorkLogModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                        <GitCommit className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-[var(--foreground)]">Daily Work Log</h2>
                                </div>
                                <button
                                    onClick={() => setShowWorkLogModal(false)}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-[var(--foreground-muted)] mt-2">
                                Automatically generate and post daily dev updates from your git commits
                            </p>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Enable Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-[var(--foreground)]">Enable Daily Posts</label>
                                    <p className="text-sm text-[var(--foreground-muted)]">Run automatically every day</p>
                                </div>
                                <button
                                    onClick={() => setWorkLogConfig({ ...workLogConfig, enabled: !workLogConfig.enabled })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${
                                        workLogConfig.enabled ? 'bg-green-500' : 'bg-[var(--surface-border)]'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        workLogConfig.enabled ? 'translate-x-7' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Post Time */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Post Time
                                </label>
                                <input
                                    type="time"
                                    value={workLogConfig.postTime}
                                    onChange={(e) => setWorkLogConfig({ ...workLogConfig, postTime: e.target.value })}
                                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Daily post will be scheduled at this time
                                </p>
                            </div>

                            {/* Platform */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Platform
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setWorkLogConfig({ ...workLogConfig, platform: 'x' })}
                                        className={`flex-1 px-4 py-2 rounded-lg ${
                                            workLogConfig.platform === 'x'
                                                ? 'bg-[var(--primary)] text-white'
                                                : 'bg-[var(--background)] text-[var(--foreground)]'
                                        }`}
                                    >
                                        Twitter/X
                                    </button>
                                    <button
                                        onClick={() => setWorkLogConfig({ ...workLogConfig, platform: 'linkedin' })}
                                        className={`flex-1 px-4 py-2 rounded-lg ${
                                            workLogConfig.platform === 'linkedin'
                                                ? 'bg-[var(--primary)] text-white'
                                                : 'bg-[var(--background)] text-[var(--foreground)]'
                                        }`}
                                    >
                                        LinkedIn
                                    </button>
                                </div>
                            </div>

                            {/* Generate Image Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-[var(--foreground)]">Generate Image</label>
                                    <p className="text-sm text-[var(--foreground-muted)]">Include dashboard image with post</p>
                                </div>
                                <button
                                    onClick={() => setWorkLogConfig({ ...workLogConfig, generateImage: !workLogConfig.generateImage })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${
                                        workLogConfig.generateImage ? 'bg-green-500' : 'bg-[var(--surface-border)]'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        workLogConfig.generateImage ? 'translate-x-7' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Auto Approve Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-[var(--foreground)]">Auto-Approve & Post</label>
                                    <p className="text-sm text-[var(--foreground-muted)]">Post immediately without review</p>
                                </div>
                                <button
                                    onClick={() => setWorkLogConfig({ ...workLogConfig, autoApprove: !workLogConfig.autoApprove })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${
                                        workLogConfig.autoApprove ? 'bg-green-500' : 'bg-[var(--surface-border)]'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        workLogConfig.autoApprove ? 'translate-x-7' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            {!workLogConfig.autoApprove && (
                                <p className="text-xs text-amber-500 bg-amber-500/10 rounded-lg p-2">
                                    Posts will be added to your calendar as drafts for manual approval
                                </p>
                            )}
                        </div>

                        <div className="p-6 border-t border-[var(--surface-border)] flex gap-3">
                            <button
                                onClick={() => setShowWorkLogModal(false)}
                                className="flex-1 btn btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveWorkLogConfig(workLogConfig)}
                                disabled={savingWorkLog}
                                className="flex-1 btn btn-primary"
                            >
                                {savingWorkLog ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Save Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function LoopsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
            <LoopsPageContent />
        </Suspense>
    )
}
