'use client'

/**
 * Quick Access Bar
 * Fixed bar at bottom of viewport for quick extension access
 *
 * Features:
 * - One-click access to any extension
 * - Shows minimized panel indicators
 * - Credit balance display
 * - Mobile: Horizontal scroll
 * - Command palette trigger (CMD+K)
 */

import { useCallback, useEffect } from 'react'
import { useExtensionPanel } from '@/contexts/ExtensionPanelContext'
import { MinimizedPanelIndicator } from './ExtensionSlideOver'
import { getActiveExtensions, ExtensionSlug } from '@/lib/extensions/types'
import { Command, Coins, Plus } from 'lucide-react'

interface QuickAccessBarProps {
    credits?: number
}

export default function QuickAccessBar({ credits = 0 }: QuickAccessBarProps) {
    const {
        panels,
        openPanel,
        restorePanel,
        closePanel,
        setCommandPaletteOpen
    } = useExtensionPanel()

    // Get active extensions
    const activeExtensions = getActiveExtensions()

    // Get minimized panels
    const minimizedPanels = panels.filter(p => p.state === 'minimized')

    // Get open panel slugs (to show indicator)
    const openPanelSlugs = panels
        .filter(p => p.state === 'open')
        .map(p => p.extensionSlug)

    // Handle keyboard shortcut for command palette
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault()
            setCommandPaletteOpen(true)
        }
    }, [setCommandPaletteOpen])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    const handleExtensionClick = (slug: ExtensionSlug) => {
        openPanel(slug)
    }

    return (
        <div
            className="
                fixed bottom-0 left-0 right-0 z-[90]
                h-14 px-4
                bg-[var(--surface)] border-t border-[var(--surface-border)]
                flex items-center justify-between gap-4
                md:left-16
            "
        >
            {/* Extension Icons (scrollable on mobile) */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
                {/* Minimized Panels First */}
                {minimizedPanels.map(panel => (
                    <MinimizedPanelIndicator
                        key={panel.id}
                        id={panel.id}
                        extensionSlug={panel.extensionSlug}
                        onRestore={() => restorePanel(panel.id)}
                        onClose={() => closePanel(panel.id)}
                    />
                ))}

                {/* Separator if there are minimized panels */}
                {minimizedPanels.length > 0 && (
                    <div className="w-px h-6 bg-[var(--surface-border)] mx-2 flex-shrink-0" />
                )}

                {/* Extension Quick Access Icons */}
                {activeExtensions.map(ext => {
                    const isOpen = openPanelSlugs.includes(ext.slug)
                    const isMinimized = minimizedPanels.some(p => p.extensionSlug === ext.slug)

                    // Don't show in quick access if already showing in minimized section
                    if (isMinimized) return null

                    return (
                        <button
                            key={ext.slug}
                            onClick={() => handleExtensionClick(ext.slug)}
                            className={`
                                flex-shrink-0
                                w-10 h-10 rounded-lg
                                flex items-center justify-center
                                text-lg
                                transition-all
                                ${isOpen
                                    ? 'bg-[var(--primary)]/20 ring-2 ring-[var(--primary)]'
                                    : 'bg-[var(--surface-hover)] hover:bg-[var(--primary)]/10 hover:ring-1 hover:ring-[var(--primary)]'
                                }
                            `}
                            title={ext.name}
                        >
                            {ext.icon}
                        </button>
                    )
                })}

                {/* More Extensions Button */}
                <button
                    onClick={() => openPanel('social-engager')} // Placeholder - could open extension browser
                    className="
                        flex-shrink-0
                        w-10 h-10 rounded-lg
                        flex items-center justify-center
                        bg-[var(--surface-hover)] hover:bg-[var(--primary)]/10
                        text-[var(--foreground-muted)] hover:text-[var(--foreground)]
                        transition-all
                    "
                    title="More Extensions"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Right Section: Credits & Command Palette */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {/* Credits Display */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-hover)] rounded-lg">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                        {credits.toLocaleString()}
                    </span>
                </div>

                {/* Command Palette Trigger */}
                <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="
                        flex items-center gap-2 px-3 py-1.5
                        bg-[var(--surface-hover)] rounded-lg
                        text-[var(--foreground-muted)] hover:text-[var(--foreground)]
                        transition-colors
                    "
                    title="Command Palette (⌘K)"
                >
                    <Command className="w-4 h-4" />
                    <span className="text-xs hidden sm:inline">⌘K</span>
                </button>
            </div>
        </div>
    )
}
