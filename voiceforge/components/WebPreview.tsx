'use client';

import { useMemo } from 'react';

interface AppFile {
    path: string;
    content: string;
}

interface WebPreviewProps {
    files: AppFile[];
    appName?: string;
    spec?: {
        features: string[];
        screens: string[];
        description: string;
    };
}

/**
 * Web preview that renders a live HTML/CSS version of the app
 * Uses srcdoc to avoid cross-origin issues
 */
export default function WebPreview({ files, appName = 'MyApp', spec }: WebPreviewProps) {
    // Generate preview HTML
    const previewHtml = useMemo(() => {
        return generatePreviewHtml(appName, spec, files);
    }, [files, appName, spec]);

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Phone frame */}
            <div className="w-[300px] h-[600px] bg-gray-900 rounded-[45px] p-3 shadow-2xl">
                <div className="w-full h-full bg-white rounded-[35px] overflow-hidden relative">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20"></div>

                    {/* Preview iframe using srcdoc */}
                    <iframe
                        srcDoc={previewHtml}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts"
                        title="App Preview"
                    />
                </div>
            </div>

            {/* Label */}
            <p className="text-center text-gray-500 text-sm mt-4">
                🔴 Live Preview • {appName}
            </p>
        </div>
    );
}

/**
 * Generate a complete HTML preview of the app
 */
