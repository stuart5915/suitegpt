'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BuildingAnimation from '@/components/BuildingAnimation';
import WebPreview from '@/components/WebPreview';
import { getCachedTemplate } from '@/lib/cachedTemplates';

interface AppFile {
    path: string;
    content: string;
}

interface AppSpec {
    name: string;
    description: string;
    features: string[];
    screens: string[];
}

interface GeneratedApp {
    id: string;
    name: string;
    description: string;
    spec: AppSpec;
    files: AppFile[];
}

type BuildPhase = 'start' | 'analyzing' | 'designing' | 'coding' | 'testing' | 'finalizing' | 'done';

// Templates for quick start
const TEMPLATES = [
    { id: 'habit', emoji: '📅', name: 'Habit Tracker', prompt: 'A habit tracker app with daily streaks, progress charts, and notifications' },
    { id: 'todo', emoji: '✅', name: 'Todo List', prompt: 'A simple todo list app with categories, due dates, and swipe to complete' },
    { id: 'notes', emoji: '📝', name: 'Notes App', prompt: 'A notes app with folders, search, and markdown support' },
    { id: 'fitness', emoji: '💪', name: 'Fitness', prompt: 'A workout tracker with exercise library, workout plans, and progress photos' },
    { id: 'budget', emoji: '💰', name: 'Budget', prompt: 'An expense tracker with categories, monthly budgets, and spending charts' },
    { id: 'recipe', emoji: '🍳', name: 'Recipes', prompt: 'A recipe app with meal planning, grocery lists, and cooking timers' },
];

