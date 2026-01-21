'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    MessageCircle,
    Blocks,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Image as ImageIcon,
    ShoppingCart,
    Clock,
    Cloud,
    Quote,
    Calendar,
    ListTodo,
    Activity,
    Music,
    Flame,
    Bitcoin,
    Newspaper,
} from 'lucide-react'

interface SidebarProps {
    children: React.ReactNode
}

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/chat', label: 'AI Chat', icon: MessageCircle },
]

const widgetCategories = [
    {
        category: 'Essentials',
        widgets: [
            { id: 'clock', label: 'Clock', icon: Clock, description: 'Time and date display' },
            { id: 'weather', label: 'Weather', icon: Cloud, description: 'Current conditions' },
            { id: 'calendar', label: 'Calendar', icon: Calendar, description: 'Upcoming events' },
            { id: 'todo', label: 'Todo List', icon: ListTodo, description: 'Task management' },
        ]
    },
    {
        category: 'Ambient & Visual',
        widgets: [
            { id: 'wallpaper', label: 'Wallpaper', icon: ImageIcon, description: 'Beautiful backgrounds' },
            { id: 'photos', label: 'Photo Frame', icon: ImageIcon, description: 'Slideshow your photos' },
            { id: 'quote', label: 'Daily Quote', icon: Quote, description: 'Inspirational quotes' },
            { id: 'asmr-visuals', label: 'Ambient', icon: Flame, description: 'Relaxing visual effects' },
        ]
    },
    {
        category: 'Info & Data',
        widgets: [
            { id: 'news', label: 'News Feed', icon: Newspaper, description: 'Headlines ticker' },
            { id: 'crypto', label: 'Crypto Prices', icon: Bitcoin, description: 'Live crypto tracker' },
            { id: 'stocks', label: 'Stocks', icon: Activity, description: 'Market tracker' },
            { id: 'sports', label: 'Sports Scores', icon: Activity, description: 'Live scores' },
        ]
    },
    {
        category: 'Lifestyle',
        widgets: [
            { id: 'grocery-list', label: 'Grocery List', icon: ShoppingCart, description: 'Shopping list' },
            { id: 'music', label: 'Now Playing', icon: Music, description: 'Spotify integration' },
            { id: 'fitness', label: 'Fitness', icon: Activity, description: 'Health metrics' },
            { id: 'countdown', label: 'Countdown', icon: Clock, description: 'Event countdown' },
        ]
    },
]

export default function DashboardLayout({ children }: SidebarProps) {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const [widgetsOpen, setWidgetsOpen] = useState(false)
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

    const handleAddWidget = (widgetId: string) => {
        // TODO: Dispatch event or use context to add widget to dashboard
        console.log('Add widget:', widgetId)
        // For now, we'll use a custom event that the dashboard can listen to
        window.dispatchEvent(new CustomEvent('addWidget', { detail: { widgetId } }))
    }

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            {/* Sidebar */}
            <aside
                className={`
          fixed left-0 top-0 z-40 h-screen
          bg-[var(--surface)] border-r border-[var(--surface-border)]
          transition-all duration-300 ease-in-out
          pt-[60px] overflow-y-auto
          ${collapsed ? 'w-16' : 'w-64'}
        `}
            >
                {/* Logo */}
                <div className="flex items-center h-16 px-4 mt-4 border-b border-[var(--surface-border)]">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/suitehub-icon.jpg"
                            alt="SUITEHub"
                            width={64}
                            height={64}
                            className="rounded-xl"
                        />
                        {!collapsed && (
                            <span className="font-bold text-lg gradient-text">SUITEHub</span>
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
                                        ? 'bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-white shadow-lg'
                                        : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                                    }
                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span className="font-medium">{item.label}</span>}
                            </Link>
                        )
                    })}

                    {/* Widgets Section */}
                    <button
                        onClick={() => !collapsed && setWidgetsOpen(!widgetsOpen)}
                        className={`
                            flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg
                            transition-all duration-200 w-full
                            text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <Blocks className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span className="font-medium">Widgets</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown className={`w-4 h-4 transition-transform ${widgetsOpen ? 'rotate-180' : ''}`} />
                        )}
                    </button>

                    {/* Widget Categories Dropdown */}
                    {widgetsOpen && !collapsed && (
                        <div className="ml-2 mt-1 space-y-1">
                            {widgetCategories.map((cat) => (
                                <div key={cat.category}>
                                    <button
                                        onClick={() => setExpandedCategory(
                                            expandedCategory === cat.category ? null : cat.category
                                        )}
                                        className="flex items-center justify-between w-full px-3 py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--surface-hover)] transition-all"
                                    >
                                        <span className="font-medium">{cat.category}</span>
                                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedCategory === cat.category ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Individual Widgets */}
                                    {expandedCategory === cat.category && (
                                        <div className="ml-2 mt-1 space-y-0.5">
                                            {cat.widgets.map((widget) => {
                                                const WidgetIcon = widget.icon
                                                return (
                                                    <button
                                                        key={widget.id}
                                                        onClick={() => handleAddWidget(widget.id)}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg
                                                            text-[var(--foreground-muted)] hover:text-[var(--foreground)]
                                                            hover:bg-[var(--primary)]/10 border border-transparent
                                                            hover:border-[var(--primary)]/30 transition-all group"
                                                        title={widget.description}
                                                    >
                                                        <WidgetIcon className="w-4 h-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
                                                        <div className="text-left">
                                                            <div className="font-medium">{widget.label}</div>
                                                            <div className="text-[10px] text-[var(--foreground-muted)] opacity-70">{widget.description}</div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </nav>

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
          flex-1 transition-all duration-300
          ${collapsed ? 'ml-16' : 'ml-64'}
        `}
            >
                {children}
            </main>
        </div>
    )
}
