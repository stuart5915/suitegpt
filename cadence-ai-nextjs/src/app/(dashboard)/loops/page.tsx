'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
    Plus,
    Play,
    Pause,
    Settings,
    ChevronRight,
    ChevronDown,
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
    Image,
    Users,
    Layers,
    FileText,
    Search,
    ClipboardPaste,
    History
} from 'lucide-react'
import { Project, Audience, ContentVariant } from '@/lib/supabase/types'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import AudienceManager from '@/components/loops/AudienceManager'
import AIFleetSection from '@/components/loops/AIFleetSection'
import VariantEditor from '@/components/loops/VariantEditor'
import AudienceSelector from '@/components/loops/AudienceSelector'
import { SUITE_AUDIENCES } from '@/lib/audiences/templates'

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
    postsPerDay: number  // How many posts to generate per day
    isActive: boolean
    items: LoopItem[]
    lastPosted?: string
    nextPost?: string
    audiences?: Audience[]
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
    variants?: ContentVariant[]
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

// Generated post for content calendar
interface ScheduledPost {
    id: string
    loopId: string
    audienceId: string
    audienceName: string
    audienceEmoji: string
    scheduledDate: string // YYYY-MM-DD
    content: string
    status: 'pending' | 'approved' | 'rejected'
    messagingAngle: string
    referenceLink?: { url: string; title: string; notes?: string }
    generatedAt: string
    platform: 'x' | 'linkedin' | 'instagram'
}

