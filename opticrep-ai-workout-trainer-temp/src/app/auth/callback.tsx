import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // On web, Supabase passes tokens in the URL hash
                // Give Supabase a moment to process the URL hash
                await new Promise(resolve => setTimeout(resolve, 500));

                // Check if we have a session now
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session error:', sessionError);
                    setError(sessionError.message);
                    return;
                }

                if (session) {
                    if (__DEV__) console.log('Auth successful, redirecting to app');
                    router.replace('/(tabs)');
                } else {
                    // No session - might need more time for auth state
                    if (typeof window !== 'undefined' && window.location.hash) {
                        if (__DEV__) console.log('Hash detected, waiting for auth state change...');
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const { data: { session: retrySession } } = await supabase.auth.getSession();
                        if (retrySession) {
                            router.replace('/(tabs)');
                            return;
                        }
                    }

                    if (__DEV__) console.log('No session found, redirecting to auth');
                    router.replace('/auth');
                }
            } catch (err: any) {
                console.error('Auth callback error:', err);
                setError(err.message || 'Authentication failed');
            }
        };

        handleCallback();
    }, [router]);

    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Error: {error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.text}>Completing sign in...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#a1a1aa',
        marginTop: 16,
    },
    errorText: {
        color: '#ef4444',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
});
