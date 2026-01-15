'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface VideoPreviewPlayerProps {
    title: string
    content: string
    videoTemplate: string
}

interface Frame {
    label: string
    text: string
    duration: number // in ms
}

export function VideoPreviewPlayer({ title, content, videoTemplate }: VideoPreviewPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentFrame, setCurrentFrame] = useState(0)
    const [progress, setProgress] = useState(0)
    const [textVisible, setTextVisible] = useState(true)

    // Parse content into frames - flexible to handle any format
    const parseFrames = useCallback((): Frame[] => {
        // Try to find structured sections first
        const hookMatch = content.match(/\[HOOK[^\]]*\][:\s]*([^\[\n]+)/i)
        const problemMatch = content.match(/\[PROBLEM[^\]]*\][:\s]*([^\[\n]+)/i)
        const solutionMatch = content.match(/\[SOLUTION[^\]]*\][:\s]*([^\[\n]+)/i)
        const ctaMatch = content.match(/\[CTA[^\]]*\][:\s]*([^\[\n]+)/i)

        // If we found structured content, use it
        if (hookMatch || problemMatch || solutionMatch || ctaMatch) {
            return [
                { label: 'HOOK', text: hookMatch?.[1]?.trim() || title || 'Hook...', duration: 3000 },
                { label: 'SETUP', text: problemMatch?.[1]?.trim() || 'Setup...', duration: 3000 },
                { label: 'VALUE', text: solutionMatch?.[1]?.trim() || 'Main value...', duration: 6000 },
                { label: 'CTA', text: ctaMatch?.[1]?.trim() || 'Follow for more!', duration: 3000 },
            ]
        }

        // Fallback: Use title and split content by sentences/newlines
        const cleanContent = content
            .replace(/\[.*?\]/g, '') // Remove any brackets
            .replace(/#+\s*/g, '') // Remove markdown headers
            .trim()

        // Split by newlines or periods
        let lines = cleanContent.split(/[\n.!?]+/).map(l => l.trim()).filter(l => l.length > 5)

        // If still no lines, just use the content as-is
        if (lines.length === 0 && cleanContent) {
            lines = [cleanContent]
        }

        // Create frames from whatever content we have
        const hookText = title || lines[0] || 'Your video starts here...'
        const setupText = lines[1] || lines[0] || 'Content loading...'
        const valueText = lines[2] || lines[1] || lines[0] || 'Main content...'
        const ctaText = lines[3] || 'Follow for more tips!'

        return [
            { label: 'HOOK', text: hookText, duration: 3000 },
            { label: 'SETUP', text: setupText, duration: 3000 },
            { label: 'VALUE', text: valueText, duration: 6000 },
            { label: 'CTA', text: ctaText, duration: 3000 },
        ]
    }, [content, title])

    const frames = parseFrames()
    const totalDuration = frames.reduce((sum, f) => sum + (f?.duration || 3000), 0)

    // Animation loop
    useEffect(() => {
        if (!isPlaying || frames.length === 0) return

        // Calculate frame start time
        let frameStart = 0
        for (let i = 0; i < currentFrame && i < frames.length; i++) {
            frameStart += frames[i]?.duration || 3000
        }

        const currentFrameObj = frames[currentFrame]
        const currentFrameDuration = currentFrameObj?.duration || 3000

        // Progress update
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev + (50 / totalDuration)
                if (newProgress >= 1) {
                    setIsPlaying(false)
                    return 1
                }
                return newProgress
            })
        }, 50)

        // Frame transition
        const frameProgress = progress * totalDuration - frameStart
        const remainingTime = Math.max(100, currentFrameDuration - frameProgress)

        const frameTimer = setTimeout(() => {
            if (currentFrame < frames.length - 1) {
                setTextVisible(false)
                setTimeout(() => {
                    setCurrentFrame(prev => Math.min(prev + 1, frames.length - 1))
                    setTextVisible(true)
                }, 300)
            }
        }, remainingTime)

        return () => {
            clearInterval(progressInterval)
            clearTimeout(frameTimer)
        }
    }, [isPlaying, currentFrame, progress, frames, totalDuration])

    const restart = () => {
        setCurrentFrame(0)
        setProgress(0)
        setTextVisible(true)
        setIsPlaying(false)
    }

    const togglePlay = () => {
        if (progress >= 1) {
            restart()
            setTimeout(() => setIsPlaying(true), 100)
        } else {
            setIsPlaying(!isPlaying)
        }
    }

    // Get animation class based on template
    const getAnimationClass = () => {
        switch (videoTemplate) {
            case 'hook_reveal':
                return 'animate-scale-in'
            case 'list_tips':
                return 'animate-slide-up'
            case 'quote_style':
                return 'animate-fade-in'
            case 'kinetic_text':
                return 'animate-kinetic'
            default:
                return 'animate-fade-in'
        }
    }

    // Get background style based on frame
    const getBackgroundStyle = () => {
        const frame = frames[currentFrame]
        if (!frame) return 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]'

        switch (frame.label) {
            case 'HOOK':
                return 'bg-gradient-to-br from-[var(--primary)] via-[#1a1a2e] to-[var(--secondary)]'
            case 'SETUP':
                return 'bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]'
            case 'VALUE':
                return 'bg-gradient-to-br from-[#16213e] to-[#1a1a2e]'
            case 'CTA':
                return 'bg-gradient-to-br from-[var(--success)] via-[#1a1a2e] to-[var(--primary)]'
            default:
                return 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]'
        }
    }

    const currentFrameData = frames[currentFrame]

    return (
        <div className="flex flex-col items-center">
            {/* Phone Frame */}
            <div className="relative w-64 aspect-[9/16] rounded-[2rem] bg-black p-2 shadow-2xl">
                {/* Screen */}
                <div className={`w-full h-full rounded-[1.5rem] overflow-hidden relative transition-all duration-500 ${getBackgroundStyle()}`}>
                    {/* Status bar */}
                    <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-4 text-white/60 text-[10px] z-10">
                        <span>9:41</span>
                        <div className="flex gap-1">
                            <span>📶</span>
                            <span>🔋</span>
                        </div>
                    </div>

                    {/* Frame label */}
                    <div className="absolute top-10 left-0 right-0 flex justify-center z-10">
                        <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur text-white/80 text-[10px] font-medium">
                            {currentFrameData?.label} • Frame {currentFrame + 1}/{frames.length}
                        </span>
                    </div>

                    {/* Main content */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                        <div
                            key={currentFrame}
                            className={`text-center transition-all duration-300 ${isPlaying && textVisible ? getAnimationClass() : 'opacity-100'}`}
                        >
                            <p className="text-white font-bold text-lg leading-tight drop-shadow-lg">
                                {currentFrameData?.text || title || 'Press play to preview'}
                            </p>
                            {!isPlaying && progress === 0 && (
                                <p className="text-white/50 text-xs mt-2">
                                    Press play to start
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Bottom UI overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                        <div className="flex items-center gap-2 text-white/80 text-xs">
                            <div className="w-8 h-8 rounded-full bg-white/20" />
                            <div className="flex-1">
                                <div className="font-medium text-white">@yourbrand</div>
                                <div className="text-white/60 text-[10px]">Sponsored</div>
                            </div>
                            <button className="px-3 py-1 rounded-full bg-white text-black text-[10px] font-medium">
                                Follow
                            </button>
                        </div>
                    </div>

                    {/* Side buttons (TikTok-style) */}
                    <div className="absolute right-3 bottom-20 flex flex-col gap-4 text-white/80">
                        <div className="flex flex-col items-center">
                            <span className="text-xl">❤️</span>
                            <span className="text-[8px]">12.3K</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl">💬</span>
                            <span className="text-[8px]">432</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl">↗️</span>
                            <span className="text-[8px]">Share</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-4 w-64">
                {/* Progress bar */}
                <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden mb-3">
                    <div
                        className="h-full bg-[var(--primary)] transition-all duration-100"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                {/* Time display */}
                <div className="flex justify-between text-xs text-[var(--foreground-muted)] mb-3">
                    <span>{Math.floor(progress * totalDuration / 1000)}s</span>
                    <span>{Math.floor(totalDuration / 1000)}s total</span>
                </div>

                {/* Play/Pause controls */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={restart}
                        className="p-2 rounded-full hover:bg-[var(--surface)] text-[var(--foreground-muted)] transition-colors cursor-pointer"
                        title="Restart"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={togglePlay}
                        className="p-4 rounded-full bg-[var(--primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>
                </div>
            </div>

            {/* Style note */}
            <p className="mt-4 text-xs text-[var(--foreground-muted)] text-center">
                {videoTemplate?.replace('_', ' ')} style • Screen record to export
            </p>
        </div>
    )
}
