'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Settings, User, Bell, Palette, Key, HelpCircle, MessageSquare, Loader2, Check, Twitter } from 'lucide-react'

interface BrandSettings {
    brandVoice: string
    tone: string
    speakingPerspective: string
    emojiStyle: string
    exclusionWords: string
    defaultHashtags: string
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
    brandVoice: '',
    tone: 'casual',
    speakingPerspective: 'I',
    emojiStyle: 'moderate',
    exclusionWords: '',
    defaultHashtags: '#buildinpublic #ai'
}

export default function SettingsPage() {
    const [brandSettings, setBrandSettings] = useState<BrandSettings>(DEFAULT_BRAND_SETTINGS)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [twitterStatus, setTwitterStatus] = useState<{ connected: boolean; user?: any; loading: boolean }>({
        connected: false,
        loading: true
    })

    // Load brand settings from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('cadence_brand_settings')
        if (stored) {
            try {
                setBrandSettings(JSON.parse(stored))
            } catch (e) {
                console.error('Failed to parse brand settings:', e)
            }
        }
        checkTwitterStatus()
    }, [])

    // Check Twitter connection status
    const checkTwitterStatus = async () => {
        try {
            const response = await fetch('/api/twitter/status')
            const data = await response.json()
            setTwitterStatus({ connected: data.connected, user: data.user, loading: false })
        } catch (e) {
            setTwitterStatus({ connected: false, loading: false })
        }
    }

    // Save brand settings
    const saveBrandSettings = () => {
        setSaving(true)
        localStorage.setItem('cadence_brand_settings', JSON.stringify(brandSettings))
        setTimeout(() => {
            setSaving(false)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        }, 500)
    }

    // Update a single field
    const updateField = (field: keyof BrandSettings, value: string) => {
        setBrandSettings(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="min-h-screen p-8 max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Settings</h1>
                <p className="text-[var(--foreground-muted)] mt-1">
                    Manage your account and preferences
                </p>
            </header>

            {/* Settings Sections */}
            <div className="space-y-6">
                {/* Profile */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-[var(--primary)]/10">
                            <User className="w-5 h-5 text-[var(--primary)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Profile</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Manage your account information</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg">
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Email</p>
                                <p className="text-sm text-[var(--foreground-muted)]">user@example.com</p>
                            </div>
                            <button className="btn btn-ghost text-sm">Change</button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg">
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Password</p>
                                <p className="text-sm text-[var(--foreground-muted)]">Last changed 30 days ago</p>
                            </div>
                            <button className="btn btn-ghost text-sm">Update</button>
                        </div>
                    </div>
                </section>

                {/* Brand Voice - NEW SECTION */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <MessageSquare className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Brand Voice</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Configure how AI generates your content</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Brand Voice Description */}
                        <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                            <label className="block font-medium text-[var(--foreground)] mb-2">Brand Voice</label>
                            <textarea
                                value={brandSettings.brandVoice}
                                onChange={(e) => updateField('brandVoice', e.target.value)}
                                rows={3}
                                placeholder="Describe your brand personality... e.g., 'We're a solo dev building AI-powered micro apps. We're direct, slightly nerdy, and genuinely helpful.'"
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)] resize-none"
                            />
                        </div>

                        {/* Tone & Perspective Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                                <label className="block font-medium text-[var(--foreground)] mb-2">Tone</label>
                                <select
                                    value={brandSettings.tone}
                                    onChange={(e) => updateField('tone', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)]"
                                >
                                    <option value="casual">Casual</option>
                                    <option value="professional">Professional</option>
                                    <option value="witty">Witty</option>
                                    <option value="inspirational">Inspirational</option>
                                    <option value="educational">Educational</option>
                                </select>
                            </div>

                            <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                                <label className="block font-medium text-[var(--foreground)] mb-2">Speaking Perspective</label>
                                <select
                                    value={brandSettings.speakingPerspective}
                                    onChange={(e) => updateField('speakingPerspective', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)]"
                                >
                                    <option value="I">I (Solo founder)</option>
                                    <option value="We">We (Team)</option>
                                    <option value="You">You (Audience-focused)</option>
                                </select>
                            </div>
                        </div>

                        {/* Emoji Style */}
                        <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                            <label className="block font-medium text-[var(--foreground)] mb-2">Emoji Style</label>
                            <div className="flex gap-2">
                                {['heavy', 'moderate', 'minimal', 'none'].map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => updateField('emojiStyle', style)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                            brandSettings.emojiStyle === style
                                                ? 'bg-[var(--primary)] text-white'
                                                : 'bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                        }`}
                                    >
                                        {style === 'heavy' && '🚀 '}
                                        {style === 'moderate' && '✨ '}
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Exclusion Words */}
                        <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                            <label className="block font-medium text-[var(--foreground)] mb-2">
                                Exclusion Words
                                <span className="font-normal text-[var(--foreground-muted)] ml-2">Words the AI should never use</span>
                            </label>
                            <textarea
                                value={brandSettings.exclusionWords}
                                onChange={(e) => updateField('exclusionWords', e.target.value)}
                                rows={2}
                                placeholder="revolutionary, game-changing, cutting-edge, leverage, synergy, disrupt, unlock, empower, seamless..."
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)] resize-none"
                            />
                        </div>

                        {/* Default Hashtags */}
                        <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                            <label className="block font-medium text-[var(--foreground)] mb-2">Default Hashtags</label>
                            <input
                                type="text"
                                value={brandSettings.defaultHashtags}
                                onChange={(e) => updateField('defaultHashtags', e.target.value)}
                                placeholder="#buildinpublic #ai #indiehacker"
                                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--foreground)]"
                            />
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveBrandSettings}
                            disabled={saving}
                            className="btn btn-primary w-full"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Saved!
                                </>
                            ) : (
                                'Save Brand Settings'
                            )}
                        </button>
                    </div>
                </section>

                {/* Twitter Connection Status */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Twitter className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Twitter/X Connection</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Post directly to Twitter from Cadence</p>
                        </div>
                    </div>

                    <div className="p-4 bg-[var(--background-elevated)] rounded-lg">
                        {twitterStatus.loading ? (
                            <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Checking connection...
                            </div>
                        ) : twitterStatus.connected ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <Twitter className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-[var(--foreground)]">@{twitterStatus.user?.username}</p>
                                        <p className="text-sm text-green-500">Connected</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-green-500/20 text-green-500 rounded-full text-sm">Active</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Not connected</p>
                                    <p className="text-sm text-[var(--foreground-muted)]">Add Twitter API keys to .env.local to enable</p>
                                </div>
                                <span className="px-3 py-1 bg-[var(--surface-border)] text-[var(--foreground-muted)] rounded-full text-sm">Inactive</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Notifications */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]/10">
                            <Bell className="w-5 h-5 text-[var(--secondary)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Notifications</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Configure how you receive alerts</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg cursor-pointer">
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Weekly Summary</p>
                                <p className="text-sm text-[var(--foreground-muted)]">Get notified when weekly content is ready</p>
                            </div>
                            <input type="checkbox" defaultChecked className="w-5 h-5 accent-[var(--primary)]" />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg cursor-pointer">
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Post Reminders</p>
                                <p className="text-sm text-[var(--foreground-muted)]">Remind me when it's time to post</p>
                            </div>
                            <input type="checkbox" defaultChecked className="w-5 h-5 accent-[var(--primary)]" />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg cursor-pointer">
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Email Digest</p>
                                <p className="text-sm text-[var(--foreground-muted)]">Weekly email with performance summary</p>
                            </div>
                            <input type="checkbox" className="w-5 h-5 accent-[var(--primary)]" />
                        </label>
                    </div>
                </section>

                {/* API Keys */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-[var(--success)]/10">
                            <Key className="w-5 h-5 text-[var(--success)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">API Connections</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Connect your social media accounts</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {['Instagram', 'X (Twitter)', 'LinkedIn', 'TikTok', 'YouTube'].map((platform) => (
                            <div
                                key={platform}
                                className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[var(--surface-border)] flex items-center justify-center text-sm">
                                        {platform.charAt(0)}
                                    </div>
                                    <span className="font-medium text-[var(--foreground)]">{platform}</span>
                                </div>
                                <button className="btn btn-secondary text-sm">Connect</button>
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 text-xs text-[var(--foreground-muted)]">
                        Note: Platform connections are optional. You can use manual posting mode without connecting accounts.
                    </p>
                </section>

                {/* Appearance */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-[var(--warning)]/10">
                            <Palette className="w-5 h-5 text-[var(--warning)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Appearance</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Customize your experience</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg">
                        <div>
                            <p className="font-medium text-[var(--foreground)]">Theme</p>
                            <p className="text-sm text-[var(--foreground-muted)]">Choose your preferred theme</p>
                        </div>
                        <select className="input w-32 text-sm">
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="system">System</option>
                        </select>
                    </div>
                </section>

                {/* Help */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-[var(--info)]/10">
                            <HelpCircle className="w-5 h-5 text-[var(--info)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Help & Support</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Get help or send feedback</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="btn btn-secondary flex-1">Documentation</button>
                        <button className="btn btn-secondary flex-1">Contact Support</button>
                        <button className="btn btn-secondary flex-1">Send Feedback</button>
                    </div>
                </section>
            </div>
        </div>
    )
}
