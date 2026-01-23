'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    ChevronLeft,
    FileText,
    Send,
    RefreshCw,
    Loader2,
    Check,
    Sparkles,
    Settings2,
    ChevronDown,
    Copy,
    CheckCircle
} from 'lucide-react'

interface StyleSetting {
    active: boolean
    prompt: string
    label: string
}

interface ExpansionPill {
    emoji: string
    label: string
    prompt: string
}

const DEFAULT_STYLE_SETTINGS: Record<string, StyleSetting> = {
    noDashes: { active: false, prompt: 'Do NOT use em dashes (—) or en dashes (–). Use commas, periods, or restructure sentences instead.', label: 'No dashes (—)' },
    noBullets: { active: false, prompt: 'Do NOT use bullet points or numbered lists. Write in flowing prose paragraphs.', label: 'No bullet points' },
    noSubheadings: { active: false, prompt: 'Do NOT use subheadings or section headers. Write as continuous prose.', label: 'No subheadings' },
    shortParagraphs: { active: false, prompt: 'Keep paragraphs short - 2-3 sentences max. Use white space liberally.', label: 'Short paragraphs' },
    moreCasual: { active: false, prompt: 'Use a very casual, conversational tone. Like texting a friend.', label: 'More casual' },
    noQuestions: { active: false, prompt: 'Do NOT use rhetorical questions. Make direct statements instead.', label: 'No rhetorical Q\'s' },
    noEmojis: { active: false, prompt: 'Do NOT use any emojis.', label: 'No emojis' },
    minimalAdjectives: { active: false, prompt: 'Use minimal adjectives and adverbs. Be direct and spare with description.', label: 'Minimal adjectives' },
    noHedging: { active: false, prompt: 'Avoid hedging phrases like "I think", "I feel", "maybe", "perhaps". Be direct.', label: 'No "I think/feel"' },
    directStatements: { active: false, prompt: 'Make direct, assertive statements. No wishy-washy language.', label: 'Direct statements' }
}

const FALLBACK_PILLS: ExpansionPill[] = [
    { emoji: '💭', label: 'Go deeper', prompt: 'Expand on the main idea with more depth and nuance' },
    { emoji: '📖', label: 'Add example', prompt: 'Add a concrete example or analogy to illustrate the point' },
    { emoji: '🔗', label: 'Connect ideas', prompt: 'Connect this to related themes or broader philosophy' },
    { emoji: '⚡', label: 'More personal', prompt: 'Add more personal voice and authentic touches' },
    { emoji: '🌍', label: 'Bigger picture', prompt: 'Tie this to broader implications for humanity' }
]

