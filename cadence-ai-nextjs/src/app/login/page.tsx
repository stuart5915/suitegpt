'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import TelegramLoginButton from '@/components/auth/TelegramLoginButton'
import {
    Sparkles,
    Zap,
    Calendar,
    MessageSquare,
    Loader2,
    Code
} from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const { isAuthenticated, isLoading, login } = useTelegramAuth()

    // Dev mode state
    const [showDevLogin, setShowDevLogin] = useState(false)
    const [devTelegramId, setDevTelegramId] = useState('')
    const [devUsername, setDevUsername] = useState('')
    const [devLoading, setDevLoading] = useState(false)

    const isDev = process.env.NODE_ENV === 'development'

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            router.push('/dashboard')
        }
    }, [isAuthenticated, isLoading, router])

    // Dev login handler
    const handleDevLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!devTelegramId.trim()) return

        setDevLoading(true)
        try {
            await login({
                id: devTelegramId.trim(),
                first_name: devUsername.trim() || 'Dev User',
                username: devUsername.trim() || undefined,
                auth_date: Math.floor(Date.now() / 1000),
                hash: '' // Empty hash for dev mode
            })
        } catch (err) {
            console.error('Dev login error:', err)
        } finally {
            setDevLoading(false)
        }
    }

    // Show loading while checking auth state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                    <p className="text-[var(--foreground-muted)]">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a0a0f] via-[#1e1e2e] to-[#0a0a0f] flex-col justify-between p-12 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-[var(--primary)] rounded-full blur-[100px]" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-[var(--secondary)] rounded-full blur-[120px]" />
                </div>

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">Cadence AI</span>
                </div>

                {/* Features */}
                <div className="relative z-10 space-y-8">
                    <h1 className="text-4xl font-bold text-white leading-tight">
                        Your AI Marketing
                        <br />
                        <span className="gradient-text">Co-Pilot</span>
                    </h1>

                    <div className="space-y-6">
                        <FeatureItem
                            icon={<Zap className="w-5 h-5" />}
                            title="AI-Powered Content"
                            description="Generate a week's worth of content in seconds"
                        />
                        <FeatureItem
                            icon={<Calendar className="w-5 h-5" />}
                            title="Smart Scheduling"
                            description="Optimal posting times across all platforms"
                        />
                        <FeatureItem
                            icon={<MessageSquare className="w-5 h-5" />}
                            title="Conversational Refinement"
                            description="Iterate on content through natural dialogue"
                        />
                    </div>
                </div>

                {/* Testimonial */}
                <div className="relative z-10 p-6 rounded-2xl glass">
                    <p className="text-white/80 italic mb-4">
                        "Cadence AI cut my content creation time by 80%. I now manage 5 brands without breaking a sweat."
                    </p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]" />
                        <div>
                            <p className="text-white font-medium">Marketing Manager</p>
                            <p className="text-white/60 text-sm">Tech Startup</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[var(--background)]">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-[var(--foreground)]">Cadence AI</span>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                            Welcome to Cadence AI
                        </h2>
                        <p className="text-[var(--foreground-muted)]">
                            Sign in with Telegram to get started
                        </p>
                    </div>

                    {/* Telegram Login Button */}
                    <div className="flex flex-col items-center gap-6">
                        <TelegramLoginButton
                            buttonSize="large"
                            cornerRadius={12}
                            showUserPhoto={true}
                        />

                        <p className="text-sm text-[var(--foreground-muted)] text-center max-w-xs">
                            By signing in, you agree to our Terms of Service and Privacy Policy
                        </p>
                    </div>

                    {/* Dev Mode Login */}
                    {isDev && (
                        <div className="mt-8 pt-8 border-t border-[var(--surface-border)]">
                            <button
                                onClick={() => setShowDevLogin(!showDevLogin)}
                                className="w-full flex items-center justify-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                            >
                                <Code className="w-4 h-4" />
                                {showDevLogin ? 'Hide' : 'Show'} Dev Login
                            </button>

                            {showDevLogin && (
                                <form onSubmit={handleDevLogin} className="mt-4 space-y-4">
                                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                        <p className="text-xs text-yellow-500">
                                            Dev mode only - bypasses Telegram verification
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                            Telegram ID *
                                        </label>
                                        <input
                                            type="text"
                                            value={devTelegramId}
                                            onChange={(e) => setDevTelegramId(e.target.value)}
                                            placeholder="e.g., 123456789"
                                            className="input"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                            Username (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={devUsername}
                                            onChange={(e) => setDevUsername(e.target.value)}
                                            placeholder="e.g., johndoe"
                                            className="input"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={devLoading || !devTelegramId.trim()}
                                        className="w-full btn btn-primary"
                                    >
                                        {devLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Dev Login'
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="mt-8 p-4 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)]">
                        <h3 className="font-medium text-[var(--foreground)] mb-2">Why Telegram?</h3>
                        <ul className="text-sm text-[var(--foreground-muted)] space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--success)]">✓</span>
                                <span>Quick and secure authentication</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--success)]">✓</span>
                                <span>No password to remember</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--success)]">✓</span>
                                <span>Works seamlessly in Telegram Mini Apps</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-white/10 text-white">
                {icon}
            </div>
            <div>
                <h3 className="text-white font-medium">{title}</h3>
                <p className="text-white/60 text-sm">{description}</p>
            </div>
        </div>
    )
}
