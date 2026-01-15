/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
    ],
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                // Core palette
                background: '#000000',
                surface: {
                    DEFAULT: '#18181b', // zinc-900
                    light: '#27272a',   // zinc-800
                    lighter: '#3f3f46', // zinc-700
                },
                // Status indicators
                tracking: {
                    DEFAULT: '#22c55e', // green-500 (good tracking)
                    muted: '#166534',   // green-800
                },
                occlusion: {
                    DEFAULT: '#ef4444', // red-500 (vision blocked)
                    muted: '#991b1b',   // red-800
                },
                warning: {
                    DEFAULT: '#f59e0b', // amber-500
                    muted: '#92400e',   // amber-800
                },
                // Text
                text: {
                    DEFAULT: '#ffffff',
                    muted: '#a1a1aa',   // zinc-400
                    subtle: '#71717a', // zinc-500
                },
                // Accent
                accent: {
                    DEFAULT: '#8b5cf6', // violet-500
                    muted: '#6d28d9',   // violet-700
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                '4xl': '2rem',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.5)' },
                    '100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)' },
                },
            },
        },
    },
    plugins: [],
};
