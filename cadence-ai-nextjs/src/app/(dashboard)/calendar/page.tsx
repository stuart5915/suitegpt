'use client'

// v1.1.0 - 3-button split image generation (template, AI background, combine)

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Sparkles,
    Loader2,
    X,
    Trash2,
    CheckCircle2,
    XCircle,
    Edit3,
    Clock,
    Zap,
    GitCommit,
    ImagePlus,
    Layout,
    Layers
} from 'lucide-react'
import { Project, PLATFORM_CONFIG } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'

interface ContentItem {
    id: string
    scheduled_date: string
    scheduled_time: string
    platform: string
    caption: string
    ai_reasoning: string
    status: string
}

// Scheduled posts from Queue
interface ScheduledPost {
    id: string
    platform: string
    content_type: string
    post_text: string
    images: string[]
    scheduled_for: string | null
    status: string
    created_at: string
    // Split image generation columns
    template_image_url?: string | null
    ai_background_url?: string | null
    combined_image_url?: string | null
}

// Automation config for placeholders
interface AutomationConfig {
    type: string
    enabled: boolean
    post_time: string
    platform: string
    auto_approve: boolean
    generate_image: boolean
    last_run?: string
    last_result?: string
}

// Placeholder for scheduled automations
interface AutomationPlaceholder {
    type: string
    time: string
    platform: string
    label: string
    icon: 'work_log' | 'ai_fleet' | 'tips' | 'generic'
}

interface DayData {
    date: string
    posts: ContentItem[]
    queuePosts: ScheduledPost[]
    automationPlaceholders: AutomationPlaceholder[]
    isCurrentMonth: boolean
    isToday: boolean
    isPast: boolean
}

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Draft' },
    approved: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Approved' },
    queued: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Queued' },
    scheduled: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Scheduled' },
    posted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Posted' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
}

