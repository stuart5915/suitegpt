'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    Sparkles,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Zap,
    Calendar,
    MessageSquare,
    AlertCircle
} from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()

    const [isLogin, setIsLogin] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isLogin) {
                // Sign In
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                })

                if (error) throw error

                // Successfully signed in
                router.push('/dashboard')
                router.refresh()
            } else {
                // Sign Up
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.name,
                        }
                    }
                })

                if (error) throw error

                // Check if email confirmation is required
                if (data.user && !data.session) {
                    setError('Check your email for a confirmation link!')
                    setLoading(false)
                    return
                }

                // Successfully signed up and auto-confirmed (for local dev)
                router.push('/onboarding')
                router.refresh()
            }
        } catch (err: any) {
            console.error('Auth error:', err)
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            })

            if (error) throw error
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google')
            setLoading(false)
        }
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
                            {isLogin ? 'Welcome back' : 'Create your account'}
                        </h2>
                        <p className="text-[var(--foreground-muted)]">
                            {isLogin
                                ? 'Sign in to continue to your dashboard'
                                : 'Start your AI-powered marketing journey'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${error.includes('Check your email')
                            ? 'bg-[var(--success)]/10 text-[var(--success)]'
                            : 'bg-[var(--error)]/10 text-[var(--error)]'
                            }`}>
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {/* Google Sign In - Disabled for now */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={true}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[var(--surface)] text-[var(--foreground-muted)] rounded-xl font-medium cursor-not-allowed mb-6 opacity-50"
                        title="Google OAuth coming soon"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google (Coming Soon)
                    </button>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--surface-border)]" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[var(--background)] text-[var(--foreground-muted)]">
                                {isLogin ? 'sign in with email' : 'sign up with email'}
                            </span>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name (Sign Up only) */}
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="John Doe"
                                    className="input"
                                    required={!isLogin}
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="you@example.com"
                                    className="input"
                                    style={{ paddingLeft: '44px' }}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="••••••••"
                                    className="input"
                                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {!isLogin && (
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Must be at least 6 characters
                                </p>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn btn-primary py-3"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <p className="mt-6 text-center text-[var(--foreground-muted)]">
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError(null)
                            }}
                            className="ml-2 text-[var(--primary)] font-medium hover:underline"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
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
