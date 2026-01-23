'use client'

/**
 * Extension Slide-Over Panel
 * Animated slide-in panel from right side of viewport
 *
 * Features:
 * - 480px width on desktop, full width on mobile
 * - Animated slide-in/out
 * - Minimize to Quick Access Bar
 * - Escape key to close
 * - Click outside backdrop to close
 * - Stacking support with z-index management
 */

import { useEffect, useCallback, useRef, ReactNode } from 'react'
import { X, Minus, Maximize2 } from 'lucide-react'
import { ExtensionSlug, getExtension } from '@/lib/extensions/types'

interface ExtensionSlideOverProps {
    id: string
    extensionSlug: ExtensionSlug
    isOpen: boolean
    isMinimized: boolean
    stackPosition: number
    onClose: () => void
    onMinimize: () => void
    onBringToFront: () => void
    children: ReactNode
}

export default function ExtensionSlideOver({
    id,
    extensionSlug,
    isOpen,
    isMinimized,
    stackPosition,
    onClose,
    onMinimize,
    onBringToFront,
    children
}: ExtensionSlideOverProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    const extension = getExtension(extensionSlug)

    // Handle escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen && !isMinimized) {
            onClose()
        }
    }, [isOpen, isMinimized, onClose])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen && !isMinimized) {
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen, isMinimized])

    if (!extension) return null
    if (isMinimized) return null

    // Calculate z-index based on stack position
    const zIndex = 100 + stackPosition

    // Calculate stacked offset (panels stack slightly left)
    const stackOffset = Math.min(stackPosition * 20, 60)

    return (
        <>
            {/* Backdrop - only show for topmost panel */}
            <div
                className={`
                    fixed inset-0 bg-black/30 backdrop-blur-sm
                    transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                style={{ zIndex: zIndex - 1 }}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed top-0 right-0 h-full
                    w-full md:w-[480px]
                    bg-[var(--surface)] border-l border-[var(--surface-border)]
                    shadow-2xl
                    transition-all duration-300 ease-out
                    flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
                style={{
                    zIndex,
                    transform: isOpen ? `translateX(-${stackOffset}px)` : 'translateX(100%)'
                }}
                onClick={onBringToFront}
            >
                {/* Panel Header */}
                <div
                    className="
                        flex items-center justify-between
                        px-4 h-14
                        bg-[var(--surface)] border-b border-[var(--surface-border)]
                        cursor-move select-none
                    "
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">{extension.icon}</span>
                        <h2 className="font-semibold text-[var(--foreground)]">
                            {extension.name}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Minimize Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onMinimize()
                            }}
                            className="
                                p-2 rounded-lg
                                text-[var(--foreground-muted)] hover:text-[var(--foreground)]
                                hover:bg-[var(--surface-hover)]
                                transition-colors
                            "
                            title="Minimize"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </>
    )
}

// Minimized Panel Indicator for Quick Access Bar
interface MinimizedPanelProps {
    id: string
    extensionSlug: ExtensionSlug
    onRestore: () => void
    onClose: () => void
}

export function MinimizedPanelIndicator({
    id,
    extensionSlug,
    onRestore,
    onClose
}: MinimizedPanelProps) {
    const extension = getExtension(extensionSlug)
    if (!extension) return null

    return (
        <div
            className="
                flex items-center gap-2 px-3 py-1.5
                bg-[var(--surface)] rounded-lg
                border border-[var(--surface-border)]
                hover:border-[var(--primary)]
                transition-all cursor-pointer
                group
            "
            onClick={onRestore}
        >
            <span className="text-sm">{extension.icon}</span>
            <span className="text-xs font-medium text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
                {extension.name}
            </span>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                }}
                className="
                    p-0.5 rounded
                    text-[var(--foreground-muted)] hover:text-red-500
                    opacity-0 group-hover:opacity-100
                    transition-all
                "
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    )
}
