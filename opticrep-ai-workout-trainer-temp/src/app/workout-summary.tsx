import { useState, useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Alert,
    ActivityIndicator,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ScalePressable } from '@/components/ScalePressable';
import { TextInput, KeyboardAvoidingView, Platform } from 'react-native';

interface WorkoutStats {
    totalSets: number;
    totalReps: number;
    totalVolume: number;
    duration: number;
    exercisesCompleted: number;
    dayName: string;
}

interface PreviousSession {
    total_volume: number;
    total_sets: number;
    total_reps: number;
    duration_seconds: number;
    created_at: string;
}

export default function WorkoutSummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        dayName: string;
        duration: string;
        exercisesCompleted: string;
        totalSets: string;
        totalReps: string;
        totalVolume: string;
        exercisesData?: string;
        sessionNotes?: string;
        planId?: string;
    }>();

    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reflections, setReflections] = useState(params.sessionNotes || '');
    const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(true);

    const stats: WorkoutStats = {
        dayName: params.dayName || 'Workout',
        duration: parseInt(params.duration || '0', 10),
        exercisesCompleted: parseInt(params.exercisesCompleted || '0', 10),
        totalSets: parseInt(params.totalSets || '0', 10),
        totalReps: parseInt(params.totalReps || '0', 10),
        totalVolume: parseInt(params.totalVolume || '0', 10),
    };

    // Parse exercises data from params
    const exercisesData = params.exercisesData ? JSON.parse(params.exercisesData) : [];

    // Fetch previous session for comparison
    useEffect(() => {
        const fetchPreviousSession = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoadingComparison(false);
                    return;
                }

                // Get the most recent session with the same day_name (excluding 'today')
                const { data } = await (supabase as any)
                    .from('workout_sessions')
                    .select('total_volume, total_sets, total_reps, duration_seconds, created_at')
                    .eq('user_id', user.id)
                    .eq('day_name', stats.dayName)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    setPreviousSession(data[0]);
                }
            } catch (error) {
                console.error('Error fetching previous session:', error);
            } finally {
                setLoadingComparison(false);
            }
        };

        fetchPreviousSession();
    }, [stats.dayName]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatVolume = (volume: number): string => {
        if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}k`;
        }
        return volume.toLocaleString();
    };

    const handleSaveToJournal = async () => {
        setSaving(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError) {
                console.error('Auth error:', authError);
                Alert.alert('Authentication Error', 'Please sign in to save your workout.');
                setSaving(false);
                return;
            }

            if (!user) {
                Alert.alert('Not Signed In', 'Please sign in to save your workout to the Hub.');
                setSaving(false);
                return;
            }

            if (__DEV__) console.log('Saving workout for user:', user.id);
            if (__DEV__) console.log('Stats:', stats);
            if (__DEV__) console.log('Exercises data:', exercisesData);

            // Save workout session (cast to any to bypass type issues with ungenerated table types)
            const { data, error } = await (supabase as any).from('workout_sessions').insert({
                user_id: user.id,
                day_name: stats.dayName,
                duration_seconds: stats.duration,
                exercises_completed: stats.exercisesCompleted,
                total_sets: stats.totalSets,
                total_reps: stats.totalReps,
                total_volume: stats.totalVolume,
                exercises_data: exercisesData,
                notes: reflections,
                plan_id: params.planId || null, // Store plan reference for Training Log context
            }).select();

            if (error) {
                console.error('Supabase error:', error);
                Alert.alert(
                    'Save Failed',
                    `Could not save workout: ${error.message}\n\nMake sure the workout_sessions table exists in Supabase.`
                );
                setSaving(false);
                return;
            }

            if (__DEV__) console.log('Workout saved successfully:', data);
            setSaved(true);

            // Navigate to Hub tab after successful save
            router.replace('/(tabs)/coach');
        } catch (e) {
            console.error('Error saving workout:', e);
            Alert.alert('Error', 'An unexpected error occurred while saving your workout.');
        } finally {
            setSaving(false);
        }
    };

    const handleDone = () => {
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.emoji}>🎉</Text>
                            <Text style={styles.title}>Workout Complete!</Text>
                            <Text style={styles.subtitle}>{stats.dayName}</Text>
                        </View>

                        {/* Stats Grid */}
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{formatTime(stats.duration)}</Text>
                                <Text style={styles.statLabel}>Duration</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{stats.exercisesCompleted}</Text>
                                <Text style={styles.statLabel}>Exercises</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{stats.totalSets}</Text>
                                <Text style={styles.statLabel}>Sets</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{stats.totalReps}</Text>
                                <Text style={styles.statLabel}>Total Reps</Text>
                            </View>
                        </View>

                        {/* Volume Card */}
                        <View style={styles.volumeCard}>
                            <Text style={styles.volumeLabel}>TOTAL VOLUME</Text>
                            <Text style={styles.volumeValue}>{formatVolume(stats.totalVolume)} lbs</Text>
                        </View>

                        {/* Progress Comparison Card */}
                        {!loadingComparison && previousSession && (
                            <View style={styles.comparisonCard}>
                                <Text style={styles.comparisonLabel}>📈 PROGRESS VS LAST TIME</Text>
                                <Text style={styles.comparisonDate}>
                                    {new Date(previousSession.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Text>

                                <View style={styles.comparisonGrid}>
                                    {/* Volume Difference */}
                                    <View style={styles.comparisonItem}>
                                        {(() => {
                                            const diff = stats.totalVolume - previousSession.total_volume;
                                            const percent = previousSession.total_volume > 0
                                                ? Math.round((diff / previousSession.total_volume) * 100)
                                                : 0;
                                            const isPositive = diff > 0;
                                            const isNeutral = diff === 0;
                                            return (
                                                <>
                                                    <Text style={[
                                                        styles.comparisonValue,
                                                        isPositive ? styles.comparisonPositive : isNeutral ? styles.comparisonNeutral : styles.comparisonNegative
                                                    ]}>
                                                        {isPositive ? '+' : ''}{formatVolume(diff)} lbs
                                                    </Text>
                                                    <Text style={styles.comparisonPercent}>
                                                        {isPositive ? '↑' : isNeutral ? '→' : '↓'} {Math.abs(percent)}%
                                                    </Text>
                                                    <Text style={styles.comparisonItemLabel}>Volume</Text>
                                                </>
                                            );
                                        })()}
                                    </View>

                                    {/* Sets Difference */}
                                    <View style={styles.comparisonItem}>
                                        {(() => {
                                            const diff = stats.totalSets - previousSession.total_sets;
                                            const isPositive = diff > 0;
                                            const isNeutral = diff === 0;
                                            return (
                                                <>
                                                    <Text style={[
                                                        styles.comparisonValue,
                                                        isPositive ? styles.comparisonPositive : isNeutral ? styles.comparisonNeutral : styles.comparisonNegative
                                                    ]}>
                                                        {isPositive ? '+' : ''}{diff}
                                                    </Text>
                                                    <Text style={styles.comparisonPercent}>
                                                        {isPositive ? '↑' : isNeutral ? '→' : '↓'} sets
                                                    </Text>
                                                    <Text style={styles.comparisonItemLabel}>Sets</Text>
                                                </>
                                            );
                                        })()}
                                    </View>

                                    {/* Reps Difference */}
                                    <View style={styles.comparisonItem}>
                                        {(() => {
                                            const diff = stats.totalReps - previousSession.total_reps;
                                            const isPositive = diff > 0;
                                            const isNeutral = diff === 0;
                                            return (
                                                <>
                                                    <Text style={[
                                                        styles.comparisonValue,
                                                        isPositive ? styles.comparisonPositive : isNeutral ? styles.comparisonNeutral : styles.comparisonNegative
                                                    ]}>
                                                        {isPositive ? '+' : ''}{diff}
                                                    </Text>
                                                    <Text style={styles.comparisonPercent}>
                                                        {isPositive ? '↑' : isNeutral ? '→' : '↓'} reps
                                                    </Text>
                                                    <Text style={styles.comparisonItemLabel}>Reps</Text>
                                                </>
                                            );
                                        })()}
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Reflection Card */}
                        <View style={styles.reflectionCard}>
                            <Text style={styles.reflectionLabel}>REFLECTIONS & NOTES</Text>
                            <TextInput
                                style={styles.reflectionInput}
                                value={reflections}
                                onChangeText={setReflections}
                                placeholder="How was the workout? Note any pain or improvements..."
                                placeholderTextColor="#52525b"
                                multiline
                                scrollEnabled={false}
                                returnKeyType="done"
                                blurOnSubmit={true}
                                onSubmitEditing={Keyboard.dismiss}
                            />
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actions}>
                            {!saved ? (
                                <ScalePressable
                                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                                    onPress={handleSaveToJournal}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>Go to Hub 🚀</Text>
                                    )}
                                </ScalePressable>
                            ) : (
                                <View style={styles.savedBadge}>
                                    <Text style={styles.savedText}>✓ Saved to Hub</Text>
                                </View>
                            )}

                            <ScalePressable style={styles.doneButton} onPress={handleDone}>
                                <Text style={styles.doneButtonText}>Done</Text>
                            </ScalePressable>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b',
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        color: '#a1a1aa',
        fontSize: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
        width: '100%',
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    statValue: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: '#71717a',
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    volumeCard: {
        width: '100%',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 32,
    },
    volumeLabel: {
        color: '#a78bfa',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
    },
    volumeValue: {
        color: '#ffffff',
        fontSize: 36,
        fontWeight: '800',
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    saveButton: {
        backgroundColor: '#a3e635',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    savedBadge: {
        backgroundColor: 'rgba(163, 230, 53, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(163, 230, 53, 0.3)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    savedText: {
        color: '#a3e635',
        fontSize: 16,
        fontWeight: '600',
    },
    doneButton: {
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    reflectionCard: {
        width: '100%',
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
    },
    reflectionLabel: {
        color: '#71717a',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    reflectionInput: {
        color: '#ffffff',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // Comparison Card
    comparisonCard: {
        width: '100%',
        backgroundColor: '#1e1b4b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#4c1d95',
    },
    comparisonLabel: {
        color: '#a78bfa',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    comparisonDate: {
        color: '#71717a',
        fontSize: 12,
        marginBottom: 16,
    },
    comparisonGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    comparisonItem: {
        alignItems: 'center',
        flex: 1,
    },
    comparisonValue: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 2,
    },
    comparisonPositive: {
        color: '#a3e635',
    },
    comparisonNeutral: {
        color: '#71717a',
    },
    comparisonNegative: {
        color: '#ef4444',
    },
    comparisonPercent: {
        color: '#a78bfa',
        fontSize: 12,
        marginBottom: 4,
    },
    comparisonItemLabel: {
        color: '#71717a',
        fontSize: 11,
        textTransform: 'uppercase',
    },
});
