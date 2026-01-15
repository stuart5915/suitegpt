import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type JournalTab = 'log' | 'workouts' | 'history';

interface WorkoutSession {
    id: string;
    day_name: string;
    duration_seconds: number;
    exercises_completed: number;
    total_sets: number;
    total_reps: number;
    total_volume: number;
    created_at: string;
}

interface DailyLog {
    sleepQuality: number;
    energyLevel: number;
    gutHealth: number;
    muscleSoreness: number;
    stressLevel: number;
    motivation: number;
    hydration: number;
    notes: string;
}

// Rotating reflection prompts
const REFLECTION_PROMPTS = [
    "🔁 What's one thing you'll do differently in today's workout?",
    "🏆 What's a small win from yesterday?",
    "⚡ What's draining your energy lately?",
    "🎯 What muscle group needs extra attention?",
    "💭 Any recurring thoughts about your training?",
    "🌟 What are you most proud of this week?",
    "🔥 What's motivating you to train today?",
    "🛡️ Are you protecting your recovery time?",
];

export default function JournalScreen() {
    const [activeTab, setActiveTab] = useState<JournalTab>('log');
    const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
    const [loadingWorkouts, setLoadingWorkouts] = useState(false);
    const [dailyLog, setDailyLog] = useState<DailyLog>({
        sleepQuality: 5,
        energyLevel: 5,
        gutHealth: 5,
        muscleSoreness: 5,
        stressLevel: 5,
        motivation: 5,
        hydration: 5,
        notes: '',
    });

    // Get today's reflection prompt based on date
    const todaysPrompt = useMemo(() => {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        return REFLECTION_PROMPTS[dayOfYear % REFLECTION_PROMPTS.length];
    }, []);

    // Fetch workout sessions when tab is active
    useEffect(() => {
        if (activeTab === 'workouts') {
            fetchWorkouts();
        }
    }, [activeTab]);

    const fetchWorkouts = async () => {
        setLoadingWorkouts(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('workout_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (!error && data) {
                setWorkoutSessions(data);
            }
        } catch (e) {
            console.error('Error fetching workouts:', e);
        } finally {
            setLoadingWorkouts(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatVolume = (volume: number): string => {
        if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
        return volume.toLocaleString();
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleSaveLog = () => {
        // TODO: Save to Supabase
        if (__DEV__) console.log('Saving log:', dailyLog);
    };

    const updateLog = (key: keyof DailyLog, value: number | string) => {
        setDailyLog(prev => ({ ...prev, [key]: value }));
    };

    // Render a 1-10 scale selector
    const renderScale = (
        emoji: string,
        label: string,
        value: number,
        onChange: (val: number) => void,
        colorScheme: 'green' | 'stress' | 'reverse' = 'green'
    ) => {
        const getColor = (level: number, currentLevel: number) => {
            if (colorScheme === 'reverse') {
                // Higher is worse (soreness, stress)
                if (level > currentLevel) return '#27272a';
                if (level <= 3) return '#22c55e';
                if (level <= 6) return '#f59e0b';
                return '#ef4444';
            } else if (colorScheme === 'stress') {
                if (level > currentLevel) return '#27272a';
                if (level <= 3) return '#22c55e';
                if (level <= 6) return '#f59e0b';
                return '#ef4444';
            } else {
                // Higher is better (energy, motivation, etc)
                if (level > currentLevel) return '#27272a';
                return '#22c55e';
            }
        };

        const getValueColor = () => {
            if (colorScheme === 'reverse' || colorScheme === 'stress') {
                if (value <= 3) return '#22c55e';
                if (value <= 6) return '#f59e0b';
                return '#ef4444';
            }
            return '#22c55e';
        };

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{emoji} {label}</Text>
                    <Text style={[styles.levelValue, { color: getValueColor() }]}>
                        {value}/10
                    </Text>
                </View>
                <View style={styles.levelRow}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                        <Pressable
                            key={level}
                            onPress={() => onChange(level)}
                            style={[
                                styles.levelButton,
                                { backgroundColor: getColor(level, value) },
                            ]}
                        >
                            <Text style={styles.levelButtonText}>{level}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Daily Journal</Text>
                <Text style={styles.headerSubtitle}>Track your wellness & recovery</Text>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <Pressable
                    onPress={() => setActiveTab('log')}
                    style={[
                        styles.tab,
                        styles.tabLeft,
                        activeTab === 'log' && styles.tabActive,
                    ]}
                >
                    <Text style={[styles.tabText, activeTab === 'log' && styles.tabTextActive]}>
                        Log
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('workouts')}
                    style={[
                        styles.tab,
                        activeTab === 'workouts' && styles.tabActive,
                    ]}
                >
                    <Text style={[styles.tabText, activeTab === 'workouts' && styles.tabTextActive]}>
                        Workouts
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('history')}
                    style={[
                        styles.tab,
                        styles.tabRight,
                        activeTab === 'history' && styles.tabActive,
                    ]}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                        History
                    </Text>
                </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'log' ? (
                    <View>
                        {/* Section: Morning Check-In */}
                        <Text style={styles.sectionHeader}>☀️ Morning Check-In</Text>

                        {renderScale('😴', 'Sleep Quality', dailyLog.sleepQuality,
                            (val) => updateLog('sleepQuality', val), 'green')}

                        {renderScale('🔋', 'Energy Level', dailyLog.energyLevel,
                            (val) => updateLog('energyLevel', val), 'green')}

                        {renderScale('🫁', 'Gut Health', dailyLog.gutHealth,
                            (val) => updateLog('gutHealth', val), 'green')}

                        {renderScale('💧', 'Hydration', dailyLog.hydration,
                            (val) => updateLog('hydration', val), 'green')}

                        {/* Section: Body Status */}
                        <Text style={styles.sectionHeader}>💪 Body Status</Text>

                        {renderScale('🤕', 'Muscle Soreness', dailyLog.muscleSoreness,
                            (val) => updateLog('muscleSoreness', val), 'reverse')}

                        {renderScale('😰', 'Stress Level', dailyLog.stressLevel,
                            (val) => updateLog('stressLevel', val), 'stress')}

                        {renderScale('🔥', 'Motivation to Train', dailyLog.motivation,
                            (val) => updateLog('motivation', val), 'green')}

                        {/* Section: Reflection */}
                        <Text style={styles.sectionHeader}>💭 Reflection</Text>

                        {/* Today's Prompt */}
                        <View style={styles.promptCard}>
                            <Text style={styles.promptText}>{todaysPrompt}</Text>
                        </View>

                        {/* Notes */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>📝 Notes</Text>
                            <TextInput
                                value={dailyLog.notes}
                                onChangeText={(text) => updateLog('notes', text)}
                                placeholder="How are you feeling today? Any thoughts on training?"
                                placeholderTextColor="#71717a"
                                multiline
                                numberOfLines={4}
                                style={styles.notesInput}
                            />
                        </View>

                        {/* Save Button */}
                        <Pressable onPress={handleSaveLog} style={styles.saveButton}>
                            <Text style={styles.saveButtonText}>Save Today's Log</Text>
                        </Pressable>
                    </View>
                ) : activeTab === 'workouts' ? (
                    <View>
                        <Text style={styles.sectionHeader}>🏋️ Your Workouts</Text>

                        {loadingWorkouts ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Loading...</Text>
                            </View>
                        ) : workoutSessions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>💪</Text>
                                <Text style={styles.emptyText}>No workouts saved yet</Text>
                                <Text style={styles.emptySubtext}>
                                    Complete a workout and tap "Save to Hub" to see it here.
                                </Text>
                            </View>
                        ) : (
                            workoutSessions.map((workout) => (
                                <View key={workout.id} style={styles.workoutCard}>
                                    <View style={styles.workoutHeader}>
                                        <Text style={styles.workoutDate}>{formatDate(workout.created_at)}</Text>
                                        <Text style={styles.workoutDuration}>{formatDuration(workout.duration_seconds)}</Text>
                                    </View>
                                    <Text style={styles.workoutName}>{workout.day_name}</Text>
                                    <View style={styles.workoutStats}>
                                        <Text style={styles.workoutStat}>{workout.exercises_completed} exercises</Text>
                                        <Text style={styles.workoutStatDot}>•</Text>
                                        <Text style={styles.workoutStat}>{workout.total_sets} sets</Text>
                                        <Text style={styles.workoutStatDot}>•</Text>
                                        <Text style={styles.workoutStat}>{formatVolume(workout.total_volume)} lbs</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📊</Text>
                        <Text style={styles.emptyText}>
                            Your journal history will appear here once you start logging.
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Track trends in your sleep, energy, and recovery over time.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#18181b',
    },
    tabLeft: {
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    tabRight: {
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    tabActive: {
        backgroundColor: '#8b5cf6',
    },
    tabText: {
        textAlign: 'center',
        fontWeight: '600',
        color: '#a1a1aa',
    },
    tabTextActive: {
        color: '#ffffff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    sectionHeader: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 16,
    },
    card: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        marginBottom: 12,
    },
    cardTitle: {
        color: '#ffffff',
        fontWeight: '600',
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    levelValue: {
        fontWeight: 'bold',
        fontSize: 18,
    },
    levelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    levelButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    levelButtonText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    promptCard: {
        backgroundColor: '#1e1b4b',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#4c1d95',
        marginBottom: 12,
    },
    promptText: {
        color: '#c4b5fd',
        fontSize: 16,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    notesInput: {
        backgroundColor: '#27272a',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#ffffff',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#22c55e',
        borderRadius: 12,
        paddingVertical: 16,
        marginTop: 8,
        marginBottom: 32,
    },
    saveButtonText: {
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: 18,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyEmoji: {
        fontSize: 60,
        marginBottom: 16,
    },
    emptyText: {
        color: '#ffffff',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '500',
    },
    emptySubtext: {
        color: '#a1a1aa',
        textAlign: 'center',
        marginTop: 8,
    },
    // Workout Card Styles
    workoutCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        marginBottom: 12,
    },
    workoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    workoutDate: {
        color: '#8b5cf6',
        fontSize: 12,
        fontWeight: '600',
    },
    workoutDuration: {
        color: '#71717a',
        fontSize: 12,
    },
    workoutName: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    workoutStats: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    workoutStat: {
        color: '#a1a1aa',
        fontSize: 12,
    },
    workoutStatDot: {
        color: '#52525b',
        fontSize: 12,
        marginHorizontal: 6,
    },
});
