'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Settings,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Calendar,
    Puzzle,
    ChevronDown
} from 'lucide-react'
import CreditsDisplay from '@/components/CreditsDisplay'
import { useExtensionPanel } from '@/contexts/ExtensionPanelContext'
import { EXTENSION_REGISTRY, getExtension } from '@/lib/extensions/types'

interface SidebarProps {
    children: React.ReactNode
}

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/loops', label: 'Content Loops', icon: RefreshCw },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/extensions', label: 'Extensions', icon: Puzzle },
    { href: '/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({ children }: SidebarProps) {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const [extensionsExpanded, setExtensionsExpanded] = useState(true)

    const { enabledExtensions, isExtensionEnabled } = useExtensionPanel()

    // Get list of enabled extension slugs
    const enabledExtensionSlugs = enabledExtensions
        .filter(ue => ue.enabled)
        .map(ue => ue.extension_slug)

    // Get full extension data for enabled extensions
    const enabledExtensionData = enabledExtensionSlugs
        .map(slug => getExtension(slug))
        .filter(ext => ext !== undefined)

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            {/* Top Header Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-[var(--surface)] border-b border-[var(--surface-border)]">
                <div className={`h-full flex items-center justify-between px-4 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
                    <div className="flex items-center gap-2">
                        {/* Can add breadcrumbs or page title here */}
                    </div>
                    <div className="flex items-center gap-3">
                        <CreditsDisplay compact />
                    </div>
                </div>
            </header>

            {/* Sidebar */}
            <aside
                className={`
          fixed left-0 top-0 z-40 h-screen
          bg-[var(--surface)] border-r border-[var(--surface-border)]
          transition-all duration-300 ease-in-out
          pt-[60px]
          ${collapsed ? 'w-16' : 'w-64'}
        `}
            >
                {/* Logo */}
                <div className="flex items-center h-16 px-4 mt-4 border-b border-[var(--surface-border)]">
                    <div className="flex items-center gap-3">
                        <img
                            src="https://getsuite.app/assets/icons/cadence-icon.jpg"
                            alt="Cadence AI"
                            className="w-8 h-8 rounded-lg object-cover"
                        />
                        {!collapsed && (
                            <span className="font-bold text-lg gradient-text">Cadence AI</span>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1 p-3 mt-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${isActive
                                        ? 'bg-[var(--primary)] text-white shadow-lg'
                                        : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                                    }
                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span className="font-medium">{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Enabled Extensions Section */}
                {!collapsed && enabledExtensionData.length > 0 && (
                    <div className="px-3 mt-4">
                        <button
                            onClick={() => setExtensionsExpanded(!extensionsExpanded)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors"
                        >
                            <span>My Extensions</span>
                            <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${extensionsExpanded ? '' : '-rotate-90'}`}
                            />
                        </button>

                        {extensionsExpanded && (
                            <nav className="flex flex-col gap-1 mt-1">
                                {enabledExtensionData.map((ext) => {
                                    if (!ext) return null
                                    const isActive = pathname === `/extensions/${ext.slug}`

                                    return (
                                        <Link
                                            key={ext.slug}
                                            href={`/extensions/${ext.slug}`}
                                            className={`
                                                flex items-center gap-3 px-3 py-2 rounded-lg
                                                transition-all duration-200
                                                ${isActive
                                                    ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30'
                                                    : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                                                }
                                            `}
                                        >
                                            <span className="text-lg flex-shrink-0">{ext.icon}</span>
                                            <span className="font-medium text-sm truncate">{ext.name}</span>
                                        </Link>
                                    )
                                })}
                            </nav>
                        )}
                    </div>
                )}

                {/* Collapsed Extensions Icons */}
                {collapsed && enabledExtensionData.length > 0 && (
                    <div className="px-3 mt-4 border-t border-[var(--surface-border)] pt-4">
                        <nav className="flex flex-col gap-1">
                            {enabledExtensionData.map((ext) => {
                                if (!ext) return null
                                const isActive = pathname === `/extensions/${ext.slug}`

                                return (
                                    <Link
                                        key={ext.slug}
                                        href={`/extensions/${ext.slug}`}
                                        className={`
                                            flex items-center justify-center p-2.5 rounded-lg
                                            transition-all duration-200
                                            ${isActive
                                                ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                                                : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                                            }
                                        `}
                                        title={ext.name}
                                    >
                                        <span className="text-lg">{ext.icon}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>
                )}

                {/* Collapse Button */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="
            absolute -right-3 top-[160px] z-50
            w-6 h-6 rounded-full
            bg-[var(--surface)] border border-[var(--surface-border)]
            flex items-center justify-center
            text-[var(--foreground-muted)] hover:text-[var(--foreground)]
            hover:bg-[var(--surface-hover)]
            transition-all duration-300
            shadow-md cursor-pointer
          "
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>

            </aside>

            {/* Main Content */}
            <main
                className={`
          flex-1 transition-all duration-300 pt-[60px]
          ${collapsed ? 'ml-16' : 'ml-64'}
        `}
            >
                {children}
            </main>
        </div>
    )
}
