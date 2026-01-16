'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Eye, Copy, Check, Loader2, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface App {
    id: string
    name: string
    tagline: string
    description: string
    app_url: string
    icon_url: string
    status: string
    screenshot_1: string | null
    screenshot_2: string | null
    screenshot_3: string | null
    free_features: string[] | null
    pro_features: string[] | null
    pro_price: number | null
}

interface BrandSettings {
    brandVoice: string
    tone: string
    speakingPerspective: string
    emojiStyle: string
    exclusionWords: string
    defaultHashtags: string
}

interface GeneratedContent {
    mainPost: string
    imageUrl: string
    poll: {
        question: string
        options: string[]
    }
}

export default function AIFleetPage() {
    const supabase = createClient()

    // Brand settings from localStorage
    const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null)

    const [apps, setApps] = useState<App[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAppId, setSelectedAppId] = useState('')
    const [appName, setAppName] = useState('')
    const [tagline, setTagline] = useState('')
    const [appUrl, setAppUrl] = useState('')
    const [iconUrl, setIconUrl] = useState('')
    const [screenshots, setScreenshots] = useState<string[]>([])
    const [customText, setCustomText] = useState('')
    const [buildNumber, setBuildNumber] = useState('')
    const [lastBuildNumber, setLastBuildNumber] = useState<number>(0)

    // App features
    const [freeFeatures, setFreeFeatures] = useState<string[]>([])
    const [proFeatures, setProFeatures] = useState<string[]>([])

    // Poll options
    const [pollOptions, setPollOptions] = useState(['', '', '', ''])

    // Generated content
    const [generating, setGenerating] = useState(false)
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
    const [copiedMain, setCopiedMain] = useState(false)
    const [addingToQueue, setAddingToQueue] = useState(false)
    const [queueSuccess, setQueueSuccess] = useState(false)

    // Load last build number and brand settings from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('aiFleetLastBuild')
        if (saved) {
            const num = parseInt(saved, 10)
            setLastBuildNumber(num)
            setBuildNumber(String(num + 1))
        }

        // Load brand settings
        const brandSettingsJson = localStorage.getItem('cadence_brand_settings')
        if (brandSettingsJson) {
            try {
                setBrandSettings(JSON.parse(brandSettingsJson))
            } catch (e) {
                console.error('Failed to parse brand settings:', e)
            }
        }
    }, [])

    // Fetch apps from Supabase
    useEffect(() => {
        async function loadApps() {
            try {
                const { data, error } = await supabase
                    .from('apps')
                    .select('*')
                    .in('status', ['published', 'approved', 'featured'])
                    .order('created_at', { ascending: false })

                if (error) throw error
                setApps(data || [])
            } catch (error) {
                console.error('Error loading apps:', error)
            } finally {
                setLoading(false)
            }
        }
        loadApps()
    }, [supabase])

    // Auto-fill when app is selected
    const handleAppSelect = (appId: string) => {
        setSelectedAppId(appId)
        const selectedApp = apps.find(app => app.id === appId)

        if (selectedApp) {
            setAppName(selectedApp.name)
            setTagline(selectedApp.tagline || selectedApp.description || '')
            setAppUrl(selectedApp.app_url || '')
            setIconUrl(selectedApp.icon_url || '')
            const ss = [
                selectedApp.screenshot_1,
                selectedApp.screenshot_2,
                selectedApp.screenshot_3
            ].filter((s): s is string => !!s)
            setScreenshots(ss)
            // Set features
            setFreeFeatures(selectedApp.free_features || [])
            setProFeatures(selectedApp.pro_features || [])
        }
    }

    // Update poll option
    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions]
        newOptions[index] = value
        setPollOptions(newOptions)
    }

    // Check if poll options are filled
    const hasPollOptions = pollOptions.some(o => o.trim())
    const allPollOptionsFilled = pollOptions.every(o => o.trim())

    // Generate everything
    const generatePost = async () => {
        setGenerating(true)
        setGeneratedContent(null)

        try {
            // 1. Generate the image
            const imageResponse = await fetch('/api/generate-fleet-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appName, tagline, iconUrl, screenshots, buildNumber })
            })
            const { imageUrl: generatedImageUrl, buildNumber: usedBuildNum } = await imageResponse.json()

            // Save build number
            if (usedBuildNum) {
                const num = parseInt(usedBuildNum, 10)
                localStorage.setItem('aiFleetLastBuild', String(num))
                setLastBuildNumber(num)
            }

            // 2. Generate main post text with AI (ai_fleet mode for punchy format)
            let mainPost = customText
            if (!mainPost) {
                const postResponse = await fetch('/api/generate-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `${appName} - ${tagline}`,
                        platform: 'x',
                        mode: 'ai_fleet',
                        buildNumber: buildNumber,
                        freeFeatures: freeFeatures,
                        proFeatures: proFeatures
                    })
                })
                const postData = await postResponse.json()
                mainPost = postData.post || `AI Fleet #${buildNumber}: ${appName}\n\n${tagline}`
            }

            // 3. Generate poll (if options provided)
            let poll = { question: '', options: [] as string[] }
            if (allPollOptionsFilled) {
                const pollResponse = await fetch('/api/generate-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'AI Fleet poll',
                        platform: 'x',
                        mode: 'poll',
                        pollOptions: pollOptions
                    })
                })
                const pollData = await pollResponse.json()
                if (pollData.success && pollData.poll) {
                    poll = {
                        question: pollData.poll.question,
                        options: pollData.poll.options
                    }
                }
            }

            setGeneratedContent({
                mainPost,
                imageUrl: generatedImageUrl,
                poll
            })
        } catch (error) {
            console.error('Error generating post:', error)
            alert('Failed to generate post. Please try again.')
        } finally {
            setGenerating(false)
        }
    }

    const copyMainPost = () => {
        if (!generatedContent) return
        navigator.clipboard.writeText(generatedContent.mainPost)
        setCopiedMain(true)
        setTimeout(() => setCopiedMain(false), 2000)
    }

    const addToQueue = async () => {
        if (!generatedContent) return

        setAddingToQueue(true)
        try {
            // Add to queue with poll data if available
            const response = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'x',
                    content_type: 'ai_fleet',
                    app_id: selectedAppId || null,
                    post_text: generatedContent.mainPost,
                    reply_text: generatedContent.poll.question ? JSON.stringify(generatedContent.poll) : '',
                    is_thread: true,
                    images: [generatedContent.imageUrl, ...screenshots].filter(Boolean)
                })
            })

            if (response.ok) {
                setQueueSuccess(true)
                setTimeout(() => setQueueSuccess(false), 5000)
            } else {
                throw new Error('Failed to add to queue')
            }
        } catch (error) {
            console.error('Error adding to queue:', error)
            alert('Failed to add to queue. Please try again.')
        } finally {
            setAddingToQueue(false)
        }
    }

    const canGenerate = appName && tagline && appUrl && iconUrl && (!hasPollOptions || allPollOptionsFilled)

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">AI Fleet Builder</h1>
                <p className="text-[var(--foreground-muted)]">
                    Generate app launch posts with optional poll
                </p>
            </div>

            {/* Flywheel Diagram */}
            <div className="card p-6 mb-6">
                <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
                    <span className="px-3 py-1.5 bg-[var(--primary)]/20 text-[var(--primary)] rounded-full font-medium">Your Deposit</span>
                    <span className="text-[var(--foreground-muted)]">→</span>
                    <span className="px-3 py-1.5 bg-[var(--surface)] text-[var(--foreground)] rounded-full">Generates Yield</span>
                    <span className="text-[var(--foreground-muted)]">→</span>
                    <span className="px-3 py-1.5 bg-[var(--surface)] text-[var(--foreground)] rounded-full">Funds Apps</span>
                    <span className="text-[var(--foreground-muted)]">→</span>
                    <span className="px-3 py-1.5 bg-[var(--surface)] text-[var(--foreground)] rounded-full">Apps Generate Revenue</span>
                    <span className="text-[var(--foreground-muted)]">→</span>
                    <span className="px-3 py-1.5 bg-[var(--surface)] text-[var(--foreground)] rounded-full">Revenue Funds Vault</span>
                    <span className="text-[var(--foreground-muted)]">→</span>
                    <span className="px-3 py-1.5 bg-[var(--success)]/20 text-[var(--success)] rounded-full font-medium">Larger Deposit ↻</span>
                </div>
                <p className="text-center text-[var(--foreground-muted)] text-sm mt-4">
                    The AI Fleet builds autonomous revenue-generating apps. All profits flow to the Treasury, which earns yield and benefits depositors.
                    <a href="https://getsuite.app/learn/ai-fleet-manifesto" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline ml-1">
                        Learn more →
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Form */}
                <div className="card p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">App Details</h2>

                    {/* App Icon */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            App Icon
                        </label>
                        <div className="w-full px-4 py-4 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg flex items-center justify-center">
                            {iconUrl ? (
                                <img
                                    src={iconUrl}
                                    alt="App icon"
                                    className="w-20 h-20 rounded-xl object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/suite-mascot.png' }}
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-[var(--surface)] flex items-center justify-center text-4xl">
                                    📱
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Select App */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Select App
                        </label>
                        {loading ? (
                            <div className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-[var(--foreground-muted)]" />
                                <span className="text-[var(--foreground-muted)]">Loading apps...</span>
                            </div>
                        ) : (
                            <select
                                value={selectedAppId}
                                onChange={(e) => handleAppSelect(e.target.value)}
                                className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                            >
                                <option value="">Choose an app...</option>
                                {apps.map(app => (
                                    <option key={app.id} value={app.id}>
                                        📱 {app.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Build Number */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Build Number
                        </label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                value={buildNumber}
                                onChange={(e) => setBuildNumber(e.target.value)}
                                placeholder="e.g. 42"
                                className="w-32 px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                            />
                            {lastBuildNumber > 0 && (
                                <span className="text-sm text-[var(--foreground-muted)]">
                                    Last: #{lastBuildNumber}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Tagline */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Tagline
                        </label>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            placeholder="Snap, scan & understand your nutrition instantly"
                            className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                        />
                    </div>

                    {/* App URL */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            App URL
                        </label>
                        <input
                            type="url"
                            value={appUrl}
                            onChange={(e) => setAppUrl(e.target.value)}
                            placeholder="https://foodvitals.getsuite.app"
                            className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                        />
                    </div>

                    {/* Screenshots */}
                    {screenshots.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Screenshots ({screenshots.length})
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {screenshots.map((ss, idx) => (
                                    <img
                                        key={idx}
                                        src={ss}
                                        alt={`Screenshot ${idx + 1}`}
                                        className="w-full h-24 object-cover rounded-lg border border-[var(--surface-border)]"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Text */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Custom Post Text <span className="text-[var(--foreground-muted)] font-normal">(optional - leave empty for AI)</span>
                        </label>
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Leave empty to let AI generate the post text..."
                            rows={3}
                            className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--surface-border)] pt-4">
                        <h3 className="text-md font-semibold text-[var(--foreground)] mb-2">
                            Poll Options <span className="text-[var(--foreground-muted)] font-normal text-sm">(optional)</span>
                        </h3>
                        <p className="text-xs text-[var(--foreground-muted)] mb-3">
                            Add 4 app ideas to include a poll as the reply. Leave empty for no poll.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            {[0, 1, 2, 3].map((index) => (
                                <input
                                    key={index}
                                    type="text"
                                    value={pollOptions[index]}
                                    onChange={(e) => updatePollOption(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm"
                                />
                            ))}
                        </div>

                        {hasPollOptions && !allPollOptionsFilled && (
                            <p className="text-xs text-amber-500 mt-2">
                                Fill all 4 options to include a poll, or clear all to skip.
                            </p>
                        )}
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={generatePost}
                        disabled={!canGenerate || generating}
                        className="btn btn-primary w-full"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generate Post{allPollOptionsFilled ? ' + Poll' : ''}
                            </>
                        )}
                    </button>

                    {brandSettings && (
                        <p className="text-xs text-[var(--success)] text-center">
                            Using your brand voice settings
                        </p>
                    )}
                </div>

                {/* Preview */}
                <div className="card p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Preview</h2>

                    {!generatedContent ? (
                        <div className="flex items-center justify-center h-64 bg-[var(--surface)] rounded-lg border-2 border-dashed border-[var(--surface-border)]">
                            <div className="text-center">
                                <Eye className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-2" />
                                <p className="text-[var(--foreground-muted)]">Fill in the form and click generate</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Post 1: Main Post with Image */}
                            <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--surface-border)]">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-[var(--primary)]">
                                        Post 1: Main Post (with image)
                                    </label>
                                    <button
                                        onClick={copyMainPost}
                                        className="text-xs flex items-center gap-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                    >
                                        {copiedMain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copiedMain ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                {generatedContent.imageUrl && (
                                    <div className="rounded-lg overflow-hidden border border-[var(--surface-border)] mb-3">
                                        <img src={generatedContent.imageUrl} alt="Generated post card" className="w-full" />
                                    </div>
                                )}
                                <textarea
                                    value={generatedContent.mainPost}
                                    onChange={(e) => setGeneratedContent({ ...generatedContent, mainPost: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)] font-sans resize-y"
                                />
                            </div>

                            {/* Post 2: Poll Reply (if poll options were provided) */}
                            {generatedContent.poll.question && (
                                <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--surface-border)]">
                                    <label className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">
                                        Post 2: Poll Reply
                                    </label>
                                    <div className="bg-[var(--background)] p-4 rounded-lg border border-[var(--surface-border)]">
                                        <p className="text-sm font-medium text-[var(--foreground)] mb-3">
                                            {generatedContent.poll.question}
                                        </p>
                                        <div className="space-y-2">
                                            {generatedContent.poll.options.map((option, idx) => (
                                                <div
                                                    key={idx}
                                                    className="px-4 py-2 bg-[var(--surface)] rounded-full text-sm text-[var(--foreground)] border border-[var(--surface-border)]"
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-[var(--foreground-muted)] mt-3">
                                            24 hour poll • No images (Twitter limitation)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Thread indicator */}
                            <div className="text-center text-xs text-[var(--foreground-muted)] py-2">
                                {generatedContent.poll.question
                                    ? 'These will be posted as a thread: main post → poll reply'
                                    : 'This will be posted as a single post with image'}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={generatePost}
                                    disabled={generating}
                                    className="btn btn-secondary flex-1"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Regenerate
                                </button>
                                <button
                                    onClick={addToQueue}
                                    disabled={addingToQueue}
                                    className="btn btn-primary flex-1"
                                >
                                    {addingToQueue ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Adding...
                                        </>
                                    ) : queueSuccess ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Added!
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-4 h-4" />
                                            Add to Queue
                                        </>
                                    )}
                                </button>
                            </div>
                            {queueSuccess && (
                                <a href="/queue" className="btn btn-secondary w-full text-center">
                                    View Queue →
                                </a>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
