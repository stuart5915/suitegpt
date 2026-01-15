'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    Target,
    Save,
    Loader2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    FolderOpen,
    X,
    Wand2,
    Trash2,
    Info,
    Sparkles,
    Plus
} from 'lucide-react'
import { Project } from '@/lib/supabase/types'

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Theme palette with colors, icons, and AI descriptions
const THEMES = [
    { id: 'motivation', label: 'Motivation', emoji: '🎯', color: '#f97316', desc: 'Inspirational quotes, success stories, Monday energy' },
    { id: 'tips', label: 'Tips & Tutorials', emoji: '📚', color: '#3b82f6', desc: 'How-to guides, pro tips, educational content' },
    { id: 'behind', label: 'Behind Scenes', emoji: '🎬', color: '#8b5cf6', desc: 'Team life, office culture, making-of content' },
    { id: 'thought', label: 'Thought Leadership', emoji: '💡', color: '#eab308', desc: 'Industry insights, opinions, expert commentary' },
    { id: 'community', label: 'Community', emoji: '👥', color: '#22c55e', desc: 'User stories, Q&A, engagement & discussions' },
    { id: 'product', label: 'Product Focus', emoji: '🚀', color: '#ec4899', desc: 'Features, updates, demos, use cases' },
    { id: 'lifestyle', label: 'Lifestyle', emoji: '✨', color: '#06b6d4', desc: 'Casual vibes, personal stories, weekend content' },
    { id: 'promo', label: 'Promo/Sale', emoji: '🔥', color: '#ef4444', desc: 'Offers, discounts, limited-time deals' },
]

// Default weekly pattern
const DEFAULT_PATTERN: Record<number, string> = {
    0: 'motivation', // Monday
    1: 'tips',
    2: 'behind',
    3: 'thought',
    4: 'community',
    5: 'lifestyle',
    6: 'motivation',
}

