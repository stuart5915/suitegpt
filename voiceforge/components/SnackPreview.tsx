'use client';

import { useEffect, useRef, useState } from 'react';

interface SnackFile {
    path: string;
    content: string;
}

interface SnackPreviewProps {
    files: SnackFile[];
    appName?: string;
    onReady?: () => void;
}

/**
 * Embeds an Expo Snack preview that shows the generated app
 */
export default function SnackPreview({ files, appName = 'MyApp', onReady }: SnackPreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Convert files to Snack format (encoded in URL)
    const getSnackUrl = () => {
        if (files.length === 0) return null;

        // Create a simple App.js if we have multiple files
        // Snack works best with a single App.js entry point
        const mainFile = files.find(f => f.path.includes('App') || f.path.includes('index'));
        const code = mainFile?.content || files[0]?.content || '';

        // Encode the code for URL
        const encodedCode = encodeURIComponent(code);

        // Snack embed URL
        // Using the embed endpoint with code parameters
        const snackUrl = `https://snack.expo.dev/embedded?platform=web&name=${encodeURIComponent(appName)}&theme=dark&preview=true&code=${encodedCode}`;

        return snackUrl;
    };

    const snackUrl = getSnackUrl();

    useEffect(() => {
        if (snackUrl) {
            setIsLoading(true);
        }
    }, [snackUrl]);

    const handleLoad = () => {
        setIsLoading(false);
        onReady?.();
    };

    if (!snackUrl || files.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-xl">
                <div className="text-center text-gray-400">
                    <span className="text-4xl block mb-2">📱</span>
                    <p>Your app preview will appear here</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden">
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-gray-400 text-sm">Loading preview...</p>
                    </div>
                </div>
            )}

            {/* Snack iframe */}
            <iframe
                ref={iframeRef}
                src={snackUrl}
                onLoad={handleLoad}
                className="w-full h-full border-0"
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            />
        </div>
    );
}
