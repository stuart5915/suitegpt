'use client'

import { useState, useEffect } from 'react'
import { PanelContentProps } from '../ExtensionPanelManager'
import {
    FileText,
    Send,
    RefreshCw,
    Loader2,
    Check,
    Sparkles,
    Settings2,
    ChevronDown
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

export default function ArticleWriterPanel({ mode, initialData, onComplete }: PanelContentProps) {
    // State
    const [draft, setDraft] = useState('')
    const [title, setTitle] = useState('')
    const [currentArticle, setCurrentArticle] = useState('')
    const [refineInput, setRefineInput] = useState('')
    const [iterations, setIterations] = useState(0)

    const [styleSettings, setStyleSettings] = useState<Record<string, StyleSetting>>(DEFAULT_STYLE_SETTINGS)
    const [showSettings, setShowSettings] = useState(false)

    const [pills, setPills] = useState<ExpansionPill[]>([])
    const [selectedPills, setSelectedPills] = useState<Set<number>>(new Set())

    const [isRefining, setIsRefining] = useState(false)
    const [isGeneratingPills, setIsGeneratingPills] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

        // Load initial data if passed
        if (initialData?.draft) {
            setDraft(initialData.draft as string)
        }
        if (initialData?.title) {
            setTitle(initialData.title as string)
        }
    }, [initialData])

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
                // Remove from input
                setRefineInput(r => r.split('\n\n').filter(p => p.trim() !== prompt.trim()).join('\n\n'))
            } else {
                newSet.add(index)
                // Add to input
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
            setError(null)
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with Settings Toggle */}
            <div className="p-4 border-b border-[var(--surface-border)]">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-lg">Article Writer</h3>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            showSettings
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-[var(--surface-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Settings2 className="w-4 h-4" />
                        Style
                        <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <p className="text-sm text-[var(--foreground-muted)]">
                    Paste your draft, refine with AI
                </p>
            </div>

            {/* Style Settings (collapsible) */}
            {showSettings && (
                <div className="p-4 border-b border-[var(--surface-border)] bg-[var(--background)]">
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(styleSettings).map(([key, setting]) => (
                            <button
                                key={key}
                                onClick={() => toggleSetting(key)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                    setting.active
                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)] border border-transparent hover:border-[var(--surface-border)]'
                                }`}
                            >
                                {setting.active && <Check className="w-3 h-3" />}
                                {setting.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Draft Input */}
                <div>
                    <label className="text-xs font-semibold text-purple-400 mb-2 block">Your Draft</label>
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Paste your raw idea or draft here... It can be messy, stream-of-consciousness, bullet points - whatever you have."
                        className="w-full min-h-[120px] px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] text-sm resize-y focus:border-purple-500 focus:outline-none"
                        disabled={iterations > 0}
                    />
                </div>

                {/* Title Input (after first refinement) */}
                {iterations > 0 && (
                    <div>
                        <label className="text-xs font-semibold text-purple-400 mb-2 block">Article Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter article title..."
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] text-sm focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                )}

                {/* Refined Article */}
                {currentArticle && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-purple-400">Refined Article</label>
                            <button
                                onClick={copyArticle}
                                className="text-xs text-[var(--foreground-muted)] hover:text-purple-400 transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                            {currentArticle}
                        </div>
                    </div>
                )}

                {/* Expansion Pills */}
                {pills.length > 0 && (
                    <div>
                        <label className="text-xs text-[var(--foreground-muted)] mb-2 block">
                            Click to add expansion prompts:
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {isGeneratingPills ? (
                                <span className="text-xs text-[var(--foreground-muted)]">Generating suggestions...</span>
                            ) : (
                                pills.map((pill, index) => (
                                    <button
                                        key={index}
                                        onClick={() => togglePill(index, pill.prompt)}
                                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                                            selectedPills.has(index)
                                                ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                                                : 'bg-purple-500/10 border-purple-500/30 text-[var(--foreground-muted)] hover:bg-purple-500/20'
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
                <div>
                    <label className="text-xs font-semibold text-[var(--foreground-muted)] mb-2 block">
                        Refinement Instructions
                    </label>
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
                        className="w-full min-h-[60px] px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] text-sm resize-y focus:border-purple-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--surface-border)] space-y-3">
                {/* Iteration Count */}
                {iterations > 0 && (
                    <div className="text-xs text-[var(--foreground-muted)] text-center">
                        Iteration {iterations}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={resetWriter}
                        className="flex-1 py-2.5 px-4 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--foreground-muted)] rounded-lg text-sm font-medium transition-colors"
                    >
                        Start Over
                    </button>
                    <button
                        onClick={sendRefinement}
                        disabled={isRefining || (!draft && !currentArticle)}
                        className="flex-1 py-2.5 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isRefining ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Refining...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Refine
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
