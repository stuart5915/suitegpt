import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { Alert } from 'react-native';

// Required for web browser auth
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    isDevMode: boolean;
    signInWithGoogle: () => Promise<void>;
    signInDevMode: () => void;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Protected route logic
function useProtectedRoute(user: User | null, isDevMode: boolean, loading: boolean) {
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const isAuthenticated = user || isDevMode;

        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/(auth)/login');
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(app)/(tabs)');
        }
    }, [user, isDevMode, loading, segments]);
}

type AuthProviderProps = {
    children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDevMode, setIsDevMode] = useState(false);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    useEffect(() => {
        // Very short timeout to ensure UI is interactive quickly
        // Auth will continue in background if needed
        const loadingTimeout = setTimeout(() => {
            if (loading) {
                console.warn('⚠️ Auth loading timeout - UI now interactive');
                setLoading(false);
            }
        }, 1500); // 1.5 second timeout - faster startup

        // Race condition: get session but don't block UI for too long
        const sessionPromise = supabase.auth.getSession();

        sessionPromise.then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // Fetch profile in background, don't block
                fetchProfile(session.user.id);
            }
            setLoading(false);
        }).catch((error) => {
            console.error('❌ Auth session error:', error);
            setLoading(false); // Don't hang on error
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                console.log('🔐 Auth state changed:', _event);
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            clearTimeout(loadingTimeout);
            subscription.unsubscribe();
        };
    }, []);

    // Handle deep link callback from OAuth
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            console.log('🔐 Deep link received:', event.url);

            if (event.url.includes('access_token')) {
                try {
                    // Parse tokens from URL hash
                    const url = new URL(event.url);
                    const hashParams = new URLSearchParams(url.hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        console.log('🔐 Setting session from deep link tokens...');
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (error) {
                            console.error('Session error:', error);
                            Alert.alert('Sign-In Error', 'Failed to complete sign-in');
                        } else {
                            console.log('🎉 Successfully signed in via deep link!');
                        }
                    }
                } catch (error) {
                    console.error('Deep link error:', error);
                }
            }
        };

        // Listen for incoming deep links
        const linkSubscription = Linking.addEventListener('url', handleDeepLink);

        // Also check if app was opened with a deep link
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink({ url });
            }
        });

        return () => linkSubscription.remove();
    }, []);

    // Dev mode sign in (skips OAuth for testing)
    const signInDevMode = () => {
        console.log('🧪 Signing in with Dev Mode');
        setIsDevMode(true);
        // Create a mock profile for dev mode
        setProfile({
            id: 'dev-user',
            full_name: 'Dev User',
            avatar_url: null,
            interests: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    };

    // Real Google Sign In using Supabase OAuth
    const signInWithGoogle = async () => {
        try {
            console.log('🔐 Starting Google Sign-In...');

            // Use app's deep link scheme - this redirects directly back to the app
            const redirectUrl = 'defiknowledge://auth/callback';
            console.log('🔐 Redirect URL:', redirectUrl);

            // Get the OAuth URL from Supabase
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                console.error('OAuth error:', error);
                Alert.alert('Sign-In Error', error.message);
                return;
            }

            if (data?.url) {
                console.log('🔐 Supabase OAuth URL:', data.url);
                console.log('🔐 Opening browser for auth...');

                // Open in regular Safari - will redirect back via deep link
                await Linking.openURL(data.url);
                console.log('🔐 Browser opened - sign in with Google, then return to the app');
            }
        } catch (error: any) {
            console.error('Sign in error:', error);
            Alert.alert('Sign-In Error', error?.message || 'An error occurred');
        }
    };

    const signOut = async () => {
        try {
            if (isDevMode) {
                setIsDevMode(false);
                setProfile(null);
                return;
            }
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            setProfile(null);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    useProtectedRoute(user, isDevMode, loading);

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                profile,
                loading,
                isDevMode,
                signInWithGoogle,
                signInDevMode,
                signOut,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

