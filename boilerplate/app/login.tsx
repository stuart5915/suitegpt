/**
 * Login Screen
 * Auto-detects Telegram user from SUITE Shell and navigates to app
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { getTelegramUser } from '../contexts/TelegramAuthContext';
import { APP_NAME } from '../config/features';

export default function LoginScreen() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkExistingLogin();
    }, []);

    const checkExistingLogin = () => {
        if (typeof window !== 'undefined') {
            // Check for Telegram user from SUITE Shell
            const telegramUser = getTelegramUser();
            if (telegramUser && telegramUser.id) {
                router.replace('/(tabs)/' as any);
                return;
            }
        }
        setLoading(false);
    };

    const handleGuestMode = () => {
        router.replace('/(tabs)/' as any);
    };

    if (loading) {
        return (
            <LinearGradient colors={['#0A0A1A', '#1a1a2e', '#0A0A1A']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#ff9500" />
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#0A0A1A', '#1a1a2e', '#0A0A1A']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.emoji}>🚀</Text>
                        <Text style={styles.title}>{APP_NAME}</Text>
                        <Text style={styles.subtitle}>Powered by SUITE</Text>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.guestButton} onPress={handleGuestMode}>
                            <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        </TouchableOpacity>
                        <Text style={styles.hint}>Open in SUITE Shell to use credits</Text>
                    </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 100, paddingBottom: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 16 },
    header: { alignItems: 'center' },
    emoji: { fontSize: 80, marginBottom: 16 },
    title: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    buttonContainer: { gap: 12 },
    guestButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ff9500',
        borderRadius: 12,
        padding: 18,
    },
    guestButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    hint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});