// Preset loop templates
const LOOP_TEMPLATES = [
    {
        name: 'SuiteGPT Weekly Evergreen',
        emoji: '🤖',
        color: '#10b981',
        description: 'Generate a week of SuiteGPT content with Claude Code',
        rotationDays: 7,
        isClaudeCodeSession: true,  // Special flag - shows prompt modal instead of creating loop
        featured: true
    },
    {
        name: 'SUITE User Audiences',
        emoji: '👥',
        color: '#8b5cf6',
        description: 'Pre-configured with 4 audience segments: Entrepreneurs, Contributors, Passive Users, Influencers',
        rotationDays: 7,
        withAudiences: true, // Flag to pre-load SUITE audiences
        featured: false // Demoted since SuiteGPT is now the featured one
    },
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
        color: '#6366f1',
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
    const { user, isLoading: authLoading } = useTelegramAuth()

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
    const [selectedAudience, setSelectedAudience] = useState<string | null>(null)

    // Audience & Variant management
    const [showAudienceManager, setShowAudienceManager] = useState<string | null>(null)
    const [showVariantEditor, setShowVariantEditor] = useState<{ loopId: string, itemId: string } | null>(null)
    const [editingAudience, setEditingAudience] = useState<{ loopId: string, audience: Audience } | null>(null)
    const [editingReferenceLinks, setEditingReferenceLinks] = useState<{ url: string; title: string; notes?: string }[]>([])

    // Work Log automated loop state
    const [workLogConfig, setWorkLogConfig] = useState<WorkLogConfig>({
        enabled: false,
        postTime: '18:00',
        platform: 'x',
        autoApprove: true,
        generateImage: true
    })
    const [showWorkLogModal, setShowWorkLogModal] = useState(false)
    const [aiFleetExpanded, setAiFleetExpanded] = useState(false)
    const [savingWorkLog, setSavingWorkLog] = useState(false)

    // Generate Week state
    const [showGenerateWeekModal, setShowGenerateWeekModal] = useState<string | null>(null) // loopId
    const [generateDays, setGenerateDays] = useState(7)
    const [generatingWeek, setGeneratingWeek] = useState(false)
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 })
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
    const [showContentCalendar, setShowContentCalendar] = useState(false)

    // Claude Code session prompt modal
    const [showClaudeCodePrompt, setShowClaudeCodePrompt] = useState(false)
    const [promptCopied, setPromptCopied] = useState(false)
    const [weeklyTheme, setWeeklyTheme] = useState('')
    const [researchFindings, setResearchFindings] = useState('')
    const [contentHistory, setContentHistory] = useState<string>('')
    const [contentHistoryLoading, setContentHistoryLoading] = useState(false)
    const [contentHistoryCount, setContentHistoryCount] = useState(0)
    const [researchPromptCopied, setResearchPromptCopied] = useState(false)
    const [githubActivity, setGithubActivity] = useState<string>('')
    const [githubActivityLoading, setGithubActivityLoading] = useState(false)
    const [githubActivityCount, setGithubActivityCount] = useState(0)
    const [suggestedThemes, setSuggestedThemes] = useState<Array<{ title: string; reason: string }>>([])
    const [suggestingTheme, setSuggestingTheme] = useState(false)
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        history: false,
        github: false,
        research: true,
        findings: false,
        theme: true,
        prompt: false
    })

    // Fetch content history and GitHub activity when modal opens
    useEffect(() => {
        if (showClaudeCodePrompt) {
            fetchContentHistory()
            fetchGithubActivity()
        }
    }, [showClaudeCodePrompt])

    const fetchContentHistory = async () => {
        setContentHistoryLoading(true)
        try {
            const response = await fetch('/api/content/history?days=30')
            const data = await response.json()
            if (data.success) {
                setContentHistory(data.formattedForPrompt || '')
                setContentHistoryCount(data.count || 0)
            }
        } catch (error) {
            console.error('Failed to fetch content history:', error)
        } finally {
            setContentHistoryLoading(false)
        }
    }

    const fetchGithubActivity = async () => {
        setGithubActivityLoading(true)
        try {
            const response = await fetch('/api/content/github-activity?days=7')
            const data = await response.json()
            if (data.success) {
                setGithubActivity(data.formattedForPrompt || '')
                setGithubActivityCount(data.count || 0)
            }
        } catch (error) {
            console.error('Failed to fetch GitHub activity:', error)
        } finally {
            setGithubActivityLoading(false)
        }
    }

    const suggestThemes = async () => {
        if (!researchFindings && !githubActivity) return
        setSuggestingTheme(true)
        setSuggestedThemes([])
        try {
            const response = await fetch('/api/content/suggest-theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ researchFindings, githubActivity })
            })
            const data = await response.json()
            if (data.success && data.themes) {
                setSuggestedThemes(data.themes)
            }
        } catch (error) {
            console.error('Failed to suggest themes:', error)
        } finally {
            setSuggestingTheme(false)
        }
    }

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    // Build the final prompt with research, theme, and history
    const buildFinalPrompt = () => {
        return `# SuiteGPT Weekly Content Generation Session

## Context
You are helping generate a week's worth of social media content for SuiteGPT (suitegpt.app).

### What is SuiteGPT?
- **Tagline**: "Your Personal App Concierge"
- **Value Prop**: "Tell us what you need. We'll find it, change it, or build it for you. Real apps, not just answers."
- **Key Differentiator**: Unlike ChatGPT which gives instructions, SuiteGPT gives you working apps
- **URL**: https://suitegpt.app

### Target Audiences
1. **Non-Technical Builders** - Entrepreneurs with ideas but no coding skills
2. **Frustrated ChatGPT Users** - People tired of getting answers they can't use
3. **Small Business Owners** - Need custom tools without dev team costs
4. **Creators** - Need workflow tools that don't exist yet
5. **Students** - Need study tools and project helpers

### Brand Voice
- Confident but not arrogant
- Simple, clear language (no jargon)
- Focus on outcomes, not features
- Slightly provocative/challenging to status quo

### Content Pillars
1. **"Real Apps, Not Answers"** - The core differentiator
2. **Use Cases** - Specific examples of what people build
3. **Comparison/Contrast** - SuiteGPT vs ChatGPT moments
4. **Social Proof** - What users are building/saying

${contentHistory ? `## IMPORTANT: Recent Content (Last 30 Days) - DO NOT REPEAT
The following content was already posted. Create NEW, FRESH content that does not repeat these themes, hooks, or examples:

${contentHistory}

---` : ''}

${githubActivity ? `## Recent Development Activity (What We Shipped)
Use these commits to create "building in public" content, dev updates, or highlight new features:

${githubActivity}

---` : ''}

${researchFindings ? `## Research & Context for This Week
The following research was gathered from AI deep research tools (Google, Grok, Perplexity, etc.):

${researchFindings}

---` : ''}

## This Week's Theme/Focus
${weeklyTheme || '[NOT SET - Please enter a theme above]'}

## Your Task
Generate content for the week based on the theme and research above. AVOID repeating any content from the "Recent Content" section above.

### Output Format
For each piece of content, provide:
- Platform (X, LinkedIn, Instagram, TikTok)
- The content (properly formatted for platform)
- Suggested post date/time
- Any image suggestions (optional)

### Weekly Output Target
- 7 tweets (1/day)
- 3 LinkedIn posts
- 2 Instagram posts (with caption)
- 2 TikTok video scripts (optional)

---

When content is finalized, push it to Cadence AI calendar using:
POST /api/content/bulk-schedule

Generate the content now.`
    }

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

    // Load brand settings from API
    useEffect(() => {
        async function loadBrandSettings() {
            try {
                const response = await fetch('/api/settings')
                const data = await response.json()
                if (data.settings) {
                    setBrandSettings(data.settings)
                }
            } catch (e) {
                console.error('Failed to load brand settings:', e)
                // Fallback to localStorage for migration
                const brandSettingsJson = localStorage.getItem('cadence_brand_settings')
                if (brandSettingsJson) {
                    try {
                        setBrandSettings(JSON.parse(brandSettingsJson))
                    } catch (parseError) {
                        console.error('Failed to parse brand settings:', parseError)
                    }
                }
            }
        }
        loadBrandSettings()
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

    // Load projects (filtered by user's telegram_id)
    useEffect(() => {
        async function loadProjects() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('telegram_id', user.id)
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

        if (!authLoading) {
            loadProjects()
        }
    }, [supabase, user, authLoading])

    // Load loops when project changes
    useEffect(() => {
        if (selectedProject) {
            loadLoops()
        }
    }, [selectedProject])

    const loadLoops = async () => {
        if (!selectedProject) return

        try {
            const response = await fetch(`/api/loops?project_id=${selectedProject}`)
            const data = await response.json()
            if (data.loops) {
                setLoops(data.loops)
            } else {
                // Fallback to localStorage for migration
                const savedLoops = localStorage.getItem(`loops-${selectedProject}`)
                if (savedLoops) {
                    const parsedLoops = JSON.parse(savedLoops)
                    setLoops(parsedLoops)
                    // Migrate to database
                    for (const loop of parsedLoops) {
                        await fetch('/api/loops', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...loop, projectId: selectedProject })
                        })
                    }
                } else {
                    setLoops([])
                }
            }
        } catch (e) {
            console.error('Failed to load loops:', e)
            // Fallback to localStorage
            const savedLoops = localStorage.getItem(`loops-${selectedProject}`)
            if (savedLoops) {
                setLoops(JSON.parse(savedLoops))
            } else {
                setLoops([])
            }
        }
    }

    const saveLoops = async (updatedLoops: ContentLoop[]) => {
        if (!selectedProject) return
        // Also save to localStorage as backup
        localStorage.setItem(`loops-${selectedProject}`, JSON.stringify(updatedLoops))
        setLoops(updatedLoops)
    }

    const saveLoopToApi = async (loop: ContentLoop) => {
        try {
            await fetch('/api/loops', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loop)
            })
        } catch (e) {
            console.error('Failed to save loop to API:', e)
        }
    }

    const deleteLoopFromApi = async (loopId: string) => {
        try {
            await fetch(`/api/loops?id=${loopId}`, { method: 'DELETE' })
        } catch (e) {
            console.error('Failed to delete loop from API:', e)
        }
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

    // Handle template click - may create loop or show Claude Code prompt
    const handleTemplateClick = (template: typeof LOOP_TEMPLATES[0] & { withAudiences?: boolean; featured?: boolean; isClaudeCodeSession?: boolean }) => {
        if (template.isClaudeCodeSession) {
            setShowNewLoopModal(false)
            setShowClaudeCodePrompt(true)
            return
        }
        createLoop(template)
    }

    const createLoop = async (template: typeof LOOP_TEMPLATES[0] & { withAudiences?: boolean; featured?: boolean }) => {
        // Import SUITE audiences if template has withAudiences flag
        const audiences = template.withAudiences ? SUITE_AUDIENCES.map(a => ({
            ...a,
            id: crypto.randomUUID()
        })) : []

        const newLoop: ContentLoop = {
            id: crypto.randomUUID(),
            name: template.name,
            emoji: template.emoji,
            color: template.color,
            description: template.description,
            rotationDays: template.rotationDays,
            postsPerDay: 1, // Default to 1 post per day
            isActive: true,
            items: [],
            audiences: audiences
        }

        // Create in API
        try {
            const response = await fetch('/api/loops', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newLoop, projectId: selectedProject })
            })
            const data = await response.json()
            if (data.loop) {
                // Use the ID from the API
                saveLoops([...loops, { ...newLoop, id: data.loop.id }])
                // Auto-expand the new loop to show audiences
                setExpandedLoop(data.loop.id)
            } else {
                saveLoops([...loops, newLoop])
                setExpandedLoop(newLoop.id)
            }
        } catch (e) {
            console.error('Failed to create loop in API:', e)
            saveLoops([...loops, newLoop])
            setExpandedLoop(newLoop.id)
        }
        setShowNewLoopModal(false)
    }

    const toggleLoop = async (loopId: string) => {
        const loop = loops.find(l => l.id === loopId)
        if (!loop) return

        const updatedLoops = loops.map(l =>
            l.id === loopId ? { ...l, isActive: !l.isActive } : l
        )
        saveLoops(updatedLoops)

        // Update in API
        await saveLoopToApi({ ...loop, isActive: !loop.isActive })
    }

    const deleteLoop = async (loopId: string) => {
        if (!confirm('Delete this loop and all its content?')) return
        saveLoops(loops.filter(loop => loop.id !== loopId))

        // Delete from API
        await deleteLoopFromApi(loopId)
    }

    const addContentToLoop = async (loopId: string) => {
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

        const loop = loops.find(l => l.id === loopId)
        if (!loop) return

        const updatedLoop = { ...loop, items: [...loop.items, newItem] }
        const updatedLoops = loops.map(l => l.id === loopId ? updatedLoop : l)

        saveLoops(updatedLoops)
        await saveLoopToApi(updatedLoop)

        setNewContent({ url: '', title: '', summary: '', content: '', type: 'article' })
        setShowAddContentModal(null)
    }

    const removeContentFromLoop = async (loopId: string, itemId: string) => {
        const loop = loops.find(l => l.id === loopId)
        if (!loop) return

        const updatedLoop = { ...loop, items: loop.items.filter(item => item.id !== itemId) }
        const updatedLoops = loops.map(l => l.id === loopId ? updatedLoop : l)

        saveLoops(updatedLoops)
        await saveLoopToApi(updatedLoop)
    }

    // Save audiences for a loop
    const saveAudiences = async (loopId: string, audiences: Audience[]) => {
        const loop = loops.find(l => l.id === loopId)
        if (!loop) return

        const updatedLoop = { ...loop, audiences }
        const updatedLoops = loops.map(l => l.id === loopId ? updatedLoop : l)

        saveLoops(updatedLoops)
        await saveLoopToApi(updatedLoop)
    }

    // Save variants for a content item
    const saveVariants = async (loopId: string, itemId: string, variants: ContentVariant[]) => {
        const loop = loops.find(l => l.id === loopId)
        if (!loop) return

        const updatedLoop = {
            ...loop,
            items: loop.items.map(item =>
                item.id === itemId
                    ? { ...item, variants }
                    : item
            )
        }
        const updatedLoops = loops.map(l => l.id === loopId ? updatedLoop : l)

        saveLoops(updatedLoops)
        await saveLoopToApi(updatedLoop)
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

        // Get audience context if selected
        const audience = selectedAudience
            ? loop?.audiences?.find(a => a.id === selectedAudience)
            : null
        const variant = selectedAudience
            ? item.variants?.find(v => v.audienceId === selectedAudience)
            : null

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
                    previousPosts: item.previousPosts || [],
                    // Audience targeting with cycling support
                    audience: audience ? {
                        name: audience.name,
                        description: audience.description,
                        painPoints: audience.painPoints,
                        desires: audience.desires,
                        // Support both legacy and new format
                        messagingAngle: Array.isArray(audience.messagingAngles) ? undefined : (audience as unknown as { messagingAngle?: string }).messagingAngle,
                        messagingAngles: audience.messagingAngles,
                        cta: audience.cta,
                        referenceLinks: audience.referenceLinks,
                        usageHistory: audience.usageHistory
                    } : undefined,
                    variant: variant ? {
                        hook: variant.hook,
                        keyPoints: variant.keyPoints,
                        cta: variant.cta
                    } : undefined
                })
            })

            if (response.ok) {
                const data = await response.json()
                setGeneratedPost(data.post)

                // Update audience usage history if returned
                if (data.updatedUsageHistory && audience && loop) {
                    const updatedAudiences = loop.audiences?.map(a =>
                        a.id === audience.id
                            ? { ...a, usageHistory: data.updatedUsageHistory }
                            : a
                    ) || []
                    saveAudiences(loopId, updatedAudiences)
                }
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

    // Generate a week's worth of content for a loop
    const generateWeekContent = async (loopId: string, days: number) => {
        const loop = loops.find(l => l.id === loopId)
        const project = projects.find(p => p.id === selectedProject)
        if (!loop || !project) return

        const enabledAudiences = loop.audiences?.filter(a => a.enabled !== false) || []
        if (enabledAudiences.length === 0) {
            alert('No enabled audiences to generate content for')
            return
        }

        const postsPerDay = loop.postsPerDay || 1
        const totalPosts = postsPerDay * days

        setGeneratingWeek(true)
        setGenerationProgress({ current: 0, total: totalPosts })

        const newPosts: ScheduledPost[] = []
        const today = new Date()

        // Create a working copy of audiences with their usage history
        const audiencesCopy = enabledAudiences.map(a => ({ ...a }))
        let audienceIndex = 0

        try {
            for (let day = 0; day < days; day++) {
                const scheduledDate = new Date(today)
                scheduledDate.setDate(today.getDate() + day)
                const dateStr = scheduledDate.toISOString().split('T')[0]

                for (let postNum = 0; postNum < postsPerDay; postNum++) {
                    // Get next audience in rotation
                    const audience = audiencesCopy[audienceIndex % audiencesCopy.length]
                    audienceIndex++

                    // Generate content for this audience
                    const response = await fetch('/api/generate-post', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: `${loop.name} content for ${audience.name}`,
                            summary: loop.description,
                            brandVoice: project.brand_voice || brandSettings?.brandVoice,
                            brandTone: project.brand_tone || brandSettings?.tone,
                            emojiStyle: project.emoji_style || brandSettings?.emojiStyle,
                            speakingPerspective: brandSettings?.speakingPerspective || 'I',
                            exclusionWords: brandSettings?.exclusionWords,
                            hashtags: project.default_hashtags || brandSettings?.defaultHashtags?.split(' ').filter(Boolean),
                            projectName: project.name,
                            platform: selectedPlatform,
                            previousPosts: newPosts.filter(p => p.audienceId === audience.id).map(p => p.content).slice(-3),
                            audience: {
                                name: audience.name,
                                description: audience.description,
                                painPoints: audience.painPoints,
                                desires: audience.desires,
                                messagingAngles: audience.messagingAngles,
                                cta: audience.cta,
                                referenceLinks: audience.referenceLinks,
                                usageHistory: audience.usageHistory
                            }
                        })
                    })

                    if (response.ok) {
                        const data = await response.json()

                        // Update audience usage history for next iteration
                        if (data.updatedUsageHistory) {
                            const idx = audiencesCopy.findIndex(a => a.id === audience.id)
                            if (idx !== -1) {
                                audiencesCopy[idx].usageHistory = data.updatedUsageHistory
                            }
                        }

                        newPosts.push({
                            id: crypto.randomUUID(),
                            loopId: loop.id,
                            audienceId: audience.id,
                            audienceName: audience.name,
                            audienceEmoji: audience.emoji,
                            scheduledDate: dateStr,
                            content: data.post,
                            status: 'pending',
                            messagingAngle: data.selectedAngle || audience.messagingAngles?.[0] || '',
                            referenceLink: data.selectedReferenceLink,
                            generatedAt: new Date().toISOString(),
                            platform: selectedPlatform
                        })
                    }

                    setGenerationProgress({ current: newPosts.length, total: totalPosts })
                }
            }

            // Update audiences with final usage history
            const updatedAudiences = loop.audiences?.map(a => {
                const updated = audiencesCopy.find(ac => ac.id === a.id)
                return updated ? { ...a, usageHistory: updated.usageHistory } : a
            }) || []
            saveAudiences(loopId, updatedAudiences)

            // Save scheduled posts
            setScheduledPosts(prev => [...prev, ...newPosts])

            // Save to localStorage
            const allPosts = [...scheduledPosts, ...newPosts]
            localStorage.setItem(`cadence_scheduled_posts_${loopId}`, JSON.stringify(allPosts.filter(p => p.loopId === loopId)))

            // Show content calendar
            setShowGenerateWeekModal(null)
            setShowContentCalendar(true)

        } catch (err) {
            console.error('Error generating week content:', err)
            alert('Error generating content. Check console for details.')
        } finally {
            setGeneratingWeek(false)
            setGenerationProgress({ current: 0, total: 0 })
        }
    }

    // Load scheduled posts from localStorage
    const loadScheduledPosts = (loopId: string) => {
        const saved = localStorage.getItem(`cadence_scheduled_posts_${loopId}`)
        if (saved) {
            try {
                const posts = JSON.parse(saved) as ScheduledPost[]
                setScheduledPosts(prev => {
                    const filtered = prev.filter(p => p.loopId !== loopId)
                    return [...filtered, ...posts]
                })
            } catch (e) {
                console.error('Error loading scheduled posts:', e)
            }
        }
    }

    // Update post status
    const updatePostStatus = (postId: string, status: 'pending' | 'approved' | 'rejected') => {
        setScheduledPosts(prev => {
            const updated = prev.map(p => p.id === postId ? { ...p, status } : p)
            // Save to localStorage
            const loopId = prev.find(p => p.id === postId)?.loopId
            if (loopId) {
                localStorage.setItem(`cadence_scheduled_posts_${loopId}`, JSON.stringify(updated.filter(p => p.loopId === loopId)))
            }
            return updated
        })
    }

    // Delete a scheduled post
    const deleteScheduledPost = (postId: string) => {
        setScheduledPosts(prev => {
            const post = prev.find(p => p.id === postId)
            const updated = prev.filter(p => p.id !== postId)
            if (post) {
                localStorage.setItem(`cadence_scheduled_posts_${post.loopId}`, JSON.stringify(updated.filter(p => p.loopId === post.loopId)))
            }
            return updated
        })
    }

    // Approve all pending posts
    const approveAllPosts = (loopId: string) => {
        setScheduledPosts(prev => {
            const updated = prev.map(p =>
                p.loopId === loopId && p.status === 'pending'
                    ? { ...p, status: 'approved' as const }
                    : p
            )
            localStorage.setItem(`cadence_scheduled_posts_${loopId}`, JSON.stringify(updated.filter(p => p.loopId === loopId)))
            return updated
        })
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

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    const selectedProjectData = projects.find(p => p.id === selectedProject)

    return (
        <div className="min-h-screen p-6">
            {/* Project Switcher Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Select Project</h2>
                    <Link href="/projects/new" className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        New Project
                    </Link>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {projects.map(project => (
                        <button
                            key={project.id}
                            onClick={() => setSelectedProject(project.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all min-w-[200px] ${
                                selectedProject === project.id
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                    : 'border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--foreground-muted)]'
                            }`}
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                style={{
                                    background: `linear-gradient(135deg, ${(project.posting_schedule as any)?.primary_color || '#6366f1'}, ${(project.posting_schedule as any)?.secondary_color || '#f97316'})`
                                }}
                            >
                                {project.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left">
                                <p className={`font-semibold truncate ${selectedProject === project.id ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                                    {project.name}
                                </p>
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    {project.platforms?.join(', ') || 'No platforms'}
                                </p>
                            </div>
                            {selectedProject === project.id && (
                                <Check className="w-5 h-5 text-[var(--primary)] ml-auto flex-shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">
                        {selectedProjectData?.name || 'Content Loops'}
                    </h1>
                    <p className="text-[var(--foreground-muted)]">
                        Automated and evergreen content that rotates on a schedule
                    </p>
                </div>
                <button
                    onClick={() => setShowNewLoopModal(true)}
                    className="btn btn-primary"
                >
                    <Plus className="w-4 h-4" />
                    New Loop
                </button>
            </div>

            {/* System Loops */}
            <div className="space-y-4 mb-6">
                {/* Daily Work Log Card */}
                <div className="card p-5">
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
                            {workLogConfig.enabled && (
                                <div className="text-right mr-4">
                                    <div className="text-xs text-[var(--foreground-muted)]">Posts daily at</div>
                                    <div className="text-sm font-medium text-[var(--foreground)]">
                                        {workLogConfig.postTime}
                                    </div>
                                </div>
                            )}
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
                    {workLogConfig.enabled && (
                        <div className="mt-4 pt-4 border-t border-[var(--surface-border)] flex items-center gap-6 text-sm flex-wrap">
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
                        </div>
                    )}
                </div>

                {/* AI Fleet Daily App Loop Card */}
                <div className="card p-5">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setAiFleetExpanded(!aiFleetExpanded)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <Rocket className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-[var(--foreground)]">AI Fleet Daily App</h3>
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">
                                        Active
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    Daily spotlight posts featuring apps from the SUITE ecosystem
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ChevronRight className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform ${aiFleetExpanded ? 'rotate-90' : ''}`} />
                        </div>
                    </div>
                    {aiFleetExpanded && <AIFleetSection />}
                </div>

                {/* SUITE User Audiences Loop Card */}
                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-[var(--foreground)]">SUITE User Audiences</h3>
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--surface)] text-[var(--foreground-muted)]">
                                        Template
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    Pre-configured with 4 audience segments: Entrepreneurs, Contributors, Passive Users, Influencers
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    // Find and use the SUITE User Audiences template
                                    const template = LOOP_TEMPLATES.find(t => t.name === 'SUITE User Audiences')
                                    if (template) {
                                        createLoop(template as typeof LOOP_TEMPLATES[0] & { withAudiences?: boolean; featured?: boolean })
                                    }
                                }}
                                className="btn btn-primary text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Create Loop
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loops Grid */}
            {loops.length > 0 && (
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
                                <div className="border-t border-[var(--surface-border)] bg-[var(--background)]">
                                    {/* Audiences Section - PROMINENT */}
                                    <div className="p-5 border-b border-[var(--surface-border)]">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-5 h-5 text-purple-500" />
                                                <h4 className="font-semibold text-[var(--foreground)]">
                                                    Target Audiences
                                                </h4>
                                                <span className="text-sm text-[var(--foreground-muted)]">
                                                    ({loop.audiences?.length || 0})
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setShowAudienceManager(loop.id)}
                                                className="btn btn-ghost text-sm text-purple-400"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Audience
                                            </button>
                                        </div>

                                        {(!loop.audiences || loop.audiences.length === 0) ? (
                                            <div className="text-center py-6 border-2 border-dashed border-[var(--surface-border)] rounded-xl">
                                                <Users className="w-8 h-8 text-[var(--foreground-muted)] mx-auto mb-2" />
                                                <p className="text-[var(--foreground-muted)] mb-2">No audiences configured</p>
                                                <button
                                                    onClick={() => setShowAudienceManager(loop.id)}
                                                    className="text-purple-400 hover:underline text-sm"
                                                >
                                                    Add audiences to tailor content
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {loop.audiences.map(audience => (
                                                    <div
                                                        key={audience.id}
                                                        className={`p-4 bg-[var(--surface)] rounded-xl border transition-colors group ${
                                                            audience.enabled === false
                                                                ? 'border-[var(--surface-border)] opacity-50'
                                                                : 'border-[var(--surface-border)] hover:border-purple-500/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {/* Enable/Disable Toggle */}
                                                            <button
                                                                onClick={() => {
                                                                    const updatedAudiences = loop.audiences!.map(a =>
                                                                        a.id === audience.id
                                                                            ? { ...a, enabled: a.enabled === false ? true : false }
                                                                            : a
                                                                    )
                                                                    saveAudiences(loop.id, updatedAudiences)
                                                                }}
                                                                className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                                    audience.enabled === false
                                                                        ? 'border-[var(--foreground-muted)] bg-transparent'
                                                                        : 'border-purple-500 bg-purple-500'
                                                                }`}
                                                                title={audience.enabled === false ? 'Click to enable' : 'Click to disable'}
                                                            >
                                                                {audience.enabled !== false && (
                                                                    <Check className="w-3 h-3 text-white" />
                                                                )}
                                                            </button>
                                                            <div className="text-2xl">{audience.emoji}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <h5 className={`font-semibold ${audience.enabled === false ? 'text-[var(--foreground-muted)]' : 'text-[var(--foreground)]'}`}>
                                                                            {audience.name}
                                                                        </h5>
                                                                        {audience.enabled === false && (
                                                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-500/20 text-gray-400">
                                                                                Disabled
                                                                            </span>
                                                                        )}
                                                                        {audience.emailCapture && audience.enabled !== false && (
                                                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400">
                                                                                Email
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingAudience({ loopId: loop.id, audience })
                                                                            setEditingReferenceLinks(audience.referenceLinks || [])
                                                                        }}
                                                                        className="p-1.5 rounded hover:bg-purple-500/20 text-[var(--foreground-muted)] hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Edit audience"
                                                                    >
                                                                        <Edit3 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <p className="text-xs text-[var(--foreground-muted)] line-clamp-2 mt-1">
                                                                    {audience.description}
                                                                </p>
                                                                <div className="flex items-center gap-4 mt-3 text-xs">
                                                                    {/* Usage Stats */}
                                                                    <div className="flex items-center gap-3 text-[var(--foreground-muted)]">
                                                                        <span>
                                                                            <span className="text-purple-400 font-medium">
                                                                                {audience.usageHistory?.generatedCount || 0}
                                                                            </span> posts
                                                                        </span>
                                                                        {audience.messagingAngles && audience.messagingAngles.length > 1 && (
                                                                            <span className="text-[var(--foreground-muted)]">
                                                                                · {audience.messagingAngles.length} angles
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[var(--foreground-muted)] truncate">
                                                                        CTA: <span className="text-purple-400">{audience.cta}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Loop Posting Config */}
                                        {loop.audiences && loop.audiences.length > 0 && (
                                            <div className="mt-4 p-4 bg-purple-500/10 rounded-lg space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-purple-400" />
                                                            <span className="text-[var(--foreground-muted)]">Posts per day:</span>
                                                            <select
                                                                value={loop.postsPerDay || 1}
                                                                onChange={(e) => {
                                                                    const updatedLoops = loops.map(l =>
                                                                        l.id === loop.id
                                                                            ? { ...l, postsPerDay: parseInt(e.target.value) }
                                                                            : l
                                                                    )
                                                                    saveLoops(updatedLoops)
                                                                }}
                                                                className="px-2 py-1 text-sm bg-[var(--background)] border border-[var(--surface-border)] rounded text-[var(--foreground)] font-medium"
                                                            >
                                                                <option value={1}>1</option>
                                                                <option value={2}>2</option>
                                                                <option value={3}>3</option>
                                                                <option value={4}>4</option>
                                                                <option value={5}>5</option>
                                                            </select>
                                                        </div>
                                                        <span className="text-[var(--foreground-muted)]">
                                                            = <span className="text-purple-400 font-semibold">{(loop.postsPerDay || 1) * 7}</span> posts/week
                                                        </span>
                                                        <span className="text-[var(--foreground-muted)]">
                                                            across <span className="text-purple-400">{loop.audiences.filter(a => a.enabled !== false).length}</span> audiences
                                                            {loop.audiences.some(a => a.enabled === false) && (
                                                                <span className="text-gray-500"> ({loop.audiences.filter(a => a.enabled === false).length} disabled)</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowAudienceManager(loop.id)}
                                                        className="text-xs text-purple-400 hover:underline"
                                                    >
                                                        Edit audiences
                                                    </button>
                                                </div>

                                                {/* Generate Week Button */}
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => {
                                                            loadScheduledPosts(loop.id)
                                                            setShowGenerateWeekModal(loop.id)
                                                        }}
                                                        className="flex-1 btn btn-primary"
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                        Generate Week
                                                    </button>
                                                    {scheduledPosts.filter(p => p.loopId === loop.id).length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                loadScheduledPosts(loop.id)
                                                                setShowContentCalendar(true)
                                                            }}
                                                            className="btn btn-ghost text-purple-400"
                                                        >
                                                            <Calendar className="w-4 h-4" />
                                                            View Calendar ({scheduledPosts.filter(p => p.loopId === loop.id && p.status === 'pending').length} pending)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Items Section */}
                                    <div className="p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-5 h-5" style={{ color: loop.color }} />
                                                <h4 className="font-semibold text-[var(--foreground)]">
                                                    Content Items
                                                </h4>
                                                <span className="text-sm text-[var(--foreground-muted)]">
                                                    ({loop.items.length})
                                                </span>
                                            </div>
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
                                            <div className="text-center py-6 border-2 border-dashed border-[var(--surface-border)] rounded-xl">
                                                <FileText className="w-8 h-8 text-[var(--foreground-muted)] mx-auto mb-2" />
                                                <p className="text-[var(--foreground-muted)] mb-2">No content in this loop yet</p>
                                                <button
                                                    onClick={() => setShowAddContentModal(loop.id)}
                                                    className="hover:underline text-sm"
                                                    style={{ color: loop.color }}
                                                >
                                                    Add your first content item
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
                                                    {/* Variants badge */}
                                                    {loop.audiences && loop.audiences.length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setShowVariantEditor({ loopId: loop.id, itemId: item.id })
                                                            }}
                                                            className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                                                            title="Edit variants"
                                                        >
                                                            <Layers className="w-3 h-3" />
                                                            {item.variants?.length || 0}/{loop.audiences.length} variants
                                                        </button>
                                                    )}
                                                    <span className="text-xs text-[var(--foreground-muted)]">
                                                        Used {item.usageCount}x
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setShowPostPreview({ loopId: loop.id, itemId: item.id })
                                                            setGeneratedPost('')
                                                            setSelectedAudience(null)
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

                        <div className="p-4 space-y-4">
                            {/* Featured Template */}
                            {LOOP_TEMPLATES.filter(t => (t as any).featured).map(template => {
                                const isClaudeCode = (template as any).isClaudeCodeSession
                                return (
                                    <button
                                        key={template.name}
                                        onClick={() => handleTemplateClick(template)}
                                        className={`w-full p-5 rounded-xl text-left transition-all group ${
                                            isClaudeCode
                                                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border-2 border-emerald-500/50'
                                                : 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border-2 border-purple-500/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded-full ${
                                                isClaudeCode ? 'bg-emerald-500' : 'bg-purple-500'
                                            }`}>
                                                {isClaudeCode ? 'CLAUDE CODE' : 'RECOMMENDED'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                                                style={{ background: `${template.color}30` }}
                                            >
                                                {template.emoji}
                                            </div>
                                            <div className="flex-1">
                                                <div className={`font-bold text-lg text-[var(--foreground)] ${
                                                    isClaudeCode ? 'group-hover:text-emerald-400' : 'group-hover:text-purple-400'
                                                }`}>
                                                    {template.name}
                                                </div>
                                                <div className="text-sm text-[var(--foreground-muted)]">
                                                    {template.description}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    {isClaudeCode ? (
                                                        <span className="text-xs text-emerald-400">
                                                            <Sparkles className="w-3 h-3 inline mr-1" />
                                                            AI-powered content generation
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-purple-400">
                                                            <Users className="w-3 h-3 inline mr-1" />
                                                            4 audiences included
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 border-t border-[var(--surface-border)]" />
                                <span className="text-xs text-[var(--foreground-muted)]">Or choose a basic template</span>
                                <div className="flex-1 border-t border-[var(--surface-border)]" />
                            </div>

                            {/* Other Templates */}
                            <div className="space-y-2">
                                {LOOP_TEMPLATES.filter(t => !(t as any).featured).map(template => (
                                    <button
                                        key={template.name}
                                        onClick={() => handleTemplateClick(template)}
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
                </div>
            )}

            {/* Claude Code Session Prompt Modal */}
            {showClaudeCodePrompt && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-3xl w-full mb-8">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">
                                        🤖
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--foreground)]">SuiteGPT Weekly Content</h2>
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            Gather research, set theme, generate content
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowClaudeCodePrompt(false)
                                        setPromptCopied(false)
                                        setWeeklyTheme('')
                                        setResearchFindings('')
                                    }}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Step indicator */}
                            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">
                                <Sparkles className="w-4 h-4" />
                                <span>Complete the sections below, then copy the final prompt</span>
                            </div>

                            {/* Section 0: Content History (auto-loaded) */}
                            <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('history')}
                                    className="w-full p-4 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <History className="w-5 h-5 text-orange-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-[var(--foreground)]">Recent Content (Last 30 Days)</div>
                                            <div className="text-xs text-[var(--foreground-muted)]">
                                                {contentHistoryLoading ? 'Loading...' : `${contentHistoryCount} posts found - auto-included in prompt`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {contentHistoryCount > 0 && (
                                            <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                                                {contentHistoryCount}
                                            </span>
                                        )}
                                        {expandedSections.history ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </div>
                                </button>
                                {expandedSections.history && (
                                    <div className="p-4 border-t border-[var(--surface-border)]">
                                        {contentHistoryLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading recent content...
                                            </div>
                                        ) : contentHistory ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-[var(--foreground-muted)]">
                                                    This content will be included in the prompt so Claude avoids repetition:
                                                </p>
                                                <pre className="bg-[var(--background)] p-3 rounded-lg text-xs text-[var(--foreground-muted)] overflow-x-auto whitespace-pre-wrap font-mono max-h-40 overflow-y-auto border border-[var(--surface-border)]">
                                                    {contentHistory}
                                                </pre>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                No recent content found. This is your first batch!
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section: GitHub Activity */}
                            <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('github')}
                                    className="w-full p-4 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <GitCommit className="w-5 h-5 text-green-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-[var(--foreground)]">What We Shipped (Last 7 Days)</div>
                                            <div className="text-xs text-[var(--foreground-muted)]">
                                                {githubActivityLoading ? 'Loading...' : `${githubActivityCount} commits - auto-included in prompt`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {githubActivityCount > 0 && (
                                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                                                {githubActivityCount}
                                            </span>
                                        )}
                                        {expandedSections.github ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </div>
                                </button>
                                {expandedSections.github && (
                                    <div className="p-4 border-t border-[var(--surface-border)]">
                                        {githubActivityLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading GitHub activity...
                                            </div>
                                        ) : githubActivity ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-[var(--foreground-muted)]">
                                                    Recent commits for "building in public" content:
                                                </p>
                                                <pre className="bg-[var(--background)] p-3 rounded-lg text-xs text-[var(--foreground-muted)] overflow-x-auto whitespace-pre-wrap font-mono max-h-40 overflow-y-auto border border-[var(--surface-border)]">
                                                    {githubActivity}
                                                </pre>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                No recent commits found.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 1: Research Prompts */}
                            <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('research')}
                                    className="w-full p-4 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Search className="w-5 h-5 text-blue-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-[var(--foreground)]">1. Gather Research</div>
                                            <div className="text-xs text-[var(--foreground-muted)]">Use AI deep research tools</div>
                                        </div>
                                    </div>
                                    {expandedSections.research ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                                {expandedSections.research && (
                                    <div className="p-4 border-t border-[var(--surface-border)] space-y-3">
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            Copy this prompt into Google AI, Grok, or Perplexity to gather fresh data:
                                        </p>
                                        <div className="relative bg-[var(--background)] p-4 rounded-lg border border-[var(--surface-border)]">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`I'm creating social media content for SuiteGPT (suitegpt.app) - an AI app concierge that builds real working apps, not just gives answers like ChatGPT.

Please research and provide:

1. **Trending Topics This Week** - What are the hot conversations in AI app building, no-code tools, and solopreneur/indie hacker spaces? Any viral posts, debates, or news on X/Twitter and LinkedIn?

2. **Competitor Updates** - What are ChatGPT, Claude, Bolt, Lovable, Replit, and similar tools shipping or announcing? What's the sentiment around them?

3. **Viral Content Formats** - What post formats, hooks, and styles are currently performing well in the tech/AI space? Give specific examples of high-engagement posts.

4. **Pain Points & Frustrations** - What are people complaining about with current AI tools? What gaps exist that SuiteGPT could address?

5. **Content Opportunities** - Based on the above, what angles or topics would resonate this week for a product that turns ideas into real apps?

Format your response with clear sections I can reference when creating content.`)
                                                    setResearchPromptCopied(true)
                                                    setTimeout(() => setResearchPromptCopied(false), 2000)
                                                }}
                                                className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                                                    researchPromptCopied
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]'
                                                }`}
                                            >
                                                {researchPromptCopied ? (
                                                    <>
                                                        <Check className="w-3 h-3" /> Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3" /> Copy
                                                    </>
                                                )}
                                            </button>
                                            <pre className="text-xs text-[var(--foreground-muted)] whitespace-pre-wrap pr-16">
{`I'm creating social media content for SuiteGPT (suitegpt.app) - an AI app concierge that builds real working apps, not just gives answers like ChatGPT.

Please research and provide:

1. Trending Topics This Week - What are the hot conversations in AI app building, no-code tools, and solopreneur/indie hacker spaces?

2. Competitor Updates - What are ChatGPT, Claude, Bolt, Lovable, Replit shipping or announcing? What's the sentiment?

3. Viral Content Formats - What post formats and hooks are performing well in tech/AI right now?

4. Pain Points & Frustrations - What are people complaining about with current AI tools?

5. Content Opportunities - Based on the above, what angles would resonate this week?`}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Paste Research Findings */}
                            <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('findings')}
                                    className="w-full p-4 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <ClipboardPaste className="w-5 h-5 text-purple-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-[var(--foreground)]">2. Paste Research Findings</div>
                                            <div className="text-xs text-[var(--foreground-muted)]">
                                                {researchFindings ? `${researchFindings.length} characters` : 'Optional but recommended'}
                                            </div>
                                        </div>
                                    </div>
                                    {expandedSections.findings ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                                {expandedSections.findings && (
                                    <div className="p-4 border-t border-[var(--surface-border)]">
                                        <textarea
                                            value={researchFindings}
                                            onChange={(e) => setResearchFindings(e.target.value)}
                                            placeholder="Paste all your research findings here... trending topics, competitor news, viral formats, etc."
                                            className="w-full h-40 px-4 py-3 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Weekly Theme */}
                            <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('theme')}
                                    className="w-full p-4 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-5 h-5 text-amber-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-[var(--foreground)]">3. This Week's Theme</div>
                                            <div className="text-xs text-[var(--foreground-muted)]">
                                                {weeklyTheme ? `"${weeklyTheme.substring(0, 30)}${weeklyTheme.length > 30 ? '...' : ''}"` : 'Required'}
                                            </div>
                                        </div>
                                    </div>
                                    {expandedSections.theme ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                                {expandedSections.theme && (
                                    <div className="p-4 border-t border-[var(--surface-border)] space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={weeklyTheme}
                                                onChange={(e) => setWeeklyTheme(e.target.value)}
                                                placeholder="e.g., 'Real Apps vs ChatGPT Answers' or 'Student Use Cases'"
                                                className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                            />
                                            <button
                                                onClick={suggestThemes}
                                                disabled={suggestingTheme || (!researchFindings && !githubActivity)}
                                                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {suggestingTheme ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Thinking...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4" />
                                                        Suggest
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {suggestedThemes.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-[var(--foreground-muted)]">Click a suggestion to use it:</p>
                                                {suggestedThemes.map((theme, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setWeeklyTheme(theme.title)}
                                                        className="w-full p-3 bg-[var(--background)] hover:bg-amber-500/10 border border-[var(--surface-border)] hover:border-amber-500/50 rounded-lg text-left transition-colors"
                                                    >
                                                        <div className="font-medium text-[var(--foreground)]">{theme.title}</div>
                                                        <div className="text-xs text-[var(--foreground-muted)] mt-1">{theme.reason}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            {(!researchFindings && !githubActivity)
                                                ? 'Add research findings or wait for GitHub activity to enable suggestions'
                                                : 'This will be the main focus for all content this week'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Final Prompt */}
                            <div className="border border-emerald-500/50 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection('prompt')}
                                    className="w-full p-4 flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-emerald-400" />
                                        <div className="text-left">
                                            <div className="font-semibold text-emerald-400">4. Final Prompt</div>
                                            <div className="text-xs text-emerald-400/70">Ready to copy to Claude Code</div>
                                        </div>
                                    </div>
                                    {expandedSections.prompt ? <ChevronDown className="w-5 h-5 text-emerald-400" /> : <ChevronRight className="w-5 h-5 text-emerald-400" />}
                                </button>
                                {expandedSections.prompt && (
                                    <div className="p-4 border-t border-emerald-500/30">
                                        <pre className="bg-[var(--background)] p-4 rounded-lg text-xs text-[var(--foreground-muted)] overflow-x-auto whitespace-pre-wrap font-mono max-h-60 overflow-y-auto border border-[var(--surface-border)]">
                                            {buildFinalPrompt()}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--surface-border)] flex items-center justify-between gap-3">
                            <div className="text-sm text-[var(--foreground-muted)]">
                                {weeklyTheme ? (
                                    <span className="text-emerald-400">✓ Ready to generate</span>
                                ) : (
                                    <span className="text-amber-400">⚠ Enter a weekly theme</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowClaudeCodePrompt(false)
                                        setPromptCopied(false)
                                        setWeeklyTheme('')
                                        setResearchFindings('')
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(buildFinalPrompt())
                                        setPromptCopied(true)
                                        setTimeout(() => setPromptCopied(false), 2000)
                                    }}
                                    disabled={!weeklyTheme}
                                    className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {promptCopied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copy Final Prompt
                                        </>
                                    )}
                                </button>
                            </div>
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

                            {/* Audience Selector */}
                            {(() => {
                                const loop = loops.find(l => l.id === showPostPreview.loopId)
                                if (loop?.audiences && loop.audiences.length > 0) {
                                    return (
                                        <AudienceSelector
                                            audiences={loop.audiences}
                                            selectedId={selectedAudience}
                                            onSelect={setSelectedAudience}
                                        />
                                    )
                                }
                                return null
                            })()}

                            {/* Brand Settings Status */}
                            {selectedProjectData?.brand_voice ? (
                                <p className="text-xs text-green-500 bg-green-500/10 rounded-lg p-2">
                                    Using brand voice from project settings
                                </p>
                            ) : (
                                <p className="text-xs text-[var(--foreground-muted)] bg-[var(--background)] rounded-lg p-2">
                                    Tip: Set up your brand voice in <a href={`/projects/${selectedProject}`} className="text-[var(--primary)] hover:underline">Project Settings</a> for consistent content
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

            {/* Audience Manager Modal */}
            {showAudienceManager && (
                <AudienceManager
                    audiences={loops.find(l => l.id === showAudienceManager)?.audiences || []}
                    onSave={(audiences) => saveAudiences(showAudienceManager, audiences)}
                    onClose={() => setShowAudienceManager(null)}
                />
            )}

            {/* Edit Single Audience Modal */}
            {editingAudience && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--surface)] rounded-2xl max-w-xl w-full max-h-[90vh] overflow-auto">
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="text-3xl">{editingAudience.audience.emoji}</div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                                            Edit Audience
                                        </h2>
                                        <p className="text-sm text-[var(--foreground-muted)]">
                                            {editingAudience.audience.name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingAudience(null)}
                                    className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                const formData = new FormData(e.currentTarget)
                                const loop = loops.find(l => l.id === editingAudience.loopId)
                                if (!loop?.audiences) return

                                // Parse reference links from JSON hidden input
                                const referenceLinksJson = formData.get('referenceLinks') as string
                                let referenceLinks = []
                                try {
                                    referenceLinks = referenceLinksJson ? JSON.parse(referenceLinksJson) : []
                                } catch (e) {
                                    referenceLinks = []
                                }

                                const updatedAudiences = loop.audiences.map(a =>
                                    a.id === editingAudience.audience.id
                                        ? {
                                            ...a,
                                            name: formData.get('name') as string,
                                            emoji: formData.get('emoji') as string || '👤',
                                            description: formData.get('description') as string,
                                            painPoints: (formData.get('painPoints') as string).split('\n').filter(Boolean),
                                            desires: (formData.get('desires') as string).split('\n').filter(Boolean),
                                            messagingAngles: (formData.get('messagingAngles') as string).split('\n').filter(Boolean),
                                            cta: formData.get('cta') as string,
                                            emailCapture: formData.get('emailCapture') === 'on',
                                            referenceLinks: referenceLinks.length > 0 ? referenceLinks : undefined,
                                            usageHistory: a.usageHistory // Preserve existing usage history
                                        }
                                        : a
                                )
                                saveAudiences(editingAudience.loopId, updatedAudiences)
                                setEditingAudience(null)
                            }}
                            className="p-6 space-y-4"
                        >
                            {/* Name & Emoji */}
                            <div className="grid grid-cols-[80px_1fr] gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Emoji</label>
                                    <input
                                        type="text"
                                        name="emoji"
                                        defaultValue={editingAudience.audience.emoji}
                                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-center text-2xl"
                                        maxLength={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={editingAudience.audience.name}
                                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Description</label>
                                <input
                                    type="text"
                                    name="description"
                                    defaultValue={editingAudience.audience.description}
                                    placeholder="Brief description of this audience segment"
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                            </div>

                            {/* Pain Points */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                    Pain Points
                                    <span className="font-normal text-[var(--foreground-muted)] ml-2">(one per line)</span>
                                </label>
                                <textarea
                                    name="painPoints"
                                    defaultValue={editingAudience.audience.painPoints?.join('\n') || ''}
                                    placeholder="What problems does this audience face?"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* Desires */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                    Desires
                                    <span className="font-normal text-[var(--foreground-muted)] ml-2">(one per line)</span>
                                </label>
                                <textarea
                                    name="desires"
                                    defaultValue={editingAudience.audience.desires?.join('\n') || ''}
                                    placeholder="What does this audience want to achieve?"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* Messaging Angles */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                    Messaging Angles
                                    <span className="font-normal text-[var(--foreground-muted)] ml-2">(one per line - AI cycles through these)</span>
                                </label>
                                <textarea
                                    name="messagingAngles"
                                    defaultValue={
                                        // Support both legacy single string and new array format
                                        Array.isArray(editingAudience.audience.messagingAngles)
                                            ? editingAudience.audience.messagingAngles.join('\n')
                                            : (editingAudience.audience as unknown as { messagingAngle?: string }).messagingAngle || ''
                                    }
                                    placeholder="How should content be positioned for this audience? Add multiple angles for variety."
                                    rows={4}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* CTA */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Call to Action (CTA)</label>
                                <input
                                    type="text"
                                    name="cta"
                                    defaultValue={editingAudience.audience.cta}
                                    placeholder="e.g., Start your free trial today"
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                            </div>

                            {/* Email Capture */}
                            <label className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-lg cursor-pointer hover:bg-[var(--surface-hover)]">
                                <input
                                    type="checkbox"
                                    name="emailCapture"
                                    defaultChecked={editingAudience.audience.emailCapture}
                                    className="w-4 h-4 rounded"
                                />
                                <div>
                                    <span className="text-sm font-medium text-[var(--foreground)]">Enable Email Capture</span>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        Show email capture form when targeting this audience
                                    </p>
                                </div>
                            </label>

                            {/* Reference Links */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-[var(--foreground)]">
                                        Reference Links
                                        <span className="font-normal text-[var(--foreground-muted)] ml-2">(optional articles/links for context)</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setEditingReferenceLinks([...editingReferenceLinks, { url: '', title: '' }])}
                                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Add Link
                                    </button>
                                </div>

                                {/* Hidden input to store JSON of reference links */}
                                <input
                                    type="hidden"
                                    name="referenceLinks"
                                    value={JSON.stringify(editingReferenceLinks.filter(l => l.url.trim() && l.title.trim()))}
                                />

                                {editingReferenceLinks.length === 0 ? (
                                    <p className="text-sm text-[var(--foreground-muted)] italic py-2">
                                        No reference links. Add articles or links the AI can reference when generating content.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {editingReferenceLinks.map((link, index) => (
                                            <div key={index} className="p-3 bg-[var(--background)] rounded-lg space-y-2">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Title"
                                                        value={link.title}
                                                        onChange={(e) => {
                                                            const updated = [...editingReferenceLinks]
                                                            updated[index] = { ...link, title: e.target.value }
                                                            setEditingReferenceLinks(updated)
                                                        }}
                                                        className="flex-1 px-2 py-1 bg-[var(--surface)] border border-[var(--surface-border)] rounded text-sm text-[var(--foreground)]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingReferenceLinks(editingReferenceLinks.filter((_, i) => i !== index))
                                                        }}
                                                        className="p-1 text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="url"
                                                    placeholder="URL (https://...)"
                                                    value={link.url}
                                                    onChange={(e) => {
                                                        const updated = [...editingReferenceLinks]
                                                        updated[index] = { ...link, url: e.target.value }
                                                        setEditingReferenceLinks(updated)
                                                    }}
                                                    className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--surface-border)] rounded text-sm text-[var(--foreground)]"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Notes (optional - what's this article about?)"
                                                    value={link.notes || ''}
                                                    onChange={(e) => {
                                                        const updated = [...editingReferenceLinks]
                                                        updated[index] = { ...link, notes: e.target.value || undefined }
                                                        setEditingReferenceLinks(updated)
                                                    }}
                                                    className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--surface-border)] rounded text-sm text-[var(--foreground)]"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Usage Stats (if available) */}
                            {editingAudience.audience.usageHistory && (
                                <div className="p-3 bg-[var(--background)] rounded-lg">
                                    <h4 className="text-sm font-medium text-[var(--foreground)] mb-2 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-purple-400" />
                                        Generation Stats
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div className="text-lg font-bold text-[var(--foreground)]">
                                                {editingAudience.audience.usageHistory.generatedCount}
                                            </div>
                                            <div className="text-xs text-[var(--foreground-muted)]">Posts Generated</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-[var(--foreground)]">
                                                {(editingAudience.audience.usageHistory.lastAngleIndex % (editingAudience.audience.messagingAngles?.length || 1)) + 1}
                                            </div>
                                            <div className="text-xs text-[var(--foreground-muted)]">Last Angle #</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-[var(--foreground)]">
                                                {editingAudience.audience.referenceLinks?.length
                                                    ? (editingAudience.audience.usageHistory.lastLinkIndex % editingAudience.audience.referenceLinks.length) + 1
                                                    : 'N/A'}
                                            </div>
                                            <div className="text-xs text-[var(--foreground-muted)]">Last Link #</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-[var(--surface-border)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm('Are you sure you want to delete this audience?')) {
                                            const loop = loops.find(l => l.id === editingAudience.loopId)
                                            if (loop?.audiences) {
                                                const updatedAudiences = loop.audiences.filter(a => a.id !== editingAudience.audience.id)
                                                saveAudiences(editingAudience.loopId, updatedAudiences)
                                            }
                                            setEditingAudience(null)
                                        }
                                    }}
                                    className="px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => setEditingAudience(null)}
                                    className="px-4 py-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    <Check className="w-4 h-4" />
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Variant Editor Modal */}
            {showVariantEditor && (() => {
                const loop = loops.find(l => l.id === showVariantEditor.loopId)
                const item = loop?.items.find(i => i.id === showVariantEditor.itemId)
                if (!loop || !item || !loop.audiences?.length) return null
                return (
                    <VariantEditor
                        item={item}
                        audiences={loop.audiences}
                        onSave={(variants) => saveVariants(showVariantEditor.loopId, showVariantEditor.itemId, variants)}
                        onClose={() => setShowVariantEditor(null)}
                    />
                )
            })()}

            {/* Generate Week Modal */}
            {showGenerateWeekModal && (() => {
                const loop = loops.find(l => l.id === showGenerateWeekModal)
                if (!loop) return null
                const enabledAudiences = loop.audiences?.filter(a => a.enabled !== false) || []
                const postsPerDay = loop.postsPerDay || 1
                const totalPosts = postsPerDay * generateDays

                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[var(--surface)] rounded-2xl max-w-md w-full">
                            <div className="p-6 border-b border-[var(--surface-border)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Sparkles className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[var(--foreground)]">Generate Content</h2>
                                            <p className="text-sm text-[var(--foreground-muted)]">{loop.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowGenerateWeekModal(null)}
                                        className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Days Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                        Generate for how many days?
                                    </label>
                                    <div className="flex gap-2">
                                        {[3, 5, 7, 14, 30].map(days => (
                                            <button
                                                key={days}
                                                onClick={() => setGenerateDays(days)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    generateDays === days
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                                }`}
                                            >
                                                {days}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="p-4 bg-[var(--background)] rounded-xl space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--foreground-muted)]">Posts per day</span>
                                        <span className="text-[var(--foreground)] font-medium">{postsPerDay}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--foreground-muted)]">Days</span>
                                        <span className="text-[var(--foreground)] font-medium">{generateDays}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--foreground-muted)]">Enabled audiences</span>
                                        <span className="text-[var(--foreground)] font-medium">{enabledAudiences.length}</span>
                                    </div>
                                    <div className="border-t border-[var(--surface-border)] pt-2 mt-2">
                                        <div className="flex justify-between">
                                            <span className="text-[var(--foreground)] font-medium">Total posts to generate</span>
                                            <span className="text-purple-400 font-bold text-lg">{totalPosts}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Audience Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                        Cycling through audiences:
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {enabledAudiences.map(a => (
                                            <span key={a.id} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                                                {a.emoji} {a.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Progress */}
                                {generatingWeek && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[var(--foreground-muted)]">Generating...</span>
                                            <span className="text-[var(--foreground)]">
                                                {generationProgress.current} / {generationProgress.total}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 transition-all duration-300"
                                                style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-[var(--surface-border)] flex gap-3">
                                <button
                                    onClick={() => setShowGenerateWeekModal(null)}
                                    disabled={generatingWeek}
                                    className="flex-1 btn btn-ghost"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => generateWeekContent(showGenerateWeekModal, generateDays)}
                                    disabled={generatingWeek || enabledAudiences.length === 0}
                                    className="flex-1 btn btn-primary"
                                >
                                    {generatingWeek ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate {totalPosts} Posts
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Content Calendar Modal */}
            {showContentCalendar && (() => {
                // Get posts for all loops with audiences
                const loopsWithPosts = loops.filter(l => l.audiences && l.audiences.length > 0)
                const currentLoopId = loopsWithPosts[0]?.id
                const loopPosts = scheduledPosts.filter(p => loopsWithPosts.some(l => l.id === p.loopId))

                // Group posts by date
                const postsByDate = loopPosts.reduce((acc, post) => {
                    if (!acc[post.scheduledDate]) {
                        acc[post.scheduledDate] = []
                    }
                    acc[post.scheduledDate].push(post)
                    return acc
                }, {} as Record<string, ScheduledPost[]>)

                const sortedDates = Object.keys(postsByDate).sort()
                const pendingCount = loopPosts.filter(p => p.status === 'pending').length
                const approvedCount = loopPosts.filter(p => p.status === 'approved').length

                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[var(--surface)] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b border-[var(--surface-border)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[var(--foreground)]">Content Calendar</h2>
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                {pendingCount} pending · {approvedCount} approved
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {pendingCount > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Approve all ${pendingCount} pending posts?`)) {
                                                        loopsWithPosts.forEach(l => approveAllPosts(l.id))
                                                    }
                                                }}
                                                className="btn btn-primary text-sm"
                                            >
                                                <Check className="w-4 h-4" />
                                                Approve All
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowContentCalendar(false)}
                                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                {sortedDates.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Calendar className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-3" />
                                        <p className="text-[var(--foreground-muted)]">No scheduled posts yet</p>
                                        <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                            Use "Generate Week" to create content
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {sortedDates.map(date => {
                                            const datePosts = postsByDate[date]
                                            const dateObj = new Date(date)
                                            const isToday = new Date().toISOString().split('T')[0] === date
                                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
                                            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                                            return (
                                                <div key={date}>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <h3 className={`font-semibold ${isToday ? 'text-purple-400' : 'text-[var(--foreground)]'}`}>
                                                            {dayName}
                                                        </h3>
                                                        <span className="text-sm text-[var(--foreground-muted)]">{dateStr}</span>
                                                        {isToday && (
                                                            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                                                                Today
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-3">
                                                        {datePosts.map(post => (
                                                            <div
                                                                key={post.id}
                                                                className={`p-4 rounded-xl border ${
                                                                    post.status === 'approved'
                                                                        ? 'bg-green-500/5 border-green-500/30'
                                                                        : post.status === 'rejected'
                                                                            ? 'bg-red-500/5 border-red-500/30'
                                                                            : 'bg-[var(--background)] border-[var(--surface-border)]'
                                                                }`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <span className="text-2xl">{post.audienceEmoji}</span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className="text-sm font-medium text-purple-400">
                                                                                {post.audienceName}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                                                post.status === 'approved'
                                                                                    ? 'bg-green-500/20 text-green-400'
                                                                                    : post.status === 'rejected'
                                                                                        ? 'bg-red-500/20 text-red-400'
                                                                                        : 'bg-yellow-500/20 text-yellow-400'
                                                                            }`}>
                                                                                {post.status}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                                                                            {post.content}
                                                                        </p>
                                                                        {post.messagingAngle && (
                                                                            <p className="text-xs text-[var(--foreground-muted)] mt-2 italic">
                                                                                Angle: {post.messagingAngle.slice(0, 80)}...
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        {post.status === 'pending' && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => updatePostStatus(post.id, 'approved')}
                                                                                    className="p-2 hover:bg-green-500/20 rounded-lg text-green-400"
                                                                                    title="Approve"
                                                                                >
                                                                                    <Check className="w-4 h-4" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => updatePostStatus(post.id, 'rejected')}
                                                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                                                                    title="Reject"
                                                                                >
                                                                                    <X className="w-4 h-4" />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        <button
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(post.content)
                                                                            }}
                                                                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--foreground-muted)]"
                                                                            title="Copy"
                                                                        >
                                                                            <Copy className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm('Delete this post?')) {
                                                                                    deleteScheduledPost(post.id)
                                                                                }
                                                                            }}
                                                                            className="p-2 hover:bg-red-500/20 rounded-lg text-[var(--foreground-muted)] hover:text-red-400"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}
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
