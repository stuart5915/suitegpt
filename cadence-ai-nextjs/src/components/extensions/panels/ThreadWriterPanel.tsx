'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { logUsage } from '@/lib/extensions/api'
import { ThreadTweet } from '@/lib/extensions/types'
import { PanelContentProps } from '../ExtensionPanelManager'
import {
    Loader2,
    Wand2,
    FileText,
    Link as LinkIcon,
    Plus,
    Trash2,
    Twitter,
    Copy,
    Check,
    Sparkles,
    Edit3
} from 'lucide-react'

const MAX_TWEET_LENGTH = 280

export default function ThreadWriterPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)

    const [inputMode, setInputMode] = useState<'text' | 'url'>('text')
    const [sourceContent, setSourceContent] = useState((initialData?.content as string) || '')
    const [sourceUrl, setSourceUrl] = useState('')
    const [threadTitle, setThreadTitle] = useState('')

    const [tweets, setTweets] = useState<ThreadTweet[]>([])
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)

    const handleGenerate = async () => {
        if (!user?.id || generating) return
        if (inputMode === 'text' && !sourceContent.trim()) return
        if (inputMode === 'url' && !sourceUrl.trim()) return

        setGenerating(true)
        setTweets([])

        try {
            const response = await fetch('/api/ai/generate-thread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: inputMode === 'text' ? sourceContent : sourceUrl,
                    sourceType: inputMode,
                    userId: user.id
                })
            })

            const result = await response.json()

            if (result.tweets) {
                const formattedTweets: ThreadTweet[] = result.tweets.map((content: string, index: number) => ({
                    index,
                    content,
                    char_count: content.length
                }))
                setTweets(formattedTweets)
                setThreadTitle(result.title || 'Untitled Thread')

                await logUsage(user.id, 'thread-writer', 'generate', 25, {
                    sourceType: inputMode,
                    tweetCount: formattedTweets.length
                })
            }
        } catch (error) {
            console.error('Error generating thread:', error)
        }

        setGenerating(false)
    }

    const handleUpdateTweet = (index: number, content: string) => {
        setTweets(prev => prev.map((t, i) =>
            i === index ? { ...t, content, char_count: content.length } : t
        ))
    }

    const handleAddTweet = (afterIndex: number) => {
        const newTweet: ThreadTweet = { index: afterIndex + 1, content: '', char_count: 0 }
        setTweets(prev => {
            const newTweets = [...prev]
            newTweets.splice(afterIndex + 1, 0, newTweet)
            return newTweets.map((t, i) => ({ ...t, index: i }))
        })
        setEditingIndex(afterIndex + 1)
    }

    const handleDeleteTweet = (index: number) => {
        if (tweets.length <= 2) return
        setTweets(prev => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, index: i })))
    }

    const handleCopyThread = () => {
        const threadText = tweets.map((t, i) => `${i + 1}/ ${t.content}`).join('\n\n')
        navigator.clipboard.writeText(threadText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        if (onComplete) onComplete({ thread: tweets })
    }

    if (loading || authLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-lg">
                <button
                    onClick={() => setInputMode('text')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 ${inputMode === 'text' ? 'bg-[var(--primary)] text-white' : ''}`}
                >
                    <FileText className="w-3 h-3" />
                    Text
                </button>
                <button
                    onClick={() => setInputMode('url')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 ${inputMode === 'url' ? 'bg-[var(--primary)] text-white' : ''}`}
                >
                    <LinkIcon className="w-3 h-3" />
                    URL
                </button>
            </div>

            {/* Source Input */}
            {inputMode === 'text' ? (
                <textarea
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder="Paste your content here..."
                    rows={5}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm resize-none"
                />
            ) : (
                <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://yourblog.com/article"
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm"
                />
            )}

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={generating || (inputMode === 'text' ? !sourceContent.trim() : !sourceUrl.trim())}
                className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
            >
                {generating ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                    </>
                ) : (
                    <>
                        <Wand2 className="w-4 h-4" />
                        Generate (25 credits)
                    </>
                )}
            </button>

            {/* Thread Preview */}
            {generating ? (
                <div className="py-8 text-center">
                    <div className="relative inline-block">
                        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
                        <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] mt-3">Crafting thread...</p>
                </div>
            ) : tweets.length > 0 ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Twitter className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium">{tweets.length} tweets</span>
                        </div>
                        <button
                            onClick={handleCopyThread}
                            className="btn bg-[var(--surface)] text-sm py-1.5 px-3 flex items-center gap-1"
                        >
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    <input
                        type="text"
                        value={threadTitle}
                        onChange={(e) => setThreadTitle(e.target.value)}
                        placeholder="Thread title..."
                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm font-medium"
                    />

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {tweets.map((tweet, index) => (
                            <div
                                key={index}
                                className="group relative p-3 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)]"
                            >
                                <div className="absolute -left-2 top-3 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-bold">
                                    {index + 1}
                                </div>

                                {editingIndex === index ? (
                                    <textarea
                                        value={tweet.content}
                                        onChange={(e) => handleUpdateTweet(index, e.target.value)}
                                        onBlur={() => setEditingIndex(null)}
                                        autoFocus
                                        rows={3}
                                        className="w-full bg-transparent border-none text-sm focus:outline-none resize-none"
                                    />
                                ) : (
                                    <p
                                        className="text-sm cursor-text whitespace-pre-wrap"
                                        onClick={() => setEditingIndex(index)}
                                    >
                                        {tweet.content}
                                    </p>
                                )}

                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--surface-border)]">
                                    <span className={`text-xs ${tweet.char_count > MAX_TWEET_LENGTH ? 'text-red-500' : 'text-[var(--foreground-muted)]'}`}>
                                        {tweet.char_count}/{MAX_TWEET_LENGTH}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingIndex(index)} className="p-1 rounded hover:bg-[var(--surface-hover)]">
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => handleAddTweet(index)} className="p-1 rounded hover:bg-[var(--surface-hover)]">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                        {tweets.length > 2 && (
                                            <button onClick={() => handleDeleteTweet(index)} className="p-1 rounded hover:bg-red-500/10 hover:text-red-500">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="py-8 text-center">
                    <FileText className="w-10 h-10 mx-auto text-[var(--foreground-muted)]" />
                    <p className="text-sm text-[var(--foreground-muted)] mt-2">Thread preview appears here</p>
                </div>
            )}
        </div>
    )
}
