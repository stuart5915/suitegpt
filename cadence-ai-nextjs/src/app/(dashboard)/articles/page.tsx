'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    PenTool,
    Sparkles,
    Save,
    FileText,
    Loader2,
    ArrowLeft,
    Download,
    Check,
    AlertCircle
} from 'lucide-react'
import { Project } from '@/lib/supabase/types'

export default function ArticlesPage() {
    const supabase = createClient()
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    // Form State
    const [topic, setTopic] = useState('')
    const [keywords, setKeywords] = useState('')
    const [wordCount, setWordCount] = useState('1000')
    const [articleType, setArticleType] = useState('blog')

    // Editor State
    const [content, setContent] = useState('')
    const [filename, setFilename] = useState('')

    // Image State
    const [imagePrompt, setImagePrompt] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [generatingPrompt, setGeneratingPrompt] = useState(false)
    const [generatingImage, setGeneratingImage] = useState(false)
    const [aspectRatio, setAspectRatio] = useState('1:1')

    useEffect(() => {
        async function loadProjects() {
            const { data } = await supabase.from('projects').select('*')
            if (data?.length) {
                setProjects(data)
                setSelectedProjectId(data[0].id)
            }
        }
        loadProjects()
    }, [])

    const generateArticle = async () => {
        if (!topic || !selectedProjectId) return

        setGenerating(true)
        const project = projects.find(p => p.id === selectedProjectId)

        try {
            const res = await fetch('/api/articles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    type: articleType,
                    keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
                    wordCount,
                    projectContext: {
                        name: project?.name,
                        brand_voice: project?.brand_voice,
                        brand_tone: project?.brand_tone, // Assuming you added this
                        speaking_perspective: project?.posting_schedule?.speaking_perspective, // Check types
                        emoji_style: project?.posting_schedule?.emoji_style, // Check types
                        target_audience: project?.target_audience,
                        banned_words: project?.posting_schedule?.banned_words
                    }
                })
            })

            const data = await res.json()
            if (data.content) {
                setContent(data.content)
                // Auto-generate filename based on date and topic
                const date = new Date().toISOString().split('T')[0]
                const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                setFilename(`${date}-${slug}.md`)
            }
        } catch (err) {
            console.error(err)
            alert('Failed to generate article')
        } finally {
            setGenerating(false)
        }
    }

    const generateImagePrompt = async () => {
        if (!topic || !content) {
            alert('Generate an article first to base the image on.')
            return
        }
        setGeneratingPrompt(true)
        const project = projects.find(p => p.id === selectedProjectId)

        try {
            const res = await fetch('/api/articles/generate-image-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articleTitle: topic,
                    articleContent: content,
                    projectContext: {
                        name: project?.name,
                        brand_voice: project?.brand_voice,
                        brand_style: project?.posting_schedule?.brand_style, // Optional
                        target_audience: project?.target_audience
                    }
                })
            })
            const data = await res.json()
            if (data.prompt) setImagePrompt(data.prompt)
        } catch (err) {
            console.error(err)
            alert('Failed to generate prompt')
        } finally {
            setGeneratingPrompt(false)
        }
    }

    const generateImage = async () => {
        if (!imagePrompt) return
        setGeneratingImage(true)
        try {
            const res = await fetch('/api/articles/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    aspectRatio
                })
            })
            const data = await res.json()
            if (data.url) setImageUrl(data.url)
            else if (data.error) alert(data.error)
        } catch (err) {
            console.error(err)
            alert('Failed to generate image')
        } finally {
            setGeneratingImage(false)
        }
    }

    const saveToDatabase = async () => {
        if (!selectedProjectId || !topic) return
        setSaving(true)
        try {
            const res = await fetch('/api/articles/save-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    title: topic,
                    content,
                    imagePrompt,
                    imageDataUrl: imageUrl,
                    slug: filename.replace('.md', '')
                })
            })
            if (res.ok) {
                alert('Saved to Database!')
            } else {
                alert('Failed to save to DB')
            }
        } catch (err) {
            console.error(err)
            alert('Error saving to DB')
        } finally {
            setSaving(false)
        }
    }

    const saveLocally = async () => {
        if (!content || !filename) return

        setSaving(true)
        try {
            const res = await fetch('/api/articles/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, filename })
            })

            if (res.ok) {
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
            } else {
                alert('Failed to save file')
            }
        } catch (err) {
            console.error(err)
            alert('Error saving file')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen p-8 max-w-6xl mx-auto">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
                        <PenTool className="w-8 h-8 text-[var(--primary)]" />
                        Article Creator
                    </h1>
                    <p className="text-[var(--foreground-muted)] mt-2">
                        Generate SEO-optimized long-form content with AI images (Gemini).
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`btn btn-secondary`}
                        onClick={saveLocally}
                        disabled={saving || !content}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Save Local
                    </button>
                    <button
                        className={`btn btn-primary`}
                        onClick={saveToDatabase}
                        disabled={saving || !content}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save to DB
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Controls */}
                <div className="space-y-6">
                    <div className="card p-6 space-y-4">
                        <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--secondary)]" />
                            Configuration
                        </h2>

                        <div>
                            <label className="text-sm font-medium block mb-2">Project Context</label>
                            <select
                                className="input w-full"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-2">Topic / Title Idea</label>
                            <input
                                className="input w-full"
                                placeholder="e.g. The Future of AI Marketing"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-2">Keywords (comma separated)</label>
                            <input
                                className="input w-full"
                                placeholder="ai, marketing, automation..."
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium block mb-2">Type</label>
                                <select
                                    className="input w-full"
                                    value={articleType}
                                    onChange={(e) => setArticleType(e.target.value)}
                                >
                                    <option value="blog">Blog Post</option>
                                    <option value="guide">Guide / Tutorial</option>
                                    <option value="case_study">Case Study</option>
                                    <option value="news">News Update</option>
                                    <option value="comparison">Comparison</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-2">Word Count</label>
                                <select
                                    className="input w-full"
                                    value={wordCount}
                                    onChange={(e) => setWordCount(e.target.value)}
                                >
                                    <option value="500">Short (~500)</option>
                                    <option value="1000">Standard (~1000)</option>
                                    <option value="1500">Long (~1500)</option>
                                    <option value="2000">Deep Dive (~2000+)</option>
                                </select>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary w-full"
                            onClick={generateArticle}
                            disabled={generating || !topic}
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Writing Article...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Article
                                </>
                            )}
                        </button>
                    </div>

                    {/* Image Generator */}
                    <div className="card p-6 space-y-4">
                        <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                            <span className="text-lg">🎨</span>
                            Cover Image (Gemini)
                        </h2>

                        <div>
                            <label className="text-sm font-medium block mb-2">Image Prompt</label>
                            <div className="flex gap-2">
                                <textarea
                                    className="input w-full text-sm h-24 resize-none"
                                    placeholder="Describe the image..."
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                />
                                <button
                                    className="btn btn-secondary h-full px-2"
                                    onClick={generateImagePrompt}
                                    disabled={generatingPrompt || !content}
                                    title="Auto-generate prompt from article"
                                >
                                    {generatingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium block mb-2">Aspect Ratio</label>
                                <select className="input w-full" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                                    <option value="1:1">Square (1:1)</option>
                                    <option value="16:9">Wide (16:9)</option>
                                    <option value="4:3">Standard (4:3)</option>
                                    <option value="9:16">Portrait (9:16)</option>
                                </select>
                            </div>
                            <button
                                className="btn btn-primary mt-auto"
                                onClick={generateImage}
                                disabled={generatingImage || !imagePrompt}
                            >
                                {generatingImage ? 'Generating...' : 'Generate Image'}
                            </button>
                        </div>

                        {imageUrl && (
                            <div className="mt-4 rounded-lg overflow-hidden border border-[var(--surface-border)]">
                                <img src={imageUrl} alt="Generated cover" className="w-full h-auto object-cover" />
                            </div>
                        )}
                    </div>

                    {/* File Settings */}
                    {content && (
                        <div className="card p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[var(--primary)]" />
                                File Settings
                            </h2>
                            <div>
                                <label className="text-sm font-medium block mb-2">Filename</label>
                                <input
                                    className="input w-full font-mono text-sm"
                                    value={filename}
                                    onChange={(e) => setFilename(e.target.value)}
                                />
                            </div>
                            <button
                                className={`btn w-full ${saveSuccess ? 'btn-success' : 'btn-secondary'}`}
                                onClick={saveLocally}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Saved to content/articles!
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Save Locally
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Editor/Preview */}
                <div className="lg:col-span-2 h-[calc(100vh-12rem)]">
                    <div className="card h-full flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-[var(--surface-border)] bg-[var(--surface-hover)] flex items-center justify-between">
                            <span className="font-medium text-sm text-[var(--foreground-muted)]">Markdown Editor</span>
                            {content && (
                                <span className="text-xs text-[var(--foreground-muted)]">
                                    ~{content.split(/\s+/).length} words
                                </span>
                            )}
                        </div>
                        <textarea
                            className="flex-1 w-full bg-transparent p-6 text-[var(--foreground)] resize-none focus:outline-none font-mono text-sm leading-relaxed"
                            placeholder="# Your article will appear here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
