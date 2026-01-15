import { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============ TYPES ============
type SetType = 'warmup' | 'working';

interface ExerciseSet {
    type: SetType;
    groupId: string;
    reps: string;
    repsMin?: number;
    repsMax?: number;
}

interface PlanExercise {
    id: string;
    name: string;
    sets: ExerciseSet[];
    supersetWith?: string;
    exerciseNotes?: string;
}

interface WorkoutDay {
    name: string;
    dayOfWeek: string | null;
    isRestDay?: boolean;
    preNotes?: string;
    exercises: PlanExercise[];
}

interface SavedPlan {
    id: string;
    name: string;
    days: WorkoutDay[];
    createdAt: Date;
}

// ============ WARM-UP CONTENT ============
type WorkoutType = 'push' | 'pull' | 'legs' | 'full';

const WARM_UP_CONTENT: Record<WorkoutType, { stretches: string[]; cardio: string[] }> = {
    push: {
        cardio: ['5 min light bike or treadmill', '2 min jump rope'],
        stretches: [
            '🔄 Shoulder circles (10 each direction)',
            '💪 Arm swings across body (15 reps)',
            '🙆 Chest openers (10 reps)',
            '🤲 Wrist rotations (10 each)',
            '🏋️ Light push-ups or wall push-ups (10 reps)',
        ],
    },
    pull: {
        cardio: ['5 min rowing machine', '3 min light jog'],
        stretches: [
            '🐱 Cat-cow stretches (10 reps)',
            '🎯 Band pull-aparts (15 reps)',
            '🙆 Lat stretches (30s each side)',
            '🔄 Thoracic rotations (10 each side)',
            '💪 Scapular retractions (15 reps)',
        ],
    },
    legs: {
        cardio: ['5 min stationary bike', '3 min incline walk'],
        stretches: [
            '🔄 Hip circles (10 each direction)',
            '🦵 Leg swings (15 each leg)',
            '🏋️ Bodyweight squats (15 reps)',
            '🦶 Ankle mobility circles (10 each)',
            '🧘 Walking lunges (10 each leg)',
        ],
    },
    full: {
        cardio: ['5 min light cardio of choice'],
        stretches: [
            '🔄 Neck rolls (5 each direction)',
            '💪 Arm circles (10 each direction)',
            '🏋️ Hip hinges (10 reps)',
            '🦵 Leg swings (10 each leg)',
            '🧘 World\'s greatest stretch (5 each side)',
        ],
    },
};

// ============ COMPONENT ============
export default function WarmUpScreen() {
    const router = useRouter();
    const { planId, dayIndex: dayIndexParam, dayName } = useLocalSearchParams<{
        planId: string;
        dayIndex: string;
        dayName: string;
    }>();

    const [plan, setPlan] = useState<SavedPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [warmUpExpanded, setWarmUpExpanded] = useState(true);
    const [previewExpanded, setPreviewExpanded] = useState(false);

    const dayIndex = parseInt(dayIndexParam || '0', 10);

    // Load plan data
    useEffect(() => {
        const loadPlan = async () => {
            try {
                const stored = await AsyncStorage.getItem('opticrep_saved_plans');
                if (stored) {
                    const plans: SavedPlan[] = JSON.parse(stored);
                    const found = plans.find(p => p.id === planId);
                    if (found) {
                        setPlan(found);
                    }
                }
            } catch (error) {
                console.error('Failed to load plan:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPlan();
    }, [planId]);

    const currentDay = plan?.days[dayIndex];
    const exercises = currentDay?.exercises || [];

    // Detect workout type from exercise names
    const workoutType = useMemo((): WorkoutType => {
        if (!exercises.length) return 'full';

        const names = exercises.map(e => e.name.toLowerCase()).join(' ');

        const pushKeywords = ['bench', 'press', 'chest', 'shoulder', 'tricep', 'dip', 'fly'];
        const pullKeywords = ['row', 'pull', 'lat', 'bicep', 'back', 'curl', 'chin'];
        const legKeywords = ['squat', 'leg', 'deadlift', 'lunge', 'calf', 'hamstring', 'quad', 'glute'];

        const pushScore = pushKeywords.filter(k => names.includes(k)).length;
        const pullScore = pullKeywords.filter(k => names.includes(k)).length;
        const legScore = legKeywords.filter(k => names.includes(k)).length;

        if (pushScore > pullScore && pushScore > legScore) return 'push';
        if (pullScore > pushScore && pullScore > legScore) return 'pull';
        if (legScore > pushScore && legScore > pullScore) return 'legs';
        return 'full';
    }, [exercises]);

    const warmUpContent = WARM_UP_CONTENT[workoutType];

    // Calculate estimated duration
    const estimatedDuration = useMemo(() => {
        const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        const minutes = Math.round(totalSets * 2.5 + 5); // ~2.5 min per set + 5 min buffer
        return minutes;
    }, [exercises]);

    const handleStartWorkout = () => {
        router.replace({
            pathname: '/active-session',
            params: { planId, dayIndex: dayIndex.toString() },
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#a3e635" />
                    <Text style={styles.loadingText}>Loading workout...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!currentDay) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Workout not found</Text>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.backBtn}>← Back</Text>
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{currentDay.name}</Text>
                    <Text style={styles.headerSubtitle}>
                        ~{estimatedDuration} min • {exercises.length} exercises
                    </Text>
                </View>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Warm-Up Section */}
                <Pressable
                    style={styles.sectionCard}
                    onPress={() => setWarmUpExpanded(!warmUpExpanded)}
                >
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>🔥</Text>
                        <Text style={styles.sectionTitle}>Warm-Up</Text>
                        <Text style={styles.sectionBadge}>
                            {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Day
                        </Text>
                        <Text style={styles.expandIcon}>{warmUpExpanded ? '▼' : '▶'}</Text>
                    </View>

                    {warmUpExpanded && (
                        <View style={styles.sectionContent}>
                            {/* Cardio */}
                            <Text style={styles.subHeader}>🏃 Light Cardio</Text>
                            {warmUpContent.cardio.map((item, idx) => (
                                <Text key={idx} style={styles.warmUpItem}>• {item}</Text>
                            ))}

                            {/* Stretches */}
                            <Text style={[styles.subHeader, { marginTop: 16 }]}>🧘 Dynamic Stretches</Text>
                            {warmUpContent.stretches.map((item, idx) => (
                                <Text key={idx} style={styles.warmUpItem}>{item}</Text>
                            ))}
                        </View>
                    )}
                </Pressable>

                {/* Workout Preview Section */}
                <Pressable
                    style={styles.sectionCard}
                    onPress={() => setPreviewExpanded(!previewExpanded)}
                >
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>📋</Text>
                        <Text style={styles.sectionTitle}>Today's Workout</Text>
                        <Text style={styles.expandIcon}>{previewExpanded ? '▼' : '▶'}</Text>
                    </View>

                    {previewExpanded && (
                        <View style={styles.sectionContent}>
                            {exercises.map((exercise, idx) => {
                                const workingSets = exercise.sets.filter(s => s.type !== 'warmup').length;
                                const warmupSets = exercise.sets.filter(s => s.type === 'warmup').length;

                                return (
                                    <View key={exercise.id} style={styles.exercisePreview}>
                                        <Text style={styles.exerciseNumber}>{idx + 1}</Text>
                                        <View style={styles.exerciseInfo}>
                                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                                            <Text style={styles.exerciseSets}>
                                                {workingSets} working{warmupSets > 0 ? ` + ${warmupSets} warmup` : ''} sets
                                            </Text>
                                        </View>
                                        {exercise.supersetWith && (
                                            <Text style={styles.supersetBadge}>🔗</Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </Pressable>

                {/* Pre-notes if any */}
                {currentDay.preNotes && typeof currentDay.preNotes === 'string' && currentDay.preNotes.trim() && (
                    <View style={styles.preNotesCard}>
                        <Text style={styles.preNotesLabel}>📝 Pre-Workout Notes</Text>
                        <Text style={styles.preNotesText}>{currentDay.preNotes}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
                <Pressable style={styles.startButton} onPress={handleStartWorkout}>
                    <Text style={styles.startButtonText}>💪 Start Workout</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

// ============ STYLES ============
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#a1a1aa',
        marginTop: 16,
        fontSize: 16,
    },
    backButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#27272a',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 14,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    backBtn: {
        color: '#a3e635',
        fontSize: 16,
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#71717a',
        marginTop: 2,
    },

    // Scroll
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },

    // Section Card
    sectionCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        flex: 1,
    },
    sectionBadge: {
        backgroundColor: '#0f766e',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        fontSize: 12,
        color: '#5eead4',
        fontWeight: '600',
        marginRight: 8,
    },
    expandIcon: {
        color: '#71717a',
        fontSize: 14,
    },
    sectionContent: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#27272a',
    },

    // Warm-up content
    subHeader: {
        fontSize: 14,
        fontWeight: '600',
        color: '#a1a1aa',
        marginBottom: 8,
    },
    warmUpItem: {
        fontSize: 15,
        color: '#e4e4e7',
        paddingVertical: 6,
        paddingLeft: 4,
    },

    // Exercise Preview
    exercisePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    exerciseNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#27272a',
        textAlign: 'center',
        lineHeight: 28,
        fontSize: 14,
        fontWeight: '600',
        color: '#a1a1aa',
        marginRight: 12,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ffffff',
    },
    exerciseSets: {
        fontSize: 13,
        color: '#71717a',
        marginTop: 2,
    },
    supersetBadge: {
        fontSize: 16,
        marginLeft: 8,
    },

    // Pre-notes
    preNotesCard: {
        backgroundColor: '#134e4a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#0f766e',
    },
    preNotesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#5eead4',
        marginBottom: 8,
    },
    preNotesText: {
        fontSize: 15,
        color: '#e4e4e7',
        lineHeight: 22,
    },

    // Bottom Actions
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 20,
        paddingBottom: 36,
        backgroundColor: '#09090b',
        borderTopWidth: 1,
        borderTopColor: '#27272a',
        gap: 12,
    },
    startButton: {
        flex: 1,
        backgroundColor: '#a3e635',
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
    },
    startButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
});
