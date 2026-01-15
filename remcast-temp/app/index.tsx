/**
 * Entry Point - REMcast
 * Handles auth check and onboarding routing
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/theme';

export default function Index() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    useEffect(() => {
        checkAuthAndOnboarding();
    }, [isAuthenticated, authLoading]);

    async function checkAuthAndOnboarding() {
        if (authLoading) return;

        try {
            // Check if first time user
            const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

            if (!isAuthenticated) {
                // Show onboarding for unauthenticated users who haven't seen it
                if (!hasSeenOnboarding) {
                    router.replace('/onboarding');
                } else {
                    router.replace('/login');
                }
                return;
            }

            // Authenticated - go to home
            router.replace('/home');
        } catch (error) {
            console.error('[Index] Error:', error);
            router.replace('/login');
        }
    }

    return (
        <ImageBackground
            source={require('../assets/images/splash_background_1767391427449.png')}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay}>
                <ActivityIndicator size="large" color={Colors.dreamPurple} />
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 15, 35, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
