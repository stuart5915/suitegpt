import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/theme';

export default function Index() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthAndPlan();
    }, [isAuthenticated, authLoading]);

    async function checkAuthAndPlan() {
        // Wait for auth to finish loading
        if (authLoading) {
            return;
        }

        setLoading(true);

        try {
            // Check if user is authenticated
            if (!isAuthenticated) {
                router.replace('/login');
                return;
            }

            // User is authenticated - go to home screen
            router.replace('/home');


        } catch (error) {
            console.error('Error checking auth status:', error);
            // Default to login if there's an error
            router.replace('/login');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={Colors.gold} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
