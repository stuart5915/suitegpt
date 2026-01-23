'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { spendCredits, logUsage } from '@/lib/extensions/api'
import {
    Loader2,
    ChevronLeft,
    Wand2,
    Image as ImageIcon,
    Download,
    Copy,
    Sparkles,
    Zap,
    Clock,
    Grid,
    LayoutTemplate,
    Palette,
    Square,
    RectangleHorizontal,
    RectangleVertical,
    RefreshCw
} from 'lucide-react'

interface GeneratedImage {
    id: string
    prompt: string
    image_url: string
    style: string
    created_at: string
}

const STYLE_OPTIONS = [
    { value: 'minimal', label: 'Minimal', desc: 'Clean, simple designs' },
    { value: 'bold', label: 'Bold', desc: 'High contrast, impactful' },
    { value: 'professional', label: 'Professional', desc: 'Corporate, polished' },
    { value: 'playful', label: 'Playful', desc: 'Fun, colorful, energetic' },
    { value: 'luxury', label: 'Luxury', desc: 'Premium, elegant' },
    { value: 'tech', label: 'Tech', desc: 'Modern, futuristic' }
]

const ASPECT_RATIOS = [
    { value: '1:1', label: 'Square', icon: <Square className="w-4 h-4" />, desc: 'Instagram, Twitter' },
    { value: '16:9', label: 'Landscape', icon: <RectangleHorizontal className="w-4 h-4" />, desc: 'YouTube, LinkedIn' },
    { value: '9:16', label: 'Portrait', icon: <RectangleVertical className="w-4 h-4" />, desc: 'Stories, TikTok' },
    { value: '4:5', label: 'Portrait', icon: <RectangleVertical className="w-4 h-4" />, desc: 'Instagram Feed' }
]

export default function ImageGeneratorPage() {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [prompt, setPrompt] = useState('')
    const [style, setStyle] = useState('minimal')
    const [aspectRatio, setAspectRatio] = useState('1:1')
    const [recentImages, setRecentImages] = useState<GeneratedImage[]>([])
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)

    useEffect(() => {
        async function loadData() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            // Load recent generated images
            const { data, error } = await supabase
                .from('generated_images')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(12)

            if (!error && data) {
                setRecentImages(data)
            }

            setLoading(false)
        }

        if (!authLoading) {
            loadData()
        }
    }, [supabase, user, authLoading])

    const handleGenerate = async () => {
        if (!user?.id || !prompt.trim() || generating) return

        setGenerating(true)
        setGeneratedImage(null)

        try {
            // Call the image generation API
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    style: style,
                    aspectRatio: aspectRatio,
                    userId: user.id
                })
            })

            const result = await response.json()

            if (result.imageUrl) {
                setGeneratedImage(result.imageUrl)

                // Save to database
                const { data: savedImage } = await supabase
                    .from('generated_images')
                    .insert({
                        user_id: user.id,
                        prompt: prompt,
                        style: style,
                        image_url: result.imageUrl,
                        credits_used: 50
                    })
                    .select()
                    .single()

                if (savedImage) {
                    setRecentImages(prev => [savedImage, ...prev.slice(0, 11)])
                }

                // Log usage
                await logUsage(user.id, 'image-generator', 'generate', 50, {
                    prompt,
                    style,
                    aspectRatio
                })
            }
        } catch (error) {
            console.error('Error generating image:', error)
        }

        setGenerating(false)
    }

    const handleDownload = async (imageUrl: string) => {
        try {
            const response = await fetch(imageUrl)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `suite-image-${Date.now()}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error downloading image:', error)
        }
    }

    const handleCopyUrl = async (imageUrl: string) => {
        try {
            await navigator.clipboard.writeText(imageUrl)
        } catch (error) {
            console.error('Error copying URL:', error)
        }
    }

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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-3xl shadow-lg">
                        🎨
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--foreground)]">
                            AI Image Generator
                        </h1>
                        <p className="text-[var(--foreground-muted)]">
                            Create stunning social media graphics with AI
                        </p>
                    </div>
                </div>

                {/* Cost Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-sm">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-500 font-medium">50 credits per image</span>
                </div>
            </header>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Generator Panel */}
                <div className="space-y-6">
                    {/* Prompt Input */}
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Describe your image
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A minimalist social media graphic about productivity tips, featuring a clean desk setup with soft lighting..."
                            rows={4}
                            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none resize-none"
                        />
                        <p className="text-xs text-[var(--foreground-muted)] mt-2">
                            Be specific about colors, mood, composition, and style for better results
                        </p>
                    </div>

                    {/* Style Selection */}
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
                            <Palette className="w-4 h-4 inline mr-2" />
                            Style
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {STYLE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setStyle(opt.value)}
                                    className={`p-3 rounded-lg border transition-all text-left ${style === opt.value
                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                            : 'border-[var(--surface-border)] hover:border-[var(--primary)]/50'
                                        }`}
                                >
                                    <span className="font-medium text-[var(--foreground)] block">{opt.label}</span>
                                    <span className="text-xs text-[var(--foreground-muted)]">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
                            <LayoutTemplate className="w-4 h-4 inline mr-2" />
                            Aspect Ratio
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {ASPECT_RATIOS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAspectRatio(opt.value)}
                                    className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${aspectRatio === opt.value
                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                            : 'border-[var(--surface-border)] hover:border-[var(--primary)]/50'
                                        }`}
                                >
                                    {opt.icon}
                                    <span className="text-xs font-medium">{opt.value}</span>
                                    <span className="text-xs text-[var(--foreground-muted)]">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-3"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5" />
                                Generate Image
                                <span className="text-sm opacity-75">(50 credits)</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    {/* Generated Image */}
                    <div className="card p-6">
                        <h3 className="font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                            Generated Image
                        </h3>

                        {generating ? (
                            <div className="aspect-square bg-[var(--surface)] rounded-lg flex flex-col items-center justify-center">
                                <div className="relative">
                                    <Loader2 className="w-12 h-12 animate-spin text-[var(--primary)]" />
                                    <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                                </div>
                                <p className="text-[var(--foreground-muted)] mt-4">Creating your image...</p>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">This usually takes 10-30 seconds</p>
                            </div>
                        ) : generatedImage ? (
                            <div className="space-y-4">
                                <div className="relative rounded-lg overflow-hidden bg-[var(--surface)]">
                                    <img
                                        src={generatedImage}
                                        alt="Generated image"
                                        className="w-full h-auto"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDownload(generatedImage)}
                                        className="flex-1 btn bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => handleCopyUrl(generatedImage)}
                                        className="flex-1 btn bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy URL
                                    </button>
                                    <button
                                        onClick={handleGenerate}
                                        className="btn bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-square bg-[var(--surface)] rounded-lg flex flex-col items-center justify-center">
                                <ImageIcon className="w-12 h-12 text-[var(--foreground-muted)]" />
                                <p className="text-[var(--foreground-muted)] mt-4">Your generated image will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* Recent Images */}
                    {recentImages.length > 0 && (
                        <div className="card p-6">
                            <h3 className="font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Recent Images
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {recentImages.slice(0, 6).map((img) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setGeneratedImage(img.image_url)}
                                        className="aspect-square rounded-lg overflow-hidden bg-[var(--surface)] hover:ring-2 hover:ring-[var(--primary)] transition-all"
                                    >
                                        <img
                                            src={img.image_url}
                                            alt={img.prompt}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                            {recentImages.length > 6 && (
                                <button className="w-full mt-3 text-sm text-[var(--primary)] hover:underline flex items-center justify-center gap-1">
                                    <Grid className="w-4 h-4" />
                                    View all {recentImages.length} images
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
