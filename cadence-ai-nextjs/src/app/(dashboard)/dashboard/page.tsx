'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import {
    Plus,
    Loader2,
    ArrowRight,
    FolderOpen,
    RefreshCw,
    Settings
} from 'lucide-react'
import { Project } from '@/lib/supabase/types'

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [greeting, setGreeting] = useState('Good morning')
    const [projects, setProjects] = useState<Project[]>([])

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting('Good morning')
        else if (hour < 18) setGreeting('Good afternoon')
        else setGreeting('Good evening')
    }, [])

    useEffect(() => {
        async function loadData() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            try {
                // Fetch user's projects
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('telegram_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(6)

                if (!error && data) {
                    setProjects(data)
                }
            } catch (err) {
                console.error('Error loading data:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading) {
            loadData()
        }
    }, [supabase, user, authLoading])

    if (loading || authLoading) {
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
                    {greeting}, {user?.firstName || user?.username || 'there'}
                </h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    Select a project to manage content, or create a new one
                </p>
            </header>

            {/* Projects Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-[var(--foreground)]">Your Projects</h2>
                    <Link href="/projects" className="text-sm text-[var(--primary)] hover:underline">
                        View all
                    </Link>
                </div>

                {projects.length === 0 ? (
                    /* Empty State */
                    <div className="card p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center mb-4">
                            <FolderOpen className="w-8 h-8 text-[var(--foreground-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                            No projects yet
                        </h3>
                        <p className="text-[var(--foreground-muted)] mb-6 max-w-sm">
                            Create your first project to start generating AI-powered content with your brand voice.
                        </p>
                        <Link href="/projects/new" className="btn btn-primary">
                            <Plus className="w-4 h-4" />
                            Create Your First Project
                        </Link>
                    </div>
                ) : (
                    /* Projects Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="card p-5 hover:border-[var(--primary)] transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                                        style={{
                                            background: `linear-gradient(135deg, ${(project.posting_schedule as any)?.primary_color || 'var(--primary)'}, ${(project.posting_schedule as any)?.secondary_color || 'var(--secondary)'})`
                                        }}
                                    >
                                        {project.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-[var(--foreground-muted)] line-clamp-2 mt-1">
                                            {project.description || 'No description'}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--surface-border)]">
                                    <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                        <RefreshCw className="w-3 h-3" />
                                        Loops
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                        <Settings className="w-3 h-3" />
                                        Settings
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-[var(--foreground-muted)] ml-auto group-hover:text-[var(--primary)] transition-colors" />
                                </div>
                            </Link>
                        ))}

                        {/* Add New Project Card */}
                        <Link
                            href="/projects/new"
                            className="card p-5 flex flex-col items-center justify-center min-h-[160px] border-dashed border-2 border-[var(--surface-border)] hover:border-[var(--primary)] group"
                        >
                            <div className="w-12 h-12 rounded-full bg-[var(--surface-hover)] flex items-center justify-center group-hover:bg-[var(--primary)]/10 transition-colors">
                                <Plus className="w-6 h-6 text-[var(--foreground-muted)] group-hover:text-[var(--primary)]" />
                            </div>
                            <p className="mt-3 font-medium text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                                New Project
                            </p>
                        </Link>
                    </div>
                )}
            </section>
        </div>
    )
}
