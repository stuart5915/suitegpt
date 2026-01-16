import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

// Discord OAuth config
const DISCORD_CLIENT_ID = '1311757088540311633';

interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
    email?: string;
}

export default function LoginScreen() {
    const [loading, setLoading] = useState(true);
    const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);

    // Check if already logged in on mount
    useEffect(() => {
        checkExistingLogin();
    }, []);

    const checkExistingLogin = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            // Check localStorage for existing Discord session
            const stored = localStorage.getItem('suiteDev');
            if (stored) {
                try {
                    const user = JSON.parse(stored);
                    if (user && user.id) {
                        setDiscordUser(user);
                        // Auto-navigate to app
                        router.replace('/(tabs)/' as any);
                        return;
                    }
                } catch (e) {
                    console.error('Failed to parse stored user:', e);
                }
            }

            // Check URL for OAuth callback (code parameter)
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                handleDiscordCallback(code);
                return;
            }
        }
        setLoading(false);
    };

    // Handle Discord OAuth callback (from URL code param)
    const handleDiscordCallback = async (code: string) => {
        setLoading(true);
        try {
            // For apps deployed to subdomains, we use the main site's oauth-callback
            // which handles the code exchange and returns user info
            // For now, redirect to main site oauth flow
            const mainSiteCallback = 'https://stuarthollinger.com/oauth-callback.html';

            // Clean up URL and show login (user should use popup flow)
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(false);
        } catch (error) {
            console.error('Discord OAuth error:', error);
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(false);
        }
    };

    // Detect if mobile browser
    const isMobile = () => {
        if (typeof navigator === 'undefined') return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    // Initiate Discord OAuth
    const handleDiscordLogin = () => {
        if (Platform.OS !== 'web') {
            alert('Discord login is only available on web');
            return;
        }

        // Use main site's oauth-callback.html for Discord OAuth
        // Add state param to tell oauth-callback where to redirect after login
        const redirectUri = 'https://getsuite.app/oauth-callback.html';
        const scope = 'identify';
        const state = encodeURIComponent('/foodvitals/'); // Where to go after auth
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;

        // On mobile, use redirect flow (popups don't work well)
        if (isMobile()) {
            // Store that we're doing auth so we know to check on return
            sessionStorage.setItem('discord_auth_pending', 'true');
            // Redirect the whole page to Discord
            window.location.href = authUrl;
            return;
        }

        // On desktop, use popup flow
        const popup = window.open(authUrl, 'Discord Login', 'width=500,height=700');

        // Listen for the callback message from popup
        const handleAuthMessage = (event: MessageEvent) => {
            // Accept messages from main site
            if (!event.origin.includes('stuarthollinger.com') && event.origin !== window.location.origin) {
                return;
            }
            if (event.data && event.data.type === 'discord-auth-success') {
                const user = event.data.user;
                localStorage.setItem('suiteDev', JSON.stringify(user));
                setDiscordUser(user);
                popup?.close();
                window.removeEventListener('message', handleAuthMessage);
                // Navigate to app
                router.replace('/(tabs)/' as any);
            }
        };

        window.addEventListener('message', handleAuthMessage);

        // Fallback: Check localStorage periodically in case message fails
        const checkInterval = setInterval(() => {
            const stored = localStorage.getItem('suiteDev');
            if (stored) {
                try {
                    const user = JSON.parse(stored);
                    if (user && user.id && !discordUser) {
                        setDiscordUser(user);
                        clearInterval(checkInterval);
                        popup?.close();
                        router.replace('/(tabs)/' as any);
                    }
                } catch (e) {}
            }
        }, 1000);

        // Clean up after 2 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            window.removeEventListener('message', handleAuthMessage);
        }, 120000);
    };

    // Guest mode - skip auth
    const handleGuestMode = () => {
        router.replace('/(tabs)/' as any);
    };

    // Show loading while checking auth
    if (loading) {
        return (
            <LinearGradient colors={['#0A0A1A', '#1a472a', '#0A0A1A']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4ADE80" />
                        <Text style={styles.loadingText}>Checking login...</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#0A0A1A', '#1a472a', '#0A0A1A']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Logo/Title */}
                    <View style={styles.header}>
                        <Text style={styles.emoji}>🥗</Text>
                        <Text style={styles.title}>FoodVitals AI</Text>
                        <Text style={styles.subtitle}>
                            AI-powered nutrition tracking made simple
                        </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.features}>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>📸</Text>
                            <Text style={styles.featureText}>Snap a photo or type what you ate</Text>
                        </View>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>🤖</Text>
                            <Text style={styles.featureText}>AI calculates calories & macros</Text>
                        </View>
                        <View style={styles.feature}>
                            <Text style={styles.featureIcon}>📊</Text>
                            <Text style={styles.featureText}>Weekly insights & recommendations</Text>
                        </View>
                    </View>

                    {/* Sign In Buttons */}
                    <View style={styles.buttonContainer}>
                        {/* Primary: Discord Login */}
                        <TouchableOpacity
                            style={styles.discordButton}
                            onPress={handleDiscordLogin}
                        >
                            <View style={styles.discordIcon}>
                                <Text style={styles.discordIconText}>🎮</Text>
                            </View>
                            <Text style={styles.discordButtonText}>Login with Discord</Text>
                        </TouchableOpacity>

                        <Text style={styles.discordHint}>
                            Login with Discord to use SUITE credits for AI features
                        </Text>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleGuestMode}
                        >
                            <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        </TouchableOpacity>

                        <Text style={styles.guestHint}>
                            Free features work without login. AI features require credits.
                        </Text>

                        <Text style={styles.disclaimer}>
                            By continuing, you agree to our Terms of Service
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 16,
        fontSize: 16,
    },
    header: {
        alignItems: 'center',
    },
    emoji: { fontSize: 80, marginBottom: 16 },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    features: {
        gap: 16,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    featureIcon: { fontSize: 24, marginRight: 16 },
    featureText: {
        fontSize: 16,
        color: '#fff',
        flex: 1,
    },
    buttonContainer: {
        gap: 12,
    },
    discordButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#5865F2',
        borderRadius: 12,
        padding: 18,
        gap: 12,
    },
    discordIcon: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discordIconText: {
        fontSize: 20,
    },
    discordButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    discordHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    guestButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    guestButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    guestHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
    },
    disclaimer: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginTop: 8,
    },
});
