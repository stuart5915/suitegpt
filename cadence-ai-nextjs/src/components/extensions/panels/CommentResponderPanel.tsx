'use client'

import { PanelContentProps } from '../ExtensionPanelManager'
import { MessageCircle, Lock, Sparkles } from 'lucide-react'

export default function CommentResponderPanel({ mode, initialData, onComplete }: PanelContentProps) {
    return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>

            <h3 className="text-lg font-bold mb-2">Comment Responder</h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-4 max-w-[280px]">
                AI-powered replies to comments on your posts. Keep engagement high with personalized responses.
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-sm mb-4">
                <Lock className="w-4 h-4 text-amber-500" />
                <span className="text-amber-500 font-medium">Premium Extension</span>
            </div>

            <ul className="text-xs text-[var(--foreground-muted)] space-y-1 mb-6">
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    AI-generated replies
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Tone matching
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    Approval workflow
                </li>
                <li className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                    10 credits per reply
                </li>
            </ul>

            <button className="btn btn-primary w-full py-3">
                Coming Soon
            </button>
        </div>
    )
}
