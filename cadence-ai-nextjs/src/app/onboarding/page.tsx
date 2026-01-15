'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Check,
    Zap,
    Calendar,
    MessageSquare,
    Target,
    FolderKanban,
    Rocket
} from 'lucide-react'
import { Platform, PLATFORM_CONFIG } from '@/lib/supabase/types'
import { PlatformIcon, PLATFORM_NAMES } from '@/components/ui/PlatformIcon'

const STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'how-it-works', title: 'How It Works' },
    { id: 'first-project', title: 'First Project' },
    { id: 'platforms', title: 'Platforms' },
    { id: 'ready', title: 'Ready!' },
]

const ALL_PLATFORMS: Platform[] = ['x', 'instagram', 'linkedin', 'tiktok', 'youtube']

export default function OnboardingPage() {
    const router = useRouter()
    const [currentStep, setCurrentStep] = useState(0)
    const [projectData, setProjectData] = useState({
        name: '',
        description: '',
        platforms: [] as Platform[]
    })

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1)
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleComplete = () => {
        // In production, would save the project to Supabase
        router.push('/dashboard')
    }

    const togglePlatform = (platform: Platform) => {
        setProjectData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }))
    }

    const canProceed = () => {
        switch (STEPS[currentStep].id) {
            case 'first-project':
                return projectData.name.trim().length > 0
            case 'platforms':
                return projectData.platforms.length > 0
            default:
                return true
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Progress Bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-[var(--surface)]">
                <div
                    className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                />
            </div>

            {/* Header */}
            <header className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-[var(--foreground)]">Cadence AI</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                    Step {currentStep + 1} of {STEPS.length}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl">
                    {/* Step 1: Welcome */}
                    {STEPS[currentStep].id === 'welcome' && (
                        <div className="text-center animate-fadeIn">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">
                                Welcome to <span className="gradient-text">Cadence AI</span>
                            </h1>
                            <p className="text-lg text-[var(--foreground-muted)] max-w-md mx-auto mb-8">
                                Your AI-powered marketing co-pilot. Let's get you set up in just a few steps.
                            </p>
                            <div className="flex items-center justify-center gap-8 text-sm text-[var(--foreground-muted)]">
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-[var(--success)]" />
                                    AI Content Generation
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-[var(--success)]" />
                                    Multi-Platform Support
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-[var(--success)]" />
                                    Smart Scheduling
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: How It Works */}
                    {STEPS[currentStep].id === 'how-it-works' && (
                        <div className="animate-fadeIn">
                            <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 text-center">
                                How Cadence AI Works
                            </h1>
                            <p className="text-[var(--foreground-muted)] text-center mb-10">
                                A simple rhythm to keep your marketing running smoothly
                            </p>

                            <div className="space-y-6">
                                <StepCard
                                    number={1}
                                    icon={<Calendar className="w-6 h-6" />}
                                    title="Every Sunday, AI Proposes"
                                    description="Cadence generates a complete week of content tailored to your brand voice and platforms."
                                    color="primary"
                                />
                                <StepCard
                                    number={2}
                                    icon={<MessageSquare className="w-6 h-6" />}
                                    title="You Review & Refine"
                                    description="Chat with AI to adjust any content. Say what you like, what needs work, and AI adapts."
                                    color="secondary"
                                />
                                <StepCard
                                    number={3}
                                    icon={<Zap className="w-6 h-6" />}
                                    title="Approve & Post"
                                    description="Once approved, post with one click. Copy captions, download media, and track what's live."
                                    color="success"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: First Project */}
                    {STEPS[currentStep].id === 'first-project' && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
                                    <FolderKanban className="w-8 h-8 text-[var(--primary)]" />
                                </div>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                                    Create Your First Project
                                </h1>
                                <p className="text-[var(--foreground-muted)]">
                                    A project represents a brand, product, or company you're marketing
                                </p>
                            </div>

                            <div className="space-y-4 max-w-md mx-auto">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                        Project Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={projectData.name}
                                        onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., My Awesome App"
                                        className="input"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                        Brief Description
                                    </label>
                                    <textarea
                                        value={projectData.description}
                                        onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="What is this project about? (optional)"
                                        rows={3}
                                        className="input resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Platforms */}
                    {STEPS[currentStep].id === 'platforms' && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-xl bg-[var(--secondary)]/10 flex items-center justify-center mx-auto mb-4">
                                    <Target className="w-8 h-8 text-[var(--secondary)]" />
                                </div>
                                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                                    Where Do You Post?
                                </h1>
                                <p className="text-[var(--foreground-muted)]">
                                    Select the platforms you want to create content for
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-xl mx-auto">
                                {ALL_PLATFORMS.map((platform) => {
                                    const isSelected = projectData.platforms.includes(platform)

                                    return (
                                        <button
                                            key={platform}
                                            onClick={() => togglePlatform(platform)}
                                            className={`
                        p-6 rounded-xl border-2 transition-all cursor-pointer
                        ${isSelected
                                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 scale-105'
                                                    : 'border-[var(--surface-border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)]'
                                                }
                      `}
                                        >
                                            <div className="flex justify-center mb-2">
                                                <PlatformIcon platform={platform} size={32} />
                                            </div>
                                            <p className={`text-sm font-medium ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                                                {PLATFORM_NAMES[platform] || platform}
                                            </p>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-[var(--primary)] mx-auto mt-2" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <p className="text-center text-sm text-[var(--foreground-muted)] mt-6">
                                You can add more platforms later in project settings
                            </p>
                        </div>
                    )}

                    {/* Step 5: Ready */}
                    {STEPS[currentStep].id === 'ready' && (
                        <div className="text-center animate-fadeIn">
                            <div className="w-20 h-20 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto mb-6">
                                <Rocket className="w-10 h-10 text-[var(--success)]" />
                            </div>
                            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">
                                You're All Set! 🎉
                            </h1>
                            <p className="text-lg text-[var(--foreground-muted)] max-w-md mx-auto mb-8">
                                Your project <span className="text-[var(--foreground)] font-medium">"{projectData.name}"</span> is ready.
                                Head to your dashboard to generate your first week of content!
                            </p>

                            <div className="p-6 rounded-xl bg-[var(--surface)] max-w-md mx-auto mb-8">
                                <h3 className="font-semibold text-[var(--foreground)] mb-3">What's Next?</h3>
                                <ul className="space-y-2 text-left">
                                    <li className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                                        Click "Generate Week" to create your first content batch
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                                        Review and refine with AI assistance
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                                        Approve and start posting!
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer Navigation */}
            <footer className="p-6 flex items-center justify-between">
                <div>
                    {currentStep > 0 && (
                        <button
                            onClick={handleBack}
                            className="btn btn-ghost"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}
                </div>

                <div>
                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="btn btn-primary"
                        >
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            className="btn btn-primary"
                        >
                            Go to Dashboard
                            <Rocket className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </footer>
        </div>
    )
}

function StepCard({
    number,
    icon,
    title,
    description,
    color
}: {
    number: number
    icon: React.ReactNode
    title: string
    description: string
    color: 'primary' | 'secondary' | 'success'
}) {
    const colorClasses = {
        primary: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30',
        secondary: 'bg-[var(--secondary)]/10 text-[var(--secondary)] border-[var(--secondary)]/30',
        success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
    }

    return (
        <div className={`flex items-start gap-4 p-5 rounded-xl border ${colorClasses[color]}`}>
            <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center text-sm font-bold">
                    {number}
                </div>
                {icon}
            </div>
            <div>
                <h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
                <p className="text-sm text-[var(--foreground-muted)]">{description}</p>
            </div>
        </div>
    )
}
