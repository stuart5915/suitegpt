'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useExtensionPanel } from '@/contexts/ExtensionPanelContext'
import {
    EXTENSION_REGISTRY,
    Extension,
    ExtensionCategory
} from '@/lib/extensions/types'
import {
    Loader2,
    Puzzle,
    Zap,
    MessageCircle,
    BarChart3,
    TrendingUp,
    Sparkles,
    Check,
    Lock,
    ArrowRight,
    Search
} from 'lucide-react'

const CATEGORY_CONFIG: Record<ExtensionCategory, { name: string; icon: React.ReactNode; color: string }> = {
    engagement: {
        name: 'Engagement',
        icon: <MessageCircle className="w-4 h-4" />,
        color: 'from-pink-500 to-rose-500'
    },
    content: {
        name: 'Content',
        icon: <Sparkles className="w-4 h-4" />,
        color: 'from-purple-500 to-indigo-500'
    },
    analytics: {
        name: 'Analytics',
        icon: <BarChart3 className="w-4 h-4" />,
        color: 'from-blue-500 to-cyan-500'
    },
    growth: {
        name: 'Growth',
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'from-green-500 to-emerald-500'
    }
}

export default function ExtensionsPage() {
    const {
        enabledExtensions,
        isExtensionEnabled,
        toggleExtension,
        loadingExtensions,
        togglingExtension
    } = useExtensionPanel()

    const [filter, setFilter] = useState<ExtensionCategory | 'all'>('all')
    const [search, setSearch] = useState('')

    const filteredExtensions = EXTENSION_REGISTRY.filter(ext => {
        if (filter !== 'all' && ext.category !== filter) return false
        if (search && !ext.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const enabledCount = enabledExtensions.filter(ue => ue.enabled).length

    if (loadingExtensions) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Puzzle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--foreground)]">
                            Extensions
                        </h1>
                        <p className="text-[var(--foreground-muted)]">
                            {enabledCount} extension{enabledCount !== 1 ? 's' : ''} enabled
                        </p>
                    </div>
                </div>
                <p className="text-[var(--foreground-muted)] mt-2 max-w-2xl">
                    Supercharge your content creation with powerful extensions. Enable extensions to add them to your sidebar for quick access.
                </p>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
                    <input
                        type="text"
                        placeholder="Search extensions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none"
                    />
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                            }`}
                    >
                        All
                    </button>
                    {(Object.entries(CATEGORY_CONFIG) as [ExtensionCategory, typeof CATEGORY_CONFIG[ExtensionCategory]][]).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${filter === key
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            {config.icon}
                            {config.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Extensions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExtensions.map((ext) => {
                    const enabled = isExtensionEnabled(ext.slug)
                    const categoryConfig = CATEGORY_CONFIG[ext.category]

                    return (
                        <div
                            key={ext.slug}
                            className={`card p-6 relative overflow-hidden transition-all hover:border-[var(--primary)] ${!ext.is_active ? 'opacity-60' : ''
                                }`}
                        >
                            {/* Premium Badge */}
                            {ext.is_premium && (
                                <div className="absolute top-4 right-4">
                                    <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full flex items-center gap-1">
                                        <Zap className="w-3 h-3" />
                                        PRO
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryConfig.color} flex items-center justify-center text-2xl`}>
                                    {ext.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-[var(--foreground)]">
                                        {ext.name}
                                    </h3>
                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${categoryConfig.color} text-white`}>
                                        {categoryConfig.icon}
                                        {categoryConfig.name}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-[var(--foreground-muted)] mb-4">
                                {ext.description}
                            </p>

                            {/* Features */}
                            <ul className="space-y-1 mb-4">
                                {ext.features.slice(0, 3).map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                        <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {/* Credit Cost */}
                            <div className="flex items-center gap-2 mb-4 text-sm">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span className="text-[var(--foreground-muted)]">
                                    {ext.credit_cost.free
                                        ? 'Free'
                                        : ext.credit_cost.per_use
                                            ? `${ext.credit_cost.per_use} credits/use`
                                            : ext.credit_cost.per_day
                                                ? `${ext.credit_cost.per_day} credits/day`
                                                : ext.credit_cost.per_month
                                                    ? `${ext.credit_cost.per_month} credits/month`
                                                    : 'Free'}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {ext.is_active ? (
                                    <>
                                        <button
                                            onClick={() => toggleExtension(ext.slug)}
                                            disabled={togglingExtension === ext.slug}
                                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${enabled
                                                    ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                                    : 'bg-[var(--primary)] text-white'
                                                }`}
                                        >
                                            {togglingExtension === ext.slug ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : enabled ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Enabled
                                                </>
                                            ) : (
                                                'Enable'
                                            )}
                                        </button>
                                        <Link
                                            href={`/extensions/${ext.slug}`}
                                            className="py-2 px-4 rounded-lg font-medium bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all flex items-center gap-2"
                                        >
                                            Open
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </>
                                ) : (
                                    <button
                                        disabled
                                        className="flex-1 py-2 px-4 rounded-lg font-medium bg-[var(--surface)] text-[var(--foreground-muted)] cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Lock className="w-4 h-4" />
                                        Coming Soon
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Empty State */}
            {filteredExtensions.length === 0 && (
                <div className="text-center py-12">
                    <Puzzle className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        No extensions found
                    </h3>
                    <p className="text-[var(--foreground-muted)]">
                        Try adjusting your search or filter
                    </p>
                </div>
            )}
        </div>
    )
}