export default function ArticleWriterPage() {
    // State
    const [draft, setDraft] = useState('')
    const [title, setTitle] = useState('')
    const [currentArticle, setCurrentArticle] = useState('')
    const [refineInput, setRefineInput] = useState('')
    const [iterations, setIterations] = useState(0)

    const [styleSettings, setStyleSettings] = useState<Record<string, StyleSetting>>(DEFAULT_STYLE_SETTINGS)
    const [showSettings, setShowSettings] = useState(true)

    const [pills, setPills] = useState<ExpansionPill[]>([])
    const [selectedPills, setSelectedPills] = useState<Set<number>>(new Set())

    const [isRefining, setIsRefining] = useState(false)
    const [isGeneratingPills, setIsGeneratingPills] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Load settings from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('articleWriterSettings')
            if (saved) {
                const parsed = JSON.parse(saved)
                setStyleSettings(prev => {
                    const updated = { ...prev }
                    for (const key of Object.keys(parsed)) {
                        if (updated[key]) {
                            updated[key] = { ...updated[key], active: true }
                        }
                    }
                    return updated
                })
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }, [])

    // Save settings
    const saveSettings = (settings: Record<string, StyleSetting>) => {
        const active: Record<string, boolean> = {}
        for (const [key, val] of Object.entries(settings)) {
            if (val.active) active[key] = true
        }
        localStorage.setItem('articleWriterSettings', JSON.stringify(active))
    }

    // Toggle setting
    const toggleSetting = (key: string) => {
        setStyleSettings(prev => {
            const updated = {
                ...prev,
                [key]: { ...prev[key], active: !prev[key].active }
            }
            saveSettings(updated)
            return updated
        })
    }

    // Get active style prompts
    const getStylePrompts = () => {
        const active = Object.entries(styleSettings)
            .filter(([_, s]) => s.active)
            .map(([_, s]) => s.prompt)
        return active.length > 0 ? '\n\nSTYLE REQUIREMENTS:\n' + active.map(p => '- ' + p).join('\n') : ''
    }

    // Send refinement
    const sendRefinement = async () => {
        if (!draft && !currentArticle) {
            setError('Please enter a draft first')
            return
        }

        let instructions = refineInput.trim()
        if (!instructions && iterations === 0) {
            instructions = 'Clean this up and make it flow better while keeping my voice'
            setRefineInput(instructions)
        }

        const finalInstructions = instructions || 'Continue refining'
        setIsRefining(true)
        setError(null)

        try {
            const contentToRefine = currentArticle || draft
            const isFirstPass = iterations === 0

            const response = await fetch('/api/ai/refine-article', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: contentToRefine,
                    instructions: finalInstructions,
                    stylePrompts: getStylePrompts(),
                    isFirstPass
                })
            })

            if (!response.ok) {
                throw new Error('Failed to refine article')
            }

            const data = await response.json()
            const refinedText = data.refined || ''

            setCurrentArticle(refinedText)
            setIterations(prev => prev + 1)
            setRefineInput('')
            setSelectedPills(new Set())

            // Generate expansion pills
            generateExpansionPills(refinedText, finalInstructions)

        } catch (err) {
            console.error('Refinement error:', err)
            setError('Error refining article. Please try again.')
        } finally {
            setIsRefining(false)
        }
    }

    // Generate expansion pills
    const generateExpansionPills = async (articleContent: string, lastInstruction: string) => {
        setIsGeneratingPills(true)

        try {
            const response = await fetch('/api/ai/generate-pills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: articleContent.slice(0, 1500),
                    lastInstruction
                })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.pills && Array.isArray(data.pills)) {
                    setPills(data.pills)
                } else {
                    setPills(FALLBACK_PILLS)
                }
            } else {
                setPills(FALLBACK_PILLS)
            }
        } catch (err) {
            console.error('Pills error:', err)
            setPills(FALLBACK_PILLS)
        } finally {
            setIsGeneratingPills(false)
        }
    }

    // Toggle pill selection
    const togglePill = (index: number, prompt: string) => {
        setSelectedPills(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
                setRefineInput(r => r.split('\n\n').filter(p => p.trim() !== prompt.trim()).join('\n\n'))
            } else {
                newSet.add(index)
                setRefineInput(r => r.trim() ? r + '\n\n' + prompt : prompt)
            }
            return newSet
        })
    }

    // Reset
    const resetWriter = () => {
        if (iterations > 0 && !confirm('Start over? Your current article will be lost.')) {
            return
        }
        setDraft('')
        setTitle('')
        setCurrentArticle('')
        setRefineInput('')
        setIterations(0)
        setPills([])
        setSelectedPills(new Set())
        setError(null)
    }

    // Copy article
    const copyArticle = () => {
        if (currentArticle) {
            navigator.clipboard.writeText(currentArticle)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const activeSettingsCount = Object.values(styleSettings).filter(s => s.active).length

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <div className="flex">
                {/* Left Sidebar - Style Settings */}
                <aside className="w-[220px] flex-shrink-0 p-4 border-r border-[var(--surface-border)] bg-[rgba(10,10,15,0.5)] sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
                    <div className="text-sm font-bold text-purple-400 mb-4 pb-3 border-b border-[var(--surface-border)]">
                        Style Preferences
                    </div>
                    <div className="space-y-1">
                        {Object.entries(styleSettings).map(([key, setting]) => (
                            <div
                                key={key}
                                className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)]"
                            >
                                <span className="text-xs text-[var(--foreground)]">{setting.label}</span>
                                <button
                                    onClick={() => toggleSetting(key)}
                                    className={`relative w-9 h-5 rounded-full transition-colors ${
                                        setting.active ? 'bg-purple-500' : 'bg-[rgba(255,255,255,0.1)]'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                            setting.active ? 'translate-x-4' : ''
                                        }`}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 max-w-[900px] mx-auto p-8">
                    {/* Back Link */}
                    <Link
                        href="/extensions"
                        className="inline-flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Extensions
                    </Link>

                    {/* Header */}
                    <header className="text-center mb-10">
                        <h1 className="text-4xl font-black bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent mb-2">
                            Article Writer
                        </h1>
                        <p className="text-[var(--foreground-muted)]">
                            Paste your draft. Refine with AI. Publish.
                        </p>
                    </header>

                    {/* Writer Card */}
                    <div className="bg-[rgba(20,20,30,0.8)] border border-[var(--surface-border)] rounded-2xl overflow-hidden">
                        {/* Error Message */}
                        {error && (
                            <div className="p-4 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Draft Input */}
                        <div className="p-6 border-b border-[var(--surface-border)]">
                            <div className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Your Draft
                            </div>
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Paste your raw idea or draft here... It can be messy, stream-of-consciousness, bullet points - whatever you have."
                                className="w-full min-h-[120px] px-4 py-3 bg-[rgba(0,0,0,0.3)] border border-[var(--surface-border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] resize-y focus:border-purple-500 focus:outline-none focus:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                                disabled={iterations > 0}
                            />
                        </div>

                        {/* Title Input (after first refinement) */}
                        {iterations > 0 && (
                            <div className="p-6 border-b border-[var(--surface-border)]">
                                <div className="text-sm font-bold text-purple-400 mb-3">Article Title</div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter article title..."
                                    className="w-full px-4 py-3 bg-[rgba(0,0,0,0.3)] border border-[var(--surface-border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] text-lg font-bold focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        )}

                        {/* Refined Article */}
                        {currentArticle && (
                            <div className="p-6 border-b border-[var(--surface-border)]">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        Refined Article
                                    </div>
                                    <button
                                        onClick={copyArticle}
                                        className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-purple-400 transition-colors"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle className="w-3 h-3" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="p-5 bg-[rgba(168,85,247,0.05)] border border-[rgba(168,85,247,0.2)] rounded-xl whitespace-pre-wrap leading-relaxed min-h-[200px]">
                                    {currentArticle}
                                </div>
                            </div>
                        )}

                        {/* Expansion Pills */}
                        {pills.length > 0 && (
                            <div className="p-5 border-b border-[var(--surface-border)]">
                                <div className="text-xs text-[var(--foreground-muted)] mb-3">
                                    Click to add expansion prompts:
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {isGeneratingPills ? (
                                        <span className="text-sm text-[var(--foreground-muted)]">Generating suggestions...</span>
                                    ) : (
                                        pills.map((pill, index) => (
                                            <button
                                                key={index}
                                                onClick={() => togglePill(index, pill.prompt)}
                                                className={`px-4 py-2 rounded-full text-sm transition-all ${
                                                    selectedPills.has(index)
                                                        ? 'bg-[rgba(168,85,247,0.4)] border-purple-500'
                                                        : 'bg-[rgba(168,85,247,0.15)] border-[rgba(168,85,247,0.3)] hover:bg-[rgba(168,85,247,0.25)]'
                                                } border`}
                                            >
                                                {pill.emoji} {pill.label}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Refine Input */}
                        <div className="p-5 flex gap-3 items-end">
                            <textarea
                                value={refineInput}
                                onChange={(e) => setRefineInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        sendRefinement()
                                    }
                                }}
                                placeholder="Type instructions or click pills above... e.g., 'clean this up' or 'make it more personal'"
                                className="flex-1 min-h-[60px] max-h-[150px] px-4 py-3 bg-[rgba(0,0,0,0.3)] border border-[var(--surface-border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] resize-none focus:border-purple-500 focus:outline-none"
                            />
                            <button
                                onClick={sendRefinement}
                                disabled={isRefining || (!draft && !currentArticle)}
                                className="px-7 py-3.5 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(168,85,247,0.3)]"
                            >
                                {isRefining ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Refine'
                                )}
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="p-5 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-sm text-[var(--foreground-muted)]">
                                {iterations > 0 ? `Iteration ${iterations}` : ''}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={resetWriter}
                                    className="px-6 py-3 bg-transparent border border-[var(--surface-border)] text-[var(--foreground-muted)] font-semibold rounded-lg hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all"
                                >
                                    Start Over
                                </button>
                                <button
                                    disabled={!currentArticle}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(16,185,129,0.3)]"
                                >
                                    Publish
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
