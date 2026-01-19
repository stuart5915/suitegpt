'use client'

import { useState } from 'react'
import { X, Check, Layers } from 'lucide-react'
import { Audience, ContentVariant } from '@/lib/supabase/types'

interface LoopItem {
    id: string
    title: string
    url?: string
    summary?: string
    keyPoints?: string[]
    content: string
    type: 'article' | 'post' | 'cta' | 'spotlight'
    lastUsed?: string
    usageCount: number
    previousPosts?: string[]
    variants?: ContentVariant[]
}

interface VariantEditorProps {
    item: LoopItem
    audiences: Audience[]
    onSave: (variants: ContentVariant[]) => void
    onClose: () => void
}

export default function VariantEditor({ item, audiences, onSave, onClose }: VariantEditorProps) {
    // Initialize variants from existing or create empty ones for each audience
    const initialVariants: ContentVariant[] = audiences.map(audience => {
        const existing = item.variants?.find(v => v.audienceId === audience.id)
        return existing || {
            audienceId: audience.id,
            hook: '',
            keyPoints: [],
            cta: ''
        }
    })

    const [variants, setVariants] = useState<ContentVariant[]>(initialVariants)
    const [activeTab, setActiveTab] = useState<string>(audiences[0]?.id || '')

    const updateVariant = (audienceId: string, field: keyof ContentVariant, value: string | string[]) => {
        setVariants(variants.map(v =>
            v.audienceId === audienceId
                ? { ...v, [field]: value }
                : v
        ))
    }

    const handleSave = () => {
        // Only save variants that have content
        const nonEmptyVariants = variants.filter(v =>
            v.hook || (v.keyPoints && v.keyPoints.length > 0) || v.cta
        )
        onSave(nonEmptyVariants)
        onClose()
    }

    const activeAudience = audiences.find(a => a.id === activeTab)
    const activeVariant = variants.find(v => v.audienceId === activeTab)

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[var(--surface-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Layers className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--foreground)]">Edit Variants</h2>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    Customize content for each audience segment
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Base Content Preview */}
                <div className="px-6 py-4 bg-[var(--background)] border-b border-[var(--surface-border)]">
                    <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-2">
                        Base Content
                    </h4>
                    <div className="text-[var(--foreground)]">
                        <p className="font-medium">{item.title}</p>
                        {item.summary && (
                            <p className="text-sm text-[var(--foreground-muted)] mt-1">{item.summary}</p>
                        )}
                    </div>
                </div>

                {/* Audience Tabs */}
                <div className="flex border-b border-[var(--surface-border)] overflow-x-auto">
                    {audiences.map(audience => {
                        const variant = variants.find(v => v.audienceId === audience.id)
                        const hasContent = variant && (variant.hook || variant.cta || (variant.keyPoints && variant.keyPoints.length > 0))

                        return (
                            <button
                                key={audience.id}
                                onClick={() => setActiveTab(audience.id)}
                                className={`px-4 py-3 flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${activeTab === audience.id
                                        ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5'
                                        : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                <span>{audience.emoji}</span>
                                <span>{audience.name}</span>
                                {hasContent && (
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Variant Editor */}
                <div className="flex-1 overflow-auto p-6">
                    {activeAudience && activeVariant && (
                        <div className="space-y-6">
                            {/* Audience Context */}
                            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{activeAudience.emoji}</span>
                                    <div>
                                        <h4 className="font-medium text-purple-400">{activeAudience.name}</h4>
                                        <p className="text-sm text-[var(--foreground-muted)]">{activeAudience.description}</p>
                                        <div className="text-sm text-purple-400 mt-2">
                                            {Array.isArray(activeAudience.messagingAngles) ? (
                                                <>
                                                    <span className="font-medium">{activeAudience.messagingAngles.length} Messaging Angles:</span>
                                                    <ul className="mt-1 space-y-1 text-[var(--foreground-muted)]">
                                                        {activeAudience.messagingAngles.slice(0, 3).map((angle, i) => (
                                                            <li key={i} className="text-xs">• {angle}</li>
                                                        ))}
                                                        {activeAudience.messagingAngles.length > 3 && (
                                                            <li className="text-xs text-purple-400">+ {activeAudience.messagingAngles.length - 3} more...</li>
                                                        )}
                                                    </ul>
                                                </>
                                            ) : (
                                                <p>Angle: {(activeAudience as unknown as { messagingAngle?: string }).messagingAngle}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hook */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Custom Hook
                                    <span className="text-[var(--foreground-muted)] font-normal ml-2">
                                        (Leave empty to use base content)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={activeVariant.hook || ''}
                                    onChange={(e) => updateVariant(activeTab, 'hook', e.target.value)}
                                    placeholder={`e.g., "Tired of ${activeAudience.painPoints[0]?.toLowerCase() || 'this problem'}?"`}
                                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Opening line that grabs this audience&apos;s attention
                                </p>
                            </div>

                            {/* Key Points */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Custom Key Points
                                    <span className="text-[var(--foreground-muted)] font-normal ml-2">
                                        (One per line)
                                    </span>
                                </label>
                                <textarea
                                    value={activeVariant.keyPoints?.join('\n') || ''}
                                    onChange={(e) => updateVariant(activeTab, 'keyPoints', e.target.value.split('\n').filter(Boolean))}
                                    placeholder={`What matters to ${activeAudience.name.toLowerCase()}...`}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                />
                            </div>

                            {/* CTA */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Custom CTA
                                </label>
                                <input
                                    type="text"
                                    value={activeVariant.cta || ''}
                                    onChange={(e) => updateVariant(activeTab, 'cta', e.target.value)}
                                    placeholder={activeAudience.cta || 'Enter custom call-to-action...'}
                                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Default: &quot;{activeAudience.cta}&quot;
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--surface-border)] flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 btn btn-ghost"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 btn btn-primary"
                    >
                        <Check className="w-4 h-4" />
                        Save Variants
                    </button>
                </div>
            </div>
        </div>
    )
}
