'use client'

import { useState, useEffect } from 'react'
import { Upload, Sparkles, Send, Eye, Copy, Check, Loader2, Calendar } from 'lucide-react'
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
}

export default function AIFleetPage() {
    const supabase = createClient()

    const [apps, setApps] = useState<App[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAppId, setSelectedAppId] = useState('')
    const [appName, setAppName] = useState('')
    const [tagline, setTagline] = useState('')
    const [appUrl, setAppUrl] = useState('')
    const [iconUrl, setIconUrl] = useState('')
    const [screenshots, setScreenshots] = useState<string[]>([])
    const [customText, setCustomText] = useState('')
    const [generatedPost, setGeneratedPost] = useState('')
    const [generating, setGenerating] = useState(false)
    const [imageUrl, setImageUrl] = useState('')
    const [copied, setCopied] = useState(false)
    const [addingToQueue, setAddingToQueue] = useState(false)
    const [queueSuccess, setQueueSuccess] = useState(false)

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
            // Set screenshots
            const ss = [
                selectedApp.screenshot_1,
                selectedApp.screenshot_2,
                selectedApp.screenshot_3
            ].filter((s): s is string => !!s)
            setScreenshots(ss)
        }
    }

    const generatePost = async () => {
        setGenerating(true)

        // Generate image from template
        try {
            // Call API to screenshot the template
            const response = await fetch('/api/generate-fleet-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appName, tagline, iconUrl, screenshots })
            })

            const { imageUrl: generatedImageUrl } = await response.json()
            setImageUrl(generatedImageUrl)

            // Generate post text
            const postText = customText || `🚀 Just launched: ${appName}!

${tagline}

Try it free → ${appUrl}

💎 Stake ETH/USDC to fund development → getsuite.app/wallet

#buildinpublic #ai #defi #apps`

            setGeneratedPost(postText)
        } catch (error) {
            console.error('Error generating post:', error)
        } finally {
            setGenerating(false)
        }
    }

    const copyPost = () => {
        navigator.clipboard.writeText(generatedPost)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const addToQueue = async () => {
        setAddingToQueue(true)
        try {
            const response = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'x',
                    content_type: 'ai_fleet',
                    app_id: selectedAppId || null,
                    post_text: generatedPost,
                    images: [imageUrl, ...screenshots].filter(Boolean)
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

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">🚀 AI Fleet Builder</h1>
                <p className="text-[var(--foreground-muted)]">
                    Post your daily app launch announcements
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
                        <p className="text-xs text-[var(--foreground-muted)] mt-1">
                            {iconUrl ? 'Icon loaded from app' : 'Select an app to load icon'}
                        </p>
                    </div>

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
                        <p className="text-xs text-[var(--foreground-muted)] mt-1">
                            Automatically fills icon, tagline, and URL
                        </p>
                    </div>

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

                    {/* Screenshots Section */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Screenshots ({screenshots.length}/3)
                        </label>
                        {screenshots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {screenshots.map((ss, idx) => (
                                    <img
                                        key={idx}
                                        src={ss}
                                        alt={`Screenshot ${idx + 1}`}
                                        className="w-full h-32 object-cover rounded-lg border border-[var(--surface-border)]"
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full px-4 py-6 bg-[var(--surface)] border border-dashed border-[var(--surface-border)] rounded-lg text-center text-[var(--foreground-muted)]">
                                No screenshots available
                            </div>
                        )}
                        <p className="text-xs text-[var(--foreground-muted)] mt-1">
                            {screenshots.length > 0
                                ? 'Include these in your X post (4 images max)'
                                : 'Add screenshots in Start Building page'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Custom Text (optional)
                        </label>
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Leave empty to use default template..."
                            rows={4}
                            className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                        />
                    </div>

                    <button
                        onClick={generatePost}
                        disabled={!appName || !tagline || !appUrl || !iconUrl || generating}
                        className="btn btn-primary w-full"
                    >
                        {generating ? (
                            <>
                                <Sparkles className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generate Post
                            </>
                        )}
                    </button>
                </div>

                {/* Preview */}
                <div className="card p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Preview</h2>

                    {!generatedPost ? (
                        <div className="flex items-center justify-center h-64 bg-[var(--surface)] rounded-lg border-2 border-dashed border-[var(--surface-border)]">
                            <div className="text-center">
                                <Eye className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-2" />
                                <p className="text-[var(--foreground-muted)]">Fill in the form and click generate</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Image Preview */}
                            {imageUrl && (
                                <div className="rounded-lg overflow-hidden border border-[var(--surface-border)]">
                                    <img src={imageUrl} alt="Generated post card" className="w-full" />
                                </div>
                            )}

                            {/* Text Preview - Editable */}
                            <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--surface-border)]">
                                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-2">
                                    Edit post text before copying:
                                </label>
                                <textarea
                                    value={generatedPost}
                                    onChange={(e) => setGeneratedPost(e.target.value)}
                                    rows={8}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)] font-sans resize-y"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={copyPost}
                                    className="btn btn-secondary flex-1"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copy Text
                                        </>
                                    )}
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
                                            Added to Queue!
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-4 h-4" />
                                            Add to Queue
                                        </>
                                    )}
                                </button>
                                {queueSuccess && (
                                    <a href="/queue" className="btn btn-secondary flex-1 text-center">
                                        View Queue →
                                    </a>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
