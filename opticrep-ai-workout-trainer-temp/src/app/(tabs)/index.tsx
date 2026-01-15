import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useCallback } from 'react';

export default function HomeScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [hasProfileData, setHasProfileData] = useState(false);

    // Workout stats state
    const [weekSessions, setWeekSessions] = useState(0);
    const [totalReps, setTotalReps] = useState(0);
    const [totalWeight, setTotalWeight] = useState(0);

    // Check if user has any profile data (supplements, diet, or goals)
    useFocusEffect(
        useCallback(() => {
            const checkProfileData = async () => {
                if (!user) {
                    if (__DEV__) console.log('[Home] No user, skipping profile check');
                    return;
                }

                if (__DEV__) console.log('[Home] Checking profile data for user:', user.id);

                try {
                    // Check for supplements (with user_id filter)
                    const { data: supps, error: suppsError } = await (supabase as any)
                        .from('user_supplements')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .limit(1);

                    if (__DEV__) console.log('[Home] Supplements check:', supps?.length || 0, 'found', suppsError ? `Error: ${suppsError.message}` : '');

                    if (supps && supps.length > 0) {
                        if (__DEV__) console.log('[Home] Has supplements - hiding Setup Profile');
                        setHasProfileData(true);
                        return;
                    }

                    // Check for diet plans (user_diet_plans table with user_id filter)
                    const { data: dietPlans, error: dietError } = await (supabase as any)
                        .from('user_diet_plans')
                        .select('id, protein_grams, carb_grams, fat_grams')
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .limit(1);

                    if (__DEV__) console.log('[Home] Diet plans check:', dietPlans?.length || 0, 'found', dietError ? `Error: ${dietError.message}` : '');

                    if (dietPlans && dietPlans.length > 0) {
                        const plan = dietPlans[0];
                        if (__DEV__) console.log('[Home] Diet plan data:', plan);
                        if (plan.protein_grams > 0 || plan.carb_grams > 0 || plan.fat_grams > 0) {
                            if (__DEV__) console.log('[Home] Has diet macros - hiding Setup Profile');
                            setHasProfileData(true);
                            return;
                        }
                    }

                    // Check for profile data (goals, current weight, target weight, user notes)
                    const { data: profile, error: profileError } = await (supabase as any)
                        .from('profiles')
                        .select('primary_goal, current_weight, target_weight, weekly_workout_target, user_notes')
                        .eq('id', user.id)
                        .single();

                    if (__DEV__) console.log('[Home] Profile check:', profile, profileError ? `Error: ${profileError.message}` : '');

                    if (profile) {
                        // If any of these fields are filled, user has setup data
                        const hasData = profile.primary_goal ||
                            profile.current_weight ||
                            profile.target_weight ||
                            (profile.user_notes && profile.user_notes.length > 0);

                        if (__DEV__) console.log('[Home] Profile hasData:', !!hasData, '- primary_goal:', profile.primary_goal, 'current_weight:', profile.current_weight, 'target_weight:', profile.target_weight);
                        setHasProfileData(!!hasData);
                    }
                } catch (error) {
                    console.error('[Home] Error checking profile data:', error);
                }
            };

            // Fetch workout stats (all time)
            const fetchWorkoutStats = async () => {
                if (!user) return;

                try {
                    // Fetch all sessions from Supabase (all time, not just this week)
                    const { data: sessions, error } = await (supabase as any)
                        .from('workout_sessions')
                        .select('id, total_reps, total_volume, exercises_data, created_at')
                        .eq('user_id', user.id);

                    if (__DEV__) console.log('[Home] Workout sessions query result:', sessions?.length || 0, 'sessions', error ? `Error: ${error.message}` : '');

                    if (error) {
                        if (__DEV__) console.log('[Home] Error fetching workout stats:', error.message);
                        return;
                    }

                    if (sessions && sessions.length > 0) {
                        if (__DEV__) console.log('[Home] Found', sessions.length, 'workout sessions');
                        // Count sessions
                        setWeekSessions(sessions.length);

                        // Calculate total reps and weight from the stored data
                        let reps = 0;
                        let weight = 0;

                        sessions.forEach((session: any) => {
                            // Add total_reps if available
                            if (session.total_reps) {
                                reps += session.total_reps;
                            }

                            // Add total_volume (weight lifted) if available
                            if (session.total_volume) {
                                weight += session.total_volume;
                            }

                            // Also try parsing exercises_data if available
                            if (session.exercises_data && Array.isArray(session.exercises_data)) {
                                session.exercises_data.forEach((exercise: any) => {
                                    if (exercise.sets && Array.isArray(exercise.sets)) {
                                        exercise.sets.forEach((set: any) => {
                                            const setReps = parseInt(set.reps) || 0;
                                            const setWeight = parseFloat(set.weight) || 0;
                                            // Only add to weight if not already counted in total_volume
                                            if (!session.total_volume) {
                                                weight += setReps * setWeight;
                                            }
                                        });
                                    }
                                });
                            }
                        });

                        if (__DEV__) console.log('[Home] Calculated stats - reps:', reps, 'weight:', weight);
                        setTotalReps(reps);
                        setTotalWeight(Math.round(weight));
                    } else {
                        if (__DEV__) console.log('[Home] No workout sessions found');
                    }
                } catch (error) {
                    console.error('[Home] Error fetching workout stats:', error);
                }
            };

            checkProfileData();
            fetchWorkoutStats();
        }, [user])
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.welcomeText}>Welcome back</Text>
                            <Text style={styles.title}>OpticRep</Text>
                        </View>
                        <Pressable style={styles.profileButton} onPress={() => router.push('/profile')}>
                            <Text style={styles.profileInitial}>
                                {user?.email?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </Pressable>
                    </View>
                    {user?.email && (
                        <Text style={styles.userEmail}>{user.email}</Text>
                    )}
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>

                    <Link href="/(tabs)/workout" asChild>
                        <Pressable style={styles.actionCard}>
                            <View style={styles.actionRow}>
                                <Text style={styles.actionEmoji}>💪</Text>
                                <View style={styles.actionContent}>
                                    <Text style={styles.actionTitle}>Start Workout</Text>
                                    <Text style={styles.actionSubtitle}>Begin your AI-tracked session</Text>
                                </View>
                                <Text style={styles.actionArrow}>→</Text>
                            </View>
                        </Pressable>
                    </Link>

                    <Link href="/(tabs)/coach" asChild>
                        <Pressable style={styles.actionCard}>
                            <View style={styles.actionRow}>
                                <Text style={styles.actionEmoji}>🧠</Text>
                                <View style={styles.actionContent}>
                                    <Text style={styles.actionTitle}>Ask Pro-Coach</Text>
                                    <Text style={styles.actionSubtitle}>Get personalized advice</Text>
                                </View>
                                <Text style={[styles.actionArrow, { color: '#22d3ee' }]}>→</Text>
                            </View>
                        </Pressable>
                    </Link>

                    {!hasProfileData && (
                        <Pressable
                            style={[styles.actionCard, styles.setupCard]}
                            onPress={() => router.push('/(tabs)/coach?setup=1')}
                        >
                            <View style={styles.actionRow}>
                                <Text style={styles.actionEmoji}>⚡</Text>
                                <View style={styles.actionContent}>
                                    <Text style={styles.actionTitle}>Setup Profile</Text>
                                    <Text style={styles.actionSubtitle}>Help AI coach know you better</Text>
                                </View>
                                <Text style={[styles.actionArrow, { color: '#f59e0b' }]}>→</Text>
                            </View>
                        </Pressable>
                    )}
                </View>

                {/* Stats Preview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Stats</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Workouts</Text>
                            <Text style={styles.statValue}>{weekSessions}</Text>
                            <Text style={styles.statUnit}>sessions</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Total Reps</Text>
                            <Text style={styles.statValue}>{totalReps > 999 ? `${(totalReps / 1000).toFixed(1)}k` : totalReps}</Text>
                            <Text style={styles.statUnit}>tracked</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Weight</Text>
                            <Text style={styles.statValue}>{totalWeight > 999 ? `${(totalWeight / 1000).toFixed(0)}k` : totalWeight}</Text>
                            <Text style={styles.statUnit}>lbs lifted</Text>
                        </View>
                    </View>
                </View>


            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0e14',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    header: {
        paddingTop: 24,
        paddingBottom: 16,
    },
    welcomeText: {
        color: '#64748b',
        fontSize: 14,
    },
    title: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: 'bold',
        marginTop: 4,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#22d3ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInitial: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userEmail: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 8,
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    actionCard: {
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1e293b',
        marginBottom: 16,
    },
    setupCard: {
        borderColor: '#f59e0b',
        backgroundColor: '#1a1608',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionEmoji: {
        fontSize: 32,
        marginRight: 16,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '600',
    },
    actionSubtitle: {
        color: '#94a3b8',
        marginTop: 4,
    },
    actionArrow: {
        color: '#7CFC00',
        fontSize: 24,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    statLabel: {
        color: '#64748b',
        fontSize: 12,
    },
    statValue: {
        color: '#7CFC00',
        fontSize: 30,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statUnit: {
        color: '#475569',
        fontSize: 10,
        marginTop: 4,
    },
    noticeCard: {
        marginTop: 32,
        marginBottom: 24,
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f59e0b',
    },
    noticeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    noticeEmoji: {
        fontSize: 20,
        marginRight: 12,
    },
    noticeContent: {
        flex: 1,
    },
    noticeTitle: {
        color: '#f59e0b',
        fontWeight: '600',
    },
    noticeText: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 4,
    },
});
