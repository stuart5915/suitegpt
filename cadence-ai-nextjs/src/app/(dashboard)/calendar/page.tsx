'use client'

import { useState, useEffect } from 'react'
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
    Trash2
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

interface DayData {
    date: string
    posts: ContentItem[]
    isCurrentMonth: boolean
    isToday: boolean
}

export default function CalendarPage() {
    const searchParams = useSearchParams()
    const supabase = createClient()

    const projectIdParam = searchParams.get('project')

    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<string | null>(projectIdParam)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [content, setContent] = useState<ContentItem[]>([])
    const [expandedDay, setExpandedDay] = useState<string | null>(null)
    const [draggedPost, setDraggedPost] = useState<ContentItem | null>(null)
    const [dragOverDate, setDragOverDate] = useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ postId: string; title: string } | null>(null)
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)

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
    }, [selectedProject, currentDate])

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
                .in('status', ['approved', 'scheduled', 'posted']) // Only show approved content
                .gte('scheduled_date', formatLocalDate(startDate))
                .lte('scheduled_date', formatLocalDate(endDate))
                .order('scheduled_date')
                .order('scheduled_time')

            setContent(data || [])
        } catch (err) {
            console.error('Failed to load content:', err)
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
            days.push({
                date: dateStr,
                posts: content.filter(c => c.scheduled_date === dateStr),
                isCurrentMonth: current.getMonth() === month,
                isToday: dateStr === today,
            })
            current.setDate(current.getDate() + 1)
        }

        return days
    }

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
                        const hasContent = day.posts.length > 0
                        const isExpanded = expandedDay === day.date
                        const isDragOver = dragOverDate === day.date

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

                                {/* Post Indicators */}
                                {hasContent && (
                                    <div className="space-y-1">
                                        {day.posts.slice(0, 3).map(post => {
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
                                                    className={`group text-xs px-1.5 py-0.5 rounded flex items-center gap-1 cursor-grab active:cursor-grabbing ${post.status === 'approved' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                                                        post.status === 'scheduled' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' :
                                                            'bg-[var(--surface)] text-[var(--foreground-muted)]'
                                                        }`}
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
                                        {day.posts.length > 3 && (
                                            <div className="text-xs text-[var(--foreground-muted)] px-1.5">
                                                +{day.posts.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

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
                            {calendarDays.find(d => d.date === expandedDay)?.posts.map(post => {
                                return (
                                    <div key={post.id} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <PlatformIcon platform={post.platform} size={18} />
                                            <span className="text-sm font-medium text-[var(--foreground)]">{PLATFORM_NAMES[post.platform] || post.platform}</span>
                                            <span className="text-xs text-[var(--foreground-muted)]">{post.scheduled_time?.slice(0, 5)}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${post.status === 'approved' ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--surface-border)] text-[var(--foreground-muted)]'
                                                }`}>
                                                {post.status}
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
        </div>
    )
}
