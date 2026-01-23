'use client'

/**
 * Extension Panel Context for Cadence AI
 * Manages slide-over extension panels throughout the dashboard
 *
 * Features:
 * - Open/close extension panels
 * - Minimize panels to Quick Access Bar
 * - Support multiple stacked panels
 * - Pass initial data to extensions
 * - Handle panel completion callbacks
 * - Track enabled extensions for sidebar display
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { ExtensionSlug, UserExtension } from '@/lib/extensions/types'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { getUserExtensions, enableExtension, disableExtension } from '@/lib/extensions/api'

export interface ExtensionPanel {
    id: string
    extensionSlug: ExtensionSlug
    state: 'open' | 'minimized'
    position: number
    initialData?: Record<string, unknown>
    onComplete?: (result: unknown) => void
}

interface ExtensionPanelContextType {
    panels: ExtensionPanel[]
    openPanel: (slug: ExtensionSlug, options?: OpenPanelOptions) => string
    closePanel: (id: string) => void
    minimizePanel: (id: string) => void
    restorePanel: (id: string) => void
    bringToFront: (id: string) => void
    getPanelBySlug: (slug: ExtensionSlug) => ExtensionPanel | undefined
    isCommandPaletteOpen: boolean
    setCommandPaletteOpen: (open: boolean) => void
    // Enabled extensions management
    enabledExtensions: UserExtension[]
    isExtensionEnabled: (slug: ExtensionSlug) => boolean
    toggleExtension: (slug: ExtensionSlug) => Promise<boolean>
    loadingExtensions: boolean
    togglingExtension: string | null
}

interface OpenPanelOptions {
    initialData?: Record<string, unknown>
    onComplete?: (result: unknown) => void
}

const ExtensionPanelContext = createContext<ExtensionPanelContextType | undefined>(undefined)

// Generate unique panel ID
function generatePanelId(): string {
    return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function ExtensionPanelProvider({ children }: { children: ReactNode }) {
    const [panels, setPanels] = useState<ExtensionPanel[]>([])
    const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false)

    // Enabled extensions state
    const [enabledExtensions, setEnabledExtensions] = useState<UserExtension[]>([])
    const [loadingExtensions, setLoadingExtensions] = useState(true)
    const [togglingExtension, setTogglingExtension] = useState<string | null>(null)

    const { user, isLoading: authLoading } = useTelegramAuth()

    // Load enabled extensions on mount
    useEffect(() => {
        async function loadEnabledExtensions() {
            if (!user?.id) {
                setLoadingExtensions(false)
                return
            }

            try {
                const extensions = await getUserExtensions(user.id)
                setEnabledExtensions(extensions)
            } catch (error) {
                console.error('Failed to load enabled extensions:', error)
            } finally {
                setLoadingExtensions(false)
            }
        }

        if (!authLoading) {
            loadEnabledExtensions()
        }
    }, [user, authLoading])

    // Check if extension is enabled
    const isExtensionEnabled = useCallback((slug: ExtensionSlug): boolean => {
        return enabledExtensions.some(ue => ue.extension_slug === slug && ue.enabled)
    }, [enabledExtensions])

    // Toggle extension enabled state
    const toggleExtension = useCallback(async (slug: ExtensionSlug): Promise<boolean> => {
        if (!user?.id) {
            console.error('Cannot toggle extension: User not logged in')
            alert('Please log in with Telegram to enable extensions')
            return false
        }

        if (togglingExtension) return false

        setTogglingExtension(slug)

        const enabled = isExtensionEnabled(slug)
        let success: boolean

        try {
            if (enabled) {
                success = await disableExtension(user.id, slug)
            } else {
                success = await enableExtension(user.id, slug)
            }

            if (success) {
                setEnabledExtensions(prev => {
                    const existing = prev.find(ue => ue.extension_slug === slug)
                    if (existing) {
                        return prev.map(ue =>
                            ue.extension_slug === slug
                                ? { ...ue, enabled: !enabled }
                                : ue
                        )
                    } else {
                        return [...prev, {
                            user_id: user.id,
                            extension_slug: slug,
                            enabled: true,
                            settings: {},
                            credits_used_today: 0,
                            credits_used_month: 0,
                            last_used_at: null
                        }]
                    }
                })
            }
        } catch (error) {
            console.error('Failed to toggle extension:', error)
            alert('Failed to toggle extension. Please try again.')
            success = false
        } finally {
            setTogglingExtension(null)
        }

        return success
    }, [user, togglingExtension, isExtensionEnabled])

    // Open a new extension panel
    const openPanel = useCallback((slug: ExtensionSlug, options?: OpenPanelOptions): string => {
        // Check if panel for this extension already exists and is open
        const existingPanel = panels.find(p => p.extensionSlug === slug && p.state === 'open')
        if (existingPanel) {
            // Bring existing panel to front
            setPanels(prev => prev.map(p => ({
                ...p,
                position: p.id === existingPanel.id
                    ? Math.max(...prev.map(panel => panel.position)) + 1
                    : p.position
            })))
            return existingPanel.id
        }

        // Check if panel exists but is minimized
        const minimizedPanel = panels.find(p => p.extensionSlug === slug && p.state === 'minimized')
        if (minimizedPanel) {
            // Restore minimized panel
            setPanels(prev => prev.map(p => ({
                ...p,
                state: p.id === minimizedPanel.id ? 'open' : p.state,
                position: p.id === minimizedPanel.id
                    ? Math.max(...prev.map(panel => panel.position)) + 1
                    : p.position
            })))
            return minimizedPanel.id
        }

        // Create new panel
        const newPanel: ExtensionPanel = {
            id: generatePanelId(),
            extensionSlug: slug,
            state: 'open',
            position: panels.length > 0 ? Math.max(...panels.map(p => p.position)) + 1 : 0,
            initialData: options?.initialData,
            onComplete: options?.onComplete
        }

        setPanels(prev => [...prev, newPanel])
        return newPanel.id
    }, [panels])

    // Close and remove a panel
    const closePanel = useCallback((id: string) => {
        setPanels(prev => prev.filter(p => p.id !== id))
    }, [])

    // Minimize panel to Quick Access Bar
    const minimizePanel = useCallback((id: string) => {
        setPanels(prev => prev.map(p => ({
            ...p,
            state: p.id === id ? 'minimized' : p.state
        })))
    }, [])

    // Restore minimized panel
    const restorePanel = useCallback((id: string) => {
        setPanels(prev => prev.map(p => ({
            ...p,
            state: p.id === id ? 'open' : p.state,
            position: p.id === id
                ? Math.max(...prev.map(panel => panel.position)) + 1
                : p.position
        })))
    }, [])

    // Bring a panel to front of stack
    const bringToFront = useCallback((id: string) => {
        setPanels(prev => {
            const maxPosition = Math.max(...prev.map(p => p.position))
            return prev.map(p => ({
                ...p,
                position: p.id === id ? maxPosition + 1 : p.position
            }))
        })
    }, [])

    // Get panel by extension slug
    const getPanelBySlug = useCallback((slug: ExtensionSlug): ExtensionPanel | undefined => {
        return panels.find(p => p.extensionSlug === slug)
    }, [panels])

    return (
        <ExtensionPanelContext.Provider
            value={{
                panels,
                openPanel,
                closePanel,
                minimizePanel,
                restorePanel,
                bringToFront,
                getPanelBySlug,
                isCommandPaletteOpen,
                setCommandPaletteOpen,
                enabledExtensions,
                isExtensionEnabled,
                toggleExtension,
                loadingExtensions,
                togglingExtension
            }}
        >
            {children}
        </ExtensionPanelContext.Provider>
    )
}

export function useExtensionPanel() {
    const context = useContext(ExtensionPanelContext)
    if (context === undefined) {
        throw new Error('useExtensionPanel must be used within an ExtensionPanelProvider')
    }
    return context
}

// Convenience hook for opening panels with callbacks
export function useExtensionPanelWithCallback(slug: ExtensionSlug) {
    const { openPanel, getPanelBySlug } = useExtensionPanel()

    const open = useCallback((initialData?: Record<string, unknown>) => {
        return new Promise<unknown>((resolve) => {
            openPanel(slug, {
                initialData,
                onComplete: resolve
            })
        })
    }, [openPanel, slug])

    const isOpen = !!getPanelBySlug(slug)

    return { open, isOpen }
}
