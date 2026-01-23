'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { logUsage } from '@/lib/extensions/api'
import { Thread, ThreadTweet } from '@/lib/extensions/types'
import {
    Loader2,
    ChevronLeft,
    Wand2,
    FileText,
    Link as LinkIcon,
    ArrowRight,
    Plus,
    Trash2,
    GripVertical,
    Twitter,
    Copy,
    Calendar,
    Clock,
    Check,
    Zap,
    Edit3,
    Sparkles
} from 'lucide-react'

const MAX_TWEET_LENGTH = 280

export default function ThreadWriterPage() {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [threads, setThreads] = useState<Thread[]>([])
    const [activeThread, setActiveThread] = useState<Thread | null>(null)

    // Input state
    const [inputMode, setInputMode] = useState<'text' | 'url'>('text')
    const [sourceContent, setSourceContent] = useState('')
    const [sourceUrl, setSourceUrl] = useState('')
    const [threadTitle, setThreadTitle] = useState('')

    // Generated tweets state
    const [tweets, setTweets] = useState<ThreadTweet[]>([])
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

    useEffect(() => {
        async function loadData() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            // Load recent threads
            const { data, error } = await supabase
                .from('threads')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)

            if (!error && data) {
                setThreads(data)
            }

            setLoading(false)
        }

        if (!authLoading) {
            loadData()
        }
    }, [supabase, user, authLoading])

    const handleGenerate = async () => {
        if (!user?.id || generating) return
        if (inputMode === 'text' && !sourceContent.trim()) return
        if (inputMode === 'url' && !sourceUrl.trim()) return

        setGenerating(true)
        setTweets([])

        try {
            // Call AI to generate thread
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

                // Log usage
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

    const handleSaveThread = async () => {
        if (!user?.id || tweets.length === 0) return

        const { data, error } = await supabase
            .from('threads')
            .insert({
                user_id: user.id,
                title: threadTitle,
                source_content: inputMode === 'text' ? sourceContent : null,
                source_url: inputMode === 'url' ? sourceUrl : null,
                tweets: tweets,
                total_tweets: tweets.length,
                status: 'draft'
            })
            .select()
            .single()

        if (!error && data) {
            setThreads(prev => [data, ...prev])
            setActiveThread(data)
        }
    }

    const handleUpdateTweet = (index: number, content: string) => {
        setTweets(prev => prev.map((t, i) =>
            i === index
                ? { ...t, content, char_count: content.length }
                : t
        ))
    }

    const handleAddTweet = (afterIndex: number) => {
        const newTweet: ThreadTweet = {
            index: afterIndex + 1,
            content: '',
            char_count: 0
        }
        setTweets(prev => {
            const newTweets = [...prev]
            newTweets.splice(afterIndex + 1, 0, newTweet)
            return newTweets.map((t, i) => ({ ...t, index: i }))
        })
        setEditingIndex(afterIndex + 1)
    }

    const handleDeleteTweet = (index: number) => {
        if (tweets.length <= 2) return // Min 2 tweets for a thread
        setTweets(prev => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, index: i })))
    }

    const handleCopyThread = () => {
        const threadText = tweets.map((t, i) => `${i + 1}/ ${t.content}`).join('\n\n')
        navigator.clipboard.writeText(threadText)
    }

    const totalChars = tweets.reduce((sum, t) => sum + t.char_count, 0)

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Back Link */}
            <Link
                href="/extensions"
                className="inline-flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to Extensions
            </Link>

            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg">
                        🧵
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--foreground)]">
                            Thread Writer
                        </h1>
                        <p className="text-[var(--foreground-muted)]">
                            Turn blog posts and ideas into engaging Twitter threads
                        </p>
                    </div>
                </div>

                {/* Cost Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-sm">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-500 font-medium">25 credits per thread</span>
                </div>
            </header>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                    {/* Input Mode Toggle */}
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
                            Source Content
                        </label>
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setInputMode('text')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${inputMode === 'text'
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                Paste Text
                            </button>
                            <button
                                onClick={() => setInputMode('url')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${inputMode === 'url'
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                <LinkIcon className="w-4 h-4" />
                                From URL
                            </button>
                        </div>

                        {inputMode === 'text' ? (
                            <textarea
                                value={sourceContent}
                                onChange={(e) => setSourceContent(e.target.value)}
                                placeholder="Paste your blog post, article, or idea here. The AI will turn it into an engaging Twitter thread with hooks, insights, and a strong CTA..."
                                rows={12}
                                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none resize-none"
                            />
                        ) : (
                            <input
                                type="url"
                                value={sourceUrl}
                                onChange={(e) => setSourceUrl(e.target.value)}
                                placeholder="https://yourblog.com/article-to-convert"
                                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none"
                            />
                        )}
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={generating || (inputMode === 'text' ? !sourceContent.trim() : !sourceUrl.trim())}
                        className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-3"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Generating Thread...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5" />
                                Generate Thread
                                <span className="text-sm opacity-75">(25 credits)</span>
                            </>
                        )}
                    </button>

                    {/* Recent Threads */}
                    {threads.length > 0 && (
                        <div className="card p-6">
                            <h3 className="font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Recent Threads
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {threads.slice(0, 5).map((thread) => (
                                    <button
                                        key={thread.id}
                                        onClick={() => {
                                            setActiveThread(thread)
                                            setTweets(thread.tweets as ThreadTweet[])
                                            setThreadTitle(thread.title)
                                        }}
                                        className="w-full p-3 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-[var(--foreground)] truncate">
                                                {thread.title}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${thread.status === 'posted'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : thread.status === 'scheduled'
                                                        ? 'bg-blue-500/10 text-blue-500'
                                                        : 'bg-[var(--surface-border)] text-[var(--foreground-muted)]'
                                                }`}>
                                                {thread.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] mt-1">
                                            <span>{thread.total_tweets} tweets</span>
                                            <span>•</span>
                                            <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Thread Preview Panel */}
                <div className="space-y-6">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-[var(--foreground)] flex items-center gap-2">
                                <Twitter className="w-4 h-4 text-blue-400" />
                                Thread Preview
                            </h3>
                            {tweets.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--foreground-muted)]">
                                        {tweets.length} tweets
                                    </span>
                                    <button
                                        onClick={handleCopyThread}
                                        className="p-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all"
                                        title="Copy thread"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {generating ? (
                            <div className="py-12 text-center">
                                <div className="relative inline-block">
                                    <Loader2 className="w-12 h-12 animate-spin text-[var(--primary)]" />
                                    <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                                </div>
                                <p className="text-[var(--foreground-muted)] mt-4">Crafting your thread...</p>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">Optimizing hooks and CTAs</p>
                            </div>
                        ) : tweets.length > 0 ? (
                            <div className="space-y-4">
                                {/* Thread Title */}
                                <input
                                    type="text"
                                    value={threadTitle}
                                    onChange={(e) => setThreadTitle(e.target.value)}
                                    placeholder="Thread title..."
                                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] font-medium placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none"
                                />

                                {/* Tweets */}
                                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                    {tweets.map((tweet, index) => (
                                        <div
                                            key={index}
                                            className="group relative p-4 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)]"
                                        >
                                            {/* Tweet Number */}
                                            <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-bold">
                                                {index + 1}
                                            </div>

                                            {/* Tweet Content */}
                                            {editingIndex === index ? (
                                                <textarea
                                                    value={tweet.content}
                                                    onChange={(e) => handleUpdateTweet(index, e.target.value)}
                                                    onBlur={() => setEditingIndex(null)}
                                                    autoFocus
                                                    rows={4}
                                                    className="w-full px-2 py-1 bg-transparent border-none text-[var(--foreground)] focus:outline-none resize-none"
                                                />
                                            ) : (
                                                <p
                                                    className="text-[var(--foreground)] whitespace-pre-wrap cursor-text"
                                                    onClick={() => setEditingIndex(index)}
                                                >
                                                    {tweet.content}
                                                </p>
                                            )}

                                            {/* Character Count & Actions */}
                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--surface-border)]">
                                                <span className={`text-xs ${tweet.char_count > MAX_TWEET_LENGTH
                                                        ? 'text-red-500 font-medium'
                                                        : tweet.char_count > MAX_TWEET_LENGTH - 20
                                                            ? 'text-amber-500'
                                                            : 'text-[var(--foreground-muted)]'
                                                    }`}>
                                                    {tweet.char_count}/{MAX_TWEET_LENGTH}
                                                </span>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingIndex(index)}
                                                        className="p-1.5 rounded hover:bg-[var(--surface-hover)]"
                                                        title="Edit"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleAddTweet(index)}
                                                        className="p-1.5 rounded hover:bg-[var(--surface-hover)]"
                                                        title="Add tweet after"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                    {tweets.length > 2 && (
                                                        <button
                                                            onClick={() => handleDeleteTweet(index)}
                                                            className="p-1.5 rounded hover:bg-red-500/10 text-[var(--foreground-muted)] hover:text-red-500"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-4 border-t border-[var(--surface-border)]">
                                    <button
                                        onClick={handleSaveThread}
                                        className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Save Draft
                                    </button>
                                    <button className="flex-1 btn bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Schedule
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <FileText className="w-12 h-12 mx-auto text-[var(--foreground-muted)]" />
                                <p className="text-[var(--foreground-muted)] mt-4">
                                    Your generated thread will appear here
                                </p>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Paste content or a URL and click Generate
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
