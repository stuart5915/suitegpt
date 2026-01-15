'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    Plus,
    Search,
    MoreHorizontal,
    Settings,
    Trash2,
    ExternalLink,
    Loader2,
    FolderOpen
} from 'lucide-react'
import { Project } from '@/lib/supabase/types'

export default function ProjectsPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<Project[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [menuOpen, setMenuOpen] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)

    useEffect(() => {
        async function loadProjects() {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) {
                    console.error('Error fetching projects:', error)
                } else {
                    setProjects(data || [])
                }
            } catch (err) {
                console.error('Error:', err)
            } finally {
                setLoading(false)
            }
        }

        loadProjects()
    }, [supabase])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            return
        }

        setDeleting(id)
        setMenuOpen(null)

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error

            setProjects(prev => prev.filter(p => p.id !== id))
        } catch (err) {
            console.error('Error deleting project:', err)
            alert('Failed to delete project')
        } finally {
            setDeleting(null)
        }
    }

    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--foreground)]">Projects</h1>
                    <p className="text-[var(--foreground-muted)] mt-1">
                        Manage your brands and content strategies
                    </p>
                </div>
                <Link href="/projects/new" className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    New Project
                </Link>
            </header>

            {/* Empty State */}
            {projects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-20 h-20 rounded-2xl bg-[var(--surface)] flex items-center justify-center mb-6">
                        <FolderOpen className="w-10 h-10 text-[var(--foreground-muted)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        No Projects Yet
                    </h2>
                    <p className="text-[var(--foreground-muted)] text-center max-w-md mb-8">
                        Create your first project to start generating AI-powered content.
                    </p>
                    <Link href="/projects/new" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Create Your First Project
                    </Link>
                </div>
            )}

            {/* Has Projects */}
            {projects.length > 0 && (
                <>
                    {/* Search */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input"
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    {/* Projects Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredProjects.map((project) => (
                            <div
                                key={project.id}
                                className={`card p-6 relative group ${deleting === project.id ? 'opacity-50' : ''}`}
                            >
                                {/* Menu Button */}
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                                        className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] cursor-pointer"
                                    >
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                    {menuOpen === project.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg shadow-lg z-10">
                                            <Link
                                                href={`/projects/${project.id}`}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-t-lg"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                View Details
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(project.id)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--error)] hover:bg-[var(--surface-hover)] w-full rounded-b-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Project Header */}
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                                        {project.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-[var(--foreground-muted)] line-clamp-2">
                                            {project.description || 'No description'}
                                        </p>
                                    </div>
                                </div>

                                {/* Platforms */}
                                {project.platforms && project.platforms.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {project.platforms.map((platform) => (
                                            <span key={platform} className={`badge badge-${platform}`}>
                                                {platform}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Content Pillars */}
                                {project.content_pillars && project.content_pillars.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-4">
                                        {project.content_pillars.slice(0, 3).map((pillar) => (
                                            <span
                                                key={pillar}
                                                className="px-2 py-1 text-xs rounded-md bg-[var(--background-elevated)] text-[var(--foreground-muted)]"
                                            >
                                                {pillar}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Quick Actions */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--surface-border)]">
                                    <Link
                                        href={`/weekly?project=${project.id}`}
                                        className="btn btn-secondary flex-1 text-sm"
                                    >
                                        Generate Content
                                    </Link>
                                    <Link
                                        href={`/content?project=${project.id}`}
                                        className="btn btn-ghost flex-1 text-sm"
                                    >
                                        View Content
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {/* Add New Project Card */}
                        <Link
                            href="/projects/new"
                            className="card p-6 flex flex-col items-center justify-center min-h-[250px] border-dashed border-2 border-[var(--surface-border)] hover:border-[var(--primary)] group"
                        >
                            <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] flex items-center justify-center group-hover:bg-[var(--primary)]/10 transition-colors">
                                <Plus className="w-8 h-8 text-[var(--foreground-muted)] group-hover:text-[var(--primary)]" />
                            </div>
                            <p className="mt-4 font-medium text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                                Add New Project
                            </p>
                        </Link>
                    </div>

                    {/* No Results */}
                    {filteredProjects.length === 0 && searchQuery && (
                        <div className="text-center py-12">
                            <p className="text-[var(--foreground-muted)]">
                                No projects found matching "{searchQuery}"
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
