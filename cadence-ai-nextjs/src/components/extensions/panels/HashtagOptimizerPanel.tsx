'use client'

import { useState } from 'react'
import { PanelContentProps } from '../ExtensionPanelManager'
import { Hash, Copy, Check, Sparkles, TrendingUp, Loader2 } from 'lucide-react'

const SAMPLE_HASHTAGS = [
    { tag: '#AI', score: 95, trend: 'up' },
    { tag: '#TechStartup', score: 88, trend: 'up' },
    { tag: '#BuildInPublic', score: 82, trend: 'stable' },
    { tag: '#SaaS', score: 78, trend: 'up' },
    { tag: '#Productivity', score: 75, trend: 'stable' },
    { tag: '#Marketing', score: 72, trend: 'down' },
]

export default function HashtagOptimizerPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const [content, setContent] = useState((initialData?.content as string) || '')
    const [analyzing, setAnalyzing] = useState(false)
    const [hashtags, setHashtags] = useState<typeof SAMPLE_HASHTAGS>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [copied, setCopied] = useState(false)

    const handleAnalyze = async () => {
        if (!content.trim()) return
        setAnalyzing(true)

        // Simulate AI analysis
        await new Promise(resolve => setTimeout(resolve, 1500))
        setHashtags(SAMPLE_HASHTAGS)
        setAnalyzing(false)
    }

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        )
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(selectedTags.join(' '))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        if (onComplete) onComplete({ hashtags: selectedTags })
    }

    const handleApply = () => {
        if (onComplete) onComplete({ hashtags: selectedTags })
    }

    return (
        <div className="p-4 space-y-4">
            {/* Content Input */}
            <div>
                <label className="block text-sm font-medium mb-2">Post Content</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste your post content to get AI-suggested hashtags..."
                    rows={4}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm resize-none"
                />
            </div>

            {/* Analyze Button */}
            <button
                onClick={handleAnalyze}
                disabled={analyzing || !content.trim()}
                className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
            >
                {analyzing ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        Get Hashtag Suggestions
                    </>
                )}
            </button>

            {/* Hashtag Suggestions */}
            {hashtags.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Suggested Hashtags</h3>
                        <span className="text-xs text-[var(--foreground-muted)]">
                            {selectedTags.length} selected
                        </span>
                    </div>

                    <div className="space-y-1">
                        {hashtags.map(h => (
                            <button
                                key={h.tag}
                                onClick={() => toggleTag(h.tag)}
                                className={`w-full p-3 rounded-lg border text-left flex items-center justify-between ${
                                    selectedTags.includes(h.tag)
                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                        : 'border-[var(--surface-border)] bg-[var(--surface)]'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-[var(--primary)]" />
                                    <span className="font-medium text-sm">{h.tag}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--foreground-muted)]">
                                        Score: {h.score}
                                    </span>
                                    {h.trend === 'up' && (
                                        <TrendingUp className="w-3 h-3 text-green-500" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {selectedTags.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleCopy}
                                className="flex-1 btn bg-[var(--surface)] text-sm py-2 flex items-center justify-center gap-1"
                            >
                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                                onClick={handleApply}
                                className="flex-1 btn btn-primary text-sm py-2"
                            >
                                Apply to Post
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Free Badge */}
            <div className="text-center py-4 border-t border-[var(--surface-border)]">
                <span className="text-xs text-green-500 font-medium">
                    Free Extension
                </span>
            </div>
        </div>
    )
}
