'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Clock, Cloud, Sparkles, CheckSquare, Plus, X, Maximize2, Minimize2 } from 'lucide-react'

// Clock Widget
function ClockWidget() {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="h-full flex flex-col items-center justify-center">
            <div className="text-5xl font-bold gradient-text">
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-lg text-[var(--foreground-muted)] mt-2">
                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
        </div>
    )
}

// Weather Widget
function WeatherWidget() {
    return (
        <div className="h-full flex flex-col items-center justify-center">
            <Cloud className="w-12 h-12 text-[var(--primary)] mb-2" />
            <div className="text-3xl font-bold">72°F</div>
            <div className="text-sm text-[var(--foreground-muted)]">Partly Cloudy</div>
            <div className="text-xs text-[var(--foreground-subtle)] mt-1">San Francisco, CA</div>
        </div>
    )
}

// Quote Widget
function QuoteWidget() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-8 h-8 text-[var(--secondary)] mb-3" />
            <p className="text-lg italic text-[var(--foreground-muted)]">
                "The best way to predict the future is to create it."
            </p>
            <p className="text-sm text-[var(--foreground-subtle)] mt-2">- Peter Drucker</p>
        </div>
    )
}

// Todo Widget
function TodoWidget() {
    const [todos, setTodos] = useState([
        { id: 1, text: 'Review project proposal', done: false },
        { id: 2, text: 'Morning workout', done: true },
        { id: 3, text: 'Call with design team', done: false },
    ])

    const toggleTodo = (id: number) => {
        setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
    }

    return (
        <div className="h-full flex flex-col p-2">
            <div className="text-sm font-semibold text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Today's Tasks
            </div>
            <div className="space-y-2 flex-1">
                {todos.map(todo => (
                    <button
                        key={todo.id}
                        onClick={() => toggleTodo(todo.id)}
                        className="flex items-center gap-3 w-full text-left text-sm hover:bg-[var(--surface-hover)] p-2 rounded-lg transition-colors"
                    >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            todo.done
                                ? 'bg-[var(--primary)] border-[var(--primary)]'
                                : 'border-[var(--surface-border)]'
                        }`}>
                            {todo.done && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={todo.done ? 'line-through text-[var(--foreground-muted)]' : ''}>
                            {todo.text}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

// Widget renderer
function renderWidget(type: string) {
    switch (type) {
        case 'clock': return <ClockWidget />
        case 'weather': return <WeatherWidget />
        case 'quote': return <QuoteWidget />
        case 'todo': return <TodoWidget />
        default: return <div className="h-full flex items-center justify-center text-[var(--foreground-muted)]">Widget</div>
    }
}

export default function DemoPage() {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [widgets] = useState([
        { id: '1', type: 'clock', w: 2, h: 1 },
        { id: '2', type: 'weather', w: 1, h: 1 },
        { id: '3', type: 'quote', w: 2, h: 1 },
        { id: '4', type: 'todo', w: 1, h: 2 },
    ])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    return (
        <div className={`min-h-screen bg-[var(--background)] ${isFullscreen ? '' : 'pt-16'}`}>
            {/* Demo Banner */}
            {!isFullscreen && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-white">
                    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Image
                                src="/suitehub-icon.jpg"
                                alt="SUITEHub"
                                width={32}
                                height={32}
                                className="rounded-lg"
                            />
                            <span className="font-semibold">SUITEHub Demo</span>
                            <span className="text-sm opacity-80">— Try the full experience</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="Toggle Fullscreen"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                            <Link href="/signup" className="bg-white text-[var(--primary)] px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
                                Sign Up Free
                            </Link>
                            <Link href="/" className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Exit Button */}
            {isFullscreen && (
                <button
                    onClick={toggleFullscreen}
                    className="fixed top-4 right-4 z-50 p-3 bg-[var(--surface)] border border-[var(--surface-border)] rounded-full hover:bg-[var(--surface-hover)] transition-colors opacity-30 hover:opacity-100"
                    title="Exit Fullscreen"
                >
                    <Minimize2 className="w-5 h-5" />
                </button>
            )}

            {/* Widget Grid */}
            <div className="p-6">
                <div className="grid grid-cols-3 gap-4 auto-rows-[200px] max-w-5xl mx-auto">
                    {widgets.map(widget => (
                        <div
                            key={widget.id}
                            className={`
                                widget relative
                                ${widget.w === 2 ? 'col-span-2' : ''}
                                ${widget.h === 2 ? 'row-span-2' : ''}
                            `}
                        >
                            {renderWidget(widget.type)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom CTA (non-fullscreen only) */}
            {!isFullscreen && (
                <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--surface-border)] p-4">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <p className="text-[var(--foreground-muted)]">
                            Like what you see? Create your own personalized dashboard.
                        </p>
                        <Link href="/signup" className="btn btn-primary">
                            Get Started Free
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
