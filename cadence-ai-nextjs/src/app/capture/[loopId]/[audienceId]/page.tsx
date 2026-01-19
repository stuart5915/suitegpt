'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Mail, CheckCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { Audience } from '@/lib/supabase/types'

interface EmailCapture {
    email: string
    loopId: string
    audienceId: string
    audienceName: string
    capturedAt: string
}

export default function CapturePage() {
    const params = useParams()
    const loopId = params.loopId as string
    const audienceId = params.audienceId as string

    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [audience, setAudience] = useState<Audience | null>(null)
    const [loopName, setLoopName] = useState('')

    // Load audience data from localStorage
    useEffect(() => {
        // Find the loop and audience from localStorage
        // We check all project loops to find the matching one
        const keys = Object.keys(localStorage).filter(k => k.startsWith('loops-'))

        for (const key of keys) {
            try {
                const loops = JSON.parse(localStorage.getItem(key) || '[]')
                const loop = loops.find((l: { id: string }) => l.id === loopId)
                if (loop) {
                    setLoopName(loop.name)
                    const foundAudience = loop.audiences?.find((a: Audience) => a.id === audienceId)
                    if (foundAudience) {
                        setAudience(foundAudience)
                        break
                    }
                }
            } catch (e) {
                console.error('Error parsing loops:', e)
            }
        }
    }, [loopId, audienceId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!email.trim()) {
            setError('Please enter your email address')
            return
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address')
            return
        }

        setSubmitting(true)

        try {
            // Store in localStorage
            const storageKey = 'email_captures'
            const existingCaptures: EmailCapture[] = JSON.parse(localStorage.getItem(storageKey) || '[]')

            // Check for duplicate
            const isDuplicate = existingCaptures.some(
                c => c.email.toLowerCase() === email.toLowerCase() && c.loopId === loopId && c.audienceId === audienceId
            )

            if (!isDuplicate) {
                const newCapture: EmailCapture = {
                    email: email.trim(),
                    loopId,
                    audienceId,
                    audienceName: audience?.name || 'Unknown',
                    capturedAt: new Date().toISOString()
                }
                existingCaptures.push(newCapture)
                localStorage.setItem(storageKey, JSON.stringify(existingCaptures))
            }

            setSubmitted(true)
        } catch (err) {
            console.error('Error saving email:', err)
            setError('Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // Loading state while we fetch audience data
    if (!audience) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#121218] to-[#0a0a0f] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#121218] to-[#0a0a0f] flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-4">
                        <span className="text-3xl">{audience.emoji}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {loopName || 'SUITE'}
                    </h1>
                    <p className="text-gray-400">
                        {audience.name} Early Access
                    </p>
                </div>

                {submitted ? (
                    // Success State
                    <div className="bg-[#1a1a24] rounded-2xl p-8 border border-green-500/30 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">
                            You&apos;re on the list!
                        </h2>
                        <p className="text-gray-400">
                            We&apos;ll notify you when new apps graduate and become available for {audience.name.toLowerCase()}.
                        </p>
                    </div>
                ) : (
                    // Form State
                    <div className="bg-[#1a1a24] rounded-2xl p-8 border border-[#2a2a34]">
                        {/* Value Prop */}
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-white mb-3">
                                {audience.cta}
                            </h2>
                            <p className="text-gray-400 text-sm mb-4">
                                {Array.isArray(audience.messagingAngles)
                                    ? audience.messagingAngles[0]
                                    : (audience as unknown as { messagingAngle?: string }).messagingAngle}
                            </p>

                            {/* Benefits */}
                            <div className="space-y-2">
                                {audience.desires.slice(0, 3).map((desire, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                        <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-300">{desire}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full pl-12 pr-4 py-3 bg-[#0a0a0f] border border-[#2a2a34] rounded-xl text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
                                        disabled={submitting}
                                    />
                                </div>
                                {error && (
                                    <p className="text-red-400 text-sm mt-2">{error}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        Get Early Access
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="text-gray-500 text-xs text-center mt-4">
                            No spam. Unsubscribe anytime.
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-6">
                    <p className="text-gray-500 text-sm">
                        Powered by <span className="text-purple-400">SUITE</span>
                    </p>
                </div>
            </div>
        </div>
    )
}