export default function BuilderPage() {
    const [prompt, setPrompt] = useState('');
    const [phase, setPhase] = useState<BuildPhase>('start');
    const [app, setApp] = useState<GeneratedApp | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [suggestedFeatures, setSuggestedFeatures] = useState<string[]>([]);
    const [isAddingFeature, setIsAddingFeature] = useState(false);
    const [appNamePreview, setAppNamePreview] = useState('');
    const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Phase progression for visual effect
    const progressPhase = () => {
        const phases: BuildPhase[] = ['analyzing', 'designing', 'coding', 'testing', 'finalizing'];
        let currentIndex = 0;

        const advancePhase = () => {
            if (currentIndex < phases.length) {
                setPhase(phases[currentIndex]);
                currentIndex++;
                phaseTimeoutRef.current = setTimeout(advancePhase, 8000 + Math.random() * 4000);
            }
        };

        advancePhase();
    };

    useEffect(() => {
        return () => {
            if (phaseTimeoutRef.current) {
                clearTimeout(phaseTimeoutRef.current);
            }
        };
    }, []);

    // INSTANT loading for cached templates
    const loadCachedTemplate = (templateId: string) => {
        const cached = getCachedTemplate(templateId);
        if (cached) {
            setApp(cached);
            setPhase('done');
            generateFeatureSuggestions(cached.spec);
            return true;
        }
        return false;
    };

    const createApp = async (ideaPrompt: string, templateId?: string) => {
        setError(null);

        // Check for cached template first - INSTANT loading!
        if (templateId && loadCachedTemplate(templateId)) {
            return; // Loaded instantly from cache!
        }

        // Extract a preview name from the prompt
        const words = ideaPrompt.split(' ');
        const keyWords = words.filter(w => w.length > 3 && !['with', 'that', 'and', 'the', 'for'].includes(w.toLowerCase()));
        setAppNamePreview(keyWords.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') || 'MyApp');

        // Start phase animation for custom apps
        progressPhase();

        try {
            const response = await fetch('/api/apps/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: ideaPrompt }),
            });

            // Clear phase timeouts
            if (phaseTimeoutRef.current) {
                clearTimeout(phaseTimeoutRef.current);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create app');
            }

            setApp(data.app);
            setPhase('done');
            setAppNamePreview('');

            // Generate feature suggestions
            generateFeatureSuggestions(data.app.spec);
        } catch (err) {
            if (phaseTimeoutRef.current) {
                clearTimeout(phaseTimeoutRef.current);
            }
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPhase('start');
        }
    };

    const generateFeatureSuggestions = (spec: AppSpec) => {
        const suggestions = [
            '🌙 Dark mode toggle',
            '🔔 Push notifications',
            '📤 Share with friends',
            '📊 Analytics dashboard',
            '☁️ Cloud sync',
            '🔐 Biometric login',
        ];
        setSuggestedFeatures(suggestions.filter(() => Math.random() > 0.3).slice(0, 4));
    };

    const addFeature = async (feature: string) => {
        if (!app) return;

        setIsAddingFeature(true);

        try {
            const response = await fetch('/api/apps/add-feature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appId: app.id,
                    currentSpec: app.spec,
                    currentFiles: app.files,
                    newFeature: feature.replace(/^[^\s]+\s/, ''), // Remove emoji
                }),
            });

            const data = await response.json();

            if (response.ok && data.app) {
                setApp(data.app);
                setSuggestedFeatures(prev => prev.filter(f => f !== feature));
            }
        } catch (err) {
            console.error('Error adding feature:', err);
        }

        setIsAddingFeature(false);
    };

    const [isPublishing, setIsPublishing] = useState(false);
    const [publishStatus, setPublishStatus] = useState<string | null>(null);

    const handlePublish = async () => {
        if (!app || isPublishing) return;

        setIsPublishing(true);
        setPublishStatus('Saving to app store...');

        try {
            const response = await fetch('/api/apps/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app,
                    creatorName: 'Web Builder User',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to publish');
            }

            setPublishStatus(`✅ ${app.name} submitted for review!`);
            alert(`🎉 "${app.name}" submitted for review!\n\nApp ID: ${data.app.id}\nSlug: ${data.app.slug}\n\nWe'll notify you when it's live on getsuite.app!`);
        } catch (err) {
            console.error('Publish error:', err);
            setPublishStatus('❌ Failed to publish');
            alert('Failed to publish. Please try again.');
        }

        setIsPublishing(false);
    };

    // START PHASE
    if (phase === 'start') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
                    <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
                        SUITE Forge
                    </Link>
                </header>

                <div className="max-w-4xl mx-auto px-6 py-16">
                    <h1 className="text-5xl font-bold text-center mb-3">
                        Build your app with AI ✨
                    </h1>
                    <p className="text-xl text-gray-400 text-center mb-12">
                        Describe your idea. Watch it come to life. Ship it.
                    </p>

                    {/* Templates */}
                    <p className="text-sm text-gray-500 mb-4 text-center">Quick start with a template:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
                        {TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => createApp(t.prompt, t.id)}
                                className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-orange-500/50 hover:bg-gray-800 transition-all text-center cursor-pointer group"
                            >
                                <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">{t.emoji}</span>
                                <span className="text-sm text-gray-300">{t.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-10">
                        <div className="flex-1 h-px bg-gray-700"></div>
                        <span className="text-gray-500 text-sm">or describe your own</span>
                        <div className="flex-1 h-px bg-gray-700"></div>
                    </div>

                    {/* Custom prompt */}
                    <div className="relative max-w-2xl mx-auto">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your app idea in detail...

Example: A meditation app with guided sessions, breathing exercises, progress tracking, and calming ambient sounds"
                            className="w-full h-40 p-5 text-lg bg-gray-800/50 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        />
                        <button
                            onClick={() => createApp(prompt)}
                            disabled={!prompt.trim() || prompt.length < 10}
                            className="absolute right-3 bottom-3 px-8 py-3 font-bold text-lg bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-lg shadow-orange-500/25"
                        >
                            Build It 🚀
                        </button>
                    </div>

                    {error && (
                        <p className="mt-4 text-red-400 text-center">{error}</p>
                    )}
                </div>
            </div>
        );
    }

    // BUILDING PHASES (animated)
    if (['analyzing', 'designing', 'coding', 'testing', 'finalizing'].includes(phase)) {
        return (
            <BuildingAnimation
                phase={phase as 'analyzing' | 'designing' | 'coding' | 'testing' | 'finalizing'}
                appName={appNamePreview}
            />
        );
    }

    // DONE PHASE - App created
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700/50">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
                        SUITE Forge
                    </Link>
                    {app && (
                        <span className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded-full">
                            ✓ {app.name}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setPhase('start');
                            setApp(null);
                            setPrompt('');
                        }}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                    >
                        ← New App
                    </button>
                    <button
                        onClick={handlePublish}
                        className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg hover:opacity-90 cursor-pointer shadow-lg shadow-orange-500/25"
                    >
                        🚀 Publish to App Store
                    </button>
                </div>
            </header>

            <div className="flex h-[calc(100vh-57px)]">
                {/* Left: Phone Preview */}
                <div className="w-1/2 p-8 flex items-center justify-center bg-gradient-to-b from-gray-900/50 to-gray-800/50">
                    {app && <WebPreview files={app.files} appName={app.name} spec={app.spec} />}
                </div>

                {/* Right: Feature builder */}
                <div className="w-1/2 p-8 border-l border-gray-700/50 overflow-y-auto">
                    <h2 className="text-3xl font-bold mb-2">What else do you want?</h2>
                    <p className="text-gray-400 mb-8">Keep adding features to make your app amazing</p>

                    {/* Suggested features */}
                    <div className="flex flex-wrap gap-3 mb-8">
                        {suggestedFeatures.map((feature) => (
                            <button
                                key={feature}
                                onClick={() => addFeature(feature)}
                                disabled={isAddingFeature}
                                className="px-5 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-sm hover:border-orange-500 hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-all"
                            >
                                {feature}
                            </button>
                        ))}
                    </div>

                    {/* Custom feature input */}
                    <div className="flex gap-3 mb-10">
                        <input
                            type="text"
                            placeholder="Or type a custom feature..."
                            className="flex-1 px-5 py-4 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value) {
                                    addFeature(e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>

                    {isAddingFeature && (
                        <div className="flex items-center gap-3 mb-8 text-orange-400">
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Adding feature to your app...</span>
                        </div>
                    )}

                    {/* App details */}
                    {app && (
                        <div className="space-y-4">
                            <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-700/50">
                                <h3 className="text-xl font-bold mb-2">📱 {app.name}</h3>
                                <p className="text-gray-400">{app.description}</p>
                            </div>

                            <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-700/50">
                                <h3 className="font-semibold mb-3">✨ Features ({app.spec.features.length})</h3>
                                <ul className="space-y-2">
                                    {app.spec.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-gray-300">
                                            <span className="text-green-400 mt-0.5">✓</span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-700/50">
                                <h3 className="font-semibold mb-3">📄 Generated Files ({app.files.length})</h3>
                                <div className="flex flex-wrap gap-2">
                                    {app.files.slice(0, 8).map((f) => (
                                        <span key={f.path} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-400">
                                            {f.path.split('/').pop()}
                                        </span>
                                    ))}
                                    {app.files.length > 8 && (
                                        <span className="px-2 py-1 text-xs text-gray-500">+{app.files.length - 8} more</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
