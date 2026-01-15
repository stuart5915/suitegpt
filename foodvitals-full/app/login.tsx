import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { router } from 'expo-router';
import { connectWallet, getCurrentUser, SuiteUser } from '../services/suiteAuth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [loading, setLoading] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [walletUser, setWalletUser] = useState<SuiteUser | null>(null);

    // Handle wallet connection
    const handleWalletConnect = async () => {
        setLoading(true);
        try {
            const user = await connectWallet();
            if (user) {
                setWalletUser(user);
                // Navigate to main app - wallet acts as auth
                router.replace('/(tabs)/' as any);
            }
        } catch (error: any) {
            console.error('Wallet connection failed:', error);
            Alert.alert('Connection Failed', error.message || 'Could not connect wallet');
        } finally {
            setLoading(false);
        }
    };

    // Check if wallet already connected
    useEffect(() => {
        getCurrentUser().then((user) => {
            if (user) {
                setWalletUser(user);
                router.replace('/(tabs)/' as any);
            }
        });
    }, []);

    // Check if already logged in
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                router.replace('/(tabs)/' as any);
            }
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            if (event === 'SIGNED_IN' && session) {
                router.replace('/(tabs)/' as any);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Handle deep links for OAuth callback
    useEffect(() => {
        const handleUrl = async (event: { url: string }) => {
            console.log('Deep link received:', event.url);
            await handleAuthRedirect(event.url);
        };

        const subscription = Linking.addEventListener('url', handleUrl);

        // Check if app was opened via deep link
        Linking.getInitialURL().then((url) => {
            if (url) handleAuthRedirect(url);
        });

        return () => subscription.remove();
    }, []);

    const handleAuthRedirect = async (url: string) => {
        if (!url.includes('access_token') && !url.includes('refresh_token')) {
            return;
        }

        try {
            const hashPart = url.split('#')[1];
            if (hashPart) {
                const params = new URLSearchParams(hashPart);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (!error) {
                        router.replace('/(tabs)/' as any);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling auth redirect:', error);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            const redirectUri = makeRedirectUri({
                scheme: 'foodvitals',
                path: 'auth/callback',
            });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUri,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUri,
                    { showInRecents: true, preferEphemeralSession: false }
                );

                if (result.type === 'success' && result.url) {
                    await handleAuthRedirect(result.url);
                }
            }
        } catch (error: any) {
            console.error('Error signing in:', error);
            Alert.alert('Sign In Error', error.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    // Email + Password Sign In
    const handleEmailPasswordSignIn = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            if (data.session) {
                router.replace('/(tabs)/' as any);
            }
        } catch (error: any) {
            console.error('Sign in error:', error);
            Alert.alert('Sign In Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Email + Password Sign Up
    const handleEmailPasswordSignUp = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            if (data.session) {
                // Signed up and logged in automatically
                router.replace('/(tabs)/' as any);
            } else {
                // Email confirmation required
                Alert.alert(
                    'Check your email! 📧',
                    'We sent you a confirmation link. Click it to complete sign up.',
                );
            }
        } catch (error: any) {
            console.error('Sign up error:', error);
            Alert.alert('Sign Up Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Guest mode - skip auth for testing
    const handleGuestMode = () => {
        router.replace('/(tabs)/' as any);
    };

    // Email form view
    if (showEmailForm) {
        return (
            <LinearGradient colors={['#0A0A1A', '#1a472a', '#0A0A1A']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.safeArea}
                    >
                        <ScrollView contentContainerStyle={styles.formContent}>
                            <TouchableOpacity onPress={() => setShowEmailForm(false)} style={styles.backButton}>
                                <Text style={styles.backText}>← Back</Text>
                            </TouchableOpacity>

                            <View style={styles.formHeader}>
                                <Text style={styles.emoji}>🥗</Text>
                                <Text style={styles.title}>
                                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                                </Text>
                                <Text style={styles.subtitle}>
                                    {isSignUp ? 'Sign up to save your food logs' : 'Sign in to continue'}
                                </Text>
                            </View>

                            <View style={styles.formContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="#888"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#888"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoComplete="password"
                                />

                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={isSignUp ? handleEmailPasswordSignUp : handleEmailPasswordSignIn}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>
                                            {isSignUp ? 'Create Account' : 'Sign In'}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                                    <Text style={styles.switchText}>
                                        {isSignUp
                                            ? 'Already have an account? Sign In'
                                            : "Don't have an account? Sign Up"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // Main login view
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
                        {/* Primary: Wallet Connect */}
                        <TouchableOpacity
                            style={styles.walletButton}
                            onPress={handleWalletConnect}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.walletButtonText}>🔗 Connect Wallet</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setShowEmailForm(true)}
                            disabled={loading}
                        >
                            <Text style={styles.secondaryButtonText}>📧 Sign in with Email</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleGuestMode}
                            disabled={loading}
                        >
                            <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        </TouchableOpacity>

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
    emailButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        borderRadius: 12,
        padding: 16,
    },
    emailButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4285F4',
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
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
    disclaimer: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
    },
    // Email form styles
    formContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    backButton: {
        marginBottom: 20,
    },
    backText: {
        color: '#4ADE80',
        fontSize: 16,
    },
    formHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    formContainer: {
        gap: 16,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    submitButton: {
        backgroundColor: '#4ADE80',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    switchText: {
        color: '#4ADE80',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 16,
    },
    // Wallet button styles
    walletButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        padding: 18,
    },
    walletButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
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
    secondaryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
