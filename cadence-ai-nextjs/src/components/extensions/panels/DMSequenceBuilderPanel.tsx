'use client'

import { PanelContentProps } from '../ExtensionPanelManager'
import { Mail, Lock, Sparkles } from 'lucide-react'

export default function DMSequenceBuilderPanel({ mode, initialData, onComplete }: PanelContentProps) {
    return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-green-400" />
            </div>

            <h3 className="text-lg font-bold mb-2">DM Sequence Builder</h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-4 max-w-[280px]">
                Create automated DM sequences for lead nurturing with AI personalization.
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-sm mb-4">
                <Lock className="w-4 h-4 text-amber-500" />
                <span className="text-amber-500 font-medium">Premium Extension</span>
            </div>

            <ul className="text-xs text-[var(--foreground-muted)] space-y-1 mb-6">
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Multi-step sequences
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    AI personalization
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Trigger conditions
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    20 credits per sequence
                </li>
            </ul>

            <button className="btn btn-primary w-full py-3">
                Coming Soon
            </button>
        </div>
    )
}
