import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

const features = [
    { icon: '📰', label: 'DeFi News' },
    { icon: '📚', label: 'Learn Crypto' },
    { icon: '💬', label: 'Expert Help' },
];

export default function LoginScreen() {
    const { signInWithGoogle, signInDevMode, loading } = useAuth();
    const [signingIn, setSigningIn] = React.useState(false);

    const handleGoogleSignIn = async () => {
        try {
            setSigningIn(true);
            await signInWithGoogle();
        } catch (error) {
            console.error('Sign in error:', error);
        } finally {
            setSigningIn(false);
        }
    };

    const handleDevSignIn = () => {
        signInDevMode();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Logo Section */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.logoSection}>
                    <Text style={styles.logoEmoji}>💹</Text>
                    <Text style={styles.title}>DeFi Knowledge</Text>
                    <Text style={styles.subtitle}>Your gateway to decentralized finance</Text>
                </Animated.View>

                {/* Features */}
                <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.features}>
                    {features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                            <Text style={styles.featureIcon}>{feature.icon}</Text>
                            <Text style={styles.featureLabel}>{feature.label}</Text>
                        </View>
                    ))}
                </Animated.View>

                {/* Sign In Buttons */}
                <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.buttonContainer}>
                    {/* Google Button - will work in production */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={handleGoogleSignIn}
                        disabled={signingIn}
                        activeOpacity={0.8}
                    >
                        {signingIn ? (
                            <ActivityIndicator color="#1f1f1f" />
                        ) : (
                            <>
                                <FontAwesome name="google" size={20} color="#EA4335" />
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Dev Mode Button - for Expo Go testing */}
                    <TouchableOpacity
                        style={styles.devButton}
                        onPress={handleDevSignIn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.devButtonEmoji}>🧪</Text>
                        <Text style={styles.devButtonText}>Dev Mode (Skip Auth)</Text>
                    </TouchableOpacity>

                    <Text style={styles.terms}>
                        By signing in, you agree to learn DeFi responsibly 🚀
                    </Text>

                    <Text style={styles.devNote}>
                        💡 Google Sign-In opens a web browser. Dev Mode skips auth for testing.
                    </Text>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing['2xl'],
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: Spacing['3xl'],
    },
    logoEmoji: {
        fontSize: 80,
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: Typography.fontSize['3xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    features: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.lg,
        marginBottom: Spacing['3xl'],
    },
    featureItem: {
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    featureIcon: {
        fontSize: 28,
        marginBottom: Spacing.xs,
    },
    featureLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
    },
    buttonContainer: {
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    googleButton: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        backgroundColor: '#ffffff',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing['2xl'],
        borderRadius: BorderRadius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: Spacing.md,
    },
    googleButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#1f1f1f',
    },
    devButton: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surface,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
    },
    devButtonEmoji: {
        fontSize: 18,
    },
    devButtonText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.primary,
    },
    terms: {
        marginTop: Spacing['2xl'],
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
    },
    devNote: {
        marginTop: Spacing.md,
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
