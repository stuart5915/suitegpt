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

export default function AIFleetSection() {
    const supabase = createClient()

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
    const [freeFeatures, setFreeFeatures] = useState<string[]>([])
    const [proFeatures, setProFeatures] = useState<string[]>([])
    const [pollOptions, setPollOptions] = useState(['', '', '', ''])
    const [generating, setGenerating] = useState(false)
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
    const [copiedMain, setCopiedMain] = useState(false)
    const [addingToQueue, setAddingToQueue] = useState(false)
    const [queueSuccess, setQueueSuccess] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('aiFleetLastBuild')
        if (saved) {
            const num = parseInt(saved, 10)
            setLastBuildNumber(num)
            setBuildNumber(String(num + 1))
        }
        const brandSettingsJson = localStorage.getItem('cadence_brand_settings')
        if (brandSettingsJson) {
            try {
                setBrandSettings(JSON.parse(brandSettingsJson))
            } catch (e) {
                console.error('Failed to parse brand settings:', e)
            }
        }
    }, [])

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

    const handleAppSelect = (appId: string) => {
        setSelectedAppId(appId)
        const selectedApp = apps.find(app => app.id === appId)
        if (selectedApp) {
            setAppName(selectedApp.name)
            setTagline(selectedApp.tagline || selectedApp.description || '')
            setAppUrl(selectedApp.app_url || '')
            setIconUrl(selectedApp.icon_url || '')
            const ss = [selectedApp.screenshot_1, selectedApp.screenshot_2, selectedApp.screenshot_3].filter((s): s is string => !!s)
            setScreenshots(ss)
            setFreeFeatures(selectedApp.free_features || [])
            setProFeatures(selectedApp.pro_features || [])
        }
    }

    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions]
        newOptions[index] = value
        setPollOptions(newOptions)
    }

    const hasPollOptions = pollOptions.some(o => o.trim())
    const allPollOptionsFilled = pollOptions.every(o => o.trim())

    const generatePost = async () => {
        setGenerating(true)
        setGeneratedContent(null)
        try {
            const imageResponse = await fetch('/api/generate-fleet-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appName, tagline, iconUrl, screenshots, buildNumber })
            })
            const imageData = await imageResponse.json()
            // API now returns imageBase64 instead of imageUrl for serverless compatibility
            const generatedImageUrl = imageData.imageBase64 || imageData.imageUrl
            const usedBuildNum = imageData.buildNumber
            if (usedBuildNum) {
                const num = parseInt(usedBuildNum, 10)
                localStorage.setItem('aiFleetLastBuild', String(num))
                setLastBuildNumber(num)
            }

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

            let poll = { question: '', options: [] as string[] }
            if (allPollOptionsFilled) {
                const pollResponse = await fetch('/api/generate-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'AI Fleet poll', platform: 'x', mode: 'poll', pollOptions: pollOptions })
                })
                const pollData = await pollResponse.json()
                if (pollData.success && pollData.poll) {
                    poll = { question: pollData.poll.question, options: pollData.poll.options }
                }
            }
            setGeneratedContent({ mainPost, imageUrl: generatedImageUrl, poll })
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
        <div className="mt-4 pt-4 border-t border-[var(--surface-border)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Form */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-[var(--foreground)]">App Details</h3>

                    {/* App Icon */}
                    <div className="flex items-center gap-4">
                        {iconUrl ? (
                            <img src={iconUrl} alt="App icon" className="w-16 h-16 rounded-xl object-cover" />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-[var(--surface)] flex items-center justify-center text-2xl">📱</div>
                        )}
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Select App</label>
                            {loading ? (
                                <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                                </div>
                            ) : (
                                <select
                                    value={selectedAppId}
                                    onChange={(e) => handleAppSelect(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm"
                                >
                                    <option value="">Choose an app...</option>
                                    {apps.map(app => (
                                        <option key={app.id} value={app.id}>📱 {app.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Build Number & Tagline */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Build #</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={buildNumber}
                                    onChange={(e) => setBuildNumber(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm"
                                />
                            </div>
                            {lastBuildNumber > 0 && (
                                <span className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Last: #{lastBuildNumber}
                                </span>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Tagline</label>
                            <input
                                type="text"
                                value={tagline}
                                onChange={(e) => setTagline(e.target.value)}
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm"
                            />
                        </div>
                    </div>

                    {/* Custom Text */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                            Custom Text <span className="text-[var(--foreground-muted)] font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Leave empty for AI-generated text..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] text-sm"
                        />
                    </div>

                    {/* Poll Options */}
                    <div className="border-t border-[var(--surface-border)] pt-4">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                            Poll Options <span className="text-[var(--foreground-muted)] font-normal">(optional)</span>
                        </h4>
                        <p className="text-xs text-[var(--foreground-muted)] mb-3">
                            Add 4 app ideas to include a poll as the reply.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
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
                    <button onClick={generatePost} disabled={!canGenerate || generating} className="btn btn-primary w-full">
                        {generating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Sparkles className="w-4 h-4" /> Generate Post</>
                        )}
                    </button>
                </div>

                {/* Preview */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-[var(--foreground)]">Preview</h3>
                    {!generatedContent ? (
                        <div className="flex items-center justify-center h-48 bg-[var(--surface)] rounded-lg border-2 border-dashed border-[var(--surface-border)]">
                            <div className="text-center">
                                <Eye className="w-10 h-10 text-[var(--foreground-muted)] mx-auto mb-2" />
                                <p className="text-sm text-[var(--foreground-muted)]">Select an app and generate</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Main Post with Image */}
                            <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--surface-border)]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-[var(--primary)]">Post 1: Main Post (with image)</span>
                                    <button onClick={copyMainPost} className="text-xs flex items-center gap-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                                        {copiedMain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copiedMain ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                {generatedContent.imageUrl ? (
                                    <div className="rounded-lg overflow-hidden border border-[var(--surface-border)] mb-2">
                                        <img
                                            src={generatedContent.imageUrl}
                                            alt="Generated post card"
                                            className="w-full"
                                            onError={(e) => {
                                                console.error('Image failed to load:', generatedContent.imageUrl)
                                                ;(e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] p-4 rounded-lg mb-2 text-center text-sm text-[var(--foreground-muted)]">
                                        No image generated
                                    </div>
                                )}
                                <textarea
                                    value={generatedContent.mainPost}
                                    onChange={(e) => setGeneratedContent({ ...generatedContent, mainPost: e.target.value })}
                                    rows={4}
                                    className="w-full px-2 py-1 bg-[var(--background)] border border-[var(--surface-border)] rounded text-sm text-[var(--foreground)]"
                                />
                            </div>

                            {/* Poll Reply (if poll options were provided) */}
                            {generatedContent.poll.question && (
                                <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--surface-border)]">
                                    <span className="text-xs font-medium text-[var(--foreground-muted)] mb-2 block">
                                        Post 2: Poll Reply
                                    </span>
                                    <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--surface-border)]">
                                        <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                                            {generatedContent.poll.question}
                                        </p>
                                        <div className="space-y-1">
                                            {generatedContent.poll.options.map((option, idx) => (
                                                <div
                                                    key={idx}
                                                    className="px-3 py-1.5 bg-[var(--surface)] rounded-full text-xs text-[var(--foreground)] border border-[var(--surface-border)]"
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button onClick={generatePost} disabled={generating} className="btn btn-secondary flex-1 text-sm">
                                    <Sparkles className="w-4 h-4" /> Regenerate
                                </button>
                                <button onClick={addToQueue} disabled={addingToQueue} className="btn btn-primary flex-1 text-sm">
                                    {addingToQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : queueSuccess ? <Check className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                    {addingToQueue ? 'Adding...' : queueSuccess ? 'Added!' : 'Add to Queue'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
