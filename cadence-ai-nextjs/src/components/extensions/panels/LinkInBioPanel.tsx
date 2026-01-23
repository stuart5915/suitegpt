'use client'

import { PanelContentProps } from '../ExtensionPanelManager'
import { Link as LinkIcon, Lock, Sparkles } from 'lucide-react'

export default function LinkInBioPanel({ mode, initialData, onComplete }: PanelContentProps) {
    return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                <LinkIcon className="w-8 h-8 text-purple-400" />
            </div>

            <h3 className="text-lg font-bold mb-2">Link in Bio</h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-4 max-w-[280px]">
                Create a dynamic link-in-bio page with analytics and A/B testing.
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-sm mb-4">
                <Sparkles className="w-4 h-4 text-green-500" />
                <span className="text-green-500 font-medium">Free Basic Tier</span>
            </div>

            <ul className="text-xs text-[var(--foreground-muted)] space-y-1 mb-6">
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Customizable page
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Click tracking
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    A/B testing
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Auto-update from campaigns
                </li>
            </ul>

            <button className="btn btn-primary w-full py-3">
                Coming Soon
            </button>
        </div>
    )
}
