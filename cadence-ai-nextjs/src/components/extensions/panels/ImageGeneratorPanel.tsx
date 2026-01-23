'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTelegramAuth } from '@/contexts/TelegramAuthContext'
import { logUsage } from '@/lib/extensions/api'
import { PanelContentProps } from '../ExtensionPanelManager'
import {
    Loader2,
    Wand2,
    Image as ImageIcon,
    Download,
    Copy,
    Sparkles,
    Square,
    RectangleHorizontal,
    RectangleVertical,
    RefreshCw,
    Clock
} from 'lucide-react'

interface GeneratedImage {
    id: string
    prompt: string
    image_url: string
    style: string
    created_at: string
}

const STYLE_OPTIONS = [
    { value: 'minimal', label: 'Minimal' },
    { value: 'bold', label: 'Bold' },
    { value: 'professional', label: 'Pro' },
    { value: 'playful', label: 'Fun' },
    { value: 'luxury', label: 'Luxury' },
    { value: 'tech', label: 'Tech' }
]

const ASPECT_RATIOS = [
    { value: '1:1', label: 'Square', icon: <Square className="w-3 h-3" /> },
    { value: '16:9', label: 'Wide', icon: <RectangleHorizontal className="w-3 h-3" /> },
    { value: '9:16', label: 'Tall', icon: <RectangleVertical className="w-3 h-3" /> }
]

export default function ImageGeneratorPanel({ mode, initialData, onComplete }: PanelContentProps) {
    const supabase = createClient()
    const { user, isLoading: authLoading } = useTelegramAuth()

    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [prompt, setPrompt] = useState((initialData?.prompt as string) || '')
    const [style, setStyle] = useState('minimal')
    const [aspectRatio, setAspectRatio] = useState('1:1')
    const [recentImages, setRecentImages] = useState<GeneratedImage[]>([])
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)

    useEffect(() => {
        async function loadData() {
            if (!user?.id) { setLoading(false); return }

            const { data } = await supabase
                .from('generated_images')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(6)

            if (data) setRecentImages(data)
            setLoading(false)
        }
        if (!authLoading) loadData()
    }, [supabase, user, authLoading])

    const handleGenerate = async () => {
        if (!user?.id || !prompt.trim() || generating) return

        setGenerating(true)
        setGeneratedImage(null)

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, style, aspectRatio, userId: user.id })
            })

            const result = await response.json()

            if (result.imageUrl) {
                setGeneratedImage(result.imageUrl)

                const { data: savedImage } = await supabase
                    .from('generated_images')
                    .insert({ user_id: user.id, prompt, style, image_url: result.imageUrl, credits_used: 50 })
                    .select()
                    .single()

                if (savedImage) setRecentImages(prev => [savedImage, ...prev.slice(0, 5)])
                await logUsage(user.id, 'image-generator', 'generate', 50, { prompt, style, aspectRatio })

                if (onComplete) onComplete({ imageUrl: result.imageUrl })
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
            console.error('Error downloading:', error)
        }
    }

    if (loading || authLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Prompt Input */}
            <div>
                <label className="block text-sm font-medium mb-2">Describe your image</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A minimalist social media graphic..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm resize-none"
                />
            </div>

            {/* Style Selection */}
            <div>
                <label className="block text-sm font-medium mb-2">Style</label>
                <div className="grid grid-cols-3 gap-1">
                    {STYLE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStyle(opt.value)}
                            className={`p-2 rounded-lg border text-xs ${style === opt.value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--surface-border)]'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Aspect Ratio */}
            <div>
                <label className="block text-sm font-medium mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-1">
                    {ASPECT_RATIOS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setAspectRatio(opt.value)}
                            className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 ${aspectRatio === opt.value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--surface-border)]'}`}
                        >
                            {opt.icon}
                            {opt.value}
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
            >
                {generating ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                    </>
                ) : (
                    <>
                        <Wand2 className="w-4 h-4" />
                        Generate (50 credits)
                    </>
                )}
            </button>

            {/* Generated Image */}
            {generating ? (
                <div className="aspect-square bg-[var(--surface)] rounded-lg flex flex-col items-center justify-center">
                    <div className="relative">
                        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
                        <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] mt-3">Creating...</p>
                </div>
            ) : generatedImage ? (
                <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-[var(--surface)]">
                        <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleDownload(generatedImage)}
                            className="flex-1 btn bg-[var(--surface)] text-sm py-2 flex items-center justify-center gap-1"
                        >
                            <Download className="w-3 h-3" />
                            Save
                        </button>
                        <button
                            onClick={() => navigator.clipboard.writeText(generatedImage)}
                            className="flex-1 btn bg-[var(--surface)] text-sm py-2 flex items-center justify-center gap-1"
                        >
                            <Copy className="w-3 h-3" />
                            Copy
                        </button>
                        <button
                            onClick={handleGenerate}
                            className="btn bg-[var(--surface)] text-sm py-2 px-3"
                        >
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="aspect-video bg-[var(--surface)] rounded-lg flex flex-col items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-[var(--foreground-muted)]" />
                    <p className="text-sm text-[var(--foreground-muted)] mt-2">Preview appears here</p>
                </div>
            )}

            {/* Recent Images */}
            {recentImages.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 text-[var(--foreground-muted)]" />
                        <span className="text-xs text-[var(--foreground-muted)]">Recent</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {recentImages.slice(0, 6).map(img => (
                            <button
                                key={img.id}
                                onClick={() => setGeneratedImage(img.image_url)}
                                className="aspect-square rounded overflow-hidden hover:ring-2 hover:ring-[var(--primary)]"
                            >
                                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
