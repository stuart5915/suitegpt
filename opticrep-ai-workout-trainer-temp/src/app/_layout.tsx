import '../global.css';

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RootLayoutNav() {
    const { isAuthenticated, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const [isNavigationReady, setIsNavigationReady] = useState(false);

    useEffect(() => {
        // Small delay to ensure navigation is ready
        const timer = setTimeout(() => setIsNavigationReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isNavigationReady || isLoading) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!isAuthenticated && !inAuthGroup) {
            // Redirect to auth if not authenticated
            router.replace('/auth');
        } else if (isAuthenticated && inAuthGroup) {
            // Redirect to main app if authenticated
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, isLoading, segments, isNavigationReady, router]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#000000', flex: 1 },
                animation: 'fade',
            }}
        />
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.container}>
                <StatusBar style="light" />
                <AuthProvider>
                    <RootLayoutNav />
                </AuthProvider>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#09090b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#a1a1aa',
        marginTop: 12,
        fontSize: 16,
    },
});

