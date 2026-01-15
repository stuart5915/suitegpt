import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    // On web, skip custom font loading - use system fonts
    // On native, we could load custom fonts but for now use system fonts everywhere
    const [fontsLoaded, setFontsLoaded] = useState(false);

    useEffect(() => {
        // On web, fonts are ready immediately (using system fonts)
        // On native, we also use system fonts for simplicity
        setFontsLoaded(true);
        SplashScreen.hideAsync();
    }, []);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ThemeProvider>
            <AuthProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: Colors.midnight },
                    }}
                >
                    {/* Main screens */}
                    <Stack.Screen name="index" options={{ animation: 'fade' }} />
                    <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                    <Stack.Screen name="login" options={{ animation: 'fade' }} />
                    <Stack.Screen name="home" options={{ animation: 'none' }} />
                    <Stack.Screen name="setup" options={{ animation: 'none' }} />
                    <Stack.Screen name="journal" options={{ animation: 'none' }} />
                    <Stack.Screen name="profile" options={{ animation: 'none' }} />
                    <Stack.Screen name="dream/[id]" options={{ animation: 'slide_from_right' }} />
                </Stack>
            </AuthProvider>
        </ThemeProvider>
    );
}