function generatePreviewHtml(
    appName: string,
    spec?: { features: string[]; screens: string[]; description: string },
    files?: AppFile[]
): string {
    const features = spec?.features || [];
    // Ensure we always have at least one screen to display
    const rawScreens = spec?.screens || [];
    const screens = rawScreens.length > 0 ? rawScreens : ['Home', 'Settings'];
    const description = spec?.description || 'Your app';

    // Generate screen tabs
    const screenTabs = screens.slice(0, 4).map((s, i) => {
        const icon = getScreenIcon(s);
        return `<button class="tab ${i === 0 ? 'active' : ''}" onclick="showScreen(${i})">${icon}</button>`;
    }).join('');

    // Generate screen content
    const screenContent = screens.map((screen, i) => {
        return generateScreenContent(screen, features, appName, i === 0, i === 0);
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
            overflow-x: hidden;
            padding-top: 28px;
        }
        .app {
            display: flex;
            flex-direction: column;
            min-height: calc(100vh - 28px);
        }
        .header {
            padding: 16px;
            background: linear-gradient(135deg, #f97316, #ec4899);
            color: white;
        }
        .header h1 {
            font-size: 18px;
            font-weight: 700;
        }
        .header p {
            font-size: 11px;
            opacity: 0.9;
            margin-top: 2px;
        }
        .content {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
        }
        .screen {
            display: none;
        }
        .screen.active {
            display: block;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .card-title {
            font-weight: 600;
            font-size: 13px;
            color: #1f2937;
            margin-bottom: 6px;
        }
        .card-text {
            font-size: 11px;
            color: #6b7280;
        }
        .feature-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: white;
            border-radius: 10px;
            margin-bottom: 8px;
            font-size: 12px;
            color: #374151;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .feature-icon {
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, #fed7aa, #fecaca);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .btn {
            background: linear-gradient(135deg, #f97316, #ec4899);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            width: 100%;
            cursor: pointer;
            margin-top: 10px;
        }
        .tabs {
            display: flex;
            justify-content: space-around;
            padding: 10px;
            background: white;
            border-top: 1px solid #e5e7eb;
        }
        .tab {
            background: none;
            border: none;
            font-size: 18px;
            padding: 6px;
            cursor: pointer;
            opacity: 0.4;
            transition: opacity 0.2s;
        }
        .tab.active {
            opacity: 1;
        }
        .hero {
            background: linear-gradient(135deg, #fef3c7, #fce7f3);
            border-radius: 14px;
            padding: 16px;
            text-align: center;
            margin-bottom: 12px;
        }
        .hero-emoji {
            font-size: 32px;
            margin-bottom: 6px;
        }
        .hero-title {
            font-weight: 700;
            font-size: 16px;
            color: #1f2937;
        }
        .hero-text {
            font-size: 11px;
            color: #6b7280;
            margin-top: 4px;
        }
        .input {
            width: 100%;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .avatar {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #f97316, #ec4899);
            border-radius: 50%;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: white;
            border-radius: 8px;
            margin-bottom: 6px;
        }
        .setting-label {
            font-size: 13px;
            color: #374151;
        }
        .toggle {
            width: 40px;
            height: 22px;
            background: #e5e7eb;
            border-radius: 11px;
            position: relative;
            cursor: pointer;
            transition: background 0.2s;
        }
        .toggle.on {
            background: #f97316;
        }
        .toggle::after {
            content: '';
            position: absolute;
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: left 0.2s;
        }
        .toggle.on::after {
            left: 20px;
        }
        .check {
            width: 20px;
            height: 20px;
            border: 2px solid #e5e7eb;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        .check.done {
            background: #f97316;
            border-color: #f97316;
            color: white;
        }
    </style>
</head>
<body>
    <div class="app">
        <div class="header">
            <h1>${appName}</h1>
            <p>${description.slice(0, 50)}${description.length > 50 ? '...' : ''}</p>
        </div>
        
        <div class="content">
            ${screenContent}
        </div>
        
        <div class="tabs">
            ${screenTabs}
        </div>
    </div>
    
    <script>
        function showScreen(index) {
            document.querySelectorAll('.screen').forEach((s, i) => {
                s.classList.toggle('active', i === index);
            });
            document.querySelectorAll('.tab').forEach((t, i) => {
                t.classList.toggle('active', i === index);
            });
        }
        
        function toggleSwitch(el) {
            el.classList.toggle('on');
        }
        
        function toggleCheck(el) {
            el.classList.toggle('done');
            el.innerHTML = el.classList.contains('done') ? '✓' : '';
        }
    </script>
</body>
</html>`;
}

function getScreenIcon(screenName: string): string {
    const name = screenName.toLowerCase();
    if (name.includes('home') || name.includes('index')) return '🏠';
    if (name.includes('profile') || name.includes('account')) return '👤';
    if (name.includes('setting')) return '⚙️';
    if (name.includes('list') || name.includes('task')) return '📋';
    if (name.includes('add') || name.includes('create')) return '➕';
    if (name.includes('search')) return '🔍';
    if (name.includes('chart') || name.includes('stat')) return '📊';
    return '📱';
}

function generateScreenContent(
    screenName: string,
    features: string[],
    appName: string,
    isActive: boolean,
    isFirst: boolean = false
): string {
    const name = screenName.toLowerCase();
    const activeClass = isActive ? 'active' : '';

    // First screen always shows home-style content
    if (isFirst || name.includes('home') || name.includes('index')) {
        return `
        <div class="screen ${activeClass}">
            <div class="hero">
                <div class="hero-emoji">✨</div>
                <div class="hero-title">Welcome to ${appName}</div>
                <div class="hero-text">Start building something amazing</div>
            </div>
            ${features.slice(0, 4).map((f, i) => `
                <div class="feature-item">
                    <div class="feature-icon">${['📱', '⚡', '🎯', '🔥'][i % 4]}</div>
                    <span>${f.slice(0, 35)}${f.length > 35 ? '...' : ''}</span>
                </div>
            `).join('')}
            <button class="btn">Get Started</button>
        </div>`;
    }

    if (name.includes('profile') || name.includes('account')) {
        return `
        <div class="screen ${activeClass}">
            <div class="avatar">👤</div>
            <div class="card" style="text-align: center;">
                <div class="card-title">Your Profile</div>
                <div class="card-text">Manage your account</div>
            </div>
            <div class="setting-item">
                <span class="setting-label">Notifications</span>
                <div class="toggle on" onclick="toggleSwitch(this)"></div>
            </div>
            <div class="setting-item">
                <span class="setting-label">Dark Mode</span>
                <div class="toggle" onclick="toggleSwitch(this)"></div>
            </div>
        </div>`;
    }

    if (name.includes('setting')) {
        return `
        <div class="screen ${activeClass}">
            <div class="card">
                <div class="card-title">Settings</div>
                <div class="card-text">Customize your experience</div>
            </div>
            <div class="setting-item">
                <span class="setting-label">Push Notifications</span>
                <div class="toggle on" onclick="toggleSwitch(this)"></div>
            </div>
            <div class="setting-item">
                <span class="setting-label">Sound Effects</span>
                <div class="toggle" onclick="toggleSwitch(this)"></div>
            </div>
            <div class="setting-item">
                <span class="setting-label">Auto-Save</span>
                <div class="toggle on" onclick="toggleSwitch(this)"></div>
            </div>
        </div>`;
    }

    if (name.includes('list') || name.includes('task')) {
        return `
        <div class="screen ${activeClass}">
            <input class="input" placeholder="Add a new item..." />
            ${[1, 2, 3, 4].map(i => `
                <div class="feature-item">
                    <div class="check ${i <= 2 ? 'done' : ''}" onclick="toggleCheck(this)">${i <= 2 ? '✓' : ''}</div>
                    <span>Task item ${i}</span>
                </div>
            `).join('')}
        </div>`;
    }

    // Default screen
    return `
    <div class="screen ${activeClass}">
        <div class="hero">
            <div class="hero-emoji">📱</div>
            <div class="hero-title">${screenName.replace('Screen', '')}</div>
        </div>
        <div class="card">
            <div class="card-title">Content</div>
            <div class="card-text">This screen is part of ${appName}</div>
        </div>
    </div>`;
}
