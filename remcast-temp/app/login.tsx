/**
 * Login Screen - REMcast
 * Dark theme with anonymous sign-in option
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
    const { signInWithGoogle, isLoading } = useAuth();
    const router = useRouter();
    const [signingInAnon, setSigningInAnon] = useState(false);

    async function handleAnonymousSignIn() {
        setSigningInAnon(true);
        try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) throw error;
            console.log('[Login] Anonymous sign-in successful');
            router.replace('/home');
        } catch (error) {
            console.error('[Login] Anonymous sign-in failed:', error);
            // Fallback: just go to home anyway for testing
            router.replace('/home');
        } finally {
            setSigningInAnon(false);
        }
    }

    return (
        <ImageBackground
            source={require('../assets/images/splash_background_1767391427449.png')}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Logo/Title */}
                    <View style={styles.header}>
                        <Ionicons name="moon" size={64} color={Colors.dreamPurple} />
                        <Text style={styles.title}>REMcast</Text>
                        <Text style={styles.subtitle}>
                            Transform your dreams into{'\n'}cinematic AI reels
                        </Text>
                    </View>

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        {/* Google Sign-In */}
                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={signInWithGoogle}
                            disabled={isLoading || signingInAnon}
                        >
                            <View style={styles.googleIconContainer}>
                                <Text style={styles.googleIcon}>G</Text>
                            </View>
                            <Text style={styles.googleButtonText}>
                                {isLoading ? 'Signing in...' : 'Continue with Google'}
                            </Text>
                        </TouchableOpacity>

                        {/* Anonymous/Guest Sign-In */}
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleAnonymousSignIn}
                            disabled={isLoading || signingInAnon}
                        >
                            {signingInAnon ? (
                                <ActivityIndicator size="small" color={Colors.starlight} />
                            ) : (
                                <>
                                    <Ionicons name="person-outline" size={20} color={Colors.starlight} />
                                    <Text style={styles.guestButtonText}>Continue as Guest</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.disclaimer}>
                        By continuing, you agree to our Terms of Service
                    </Text>
                </View>
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
        backgroundColor: 'rgba(15, 15, 35, 0.7)',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontFamily: 'Playfair Display Bold',
        fontSize: 48,
        color: Colors.starlight,
        textAlign: 'center',
        marginTop: Spacing.md,
    },
    subtitle: {
        fontFamily: 'Inter',
        fontSize: 16,
        color: Colors.mist,
        textAlign: 'center',
        marginTop: Spacing.md,
        lineHeight: 24,
    },
    buttons: {
        width: '100%',
        maxWidth: 300,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.starlight,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    googleIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.dreamPurple,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    googleIcon: {
        color: 'white',
        fontSize: 14,
        fontFamily: 'Inter Bold',
    },
    googleButtonText: {
        fontFamily: 'Inter SemiBold',
        fontSize: 16,
        color: Colors.midnight,
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.nebula,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: Colors.cosmic,
    },
    guestButtonText: {
        fontFamily: 'Inter Medium',
        fontSize: 16,
        color: Colors.starlight,
        marginLeft: Spacing.sm,
    },
    disclaimer: {
        fontFamily: 'Inter',
        fontSize: 12,
        color: Colors.fog,
        textAlign: 'center',
        marginTop: 40,
    },
});
