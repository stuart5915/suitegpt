'use client'

import { useState, useEffect } from 'react'
import { User, Bell, Palette, Key, HelpCircle, Loader2, Twitter, Mail, Download, Trash2 } from 'lucide-react'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'

interface EmailCapture {
    email: string
    loopId: string
    audienceId: string
    audienceName: string
    capturedAt: string
}

export default function SettingsPage() {
    const { user } = useTelegramAuth()
    const [twitterStatus, setTwitterStatus] = useState<{ connected: boolean; user?: any; loading: boolean }>({
        connected: false,
        loading: true
    })
    const [emailCaptures, setEmailCaptures] = useState<EmailCapture[]>([])

    // Load email captures and check Twitter status
    useEffect(() => {
        // Load email captures from localStorage (will migrate later)
        const captures = localStorage.getItem('email_captures')
        if (captures) {
            try {
                setEmailCaptures(JSON.parse(captures))
            } catch (e) {
                console.error('Failed to parse email captures:', e)
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

    // Export email captures as CSV
    const exportCapturesCSV = () => {
        if (emailCaptures.length === 0) return

        const headers = ['Email', 'Audience', 'Captured At']
        const rows = emailCaptures.map(c => [
            c.email,
            c.audienceName,
            new Date(c.capturedAt).toLocaleString()
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `email-captures-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Delete a single capture
    const deleteCapture = (email: string) => {
        const updated = emailCaptures.filter(c => c.email !== email)
        setEmailCaptures(updated)
        localStorage.setItem('email_captures', JSON.stringify(updated))
    }

    // Clear all captures
    const clearAllCaptures = () => {
        if (!confirm('Are you sure you want to delete all email captures?')) return
        setEmailCaptures([])
        localStorage.removeItem('email_captures')
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

                {/* Email Captures */}
                <section className="card p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <Mail className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Email Captures</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Emails collected from audience capture pages</p>
                        </div>
                        {emailCaptures.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={exportCapturesCSV}
                                    className="btn btn-ghost text-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                                <button
                                    onClick={clearAllCaptures}
                                    className="btn btn-ghost text-sm text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>

                    {emailCaptures.length === 0 ? (
                        <div className="p-8 bg-[var(--background-elevated)] rounded-lg text-center">
                            <Mail className="w-10 h-10 text-[var(--foreground-muted)] mx-auto mb-3" />
                            <p className="text-[var(--foreground-muted)]">No email captures yet</p>
                            <p className="text-sm text-[var(--foreground-muted)] mt-1">
                                Create a loop with audiences and share capture links to collect emails
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="px-4 py-2 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">
                                {emailCaptures.length} email{emailCaptures.length !== 1 ? 's' : ''} captured
                            </div>
                            {emailCaptures.map((capture, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-4 bg-[var(--background-elevated)] rounded-lg group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Mail className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-[var(--foreground)]">{capture.email}</p>
                                            <p className="text-sm text-[var(--foreground-muted)]">
                                                {capture.audienceName} - {new Date(capture.capturedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteCapture(capture.email)}
                                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
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
