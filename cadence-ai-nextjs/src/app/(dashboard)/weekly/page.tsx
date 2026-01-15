'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
    Sparkles,
    Calendar,
    Check,
    X,
    Copy,
    Loader2,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    Clock,
    FolderOpen,
    Trash2,
    AlertTriangle,
    Settings,
    Sliders,
    Newspaper,
    Plus,
    CalendarDays,
    Upload,
    Image as ImageIcon,
    Video,
    Edit3,
    Play,
    Film
} from 'lucide-react'
import { Project, PLATFORM_CONFIG, Platform } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'
import { VideoPreviewPlayer } from '@/components/ui/VideoPreviewPlayer'

// Platform-specific content types based on actual platform capabilities
const PLATFORM_CONTENT_TYPES: Record<string, { value: string; label: string; requiresMedia: boolean }[]> = {
    instagram: [
        { value: 'image', label: 'Image Post', requiresMedia: true },
        { value: 'carousel', label: 'Carousel', requiresMedia: true },
        { value: 'video_script', label: 'Reel/Video', requiresMedia: true },
        { value: 'story', label: 'Story', requiresMedia: true },
    ],
    x: [
        { value: 'text', label: 'Text Tweet', requiresMedia: false },
        { value: 'image', label: 'Image Tweet', requiresMedia: true },
        { value: 'video_script', label: 'Video', requiresMedia: true },
        { value: 'thread', label: 'Thread', requiresMedia: false },
    ],
    linkedin: [
        { value: 'text', label: 'Text Post', requiresMedia: false },
        { value: 'image', label: 'Image Post', requiresMedia: true },
        { value: 'carousel', label: 'Document/Carousel', requiresMedia: true },
        { value: 'video_script', label: 'Video', requiresMedia: true },
    ],
    tiktok: [
        { value: 'video_script', label: 'Video', requiresMedia: true },
    ],
    youtube: [
        { value: 'video_script', label: 'Long-form Video', requiresMedia: true },
        { value: 'short', label: 'YouTube Short', requiresMedia: true },
        { value: 'live_prompt', label: 'Live/Premiere', requiresMedia: true },
    ],
}

// Theme definitions (same as strategy page)
const THEMES = [
    { id: 'motivation', emoji: '🎯', label: 'Motivation', color: '#f59e0b', desc: 'Inspirational quotes, success stories, Monday energy' },
    { id: 'tips', emoji: '📚', label: 'Tips & Tutorials', color: '#3b82f6', desc: 'How-to guides, pro tips, educational content' },
    { id: 'behindscenes', emoji: '🎬', label: 'Behind the Scenes', color: '#8b5cf6', desc: 'Day-in-the-life, process reveals, authentic moments' },
    { id: 'community', emoji: '👥', label: 'Community', color: '#ec4899', desc: 'User-generated content, testimonials, shoutouts' },
    { id: 'promo', emoji: '🔥', label: 'Promo / Sale', color: '#ef4444', desc: 'Product launches, limited offers, CTAs' },
    { id: 'engagement', emoji: '💬', label: 'Engagement', color: '#10b981', desc: 'Polls, questions, debates, conversation starters' },
    { id: 'product', emoji: '📸', label: 'Product Focus', color: '#06b6d4', desc: 'Product photos, features, use cases' },
    { id: 'storytelling', emoji: '✨', label: 'Storytelling', color: '#f97316', desc: 'Brand stories, customer journeys, narratives' },
]


interface Post {
    id: string
    platform: string
    contentType: string
    title: string
    content: string
    suggestedTime: string
    hashtags: string[]
    notes?: string
    status: 'pending' | 'approved' | 'rejected'
    projectId: string
    mediaUrls?: string[]
    mediaPrompt?: string
}

interface DayContent {
    day: string
    date: string
    posts: Post[]
}

interface WeekContent {
    weekOf: string
    weeklyPlanId?: string
    projectId: string
    projectName: string
    days: DayContent[]
}

