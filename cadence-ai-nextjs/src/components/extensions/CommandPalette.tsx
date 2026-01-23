'use client'

/**
 * Command Palette
 * Power user keyboard-driven extension access
 *
 * Features:
 * - CMD+K / Ctrl+K to open
 * - Search extensions and actions
 * - Keyboard navigation (arrows, enter, escape)
 * - Recent actions history
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useExtensionPanel } from '@/contexts/ExtensionPanelContext'
import { searchCommands, ExtensionCommand } from '@/lib/extensions/commands'
import { Search, ArrowUp, ArrowDown, CornerDownLeft, X } from 'lucide-react'

export default function CommandPalette() {
    const { isCommandPaletteOpen, setCommandPaletteOpen, openPanel } = useExtensionPanel()
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [commands, setCommands] = useState<ExtensionCommand[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Update commands when query changes
    useEffect(() => {
        setCommands(searchCommands(query))
        setSelectedIndex(0)
    }, [query])

    // Focus input when opened
    useEffect(() => {
        if (isCommandPaletteOpen) {
            setQuery('')
            setSelectedIndex(0)
            setCommands(searchCommands(''))
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isCommandPaletteOpen])

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, commands.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (commands[selectedIndex]) {
                    executeCommand(commands[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setCommandPaletteOpen(false)
                break
        }
    }, [commands, selectedIndex, setCommandPaletteOpen])

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' })
            }
        }
    }, [selectedIndex])

    const executeCommand = (command: ExtensionCommand) => {
        openPanel(command.extensionSlug, {
            initialData: command.initialData
        })
        setCommandPaletteOpen(false)
    }

    if (!isCommandPaletteOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
                onClick={() => setCommandPaletteOpen(false)}
            />

            {/* Palette Modal */}
            <div
                className="
                    fixed top-[20%] left-1/2 -translate-x-1/2
                    w-full max-w-xl
                    bg-[var(--surface)] rounded-xl shadow-2xl
                    border border-[var(--surface-border)]
                    overflow-hidden
                    z-[201]
                "
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--surface-border)]">
                    <Search className="w-5 h-5 text-[var(--foreground-muted)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search extensions or actions..."
                        className="
                            flex-1 bg-transparent
                            text-[var(--foreground)]
                            placeholder-[var(--foreground-muted)]
                            outline-none text-lg
                        "
                    />
                    <button
                        onClick={() => setCommandPaletteOpen(false)}
                        className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results List */}
                <div
                    ref={listRef}
                    className="max-h-[400px] overflow-y-auto py-2"
                >
                    {commands.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[var(--foreground-muted)]">
                            No results found
                        </div>
                    ) : (
                        commands.map((command, index) => (
                            <button
                                key={command.id}
                                onClick={() => executeCommand(command)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`
                                    w-full px-4 py-3 flex items-center gap-3
                                    text-left transition-colors
                                    ${index === selectedIndex
                                        ? 'bg-[var(--primary)]/10'
                                        : 'hover:bg-[var(--surface-hover)]'
                                    }
                                `}
                            >
                                <span className="text-xl">{command.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-[var(--foreground)]">
                                        {command.label}
                                    </div>
                                    <div className="text-sm text-[var(--foreground-muted)] truncate">
                                        {command.description}
                                    </div>
                                </div>
                                {index === selectedIndex && (
                                    <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                        <CornerDownLeft className="w-3 h-3" />
                                        Enter
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Footer with Keyboard Hints */}
                <div className="px-4 py-2 border-t border-[var(--surface-border)] flex items-center gap-4 text-xs text-[var(--foreground-muted)]">
                    <div className="flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" />
                        <ArrowDown className="w-3 h-3" />
                        <span>Navigate</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <CornerDownLeft className="w-3 h-3" />
                        <span>Select</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="px-1 bg-[var(--surface-hover)] rounded text-[10px]">ESC</span>
                        <span>Close</span>
                    </div>
                </div>
            </div>
        </>
    )
}
