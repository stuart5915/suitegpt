'use client'

import { useState, useEffect } from 'react'
import { Calendar, Trash2, Edit3, Check, X, Clock, ExternalLink, Loader2, CheckCircle2, XCircle, CheckCheck, Send } from 'lucide-react'
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
    twitter_post_id?: string
    apps?: {
        name: string
        icon_url: string
    }
}

type FilterStatus = 'all' | 'draft' | 'approved' | 'queued' | 'posted' | 'failed'

export default function QueuePage() {
    const supabase = createClient()
    const [posts, setPosts] = useState<QueuedPost[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [editDate, setEditDate] = useState('')
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkLoading, setBulkLoading] = useState(false)
    const [postingId, setPostingId] = useState<string | null>(null)

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

    // Approve a single post
    const approvePost = async (id: string) => {
        try {
            await fetch(`/api/queue/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'approved' })
            })
            setPosts(posts.map(p => p.id === id ? { ...p, status: 'approved' } : p))
        } catch (error) {
            console.error('Error approving post:', error)
        }
    }

    // Reject a single post (set to rejected or delete)
    const rejectPost = async (id: string) => {
        if (!confirm('Reject this post? It will be removed from the queue.')) return
        try {
            await fetch(`/api/queue/${id}`, { method: 'DELETE' })
            setPosts(posts.filter(p => p.id !== id))
            setSelectedIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        } catch (error) {
            console.error('Error rejecting post:', error)
        }
    }

    // Bulk approve selected posts
    const bulkApprove = async () => {
        if (selectedIds.size === 0) return
        setBulkLoading(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/queue/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'approved' })
                    })
                )
            )
            setPosts(posts.map(p => selectedIds.has(p.id) ? { ...p, status: 'approved' } : p))
            setSelectedIds(new Set())
        } catch (error) {
            console.error('Error bulk approving:', error)
        } finally {
            setBulkLoading(false)
        }
    }

    // Bulk reject/delete selected posts
    const bulkReject = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Delete ${selectedIds.size} selected post(s)?`)) return
        setBulkLoading(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/queue/${id}`, { method: 'DELETE' })
                )
            )
            setPosts(posts.filter(p => !selectedIds.has(p.id)))
            setSelectedIds(new Set())
        } catch (error) {
            console.error('Error bulk rejecting:', error)
        } finally {
            setBulkLoading(false)
        }
    }

    // Post to Twitter now
    const postNow = async (post: QueuedPost) => {
        if (post.platform !== 'x') {
            alert('Only Twitter/X posting is supported currently')
            return
        }
        if (!confirm(`Post this to Twitter now?\n\n"${post.post_text.slice(0, 100)}..."`)) return

        setPostingId(post.id)
        try {
            const response = await fetch('/api/twitter/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: post.post_text,
                    postId: post.id
                })
            })

            const data = await response.json()

            if (data.success) {
                setPosts(posts.map(p =>
                    p.id === post.id
                        ? { ...p, status: 'posted', twitter_post_id: data.tweetId }
                        : p
                ))
                alert(`Posted successfully!\n\nView: ${data.tweetUrl}`)
            } else {
                alert(`Failed to post: ${data.error}`)
            }
        } catch (error) {
            console.error('Error posting:', error)
            alert('Failed to post to Twitter')
        } finally {
            setPostingId(null)
        }
    }

    // Toggle selection for a single post
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // Select/deselect all visible posts
    const toggleSelectAll = () => {
        const visiblePosts = filteredPosts
        if (selectedIds.size === visiblePosts.length && visiblePosts.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(visiblePosts.map(p => p.id)))
        }
    }

    // Filter posts by status
    const filteredPosts = filterStatus === 'all'
        ? posts
        : posts.filter(p => p.status === filterStatus)

    // Count posts by status
    const statusCounts = posts.reduce((acc, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-500/20 text-gray-400',
            approved: 'bg-green-500/20 text-green-400',
            queued: 'bg-blue-500/20 text-blue-400',
            scheduled: 'bg-purple-500/20 text-purple-400',
            posted: 'bg-emerald-500/20 text-emerald-400',
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

    const filterTabs: { key: FilterStatus; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'draft', label: 'Drafts' },
        { key: 'approved', label: 'Approved' },
        { key: 'queued', label: 'Queued' },
        { key: 'posted', label: 'Posted' },
    ]

    return (
        <div className="min-h-screen p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
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

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {filterTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => {
                            setFilterStatus(tab.key)
                            setSelectedIds(new Set())
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            filterStatus === tab.key
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                        }`}
                    >
                        {tab.label}
                        {tab.key !== 'all' && statusCounts[tab.key] ? (
                            <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                                {statusCounts[tab.key]}
                            </span>
                        ) : tab.key === 'all' && posts.length > 0 ? (
                            <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                                {posts.length}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* Bulk Actions Bar */}
            {filteredPosts.length > 0 && (
                <div className="card p-3 mb-4 flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedIds.size === filteredPosts.length && filteredPosts.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-[var(--surface-border)] bg-[var(--background)] accent-[var(--accent)]"
                        />
                        <span className="text-sm text-[var(--foreground-muted)]">
                            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                        </span>
                    </label>

                    {selectedIds.size > 0 && (
                        <>
                            <div className="h-6 w-px bg-[var(--surface-border)]" />
                            <button
                                onClick={bulkApprove}
                                disabled={bulkLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                            >
                                <CheckCheck className="w-4 h-4" />
                                Approve All
                            </button>
                            <button
                                onClick={bulkReject}
                                disabled={bulkLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" />
                                Reject All
                            </button>
                            {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--foreground-muted)]" />}
                        </>
                    )}
                </div>
            )}

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
            ) : filteredPosts.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-[var(--foreground-muted)]">
                        No posts with status "{filterStatus}"
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPosts.map(post => (
                        <div key={post.id} className={`card p-4 transition-colors ${selectedIds.has(post.id) ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                            <div className="flex gap-4">
                                {/* Checkbox */}
                                <div className="flex-shrink-0 pt-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(post.id)}
                                        onChange={() => toggleSelect(post.id)}
                                        className="w-4 h-4 rounded border-[var(--surface-border)] bg-[var(--background)] accent-[var(--accent)]"
                                    />
                                </div>

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
                                        {/* Approve button - only show if not already approved/posted */}
                                        {!['approved', 'posted', 'scheduled'].includes(post.status) && (
                                            <button
                                                onClick={() => approvePost(post.id)}
                                                className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                                                title="Approve"
                                            >
                                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                            </button>
                                        )}
                                        {/* Post Now button - for approved posts on Twitter */}
                                        {post.status === 'approved' && post.platform === 'x' && (
                                            <button
                                                onClick={() => postNow(post)}
                                                disabled={postingId === post.id}
                                                className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                title="Post to Twitter Now"
                                            >
                                                {postingId === post.id ? (
                                                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 text-blue-400" />
                                                )}
                                            </button>
                                        )}
                                        {/* View on Twitter - for posted tweets */}
                                        {post.status === 'posted' && post.twitter_post_id && (
                                            <a
                                                href={`https://twitter.com/i/web/status/${post.twitter_post_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
                                                title="View on Twitter"
                                            >
                                                <ExternalLink className="w-4 h-4 text-[var(--foreground-muted)]" />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => startEditing(post)}
                                            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        </button>
                                        <button
                                            onClick={() => rejectPost(post.id)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Reject / Delete"
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