export default function WeeklyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const projectIdParam = searchParams.get('project')
    const autoGenerate = searchParams.get('autoGenerate') === 'true'

    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [generatingDay, setGeneratingDay] = useState<string | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState<string | null>(projectIdParam)
    const [weekContent, setWeekContent] = useState<WeekContent | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expandedDay, setExpandedDay] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [deletingDay, setDeletingDay] = useState<string | null>(null)
    const [deletingWeek, setDeletingWeek] = useState(false)
    const [abortController, setAbortController] = useState<AbortController | null>(null)

    // Generation settings
    const [showSettings, setShowSettings] = useState(false)
    const [showWeekSettings, setShowWeekSettings] = useState(false)
    const [postsPerDay, setPostsPerDay] = useState(3)
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
    const [selectedContentType, setSelectedContentType] = useState<string>('') // '' = all types
    const [topicalPercent, setTopicalPercent] = useState(0) // 0-85%, 0 = all evergreen
    const [videoDuration, setVideoDuration] = useState<'quick' | 'standard' | 'extended'>('standard')

    // Content mix - array of {platform, contentType, includeNews} for targeted generation
    const [contentMix, setContentMix] = useState<{ platform: string, contentType: string, includeNews?: boolean }[]>([])
    const MAX_CONTENT_MIX = 10 // Max posts per day
    const MAX_TOTAL_POSTS = 70 // Max total posts per generation
    const [topicGuidance, setTopicGuidance] = useState('') // Optional topic/context for AI

    // Advanced generation options
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
    const [selectedTone, setSelectedTone] = useState<string>('') // professional, casual, funny, etc.
    const [selectedCTA, setSelectedCTA] = useState<string>('') // comment, share, link, buy, signup, save
    const [selectedHook, setSelectedHook] = useState<string>('') // how-to, reasons, truth, stop, secret
    const [contentLength, setContentLength] = useState<'punchy' | 'detailed'>('punchy')
    const [engagementGoal, setEngagementGoal] = useState<string>('') // reach, engagement, clicks, saves
    const [referencePost, setReferencePost] = useState('') // Example post to emulate

    // Option definitions with tooltips
    const TONE_OPTIONS = [
        { value: 'professional', label: 'Professional', emoji: '👔', tip: 'Polished, authoritative, industry-focused' },
        { value: 'casual', label: 'Casual', emoji: '😎', tip: 'Conversational, friendly, relatable' },
        { value: 'funny', label: 'Funny', emoji: '😂', tip: 'Humorous, witty, playful language' },
        { value: 'inspirational', label: 'Inspirational', emoji: '✨', tip: 'Uplifting, motivational, encouraging' },
        { value: 'educational', label: 'Educational', emoji: '📚', tip: 'Teach concepts, share valuable insights' },
        { value: 'promotional', label: 'Promotional', emoji: '📣', tip: 'Sales-focused, highlight benefits, create urgency' },
    ]
    const CTA_OPTIONS = [
        { value: 'comment', label: 'Comment', emoji: '💬', tip: 'Ask questions, start discussions' },
        { value: 'share', label: 'Share', emoji: '↗️', tip: 'Create shareable, relatable content' },
        { value: 'link', label: 'Visit Link', emoji: '🔗', tip: 'Tease content to drive link clicks' },
        { value: 'buy', label: 'Buy Now', emoji: '🛒', tip: 'Create urgency and show benefits' },
        { value: 'signup', label: 'Sign Up', emoji: '📧', tip: 'Highlight value proposition' },
        { value: 'save', label: 'Save', emoji: '💾', tip: 'Create reference-worthy tips/guides' },
    ]
    const HOOK_OPTIONS = [
        { value: 'how-to', label: 'How to...', emoji: '🎯', tip: 'Step-by-step guides and tutorials' },
        { value: 'reasons', label: 'X reasons why...', emoji: '📋', tip: 'Listicle with numbered points' },

        { value: 'truth', label: 'The truth about...', emoji: '💡', tip: 'Myth-busting and contrarian takes' },
        { value: 'stop', label: 'Stop doing X...', emoji: '🛑', tip: 'Identify mistakes and provide solutions' },
        { value: 'secret', label: 'What nobody tells you...', emoji: '🤫', tip: 'Share insider knowledge' },
        { value: 'mistake', label: 'The #1 mistake...', emoji: '❌', tip: 'Call out common errors' },
    ]
    const GOAL_OPTIONS = [
        { value: 'reach', label: 'Reach', emoji: '📢', tip: 'Maximize views - use trending topics and broad appeal' },
        { value: 'engagement', label: 'Engagement', emoji: '💬', tip: 'Drive comments & reactions - ask questions, spark debate' },
        { value: 'clicks', label: 'Clicks', emoji: '👆', tip: 'Get link clicks - use curiosity gaps' },
        { value: 'saves', label: 'Saves', emoji: '💾', tip: 'Encourage saves - create reference-worthy guides' },
    ]

    // Flexible generation options
    const [showDayPicker, setShowDayPicker] = useState(false)
    const [selectedDays, setSelectedDays] = useState<string[]>([])
    const [calendarMonth, setCalendarMonth] = useState(new Date()) // For month navigation
    const [showManualModal, setShowManualModal] = useState(false)
    const [manualContent, setManualContent] = useState({
        platform: 'instagram',
        contentType: 'image',
        caption: '',
        hashtags: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '10:00'
    })
    const [mediaFile, setMediaFile] = useState<File | null>(null)
    const [mediaPreview, setMediaPreview] = useState<string | null>(null)
    const [uploadingMedia, setUploadingMedia] = useState(false)
    const [threadPosts, setThreadPosts] = useState<string[]>(['', '']) // For X threads
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Post editing
    const [editingPost, setEditingPost] = useState<Post | null>(null)
    const [editForm, setEditForm] = useState({
        title: '',
        content: '',
        hashtags: '',
        suggestedTime: '',
        videoTemplate: 'hook_reveal' // For video content
    })
    const [savingEdit, setSavingEdit] = useState(false)
    const [showVideoPreview, setShowVideoPreview] = useState(false)
    const [exportingVideo, setExportingVideo] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [generatingVeoVideo, setGeneratingVeoVideo] = useState(false)
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null)
    const [themePickerOpen, setThemePickerOpen] = useState<string | null>(null) // Which day's theme picker is open

    // Image generation state
    const [generatingImage, setGeneratingImage] = useState(false)
    const [imagePrompt, setImagePrompt] = useState('')
    const [imageStyle, setImageStyle] = useState<'vibrant' | 'minimal' | 'professional' | 'creative' | 'lifestyle'>('vibrant')
    const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard')
    const [showImageOptions, setShowImageOptions] = useState(false)


    // Get next 7 days for day picker
    const getNext7Days = () => {
        const days = []
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        for (let i = 0; i < 7; i++) {
            const date = new Date()
            date.setDate(date.getDate() + i)
            days.push({
                name: dayNames[date.getDay()],
                date: date.toISOString().split('T')[0],
                label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[date.getDay()]
            })
        }
        return days
    }

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

                // Auto-select project logic:
                // 1. If projectIdParam is specified and valid, use it
                // 2. If only one project exists, auto-select it
                // 3. Otherwise, let user choose
                if (projectIdParam && data?.some(p => p.id === projectIdParam)) {
                    setSelectedProject(projectIdParam)
                } else if (data && data.length === 1) {
                    // Auto-select the only project
                    setSelectedProject(data[0].id)
                }
            } catch (err) {
                console.error('Error loading projects:', err)
            } finally {
                setLoading(false)
            }
        }
        loadProjects()
    }, [supabase, projectIdParam])

    // Load saved content when project selected
    useEffect(() => {
        if (selectedProject && !autoGenerate) {
            loadSavedContent()
        }
    }, [selectedProject])

    // Auto-generate if param is set
    useEffect(() => {
        if (autoGenerate && selectedProject && !generating && !weekContent && !loading) {
            generateWeek()
        }
    }, [autoGenerate, selectedProject, loading])

    const loadSavedContent = async () => {
        if (!selectedProject) return

        try {
            const res = await fetch(`/api/weekly?projectId=${selectedProject}`)
            const data = await res.json()

            if (data.exists) {
                setWeekContent(data)
                if (data.days?.length > 0) {
                    setExpandedDay(data.days[0].day)
                }
            }
        } catch (err) {
            console.error('Failed to load saved content:', err)
        }
    }

    const generateWeek = async () => {
        if (!selectedProject) {
            setError('Please select a project first')
            return
        }

        const controller = new AbortController()
        setAbortController(controller)
        setGenerating(true)
        setError(null)

        try {
            const res = await fetch('/api/ai/generate-week', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject,
                    postsPerDay,
                    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
                    includeTopical: topicalPercent > 0,
                    topicalPercent,
                    videoDuration,
                }),
                signal: controller.signal,
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setWeekContent(data)
            if (data.days?.length > 0) {
                setExpandedDay(data.days[0].day)
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Generation cancelled')
            } else {
                console.error('Generate error:', err)
                setError(err.message || 'Failed to generate content')
            }
        } finally {
            setGenerating(false)
            setAbortController(null)
        }
    }

    const cancelGeneration = () => {
        if (abortController) {
            abortController.abort()
        }
    }

    // Generate content for specific selected days
    const generateSelectedDays = async () => {
        if (!selectedProject || selectedDays.length === 0 || contentMix.length === 0) return

        setGenerating(true)
        setError(null)
        setShowDayPicker(false)

        try {
            // Generate for each selected day
            for (const dayDate of selectedDays) {
                const dayName = new Date(dayDate).toLocaleDateString('en-US', { weekday: 'long' })

                const res = await fetch('/api/ai/generate-week', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: selectedProject,
                        specificDay: dayName,
                        contentMix: contentMix,
                        topicGuidance: topicGuidance || undefined,
                        videoDuration,
                        // Advanced options
                        tone: selectedTone || undefined,
                        cta: selectedCTA || undefined,
                        hookStyle: selectedHook || undefined,
                        contentLength,
                        engagementGoal: engagementGoal || undefined,
                        referencePost: referencePost || undefined,
                    }),
                })


                const data = await res.json()
                if (!res.ok) throw new Error(data.error)

                setWeekContent(data)
                // Expand the first day that was generated
                if (data.days?.length > 0) {
                    setExpandedDay(data.days[0].day)
                }
            }

            setSelectedDays([])
            setContentMix([]) // Clear the mix after generation

            // Show success toast
            setSuccessMessage(`Content generated successfully!`)
            setTimeout(() => setSuccessMessage(null), 4000)

            // Scroll to content section
            setTimeout(() => {
                document.getElementById('week-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
        } catch (err: any) {
            console.error('Generate error:', err)
            setError(err.message || 'Failed to generate content')
        } finally {
            setGenerating(false)
        }
    }

    // Save manually created content
    const saveManualContent = async () => {
        if (!selectedProject || !manualContent.caption.trim()) return

        try {
            // Create a weekly plan if needed
            const weekStart = new Date().toISOString().split('T')[0]

            let weeklyPlanId: string
            const { data: existingPlan } = await supabase
                .from('weekly_plans')
                .select('id')
                .eq('project_id', selectedProject)
                .eq('week_start', weekStart)
                .single()

            if (existingPlan) {
                weeklyPlanId = existingPlan.id
            } else {
                const { data: newPlan, error: planError } = await supabase
                    .from('weekly_plans')
                    .insert({
                        project_id: selectedProject,
                        week_start: weekStart,
                        status: 'draft',
                    })
                    .select('id')
                    .single()

                if (planError || !newPlan) throw planError
                weeklyPlanId = newPlan.id
            }

            // Insert the content item
            const { error: insertError } = await supabase
                .from('content_items')
                .insert({
                    weekly_plan_id: weeklyPlanId,
                    project_id: selectedProject,
                    scheduled_date: manualContent.scheduledDate,
                    scheduled_time: `${manualContent.scheduledTime}:00`,
                    platform: manualContent.platform,
                    content_type: manualContent.contentType,
                    caption: manualContent.caption,
                    hashtags: manualContent.hashtags.split(/[,\s]+/).filter(h => h.trim()),
                    status: 'draft',
                    ai_reasoning: 'Manual post',
                })

            if (insertError) throw insertError

            // Reset form and close modal
            setManualContent({
                platform: 'instagram',
                contentType: 'text',
                caption: '',
                hashtags: '',
                scheduledDate: new Date().toISOString().split('T')[0],
                scheduledTime: '10:00'
            })
            setShowManualModal(false)

            // Reload content
            loadSavedContent()
        } catch (err) {
            console.error('Failed to save manual content:', err)
            setError('Failed to save content')
        }
    }

    const regenerateDay = async (day: string) => {
        if (!selectedProject) return

        setGeneratingDay(day)
        setError(null)

        try {
            const res = await fetch('/api/ai/generate-week', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProject, specificDay: day }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setWeekContent(data)
            setExpandedDay(day)
        } catch (err: any) {
            console.error('Regenerate day error:', err)
            setError(err.message || 'Failed to regenerate day')
        } finally {
            setGeneratingDay(null)
        }
    }

    const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null)

    const regeneratePost = async (postId: string, day: string, platform: string) => {
        if (!selectedProject) return

        setRegeneratingPost(postId)
        setError(null)

        try {
            const res = await fetch('/api/ai/generate-week', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject,
                    specificDay: day,
                    regeneratePostId: postId,
                    platform: platform,
                    postsPerDay: 1
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Update just this post in the week content
            if (weekContent && data.days) {
                const newPost = data.days.find((d: DayContent) => d.day === day)?.posts?.[0]
                if (newPost) {
                    setWeekContent({
                        ...weekContent,
                        days: weekContent.days.map(d =>
                            d.day === day
                                ? { ...d, posts: d.posts.map(p => p.id === postId ? { ...newPost, id: postId } : p) }
                                : d
                        )
                    })
                }
            }
        } catch (err: any) {
            console.error('Regenerate post error:', err)
            setError(err.message || 'Failed to regenerate post')
        } finally {
            setRegeneratingPost(null)
        }
    }

    const deleteDay = async (day: string) => {
        if (!selectedProject || !confirm(`Delete all content for ${day}?`)) return

        setDeletingDay(day)

        try {
            const res = await fetch(`/api/weekly?projectId=${selectedProject}&day=${day}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete')

            // Update local state
            if (weekContent) {
                setWeekContent({
                    ...weekContent,
                    days: weekContent.days.map(d =>
                        d.day === day ? { ...d, posts: [] } : d
                    ),
                })
            }
        } catch (err: any) {
            console.error('Delete day error:', err)
            setError(err.message || 'Failed to delete day')
        } finally {
            setDeletingDay(null)
        }
    }

    const deleteWeek = async () => {
        if (!selectedProject) return

        setDeletingWeek(true)

        try {
            const res = await fetch(`/api/weekly?projectId=${selectedProject}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete')

            setWeekContent(null)
        } catch (err: any) {
            console.error('Delete week error:', err)
            setError(err.message || 'Failed to delete week')
        } finally {
            setDeletingWeek(false)
        }
    }

    const updatePostStatus = async (postId: string, status: 'approved' | 'rejected' | 'pending') => {
        if (!weekContent) return

        // Optimistic update
        setWeekContent({
            ...weekContent,
            days: weekContent.days.map(day => ({
                ...day,
                posts: day.posts.map(post =>
                    post.id === postId ? { ...post, status } : post
                )
            }))
        })

        // Save to database
        try {
            await fetch('/api/weekly', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, status }),
            })
        } catch (err) {
            console.error('Failed to update status:', err)
        }
    }

    const copyContent = async (post: Post) => {
        const text = `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
        await navigator.clipboard.writeText(text)
        setCopiedId(post.id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Open edit modal for a post
    const openEditModal = (post: Post) => {
        setEditingPost(post)
        setEditForm({
            title: post.title,
            content: post.content,
            hashtags: post.hashtags.join(', '),
            suggestedTime: post.suggestedTime,
            videoTemplate: 'hook_reveal'
        })
    }

    // Save edited post
    const savePostEdit = async () => {
        if (!editingPost) return

        setSavingEdit(true)
        try {
            // Update in database
            await supabase
                .from('content_items')
                .update({
                    caption: editForm.content,
                    hashtags: editForm.hashtags.split(/[,\s]+/).filter(h => h.trim()),
                    scheduled_time: editForm.suggestedTime + ':00',
                })
                .eq('id', editingPost.id)

            // Update local state
            setWeekContent(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    days: prev.days.map(day => ({
                        ...day,
                        posts: day.posts.map(post =>
                            post.id === editingPost.id
                                ? {
                                    ...post,
                                    title: editForm.title,
                                    content: editForm.content,
                                    hashtags: editForm.hashtags.split(/[,\s]+/).filter(h => h.trim()),
                                    suggestedTime: editForm.suggestedTime
                                }
                                : post
                        )
                    }))
                }
            })

            setSuccessMessage('Post updated!')
            setTimeout(() => setSuccessMessage(null), 3000)
            setEditingPost(null)
        } catch (err) {
            console.error('Failed to save edit:', err)
            setError('Failed to save changes')
        } finally {
            setSavingEdit(false)
        }
    }

    // Export video for video content types
    const exportVideo = async () => {
        if (!editingPost) return

        setExportingVideo(true)
        try {
            // Parse content into frames
            const content = editForm.content || ''
            const hookMatch = content.match(/\[HOOK[^\]]*\][:\s]*([^\[\n]+)/i)
            const problemMatch = content.match(/\[PROBLEM[^\]]*\][:\s]*([^\[\n]+)/i)
            const solutionMatch = content.match(/\[SOLUTION[^\]]*\][:\s]*([^\[\n]+)/i)
            const ctaMatch = content.match(/\[CTA[^\]]*\][:\s]*([^\[\n]+)/i)
            const lines = content.split('\n').filter(l => l.trim() && !l.match(/^\[/))

            const frames = [
                { label: 'HOOK', text: hookMatch?.[1]?.trim() || lines[0] || editForm.title || 'Hook...' },
                { label: 'POINT', text: problemMatch?.[1]?.trim() || lines[1] || 'Main point...' },
                { label: 'PROOF', text: solutionMatch?.[1]?.trim() || lines[2] || 'Supporting detail...' },
                { label: 'CTA', text: ctaMatch?.[1]?.trim() || 'Follow for more!' },
            ]

            // Determine animation style from template
            const animationMap: Record<string, string> = {
                hook_reveal: 'zoom',
                list_tips: 'slide',
                quote_style: 'fade',
                kinetic_text: 'kinetic',
            }

            const res = await fetch('/api/video/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frames,
                    style: 'gradient',
                    animationStyle: animationMap[editForm.videoTemplate] || 'zoom',
                    duration: videoDuration,
                }),
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to render video')
            }

            // Download the video
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${editForm.title.replace(/[^a-z0-9]/gi, '_')}-video.mp4`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setSuccessMessage('Video exported!')
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            console.error('Export error:', err)
            setError(err.message || 'Failed to export video')
        } finally {
            setExportingVideo(false)
        }
    }

    // Generate video background with Veo AI
    const generateVeoVideo = async () => {
        if (!editingPost) return

        setGeneratingVeoVideo(true)
        setGeneratedVideoUrl(null)

        try {
            // Create a visual prompt from the content
            const visualPrompt = `Cinematic abstract background video for a social media short. 
Dark moody aesthetic with subtle motion. Floating particles, soft gradients, and gentle light rays. 
Professional, modern, suitable for overlaying white text. 
Style: Minimal, elegant, corporate. 
Camera: Slow dolly forward. 
Lighting: Purple and blue accent lights on dark background.
No text, no people, just abstract visuals.`

            const res = await fetch('/api/video/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: visualPrompt,
                    model: 'veo-2',
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate video')
            }

            if (data.video?.uri) {
                setGeneratedVideoUrl(data.video.uri)
                setSuccessMessage('Video generated!')
            }
        } catch (err: any) {
            console.error('Veo generation error:', err)
            setError(err.message || 'Failed to generate video')
        } finally {
            setGeneratingVeoVideo(false)
        }
    }

    // Generate image for content post using AI
    const generateImageForPost = async () => {
        if (!editingPost || !selectedProject) return

        setGeneratingImage(true)
        setError(null)

        try {
            // Create a smart image prompt based on the post content
            const autoPrompt = imagePrompt.trim() ||
                `Social media image for: ${editingPost.title}. Context: ${editingPost.content.slice(0, 200)}`

            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: autoPrompt,
                    projectId: selectedProject,
                    contentItemId: editingPost.id,
                    style: imageStyle,
                    quality: imageQuality,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate image')
            }

            // Update local state with the new image
            setWeekContent(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    days: prev.days.map(day => ({
                        ...day,
                        posts: day.posts.map(post =>
                            post.id === editingPost.id
                                ? {
                                    ...post,
                                    mediaUrls: [...(post.mediaUrls || []), data.url],
                                    mediaPrompt: autoPrompt
                                }
                                : post
                        )
                    }))
                }
            })

            // Update the editing post too
            setEditingPost(prev => prev ? {
                ...prev,
                mediaUrls: [...(prev.mediaUrls || []), data.url],
                mediaPrompt: autoPrompt
            } : null)

            setSuccessMessage('Image generated!')
            setTimeout(() => setSuccessMessage(null), 3000)
            setImagePrompt('')
            setShowImageOptions(false)
        } catch (err: any) {
            console.error('Image generation error:', err)
            setError(err.message || 'Failed to generate image')
        } finally {
            setGeneratingImage(false)
        }
    }

    // Upload image for content post
    const uploadImageForPost = async (file: File) => {
        if (!editingPost || !selectedProject) return

        setGeneratingImage(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('projectId', selectedProject)

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to upload image')
            }

            // Update the content item in database
            await supabase
                .from('content_items')
                .update({
                    media_urls: supabase.rpc('array_append', {
                        arr: editingPost.mediaUrls || [],
                        elem: data.url
                    })
                })
                .eq('id', editingPost.id)

            // Update local state
            setWeekContent(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    days: prev.days.map(day => ({
                        ...day,
                        posts: day.posts.map(post =>
                            post.id === editingPost.id
                                ? { ...post, mediaUrls: [...(post.mediaUrls || []), data.url] }
                                : post
                        )
                    }))
                }
            })

            setEditingPost(prev => prev ? {
                ...prev,
                mediaUrls: [...(prev.mediaUrls || []), data.url]
            } : null)

            setSuccessMessage('Image uploaded!')
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            console.error('Upload error:', err)
            setError(err.message || 'Failed to upload image')
        } finally {
            setGeneratingImage(false)
        }
    }


    const selectedProjectData = projects.find(p => p.id === selectedProject)
    const totalPosts = weekContent?.days.reduce((acc, d) => acc + d.posts.length, 0) || 0

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    if (projects.length === 0) {
        return (
            <div className="min-h-screen p-8 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-[var(--surface)] flex items-center justify-center mb-6">
                    <FolderOpen className="w-10 h-10 text-[var(--foreground-muted)]" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">No Projects Yet</h2>
                <p className="text-[var(--foreground-muted)] text-center max-w-md mb-8">
                    Create a project first to generate weekly content.
                </p>
                <Link href="/projects/new" className="btn btn-primary">
                    Create Your First Project
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header with Project Selector */}
            <header className="mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-[var(--primary)]" />
                            Content Hub
                        </h1>
                        <p className="text-[var(--foreground-muted)] mt-1">
                            Generate AI content or create posts manually
                        </p>
                    </div>

                    {/* Project Dropdown */}
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedProject || ''}
                            onChange={(e) => {
                                const projectId = e.target.value
                                if (projectId) {
                                    setSelectedProject(projectId)
                                    const proj = projects.find(p => p.id === projectId)
                                    setSelectedPlatforms(proj?.platforms || [])
                                    setWeekContent(null)
                                    setTimeout(() => loadSavedContent(), 100)
                                } else {
                                    setSelectedProject(null)
                                    setWeekContent(null)
                                }
                            }}
                            className="px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] font-medium min-w-[200px]"
                        >
                            <option value="">Select a project...</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {/* No Project Selected - Show Prompt */}
            {!selectedProject && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 flex items-center justify-center mb-6">
                        <Sparkles className="w-12 h-12 text-[var(--primary)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Choose a Project</h2>
                    <p className="text-[var(--foreground-muted)] text-center max-w-md mb-8">
                        Select a project above to generate AI content, create posts manually, or review your scheduled content.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {projects.slice(0, 3).map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedProject(p.id)
                                    setSelectedPlatforms(p.platforms || [])
                                    setTimeout(() => loadSavedContent(), 100)
                                }}
                                className="px-6 py-3 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all cursor-pointer flex items-center gap-3"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold">
                                    {p.name.charAt(0)}
                                </div>
                                <span className="font-medium text-[var(--foreground)]">{p.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Project Selected - Show Action Cards & Content */}
            {selectedProject && (
                <>
                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Generate Content (was Generate Days) */}
                        <button
                            onClick={() => {
                                setShowDayPicker(!showDayPicker)
                                setShowWeekSettings(false)
                                if (!showDayPicker) setSelectedDays([])
                            }}
                            disabled={generating}
                            className={`card p-5 text-left transition-all cursor-pointer group disabled:opacity-50 ${showDayPicker
                                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                : 'hover:border-[var(--primary)] hover:bg-[var(--primary)]/5'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showDayPicker
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--primary)]/10 text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white'
                                    }`}>
                                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[var(--foreground)]">Generate Content</h3>
                                    <p className="text-xs text-[var(--foreground-muted)]">AI creates posts for selected days</p>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform ${showDayPicker ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {/* Create Manually */}
                        <button
                            onClick={() => setShowManualModal(true)}
                            className="card p-5 text-left hover:border-[var(--success)] hover:bg-[var(--success)]/5 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center group-hover:bg-[var(--success)] group-hover:text-white transition-all">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[var(--foreground)]">Create Manually</h3>
                                    <p className="text-xs text-[var(--foreground-muted)]">Write your own post</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Inline Content Generation Panel */}
                    {showDayPicker && (
                        <div className="card p-5 mb-6 border-[var(--primary)]/30 bg-gradient-to-r from-[var(--primary)]/5 to-transparent animate-in slide-in-from-top-2 duration-200">
                            {/* Two-Column Grid Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* LEFT: Calendar Date Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
                                            <h4 className="font-medium text-[var(--foreground)]">Select Days</h4>
                                            {selectedDays.length > 0 && (
                                                <span className="text-xs bg-[var(--primary)] text-white px-2 py-0.5 rounded-full">
                                                    {selectedDays.length} day{selectedDays.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    // Select next 7 days from today
                                                    const dates: string[] = []
                                                    for (let i = 0; i < 7; i++) {
                                                        const d = new Date()
                                                        d.setDate(d.getDate() + i)
                                                        dates.push(d.toISOString().split('T')[0])
                                                    }
                                                    setSelectedDays(dates)
                                                }}
                                                className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
                                            >
                                                Next 7 Days
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Select all days in current view month
                                                    const year = calendarMonth.getFullYear()
                                                    const month = calendarMonth.getMonth()
                                                    const daysInMonth = new Date(year, month + 1, 0).getDate()
                                                    const today = new Date().toISOString().split('T')[0]
                                                    const dates: string[] = []
                                                    for (let day = 1; day <= daysInMonth; day++) {
                                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                                        if (dateStr >= today) dates.push(dateStr)
                                                    }
                                                    setSelectedDays(dates.slice(0, 31)) // Limit to 31 days
                                                }}
                                                className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
                                            >
                                                This Month
                                            </button>
                                            {selectedDays.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedDays([])}
                                                    className="text-xs text-[var(--error)] hover:underline cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mini Calendar */}
                                    <div className="bg-[var(--surface)] rounded-lg p-3">
                                        {/* Month Navigation */}
                                        <div className="flex items-center justify-between mb-3">
                                            <button
                                                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                                className="p-1 rounded hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-[var(--foreground-muted)]" />
                                            </button>
                                            <span className="font-medium text-[var(--foreground)]">
                                                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </span>
                                            <button
                                                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                                className="p-1 rounded hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5 text-[var(--foreground-muted)]" />
                                            </button>
                                        </div>

                                        {/* Day of Week Headers */}
                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                <div key={day} className="text-center text-xs text-[var(--foreground-muted)] font-medium py-1">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Calendar Grid */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {(() => {
                                                const year = calendarMonth.getFullYear()
                                                const month = calendarMonth.getMonth()
                                                const firstDay = new Date(year, month, 1).getDay()
                                                const daysInMonth = new Date(year, month + 1, 0).getDate()
                                                const today = new Date().toISOString().split('T')[0]

                                                const cells = []

                                                // Empty cells for days before month starts
                                                for (let i = 0; i < firstDay; i++) {
                                                    cells.push(<div key={`empty-${i}`} className="h-9" />)
                                                }

                                                // Day cells
                                                for (let day = 1; day <= daysInMonth; day++) {
                                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                                    const isSelected = selectedDays.includes(dateStr)
                                                    const isPast = dateStr < today
                                                    const isToday = dateStr === today

                                                    // Get theme for this day from current project
                                                    const currentProject = projects.find(p => p.id === selectedProject)
                                                    const dayThemeId = currentProject?.posting_schedule?.day_themes?.[dateStr]
                                                    const customThemes = currentProject?.posting_schedule?.custom_themes || []
                                                    const allThemes = [...THEMES, ...customThemes]
                                                    const dayTheme = dayThemeId ? allThemes.find(t => t.id === dayThemeId) : null

                                                    cells.push(
                                                        <button
                                                            key={dateStr}
                                                            onClick={() => {
                                                                if (isPast) return
                                                                setSelectedDays(prev =>
                                                                    isSelected
                                                                        ? prev.filter(d => d !== dateStr)
                                                                        : [...prev, dateStr]
                                                                )
                                                            }}
                                                            disabled={isPast}
                                                            title={dayTheme ? `${dayTheme.emoji} ${dayTheme.label}: ${dayTheme.desc}` : undefined}
                                                            className={`h-9 rounded-lg text-sm font-medium transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : isPast
                                                                    ? 'text-[var(--foreground-muted)]/30 cursor-not-allowed'
                                                                    : isToday
                                                                        ? 'bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30'
                                                                        : dayTheme
                                                                            ? 'hover:bg-[var(--surface-hover)]'
                                                                            : 'text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                                                                }`}
                                                            style={dayTheme && !isSelected && !isPast ? {
                                                                borderBottom: `2px solid ${dayTheme.color}`,
                                                            } : undefined}
                                                        >
                                                            <span>{day}</span>
                                                            {dayTheme && !isPast && (
                                                                <span className={`text-[8px] ${isSelected ? 'opacity-80' : ''}`} style={{ color: isSelected ? 'white' : dayTheme.color }}>
                                                                    {dayTheme.emoji}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )
                                                }

                                                return cells
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: Generation Settings - Always visible */}
                                <div className={`${selectedDays.length === 0 ? 'opacity-50' : ''}`}>

                                    <div className="flex items-center gap-2 mb-3">
                                        <Sliders className="w-4 h-4 text-[var(--primary)]" />
                                        <h4 className="font-medium text-[var(--foreground)]">Generation Settings</h4>
                                        {selectedDays.length > 0 && (
                                            <span className="text-xs bg-[var(--primary)] text-white px-2 py-0.5 rounded-full">
                                                {selectedDays.length} day{selectedDays.length > 1 ? 's' : ''} × {contentMix.length || '?'} posts = {selectedDays.length * (contentMix.length || 1)} total
                                            </span>
                                        )}
                                        {selectedDays.length * contentMix.length > MAX_TOTAL_POSTS && (
                                            <span className="text-xs bg-[var(--warning)] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Max {MAX_TOTAL_POSTS}
                                            </span>
                                        )}
                                    </div>

                                    {/* Selected Days with Themes */}
                                    {selectedDays.length > 0 && (
                                        <div className="mb-4 bg-[var(--surface)] rounded-lg p-3">
                                            <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Selected Days & Themes <span className="text-[var(--foreground-muted)]/60">(click to change)</span></label>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedDays.sort().map(dateStr => {
                                                    const currentProject = projects.find(p => p.id === selectedProject)
                                                    const dayThemeId = currentProject?.posting_schedule?.day_themes?.[dateStr]
                                                    const customThemes = currentProject?.posting_schedule?.custom_themes || []
                                                    const allThemes = [...THEMES, ...customThemes]
                                                    const dayTheme = dayThemeId ? allThemes.find(t => t.id === dayThemeId) : null
                                                    const date = new Date(dateStr + 'T12:00:00')
                                                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                                                    const dayNum = date.getDate()
                                                    const isPickerOpen = themePickerOpen === dateStr

                                                    const handleSetTheme = async (themeId: string | null) => {
                                                        setThemePickerOpen(null)
                                                        if (!selectedProject || !currentProject) return

                                                        const currentDayThemes = currentProject.posting_schedule?.day_themes || {}
                                                        const updatedDayThemes = { ...currentDayThemes }

                                                        if (themeId) {
                                                            updatedDayThemes[dateStr] = themeId
                                                        } else {
                                                            delete updatedDayThemes[dateStr]
                                                        }

                                                        // Update in database
                                                        const { error } = await supabase
                                                            .from('projects')
                                                            .update({
                                                                posting_schedule: {
                                                                    ...currentProject.posting_schedule,
                                                                    day_themes: updatedDayThemes
                                                                }
                                                            })
                                                            .eq('id', selectedProject)

                                                        if (!error) {
                                                            // Update local state
                                                            setProjects(prev => prev.map(p =>
                                                                p.id === selectedProject
                                                                    ? {
                                                                        ...p,
                                                                        posting_schedule: {
                                                                            ...p.posting_schedule,
                                                                            day_themes: updatedDayThemes
                                                                        }
                                                                    }
                                                                    : p
                                                            ))
                                                        }
                                                    }

                                                    return (
                                                        <div key={dateStr} className="relative">
                                                            <button
                                                                onClick={() => setThemePickerOpen(isPickerOpen ? null : dateStr)}
                                                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs cursor-pointer hover:scale-105 transition-all"
                                                                style={{
                                                                    backgroundColor: dayTheme ? `${dayTheme.color}20` : 'var(--background)',
                                                                    border: `1px solid ${dayTheme ? dayTheme.color : 'var(--surface-border)'}`
                                                                }}
                                                            >
                                                                <span className="font-medium text-[var(--foreground)]">{dayName} {dayNum}</span>
                                                                {dayTheme ? (
                                                                    <span style={{ color: dayTheme.color }} className="flex items-center gap-1">
                                                                        <span>{dayTheme.emoji}</span>
                                                                        <span className="font-medium">{dayTheme.label}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[var(--foreground-muted)]">+ Add theme</span>
                                                                )}
                                                                <ChevronDown className={`w-3 h-3 text-[var(--foreground-muted)] transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {/* Remove button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setSelectedDays(prev => prev.filter(d => d !== dateStr))
                                                                }}
                                                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--error)] text-white flex items-center justify-center hover:scale-110 transition-all cursor-pointer"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>

                                                            {/* Theme Picker Dropdown */}
                                                            {isPickerOpen && (
                                                                <div className="absolute top-full left-0 mt-1 z-20 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg shadow-xl p-2 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-150">
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {/* Clear theme option */}
                                                                        <button
                                                                            onClick={() => handleSetTheme(null)}
                                                                            className="px-2 py-1 rounded-full text-xs bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] cursor-pointer transition-all"
                                                                        >
                                                                            ✕ Clear
                                                                        </button>
                                                                        {allThemes.map(theme => (
                                                                            <button
                                                                                key={theme.id}
                                                                                onClick={() => handleSetTheme(theme.id)}
                                                                                className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 ${dayTheme?.id === theme.id ? 'ring-2 ring-offset-1' : ''
                                                                                    }`}
                                                                                style={{
                                                                                    backgroundColor: `${theme.color}20`,
                                                                                    color: theme.color,
                                                                                    borderColor: theme.color
                                                                                }}
                                                                            >
                                                                                {theme.emoji} {theme.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content Mix Builder */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-[var(--foreground-muted)]">Build your content mix</label>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${contentMix.length >= MAX_CONTENT_MIX ? 'bg-[var(--warning)] text-white' : 'bg-[var(--surface)] text-[var(--foreground-muted)]'}`}>
                                                    {contentMix.length}/{MAX_CONTENT_MIX}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {contentMix.length < MAX_CONTENT_MIX && (
                                                    <button
                                                        onClick={() => {
                                                            // Collect all content types and shuffle randomly
                                                            const allItems: { platform: string, contentType: string }[] = []
                                                            Object.entries(PLATFORM_CONTENT_TYPES).forEach(([platform, types]) => {
                                                                types.forEach(type => {
                                                                    allItems.push({ platform, contentType: type.value })
                                                                })
                                                            })
                                                            // Fisher-Yates shuffle
                                                            for (let i = allItems.length - 1; i > 0; i--) {
                                                                const j = Math.floor(Math.random() * (i + 1));
                                                                [allItems[i], allItems[j]] = [allItems[j], allItems[i]]
                                                            }
                                                            setContentMix(allItems.slice(0, MAX_CONTENT_MIX))
                                                        }}
                                                        className="text-xs text-[var(--secondary)] hover:underline cursor-pointer"
                                                    >
                                                        Random Mix
                                                    </button>
                                                )}
                                                {contentMix.length >= MAX_CONTENT_MIX && (
                                                    <button
                                                        onClick={() => {
                                                            // Re-shuffle with new random selection
                                                            const allItems: { platform: string, contentType: string }[] = []
                                                            Object.entries(PLATFORM_CONTENT_TYPES).forEach(([platform, types]) => {
                                                                types.forEach(type => {
                                                                    allItems.push({ platform, contentType: type.value })
                                                                })
                                                            })
                                                            for (let i = allItems.length - 1; i > 0; i--) {
                                                                const j = Math.floor(Math.random() * (i + 1));
                                                                [allItems[i], allItems[j]] = [allItems[j], allItems[i]]
                                                            }
                                                            setContentMix(allItems.slice(0, MAX_CONTENT_MIX))
                                                        }}
                                                        className="text-xs text-[var(--secondary)] hover:underline cursor-pointer flex items-center gap-1"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        Shuffle
                                                    </button>
                                                )}
                                                {contentMix.length > 0 && (
                                                    <button
                                                        onClick={() => setContentMix([])}
                                                        className="text-xs text-[var(--error)] hover:underline cursor-pointer"
                                                    >
                                                        Clear All
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Platform buttons with content type dropdowns */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {Object.entries(PLATFORM_CONTENT_TYPES).map(([platform, contentTypes]) => {
                                                const isAtLimit = contentMix.length >= MAX_CONTENT_MIX
                                                return (
                                                    <div key={platform} className="relative group">
                                                        <button
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${isAtLimit
                                                                ? 'bg-[var(--surface)] text-[var(--foreground-muted)]/50 cursor-not-allowed'
                                                                : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--secondary)] hover:text-white cursor-pointer'
                                                                }`}
                                                        >
                                                            <PlatformIcon platform={platform} size={14} />
                                                            {PLATFORM_NAMES[platform as keyof typeof PLATFORM_NAMES] || platform}
                                                            <ChevronDown className="w-3 h-3" />
                                                        </button>
                                                        {/* Dropdown on hover - only if not at limit */}
                                                        {!isAtLimit && (
                                                            <div className="absolute top-full left-0 mt-1 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg shadow-xl z-10 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                                                {contentTypes.map(type => {
                                                                    const count = contentMix.filter(i => i.platform === platform && i.contentType === type.value).length
                                                                    return (
                                                                        <button
                                                                            key={type.value}
                                                                            onClick={() => {
                                                                                if (contentMix.length < MAX_CONTENT_MIX) {
                                                                                    setContentMix(prev => [...prev, { platform, contentType: type.value }])
                                                                                }
                                                                            }}
                                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface)] transition-all cursor-pointer flex items-center justify-between"
                                                                        >
                                                                            <span>{type.label}</span>
                                                                            {count > 0 && (
                                                                                <span className="text-xs bg-[var(--secondary)] text-white px-1.5 py-0.5 rounded-full">{count}</span>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Current content mix display */}
                                        {contentMix.length > 0 ? (
                                            <div className="bg-[var(--surface)] rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-[var(--foreground)]">Your content mix:</span>
                                                        <span className="text-xs bg-[var(--secondary)] text-white px-2 py-0.5 rounded-full">{contentMix.length} post{contentMix.length > 1 ? 's' : ''}</span>
                                                    </div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)]">Click 📰 to toggle news</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {contentMix.map((item, idx) => {
                                                        const label = PLATFORM_CONTENT_TYPES[item.platform]?.find(ct => ct.value === item.contentType)?.label || item.contentType
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all ${item.includeNews
                                                                    ? 'bg-[var(--warning)]/20 border border-[var(--warning)]/50'
                                                                    : 'bg-[var(--secondary)]/20 border border-transparent'
                                                                    }`}
                                                            >
                                                                <PlatformIcon platform={item.platform} size={14} />
                                                                <span className="text-[var(--foreground)] font-medium">{label}</span>

                                                                {/* News toggle button */}
                                                                <button
                                                                    onClick={() => setContentMix(prev => prev.map((p, i) =>
                                                                        i === idx ? { ...p, includeNews: !p.includeNews } : p
                                                                    ))}
                                                                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-all ${item.includeNews
                                                                        ? 'bg-[var(--warning)] text-white hover:bg-[var(--warning)]/80'
                                                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--warning)]/30 hover:text-[var(--warning)]'
                                                                        }`}
                                                                    title={item.includeNews ? 'Click to remove news focus' : 'Click to include current news/trends'}
                                                                >
                                                                    📰 {item.includeNews ? 'News' : ''}
                                                                </button>

                                                                {/* Remove button */}
                                                                <button
                                                                    onClick={() => setContentMix(prev => prev.filter((_, i) => i !== idx))}
                                                                    className="hover:text-[var(--error)] cursor-pointer text-[var(--foreground-muted)]"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {contentMix.some(p => p.includeNews) && (
                                                    <div className="mt-2 text-[10px] text-[var(--warning)] flex items-center gap-1">
                                                        <Newspaper className="w-3 h-3" />
                                                        {contentMix.filter(p => p.includeNews).length} of {contentMix.length} post{contentMix.length > 1 ? 's' : ''} will include current news/trends
                                                    </div>
                                                )}
                                            </div>
                                        ) : (

                                            <div className="text-center py-4 text-sm text-[var(--foreground-muted)] bg-[var(--surface)] rounded-lg">
                                                <p>Hover over a platform and select content types to add</p>
                                                <p className="text-xs mt-1">Or use "Add All Types" for variety</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Topic Guidance */}
                                    <div className="mb-4">
                                        <label className="text-sm text-[var(--foreground-muted)] mb-2 block flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            Topic Guidance <span className="text-xs text-[var(--foreground-muted)]/60">(optional)</span>
                                        </label>
                                        <textarea
                                            value={topicGuidance}
                                            onChange={e => setTopicGuidance(e.target.value)}
                                            placeholder="What should this content be about? Leave empty and AI will decide based on your brand & past content..."
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] text-sm resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
                                            rows={2}
                                        />
                                    </div>

                                    {/* Advanced Options Toggle */}
                                    <button
                                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                                        className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-sm text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Sliders className="w-4 h-4" />
                                            Advanced Options
                                            {(selectedTone || selectedCTA || selectedHook || engagementGoal || referencePost) && (
                                                <span className="text-[10px] bg-[var(--primary)] text-white px-1.5 py-0.5 rounded-full">
                                                    {[selectedTone, selectedCTA, selectedHook, engagementGoal, referencePost].filter(Boolean).length} set
                                                </span>
                                            )}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Advanced Options Panel */}
                                    {showAdvancedOptions && (
                                        <div className="mb-4 p-4 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] space-y-4">
                                            {/* Tone Selector */}
                                            <div>
                                                <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Tone & Style</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {TONE_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setSelectedTone(selectedTone === opt.value ? '' : opt.value)}
                                                            data-tip={opt.tip}
                                                            className={`tooltip tooltip-bottom px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${selectedTone === opt.value
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--primary)]/20'
                                                                }`}
                                                        >
                                                            {opt.emoji} {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* CTA Selector */}
                                            <div>
                                                <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Call-to-Action</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {CTA_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setSelectedCTA(selectedCTA === opt.value ? '' : opt.value)}
                                                            data-tip={opt.tip}
                                                            className={`tooltip tooltip-bottom px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${selectedCTA === opt.value
                                                                ? 'bg-[var(--secondary)] text-white'
                                                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--secondary)]/20'
                                                                }`}
                                                        >
                                                            {opt.emoji} {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Hook Style Selector */}
                                            <div>
                                                <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Hook / Angle</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {HOOK_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setSelectedHook(selectedHook === opt.value ? '' : opt.value)}
                                                            data-tip={opt.tip}
                                                            className={`tooltip tooltip-bottom px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${selectedHook === opt.value
                                                                ? 'bg-[var(--warning)] text-white'
                                                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--warning)]/20'
                                                                }`}
                                                        >
                                                            {opt.emoji} {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Content Length & Goal Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Content Length */}
                                                <div>
                                                    <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Length</label>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setContentLength('punchy')}
                                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${contentLength === 'punchy'
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                                }`}
                                                        >
                                                            ⚡ Punchy
                                                        </button>
                                                        <button
                                                            onClick={() => setContentLength('detailed')}
                                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${contentLength === 'detailed'
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                                }`}
                                                        >
                                                            📝 Detailed
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Engagement Goal */}
                                                <div>
                                                    <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Optimize For</label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {GOAL_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setEngagementGoal(engagementGoal === opt.value ? '' : opt.value)}
                                                                data-tip={opt.tip}
                                                                className={`tooltip tooltip-bottom px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all ${engagementGoal === opt.value
                                                                    ? 'bg-[var(--success)] text-white'
                                                                    : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--success)]/20'
                                                                    }`}
                                                            >
                                                                {opt.emoji} {opt.label}
                                                            </button>
                                                        ))}

                                                    </div>
                                                </div>

                                            </div>

                                            {/* Reference Post */}
                                            <div>
                                                <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">Reference Post <span className="text-[var(--foreground-muted)]/60">(paste an example)</span></label>
                                                <textarea
                                                    value={referencePost}
                                                    onChange={e => setReferencePost(e.target.value)}
                                                    placeholder="Paste a post you like and want the AI to emulate the style of..."
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] text-xs resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Video Duration - only show if any video content in mix */}
                                    {(contentMix.length === 0 || contentMix.some(i => i.contentType === 'video_script' || i.contentType === 'short')) && (
                                        <div className="mb-4">
                                            <label className="text-sm text-[var(--foreground-muted)] mb-2 block flex items-center gap-2">
                                                <Film className="w-4 h-4" />
                                                Video Duration
                                            </label>
                                            <div className="flex gap-2">
                                                {[
                                                    { value: 'quick', label: '~15s', desc: 'Quick hook' },
                                                    { value: 'standard', label: '~60s', desc: 'Standard' },
                                                    { value: 'extended', label: '~3m', desc: 'In-depth' },
                                                ].map(option => (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => setVideoDuration(option.value as 'quick' | 'standard' | 'extended')}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${videoDuration === option.value
                                                            ? 'bg-[var(--primary)] text-white'
                                                            : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                            }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setShowDayPicker(false)
                                            generateSelectedDays()
                                        }}
                                        disabled={generating || (contentMix.length === 0) || (selectedDays.length === 0)}
                                        className="btn btn-primary w-full cursor-pointer disabled:opacity-50"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {selectedDays.length === 0
                                            ? 'Select days to generate'
                                            : `Generate ${contentMix.length > 0 ? `${contentMix.length} Post${contentMix.length > 1 ? 's' : ''}` : ''} for ${selectedDays.length} Day${selectedDays.length > 1 ? 's' : ''}`
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-[var(--error)]/10 text-[var(--error)] flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            {error}
                            <button onClick={() => setError(null)} className="ml-auto cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Success Toast */}
                    {successMessage && (
                        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <div className="bg-[var(--success)] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <Check className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">{successMessage}</p>
                                    <p className="text-sm text-white/80">Scroll down to view your content</p>
                                </div>
                                <button onClick={() => setSuccessMessage(null)} className="ml-4 p-1 hover:bg-white/10 rounded cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Generating State with Skeleton */}
                    {
                        generating && (
                            <div className="space-y-4">
                                <div className="card p-6 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10 border-[var(--primary)]/30">
                                    <div className="flex items-center gap-4">
                                        <div className="shrink-0 w-12 h-12 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                                            <Sparkles className="w-6 h-6 text-[var(--primary)] animate-pulse" />
                                        </div>
                                        <div className="flex-1">
                                            <h2 className="text-lg font-bold text-[var(--foreground)]">
                                                Generating Content for {selectedProjectData?.name}
                                            </h2>
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                This usually takes 15-30 seconds. Content will be saved automatically.
                                            </p>
                                        </div>
                                        <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                                    </div>
                                </div>

                                <div className="text-lg font-semibold text-[var(--foreground)] mb-2">Week Overview</div>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => (
                                    <div key={day} className="card overflow-hidden animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                                                    <span className="text-[var(--primary)] font-bold">{day.charAt(0)}</span>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-[var(--foreground)]">{day}</p>
                                                    <div className="h-3 w-16 bg-[var(--surface)] rounded mt-1" />
                                                </div>
                                            </div>
                                            <div className="h-4 w-12 bg-[var(--surface)] rounded" />
                                        </div>
                                    </div>
                                ))}

                                <div className="card p-4 bg-[var(--surface)] border-dashed">
                                    <p className="text-sm text-[var(--foreground-muted)] flex items-center gap-2">
                                        <span className="text-lg">💡</span>
                                        <span>Tip: Content will be saved and available when you return!</span>
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    {/* Week Content */}
                    {
                        weekContent && !generating && (
                            <div id="week-content" className="space-y-4 max-w-3xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                        Week of {weekContent.weekOf}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-[var(--foreground-muted)]">
                                            {totalPosts} posts
                                        </span>
                                        {totalPosts > 0 && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        // Approve all pending posts
                                                        weekContent.days.forEach(day => {
                                                            day.posts.forEach(post => {
                                                                if (post.status === 'pending') {
                                                                    updatePostStatus(post.id, 'approved')
                                                                }
                                                            })
                                                        })
                                                    }}
                                                    className="btn btn-primary text-xs cursor-pointer"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Approve All
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    disabled={deletingWeek}
                                                    className="btn btn-ghost text-[var(--error)] text-xs cursor-pointer"
                                                >
                                                    {deletingWeek ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3 h-3" />
                                                    )}
                                                    Delete All
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {weekContent.days.map((day) => (
                                    <div key={day.day} className="card overflow-hidden">
                                        <button
                                            onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${day.posts.length > 0
                                                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                                                    : 'bg-[var(--surface)] text-[var(--foreground-muted)]'
                                                    }`}>
                                                    {day.day.charAt(0)}
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-semibold text-[var(--foreground)]">{day.day}</p>
                                                    <p className="text-xs text-[var(--foreground-muted)]">{day.date}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm ${day.posts.length > 0 ? 'text-[var(--foreground-muted)]' : 'text-[var(--foreground-muted)]/50'}`}>
                                                    {day.posts.length} {day.posts.length === 1 ? 'post' : 'posts'}
                                                </span>
                                                <ChevronDown className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform ${expandedDay === day.day ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {expandedDay === day.day && (
                                            <div className="border-t border-[var(--surface-border)] p-4">
                                                {/* Day Actions */}
                                                <div className="flex items-center justify-end gap-2 mb-4">
                                                    <button
                                                        onClick={() => regenerateDay(day.day)}
                                                        disabled={generatingDay === day.day}
                                                        className="btn btn-ghost text-xs cursor-pointer"
                                                    >
                                                        {generatingDay === day.day ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="w-3 h-3" />
                                                        )}
                                                        Regenerate {day.day}
                                                    </button>
                                                    {day.posts.length > 0 && (
                                                        <button
                                                            onClick={() => deleteDay(day.day)}
                                                            disabled={deletingDay === day.day}
                                                            className="btn btn-ghost text-xs text-[var(--error)] cursor-pointer"
                                                        >
                                                            {deletingDay === day.day ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3 h-3" />
                                                            )}
                                                            Delete Day
                                                        </button>
                                                    )}
                                                </div>

                                                {day.posts.length === 0 ? (
                                                    <div className="text-center py-8 text-[var(--foreground-muted)]">
                                                        <p className="mb-2">No content for {day.day}</p>
                                                        <button
                                                            onClick={() => regenerateDay(day.day)}
                                                            disabled={generatingDay === day.day}
                                                            className="btn btn-secondary text-sm"
                                                        >
                                                            {generatingDay === day.day ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-4 h-4" />
                                                            )}
                                                            Generate Content
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                        {day.posts.map((post) => {
                                                            const platform = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG]

                                                            return (
                                                                <div
                                                                    key={post.id}
                                                                    onClick={() => openEditModal(post)}
                                                                    className={`p-3 rounded-lg border transition-all hover:shadow-md hover:scale-[1.02] flex flex-col h-full cursor-pointer ${post.status === 'approved'
                                                                        ? 'border-[var(--success)] bg-[var(--success)]/5'
                                                                        : post.status === 'rejected'
                                                                            ? 'border-[var(--error)] bg-[var(--error)]/5'
                                                                            : 'border-[var(--surface-border)] bg-[var(--background-elevated)]'
                                                                        }`}
                                                                >
                                                                    {/* Header row */}
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <PlatformIcon platform={post.platform} size={16} />
                                                                            <span className="text-xs text-[var(--foreground-muted)]">{post.suggestedTime}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-0.5">
                                                                            {post.status === 'pending' ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); updatePostStatus(post.id, 'approved') }}
                                                                                        className="p-1 rounded hover:bg-[var(--success)]/10 text-[var(--success)] cursor-pointer"
                                                                                        title="Approve"
                                                                                    >
                                                                                        <Check className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); updatePostStatus(post.id, 'rejected') }}
                                                                                        className="p-1 rounded hover:bg-[var(--error)]/10 text-[var(--error)] cursor-pointer"
                                                                                        title="Reject"
                                                                                    >
                                                                                        <X className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${post.status === 'approved'
                                                                                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                                                                                    : 'bg-[var(--error)]/20 text-[var(--error)]'
                                                                                    }`}>
                                                                                    {post.status === 'approved' ? (
                                                                                        <><Check className="w-3 h-3" /> Approved</>
                                                                                    ) : (
                                                                                        <><X className="w-3 h-3" /> Rejected</>
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Image Preview - for image content types */}
                                                                    {(post.contentType === 'image' || post.contentType === 'carousel' || post.contentType === 'story') && (
                                                                        <div className="mb-2">
                                                                            {post.mediaUrls && post.mediaUrls.length > 0 ? (
                                                                                <div className="aspect-video rounded-md overflow-hidden border border-[var(--surface-border)]">
                                                                                    <img
                                                                                        src={post.mediaUrls[0]}
                                                                                        alt={post.title}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                    {post.mediaUrls.length > 1 && (
                                                                                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                                                                                            +{post.mediaUrls.length - 1}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="aspect-video rounded-md border-2 border-dashed border-[var(--warning)]/50 bg-[var(--warning)]/5 flex flex-col items-center justify-center gap-1">
                                                                                    <ImageIcon className="w-5 h-5 text-[var(--warning)]" />
                                                                                    <span className="text-[10px] text-[var(--warning)]">No image</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Title */}
                                                                    <h4 className="font-medium text-sm text-[var(--foreground)] mb-1 line-clamp-1">{post.title}</h4>

                                                                    {/* Content preview - truncated */}
                                                                    <p className="text-xs text-[var(--foreground-muted)] line-clamp-3 mb-2 flex-1">{post.content}</p>

                                                                    {/* Hashtags - compact */}
                                                                    {post.hashtags && post.hashtags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                                            {post.hashtags.slice(0, 3).map((tag, i) => (
                                                                                <span key={i} className="text-[10px] text-[var(--primary)]">#{tag}</span>
                                                                            ))}
                                                                            {post.hashtags.length > 3 && (
                                                                                <span className="text-[10px] text-[var(--foreground-muted)]">+{post.hashtags.length - 3}</span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Generation Metadata Badges */}
                                                                    {(() => {
                                                                        // Try to parse generation metadata from media_prompt
                                                                        let genMeta: any = null
                                                                        try {
                                                                            if (post.notes && typeof post.notes === 'string') {
                                                                                const parsed = JSON.parse(post.notes)
                                                                                genMeta = parsed.generationMeta
                                                                            }
                                                                        } catch { /* not JSON - old format */ }

                                                                        // If no genMeta object exists at all, skip
                                                                        if (!genMeta) {
                                                                            return null
                                                                        }

                                                                        const badges = []
                                                                        if (genMeta.tone) {
                                                                            const toneEmoji: Record<string, string> = { professional: '👔', casual: '😎', funny: '😂', inspirational: '✨', educational: '📚', promotional: '📣' }
                                                                            badges.push({ emoji: toneEmoji[genMeta.tone] || '🎭', tip: `Tone: ${genMeta.tone}` })
                                                                        }
                                                                        if (genMeta.cta) {
                                                                            const ctaEmoji: Record<string, string> = { comment: '💬', share: '↗️', link: '🔗', buy: '🛒', signup: '📧', save: '💾' }
                                                                            badges.push({ emoji: ctaEmoji[genMeta.cta] || '🎯', tip: `CTA: ${genMeta.cta}` })
                                                                        }
                                                                        if (genMeta.hookStyle) {
                                                                            badges.push({ emoji: '🪝', tip: `Hook: ${genMeta.hookStyle}` })
                                                                        }
                                                                        if (genMeta.contentLength === 'detailed') {
                                                                            badges.push({ emoji: '📝', tip: 'Detailed/in-depth content' })
                                                                        }
                                                                        if (genMeta.engagementGoal) {
                                                                            const goalEmoji: Record<string, string> = { reach: '📢', engagement: '💬', clicks: '👆', saves: '💾' }
                                                                            badges.push({ emoji: goalEmoji[genMeta.engagementGoal] || '🎯', tip: `Goal: ${genMeta.engagementGoal}` })
                                                                        }
                                                                        if (genMeta.hasNews) {
                                                                            badges.push({ emoji: '📰', tip: 'Includes current news/trends' })
                                                                        }

                                                                        // If there are badges OR if we have genMeta (show a small indicator)
                                                                        if (badges.length === 0) {
                                                                            // Show subtle "AI generated" indicator for newer content
                                                                            return (
                                                                                <div className="gen-badges mb-2">
                                                                                    <span className="gen-badge tooltip tooltip-bottom opacity-50" data-tip="AI generated">
                                                                                        🤖
                                                                                    </span>
                                                                                </div>
                                                                            )
                                                                        }

                                                                        return (
                                                                            <div className="gen-badges mb-2">
                                                                                {badges.map((b, i) => (
                                                                                    <span key={i} className="gen-badge tooltip tooltip-bottom" data-tip={b.tip}>
                                                                                        {b.emoji}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )
                                                                    })()}

                                                                    {/* Action buttons - compact row */}
                                                                    <div className="flex items-center gap-1 pt-2 border-t border-[var(--surface-border)] mt-auto" onClick={e => e.stopPropagation()}>
                                                                        <button
                                                                            onClick={() => copyContent(post)}
                                                                            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--foreground-muted)] cursor-pointer"
                                                                            title="Copy"
                                                                        >
                                                                            {copiedId === post.id ? (
                                                                                <Check className="w-3 h-3 text-[var(--success)]" />
                                                                            ) : (
                                                                                <Copy className="w-3 h-3" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => regeneratePost(post.id, day.day, post.platform)}
                                                                            disabled={regeneratingPost === post.id}
                                                                            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--foreground-muted)] cursor-pointer"
                                                                            title="Regenerate"
                                                                        >
                                                                            {regeneratingPost === post.id ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                <RefreshCw className="w-3 h-3" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => openEditModal(post)}
                                                                            className="p-1.5 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)] cursor-pointer"
                                                                            title="Edit"
                                                                        >
                                                                            <Edit3 className="w-3 h-3" />
                                                                        </button>
                                                                        {post.status !== 'pending' && (
                                                                            <button
                                                                                onClick={() => updatePostStatus(post.id, 'pending')}
                                                                                className="ml-auto text-[10px] text-[var(--foreground-muted)] hover:underline cursor-pointer"
                                                                            >
                                                                                Reset
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Summary */}
                                <div className="card p-4 flex items-center justify-between">
                                    <div className="text-sm text-[var(--foreground-muted)]">
                                        {weekContent.days.reduce((acc, d) => acc + d.posts.filter(p => p.status === 'approved').length, 0)} approved •
                                        {weekContent.days.reduce((acc, d) => acc + d.posts.filter(p => p.status === 'rejected').length, 0)} rejected •
                                        {weekContent.days.reduce((acc, d) => acc + d.posts.filter(p => p.status === 'pending').length, 0)} pending
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (!weekContent) return
                                                weekContent.days.forEach(d => {
                                                    d.posts.forEach(p => updatePostStatus(p.id, 'approved'))
                                                })
                                            }}
                                            className="btn btn-ghost text-sm text-[var(--success)] cursor-pointer"
                                        >
                                            <Check className="w-4 h-4" /> Approve All
                                        </button>
                                        <Link href="/content" className="btn btn-primary text-sm">
                                            View Content Queue →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Empty/Ready State */}
                    {
                        selectedProject && !weekContent && !generating && (
                            <div className="card p-12 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--primary)]/10 mb-6">
                                    <Sparkles className="w-8 h-8 text-[var(--primary)]" />
                                </div>
                                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
                                    Ready to Generate Content
                                </h2>
                                <p className="text-[var(--foreground-muted)] mb-6">
                                    Click "Generate Week" to create AI-powered content for {selectedProjectData?.name}
                                </p>
                                <button onClick={generateWeek} className="btn btn-primary">
                                    <Sparkles className="w-4 h-4" /> Generate Week
                                </button>
                            </div>
                        )
                    }

                    {/* No Project Selected */}
                    {
                        !selectedProject && (
                            <div className="card p-12 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--surface)] mb-6">
                                    <Calendar className="w-8 h-8 text-[var(--foreground-muted)]" />
                                </div>
                                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Select a Project</h2>
                                <p className="text-[var(--foreground-muted)]">Choose a project above to start generating content</p>
                            </div>
                        )
                    }


                    {/* Manual Content Modal */}
                    {showManualModal && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowManualModal(false)}>
                            <div className="bg-[var(--background)] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="p-6">
                                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-[var(--primary)]" />
                                        Create Content Manually
                                    </h3>

                                    <div className="space-y-4">
                                        {/* Platform & Content Type */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Platform</label>
                                                <select
                                                    value={manualContent.platform}
                                                    onChange={e => {
                                                        const newPlatform = e.target.value
                                                        const availableTypes = PLATFORM_CONTENT_TYPES[newPlatform] || []
                                                        setManualContent(prev => ({
                                                            ...prev,
                                                            platform: newPlatform,
                                                            contentType: availableTypes[0]?.value || 'text'
                                                        }))
                                                    }}
                                                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                                >
                                                    <option value="instagram">Instagram</option>
                                                    <option value="x">X (Twitter)</option>
                                                    <option value="linkedin">LinkedIn</option>
                                                    <option value="tiktok">TikTok</option>
                                                    <option value="youtube">YouTube</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Type</label>
                                                <select
                                                    value={manualContent.contentType}
                                                    onChange={e => setManualContent(prev => ({ ...prev, contentType: e.target.value }))}
                                                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                                >
                                                    {(PLATFORM_CONTENT_TYPES[manualContent.platform] || []).map(type => (
                                                        <option key={type.value} value={type.value}>{type.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Media Upload */}
                                        {(PLATFORM_CONTENT_TYPES[manualContent.platform]?.find(t => t.value === manualContent.contentType)?.requiresMedia) && (
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Media</label>
                                                <div
                                                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${mediaPreview
                                                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                                        : 'border-[var(--surface-border)] hover:border-[var(--primary)]/50'
                                                        }`}
                                                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                                                    onDrop={e => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        const file = e.dataTransfer.files[0]
                                                        if (file) {
                                                            setMediaFile(file)
                                                            setMediaPreview(URL.createObjectURL(file))
                                                        }
                                                    }}
                                                >
                                                    {mediaPreview ? (
                                                        <div className="relative">
                                                            {mediaFile?.type.startsWith('video/') ? (
                                                                <video src={mediaPreview} className="max-h-40 mx-auto rounded" controls />
                                                            ) : (
                                                                <img src={mediaPreview} alt="Preview" className="max-h-40 mx-auto rounded" />
                                                            )}
                                                            <button
                                                                onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                                                                className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 cursor-pointer"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="cursor-pointer">
                                                            <input
                                                                type="file"
                                                                accept="image/*,video/*"
                                                                className="hidden"
                                                                onChange={e => {
                                                                    const file = e.target.files?.[0]
                                                                    if (file) {
                                                                        setMediaFile(file)
                                                                        setMediaPreview(URL.createObjectURL(file))
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="w-12 h-12 rounded-full bg-[var(--surface)] flex items-center justify-center">
                                                                    <Upload className="w-6 h-6 text-[var(--foreground-muted)]" />
                                                                </div>
                                                                <p className="text-sm text-[var(--foreground-muted)]">
                                                                    Drag & drop or <span className="text-[var(--primary)]">browse</span>
                                                                </p>
                                                                <p className="text-xs text-[var(--foreground-muted)]">
                                                                    Images or videos up to 50MB
                                                                </p>
                                                            </div>
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Caption / Thread Posts */}
                                        {manualContent.platform === 'x' && manualContent.contentType === 'thread' ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm text-[var(--foreground-muted)]">Thread Posts</label>
                                                    <button
                                                        onClick={() => setThreadPosts(prev => [...prev, ''])}
                                                        className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
                                                    >
                                                        + Add Post
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    {threadPosts.map((post, index) => (
                                                        <div key={index} className="relative">
                                                            <div className="absolute left-3 top-3 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center text-xs text-white font-medium">
                                                                {index + 1}
                                                            </div>
                                                            <textarea
                                                                value={post}
                                                                onChange={e => {
                                                                    const newPosts = [...threadPosts]
                                                                    newPosts[index] = e.target.value
                                                                    setThreadPosts(newPosts)
                                                                }}
                                                                placeholder={index === 0 ? "Start your thread..." : "Continue the thread..."}
                                                                rows={3}
                                                                maxLength={280}
                                                                className="w-full pl-10 pr-10 py-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 resize-none"
                                                            />
                                                            <div className="absolute right-3 bottom-3 text-xs text-[var(--foreground-muted)]">
                                                                {post.length}/280
                                                            </div>
                                                            {threadPosts.length > 2 && (
                                                                <button
                                                                    onClick={() => setThreadPosts(prev => prev.filter((_, i) => i !== index))}
                                                                    className="absolute right-3 top-3 p-1 hover:bg-[var(--error)]/10 rounded text-[var(--error)] cursor-pointer"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-[var(--foreground-muted)] mt-2">Each post is 280 characters max</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Caption</label>
                                                <textarea
                                                    value={manualContent.caption}
                                                    onChange={e => setManualContent(prev => ({ ...prev, caption: e.target.value }))}
                                                    placeholder="Write your content here..."
                                                    rows={4}
                                                    className="w-full p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 resize-none"
                                                />
                                            </div>
                                        )}

                                        {/* Hashtags */}
                                        <div>
                                            <label className="block text-sm text-[var(--foreground-muted)] mb-1">Hashtags</label>
                                            <input
                                                type="text"
                                                value={manualContent.hashtags}
                                                onChange={e => setManualContent(prev => ({ ...prev, hashtags: e.target.value }))}
                                                placeholder="marketing, socialmedia, tips"
                                                className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50"
                                            />
                                        </div>

                                        {/* Schedule */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Date</label>
                                                <input
                                                    type="date"
                                                    value={manualContent.scheduledDate}
                                                    onChange={e => setManualContent(prev => ({ ...prev, scheduledDate: e.target.value }))}
                                                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-[var(--foreground-muted)] mb-1">Time</label>
                                                <input
                                                    type="time"
                                                    value={manualContent.scheduledTime}
                                                    onChange={e => setManualContent(prev => ({ ...prev, scheduledTime: e.target.value }))}
                                                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-t border-[var(--surface-border)] p-4 gap-3">
                                    <button
                                        onClick={() => setShowManualModal(false)}
                                        className="flex-1 btn btn-ghost cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveManualContent}
                                        disabled={!manualContent.caption.trim()}
                                        className="flex-1 btn btn-primary cursor-pointer disabled:opacity-50"
                                    >
                                        <Check className="w-4 h-4" />
                                        Save Content
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Post Edit Modal */}
                    {editingPost && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingPost(null)}>
                            <div className="bg-[var(--background)] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                                                <PlatformIcon platform={editingPost.platform} size={24} colored />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[var(--foreground)]">{editForm.title || 'Edit Post'}</h3>
                                                <p className="text-sm text-[var(--foreground-muted)]">{editingPost.contentType} • {editingPost.suggestedTime}</p>

                                                {/* Generation Metadata Badges */}
                                                {(() => {
                                                    let genMeta: any = null
                                                    try {
                                                        if (editingPost.notes && typeof editingPost.notes === 'string') {
                                                            const parsed = JSON.parse(editingPost.notes)
                                                            genMeta = parsed.generationMeta
                                                        }
                                                    } catch { /* not JSON */ }

                                                    if (!genMeta) return null

                                                    const badges = []
                                                    if (genMeta.tone) {
                                                        const toneEmoji: Record<string, string> = { professional: '👔', casual: '😎', funny: '😂', inspirational: '✨', educational: '📚', promotional: '📣' }
                                                        badges.push({ emoji: toneEmoji[genMeta.tone] || '🎭', tip: `Tone: ${genMeta.tone}` })
                                                    }
                                                    if (genMeta.cta) {
                                                        const ctaEmoji: Record<string, string> = { comment: '💬', share: '↗️', link: '🔗', buy: '🛒', signup: '📧', save: '💾' }
                                                        badges.push({ emoji: ctaEmoji[genMeta.cta] || '🎯', tip: `CTA: ${genMeta.cta}` })
                                                    }
                                                    if (genMeta.hookStyle) {
                                                        badges.push({ emoji: '🪝', tip: `Hook: ${genMeta.hookStyle}` })
                                                    }
                                                    if (genMeta.contentLength === 'detailed') {
                                                        badges.push({ emoji: '📝', tip: 'Detailed/in-depth content' })
                                                    }
                                                    if (genMeta.engagementGoal) {
                                                        const goalEmoji: Record<string, string> = { reach: '📢', engagement: '💬', clicks: '👆', saves: '💾' }
                                                        badges.push({ emoji: goalEmoji[genMeta.engagementGoal] || '🎯', tip: `Goal: ${genMeta.engagementGoal}` })
                                                    }
                                                    if (genMeta.hasNews) {
                                                        badges.push({ emoji: '📰', tip: 'Includes current news/trends' })
                                                    }

                                                    if (badges.length === 0) {
                                                        badges.push({ emoji: '🤖', tip: 'AI generated' })
                                                    }

                                                    return (
                                                        <div className="gen-badges mt-2">
                                                            {badges.map((b, i) => (
                                                                <span key={i} className="gen-badge tooltip tooltip-bottom" data-tip={b.tip}>
                                                                    {b.emoji}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingPost(null)} className="p-2 hover:bg-[var(--surface)] rounded-lg cursor-pointer">
                                            <X className="w-5 h-5 text-[var(--foreground-muted)]" />
                                        </button>
                                    </div>


                                    <div className="space-y-4">
                                        {/* Video Template (for video content) */}
                                        {(editingPost.contentType === 'video_script' || editingPost.contentType === 'short') && (
                                            <div className="space-y-4">
                                                {/* Video Style Selector */}
                                                <div>
                                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                                        <Film className="w-4 h-4 inline mr-1" />
                                                        Video Style
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { id: 'hook_reveal', name: 'Hook Reveal', desc: 'Text zooms in, builds suspense' },
                                                            { id: 'list_tips', name: 'List/Tips', desc: 'Counting through key points' },
                                                            { id: 'quote_style', name: 'Quote Style', desc: 'Big text with background' },
                                                            { id: 'kinetic_text', name: 'Kinetic Text', desc: 'Animated typography' },
                                                        ].map(template => (
                                                            <button
                                                                key={template.id}
                                                                onClick={() => setEditForm(prev => ({ ...prev, videoTemplate: template.id }))}
                                                                className={`p-3 rounded-lg text-left transition-all cursor-pointer ${editForm.videoTemplate === template.id
                                                                    ? 'bg-[var(--primary)] text-white'
                                                                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]'
                                                                    }`}
                                                            >
                                                                <div className="font-medium text-sm">{template.name}</div>
                                                                <div className={`text-xs ${editForm.videoTemplate === template.id ? 'text-white/70' : 'text-[var(--foreground-muted)]'}`}>
                                                                    {template.desc}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Video Preview Button & Player */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="block text-sm font-medium text-[var(--foreground)]">
                                                            <Play className="w-4 h-4 inline mr-1" />
                                                            Video Preview
                                                        </label>
                                                        <button
                                                            onClick={() => setShowVideoPreview(!showVideoPreview)}
                                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${showVideoPreview
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                                }`}
                                                        >
                                                            {showVideoPreview ? 'Hide Preview' : '▶ Watch Preview'}
                                                        </button>
                                                    </div>

                                                    {showVideoPreview ? (
                                                        <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--surface-border)]">
                                                            <VideoPreviewPlayer
                                                                title={editForm.title}
                                                                content={editForm.content}
                                                                videoTemplate={editForm.videoTemplate}
                                                            />

                                                            {/* Veo AI Video Generation */}
                                                            <div className="mt-6 pt-4 border-t border-[var(--surface-border)]">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <label className="text-sm font-medium text-[var(--foreground)]">
                                                                        ✨ AI Video Background
                                                                    </label>
                                                                    <span className="text-xs text-[var(--foreground-muted)]">
                                                                        Powered by Google Veo
                                                                    </span>
                                                                </div>

                                                                {generatedVideoUrl ? (
                                                                    <div className="space-y-3">
                                                                        <video
                                                                            src={generatedVideoUrl}
                                                                            controls
                                                                            autoPlay
                                                                            loop
                                                                            className="w-full rounded-lg"
                                                                        />
                                                                        <div className="flex gap-2">
                                                                            <a
                                                                                href={generatedVideoUrl}
                                                                                download="ai-background.mp4"
                                                                                className="flex-1 btn bg-[var(--success)] text-white text-center cursor-pointer"
                                                                            >
                                                                                ⬇ Download Video
                                                                            </a>
                                                                            <button
                                                                                onClick={() => setGeneratedVideoUrl(null)}
                                                                                className="btn btn-ghost cursor-pointer"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={generateVeoVideo}
                                                                        disabled={generatingVeoVideo}
                                                                        className="w-full btn bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white cursor-pointer disabled:opacity-50"
                                                                    >
                                                                        {generatingVeoVideo ? (
                                                                            <>
                                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                                Generating (~2-3 min)...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Sparkles className="w-4 h-4" />
                                                                                Generate AI Background Video
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}
                                                                <p className="text-xs text-[var(--foreground-muted)] mt-2 text-center">
                                                                    Creates an 8-second cinematic background you can overlay with text
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--surface-border)]">
                                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                                {/* Quick storyboard frames */}
                                                                {(() => {
                                                                    const content = editForm.content || ''
                                                                    const hookMatch = content.match(/\[HOOK[^\]]*\][:\s]*([^\[\n]+)/i)
                                                                    const problemMatch = content.match(/\[PROBLEM[^\]]*\][:\s]*([^\[\n]+)/i)
                                                                    const solutionMatch = content.match(/\[SOLUTION[^\]]*\][:\s]*([^\[\n]+)/i)
                                                                    const ctaMatch = content.match(/\[CTA[^\]]*\][:\s]*([^\[\n]+)/i)
                                                                    const lines = content.split('\n').filter(l => l.trim() && !l.match(/^\[/))

                                                                    const frames = [
                                                                        { label: 'HOOK', text: hookMatch?.[1] || lines[0] || editForm.title || '...', color: 'from-[var(--primary)] to-[var(--secondary)]' },
                                                                        { label: 'SETUP', text: problemMatch?.[1] || lines[1] || '...', color: 'bg-[var(--background)] border border-[var(--surface-border)]' },
                                                                        { label: 'VALUE', text: solutionMatch?.[1] || lines[2] || '...', color: 'bg-[var(--background)] border border-[var(--surface-border)]' },
                                                                        { label: 'CTA', text: ctaMatch?.[1] || 'Follow!', color: 'from-[var(--success)] to-[var(--primary)]' },
                                                                    ]

                                                                    return frames.map((frame, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className={`flex-shrink-0 w-20 aspect-[9/16] ${frame.color.includes('from-') ? `bg-gradient-to-br ${frame.color}` : frame.color} rounded-lg flex flex-col items-center justify-center p-1.5 text-center`}
                                                                        >
                                                                            <span className={`text-[6px] font-bold ${frame.color.includes('from-') ? 'text-white/80' : 'text-[var(--primary)]'}`}>{frame.label}</span>
                                                                            <span className={`text-[8px] font-medium line-clamp-3 ${frame.color.includes('from-') ? 'text-white' : 'text-[var(--foreground)]'}`}>
                                                                                {frame.text.slice(0, 30)}...
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                })()}
                                                            </div>
                                                            <p className="text-xs text-[var(--foreground-muted)] mt-2 text-center">
                                                                Click &quot;Watch Preview&quot; to see animated video
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Image Section - for image-based content types */}
                                        {(editingPost.contentType === 'image' || editingPost.contentType === 'carousel' || editingPost.contentType === 'story') && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                                        <ImageIcon className="w-4 h-4" />
                                                        Media
                                                    </label>
                                                    {!showImageOptions && (
                                                        <button
                                                            onClick={() => setShowImageOptions(true)}
                                                            className="text-xs text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add Image
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Existing Images */}
                                                {editingPost.mediaUrls && editingPost.mediaUrls.length > 0 && (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {editingPost.mediaUrls.map((url, i) => (
                                                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--surface-border)]">
                                                                <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                                                                <button
                                                                    onClick={async () => {
                                                                        const newUrls = editingPost.mediaUrls?.filter((_, idx) => idx !== i) || []
                                                                        await supabase
                                                                            .from('content_items')
                                                                            .update({ media_urls: newUrls })
                                                                            .eq('id', editingPost.id)
                                                                        setEditingPost(prev => prev ? { ...prev, mediaUrls: newUrls } : null)
                                                                        setWeekContent(prev => {
                                                                            if (!prev) return prev
                                                                            return {
                                                                                ...prev,
                                                                                days: prev.days.map(day => ({
                                                                                    ...day,
                                                                                    posts: day.posts.map(post =>
                                                                                        post.id === editingPost.id
                                                                                            ? { ...post, mediaUrls: newUrls }
                                                                                            : post
                                                                                    )
                                                                                }))
                                                                            }
                                                                        })
                                                                    }}
                                                                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors cursor-pointer"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Empty state / Add Image Options */}
                                                {(showImageOptions || !editingPost.mediaUrls?.length) && (
                                                    <div className="border-2 border-dashed border-[var(--surface-border)] rounded-xl p-4 space-y-3">
                                                        {/* Style selector */}
                                                        <div>
                                                            <label className="text-xs text-[var(--foreground-muted)] mb-2 block">Image Style</label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {[
                                                                    { id: 'vibrant', label: '🎨 Vibrant', desc: 'Eye-catching colors' },
                                                                    { id: 'minimal', label: '⬜ Minimal', desc: 'Clean & simple' },
                                                                    { id: 'professional', label: '💼 Professional', desc: 'Corporate style' },
                                                                    { id: 'creative', label: '✨ Creative', desc: 'Artistic look' },
                                                                    { id: 'lifestyle', label: '📷 Lifestyle', desc: 'Natural & warm' },
                                                                ].map(style => (
                                                                    <button
                                                                        key={style.id}
                                                                        onClick={() => setImageStyle(style.id as any)}
                                                                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${imageStyle === style.id
                                                                            ? 'bg-[var(--primary)] text-white'
                                                                            : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                                                            }`}
                                                                    >
                                                                        {style.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Quality Tier Selector */}
                                                        <div>
                                                            <label className="text-xs text-[var(--foreground-muted)] mb-2 block">Quality Tier</label>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    onClick={() => setImageQuality('standard')}
                                                                    className={`p-3 rounded-lg text-left transition-all cursor-pointer border ${imageQuality === 'standard'
                                                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                                        : 'border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--primary)]/50'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-medium text-sm text-[var(--foreground)]">Standard</span>
                                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--success)]/20 text-[var(--success)]">1 credit</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-[var(--foreground-muted)]">Good quality, fast generation</p>
                                                                </button>
                                                                <button
                                                                    onClick={() => setImageQuality('hd')}
                                                                    className={`p-3 rounded-lg text-left transition-all cursor-pointer border ${imageQuality === 'hd'
                                                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                                        : 'border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--primary)]/50'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-medium text-sm text-[var(--foreground)]">HD ✨</span>
                                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--warning)]/20 text-[var(--warning)]">4 credits</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-[var(--foreground-muted)]">Premium quality, Imagen 3</p>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Custom prompt input */}
                                                        <div>
                                                            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">
                                                                Custom Image Description <span className="opacity-60">(optional)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={imagePrompt}
                                                                onChange={e => setImagePrompt(e.target.value)}
                                                                placeholder="Leave empty to auto-generate from post content..."
                                                                className="w-full p-2 rounded-lg bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] text-sm placeholder:text-[var(--foreground-muted)]/50"
                                                            />
                                                        </div>

                                                        {/* Action buttons */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={generateImageForPost}
                                                                disabled={generatingImage}
                                                                className="flex-1 btn btn-primary py-2 text-sm cursor-pointer disabled:opacity-50"
                                                            >
                                                                {generatingImage ? (
                                                                    <>
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                        Generating...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles className="w-4 h-4" />
                                                                        Generate with AI
                                                                    </>
                                                                )}
                                                            </button>

                                                            <label className="flex-1 btn btn-ghost py-2 text-sm cursor-pointer border border-[var(--surface-border)]">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0]
                                                                        if (file) uploadImageForPost(file)
                                                                    }}
                                                                    disabled={generatingImage}
                                                                />
                                                                <Upload className="w-4 h-4" />
                                                                Upload
                                                            </label>
                                                        </div>

                                                        {editingPost.mediaUrls?.length ? (
                                                            <button
                                                                onClick={() => setShowImageOptions(false)}
                                                                className="w-full text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] cursor-pointer"
                                                            >
                                                                Cancel
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Title */}
                                        <div>
                                            <label className="block text-sm text-[var(--foreground-muted)] mb-1">Title/Hook</label>
                                            <input
                                                type="text"
                                                value={editForm.title}
                                                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] text-lg font-medium"
                                            />
                                        </div>

                                        {/* Content */}
                                        <div>
                                            <label className="block text-sm text-[var(--foreground-muted)] mb-1">
                                                {editingPost.contentType === 'video_script' || editingPost.contentType === 'short' ? 'Script' : 'Caption'}
                                            </label>
                                            <textarea
                                                value={editForm.content}
                                                onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                                                rows={6}
                                                className="w-full p-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)] resize-none"
                                            />
                                            <p className="text-xs text-[var(--foreground-muted)] mt-1 text-right">
                                                {editForm.content.length} characters
                                            </p>
                                        </div>

                                        {/* Hashtags */}
                                        <div>
                                            <label className="block text-sm text-[var(--foreground-muted)] mb-1">Hashtags</label>
                                            <input
                                                type="text"
                                                value={editForm.hashtags}
                                                onChange={e => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                                                placeholder="marketing, tips, strategy"
                                                className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                            />
                                        </div>

                                        {/* Schedule Time */}
                                        <div>
                                            <label className="block text-sm text-[var(--foreground-muted)] mb-1">Scheduled Time</label>
                                            <input
                                                type="time"
                                                value={editForm.suggestedTime}
                                                onChange={e => setEditForm(prev => ({ ...prev, suggestedTime: e.target.value }))}
                                                className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--foreground)]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex border-t border-[var(--surface-border)] p-4 gap-3 bg-[var(--surface)]">
                                    <button
                                        onClick={() => setEditingPost(null)}
                                        className="btn btn-ghost cursor-pointer"
                                    >
                                        Cancel
                                    </button>

                                    {/* Video generation is now handled in the VideoPreviewPlayer component */}
                                    <button
                                        onClick={savePostEdit}
                                        disabled={savingEdit}
                                        className="flex-1 btn btn-primary cursor-pointer disabled:opacity-50"
                                    >
                                        {savingEdit ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation Modal */}
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-[var(--background)] rounded-2xl w-full max-w-md shadow-2xl border border-[var(--surface-border)]">
                                <div className="p-6">
                                    <div className="w-12 h-12 rounded-full bg-[var(--error)]/10 flex items-center justify-center mb-4 mx-auto">
                                        <Trash2 className="w-6 h-6 text-[var(--error)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--foreground)] text-center mb-2">
                                        Delete All Content?
                                    </h3>
                                    <p className="text-[var(--foreground-muted)] text-center text-sm">
                                        This will permanently delete all generated content for this week. This action cannot be undone.
                                    </p>
                                </div>
                                <div className="flex border-t border-[var(--surface-border)]">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 p-4 text-[var(--foreground)] font-medium hover:bg-[var(--surface)] transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false)
                                            deleteWeek()
                                        }}
                                        disabled={deletingWeek}
                                        className="flex-1 p-4 text-[var(--error)] font-medium hover:bg-[var(--error)]/10 transition-colors cursor-pointer border-l border-[var(--surface-border)] disabled:opacity-50"
                                    >
                                        {deletingWeek ? 'Deleting...' : 'Delete All'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
