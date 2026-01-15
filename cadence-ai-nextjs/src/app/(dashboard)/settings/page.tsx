'use client'

import Link from 'next/link'
import { Settings, User, Bell, Palette, Key, HelpCircle } from 'lucide-react'

export default function SettingsPage() {
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
