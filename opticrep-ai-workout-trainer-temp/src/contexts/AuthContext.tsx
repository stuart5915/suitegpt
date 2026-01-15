import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Required for proper OAuth redirect handling on web
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Handle deep link URL for OAuth callback
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            if (__DEV__) console.log('[Auth] Deep link received:', event.url);
            // Supabase will automatically handle the token extraction
            // via the onAuthStateChange listener above
        };

        // Listen for incoming links
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check if app was opened with a URL
        Linking.getInitialURL().then((url) => {
            if (url) {
                if (__DEV__) console.log('[Auth] Initial URL:', url);
            }
        });

        return () => subscription.remove();
    }, []);

    const signInWithGoogle = useCallback(async () => {
        if (__DEV__) console.log('[Auth] Starting Google sign-in');

        // Build the redirect URL based on the platform
        let redirectTo: string;
        if (Platform.OS === 'web') {
            redirectTo = typeof window !== 'undefined' && window.location
                ? `${window.location.origin}/auth/callback`
                : 'http://localhost:8082/auth/callback';
        } else {
            // Use expo-auth-session's redirect URI for native
            redirectTo = makeRedirectUri({
                scheme: 'opticrep',
                path: 'auth/callback',
            });

            // Check if we're in Expo Go (which doesn't support custom schemes)
            if (redirectTo.includes('localhost') || redirectTo.includes('exp://')) {
                if (__DEV__) console.log('[Auth] Detected Expo Go - OAuth requires EAS Development Build');
                throw new Error(
                    'Google Sign-In requires an EAS Development Build. ' +
                    'Please run "eas build --profile development --platform ios" to create a build ' +
                    'that supports OAuth.'
                );
            }
        }

        if (__DEV__) console.log('[Auth] Redirect URL:', redirectTo);

        // Get the OAuth URL from Supabase
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: Platform.OS !== 'web', // Don't auto-redirect on native
            },
        });

        if (error) throw error;

        // On native, open the OAuth URL in an in-app browser
        if (Platform.OS !== 'web' && data?.url) {
            if (__DEV__) console.log('[Auth] Opening OAuth URL in browser');
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo
            );

            if (__DEV__) console.log('[Auth] Browser result:', result.type);

            if (result.type === 'success' && result.url) {
                // Extract the tokens from the URL and set the session
                const url = new URL(result.url);
                const params = new URLSearchParams(url.hash.substring(1)); // Remove the #
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    if (__DEV__) console.log('[Auth] Setting session from tokens');
                    await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });
                }
            }
        }
    }, []);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    }, []);

    const signUpWithEmail = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, []);

    const value: AuthContextType = {
        user,
        session,
        isLoading,
        isAuthenticated: !!session,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
