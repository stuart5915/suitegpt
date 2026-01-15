'use client'

import { useState, useEffect } from 'react'
import { Calendar, Trash2, Edit3, Check, X, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface QueuedPost {
    id: string
    platform: string
    content_type: string
    app_id: string | null
    post_text: string
    images: string[]
    scheduled_for: string | null
    status: string
    created_at: string
    apps?: {
        name: string
        icon_url: string
    }
}

export default function QueuePage() {
    const supabase = createClient()
    const [posts, setPosts] = useState<QueuedPost[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [editDate, setEditDate] = useState('')

    useEffect(() => {
        loadPosts()
    }, [])

    const loadPosts = async () => {
        try {
            const response = await fetch('/api/queue')
            const data = await response.json()
            setPosts(data.posts || [])
        } catch (error) {
            console.error('Error loading queue:', error)
        } finally {
            setLoading(false)
        }
    }

    const deletePost = async (id: string) => {
        if (!confirm('Delete this post from queue?')) return

        try {
            await fetch(`/api/queue/${id}`, { method: 'DELETE' })
            setPosts(posts.filter(p => p.id !== id))
        } catch (error) {
            console.error('Error deleting post:', error)
        }
    }

    const startEditing = (post: QueuedPost) => {
        setEditingId(post.id)
        setEditText(post.post_text)
        setEditDate(post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '')
    }

    const saveEdit = async (id: string) => {
        try {
            await fetch(`/api/queue/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_text: editText,
                    scheduled_for: editDate || null,
                    status: editDate ? 'queued' : 'draft'
                })
            })
            await loadPosts()
            setEditingId(null)
        } catch (error) {
            console.error('Error saving edit:', error)
        }
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditText('')
        setEditDate('')
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-500/20 text-gray-400',
            queued: 'bg-blue-500/20 text-blue-400',
            posted: 'bg-green-500/20 text-green-400',
            failed: 'bg-red-500/20 text-red-400'
        }
        return styles[status] || styles.draft
    }

    const getPlatformIcon = (platform: string) => {
        const icons: Record<string, string> = {
            x: '𝕏',
            instagram: '📸',
            discord: '💬'
        }
        return icons[platform] || '📱'
    }

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">📅 Content Queue</h1>
                    <p className="text-[var(--foreground-muted)]">
                        Manage and schedule your posts
                    </p>
                </div>
                <a href="/ai-fleet" className="btn btn-primary">
                    + Add Post
                </a>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--foreground-muted)]" />
                </div>
            ) : posts.length === 0 ? (
                <div className="card p-12 text-center">
                    <Calendar className="w-16 h-16 text-[var(--foreground-muted)] mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Queue is empty</h2>
                    <p className="text-[var(--foreground-muted)] mb-6">
                        Add posts from the AI Fleet page to start building your content calendar.
                    </p>
                    <a href="/ai-fleet" className="btn btn-primary">
                        Create First Post
                    </a>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map(post => (
                        <div key={post.id} className="card p-4">
                            <div className="flex gap-4">
                                {/* Images */}
                                {post.images && post.images.length > 0 && (
                                    <div className="flex-shrink-0">
                                        <img
                                            src={post.images[0]}
                                            alt="Post image"
                                            className="w-24 h-24 object-cover rounded-lg"
                                        />
                                        {post.images.length > 1 && (
                                            <div className="text-xs text-[var(--foreground-muted)] mt-1 text-center">
                                                +{post.images.length - 1} more
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Header Row */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">{getPlatformIcon(post.platform)}</span>
                                        {post.apps && (
                                            <span className="text-sm font-medium text-[var(--foreground)]">
                                                {post.apps.name}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(post.status)}`}>
                                            {post.status}
                                        </span>
                                        <span className="text-xs text-[var(--foreground-muted)]">
                                            {post.content_type}
                                        </span>
                                    </div>

                                    {/* Post Text */}
                                    {editingId === post.id ? (
                                        <div className="space-y-3">
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={4}
                                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)]"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
                                                <input
                                                    type="datetime-local"
                                                    value={editDate}
                                                    onChange={(e) => setEditDate(e.target.value)}
                                                    className="px-3 py-1 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)]"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => saveEdit(post.id)}
                                                    className="btn btn-primary text-sm px-3 py-1"
                                                >
                                                    <Check className="w-3 h-3" /> Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="btn btn-secondary text-sm px-3 py-1"
                                                >
                                                    <X className="w-3 h-3" /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans mb-2 line-clamp-3">
                                                {post.post_text}
                                            </pre>
                                            {post.scheduled_for && (
                                                <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(post.scheduled_for).toLocaleString()}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Actions */}
                                {editingId !== post.id && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => startEditing(post)}
                                            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        </button>
                                        <button
                                            onClick={() => deletePost(post.id)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
