'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { getEngagementRules, createEngagementRule, toggleEngagementRule, deleteEngagementRule } from '@/lib/extensions/api'
import { EngagementRule } from '@/lib/extensions/types'
import {
    Loader2,
    MessageCircle,
    Plus,
    Trash2,
    Power,
    Heart,
    Reply,
    Repeat2,
    UserPlus,
    Hash,
    AtSign,
    Search,
    ChevronLeft,
    Play,
    Pause,
    Settings,
    Activity,
    Target,
    Zap,
    Clock,
    AlertCircle
} from 'lucide-react'

const PLATFORM_OPTIONS = [
    { value: 'x', label: 'X (Twitter)', icon: '𝕏' },
    { value: 'instagram', label: 'Instagram', icon: '📷' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' }
]

const TYPE_OPTIONS = [
    { value: 'keyword', label: 'Keyword', icon: <Search className="w-4 h-4" />, desc: 'Engage with posts containing specific keywords' },
    { value: 'account', label: 'Account', icon: <AtSign className="w-4 h-4" />, desc: 'Engage with posts from specific accounts' },
    { value: 'hashtag', label: 'Hashtag', icon: <Hash className="w-4 h-4" />, desc: 'Engage with posts using specific hashtags' }
]

const ACTION_OPTIONS = [
    { value: 'like', label: 'Like', icon: <Heart className="w-4 h-4" />, color: 'text-pink-500' },
    { value: 'reply', label: 'Reply', icon: <Reply className="w-4 h-4" />, color: 'text-blue-500' },
    { value: 'retweet', label: 'Retweet', icon: <Repeat2 className="w-4 h-4" />, color: 'text-green-500' },
    { value: 'follow', label: 'Follow', icon: <UserPlus className="w-4 h-4" />, color: 'text-purple-500' }
]

export default function SocialEngagerPage() {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [rules, setRules] = useState<EngagementRule[]>([])
    const [showNewRule, setShowNewRule] = useState(false)
    const [saving, setSaving] = useState(false)
    const [togglingRule, setTogglingRule] = useState<string | null>(null)

    // New rule form state
    const [newRule, setNewRule] = useState({
        name: '',
        platform: 'x',
        type: 'keyword',
        target: '',
        action: 'like',
        reply_template: '',
        daily_limit: 50
    })

    useEffect(() => {
        async function loadData() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            const data = await getEngagementRules(user.id)
            setRules(data)
            setLoading(false)
        }

        if (!authLoading) {
            loadData()
        }
    }, [user, authLoading])

    const handleCreateRule = async () => {
        if (!user?.id || !newRule.name || !newRule.target) return

        setSaving(true)

        const rule = await createEngagementRule({
            user_id: user.id,
            name: newRule.name,
            platform: newRule.platform,
            type: newRule.type,
            target: newRule.target,
            action: newRule.action,
            reply_template: newRule.action === 'reply' ? newRule.reply_template : undefined,
            daily_limit: newRule.daily_limit
        })

        if (rule) {
            setRules(prev => [rule, ...prev])
            setNewRule({
                name: '',
                platform: 'x',
                type: 'keyword',
                target: '',
                action: 'like',
                reply_template: '',
                daily_limit: 50
            })
            setShowNewRule(false)
        }

        setSaving(false)
    }

    const handleToggleRule = async (rule: EngagementRule) => {
        setTogglingRule(rule.id)
        const success = await toggleEngagementRule(rule.id, !rule.is_active)
        if (success) {
            setRules(prev =>
                prev.map(r =>
                    r.id === rule.id ? { ...r, is_active: !r.is_active } : r
                )
            )
        }
        setTogglingRule(null)
    }

    const handleDeleteRule = async (ruleId: string) => {
        const success = await deleteEngagementRule(ruleId)
        if (success) {
            setRules(prev => prev.filter(r => r.id !== ruleId))
        }
    }

    const activeRules = rules.filter(r => r.is_active).length
    const todayActions = rules.reduce((sum, r) => sum + (r.actions_today || 0), 0)

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            {/* Back Link */}
            <Link
                href="/extensions"
                className="inline-flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to Extensions
            </Link>

            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-3xl shadow-lg">
                        💬
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--foreground)]">
                            Social Engager
                        </h1>
                        <p className="text-[var(--foreground-muted)]">
                            Auto-engage with posts based on keywords, accounts, and hashtags
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                            <Target className="w-4 h-4" />
                            <span className="text-sm">Total Rules</span>
                        </div>
                        <p className="text-2xl font-bold text-[var(--foreground)]">{rules.length}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                            <Play className="w-4 h-4" />
                            <span className="text-sm">Active</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">{activeRules}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                            <Activity className="w-4 h-4" />
                            <span className="text-sm">Today's Actions</span>
                        </div>
                        <p className="text-2xl font-bold text-[var(--primary)]">{todayActions}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                            <Zap className="w-4 h-4" />
                            <span className="text-sm">Credits/Day</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-500">100</p>
                    </div>
                </div>
            </header>

            {/* Create New Rule */}
            {!showNewRule ? (
                <button
                    onClick={() => setShowNewRule(true)}
                    className="btn btn-primary mb-6 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create Engagement Rule
                </button>
            ) : (
                <div className="card p-6 mb-6">
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
                        New Engagement Rule
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Rule Name */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Rule Name
                            </label>
                            <input
                                type="text"
                                value={newRule.name}
                                onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Tech influencers"
                                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none"
                            />
                        </div>

                        {/* Platform */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Platform
                            </label>
                            <select
                                value={newRule.platform}
                                onChange={(e) => setNewRule(prev => ({ ...prev, platform: e.target.value }))}
                                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                            >
                                {PLATFORM_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.icon} {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Target Type */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Target Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setNewRule(prev => ({ ...prev, type: opt.value }))}
                                        className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${newRule.type === opt.value
                                                ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                : 'border-[var(--surface-border)] hover:border-[var(--primary)]/50'
                                            }`}
                                    >
                                        {opt.icon}
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Value */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                {newRule.type === 'keyword' ? 'Keyword' : newRule.type === 'account' ? 'Account Handle' : 'Hashtag'}
                            </label>
                            <input
                                type="text"
                                value={newRule.target}
                                onChange={(e) => setNewRule(prev => ({ ...prev, target: e.target.value }))}
                                placeholder={
                                    newRule.type === 'keyword'
                                        ? 'e.g., AI, startup, tech'
                                        : newRule.type === 'account'
                                            ? 'e.g., @elonmusk'
                                            : 'e.g., #buildinpublic'
                                }
                                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none"
                            />
                        </div>

                        {/* Action */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Action
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {ACTION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setNewRule(prev => ({ ...prev, action: opt.value }))}
                                        className={`p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${newRule.action === opt.value
                                                ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                : 'border-[var(--surface-border)] hover:border-[var(--primary)]/50'
                                            }`}
                                    >
                                        <span className={opt.color}>{opt.icon}</span>
                                        <span className="font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reply Template (if action is reply) */}
                        {newRule.action === 'reply' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Reply Template
                                </label>
                                <textarea
                                    value={newRule.reply_template}
                                    onChange={(e) => setNewRule(prev => ({ ...prev, reply_template: e.target.value }))}
                                    placeholder="Write a template for auto-replies. Use {author} for the post author's name."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none resize-none"
                                />
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    AI will personalize each reply based on the post content
                                </p>
                            </div>
                        )}

                        {/* Daily Limit */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Daily Limit
                            </label>
                            <input
                                type="number"
                                value={newRule.daily_limit}
                                onChange={(e) => setNewRule(prev => ({ ...prev, daily_limit: parseInt(e.target.value) || 50 }))}
                                min={1}
                                max={200}
                                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                            />
                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                Max actions per day for this rule (1-200)
                            </p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mt-4">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-200">
                            <p className="font-medium mb-1">Safety Guidelines</p>
                            <p className="text-amber-200/80">
                                Keep engagement natural to avoid platform restrictions. Start with low limits and increase gradually. Avoid spammy patterns.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-6">
                        <button
                            onClick={handleCreateRule}
                            disabled={saving || !newRule.name || !newRule.target}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            Create Rule
                        </button>
                        <button
                            onClick={() => setShowNewRule(false)}
                            className="btn bg-[var(--surface)] text-[var(--foreground)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                    Your Rules
                </h2>

                {rules.length === 0 ? (
                    <div className="card p-12 text-center">
                        <MessageCircle className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                            No engagement rules yet
                        </h3>
                        <p className="text-[var(--foreground-muted)] mb-4">
                            Create your first rule to start auto-engaging with relevant content
                        </p>
                        <button
                            onClick={() => setShowNewRule(true)}
                            className="btn btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Create Your First Rule
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rules.map((rule) => {
                            const actionConfig = ACTION_OPTIONS.find(a => a.value === rule.action)
                            const platformConfig = PLATFORM_OPTIONS.find(p => p.value === rule.platform)

                            return (
                                <div
                                    key={rule.id}
                                    className={`card p-5 transition-all ${!rule.is_active ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-bold text-lg text-[var(--foreground)]">
                                                    {rule.name}
                                                </h3>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rule.is_active
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)]'
                                                    }`}>
                                                    {rule.is_active ? 'Active' : 'Paused'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--foreground-muted)]">
                                                <span className="flex items-center gap-1">
                                                    {platformConfig?.icon} {platformConfig?.label}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    {rule.type === 'keyword' && <Search className="w-3 h-3" />}
                                                    {rule.type === 'account' && <AtSign className="w-3 h-3" />}
                                                    {rule.type === 'hashtag' && <Hash className="w-3 h-3" />}
                                                    {rule.target}
                                                </span>
                                                <span>•</span>
                                                <span className={`flex items-center gap-1 ${actionConfig?.color}`}>
                                                    {actionConfig?.icon}
                                                    {actionConfig?.label}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 mt-3 text-sm">
                                                <span className="flex items-center gap-1 text-[var(--foreground-muted)]">
                                                    <Clock className="w-3 h-3" />
                                                    {rule.actions_today || 0}/{rule.daily_limit} today
                                                </span>
                                                <div className="flex-1 h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[var(--primary)] rounded-full transition-all"
                                                        style={{
                                                            width: `${Math.min(100, ((rule.actions_today || 0) / rule.daily_limit) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleRule(rule)}
                                                disabled={togglingRule === rule.id}
                                                className={`p-2 rounded-lg transition-all ${rule.is_active
                                                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                        : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                                    }`}
                                                title={rule.is_active ? 'Pause rule' : 'Activate rule'}
                                            >
                                                {togglingRule === rule.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : rule.is_active ? (
                                                    <Pause className="w-5 h-5" />
                                                ) : (
                                                    <Play className="w-5 h-5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-2 rounded-lg bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                title="Delete rule"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
