'use client'

import { useState } from 'react'
import { Plus, Clock, Cloud, Calendar, CheckSquare, Activity, Wallet, Sparkles, Rocket } from 'lucide-react'

// Widget types available
const WIDGET_TYPES = [
    { id: 'clock', name: 'Clock', icon: Clock, description: 'Current time and date' },
    { id: 'weather', name: 'Weather', icon: Cloud, description: 'Local weather forecast' },
    { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Upcoming events' },
    { id: 'todo', name: 'Todo List', icon: CheckSquare, description: 'Your tasks' },
    { id: 'fitness', name: 'Fitness', icon: Activity, description: 'Health summary' },
    { id: 'wallet', name: 'Wallet', icon: Wallet, description: '$SUITE balance' },
    { id: 'quote', name: 'AI Quote', icon: Sparkles, description: 'Daily inspiration' },
    { id: 'apps', name: 'App Launcher', icon: Rocket, description: 'Quick access to SUITE apps' },
]

// Clock Widget Component
function ClockWidget() {
    const [time, setTime] = useState(new Date())

    // Update time every second
    useState(() => {
        const interval = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(interval)
    })

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

// Weather Widget Component (placeholder)
function WeatherWidget() {
    return (
        <div className="h-full flex flex-col items-center justify-center">
            <Cloud className="w-12 h-12 text-[var(--primary)] mb-2" />
            <div className="text-3xl font-bold">72°F</div>
            <div className="text-sm text-[var(--foreground-muted)]">Partly Cloudy</div>
            <div className="text-xs text-[var(--foreground-subtle)] mt-1">New York, NY</div>
        </div>
    )
}

// Quote Widget Component (placeholder)
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

// Placeholder Widget
function PlaceholderWidget({ type }: { type: string }) {
    const widgetInfo = WIDGET_TYPES.find(w => w.id === type)
    const Icon = widgetInfo?.icon || Plus

    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Icon className="w-10 h-10 text-[var(--foreground-muted)] mb-2" />
            <p className="text-sm font-medium">{widgetInfo?.name || 'Widget'}</p>
            <p className="text-xs text-[var(--foreground-subtle)]">Coming soon</p>
        </div>
    )
}

// Render widget based on type
function renderWidget(type: string) {
    switch (type) {
        case 'clock':
            return <ClockWidget />
        case 'weather':
            return <WeatherWidget />
        case 'quote':
            return <QuoteWidget />
        default:
            return <PlaceholderWidget type={type} />
    }
}

export default function DashboardPage() {
    const [widgets] = useState([
        { id: '1', type: 'clock', x: 0, y: 0, w: 2, h: 1 },
        { id: '2', type: 'weather', x: 2, y: 0, w: 1, h: 1 },
        { id: '3', type: 'quote', x: 0, y: 1, w: 2, h: 1 },
        { id: '4', type: 'todo', x: 2, y: 1, w: 1, h: 2 },
    ])

    return (
        <div className="min-h-screen p-6">
            {/* Widget Grid */}
            <div className="grid grid-cols-3 gap-4 auto-rows-[200px]">
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

            {/* Empty State */}
            {widgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                    <Plus className="w-16 h-16 text-[var(--foreground-muted)] mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No widgets yet</h2>
                    <p className="text-[var(--foreground-muted)]">Use the Widgets menu in the sidebar to add widgets</p>
                </div>
            )}
        </div>
    )
}
