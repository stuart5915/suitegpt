import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
    const { signInWithGoogle, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [isSigningIn, setIsSigningIn] = useState(false);

    // Auto-navigate when auth state changes (OAuth redirect fix - backup)
    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/home');
        }
    }, [isAuthenticated]);

    // Handle sign-in with direct navigation on success
    const handleSignIn = async () => {
        setIsSigningIn(true);
        try {
            const success = await signInWithGoogle();
            if (success) {
                // Navigate immediately - don't wait for state propagation
                router.replace('/home');
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Background gradient */}
            <View style={styles.background}>
                <View style={styles.content}>
                    {/* Title */}
                    <Text style={styles.title}>Cheshbon{'\n'}Reflections</Text>

                    {/* Subtitle */}
                    <Text style={styles.subtitle}>
                        A sacred space for your daily{'\n'}journey through the Word.
                    </Text>

                    {/* Google Sign-In Button */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={handleSignIn}
                        disabled={isLoading || isSigningIn}
                    >
                        {isSigningIn ? (
                            <ActivityIndicator size="small" color={Colors.gold} />
                        ) : (
                            <>
                                <View style={styles.googleIconContainer}>
                                    <Text style={styles.googleIcon}>G</Text>
                                </View>
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Temporary: Skip for Testing */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => router.replace('/setup')}
                    >
                        <Text style={styles.skipButtonText}>Skip for now (Testing)</Text>
                    </TouchableOpacity>

                    {/* Decorative element at bottom */}
                    <View style={styles.decorativeBottom} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        flex: 1,
        backgroundColor: '#F5F2ED', // Cream background
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    title: {
        fontFamily: 'Playfair Display Bold',
        fontSize: 44,
        color: Colors.gold,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 52,
    },
    subtitle: {
        fontFamily: 'Inter',
        fontSize: 16,
        color: '#2C2C2C',
        textAlign: 'center',
        marginBottom: 48,
        lineHeight: 24,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: Colors.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        minWidth: 280,
        justifyContent: 'center',
    },
    googleIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    googleIcon: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Inter Bold',
    },
    googleButtonText: {
        fontFamily: 'Inter Medium',
        fontSize: 16,
        color: Colors.gold,
    },
    skipButton: {
        marginTop: 16,
        paddingVertical: 12,
    },
    skipButtonText: {
        fontFamily: 'Inter',
        fontSize: 14,
        color: Colors.mediumGray,
        textAlign: 'center',
    },
    decorativeBottom: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        height: 120,
        backgroundColor: '#E8D5A0',
        opacity: 0.3,
        borderRadius: 60,
        transform: [{ scaleX: 1.2 }],
    },
});
