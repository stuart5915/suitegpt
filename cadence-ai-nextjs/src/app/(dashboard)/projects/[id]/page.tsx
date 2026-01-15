'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
    ArrowLeft,
    Edit2,
    Trash2,
    Calendar,
    FileText,
    Sparkles,
    Palette,
    Target,
    MessageSquare,
    Loader2,
    Save,
    X,
    Plus,
    Building2,
    Lightbulb,
    Hash,
    Shield,
    Users,
    Upload,
    Ban,
    Megaphone,
    Package
} from 'lucide-react'
import { Project, Platform, PLATFORM_CONFIG } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'

const ALL_PLATFORMS: Platform[] = ['x', 'instagram', 'linkedin', 'tiktok', 'youtube']

const PRESET_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6',
    '#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#64748b',
    '#0ea5e9', '#84cc16', '#f43f5e', '#a855f7', '#06b6d4',
]

export default function ProjectDetailPage() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const projectId = params.id as string
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [project, setProject] = useState<Project | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [editingSection, setEditingSection] = useState<string | null>(null)
    const [aiLoading, setAiLoading] = useState<string | null>(null)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    const [editData, setEditData] = useState<any>({})

    useEffect(() => {
        async function loadProject() {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single()

                if (error) throw error
                setProject(data)
            } catch (err) {
                console.error('Error loading project:', err)
                router.push('/projects')
            } finally {
                setLoading(false)
            }
        }
        loadProject()
    }, [supabase, projectId, router])

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return
        setDeleting(true)
        try {
            const { error } = await supabase.from('projects').delete().eq('id', projectId)
            if (error) throw error
            router.push('/projects')
        } catch (err) {
            console.error('Error deleting project:', err)
            alert('Failed to delete project')
            setDeleting(false)
        }
    }

    const startEdit = (section: string) => {
        const branding = (project?.posting_schedule as any) || {}
        setEditData({
            name: project?.name || '',
            description: project?.description || '',
            brand_voice: project?.brand_voice || '',
            target_audience: project?.target_audience || '',
            platforms: project?.platforms || [],
            content_pillars: project?.content_pillars?.length ? project.content_pillars : [''],
            primary_color: branding.primary_color || '#6366f1',
            secondary_color: branding.secondary_color || '#f97316',
            tertiary_color: branding.tertiary_color || '',
            accent_color: branding.accent_color || '',
            logo_url: project?.logo_url || '',
            brand_style: branding.brand_style || '',
            mission_statement: branding.mission_statement || '',
            unique_value_prop: branding.unique_value_prop || '',
            key_messages: branding.key_messages?.length ? branding.key_messages : [''],
            hashtag_strategy: branding.hashtag_strategy || '',
            competitors: branding.competitors || '',
            content_rules: branding.content_rules || '',
            banned_words: branding.banned_words || '',
            tone_of_voice: branding.tone_of_voice || '',
            speaking_perspective: branding.speaking_perspective || 'we',
            emoji_style: branding.emoji_style || 'moderate',
            products_services: branding.products_services?.length ? branding.products_services : [''],
        })
        setEditingSection(section)
    }

    const cancelEdit = () => {
        setEditingSection(null)
        setEditData({})
    }

    const saveEdit = async () => {
        if (!project) return
        setSaving(true)
        try {
            const pillars = (editData.content_pillars || []).filter((p: string) => p.trim() !== '')
            const keyMessages = (editData.key_messages || []).filter((m: string) => m.trim() !== '')

            const branding = {
                primary_color: editData.primary_color,
                secondary_color: editData.secondary_color,
                tertiary_color: editData.tertiary_color || null,
                accent_color: editData.accent_color || null,
                brand_style: editData.brand_style,
                mission_statement: editData.mission_statement,
                unique_value_prop: editData.unique_value_prop,
                key_messages: keyMessages,
                hashtag_strategy: editData.hashtag_strategy,
                competitors: editData.competitors,
                content_rules: editData.content_rules,
                banned_words: editData.banned_words,
                tone_of_voice: editData.tone_of_voice,
                speaking_perspective: editData.speaking_perspective,
                emoji_style: editData.emoji_style,
                products_services: (editData.products_services || []).filter((p: string) => p.trim() !== ''),
            }

            const { error } = await supabase
                .from('projects')
                .update({
                    name: editData.name,
                    description: editData.description,
                    brand_voice: editData.brand_voice,
                    target_audience: editData.target_audience,
                    platforms: editData.platforms,
                    content_pillars: pillars,
                    logo_url: editData.logo_url || null,
                    posting_schedule: branding,
                })
                .eq('id', projectId)

            if (error) throw error

            const { data: refreshed } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single()

            if (refreshed) setProject(refreshed)
            setEditingSection(null)
        } catch (err) {
            console.error('Error saving:', err)
            alert('Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    const aiSuggest = async (type: string, targetField: string) => {
        setAiLoading(type)
        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    projectName: editData.name || project?.name,
                    projectDescription: editData.description || project?.description,
                    currentValue: editData[targetField],
                    // Pass all context for self-referencing
                    missionStatement: editData.mission_statement || branding.mission_statement,
                    uniqueValueProp: editData.unique_value_prop || branding.unique_value_prop,
                    brandVoice: editData.brand_voice || project?.brand_voice,
                    targetAudience: editData.target_audience || project?.target_audience,
                    contentPillars: editData.content_pillars?.filter((p: string) => p.trim()) || project?.content_pillars,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setEditData((prev: any) => ({ ...prev, [targetField]: data.suggestion }))
        } catch (err: any) {
            alert(err.message || 'AI suggestion failed')
        } finally {
            setAiLoading(null)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Check file size (500KB max)
        if (file.size > 500 * 1024) {
            alert('File too large. Maximum size is 500KB')
            return
        }

        setUploadingLogo(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('projectId', projectId)

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setEditData((prev: any) => ({ ...prev, logo_url: data.url }))
        } catch (err: any) {
            alert(err.message || 'Upload failed')
        } finally {
            setUploadingLogo(false)
        }
    }

    const togglePlatform = (platform: Platform) => {
        setEditData((prev: any) => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter((p: Platform) => p !== platform)
                : [...prev.platforms, platform]
        }))
    }

    const addListItem = (field: string) => {
        setEditData((prev: any) => ({ ...prev, [field]: [...(prev[field] || []), ''] }))
    }

    const updateListItem = (field: string, index: number, value: string) => {
        setEditData((prev: any) => ({
            ...prev,
            [field]: prev[field].map((item: string, i: number) => i === index ? value : item)
        }))
    }

    const removeListItem = (field: string, index: number) => {
        setEditData((prev: any) => ({
            ...prev,
            [field]: prev[field].filter((_: string, i: number) => i !== index)
        }))
    }

    const branding = (project?.posting_schedule as any) || {}

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-[var(--foreground-muted)]">Project not found</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8 max-w-4xl mx-auto">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] cursor-pointer">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                            style={{ background: `linear-gradient(135deg, ${branding.primary_color || '#6366f1'} 0%, ${branding.secondary_color || '#f97316'} 100%)` }}
                        >
                            {project.logo_url ? (
                                <img src={project.logo_url} alt={project.name} className="w-full h-full object-contain rounded-xl" />
                            ) : (
                                project.name.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--foreground)]">{project.name}</h1>
                            <p className="text-[var(--foreground-muted)] mt-1">{project.description || 'No description'}</p>
                        </div>
                    </div>
                </div>
                <button onClick={handleDelete} disabled={deleting} className="btn btn-ghost text-[var(--error)] hover:bg-[var(--error)]/10 cursor-pointer">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </button>
            </header>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <Link href={`/weekly?project=${project.id}&autoGenerate=true`} className="card p-4 flex items-center gap-3 hover:border-[var(--primary)] cursor-pointer">
                    <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Sparkles className="w-5 h-5" /></div>
                    <div><p className="font-medium text-[var(--foreground)]">Generate Content</p><p className="text-xs text-[var(--foreground-muted)]">Create AI content</p></div>
                </Link>
                <Link href={`/content?project=${project.id}`} className="card p-4 flex items-center gap-3 hover:border-[var(--secondary)] cursor-pointer">
                    <div className="p-2 rounded-lg bg-[var(--secondary)]/10 text-[var(--secondary)]"><FileText className="w-5 h-5" /></div>
                    <div><p className="font-medium text-[var(--foreground)]">Content Queue</p><p className="text-xs text-[var(--foreground-muted)]">View all posts</p></div>
                </Link>
                <Link href={`/weekly?project=${project.id}`} className="card p-4 flex items-center gap-3 hover:border-[var(--success)] cursor-pointer">
                    <div className="p-2 rounded-lg bg-[var(--success)]/10 text-[var(--success)]"><Calendar className="w-5 h-5" /></div>
                    <div><p className="font-medium text-[var(--foreground)]">This Week</p><p className="text-xs text-[var(--foreground-muted)]">View calendar</p></div>
                </Link>
            </div>

            <div className="space-y-6">

                {/* Basic Info */}
                <EditableSection title="Basic Information" icon={<Building2 className="w-5 h-5" />} isEditing={editingSection === 'basic'} onEdit={() => startEdit('basic')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'basic' ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-[var(--foreground)]">Project Name</label>
                                    <AiButton loading={aiLoading === 'project_name'} onClick={() => aiSuggest('project_name', 'name')} />
                                </div>
                                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="input" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-[var(--foreground)]">Description</label>
                                    <AiButton loading={aiLoading === 'description'} onClick={() => aiSuggest('description', 'description')} />
                                </div>
                                <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={3} className="input resize-none" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-[var(--foreground)]">Mission Statement</label>
                                    <AiButton loading={aiLoading === 'mission_statement'} onClick={() => aiSuggest('mission_statement', 'mission_statement')} />
                                </div>
                                <textarea value={editData.mission_statement} onChange={(e) => setEditData({ ...editData, mission_statement: e.target.value })} placeholder="The core purpose of your company..." rows={2} className="input resize-none" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-[var(--foreground)]">Unique Value Proposition</label>
                                    <AiButton loading={aiLoading === 'unique_value_prop'} onClick={() => aiSuggest('unique_value_prop', 'unique_value_prop')} />
                                </div>
                                <textarea value={editData.unique_value_prop} onChange={(e) => setEditData({ ...editData, unique_value_prop: e.target.value })} placeholder="What makes you different..." rows={2} className="input resize-none" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <InfoRow label="Name" value={project.name} />
                            <InfoRow label="Description" value={project.description} />
                            <InfoRow label="Mission Statement" value={branding.mission_statement} />
                            <InfoRow label="Unique Value Proposition" value={branding.unique_value_prop} />
                        </div>
                    )}
                </EditableSection>

                {/* Visual Branding */}
                <EditableSection title="Visual Branding" icon={<Palette className="w-5 h-5" />} iconColor="primary" isEditing={editingSection === 'branding'} onEdit={() => startEdit('branding')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'branding' ? (
                        <div className="space-y-5">
                            {/* Colors Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ColorPicker label="Primary" value={editData.primary_color} onChange={(c) => setEditData({ ...editData, primary_color: c })} />
                                <ColorPicker label="Secondary" value={editData.secondary_color} onChange={(c) => setEditData({ ...editData, secondary_color: c })} />
                                <ColorPicker label="Tertiary (optional)" value={editData.tertiary_color} onChange={(c) => setEditData({ ...editData, tertiary_color: c })} />
                                <ColorPicker label="Accent (optional)" value={editData.accent_color} onChange={(c) => setEditData({ ...editData, accent_color: c })} />
                            </div>

                            {/* Color Presets */}
                            <div>
                                <p className="text-xs text-[var(--foreground-muted)] mb-2">Quick presets</p>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button key={c} type="button" onClick={() => setEditData({ ...editData, primary_color: c })} className="w-6 h-6 rounded-full border border-[var(--surface-border)] hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>

                            {/* Logo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Logo</label>
                                <div className="flex items-center gap-4">
                                    {editData.logo_url && (
                                        <div className="w-16 h-16 rounded-lg bg-[var(--background-elevated)] border border-[var(--surface-border)] flex items-center justify-center overflow-hidden">
                                            <img src={editData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="btn btn-secondary text-sm">
                                            {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            Upload Logo
                                        </button>
                                        <p className="text-xs text-[var(--foreground-muted)] mt-1">Max 500KB • PNG, JPG, SVG</p>
                                    </div>
                                    <div className="flex-1">
                                        <input type="url" value={editData.logo_url} onChange={(e) => setEditData({ ...editData, logo_url: e.target.value })} placeholder="Or paste URL..." className="input text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Visual Style */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Visual Style</label>
                                <div className="flex flex-wrap gap-2">
                                    {['minimalist', 'bold', 'playful', 'professional', 'elegant', 'modern'].map((style) => (
                                        <button key={style} type="button" onClick={() => setEditData({ ...editData, brand_style: style })} className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${editData.brand_style === style ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-elevated)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]'}`}>
                                            {style}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-4">
                            <ColorSwatch label="Primary" color={branding.primary_color || '#6366f1'} />
                            <ColorSwatch label="Secondary" color={branding.secondary_color || '#f97316'} />
                            {branding.tertiary_color && <ColorSwatch label="Tertiary" color={branding.tertiary_color} />}
                            {branding.accent_color && <ColorSwatch label="Accent" color={branding.accent_color} />}
                            {branding.brand_style && <div><p className="text-xs text-[var(--foreground-muted)] mb-1">Style</p><span className="px-3 py-2 rounded-lg bg-[var(--background-elevated)] text-sm capitalize">{branding.brand_style}</span></div>}
                            {project.logo_url && <div><p className="text-xs text-[var(--foreground-muted)] mb-1">Logo</p><img src={project.logo_url} alt="Logo" className="h-10 object-contain" /></div>}
                        </div>
                    )}
                </EditableSection>

                {/* Platforms */}
                <EditableSection title="Platforms" icon={<Users className="w-5 h-5" />} isEditing={editingSection === 'platforms'} onEdit={() => startEdit('platforms')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'platforms' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {ALL_PLATFORMS.map((platform) => {
                                const isSelected = editData.platforms?.includes(platform)
                                return (
                                    <button key={platform} type="button" onClick={() => togglePlatform(platform)} className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--surface-border)] hover:border-[var(--foreground-muted)]'}`}>
                                        <div className="flex justify-center mb-1">
                                            <PlatformIcon platform={platform} size={20} />
                                        </div>
                                        <p className={`text-xs font-medium ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>{PLATFORM_NAMES[platform] || platform}</p>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {project.platforms?.map((platform) => {
                                return <div key={platform} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--background-elevated)]"><PlatformIcon platform={platform} size={20} /><span className="text-sm font-medium">{PLATFORM_NAMES[platform] || platform}</span></div>
                            }) || <p className="text-[var(--foreground-muted)]">No platforms selected</p>}
                        </div>
                    )}
                </EditableSection>

                {/* Brand Voice */}
                <EditableSection title="Brand Voice" icon={<MessageSquare className="w-5 h-5" />} iconColor="secondary" isEditing={editingSection === 'voice'} onEdit={() => startEdit('voice')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'voice' ? (
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-end mb-2">
                                    <AiButton loading={aiLoading === 'brand_voice'} onClick={() => aiSuggest('brand_voice', 'brand_voice')} />
                                </div>
                                <textarea value={editData.brand_voice} onChange={(e) => setEditData({ ...editData, brand_voice: e.target.value })} placeholder="Describe your brand's communication style..." rows={4} className="input resize-none" />
                            </div>

                            {/* Tone of Voice */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Tone of Voice</label>
                                <div className="flex flex-wrap gap-2">
                                    {['professional', 'casual', 'friendly', 'authoritative', 'witty', 'inspirational', 'empathetic', 'bold'].map((tone) => (
                                        <button key={tone} type="button" onClick={() => setEditData({ ...editData, tone_of_voice: tone })} className={`px-3 py-2 rounded-lg text-sm capitalize transition-all cursor-pointer ${editData.tone_of_voice === tone ? 'bg-[var(--secondary)] text-white' : 'bg-[var(--background-elevated)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]'}`}>
                                            {tone}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Speaking Perspective */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Speaking Perspective</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { value: 'i', label: '"I" - Personal/Founder', desc: 'Speaking as an individual' },
                                        { value: 'we', label: '"We" - Team/Company', desc: 'Speaking as a collective' },
                                        { value: 'you', label: '"You" - Direct to Reader', desc: 'Addressing the audience directly' },
                                        { value: 'they', label: 'Third Person', desc: 'Speaking about the brand' },
                                    ].map((opt) => (
                                        <button key={opt.value} type="button" onClick={() => setEditData({ ...editData, speaking_perspective: opt.value })} className={`px-4 py-3 rounded-lg text-left transition-all cursor-pointer ${editData.speaking_perspective === opt.value ? 'bg-[var(--secondary)] text-white' : 'bg-[var(--background-elevated)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]'}`}>
                                            <p className="text-sm font-medium">{opt.label}</p>
                                            <p className={`text-xs ${editData.speaking_perspective === opt.value ? 'text-white/70' : 'text-[var(--foreground-muted)]'}`}>{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Emoji Style */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Emoji Usage</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { value: 'none', label: 'None', desc: 'No emojis' },
                                        { value: 'minimal', label: 'Minimal', desc: '1-2 emojis max' },
                                        { value: 'moderate', label: 'Moderate', desc: 'Natural usage' },
                                        { value: 'heavy', label: 'Heavy', desc: 'Emojis throughout' },
                                    ].map((opt) => (
                                        <button key={opt.value} type="button" onClick={() => setEditData({ ...editData, emoji_style: opt.value })} className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${editData.emoji_style === opt.value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-elevated)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]'}`}>
                                            <p className="text-sm font-medium">{opt.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-[var(--foreground-muted)] whitespace-pre-wrap">{project.brand_voice || 'No brand voice defined'}</p>
                            {branding.tone_of_voice && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--foreground-muted)]">Tone:</span>
                                    <span className="px-3 py-1 rounded-lg bg-[var(--secondary)]/10 text-[var(--secondary)] text-sm capitalize">{branding.tone_of_voice}</span>
                                </div>
                            )}
                            {branding.speaking_perspective && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--foreground-muted)]">Perspective:</span>
                                    <span className="px-3 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-sm">
                                        {branding.speaking_perspective === 'i' ? '"I" - Personal' : branding.speaking_perspective === 'we' ? '"We" - Team' : branding.speaking_perspective === 'you' ? '"You" - Direct' : 'Third Person'}
                                    </span>
                                </div>
                            )}
                            {branding.emoji_style && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--foreground-muted)]">Emoji:</span>
                                    <span className="px-3 py-1 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm capitalize">{branding.emoji_style}</span>
                                </div>
                            )}
                        </div>
                    )}
                </EditableSection>

                {/* Products & Services */}
                <EditableSection title="Products & Services" subtitle="Help AI feature specific offerings" icon={<Package className="w-5 h-5" />} iconColor="primary" isEditing={editingSection === 'products'} onEdit={() => startEdit('products')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'products' ? (
                        <div className="space-y-3">
                            <p className="text-xs text-[var(--foreground-muted)]">List your products or services so AI can create targeted content for each.</p>
                            {(editData.products_services || ['']).map((item: string, i: number) => (
                                <div key={i} className="flex gap-2">
                                    <input type="text" value={item} onChange={(e) => updateListItem('products_services', i, e.target.value)} placeholder={`Product/Service ${i + 1}`} className="input flex-1" />
                                    {editData.products_services?.length > 1 && <button type="button" onClick={() => removeListItem('products_services', i)} className="p-2 text-[var(--error)] cursor-pointer"><X className="w-4 h-4" /></button>}
                                </div>
                            ))}
                            <button type="button" onClick={() => addListItem('products_services')} className="btn btn-ghost text-sm cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {branding.products_services?.length > 0 ? branding.products_services.map((item: string, i: number) => (
                                <span key={i} className="px-4 py-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] font-medium">{item}</span>
                            )) : <p className="text-[var(--foreground-muted)]">No products or services defined</p>}
                        </div>
                    )}
                </EditableSection>

                {/* Target Audience */}
                <EditableSection title="Target Audience" icon={<Target className="w-5 h-5" />} iconColor="success" isEditing={editingSection === 'audience'} onEdit={() => startEdit('audience')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'audience' ? (
                        <div>
                            <div className="flex justify-end mb-2">
                                <AiButton loading={aiLoading === 'target_audience'} onClick={() => aiSuggest('target_audience', 'target_audience')} />
                            </div>
                            <textarea value={editData.target_audience} onChange={(e) => setEditData({ ...editData, target_audience: e.target.value })} placeholder="Describe your ideal customers..." rows={3} className="input resize-none" />
                        </div>
                    ) : (
                        <p className="text-[var(--foreground-muted)] whitespace-pre-wrap">{project.target_audience || 'No target audience defined'}</p>
                    )}
                </EditableSection>

                {/* Key Messages */}
                <EditableSection title="Key Messages" subtitle="Core messages to reinforce" icon={<Lightbulb className="w-5 h-5" />} iconColor="warning" isEditing={editingSection === 'messages'} onEdit={() => startEdit('messages')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'messages' ? (
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <AiButton loading={aiLoading === 'key_messages'} onClick={() => aiSuggest('key_messages', 'key_messages')} label="Generate 5" />
                            </div>
                            {(editData.key_messages || ['']).map((msg: string, i: number) => (
                                <div key={i} className="flex gap-2">
                                    <input type="text" value={msg} onChange={(e) => updateListItem('key_messages', i, e.target.value)} placeholder={`Message ${i + 1}`} className="input flex-1" />
                                    {editData.key_messages?.length > 1 && <button type="button" onClick={() => removeListItem('key_messages', i)} className="p-2 text-[var(--error)] cursor-pointer"><X className="w-4 h-4" /></button>}
                                </div>
                            ))}
                            <button type="button" onClick={() => addListItem('key_messages')} className="btn btn-ghost text-sm cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {branding.key_messages?.length > 0 ? branding.key_messages.map((msg: string, i: number) => (
                                <span key={i} className="px-3 py-1 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)]">{msg}</span>
                            )) : <p className="text-[var(--foreground-muted)]">No key messages defined</p>}
                        </div>
                    )}
                </EditableSection>

                {/* Content Pillars */}
                <EditableSection title="Content Pillars" subtitle="Main themes for content" icon={<FileText className="w-5 h-5" />} isEditing={editingSection === 'pillars'} onEdit={() => startEdit('pillars')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'pillars' ? (
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <AiButton loading={aiLoading === 'content_pillars'} onClick={() => aiSuggest('content_pillars', 'content_pillars')} label="Generate 5" />
                            </div>
                            {(editData.content_pillars || ['']).map((pillar: string, i: number) => (
                                <div key={i} className="flex gap-2">
                                    <input type="text" value={pillar} onChange={(e) => updateListItem('content_pillars', i, e.target.value)} placeholder={`Pillar ${i + 1}`} className="input flex-1" />
                                    {editData.content_pillars?.length > 1 && <button type="button" onClick={() => removeListItem('content_pillars', i)} className="p-2 text-[var(--error)] cursor-pointer"><X className="w-4 h-4" /></button>}
                                </div>
                            ))}
                            <button type="button" onClick={() => addListItem('content_pillars')} className="btn btn-ghost text-sm cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {project.content_pillars?.length ? project.content_pillars.map((pillar, i) => (
                                <span key={i} className="px-4 py-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] font-medium">{pillar}</span>
                            )) : <p className="text-[var(--foreground-muted)]">No content pillars defined</p>}
                        </div>
                    )}
                </EditableSection>

                {/* Hashtag Strategy */}
                <EditableSection title="Hashtag Strategy" subtitle="Hashtags to use or avoid" icon={<Hash className="w-5 h-5" />} isEditing={editingSection === 'hashtags'} onEdit={() => startEdit('hashtags')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'hashtags' ? (
                        <div>
                            <div className="flex justify-end mb-2">
                                <AiButton loading={aiLoading === 'hashtag_strategy'} onClick={() => aiSuggest('hashtag_strategy', 'hashtag_strategy')} />
                            </div>
                            <textarea value={editData.hashtag_strategy} onChange={(e) => setEditData({ ...editData, hashtag_strategy: e.target.value })} placeholder="e.g., Always use: #YourBrand. Avoid: #Competitor..." rows={3} className="input resize-none" />
                        </div>
                    ) : (
                        <p className="text-[var(--foreground-muted)] whitespace-pre-wrap">{branding.hashtag_strategy || 'No hashtag strategy defined'}</p>
                    )}
                </EditableSection>

                {/* Content Rules */}
                <EditableSection title="Content Guidelines" subtitle="Topics to embrace or avoid" icon={<Shield className="w-5 h-5" />} iconColor="info" isEditing={editingSection === 'rules'} onEdit={() => startEdit('rules')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'rules' ? (
                        <div>
                            <div className="flex justify-end mb-2">
                                <AiButton loading={aiLoading === 'content_rules'} onClick={() => aiSuggest('content_rules', 'content_rules')} />
                            </div>
                            <textarea value={editData.content_rules} onChange={(e) => setEditData({ ...editData, content_rules: e.target.value })} placeholder="e.g., Never mention competitors. Always include CTA..." rows={4} className="input resize-none" />
                        </div>
                    ) : (
                        <p className="text-[var(--foreground-muted)] whitespace-pre-wrap">{branding.content_rules || 'No content guidelines defined'}</p>
                    )}
                </EditableSection>

                {/* Banned Words */}
                <EditableSection title="Words to Avoid" subtitle="Words never to use in content" icon={<Ban className="w-5 h-5" />} iconColor="error" isEditing={editingSection === 'banned'} onEdit={() => startEdit('banned')} onSave={saveEdit} onCancel={cancelEdit} saving={saving}>
                    {editingSection === 'banned' ? (
                        <div>
                            <textarea value={editData.banned_words} onChange={(e) => setEditData({ ...editData, banned_words: e.target.value })} placeholder="e.g., revolutionizing, synergy, game-changer, disrupt..." rows={3} className="input resize-none" />
                            <p className="text-xs text-[var(--foreground-muted)] mt-2">Separate words with commas. AI will never use these in generated content.</p>
                        </div>
                    ) : (
                        <div>
                            {branding.banned_words ? (
                                <div className="flex flex-wrap gap-2">
                                    {branding.banned_words.split(',').map((word: string, i: number) => word.trim() && (
                                        <span key={i} className="px-3 py-1 rounded-lg bg-[var(--error)]/10 text-[var(--error)] text-sm">{word.trim()}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[var(--foreground-muted)]">No banned words defined</p>
                            )}
                        </div>
                    )}
                </EditableSection>

            </div>
        </div>
    )
}

// Components
function EditableSection({ title, subtitle, icon, iconColor = 'foreground', children, isEditing, onEdit, onSave, onCancel, saving }: { title: string; subtitle?: string; icon?: React.ReactNode; iconColor?: string; children: React.ReactNode; isEditing: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
    const colors: Record<string, string> = { primary: 'text-[var(--primary)]', secondary: 'text-[var(--secondary)]', success: 'text-[var(--success)]', warning: 'text-[var(--warning)]', info: 'text-[var(--info)]', foreground: 'text-[var(--foreground)]' }
    return (
        <section className="card p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    {icon && <span className={colors[iconColor]}>{icon}</span>}
                    <div><h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>{subtitle && <p className="text-xs text-[var(--foreground-muted)]">{subtitle}</p>}</div>
                </div>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel} className="btn btn-ghost text-sm cursor-pointer" disabled={saving}><X className="w-4 h-4" /> Cancel</button>
                        <button onClick={onSave} className="btn btn-primary text-sm cursor-pointer" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
                    </div>
                ) : (
                    <button onClick={onEdit} className="btn btn-ghost text-sm cursor-pointer"><Edit2 className="w-4 h-4" /> Edit</button>
                )}
            </div>
            {children}
        </section>
    )
}

function AiButton({ loading, onClick, label = 'AI Suggest' }: { loading: boolean; onClick: () => void; label?: string }) {
    return (
        <button type="button" onClick={onClick} disabled={loading} className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors cursor-pointer disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {label}
        </button>
    )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
    return (
        <div>
            <label className="block text-xs text-[var(--foreground-muted)] mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <input type="color" value={value || '#6366f1'} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg border-2 border-[var(--surface-border)] cursor-pointer" style={{ padding: 0 }} />
                <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="#hex" className="input flex-1 text-xs font-mono" style={{ padding: '6px 8px' }} />
            </div>
        </div>
    )
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
    return (
        <div>
            <p className="text-xs text-[var(--foreground-muted)] mb-1">{label}</p>
            <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)]" style={{ backgroundColor: color }} />
        </div>
    )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-xs text-[var(--foreground-muted)]">{label}</p>
            <p className="text-[var(--foreground)]">{value || <span className="text-[var(--foreground-muted)] italic">Not set</span>}</p>
        </div>
    )
}
