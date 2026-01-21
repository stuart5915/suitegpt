'use client'

import { Sparkles } from 'lucide-react'

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                {/* Logo */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--secondary)] to-[var(--primary)] flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold mb-2 gradient-text">SUITEHub</h1>
                <p className="text-[var(--foreground-muted)] mb-8">
                    Your Personal AI Dashboard
                </p>

                {/* Login Info */}
                <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl p-6 mb-6">
                    <p className="text-sm text-[var(--foreground-muted)] mb-4">
                        Access SUITEHub through the SUITE ecosystem
                    </p>

                    {/* Telegram Mini App notice */}
                    <div className="bg-[var(--background)] rounded-lg p-4">
                        <p className="text-sm">
                            Open this app from <strong className="text-[var(--primary)]">getsuite.app</strong> to sign in with your Telegram account.
                        </p>
                    </div>
                </div>

                {/* Direct link */}
                <a
                    href="https://getsuite.app"
                    className="btn btn-primary"
                >
                    Go to SUITE
                </a>
            </div>
        </div>
    )
}
