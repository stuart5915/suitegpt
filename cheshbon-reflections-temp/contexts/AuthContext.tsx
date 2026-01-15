import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signInWithGoogle: () => Promise<boolean>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    signInWithGoogle: async () => false,
    signOut: async () => { },
    refreshUser: async () => { },
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session and validate with server
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                // If we have a user, get the session too to have the token
                supabase.auth.getSession().then(({ data: { session } }) => {
                    setSession(session);
                    setUser(user); // Use the fresh user object from server
                    setIsLoading(false);
                });
            } else {
                setSession(null);
                setUser(null);
                setIsLoading(false);
            }
        }).catch(() => {
            // Fallback to local session if network fails
            supabase.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);
            });
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            // Properly generate redirect URI for Expo
            const redirectUrl = Platform.OS === 'web'
                ? makeRedirectUri({ path: 'auth/callback' })
                : 'cheshbon://auth/callback';

            console.log('=== OAuth Debug ===');
            console.log('Redirect URL:', redirectUrl);
            console.log('Platform:', Platform.OS);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: Platform.OS !== 'web',
                },
            });

            if (error) {
                console.error('Supabase OAuth error:', error);
                alert(`Sign-in error: ${error.message}`);
                return false;
            }

            console.log('OAuth URL:', data?.url);

            // For web, the redirect happens automatically
            // For mobile, we need to open the browser
            if (Platform.OS !== 'web' && data?.url) {
                console.log('Opening auth session...');
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl
                );

                console.log('Auth session result:', result);

                if (result.type === 'success' && 'url' in result) {
                    // Extract the session from the URL hash (not query params)
                    const url = new URL(result.url);
                    const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove the # and parse

                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    console.log('Extracted tokens:', {
                        hasAccessToken: !!accessToken,
                        hasRefreshToken: !!refreshToken
                    });

                    if (accessToken && refreshToken) {
                        // Set the session manually
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        console.log('Session set successfully!');
                        return true; // Signal success to caller
                    } else {
                        console.error('No tokens in redirect URL');
                        alert('Sign-in failed: No authentication tokens received');
                    }
                } else if (result.type === 'cancel') {
                    console.log('User cancelled sign-in');
                } else {
                    console.error('Unexpected result type:', result.type);
                    alert(`Sign-in failed: ${result.type}`);
                }
            }
        } catch (error) {
            console.error('Error signing in with Google:', error);
            alert(`Sign-in error: ${error}`);
        }
        return false; // Default to failure
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
    };

    const refreshUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
        }
    };

    const value = {
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        signInWithGoogle,
        signOut,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
