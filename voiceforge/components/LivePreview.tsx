'use client';

import { useEffect, useRef, useState } from 'react';

interface AppFile {
    path: string;
    content: string;
}

interface LivePreviewProps {
    files: AppFile[];
    appName?: string;
}

/**
 * Real live preview using Expo Snack embedded player
 * This actually runs the React Native code in the browser
 */
export default function LivePreview({ files, appName = 'MyApp' }: LivePreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [snackUrl, setSnackUrl] = useState<string | null>(null);

    useEffect(() => {
        if (files.length === 0) return;

        // Find the main App file or create one
        let mainCode = '';

        // Look for App.tsx, App.js, or index.tsx
        const appFile = files.find(f =>
            f.path.includes('App.tsx') ||
            f.path.includes('App.js') ||
            f.path.includes('index.tsx') ||
            f.path.includes('_layout.tsx')
        );

        if (appFile) {
            mainCode = appFile.content;
        } else if (files.length > 0) {
            // Use first file
            mainCode = files[0].content;
        }

        // Clean up the code for Snack
        // Remove file imports that won't work in Snack
        mainCode = mainCode
            .replace(/from ['"]@\/[^'"]+['"]/g, "from 'react-native'")
            .replace(/from ['"]\.\.\/[^'"]+['"]/g, "from 'react-native'")
            .replace(/from ['"]\.\/[^'"]+['"]/g, "from 'react-native'");

        // Create a simple wrapper if the code doesn't export default
        if (!mainCode.includes('export default')) {
            mainCode = `
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>${appName}</Text>
      <Text style={styles.subtitle}>App Preview</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});
`;
        }

        // Encode for Snack URL
        const encodedCode = encodeURIComponent(mainCode);
        const url = `https://snack.expo.dev/embedded/@snack/sdk-51?platform=web&name=${encodeURIComponent(appName)}&theme=dark&preview=true&hideQueryParams=true&code=${encodedCode}`;

        setSnackUrl(url);
        setIsLoading(true);
    }, [files, appName]);

    if (!snackUrl || files.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-3xl">
                <div className="text-center text-gray-400">
                    <span className="text-5xl block mb-4">📱</span>
                    <p>Your app will appear here</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            {/* Phone frame */}
            <div className="w-[300px] h-[600px] bg-gray-900 rounded-[45px] p-3 shadow-2xl mx-auto">
                <div className="w-full h-full bg-black rounded-[35px] overflow-hidden relative">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20"></div>

                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-400 text-sm">Loading live preview...</p>
                                <p className="text-gray-500 text-xs mt-1">This runs actual code!</p>
                            </div>
                        </div>
                    )}

                    {/* Snack iframe - REAL CODE EXECUTION */}
                    <iframe
                        ref={iframeRef}
                        src={snackUrl}
                        onLoad={() => setIsLoading(false)}
                        className="w-full h-full border-0"
                        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
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