export default function StrategyPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()

    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showProjectDropdown, setShowProjectDropdown] = useState(false)

    // Calendar state
    const [viewMonth, setViewMonth] = useState<Date | null>(null)

    // Selected brush theme
    const [activeBrush, setActiveBrush] = useState<string | null>(null)

    // Day->Theme mapping (dateString -> themeId)
    const [dayThemes, setDayThemes] = useState<Record<string, string>>({})

    // Drag state
    const [draggedTheme, setDraggedTheme] = useState<string | null>(null)
    const [dragOverDate, setDragOverDate] = useState<string | null>(null)

    // Custom themes
    type CustomTheme = { id: string; label: string; emoji: string; color: string; desc: string }
    const [customThemes, setCustomThemes] = useState<CustomTheme[]>([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newTheme, setNewTheme] = useState({ label: '', emoji: '⭐', color: '#6366f1', desc: '' })
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [generatingDesc, setGeneratingDesc] = useState(false)

    // Common emojis for themes
    const COMMON_EMOJIS = ['⭐', '🚀', '💡', '🎯', '🔥', '✨', '📚', '🎬', '👥', '🎉', '💬', '📸', '❤️', '🛠️', '🌟', '🌐', '🏆', '📈', '🎁', '📝', '🔑', '💼', '🎨', '🎓']

    // Generate description with AI
    const generateAIDescription = async () => {
        if (!newTheme.label.trim() || !selectedProject) return
        setGeneratingDesc(true)
        try {
            const response = await fetch('/api/ai/generate-theme-desc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    themeName: newTheme.label,
                    projectName: selectedProject.name,
                    projectDescription: selectedProject.description,
                    brandVoice: selectedProject.brand_voice,
                    targetAudience: selectedProject.target_audience
                })
            })
            const data = await response.json()
            if (data.description) {
                setNewTheme(prev => ({ ...prev, desc: data.description }))
            }
        } catch (error) {
            console.error('Failed to generate description:', error)
        }
        setGeneratingDesc(false)
    }

    // Combine default + custom themes
    const allThemes = [...THEMES, ...customThemes]

    useEffect(() => {
        setViewMonth(new Date())
    }, [])

    useEffect(() => {
        async function loadProjects() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: projectsData } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false })

            if (projectsData) {
                setProjects(projectsData)
                const projectId = searchParams.get('projectId')
                const project = projectId ? projectsData.find(p => p.id === projectId) : projectsData[0]

                if (project) {
                    setSelectedProject(project)
                    // Load saved day themes
                    if (project.posting_schedule?.day_themes) {
                        setDayThemes(project.posting_schedule.day_themes)
                    }
                    // Load custom themes
                    if (project.posting_schedule?.custom_themes) {
                        setCustomThemes(project.posting_schedule.custom_themes)
                    }
                }
            }
            setLoading(false)
        }
        loadProjects()
    }, [supabase, router, searchParams])

    // Auto-save after changes (debounced)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const hasInitialLoadRef = useRef(false)

    useEffect(() => {
        // Skip initial load
        if (!hasInitialLoadRef.current) {
            if (selectedProject) hasInitialLoadRef.current = true
            return
        }
        if (!selectedProject) return

        // Debounce save - wait 1 second after last change
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(async () => {
            setSaving(true)
            const updatedSchedule = {
                ...selectedProject.posting_schedule,
                day_themes: dayThemes,
                custom_themes: customThemes
            }
            await supabase.from('projects').update({ posting_schedule: updatedSchedule }).eq('id', selectedProject.id)
            setSelectedProject(prev => prev ? { ...prev, posting_schedule: updatedSchedule } : null)
            setSaving(false)
        }, 1000)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [dayThemes, customThemes, selectedProject?.id])

    // Create a new custom theme
    const handleCreateTheme = () => {
        if (!newTheme.label.trim()) return
        const id = `custom_${Date.now()}`
        const theme: CustomTheme = {
            id,
            label: newTheme.label,
            emoji: newTheme.emoji,
            color: newTheme.color,
            desc: newTheme.desc || `Custom theme: ${newTheme.label}`
        }
        setCustomThemes(prev => [...prev, theme])
        setNewTheme({ label: '', emoji: '⭐', color: '#6366f1', desc: '' })
        setShowCreateModal(false)
    }

    // Delete a custom theme
    const handleDeleteCustomTheme = (themeId: string) => {
        setCustomThemes(prev => prev.filter(t => t.id !== themeId))
    }

    // Apply weekly pattern for the current month
    const applyWeeklyPattern = () => {
        if (!viewMonth) return
        const year = viewMonth.getFullYear()
        const month = viewMonth.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const newThemes: Record<string, string> = { ...dayThemes }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d)
            const dayOfWeek = (date.getDay() + 6) % 7 // Monday = 0
            const dateStr = date.toISOString().split('T')[0]
            newThemes[dateStr] = DEFAULT_PATTERN[dayOfWeek]
        }
        setDayThemes(newThemes)
    }

    // Clear all themes for current month
    const clearMonth = () => {
        if (!viewMonth) return
        const year = viewMonth.getFullYear()
        const month = viewMonth.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const newThemes = { ...dayThemes }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            delete newThemes[dateStr]
        }
        setDayThemes(newThemes)
    }

    // Handle clicking a day
    const handleDayClick = (dateStr: string) => {
        if (activeBrush) {
            // Paint with active brush
            setDayThemes(prev => ({ ...prev, [dateStr]: activeBrush }))
        }
    }

    // Remove theme from day
    const handleRemoveTheme = (dateStr: string) => {
        setDayThemes(prev => {
            const next = { ...prev }
            delete next[dateStr]
            return next
        })
    }

    // Fill next empty day with a theme (for click-to-fill)
    const fillNextEmptyDay = (themeId: string) => {
        if (!viewMonth) return
        const year = viewMonth.getFullYear()
        const month = viewMonth.getMonth()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        // Find first empty day from today onwards
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d)
            if (date < today) continue // Skip past days
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            if (!dayThemes[dateStr]) {
                setDayThemes(prev => ({ ...prev, [dateStr]: themeId }))
                return
            }
        }
        // If no empty day found in current month, could show a message
    }

    // Generate calendar grid
    const generateCalendarDays = () => {
        if (!viewMonth) return []

        const year = viewMonth.getFullYear()
        const month = viewMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const startOffset = (firstDay.getDay() + 6) % 7
        const daysInMonth = lastDay.getDate()

        const cells: { date: number; dateStr: string }[] = []

        for (let i = 0; i < startOffset; i++) {
            cells.push({ date: 0, dateStr: '' })
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            cells.push({ date: d, dateStr })
        }

        return cells
    }

    if (loading || !viewMonth) {
        return (
            <div className="min-h-screen p-6 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    const calendarDays = generateCalendarDays()

    return (
        <>
            <div className="min-h-screen p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-[var(--primary)]" />
                        <h1 className="text-xl font-bold text-[var(--foreground)]">Content Strategy</h1>
                        {saving ? (
                            <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            <span className="text-xs text-green-500">✓ Auto-saved</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Project Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-sm cursor-pointer"
                            >
                                <FolderOpen className="w-4 h-4" />
                                {selectedProject?.name || 'Select'}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showProjectDropdown && (
                                <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg shadow-xl z-50">
                                    {projects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProject(p)
                                                if (p.posting_schedule?.day_themes) {
                                                    setDayThemes(p.posting_schedule.day_themes)
                                                } else {
                                                    setDayThemes({})
                                                }
                                                setShowProjectDropdown(false)
                                                router.push(`/strategy?projectId=${p.id}`)
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface)] cursor-pointer flex justify-between"
                                        >
                                            {p.name}
                                            {selectedProject?.id === p.id && <Check className="w-4 h-4 text-[var(--primary)]" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {selectedProject && (
                    <>
                        {/* Instructions */}
                        <div className="card p-3 mb-4 bg-[var(--primary)]/5 border-[var(--primary)]/20">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-[var(--foreground)]">
                                    <strong>Plan your content themes:</strong> Click or drag themes onto calendar days. When you generate content, the AI will create posts matching each day's theme.
                                </p>
                            </div>
                        </div>

                        {/* Theme Palette */}
                        <div className="card p-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-[var(--foreground)]">
                                    {activeBrush ? '🖌️ Click calendar days to apply theme' : '👆 Select a theme to paint'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={applyWeeklyPattern}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded-lg hover:opacity-90 cursor-pointer"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        AI Auto-fill
                                    </button>
                                    <button
                                        onClick={clearMonth}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--foreground-muted)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {allThemes.map(theme => {
                                    const isCustom = theme.id.startsWith('custom_')
                                    return (
                                        <div key={theme.id} className="relative group/pill">
                                            <div
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', theme.id)
                                                    setDraggedTheme(theme.id)
                                                }}
                                                onDragEnd={() => setDraggedTheme(null)}
                                                onClick={() => fillNextEmptyDay(theme.id)}
                                                title={`Click to add to next empty day`}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-grab select-none ${activeBrush === theme.id
                                                    ? 'ring-2 ring-offset-2 ring-[var(--primary)] scale-105'
                                                    : 'hover:scale-102 hover:shadow-md'
                                                    } ${draggedTheme === theme.id ? 'opacity-50 cursor-grabbing' : ''}`}
                                                style={{
                                                    background: `${theme.color}20`,
                                                    color: theme.color,
                                                    borderLeft: `3px solid ${theme.color}`
                                                }}
                                            >
                                                <span>{theme.emoji}</span>
                                                <span>{theme.label}</span>
                                                <Info className="w-3 h-3 opacity-50" />
                                                {isCustom && (
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDeleteCustomTheme(theme.id)
                                                        }}
                                                        className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 cursor-pointer"
                                                        title="Delete custom theme"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </div>
                                            {/* Tooltip on hover */}
                                            <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg shadow-xl text-xs text-[var(--foreground-muted)] opacity-0 invisible group-hover/pill:opacity-100 group-hover/pill:visible transition-all z-20">
                                                <strong style={{ color: theme.color }}>{theme.label}</strong>
                                                {isCustom && <span className="ml-1 text-[10px] opacity-60">(Custom)</span>}
                                                <p className="mt-1">{theme.desc}</p>
                                                <p className="mt-1 text-[10px] opacity-60">Click to add • Drag to place</p>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Create Theme Button */}
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-[var(--surface-border)] text-[var(--foreground-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Create Theme</span>
                                </button>
                            </div>
                        </div>

                        {/* Calendar */}
                        <div className="card p-4">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setViewMonth(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : new Date())}
                                    className="p-1 hover:bg-[var(--surface)] rounded cursor-pointer"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <h2 className="text-lg font-semibold">
                                    {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h2>
                                <button
                                    onClick={() => setViewMonth(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : new Date())}
                                    className="p-1 hover:bg-[var(--surface)] rounded cursor-pointer"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {DAYS_SHORT.map(day => (
                                    <div key={day} className="text-center text-xs font-medium text-[var(--foreground-muted)] py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((cell, idx) => {
                                    if (cell.date === 0) {
                                        return <div key={idx} className="h-20 bg-[var(--surface)]/30 rounded" />
                                    }

                                    const theme = allThemes.find(t => t.id === dayThemes[cell.dateStr])
                                    const today = new Date().toISOString().split('T')[0]
                                    const isToday = cell.dateStr === today

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleDayClick(cell.dateStr)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnter={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setDragOverDate(cell.dateStr)
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                // Only clear if actually leaving the cell (not entering a child)
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                const x = e.clientX
                                                const y = e.clientY
                                                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                                    setDragOverDate(null)
                                                }
                                            }}
                                            onDrop={() => {
                                                if (draggedTheme) {
                                                    setDayThemes(prev => ({ ...prev, [cell.dateStr]: draggedTheme }))
                                                    setDragOverDate(null)
                                                }
                                            }}
                                            className={`h-20 p-1.5 rounded transition-all cursor-pointer relative group ${theme
                                                ? ''
                                                : isToday
                                                    ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                                                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                                                } ${activeBrush ? 'hover:ring-2 hover:ring-[var(--primary)]' : ''} ${dragOverDate === cell.dateStr ? 'ring-2 ring-[var(--primary)] bg-[var(--primary)]/20 scale-105 z-10' : ''}`}
                                            style={theme ? {
                                                background: dragOverDate === cell.dateStr ? `var(--primary)` : `${theme.color}15`,
                                                borderLeft: `3px solid ${theme.color}`,
                                                opacity: dragOverDate === cell.dateStr ? 0.7 : 1
                                            } : {}}
                                        >
                                            <div className={`text-xs font-medium ${isToday ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                                                {cell.date}
                                            </div>
                                            {theme ? (
                                                <div className="mt-1 relative">
                                                    <span className="text-lg">{theme.emoji}</span>
                                                    <div className="text-[10px] font-medium truncate" style={{ color: theme.color }}>
                                                        {theme.label}
                                                    </div>
                                                    {/* X button - absolute positioned center-right */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleRemoveTheme(cell.dateStr)
                                                        }}
                                                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-2 rounded-full bg-red-500/10 hover:bg-red-500/30 cursor-pointer transition-all"
                                                        title="Remove theme"
                                                    >
                                                        <X className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-[var(--foreground-muted)]/50 mt-2 opacity-0 group-hover:opacity-100">
                                                    Click to add
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create Theme Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-[var(--background)] rounded-xl p-6 w-full max-w-md shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Create Custom Theme</h3>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-1 hover:bg-[var(--surface)] rounded cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Theme Name */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Theme Name</label>
                                    <input
                                        type="text"
                                        value={newTheme.label}
                                        onChange={(e) => setNewTheme(prev => ({ ...prev, label: e.target.value }))}
                                        placeholder="e.g., Case Study, User Spotlight"
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm"
                                    />
                                </div>

                                {/* Emoji & Color Row */}
                                <div className="flex gap-4">
                                    <div className="flex-1 relative">
                                        <label className="block text-sm font-medium mb-1">Emoji</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-2xl text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                                        >
                                            {newTheme.emoji}
                                        </button>
                                        {/* Emoji Picker Dropdown */}
                                        {showEmojiPicker && (
                                            <div className="absolute top-full left-0 mt-1 p-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg shadow-xl z-30 grid grid-cols-6 gap-1 w-48">
                                                {COMMON_EMOJIS.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewTheme(prev => ({ ...prev, emoji }))
                                                            setShowEmojiPicker(false)
                                                        }}
                                                        className="text-xl p-1 rounded hover:bg-[var(--surface)] cursor-pointer transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={newTheme.color}
                                                onChange={(e) => setNewTheme(prev => ({ ...prev, color: e.target.value }))}
                                                className="w-12 h-10 rounded cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={newTheme.color}
                                                onChange={(e) => setNewTheme(prev => ({ ...prev, color: e.target.value }))}
                                                className="flex-1 px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium">Description (for AI)</label>
                                        <button
                                            type="button"
                                            onClick={generateAIDescription}
                                            disabled={!newTheme.label.trim() || generatingDesc}
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded hover:bg-[var(--primary)]/20 cursor-pointer disabled:opacity-50 transition-colors"
                                        >
                                            {generatingDesc ? (
                                                <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                                            ) : (
                                                <><Sparkles className="w-3 h-3" /> AI Generate</>
                                            )}
                                        </button>
                                    </div>
                                    <textarea
                                        value={newTheme.desc}
                                        onChange={(e) => setNewTheme(prev => ({ ...prev, desc: e.target.value }))}
                                        placeholder="Describe what content the AI should generate for this theme..."
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm h-20 resize-none"
                                    />
                                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                        This helps the AI understand what type of content to create
                                    </p>
                                </div>

                                {/* Preview */}
                                {newTheme.label && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Preview</label>
                                        <div
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                                            style={{
                                                background: `${newTheme.color}20`,
                                                color: newTheme.color,
                                                borderLeft: `3px solid ${newTheme.color}`
                                            }}
                                        >
                                            <span>{newTheme.emoji}</span>
                                            <span>{newTheme.label}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateTheme}
                                    disabled={!newTheme.label.trim()}
                                    className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 cursor-pointer disabled:opacity-50"
                                >
                                    Create Theme
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </>
    )
}
