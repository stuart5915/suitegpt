'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import {
    LayoutDashboard,
    Settings,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    LogOut,
    User,
    Loader2,
    Rocket,
    RefreshCw,
    Calendar,
    MessageCircle
} from 'lucide-react'

interface SidebarProps {
    children: React.ReactNode
}

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/ai-fleet', label: 'AI Fleet', icon: Rocket },
    { href: '/loops', label: 'Content Loops', icon: RefreshCw },
    { href: '/engagement', label: 'Engagement', icon: MessageCircle },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({ children }: SidebarProps) {
    const pathname = usePathname()
    const { user, logout, isLoading } = useTelegramAuth()

    const [collapsed, setCollapsed] = useState(false)
    const [signingOut, setSigningOut] = useState(false)

    const handleSignOut = async () => {
        setSigningOut(true)
        try {
            await logout()
        } catch (err) {
            console.error('Error signing out:', err)
            setSigningOut(false)
        }
    }

    // Get display name
    const displayName = user?.username
        ? `@${user.username}`
        : user?.firstName || 'Account'

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            {/* Sidebar */}
            <aside
                className={`
          fixed left-0 top-0 z-40 h-screen
          bg-[var(--surface)] border-r border-[var(--surface-border)]
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
        `}
            >
                {/* Logo */}
                <div className="flex items-center h-16 px-4 border-b border-[var(--surface-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
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

                {/* Collapse Button */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="
            absolute -right-3 top-20
            w-6 h-6 rounded-full
            bg-[var(--surface)] border border-[var(--surface-border)]
            flex items-center justify-center
            text-[var(--foreground-muted)] hover:text-[var(--foreground)]
            hover:bg-[var(--surface-hover)]
            transition-colors duration-200
            shadow-md
          "
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[var(--surface-border)]">
                    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                        {/* User Avatar */}
                        {user?.photoUrl ? (
                            <img
                                src={user.photoUrl}
                                alt={user.firstName || 'User'}
                                className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-white" />
                            </div>
                        )}
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                    {isLoading ? 'Loading...' : displayName}
                                </p>
                                <button
                                    onClick={handleSignOut}
                                    disabled={signingOut}
                                    className="text-xs text-[var(--foreground-muted)] hover:text-[var(--error)] flex items-center gap-1"
                                >
                                    {signingOut ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <LogOut className="w-3 h-3" />
                                    )}
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={`
          flex-1 transition-all duration-300
          ${collapsed ? 'ml-16' : 'ml-64'}
        `}
            >
                {children}
            </main>
        </div>
    )
}