function CalendarPageContent() {
    const searchParams = useSearchParams()
    const supabase = createClient()

    const projectIdParam = searchParams.get('project')

    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<string | null>(projectIdParam)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [content, setContent] = useState<ContentItem[]>([])
    const [queuePosts, setQueuePosts] = useState<ScheduledPost[]>([])
    const [expandedDay, setExpandedDay] = useState<string | null>(null)
    const [draggedPost, setDraggedPost] = useState<ContentItem | null>(null)
    const [dragOverDate, setDragOverDate] = useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ postId: string; title: string; isQueue?: boolean } | null>(null)
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)

    // Edit modal state
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null)
    const [editText, setEditText] = useState('')
    const [editScheduledFor, setEditScheduledFor] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    // Automation configs for placeholders
    const [automationConfigs, setAutomationConfigs] = useState<AutomationConfig[]>([])

    // Image generation state - split into 3 separate operations
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null)
    const [generatingTemplateFor, setGeneratingTemplateFor] = useState<string | null>(null)
    const [generatingAiBackgroundFor, setGeneratingAiBackgroundFor] = useState<string | null>(null)
    const [combiningImagesFor, setCombiningImagesFor] = useState<string | null>(null)

    // Lightbox state for viewing full images
    const [lightboxImage, setLightboxImage] = useState<{ url: string; label: string } | null>(null)

    // Generate image for a post using AI (legacy - combined approach)
    const generateImageForPost = async (post: ScheduledPost) => {
        setGeneratingImageFor(post.id)
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    platform: post.platform,
                    content: post.post_text
                })
            })
            const data = await response.json()
            if (data.success && data.imageUrl) {
                // Update local state with new image
                setQueuePosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, images: [data.imageUrl] } : p
                ))
                // Also update editing post if open
                if (editingPost?.id === post.id) {
                    setEditingPost(prev => prev ? { ...prev, images: [data.imageUrl] } : null)
                }
            } else {
                console.error('Image generation failed:', data.error)
                alert('Failed to generate image: ' + (data.error || 'Unknown error'))
            }
        } catch (err) {
            console.error('Failed to generate image:', err)
            alert('Failed to generate image. Please try again.')
        } finally {
            setGeneratingImageFor(null)
        }
    }

    // Generate template-only image (fast, no AI)
    const generateTemplateImage = async (post: ScheduledPost) => {
        setGeneratingTemplateFor(post.id)
        try {
            const response = await fetch('/api/generate-template-only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    platform: post.platform,
                    content: post.post_text
                })
            })
            const data = await response.json()
            if (data.success && data.templateImageUrl) {
                // Update local state with template image
                setQueuePosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, template_image_url: data.templateImageUrl } : p
                ))
                if (editingPost?.id === post.id) {
                    setEditingPost(prev => prev ? { ...prev, template_image_url: data.templateImageUrl } : null)
                }
            } else {
                console.error('Template generation failed:', data.error)
                alert('Failed to generate template: ' + (data.error || 'Unknown error'))
            }
        } catch (err) {
            console.error('Failed to generate template:', err)
            alert('Failed to generate template. Please try again.')
        } finally {
            setGeneratingTemplateFor(null)
        }
    }

    // Generate AI background image (Gemini)
    const generateAiBackground = async (post: ScheduledPost) => {
        setGeneratingAiBackgroundFor(post.id)
        try {
            const response = await fetch('/api/generate-ai-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    platform: post.platform,
                    content: post.post_text
                })
            })
            const data = await response.json()
            if (data.success && data.aiBackgroundUrl) {
                // Update local state with AI background
                setQueuePosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, ai_background_url: data.aiBackgroundUrl } : p
                ))
                if (editingPost?.id === post.id) {
                    setEditingPost(prev => prev ? { ...prev, ai_background_url: data.aiBackgroundUrl } : null)
                }
            } else {
                console.error('AI background generation failed:', data.error)
                alert('Failed to generate AI background: ' + (data.error || 'Unknown error'))
            }
        } catch (err) {
            console.error('Failed to generate AI background:', err)
            alert('Failed to generate AI background. Please try again.')
        } finally {
            setGeneratingAiBackgroundFor(null)
        }
    }

    // Combine template + AI background into final image
    const combineImages = async (post: ScheduledPost) => {
        if (!post.ai_background_url) {
            alert('Please generate an AI background first')
            return
        }
        setCombiningImagesFor(post.id)
        try {
            const response = await fetch('/api/combine-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    platform: post.platform,
                    content: post.post_text,
                    aiBackgroundUrl: post.ai_background_url
                })
            })
            const data = await response.json()
            if (data.success && data.combinedImageUrl) {
                // Update local state with combined image
                setQueuePosts(prev => prev.map(p =>
                    p.id === post.id ? {
                        ...p,
                        combined_image_url: data.combinedImageUrl,
                        images: [data.combinedImageUrl]
                    } : p
                ))
                if (editingPost?.id === post.id) {
                    setEditingPost(prev => prev ? {
                        ...prev,
                        combined_image_url: data.combinedImageUrl,
                        images: [data.combinedImageUrl]
                    } : null)
                }
            } else {
                console.error('Image combination failed:', data.error)
                alert('Failed to combine images: ' + (data.error || 'Unknown error'))
            }
        } catch (err) {
            console.error('Failed to combine images:', err)
            alert('Failed to combine images. Please try again.')
        } finally {
            setCombiningImagesFor(null)
        }
    }

    // Request delete confirmation
    const requestDelete = (postId: string, title: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation()
        }
        setDeleteConfirm({ postId, title })
    }

    // Confirm delete
    const confirmDelete = async () => {
        if (!deleteConfirm) return

        try {
            await supabase
                .from('content_items')
                .delete()
                .eq('id', deleteConfirm.postId)

            // Remove from local state
            setContent(prev => prev.filter(c => c.id !== deleteConfirm.postId))
        } catch (err) {
            console.error('Failed to delete post:', err)
        } finally {
            setDeleteConfirm(null)
        }
    }

    // Delete all content for this project
    const deleteAllContent = async () => {
        if (!selectedProject) return

        setDeletingAll(true)
        try {
            await supabase
                .from('content_items')
                .delete()
                .eq('project_id', selectedProject)

            setContent([])
        } catch (err) {
            console.error('Failed to delete all content:', err)
        } finally {
            setDeletingAll(false)
            setDeleteAllConfirm(false)
        }
    }

    // Update post date (for drag-and-drop)
    const updatePostDate = async (postId: string, newDate: string) => {
        try {
            await supabase
                .from('content_items')
                .update({ scheduled_date: newDate })
                .eq('id', postId)

            // Update local state
            setContent(prev => prev.map(c =>
                c.id === postId ? { ...c, scheduled_date: newDate } : c
            ))
        } catch (err) {
            console.error('Failed to update post date:', err)
        }
    }

    // Load projects
    useEffect(() => {
        async function loadProjects() {
            try {
                const { data } = await supabase
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: false })

                setProjects(data || [])

                // Auto-select project: URL param > first available project
                if (projectIdParam && data?.some(p => p.id === projectIdParam)) {
                    setSelectedProject(projectIdParam)
                } else if (!selectedProject && data && data.length > 0) {
                    // Auto-select first project if none selected
                    setSelectedProject(data[0].id)
                }
            } finally {
                setLoading(false)
            }
        }
        loadProjects()
    }, [supabase, projectIdParam])

    // Load content for the month
    useEffect(() => {
        if (selectedProject) {
            loadMonthContent()
        }
        loadQueuePosts()
        loadAutomationConfigs()
    }, [selectedProject, currentDate])

    // Load automation configs for placeholders
    const loadAutomationConfigs = async () => {
        try {
            const response = await fetch('/api/work-log/config')
            const data = await response.json()
            if (data.success && data.config) {
                // For now we just have work_log, but this can expand to multiple automations
                setAutomationConfigs([data.config])
            }
        } catch (err) {
            console.error('Failed to load automation configs:', err)
        }
    }

    // Helper to format date as YYYY-MM-DD in local time
    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const loadMonthContent = async () => {
        if (!selectedProject) return

        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        // Get first and last day of month (with padding for calendar grid)
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        // Extend range to show full weeks
        const startDate = new Date(firstDay)
        startDate.setDate(startDate.getDate() - firstDay.getDay() + 1) // Start from Monday
        if (firstDay.getDay() === 0) startDate.setDate(startDate.getDate() - 7)

        const endDate = new Date(lastDay)
        endDate.setDate(endDate.getDate() + (7 - lastDay.getDay()))

        try {
            const { data } = await supabase
                .from('content_items')
                .select('*')
                .eq('project_id', selectedProject)
                .in('status', ['draft', 'approved', 'scheduled', 'posted']) // Show all statuses
                .gte('scheduled_date', formatLocalDate(startDate))
                .lte('scheduled_date', formatLocalDate(endDate))
                .order('scheduled_date')
                .order('scheduled_time')

            setContent(data || [])
        } catch (err) {
            console.error('Failed to load content:', err)
        }
    }

    // Load queue posts (scheduled_posts table)
    const loadQueuePosts = async () => {
        try {
            const response = await fetch('/api/queue')
            const data = await response.json()
            setQueuePosts(data.posts || [])
        } catch (err) {
            console.error('Failed to load queue posts:', err)
        }
    }

    // Approve a queue post
    const approveQueuePost = async (id: string) => {
        try {
            await fetch(`/api/queue/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'approved' })
            })
            setQueuePosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p))
            if (editingPost?.id === id) {
                setEditingPost(prev => prev ? { ...prev, status: 'approved' } : null)
            }
        } catch (err) {
            console.error('Failed to approve post:', err)
        }
    }

    // Reject/delete a queue post
    const rejectQueuePost = async (id: string) => {
        try {
            await fetch(`/api/queue/${id}`, { method: 'DELETE' })
            setQueuePosts(prev => prev.filter(p => p.id !== id))
            setEditingPost(null)
        } catch (err) {
            console.error('Failed to reject post:', err)
        }
    }

    // Open edit modal for queue post
    const openEditModal = (post: ScheduledPost) => {
        setEditingPost(post)
        setEditText(post.post_text)
        setEditScheduledFor(post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '')
    }

    // Save edit to queue post
    const saveQueuePostEdit = async () => {
        if (!editingPost) return

        setSavingEdit(true)
        try {
            await fetch(`/api/queue/${editingPost.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_text: editText,
                    scheduled_for: editScheduledFor || null
                })
            })
            setQueuePosts(prev => prev.map(p =>
                p.id === editingPost.id
                    ? { ...p, post_text: editText, scheduled_for: editScheduledFor || null }
                    : p
            ))
            setEditingPost(null)
        } catch (err) {
            console.error('Failed to save post:', err)
        } finally {
            setSavingEdit(false)
        }
    }

    const navigateMonth = (direction: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev)
            newDate.setMonth(newDate.getMonth() + direction)
            return newDate
        })
        setExpandedDay(null)
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    // Generate calendar grid
    const generateCalendarDays = (): DayData[] => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const today = formatLocalDate(new Date())
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)

        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        // Start from Monday of the week containing the 1st
        const startDate = new Date(firstDay)
        const dayOfWeek = firstDay.getDay()
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate.setDate(startDate.getDate() - daysToSubtract)

        const days: DayData[] = []
        const current = new Date(startDate)

        // Generate 6 weeks of days
        for (let i = 0; i < 42; i++) {
            const dateStr = formatLocalDate(current)
            const currentDateCopy = new Date(current)
            currentDateCopy.setHours(0, 0, 0, 0)
            const isPast = currentDateCopy < todayDate

            // Filter queue posts by scheduled_for date
            const dayQueuePosts = queuePosts.filter(p => {
                if (!p.scheduled_for) return false
                const postDate = new Date(p.scheduled_for)
                return formatLocalDate(postDate) === dateStr
            })

            // Generate automation placeholders for today and future days
            const automationPlaceholders: AutomationPlaceholder[] = []
            if (!isPast) {
                // Check if there's already a work_log queue post for this day
                const hasWorkLogPost = dayQueuePosts.some(p => p.content_type === 'work_log')

                for (const config of automationConfigs) {
                    if (config.enabled && config.type === 'work_log' && !hasWorkLogPost) {
                        automationPlaceholders.push({
                            type: 'work_log',
                            time: config.post_time,
                            platform: config.platform,
                            label: 'Work Log',
                            icon: 'work_log'
                        })
                    }
                    // Add more automation types here as they're added
                }
            }

            days.push({
                date: dateStr,
                posts: content.filter(c => c.scheduled_date === dateStr),
                queuePosts: dayQueuePosts,
                automationPlaceholders,
                isCurrentMonth: current.getMonth() === month,
                isToday: dateStr === today,
                isPast,
            })
            current.setDate(current.getDate() + 1)
        }

        return days
    }

    // Get unscheduled queue posts (no scheduled_for date)
    const unscheduledPosts = queuePosts.filter(p => !p.scheduled_for)

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    const calendarDays = generateCalendarDays()
    const selectedProjectData = projects.find(p => p.id === selectedProject)
    const totalPosts = content.length

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
                    <Calendar className="w-8 h-8 text-[var(--primary)]" />
                    Content Calendar
                </h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    View your scheduled content at a glance
                </p>
            </header>

            {/* Controls */}
            <div className="card p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Project Selector */}
                    <select
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="input"
                    >
                        <option value="">All Projects</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Month Navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 rounded-lg hover:bg-[var(--surface)] cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-lg font-semibold text-[var(--foreground)] min-w-[160px] text-center">
                            {monthName}
                        </span>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 rounded-lg hover:bg-[var(--surface)] cursor-pointer"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={goToToday}
                        className="btn btn-ghost text-sm"
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--foreground-muted)]">
                        {totalPosts} posts this month
                    </span>
                    {totalPosts > 0 && (
                        <button
                            onClick={() => setDeleteAllConfirm(true)}
                            className="btn btn-ghost text-[var(--error)] text-sm cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete All
                        </button>
                    )}
                    {selectedProject && (
                        <Link
                            href={`/weekly?project=${selectedProject}`}
                            className="btn btn-primary text-sm"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate Content
                        </Link>
                    )}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="card overflow-hidden">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-[var(--surface-border)]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="p-3 text-center text-sm font-medium text-[var(--foreground-muted)] bg-[var(--surface)]">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, i) => {
                        const hasContent = day.posts.length > 0 || day.queuePosts.length > 0 || day.automationPlaceholders.length > 0
                        const isExpanded = expandedDay === day.date
                        const isDragOver = dragOverDate === day.date
                        const totalPosts = day.posts.length + day.queuePosts.length

                        return (
                            <div
                                key={day.date}
                                className={`min-h-[100px] border-b border-r border-[var(--surface-border)] p-2 transition-colors ${!day.isCurrentMonth ? 'bg-[var(--background-elevated)] opacity-50' : ''
                                    } ${day.isToday ? 'bg-[var(--primary)]/5' : ''} ${hasContent ? 'cursor-pointer hover:bg-[var(--surface-hover)]' : ''
                                    } ${isDragOver ? 'bg-[var(--primary)]/20 ring-2 ring-[var(--primary)] ring-inset' : ''}`}
                                onClick={() => hasContent && setExpandedDay(isExpanded ? null : day.date)}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOverDate(day.date)
                                }}
                                onDragLeave={() => setDragOverDate(null)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setDragOverDate(null)
                                    if (draggedPost && draggedPost.scheduled_date !== day.date) {
                                        updatePostDate(draggedPost.id, day.date)
                                    }
                                    setDraggedPost(null)
                                }}
                            >
                                {/* Date Number */}
                                <div className={`text-sm font-medium mb-1 ${day.isToday ? 'text-[var(--primary)] font-bold' :
                                    day.isCurrentMonth ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'
                                    }`}>
                                    {new Date(day.date).getDate()}
                                </div>

                                {/* Automation Placeholders */}
                                {day.automationPlaceholders.length > 0 && (
                                    <div className="space-y-1">
                                        {day.automationPlaceholders.map((placeholder, idx) => (
                                            <div
                                                key={`${placeholder.type}-${idx}`}
                                                className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1 bg-yellow-500/10 text-yellow-500 border border-dashed border-yellow-500/30"
                                            >
                                                {placeholder.icon === 'work_log' ? (
                                                    <GitCommit className="w-3 h-3" />
                                                ) : (
                                                    <Zap className="w-3 h-3" />
                                                )}
                                                <span className="truncate flex-1">{placeholder.label}</span>
                                                <span className="text-[10px] opacity-70">{placeholder.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Post Indicators - Content Items */}
                                {day.posts.length > 0 && (
                                    <div className="space-y-1 mt-1">
                                        {day.posts.slice(0, 2).map(post => {
                                            const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.draft
                                            return (
                                                <div
                                                    key={post.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.stopPropagation()
                                                        setDraggedPost(post)
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedPost(null)
                                                        setDragOverDate(null)
                                                    }}
                                                    className={`group text-xs px-1.5 py-0.5 rounded flex items-center gap-1 cursor-grab active:cursor-grabbing ${statusStyle.bg} ${statusStyle.text}`}
                                                >
                                                    <PlatformIcon platform={post.platform} size={12} />
                                                    <span className="truncate flex-1">{post.ai_reasoning || 'Post'}</span>
                                                    <button
                                                        onClick={(e) => requestDelete(post.id, post.ai_reasoning || 'Post', e)}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-opacity"
                                                        title="Delete post"
                                                    >
                                                        <X className="w-3 h-3 text-red-500" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Post Indicators - Queue Posts */}
                                {day.queuePosts.length > 0 && (
                                    <div className="space-y-1 mt-1">
                                        {day.queuePosts.slice(0, day.posts.length > 0 ? 1 : 2).map(post => {
                                            const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.draft
                                            return (
                                                <div
                                                    key={post.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditModal(post)
                                                    }}
                                                    className={`group text-xs px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:ring-1 hover:ring-white/20 ${statusStyle.bg} ${statusStyle.text}`}
                                                >
                                                    <span className="text-[10px]">📝</span>
                                                    <span className="truncate flex-1">{post.post_text.slice(0, 20)}...</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {totalPosts > 3 && (
                                    <div className="text-xs text-[var(--foreground-muted)] px-1.5 mt-1">
                                        +{totalPosts - 3} more
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Unscheduled Queue Posts */}
            {unscheduledPosts.length > 0 && (
                <div className="card p-4 mt-6">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[var(--foreground-muted)]" />
                        Unscheduled Posts ({unscheduledPosts.length})
                    </h3>
                    <p className="text-sm text-[var(--foreground-muted)] mb-4">
                        These posts are in your queue but haven't been scheduled yet.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unscheduledPosts.slice(0, 6).map(post => {
                            const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.draft
                            return (
                                <div
                                    key={post.id}
                                    onClick={() => openEditModal(post)}
                                    className="p-3 bg-[var(--surface)] rounded-lg cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                                            {statusStyle.label}
                                        </span>
                                        <span className="text-xs text-[var(--foreground-muted)]">{post.content_type}</span>
                                    </div>
                                    <p className="text-sm text-[var(--foreground)] line-clamp-2">{post.post_text}</p>
                                </div>
                            )
                        })}
                    </div>
                    {unscheduledPosts.length > 6 && (
                        <Link href="/queue" className="block text-center mt-4 text-sm text-[var(--primary)] hover:underline">
                            View all {unscheduledPosts.length} unscheduled posts
                        </Link>
                    )}
                </div>
            )}

            {/* Expanded Day View */}
            {expandedDay && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setExpandedDay(null)}>
                    <div className="bg-[var(--background)] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                {new Date(expandedDay).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h3>
                            <button onClick={() => setExpandedDay(null)} className="p-2 hover:bg-[var(--surface)] rounded-lg cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
                            {/* Automation Placeholders */}
                            {calendarDays.find(d => d.date === expandedDay)?.automationPlaceholders.map((placeholder, idx) => (
                                <div key={`${placeholder.type}-${idx}`} className="p-3 rounded-lg bg-yellow-500/10 border border-dashed border-yellow-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        {placeholder.icon === 'work_log' ? (
                                            <GitCommit className="w-5 h-5 text-yellow-500" />
                                        ) : (
                                            <Zap className="w-5 h-5 text-yellow-500" />
                                        )}
                                        <span className="text-sm font-medium text-yellow-500">{placeholder.label}</span>
                                        <span className="text-xs text-yellow-500/70">@ {placeholder.time}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full ml-auto bg-yellow-500/20 text-yellow-500">
                                            Scheduled
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--foreground-muted)]">
                                        This automation will run automatically at {placeholder.time}. Content will be generated based on your activity.
                                    </p>
                                    <Link
                                        href="/work-log"
                                        className="inline-flex items-center gap-1 mt-2 text-xs text-yellow-500 hover:underline"
                                    >
                                        Configure in Work Log settings
                                    </Link>
                                </div>
                            ))}

                            {/* Content Items */}
                            {calendarDays.find(d => d.date === expandedDay)?.posts.map(post => {
                                const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.draft
                                return (
                                    <div key={post.id} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <PlatformIcon platform={post.platform} size={18} />
                                            <span className="text-sm font-medium text-[var(--foreground)]">{PLATFORM_NAMES[post.platform] || post.platform}</span>
                                            <span className="text-xs text-[var(--foreground-muted)]">{post.scheduled_time?.slice(0, 5)}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${statusStyle.bg} ${statusStyle.text}`}>
                                                {statusStyle.label}
                                            </span>
                                            <button
                                                onClick={(e) => requestDelete(post.id, post.ai_reasoning || 'Post', e)}
                                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors cursor-pointer"
                                                title="Delete post"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-medium text-[var(--foreground)] mb-1">{post.ai_reasoning}</p>
                                        <p className="text-sm text-[var(--foreground-muted)] line-clamp-3">{post.caption}</p>
                                    </div>
                                )
                            })}

                            {/* Queue Posts */}
                            {calendarDays.find(d => d.date === expandedDay)?.queuePosts.map(post => {
                                const statusStyle = STATUS_COLORS[post.status] || STATUS_COLORS.draft
                                const platformName = PLATFORM_NAMES[post.platform] || post.platform
                                const hasImage = post.images && post.images.length > 0
                                const isGeneratingImage = generatingImageFor === post.id
                                // Format scheduled time
                                const scheduledTime = post.scheduled_for
                                    ? new Date(post.scheduled_for).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })
                                    : null
                                return (
                                    <div key={post.id} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)]">
                                        {/* Header with platform, time, and status */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--background)] rounded-md">
                                                <PlatformIcon platform={post.platform} size={14} />
                                                <span className="text-xs font-medium text-[var(--foreground)]">{platformName}</span>
                                            </div>
                                            {scheduledTime && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-md">
                                                    <Clock className="w-3 h-3 text-blue-400" />
                                                    <span className="text-xs font-medium text-blue-400">{scheduledTime}</span>
                                                </div>
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${statusStyle.bg} ${statusStyle.text}`}>
                                                {statusStyle.label}
                                            </span>
                                        </div>

                                        {/* Image preview if available */}
                                        {hasImage && (
                                            <div
                                                className="mb-3 rounded-lg overflow-hidden border border-[var(--surface-border)] cursor-pointer hover:border-[var(--primary)] transition-colors"
                                                onClick={() => setLightboxImage({ url: post.images[0], label: 'Post Image' })}
                                            >
                                                <img
                                                    src={post.images[0]}
                                                    alt="Post image"
                                                    className="w-full h-32 object-cover"
                                                />
                                            </div>
                                        )}

                                        {/* Post content */}
                                        <p className="text-sm text-[var(--foreground)] line-clamp-3 mb-3">{post.post_text}</p>

                                        {/* Image Generation Buttons - 3 separate operations */}
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            {/* Template Button */}
                                            <button
                                                onClick={() => generateTemplateImage(post)}
                                                disabled={generatingTemplateFor === post.id}
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 disabled:opacity-50"
                                                title="Generate branded template with gradient background (fast, no AI)"
                                            >
                                                {generatingTemplateFor === post.id ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Template...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Layout className="w-3 h-3" />
                                                        Template
                                                    </>
                                                )}
                                            </button>

                                            {/* AI Image Button */}
                                            <button
                                                onClick={() => generateAiBackground(post)}
                                                disabled={generatingAiBackgroundFor === post.id}
                                                className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30 disabled:opacity-50"
                                                title="Generate AI background with Gemini (may take a few seconds)"
                                            >
                                                {generatingAiBackgroundFor === post.id ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        AI...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-3 h-3" />
                                                        AI Image
                                                    </>
                                                )}
                                            </button>

                                            {/* Combine Button */}
                                            <button
                                                onClick={() => combineImages(post)}
                                                disabled={!post.ai_background_url || combiningImagesFor === post.id}
                                                className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={post.ai_background_url ? "Combine template + AI background into final image" : "Generate AI background first"}
                                            >
                                                {combiningImagesFor === post.id ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Combining...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Layers className="w-3 h-3" />
                                                        Combine
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Image preview thumbnails */}
                                        {(post.template_image_url || post.ai_background_url || post.combined_image_url) && (
                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                {post.template_image_url && (
                                                    <div
                                                        className="relative group cursor-pointer hover:scale-105 transition-transform"
                                                        onClick={() => setLightboxImage({ url: post.template_image_url!, label: 'Template' })}
                                                    >
                                                        <img
                                                            src={post.template_image_url}
                                                            alt="Template"
                                                            className="w-16 h-16 object-cover rounded border border-blue-500/30"
                                                        />
                                                        <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-blue-500/80 text-white text-center">Template</span>
                                                    </div>
                                                )}
                                                {post.ai_background_url && (
                                                    <div
                                                        className="relative group cursor-pointer hover:scale-105 transition-transform"
                                                        onClick={() => setLightboxImage({ url: post.ai_background_url!, label: 'AI Background' })}
                                                    >
                                                        <img
                                                            src={post.ai_background_url}
                                                            alt="AI Background"
                                                            className="w-16 h-16 object-cover rounded border border-purple-500/30"
                                                        />
                                                        <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-purple-500/80 text-white text-center">AI</span>
                                                    </div>
                                                )}
                                                {post.combined_image_url && (
                                                    <div
                                                        className="relative group cursor-pointer hover:scale-105 transition-transform"
                                                        onClick={() => setLightboxImage({ url: post.combined_image_url!, label: 'Final Combined' })}
                                                    >
                                                        <img
                                                            src={post.combined_image_url}
                                                            alt="Combined"
                                                            className="w-16 h-16 object-cover rounded border border-emerald-500/30"
                                                        />
                                                        <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-emerald-500/80 text-white text-center">Final</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {!['approved', 'posted', 'scheduled'].includes(post.status) && (
                                                <button
                                                    onClick={() => approveQueuePost(post.id)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Approve
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openEditModal(post)}
                                                className="flex items-center gap-1 px-2 py-1 bg-[var(--surface-hover)] text-[var(--foreground-muted)] rounded text-xs hover:bg-[var(--surface-border)]"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm('Delete this post?')) {
                                                        rejectQueuePost(post.id)
                                                    }
                                                }}
                                                className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-4 border-t border-[var(--surface-border)]">
                            <Link
                                href={`/weekly?project=${selectedProject}`}
                                className="btn btn-primary w-full justify-center"
                            >
                                View in Weekly Planner
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedProject && (
                <div className="mt-8 card p-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-[var(--foreground-muted)]" />
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Select a Project</h2>
                    <p className="text-[var(--foreground-muted)]">Choose a project to view its content calendar</p>
                </div>
            )}

            {selectedProject && totalPosts === 0 && (
                <div className="mt-8 card p-12 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-[var(--primary)]" />
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">No Content Yet</h2>
                    <p className="text-[var(--foreground-muted)] mb-6">Generate your first week of content to see it here</p>
                    <Link href={`/weekly?project=${selectedProject}&autoGenerate=true`} className="btn btn-primary">
                        <Sparkles className="w-4 h-4" />
                        Generate Week
                    </Link>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-[var(--background)] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)] text-center mb-2">
                                Delete Post?
                            </h3>
                            <p className="text-sm text-[var(--foreground-muted)] text-center mb-1">
                                &ldquo;{deleteConfirm.title}&rdquo;
                            </p>
                            <p className="text-xs text-[var(--foreground-muted)] text-center">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex border-t border-[var(--surface-border)]">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors border-l border-[var(--surface-border)] cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete All Confirmation Modal */}
            {deleteAllConfirm && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteAllConfirm(false)}>
                    <div className="bg-[var(--background)] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)] text-center mb-2">
                                Delete All Content?
                            </h3>
                            <p className="text-sm text-[var(--foreground-muted)] text-center mb-1">
                                This will delete all {totalPosts} posts for this project.
                            </p>
                            <p className="text-xs text-[var(--foreground-muted)] text-center">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex border-t border-[var(--surface-border)]">
                            <button
                                onClick={() => setDeleteAllConfirm(false)}
                                className="flex-1 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteAllContent}
                                disabled={deletingAll}
                                className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors border-l border-[var(--surface-border)] cursor-pointer"
                            >
                                {deletingAll ? 'Deleting...' : 'Delete All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Queue Post Modal */}
            {editingPost && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setEditingPost(null)}>
                    <div className="bg-[var(--background)] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--foreground)]">Edit Post</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {/* Platform badge */}
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--surface)] rounded-md">
                                        <PlatformIcon platform={editingPost.platform} size={12} />
                                        <span className="text-xs font-medium text-[var(--foreground)]">
                                            {PLATFORM_NAMES[editingPost.platform] || editingPost.platform}
                                        </span>
                                    </div>
                                    {(() => {
                                        const statusStyle = STATUS_COLORS[editingPost.status] || STATUS_COLORS.draft
                                        return (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                                                {statusStyle.label}
                                            </span>
                                        )
                                    })()}
                                    <span className="text-xs text-[var(--foreground-muted)]">{editingPost.content_type}</span>
                                </div>
                            </div>
                            <button onClick={() => setEditingPost(null)} className="p-2 hover:bg-[var(--surface)] rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto">
                            {/* Image Generation Section - 3 Separate Buttons */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
                                    Image Generation
                                </label>

                                {/* 3 Button Row */}
                                <div className="flex gap-2 mb-4">
                                    {/* Template Button */}
                                    <button
                                        onClick={() => generateTemplateImage(editingPost)}
                                        disabled={generatingTemplateFor === editingPost.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 disabled:opacity-50"
                                        title="Fast branded template with gradient"
                                    >
                                        {generatingTemplateFor === editingPost.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Layout className="w-4 h-4" />
                                                Template
                                            </>
                                        )}
                                    </button>

                                    {/* AI Image Button */}
                                    <button
                                        onClick={() => generateAiBackground(editingPost)}
                                        disabled={generatingAiBackgroundFor === editingPost.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50"
                                        title="Gemini AI background"
                                    >
                                        {generatingAiBackgroundFor === editingPost.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                AI Image
                                            </>
                                        )}
                                    </button>

                                    {/* Combine Button */}
                                    <button
                                        onClick={() => combineImages(editingPost)}
                                        disabled={!editingPost.ai_background_url || combiningImagesFor === editingPost.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={editingPost.ai_background_url ? "Combine into final" : "Generate AI background first"}
                                    >
                                        {combiningImagesFor === editingPost.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Combining...
                                            </>
                                        ) : (
                                            <>
                                                <Layers className="w-4 h-4" />
                                                Combine
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Image Preview Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Template Preview */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-blue-400 font-medium">Template</span>
                                        {editingPost.template_image_url ? (
                                            <div
                                                className="rounded-lg overflow-hidden border border-blue-500/30 aspect-square cursor-pointer hover:border-blue-400 transition-colors"
                                                onClick={() => setLightboxImage({ url: editingPost.template_image_url!, label: 'Template' })}
                                            >
                                                <img
                                                    src={editingPost.template_image_url}
                                                    alt="Template"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border-2 border-dashed border-[var(--surface-border)] aspect-square flex items-center justify-center">
                                                <Layout className="w-6 h-6 text-[var(--foreground-muted)]" />
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Background Preview */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-purple-400 font-medium">AI Background</span>
                                        {editingPost.ai_background_url ? (
                                            <div
                                                className="rounded-lg overflow-hidden border border-purple-500/30 aspect-square cursor-pointer hover:border-purple-400 transition-colors"
                                                onClick={() => setLightboxImage({ url: editingPost.ai_background_url!, label: 'AI Background' })}
                                            >
                                                <img
                                                    src={editingPost.ai_background_url}
                                                    alt="AI Background"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border-2 border-dashed border-[var(--surface-border)] aspect-square flex items-center justify-center">
                                                <Sparkles className="w-6 h-6 text-[var(--foreground-muted)]" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Combined Preview */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-emerald-400 font-medium">Final Combined</span>
                                        {editingPost.combined_image_url ? (
                                            <div
                                                className="rounded-lg overflow-hidden border border-emerald-500/30 aspect-square cursor-pointer hover:border-emerald-400 transition-colors"
                                                onClick={() => setLightboxImage({ url: editingPost.combined_image_url!, label: 'Final Combined' })}
                                            >
                                                <img
                                                    src={editingPost.combined_image_url}
                                                    alt="Combined"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border-2 border-dashed border-[var(--surface-border)] aspect-square flex items-center justify-center">
                                                <Layers className="w-6 h-6 text-[var(--foreground-muted)]" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Helper text */}
                                <p className="text-xs text-[var(--foreground-muted)] mt-3">
                                    1. Click <span className="text-blue-400">Template</span> for fast branded image.
                                    2. Click <span className="text-purple-400">AI Image</span> for custom background.
                                    3. Click <span className="text-emerald-400">Combine</span> to merge them.
                                </p>
                            </div>

                            {/* Legacy full image preview (if exists) */}
                            {editingPost.images && editingPost.images.length > 0 && !editingPost.combined_image_url && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                        Current Post Image
                                    </label>
                                    <div className="rounded-lg overflow-hidden border border-[var(--surface-border)]">
                                        <img
                                            src={editingPost.images[0]}
                                            alt="Post image"
                                            className="w-full h-auto"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Post Text */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Post Content
                                </label>
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={5}
                                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    {editText.length} characters
                                </p>
                            </div>

                            {/* Schedule */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Schedule For
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editScheduledFor}
                                    onChange={(e) => setEditScheduledFor(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2">
                                {!['approved', 'posted', 'scheduled'].includes(editingPost.status) && (
                                    <button
                                        onClick={() => approveQueuePost(editingPost.id)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this post?')) {
                                            rejectQueuePost(editingPost.id)
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Delete
                                </button>
                                <div className="flex-1" />
                                <button
                                    onClick={() => setEditingPost(null)}
                                    className="px-4 py-2 text-[var(--foreground-muted)] rounded-lg text-sm font-medium hover:bg-[var(--surface)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveQueuePostEdit}
                                    disabled={savingEdit}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary)]/90 disabled:opacity-50"
                                >
                                    {savingEdit ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Edit3 className="w-4 h-4" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal for viewing full images */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 flex items-center gap-2"
                        >
                            <X className="w-6 h-6" />
                            <span>Close</span>
                        </button>
                        <div className="text-center mb-2">
                            <span className="text-white text-lg font-medium">{lightboxImage.label}</span>
                        </div>
                        <img
                            src={lightboxImage.url}
                            alt={lightboxImage.label}
                            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default function CalendarPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
            <CalendarPageContent />
        </Suspense>
    )
}
