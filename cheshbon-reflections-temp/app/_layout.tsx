import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    // Skip custom font loading - use system fonts for web compatibility
    const [fontsLoaded, setFontsLoaded] = useState(false);

    useEffect(() => {
        // Initialize database only on native platforms (not web)
        // Web will use Supabase exclusively
        if (Platform.OS !== 'web') {
            import('../services/database').then(({ initializeDatabase }) => {
                initializeDatabase().finally(() => {
                    setFontsLoaded(true);
                    SplashScreen.hideAsync();
                });
            });
        } else {
            setFontsLoaded(true);
            SplashScreen.hideAsync();
        }
    }, []);

    if (!fontsLoaded) {
        return null;
    }


    return (
        <ThemeProvider>
            <AuthProvider>
                <NotificationsProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: '#F5F2ED' },
                        }}
                    >
                        {/* Main tab screens - no animation */}
                        <Stack.Screen name="home" options={{ animation: 'none' }} />
                        <Stack.Screen name="bible" options={{ animation: 'none' }} />
                        <Stack.Screen name="setup" options={{ animation: 'none' }} />
                        <Stack.Screen name="journal" options={{ animation: 'none' }} />
                        <Stack.Screen name="notifications" options={{ animation: 'none' }} />
                        <Stack.Screen name="edification" options={{ animation: 'none' }} />
                        <Stack.Screen name="daily" options={{ animation: 'none' }} />
                        <Stack.Screen name="journey" options={{ animation: 'none' }} />
                        <Stack.Screen name="profile" options={{ animation: 'none' }} />

                        {/* Other screens can keep default animation */}
                        <Stack.Screen name="login" options={{ animation: 'fade' }} />
                        <Stack.Screen name="index" options={{ animation: 'fade' }} />
                    </Stack>
                </NotificationsProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
