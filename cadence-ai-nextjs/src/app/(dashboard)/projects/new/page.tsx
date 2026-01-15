'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    ArrowLeft,
    Save,
    Sparkles,
    Info,
    X,
    Plus,
    Loader2,
    Palette,
    Upload,
    Image as ImageIcon
} from 'lucide-react'
import { Platform, PLATFORM_CONFIG } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'

const ALL_PLATFORMS: Platform[] = ['x', 'instagram', 'linkedin', 'tiktok', 'youtube']

const PRESET_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#f59e0b', // Yellow
    '#64748b', // Slate
]

export default function NewProjectPage() {
    const router = useRouter()
    const supabase = createClient()

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [suggestingBrandVoice, setSuggestingBrandVoice] = useState(false)
    const [suggestingAudience, setSuggestingAudience] = useState(false)
    const [suggestingPillars, setSuggestingPillars] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        brand_voice: '',
        target_audience: '',
        content_pillars: [''],
        platforms: [] as Platform[],
        // Branding
        primary_color: '#6366f1',
        secondary_color: '#f97316',
        logo_url: '',
        brand_style: '', // e.g., "minimalist", "bold", "playful"
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const pillars = formData.content_pillars.filter(p => p.trim() !== '')

            // Store branding info in posting_schedule JSON field for now
            // (In production, you'd add proper columns to the database)
            const branding = {
                primary_color: formData.primary_color,
                secondary_color: formData.secondary_color,
                logo_url: formData.logo_url,
                brand_style: formData.brand_style,
            }

            const { data, error: insertError } = await supabase
                .from('projects')
                .insert({
                    user_id: user.id,
                    name: formData.name,
                    description: formData.description || null,
                    brand_voice: formData.brand_voice || null,
                    target_audience: formData.target_audience || null,
                    content_pillars: pillars,
                    platforms: formData.platforms,
                    logo_url: formData.logo_url || null,
                    posting_schedule: branding, // Store branding as JSON
                })
                .select()
                .single()

            if (insertError) throw insertError

            router.push('/projects')
            router.refresh()
        } catch (err: any) {
            console.error('Error saving project:', err)
            setError(err.message || 'Failed to save project')
        } finally {
            setSaving(false)
        }
    }

    const suggestBrandVoice = async () => {
        if (!formData.name && !formData.description) {
            setError('Please enter a project name or description first')
            return
        }

        setSuggestingBrandVoice(true)
        setError(null)

        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'brand_voice',
                    projectName: formData.name,
                    projectDescription: formData.description,
                }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setFormData(prev => ({ ...prev, brand_voice: data.suggestion }))
        } catch (err: any) {
            setError(err.message || 'Failed to generate suggestion')
        } finally {
            setSuggestingBrandVoice(false)
        }
    }

    const suggestTargetAudience = async () => {
        if (!formData.name && !formData.description) {
            setError('Please enter a project name or description first')
            return
        }

        setSuggestingAudience(true)
        setError(null)

        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'target_audience',
                    projectName: formData.name,
                    projectDescription: formData.description,
                }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setFormData(prev => ({ ...prev, target_audience: data.suggestion }))
        } catch (err: any) {
            setError(err.message || 'Failed to generate suggestion')
        } finally {
            setSuggestingAudience(false)
        }
    }

    const suggestContentPillars = async () => {
        if (!formData.name && !formData.description) {
            setError('Please enter a project name or description first')
            return
        }

        setSuggestingPillars(true)
        setError(null)

        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'content_pillars',
                    projectName: formData.name,
                    projectDescription: formData.description,
                }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            if (Array.isArray(data.suggestion)) {
                setFormData(prev => ({ ...prev, content_pillars: data.suggestion }))
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate suggestion')
        } finally {
            setSuggestingPillars(false)
        }
    }

    const togglePlatform = (platform: Platform) => {
        setFormData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }))
    }

    const addPillar = () => {
        setFormData(prev => ({
            ...prev,
            content_pillars: [...prev.content_pillars, '']
        }))
    }

    const updatePillar = (index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            content_pillars: prev.content_pillars.map((p, i) => i === index ? value : p)
        }))
    }

    const removePillar = (index: number) => {
        setFormData(prev => ({
            ...prev,
            content_pillars: prev.content_pillars.filter((_, i) => i !== index)
        }))
    }

    return (
        <div className="min-h-screen p-8 max-w-3xl mx-auto">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-[var(--foreground)]">New Project</h1>
                    <p className="text-[var(--foreground-muted)] mt-1">
                        Set up a new brand to manage
                    </p>
                </div>
            </header>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-[var(--error)]/10 text-[var(--error)] flex items-center gap-2">
                    <X className="w-5 h-5 flex-shrink-0" />
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info */}
                <section className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                        Basic Information
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Project Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., My Awesome App"
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Brief description of your project/brand... (This helps AI generate better suggestions)"
                                rows={3}
                                className="input resize-none"
                            />
                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                💡 Add a description to get smarter AI suggestions below
                            </p>
                        </div>
                    </div>
                </section>

                {/* Branding */}
                <section className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Palette className="w-5 h-5 text-[var(--primary)]" />
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">
                            Visual Branding
                        </h2>
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] mb-6">
                        These settings help AI generate on-brand content with consistent colors and style
                    </p>

                    <div className="space-y-6">
                        {/* Brand Colors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Primary Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-lg border-2 border-[var(--surface-border)] cursor-pointer"
                                        style={{ backgroundColor: formData.primary_color }}
                                        onClick={() => document.getElementById('primary-color-input')?.click()}
                                    />
                                    <input
                                        id="primary-color-input"
                                        type="color"
                                        value={formData.primary_color}
                                        onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_COLORS.slice(0, 5).map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, primary_color: color }))}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${formData.primary_color === color ? 'border-white' : 'border-transparent'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Secondary/Accent Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-lg border-2 border-[var(--surface-border)] cursor-pointer"
                                        style={{ backgroundColor: formData.secondary_color }}
                                        onClick={() => document.getElementById('secondary-color-input')?.click()}
                                    />
                                    <input
                                        id="secondary-color-input"
                                        type="color"
                                        value={formData.secondary_color}
                                        onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_COLORS.slice(5).map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, secondary_color: color }))}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${formData.secondary_color === color ? 'border-white' : 'border-transparent'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Logo URL */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Logo URL (optional)
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="url"
                                    value={formData.logo_url}
                                    onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                                    placeholder="https://example.com/logo.png"
                                    className="input flex-1"
                                />
                                {formData.logo_url && (
                                    <div className="w-12 h-12 rounded-lg bg-[var(--background-elevated)] border border-[var(--surface-border)] flex items-center justify-center overflow-hidden">
                                        <img
                                            src={formData.logo_url}
                                            alt="Logo preview"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                Tip: AI will reference your logo for watermarking and branded content
                            </p>
                        </div>

                        {/* Brand Style */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Visual Style
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {['Minimalist', 'Bold', 'Playful', 'Professional'].map((style) => (
                                    <button
                                        key={style}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, brand_style: style.toLowerCase() }))}
                                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.brand_style === style.toLowerCase()
                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                            : 'border-[var(--surface-border)] hover:border-[var(--foreground-muted)] text-[var(--foreground-muted)]'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color Preview */}
                        <div className="p-4 rounded-lg" style={{
                            background: `linear-gradient(135deg, ${formData.primary_color}20 0%, ${formData.secondary_color}20 100%)`,
                            borderLeft: `4px solid ${formData.primary_color}`
                        }}>
                            <p className="text-sm text-[var(--foreground)]">
                                <span style={{ color: formData.primary_color }} className="font-semibold">Primary</span>
                                {' & '}
                                <span style={{ color: formData.secondary_color }} className="font-semibold">Secondary</span>
                                {' color preview'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Platforms */}
                <section className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                        Platforms *
                    </h2>
                    <p className="text-sm text-[var(--foreground-muted)] mb-4">
                        Select the platforms you want to create content for
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {ALL_PLATFORMS.map((platform) => {
                            const isSelected = formData.platforms.includes(platform)

                            return (
                                <button
                                    key={platform}
                                    type="button"
                                    onClick={() => togglePlatform(platform)}
                                    className={`
                    p-4 rounded-xl border-2 transition-all cursor-pointer
                    ${isSelected
                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                            : 'border-[var(--surface-border)] hover:border-[var(--foreground-muted)]'
                                        }
                  `}
                                >
                                    <div className="flex justify-center mb-2">
                                        <PlatformIcon platform={platform} size={24} />
                                    </div>
                                    <p className={`text-sm font-medium ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                                        {PLATFORM_NAMES[platform] || platform}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* Brand Voice */}
                <section className="card p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">
                                Brand Voice
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Describe how your brand communicates
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={suggestingBrandVoice}
                            onClick={suggestBrandVoice}
                            className="btn btn-ghost text-sm"
                        >
                            {suggestingBrandVoice ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            AI Suggest
                        </button>
                    </div>

                    <textarea
                        value={formData.brand_voice}
                        onChange={(e) => setFormData(prev => ({ ...prev, brand_voice: e.target.value }))}
                        placeholder="e.g., Professional but friendly, uses simple language, occasionally humorous..."
                        rows={4}
                        className="input resize-none"
                    />

                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-[var(--info)]/10">
                        <Info className="w-4 h-4 text-[var(--info)] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--foreground-muted)]">
                            This helps AI generate content that matches your brand's unique voice and personality.
                        </p>
                    </div>
                </section>

                {/* Target Audience */}
                <section className="card p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">
                                Target Audience
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Who are you trying to reach?
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={suggestingAudience}
                            onClick={suggestTargetAudience}
                            className="btn btn-ghost text-sm"
                        >
                            {suggestingAudience ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            AI Suggest
                        </button>
                    </div>

                    <textarea
                        value={formData.target_audience}
                        onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                        placeholder="e.g., Health-conscious millennials aged 25-35 who want to improve their nutrition..."
                        rows={3}
                        className="input resize-none"
                    />
                </section>

                {/* Content Pillars */}
                <section className="card p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">
                                Content Pillars
                            </h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Main themes or topics your content will focus on
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={suggestingPillars}
                            onClick={suggestContentPillars}
                            className="btn btn-ghost text-sm"
                        >
                            {suggestingPillars ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            AI Suggest
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.content_pillars.map((pillar, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={pillar}
                                    onChange={(e) => updatePillar(index, e.target.value)}
                                    placeholder={`Pillar ${index + 1}, e.g., "Healthy Recipes"`}
                                    className="input flex-1"
                                />
                                {formData.content_pillars.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removePillar(index)}
                                        className="p-2 rounded-lg hover:bg-[var(--error)]/10 text-[var(--foreground-muted)] hover:text-[var(--error)]"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addPillar}
                        className="btn btn-ghost mt-3"
                    >
                        <Plus className="w-4 h-4" />
                        Add Pillar
                    </button>
                </section>

                {/* Submit */}
                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="btn btn-ghost"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !formData.name || formData.platforms.length === 0}
                        className="btn btn-primary"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Project
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
