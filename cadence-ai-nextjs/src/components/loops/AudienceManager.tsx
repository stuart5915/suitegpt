'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Download, Edit3, Check, Users } from 'lucide-react'
import { Audience } from '@/lib/supabase/types'
import { SUITE_AUDIENCES } from '@/lib/audiences/templates'

interface AudienceManagerProps {
    audiences: Audience[]
    onSave: (audiences: Audience[]) => void
    onClose: () => void
}

interface AudienceFormData {
    name: string
    emoji: string
    description: string
    painPoints: string
    desires: string
    messagingAngles: string  // Multi-line text (one angle per line)
    cta: string
    emailCapture: boolean
}

const emptyForm: AudienceFormData = {
    name: '',
    emoji: '👤',
    description: '',
    painPoints: '',
    desires: '',
    messagingAngles: '',
    cta: '',
    emailCapture: false
}

export default function AudienceManager({ audiences, onSave, onClose }: AudienceManagerProps) {
    const [localAudiences, setLocalAudiences] = useState<Audience[]>(audiences)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [formData, setFormData] = useState<AudienceFormData>(emptyForm)

    const handleImportSuiteTemplate = () => {
        const newAudiences = SUITE_AUDIENCES.map(audience => ({
            ...audience,
            id: crypto.randomUUID()
        }))
        setLocalAudiences([...localAudiences, ...newAudiences])
    }

    const handleAddAudience = () => {
        if (!formData.name.trim()) return

        const newAudience: Audience = {
            id: crypto.randomUUID(),
            name: formData.name,
            emoji: formData.emoji || '👤',
            description: formData.description,
            painPoints: formData.painPoints.split('\n').filter(Boolean),
            desires: formData.desires.split('\n').filter(Boolean),
            messagingAngles: formData.messagingAngles.split('\n').filter(Boolean),
            cta: formData.cta,
            emailCapture: formData.emailCapture
        }

        setLocalAudiences([...localAudiences, newAudience])
        setFormData(emptyForm)
        setShowAddForm(false)
    }

    const handleEditAudience = (audience: Audience) => {
        setEditingId(audience.id)
        setFormData({
            name: audience.name,
            emoji: audience.emoji,
            description: audience.description,
            painPoints: audience.painPoints.join('\n'),
            desires: audience.desires.join('\n'),
            // Support both legacy and new format
            messagingAngles: Array.isArray(audience.messagingAngles)
                ? audience.messagingAngles.join('\n')
                : (audience as unknown as { messagingAngle?: string }).messagingAngle || '',
            cta: audience.cta,
            emailCapture: audience.emailCapture || false
        })
    }

    const handleSaveEdit = () => {
        if (!editingId || !formData.name.trim()) return

        setLocalAudiences(localAudiences.map(a =>
            a.id === editingId
                ? {
                    ...a,
                    name: formData.name,
                    emoji: formData.emoji || '👤',
                    description: formData.description,
                    painPoints: formData.painPoints.split('\n').filter(Boolean),
                    desires: formData.desires.split('\n').filter(Boolean),
                    messagingAngles: formData.messagingAngles.split('\n').filter(Boolean),
                    cta: formData.cta,
                    emailCapture: formData.emailCapture
                }
                : a
        ))
        setEditingId(null)
        setFormData(emptyForm)
    }

    const handleDeleteAudience = (id: string) => {
        setLocalAudiences(localAudiences.filter(a => a.id !== id))
    }

    const handleSave = () => {
        onSave(localAudiences)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[var(--surface-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--foreground)]">Manage Audiences</h2>
                                <p className="text-sm text-[var(--foreground-muted)]">
                                    {localAudiences.length} audience{localAudiences.length !== 1 ? 's' : ''} defined
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

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-4">
                    {/* Import Template Button */}
                    {localAudiences.length === 0 && (
                        <button
                            onClick={handleImportSuiteTemplate}
                            className="w-full p-4 border-2 border-dashed border-purple-500/50 rounded-xl hover:bg-purple-500/10 transition-colors group"
                        >
                            <div className="flex items-center justify-center gap-3">
                                <Download className="w-5 h-5 text-purple-500" />
                                <span className="font-medium text-purple-500">Import SUITE Template</span>
                            </div>
                            <p className="text-sm text-[var(--foreground-muted)] mt-2">
                                Pre-configured audiences: Entrepreneurs, Contributors, Passive Users, Influencers
                            </p>
                        </button>
                    )}

                    {/* Existing Audiences */}
                    {localAudiences.map(audience => (
                        <div
                            key={audience.id}
                            className="bg-[var(--background)] rounded-xl p-4 border border-[var(--surface-border)]"
                        >
                            {editingId === audience.id ? (
                                // Edit Form
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.emoji}
                                            onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                                            className="w-16 px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-center text-xl"
                                            maxLength={2}
                                        />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Audience name"
                                            className="flex-1 px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description"
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                    />
                                    <textarea
                                        value={formData.painPoints}
                                        onChange={(e) => setFormData({ ...formData, painPoints: e.target.value })}
                                        placeholder="Pain points (one per line)"
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                    />
                                    <textarea
                                        value={formData.desires}
                                        onChange={(e) => setFormData({ ...formData, desires: e.target.value })}
                                        placeholder="Desires (one per line)"
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                    />
                                    <textarea
                                        value={formData.messagingAngles}
                                        onChange={(e) => setFormData({ ...formData, messagingAngles: e.target.value })}
                                        placeholder="Messaging angles (one per line - AI cycles through these)"
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                                    />
                                    <input
                                        type="text"
                                        value={formData.cta}
                                        onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                                        placeholder="Call to action"
                                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                    />
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.emailCapture}
                                            onChange={(e) => setFormData({ ...formData, emailCapture: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm text-[var(--foreground)]">Enable email capture for this audience</span>
                                    </label>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setEditingId(null); setFormData(emptyForm) }}
                                            className="px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)] rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg flex items-center gap-1"
                                        >
                                            <Check className="w-4 h-4" />
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Display Mode
                                <div className="flex items-start gap-4">
                                    <div className="text-2xl">{audience.emoji}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-[var(--foreground)]">{audience.name}</h3>
                                            {audience.emailCapture && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500">
                                                    Email Capture
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                            {audience.description}
                                        </p>
                                        <p className="text-sm text-[var(--primary)] mt-2">
                                            CTA: {audience.cta}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEditAudience(audience)}
                                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg"
                                        >
                                            <Edit3 className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAudience(audience.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg group"
                                        >
                                            <Trash2 className="w-4 h-4 text-[var(--foreground-muted)] group-hover:text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add New Form */}
                    {showAddForm ? (
                        <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--surface-border)] space-y-3">
                            <h4 className="font-medium text-[var(--foreground)]">Add New Audience</h4>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.emoji}
                                    onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                                    className="w-16 px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-center text-xl"
                                    maxLength={2}
                                    placeholder="👤"
                                />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Audience name"
                                    className="flex-1 px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                                />
                            </div>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description"
                                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                            />
                            <textarea
                                value={formData.painPoints}
                                onChange={(e) => setFormData({ ...formData, painPoints: e.target.value })}
                                placeholder="Pain points (one per line)"
                                rows={2}
                                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                            />
                            <textarea
                                value={formData.desires}
                                onChange={(e) => setFormData({ ...formData, desires: e.target.value })}
                                placeholder="Desires (one per line)"
                                rows={2}
                                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                            />
                            <textarea
                                value={formData.messagingAngles}
                                onChange={(e) => setFormData({ ...formData, messagingAngles: e.target.value })}
                                placeholder="Messaging angles (one per line - AI cycles through these)"
                                rows={2}
                                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] resize-none"
                            />
                            <input
                                type="text"
                                value={formData.cta}
                                onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                                placeholder="Call to action"
                                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)]"
                            />
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.emailCapture}
                                    onChange={(e) => setFormData({ ...formData, emailCapture: e.target.checked })}
                                    className="rounded"
                                />
                                <span className="text-sm text-[var(--foreground)]">Enable email capture for this audience</span>
                            </label>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => { setShowAddForm(false); setFormData(emptyForm) }}
                                    className="px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)] rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAudience}
                                    disabled={!formData.name.trim()}
                                    className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full p-3 border border-dashed border-[var(--surface-border)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-center gap-2 text-[var(--foreground-muted)]"
                        >
                            <Plus className="w-4 h-4" />
                            Add Custom Audience
                        </button>
                    )}

                    {/* Import Template Button (when audiences exist) */}
                    {localAudiences.length > 0 && (
                        <button
                            onClick={handleImportSuiteTemplate}
                            className="w-full p-3 hover:bg-purple-500/10 transition-colors rounded-xl flex items-center justify-center gap-2 text-purple-500"
                        >
                            <Download className="w-4 h-4" />
                            Import SUITE Template
                        </button>
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
                        Save Audiences
                    </button>
                </div>
            </div>
        </div>
    )
}
