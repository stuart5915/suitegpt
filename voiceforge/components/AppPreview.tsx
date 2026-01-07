'use client';

import { useState, useEffect } from 'react';

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

interface AppPreviewProps {
    app: {
        name: string;
        description: string;
        spec: AppSpec;
        files: AppFile[];
    };
}

/**
 * Phone mockup preview that shows the app's screens visually
 */
export default function AppPreview({ app }: AppPreviewProps) {
    const [currentScreen, setCurrentScreen] = useState(0);

    // Auto-rotate screens
    useEffect(() => {
        if (app.spec.screens.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentScreen((prev) => (prev + 1) % app.spec.screens.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [app.spec.screens.length]);

    const screens = app.spec.screens || ['HomeScreen'];
    const features = app.spec.features || [];

    // Generate a visual representation of the screen
    const renderScreenContent = (screenName: string) => {
        const isHome = screenName.toLowerCase().includes('home') || screenName.toLowerCase().includes('index');
        const isProfile = screenName.toLowerCase().includes('profile') || screenName.toLowerCase().includes('settings');
        const isList = screenName.toLowerCase().includes('list') || screenName.toLowerCase().includes('tasks');
        const isDetail = screenName.toLowerCase().includes('detail');

        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-gray-100 to-white p-4">
                {/* Status bar mockup */}
                <div className="flex justify-between items-center text-[10px] text-gray-500 mb-4">
                    <span>9:41</span>
                    <div className="flex gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-lg font-bold text-gray-900">{app.name}</h1>
                    <p className="text-xs text-gray-500">{screenName.replace('Screen', '')}</p>
                </div>

                {/* Content based on screen type */}
                {isHome && (
                    <div className="space-y-3 flex-1">
                        <div className="h-24 bg-gradient-to-r from-orange-400 to-pink-400 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">Welcome!</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {features.slice(0, 4).map((f, i) => (
                                <div key={i} className="h-16 bg-gray-200 rounded-lg flex items-center justify-center p-2">
                                    <span className="text-[8px] text-gray-600 text-center">{f.slice(0, 20)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isList && (
                    <div className="space-y-2 flex-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
                                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                    <span className="text-orange-500 text-xs">✓</span>
                                </div>
                                <div className="flex-1">
                                    <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-2 bg-gray-100 rounded w-1/2 mt-1"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {isProfile && (
                    <div className="flex-1 flex flex-col items-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full mb-3 flex items-center justify-center">
                            <span className="text-3xl">👤</span>
                        </div>
                        <div className="h-3 bg-gray-300 rounded w-24 mb-1"></div>
                        <div className="h-2 bg-gray-200 rounded w-16 mb-4"></div>
                        <div className="w-full space-y-2">
                            {['Settings', 'Help', 'About'].map((item) => (
                                <div key={item} className="flex items-center justify-between p-2 bg-white rounded-lg">
                                    <span className="text-xs text-gray-600">{item}</span>
                                    <span className="text-gray-400">→</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isDetail && (
                    <div className="flex-1">
                        <div className="h-32 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl mb-3 flex items-center justify-center">
                            <span className="text-2xl">📱</span>
                        </div>
                        <div className="h-3 bg-gray-300 rounded w-3/4 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                    </div>
                )}

                {!isHome && !isList && !isProfile && !isDetail && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-4xl block mb-2">📱</span>
                            <span className="text-xs text-gray-500">{screenName}</span>
                        </div>
                    </div>
                )}

                {/* Bottom nav mockup */}
                <div className="mt-auto pt-4">
                    <div className="flex justify-around border-t border-gray-200 pt-3">
                        {screens.slice(0, 4).map((s, i) => (
                            <button
                                key={s}
                                onClick={() => setCurrentScreen(i)}
                                className={`flex flex-col items-center ${currentScreen === i ? 'text-orange-500' : 'text-gray-400'}`}
                            >
                                <span className="text-sm">
                                    {s.toLowerCase().includes('home') ? '🏠' :
                                        s.toLowerCase().includes('profile') ? '👤' :
                                            s.toLowerCase().includes('list') || s.toLowerCase().includes('task') ? '📋' :
                                                s.toLowerCase().includes('settings') ? '⚙️' : '📱'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center">
            {/* Phone frame */}
            <div className="w-[280px] h-[560px] bg-gray-900 rounded-[40px] p-2 shadow-2xl">
                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-b-xl z-10"></div>

                    {/* Screen content */}
                    {renderScreenContent(screens[currentScreen])}
                </div>
            </div>

            {/* Screen selector dots */}
            {screens.length > 1 && (
                <div className="flex gap-2 mt-4">
                    {screens.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentScreen(i)}
                            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${currentScreen === i ? 'bg-orange-500 w-4' : 'bg-gray-600'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Screen name */}
            <p className="text-sm text-gray-400 mt-2">{screens[currentScreen]}</p>
        </div>
    );
}
