'use client';

import { useEffect, useState } from 'react';

interface BuildingAnimationProps {
    phase: 'analyzing' | 'designing' | 'coding' | 'testing' | 'finalizing';
    appName?: string;
}

const PHASE_DATA = {
    analyzing: { title: '🧠 Analyzing Your Idea', color: 'from-purple-500 to-blue-500', step: 1 },
    designing: { title: '🎨 Designing Your App', color: 'from-pink-500 to-purple-500', step: 2 },
    coding: { title: '⚡ Writing Code', color: 'from-orange-500 to-pink-500', step: 3 },
    testing: { title: '🧪 Testing', color: 'from-green-500 to-teal-500', step: 4 },
    finalizing: { title: '✨ Finalizing', color: 'from-yellow-500 to-orange-500', step: 5 },
};

const MESSAGES = [
    'Understanding requirements...',
    'Planning architecture...',
    'Designing screens...',
    'Setting up navigation...',
    'Writing components...',
    'Adding styles...',
    'Optimizing code...',
    'Running checks...',
    'Almost there...',
];

export default function BuildingAnimation({ phase, appName }: BuildingAnimationProps) {
    const [messageIndex, setMessageIndex] = useState(0);
    const [intensity, setIntensity] = useState(1);
    const phaseData = PHASE_DATA[phase];

    // Cycle messages
    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % MESSAGES.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Increase intensity with phase
    useEffect(() => {
        setIntensity(phaseData.step);
    }, [phase, phaseData.step]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center relative overflow-hidden">
            {/* Animated background gradient - intensity increases color saturation */}
            <div
                className="absolute inset-0 opacity-30 transition-opacity duration-1000"
                style={{
                    background: `radial-gradient(circle at 50% 50%, 
                        rgba(249, 115, 22, ${0.1 * intensity}) 0%, 
                        rgba(236, 72, 153, ${0.05 * intensity}) 50%, 
                        transparent 70%)`,
                }}
            />

            {/* Pulsing rings - more rings at higher intensity */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[...Array(intensity)].map((_, i) => (
                    <div
                        key={i}
                        className={`absolute rounded-full border border-orange-500/20 animate-ping`}
                        style={{
                            width: `${150 + i * 100}px`,
                            height: `${150 + i * 100}px`,
                            animationDuration: `${2 + i * 0.5}s`,
                            animationDelay: `${i * 0.3}s`,
                        }}
                    />
                ))}
            </div>

            {/* Floating particles - just CSS, no state */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(12)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 bg-orange-500/30 rounded-full"
                        style={{
                            left: `${10 + (i * 7) % 80}%`,
                            animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
                            animationDelay: `${i * 0.2}s`,
                        }}
                    />
                ))}
            </div>

            {/* Main content */}
            <div className="text-center z-10">
                {/* Spinner with emoji */}
                <div className="relative w-24 h-24 mx-auto mb-6">
                    <div
                        className={`absolute inset-0 rounded-full bg-gradient-to-r ${phaseData.color}`}
                        style={{
                            animation: `spin ${3 - intensity * 0.3}s linear infinite`,
                        }}
                    >
                        <div className="absolute inset-2 rounded-full bg-gray-900"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">
                        {phase === 'analyzing' && '🧠'}
                        {phase === 'designing' && '🎨'}
                        {phase === 'coding' && '⚡'}
                        {phase === 'testing' && '🧪'}
                        {phase === 'finalizing' && '✨'}
                    </div>
                </div>

                {/* App name */}
                {appName && (
                    <>
                        <p className="text-sm text-gray-400 mb-1">Building</p>
                        <h2 className={`text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r ${phaseData.color}`}>
                            {appName}
                        </h2>
                    </>
                )}

                {/* Phase title */}
                <h1 className="text-xl font-bold mb-2">{phaseData.title}</h1>

                {/* Animated message */}
                <p className="text-gray-400 mb-6 h-6 transition-opacity duration-300">
                    {MESSAGES[messageIndex]}
                </p>

                {/* Progress bar */}
                <div className="w-64 mx-auto mb-4">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${phaseData.color} transition-all duration-700`}
                            style={{ width: `${(phaseData.step / 5) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Phase dots */}
                <div className="flex justify-center gap-2">
                    {Object.keys(PHASE_DATA).map((p, i) => (
                        <div
                            key={p}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${phaseData.step > i ? 'bg-orange-500' : 'bg-gray-600'
                                } ${phase === p ? 'scale-150' : ''}`}
                        />
                    ))}
                </div>

                {/* Fun tip */}
                <p className="mt-8 text-xs text-gray-600">
                    ☕ Grab a coffee, your app is almost ready...
                </p>
            </div>

            <style jsx>{`
                @keyframes float {
                    0%, 100% { 
                        transform: translateY(100vh) scale(0);
                        opacity: 0;
                    }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { 
                        transform: translateY(-10vh) scale(1);
                        opacity: 0;
                    }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
