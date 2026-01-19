'use client'

import { Audience } from '@/lib/supabase/types'

interface AudienceSelectorProps {
    audiences: Audience[]
    selectedId: string | null
    onSelect: (audienceId: string | null) => void
}

export default function AudienceSelector({ audiences, selectedId, onSelect }: AudienceSelectorProps) {
    if (audiences.length === 0) return null

    return (
        <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Target Audience
            </label>
            <div className="flex flex-wrap gap-2">
                {/* Generic/All option */}
                <button
                    onClick={() => onSelect(null)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedId === null
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                        }`}
                >
                    All Audiences
                </button>

                {/* Audience pills */}
                {audiences.map(audience => (
                    <button
                        key={audience.id}
                        onClick={() => onSelect(audience.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${selectedId === audience.id
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                            }`}
                    >
                        <span>{audience.emoji}</span>
                        <span>{audience.name}</span>
                    </button>
                ))}
            </div>

            {/* Selected audience details */}
            {selectedId && (
                <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    {(() => {
                        const audience = audiences.find(a => a.id === selectedId)
                        if (!audience) return null
                        // Get first angle or legacy single angle
                        const firstAngle = Array.isArray(audience.messagingAngles)
                            ? audience.messagingAngles[0]
                            : (audience as unknown as { messagingAngle?: string }).messagingAngle
                        const angleCount = Array.isArray(audience.messagingAngles) ? audience.messagingAngles.length : 1
                        return (
                            <div className="text-sm">
                                <p className="text-purple-400 font-medium">{audience.emoji} {audience.name}</p>
                                <p className="text-[var(--foreground-muted)] mt-1">
                                    {firstAngle}
                                    {angleCount > 1 && <span className="text-xs ml-2">(+{angleCount - 1} more angles)</span>}
                                </p>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}
