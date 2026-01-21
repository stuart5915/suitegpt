'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2 } from 'lucide-react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

const SUGGESTIONS = [
    { emoji: '📊', text: 'How was my week?' },
    { emoji: '💪', text: 'What workouts did I do?' },
    { emoji: '🍎', text: 'Summarize my nutrition' },
    { emoji: '😴', text: 'How am I sleeping?' },
    { emoji: '📝', text: 'Any patterns in my data?' },
    { emoji: '🎯', text: 'What should I focus on?' },
]

const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `Hi! I'm your SUITEHub AI assistant. I have access to all your SUITE app data:

• **TrueForm** - Your workouts and exercises
• **FoodVitals** - Nutrition and meals
• **Cheshbon** - Reflections and insights
• **REMcast** - Sleep and dreams
• **Cadence** - Content and marketing

Ask me anything about your personal data, and I'll help you understand patterns, get insights, or just chat!`,
    timestamp: new Date(),
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text.trim(),
                    history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                }),
            })

            const data = await response.json()

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response || "I'm sorry, I couldn't process that. Please try again.",
                timestamp: new Date(),
            }

            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I'm having trouble connecting right now. Please try again.",
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        sendMessage(input)
    }

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-60px)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--surface-border)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--secondary)] to-[var(--primary)] flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-semibold">SUITEHub AI</h1>
                        <p className="text-sm text-[var(--foreground-muted)]">Your personal AI assistant</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`
                                max-w-[80%] px-4 py-3
                                ${message.role === 'user' ? 'message-user' : 'message-ai'}
                            `}
                        >
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                            <p className="text-xs opacity-50 mt-1">
                                {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="message-ai px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggestions (show only at start) */}
            {messages.length === 1 && (
                <div className="px-4 pb-2">
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSuggestionClick(suggestion.text)}
                                className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-full text-sm hover:border-[var(--primary)] transition-all"
                            >
                                {suggestion.emoji} {suggestion.text}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--surface-border)]">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything..."
                        className="input flex-1"
                        disabled={isLoading}
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="btn btn-primary px-4"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    )
}
