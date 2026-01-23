'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { getEngagementRules, createEngagementRule, toggleEngagementRule, deleteEngagementRule } from '@/lib/extensions/api'
import { EngagementRule } from '@/lib/extensions/types'
import { PanelContentProps } from '../ExtensionPanelManager'
import {
    Loader2,
    MessageCircle,
    Plus,
    Trash2,
    Heart,
    Reply,
    Repeat2,
    UserPlus,
    Hash,
    AtSign,
    Search,
    Play,
    Pause,
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
    { value: 'keyword', label: 'Keyword', icon: <Search className="w-4 h-4" /> },
    { value: 'account', label: 'Account', icon: <AtSign className="w-4 h-4" /> },
    { value: 'hashtag', label: 'Hashtag', icon: <Hash className="w-4 h-4" /> }
]

const ACTION_OPTIONS = [
    { value: 'like', label: 'Like', icon: <Heart className="w-4 h-4" />, color: 'text-pink-500' },
    { value: 'reply', label: 'Reply', icon: <Reply className="w-4 h-4" />, color: 'text-blue-500' },
    { value: 'retweet', label: 'RT', icon: <Repeat2 className="w-4 h-4" />, color: 'text-green-500' },
    { value: 'follow', label: 'Follow', icon: <UserPlus className="w-4 h-4" />, color: 'text-purple-500' }
]

export default function SocialEngagerPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [rules, setRules] = useState<EngagementRule[]>([])
    const [showNewRule, setShowNewRule] = useState(false)
    const [saving, setSaving] = useState(false)
    const [togglingRule, setTogglingRule] = useState<string | null>(null)

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
        if (!authLoading) loadData()
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
            setNewRule({ name: '', platform: 'x', type: 'keyword', target: '', action: 'like', reply_template: '', daily_limit: 50 })
            setShowNewRule(false)
        }
        setSaving(false)
    }

    const handleToggleRule = async (rule: EngagementRule) => {
        setTogglingRule(rule.id)
        const success = await toggleEngagementRule(rule.id, !rule.is_active)
        if (success) {
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
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
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Target className="w-3 h-3" />
                        <span className="text-xs">Rules</span>
                    </div>
                    <p className="text-xl font-bold">{rules.length}</p>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Play className="w-3 h-3" />
                        <span className="text-xs">Active</span>
                    </div>
                    <p className="text-xl font-bold text-green-500">{activeRules}</p>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Activity className="w-3 h-3" />
                        <span className="text-xs">Today</span>
                    </div>
                    <p className="text-xl font-bold text-[var(--primary)]">{todayActions}</p>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-3">
                    <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-1">
                        <Zap className="w-3 h-3" />
                        <span className="text-xs">Credits/Day</span>
                    </div>
                    <p className="text-xl font-bold text-amber-500">100</p>
                </div>
            </div>

            {/* Create Rule */}
            {!showNewRule ? (
                <button
                    onClick={() => setShowNewRule(true)}
                    className="w-full btn btn-primary flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create Rule
                </button>
            ) : (
                <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
                    <input
                        type="text"
                        value={newRule.name}
                        onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Rule name"
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm"
                    />

                    <select
                        value={newRule.platform}
                        onChange={(e) => setNewRule(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm"
                    >
                        {PLATFORM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                        ))}
                    </select>

                    <div className="grid grid-cols-3 gap-2">
                        {TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setNewRule(prev => ({ ...prev, type: opt.value }))}
                                className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 ${newRule.type === opt.value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--surface-border)]'}`}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <input
                        type="text"
                        value={newRule.target}
                        onChange={(e) => setNewRule(prev => ({ ...prev, target: e.target.value }))}
                        placeholder={newRule.type === 'keyword' ? 'Keyword' : newRule.type === 'account' ? '@username' : '#hashtag'}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm"
                    />

                    <div className="grid grid-cols-4 gap-1">
                        {ACTION_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setNewRule(prev => ({ ...prev, action: opt.value }))}
                                className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 ${newRule.action === opt.value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--surface-border)]'}`}
                            >
                                <span className={opt.color}>{opt.icon}</span>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {newRule.action === 'reply' && (
                        <textarea
                            value={newRule.reply_template}
                            onChange={(e) => setNewRule(prev => ({ ...prev, reply_template: e.target.value }))}
                            placeholder="Reply template..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm resize-none"
                        />
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateRule}
                            disabled={saving || !newRule.name || !newRule.target}
                            className="flex-1 btn btn-primary text-sm py-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                        </button>
                        <button
                            onClick={() => setShowNewRule(false)}
                            className="px-4 py-2 bg-[var(--background)] rounded-lg text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="space-y-2">
                {rules.length === 0 ? (
                    <div className="text-center py-8 text-[var(--foreground-muted)]">
                        <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No rules yet</p>
                    </div>
                ) : (
                    rules.map(rule => {
                        const actionConfig = ACTION_OPTIONS.find(a => a.value === rule.action)
                        const platformConfig = PLATFORM_OPTIONS.find(p => p.value === rule.platform)

                        return (
                            <div
                                key={rule.id}
                                className={`bg-[var(--surface)] rounded-lg p-3 ${!rule.is_active ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">{rule.name}</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleToggleRule(rule)}
                                            disabled={togglingRule === rule.id}
                                            className={`p-1.5 rounded ${rule.is_active ? 'bg-green-500/10 text-green-500' : 'bg-[var(--background)]'}`}
                                        >
                                            {togglingRule === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                    <span>{platformConfig?.icon}</span>
                                    <span>{rule.target}</span>
                                    <span className={actionConfig?.color}>{actionConfig?.icon}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1 h-1 bg-[var(--background)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--primary)] rounded-full"
                                            style={{ width: `${Math.min(100, ((rule.actions_today || 0) / rule.daily_limit) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-[var(--foreground-muted)]">
                                        {rule.actions_today || 0}/{rule.daily_limit}
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
