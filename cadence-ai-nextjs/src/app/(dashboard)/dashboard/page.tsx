'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    Rocket,
    FileText,
    Loader2,
    ArrowRight,
    Calendar,
    Sparkles
} from 'lucide-react'

interface QueueItem {
    id: string
    status: string
    scheduled_for: string | null
}

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [userName, setUserName] = useState<string | null>(null)
    const [greeting, setGreeting] = useState('Good morning')
    const [queueCount, setQueueCount] = useState(0)
    const [scheduledCount, setScheduledCount] = useState(0)

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting('Good morning')
        else if (hour < 18) setGreeting('Good afternoon')
        else setGreeting('Good evening')
    }, [])

    useEffect(() => {
        async function loadData() {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/login')
                    return
                }

                setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'there')

                // Try to fetch queue stats (may not exist yet)
                try {
                    const { data: queueData, count } = await supabase
                        .from('scheduled_posts')
                        .select('id, status, scheduled_for', { count: 'exact' })

                    if (queueData) {
                        setQueueCount(count || 0)
                        setScheduledCount(queueData.filter(p => p.status === 'queued').length)
                    }
                } catch {
                    // Table may not exist yet - that's fine
                    console.log('scheduled_posts table not available yet')
                }
            } catch (err) {
                console.error('Error loading data:', err)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [supabase, router])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-[var(--foreground)]">
                    {greeting}, {userName} 👋
                </h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    Post your daily AI Fleet builds and manage your content queue
                </p>
            </header>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* AI Fleet Card */}
                <Link
                    href="/ai-fleet"
                    className="card p-6 hover:border-[var(--primary)] transition-colors group"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                            <Rocket className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                                AI Fleet Builder
                            </h2>
                            <p className="text-[var(--foreground-muted)] text-sm mt-1">
                                Create branded social posts for new app launches
                            </p>
                            <div className="flex items-center gap-1 mt-3 text-[var(--primary)] text-sm font-medium">
                                Create Post <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Content Queue Card */}
                <Link
                    href="/queue"
                    className="card p-6 hover:border-[var(--primary)] transition-colors group"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center">
                            <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                                Content Queue
                            </h2>
                            <p className="text-[var(--foreground-muted)] text-sm mt-1">
                                Review and schedule your pending posts
                            </p>
                            <div className="flex items-center gap-3 mt-3">
                                {queueCount > 0 ? (
                                    <>
                                        <span className="text-sm text-[var(--foreground)]">
                                            <span className="font-bold">{queueCount}</span> in queue
                                        </span>
                                        {scheduledCount > 0 && (
                                            <span className="text-sm text-[var(--foreground-muted)]">
                                                • {scheduledCount} scheduled
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-sm text-[var(--foreground-muted)]">
                                        No posts queued yet
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Quick Start Section */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">
                        Daily Workflow
                    </h2>
                </div>

                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface)]">
                        <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                        </div>
                        <div>
                            <p className="font-medium text-[var(--foreground)]">Build a new app</p>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Use Antigravity to create today's AI Fleet app
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface)]">
                        <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                        </div>
                        <div>
                            <p className="font-medium text-[var(--foreground)]">Create marketing post</p>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Go to <Link href="/ai-fleet" className="text-[var(--primary)] hover:underline">AI Fleet</Link> → Select app → Generate branded image → Add to Queue
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface)]">
                        <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                        </div>
                        <div>
                            <p className="font-medium text-[var(--foreground)]">Review & Post</p>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Check <Link href="/queue" className="text-[var(--primary)] hover:underline">Content Queue</Link> → Edit if needed → Copy to X/Twitter
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
