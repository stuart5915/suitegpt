import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Alert,
    Vibration,
    Dimensions,
    TextInput,
    Keyboard,
    Animated,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getLastWeight, saveSetHistory } from '@/lib/supabase/exercise-history';
import { CameraView } from '@/session/camera/CameraView';

// ============ TYPES ============
type SetType = 'warmup' | 'working';

interface ExerciseSet {
    type: SetType;
    groupId: string;
    reps: string;
    repsMin?: number;
    repsMax?: number;
    minRepsOnly?: number;
    technique?: string;
    toFailure?: boolean;
    notes?: string;
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

// ============ COMPONENT ============
export default function ActiveSessionScreen() {
    const router = useRouter();
    const { planId, dayIndex: dayIndexParam } = useLocalSearchParams<{ planId: string; dayIndex?: string }>();

    const [plan, setPlan] = useState<SavedPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Session state
    const [dayIndex, setDayIndex] = useState(0);
    const [exerciseIndex, setExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [repCount, setRepCount] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isResting, setIsResting] = useState(false);
    const [restSeconds, setRestSeconds] = useState(0);
    const [hasCompletedSet, setHasCompletedSet] = useState(false);

    // Weight tracking
    const [currentWeight, setCurrentWeight] = useState<number>(0);
    const [lastWeight, setLastWeight] = useState<number | null>(null);

    // Workout stats tracking
    const [totalSetsCompleted, setTotalSetsCompleted] = useState(0);
    const [totalRepsCompleted, setTotalRepsCompleted] = useState(0);
    const [totalVolume, setTotalVolume] = useState(0);

    // Completed sets tracking - stores reps and weight for each completed set
    const [completedSets, setCompletedSets] = useState<Map<string, { reps: number; weight: number }[]>>(new Map());

    // Celebration animation
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationText, setCelebrationText] = useState('');
    const celebrationScale = useRef(new Animated.Value(0)).current;
    const celebrationOpacity = useRef(new Animated.Value(0)).current;
    const celebrationY = useRef(new Animated.Value(0)).current;

    // Undo functionality - stores last action for undo
    const [lastSetAction, setLastSetAction] = useState<{
        exerciseIndex: number;
        setIndex: number;
        reps: number;
        weight: number;
        wasResting: boolean;
    } | null>(null);

    // Camera mode
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [workoutOverviewExpanded, setWorkoutOverviewExpanded] = useState(false);
    const [expandedExerciseIndex, setExpandedExerciseIndex] = useState<number | null>(null);
    const { width: screenWidth } = Dimensions.get('window');
    const cameraHeight = screenWidth * 0.75; // 4:3 aspect ratio

    // Superset state
    const [supersetPhase, setSupersetPhase] = useState<'A' | 'B'>('A');
    const [supersetSetIndex, setSupersetSetIndex] = useState(0); // Which set round we're on in the superset

    // Session Notes
    const [sessionNotes, setSessionNotes] = useState('');
    const [showNotesModal, setShowNotesModal] = useState(false);

    // Load plan on mount
    useEffect(() => {
        const loadPlan = async () => {
            try {
                // Try Supabase first
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data, error } = await (supabase as any)
                        .from('saved_workout_templates')
                        .select('*')
                        .eq('id', planId)
                        .single();

                    if (data && !error) {
                        setPlan({
                            id: data.id,
                            name: data.name,
                            days: data.days as WorkoutDay[],
                            createdAt: new Date(data.created_at),
                        });
                        setIsLoading(false);
                        return;
                    }
                }

                // Fall back to local storage
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

        if (planId) {
            loadPlan();
        }

        // Set initial day index from params
        if (dayIndexParam) {
            setDayIndex(parseInt(dayIndexParam, 10) || 0);
        }
    }, [planId, dayIndexParam]);

    // Session timer
    useEffect(() => {
        if (!plan) return;

        const timer = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [plan]);

    // Rest timer
    useEffect(() => {
        if (!isResting || restSeconds <= 0) return;

        const timer = setInterval(() => {
            setRestSeconds(prev => {
                if (prev <= 1) {
                    setIsResting(false);
                    Vibration.vibrate(500);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isResting, restSeconds]);

    // Current workout data
    const currentDay = useMemo(() => {
        if (!plan || dayIndex >= plan.days.length) return null;
        return plan.days[dayIndex];
    }, [plan, dayIndex]);

    const currentExercise = useMemo(() => {
        if (!currentDay || exerciseIndex >= currentDay.exercises.length) return null;
        return currentDay.exercises[exerciseIndex];
    }, [currentDay, exerciseIndex]);

    // Superset detection - find the partner exercise if this is a superset
    const supersetInfo = useMemo(() => {
        if (!currentExercise?.supersetWith || !currentDay) return null;
        const partnerIdx = currentDay.exercises.findIndex(e => e.id === currentExercise.supersetWith);
        if (partnerIdx === -1) return null;
        return {
            partnerExercise: currentDay.exercises[partnerIdx],
            partnerIndex: partnerIdx,
        };
    }, [currentExercise, currentDay]);

    // The active exercise depends on superset phase
    const activeExercise = useMemo(() => {
        if (!supersetInfo || supersetPhase === 'A') return currentExercise;
        return supersetInfo.partnerExercise;
    }, [currentExercise, supersetInfo, supersetPhase]);

    const activeExerciseIndex = useMemo(() => {
        if (!supersetInfo || supersetPhase === 'A') return exerciseIndex;
        return supersetInfo.partnerIndex;
    }, [exerciseIndex, supersetInfo, supersetPhase]);

    // Fetch last weight when exercise changes
    useEffect(() => {
        if (!currentExercise) return;

        const fetchWeight = async () => {
            const weight = await getLastWeight(currentExercise.name);
            setLastWeight(weight);
            if (weight !== null) {
                setCurrentWeight(weight);
            } else {
                setCurrentWeight(0);
            }
        };

        fetchWeight();
    }, [currentExercise]);

    const currentSet = useMemo(() => {
        if (!currentExercise || currentSetIndex >= currentExercise.sets.length) return null;
        return currentExercise.sets[currentSetIndex];
    }, [currentExercise, currentSetIndex]);

    const totalSets = currentExercise?.sets.length || 0;
    const targetReps = currentSet ? parseInt(currentSet.reps, 10) || 10 : 10;

    // Set rep count to target when set changes
    useEffect(() => {
        setRepCount(targetReps);
    }, [currentExercise, currentSetIndex, targetReps]);

    const nextExercise = useMemo(() => {
        if (!currentDay) return null;
        const nextIdx = exerciseIndex + 1;
        if (nextIdx >= currentDay.exercises.length) return null;
        return currentDay.exercises[nextIdx];
    }, [currentDay, exerciseIndex]);

    const prevExercise = useMemo(() => {
        if (!currentDay || exerciseIndex <= 0) return null;
        return currentDay.exercises[exerciseIndex - 1];
    }, [currentDay, exerciseIndex]);

    // Format time display
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Celebration animation trigger
    const triggerCelebration = useCallback((reps: number) => {
        setCelebrationText(`+${reps}`);
        setShowCelebration(true);

        // Reset animation values
        celebrationScale.setValue(0);
        celebrationOpacity.setValue(1);
        celebrationY.setValue(0);

        // Run celebration animation
        Animated.parallel([
            Animated.spring(celebrationScale, {
                toValue: 1.2,
                friction: 4,
                tension: 100,
                useNativeDriver: true,
            }),
            Animated.timing(celebrationY, {
                toValue: -60,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.delay(400),
                Animated.timing(celebrationOpacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            setShowCelebration(false);
        });
    }, [celebrationScale, celebrationOpacity, celebrationY]);

    // Complete workout - moved before handleCompleteSet to avoid circular dependency
    const handleCompleteWorkout = useCallback((pendingSet?: { exerciseIdx: number; reps: number; weight: number }) => {
        const exercisesCount = exerciseIndex + 1;

        // Build exercises data from completedSets + pendingSet
        const exercisesData: { name: string; sets: { reps: number; weight: number }[] }[] = [];

        // Compute stats from the completedSets Map + pending set to avoid stale closure issue
        let computedTotalSets = 0;
        let computedTotalReps = 0;
        let computedTotalVolume = 0;

        if (currentDay) {
            for (let i = 0; i <= exerciseIndex; i++) {
                const exercise = currentDay.exercises[i];
                let setsData = [...(completedSets.get(`${i}`) || [])];

                // If this is the exercise with the pending set, add it
                if (pendingSet && pendingSet.exerciseIdx === i) {
                    setsData = [...setsData, { reps: pendingSet.reps, weight: pendingSet.weight }];
                }

                if (exercise && setsData.length > 0) {
                    exercisesData.push({
                        name: exercise.name,
                        sets: setsData,
                    });

                    // Accumulate stats from this exercise's sets
                    for (const set of setsData) {
                        computedTotalSets++;
                        computedTotalReps += set.reps;
                        computedTotalVolume += set.reps * (set.weight || 0);
                    }
                }
            }
        }

        router.replace({
            pathname: '/workout-summary',
            params: {
                dayName: currentDay?.name || 'Workout',
                duration: elapsedSeconds.toString(),
                exercisesCompleted: exercisesCount.toString(),
                totalSets: computedTotalSets.toString(),
                totalReps: computedTotalReps.toString(),
                totalVolume: computedTotalVolume.toString(),
                exercisesData: JSON.stringify(exercisesData),
                sessionNotes,
                planId: planId || '', // Pass planId for Training Log context
            },
        });
    }, [currentDay, elapsedSeconds, exerciseIndex, router, completedSets, sessionNotes]);

    // Handlers
    const handleCompleteSet = useCallback(() => {
        const exerciseToLog = activeExercise;
        const exerciseIdxToLog = activeExerciseIndex;
        if (!exerciseToLog) return;

        // Save undo state BEFORE making changes
        setLastSetAction({
            exerciseIndex: exerciseIdxToLog,
            setIndex: supersetInfo ? supersetSetIndex : currentSetIndex,
            reps: repCount,
            weight: currentWeight,
            wasResting: isResting,
        });

        // Record this set's reps
        setCompletedSets(prev => {
            const key = `${exerciseIdxToLog}`;
            const newMap = new Map(prev);
            const existing = prev.get(key) || [];
            newMap.set(key, [...existing, { reps: repCount, weight: currentWeight }]);
            return newMap;
        });

        // Save to exercise history
        saveSetHistory(
            exerciseToLog.name,
            currentWeight > 0 ? currentWeight : null,
            repCount,
            (supersetInfo ? supersetSetIndex : currentSetIndex) + 1,
            planId
        );

        // Track workout stats
        setTotalSetsCompleted(prev => prev + 1);
        setTotalRepsCompleted(prev => prev + repCount);
        setTotalVolume(prev => prev + (repCount * (currentWeight || 0)));

        // Trigger celebration animation
        triggerCelebration(repCount);

        // Vibrate feedback
        Vibration.vibrate(100);

        // Mark that we've completed at least one set (for autoStart)
        setHasCompletedSet(true);

        // Determine total sets for whichever exercise we're on
        const exerciseTotalSets = exerciseToLog.sets.length;

        // SUPERSET FLOW
        if (supersetInfo) {
            if (supersetPhase === 'A') {
                // Just finished phase A - switch to phase B with short rest
                setSupersetPhase('B');
                setIsResting(true);
                setRestSeconds(15); // Short rest between superset exercises
            } else {
                // Just finished phase B - check if more sets in this superset round
                const nextSetIdx = supersetSetIndex + 1;
                // Use the original exercise's set count (phase A exercise)
                const primaryExerciseSets = currentExercise?.sets.length || 0;

                if (nextSetIdx < primaryExerciseSets) {
                    // More sets to do in this superset
                    setSupersetSetIndex(nextSetIdx);
                    setSupersetPhase('A');
                    setIsResting(true);
                    setRestSeconds(90); // Normal rest after completing one round
                } else {
                    // Superset complete! Move past both exercises
                    // Find the higher index of the two exercises and move past it
                    const maxIdx = Math.max(exerciseIndex, supersetInfo.partnerIndex);
                    if (currentDay && maxIdx < currentDay.exercises.length - 1) {
                        // Move to next exercise after the superset pair
                        setExerciseIndex(maxIdx + 1);
                        setCurrentSetIndex(0);
                        setSupersetPhase('A');
                        setSupersetSetIndex(0);
                        setIsResting(true);
                        setRestSeconds(120);
                    } else {
                        // Check for incomplete exercises before finishing
                        let firstIncompleteIdx = -1;
                        if (currentDay) {
                            for (let i = 0; i < currentDay.exercises.length; i++) {
                                const ex = currentDay.exercises[i];
                                const doneSets = completedSets.get(`${i}`) || [];
                                // Add 1 for the current exercise we are completing (since state hasn't updated yet)
                                const currentCount = (i === exerciseIdxToLog) ? doneSets.length + 1 : doneSets.length;

                                if (currentCount < ex.sets.length) {
                                    firstIncompleteIdx = i;
                                    break;
                                }
                            }
                        }

                        if (firstIncompleteIdx !== -1) {
                            setExerciseIndex(firstIncompleteIdx);
                            const doneCount = (completedSets.get(`${firstIncompleteIdx}`) || []).length;
                            setCurrentSetIndex(doneCount);
                            setSupersetPhase('A');
                            setSupersetSetIndex(doneCount);
                            setIsResting(true);
                            setRestSeconds(60); // Short transition rest
                        } else {
                            // Workout truly complete!
                            handleCompleteWorkout({ exerciseIdx: exerciseIdxToLog, reps: repCount, weight: currentWeight });
                        }
                    }
                }
            }
        } else {
            // NORMAL FLOW (no superset)
            if (currentSetIndex < exerciseTotalSets - 1) {
                // Start rest timer (90 seconds default)
                setIsResting(true);
                setRestSeconds(90);
                setCurrentSetIndex(prev => prev + 1);
            } else {
                // Move to next exercise
                if (currentDay && exerciseIndex < currentDay.exercises.length - 1) {
                    setExerciseIndex(prev => prev + 1);
                    setCurrentSetIndex(0);
                    // Reset superset state for next exercise
                    setSupersetPhase('A');
                    setSupersetSetIndex(0);
                    // Longer rest between exercises
                    setIsResting(true);
                    setRestSeconds(120);
                } else {
                    // Check for incomplete exercises before finishing
                    let firstIncompleteIdx = -1;
                    if (currentDay) {
                        for (let i = 0; i < currentDay.exercises.length; i++) {
                            const ex = currentDay.exercises[i];
                            const doneSets = completedSets.get(`${i}`) || [];
                            // Add 1 for the current exercise we are completing (since state hasn't updated yet)
                            const currentCount = (i === exerciseIndex) ? doneSets.length + 1 : doneSets.length;

                            if (currentCount < ex.sets.length) {
                                firstIncompleteIdx = i;
                                break;
                            }
                        }
                    }

                    if (firstIncompleteIdx !== -1) {
                        setExerciseIndex(firstIncompleteIdx);
                        const doneCount = (completedSets.get(`${firstIncompleteIdx}`) || []).length;
                        setCurrentSetIndex(doneCount);
                        setSupersetPhase('A');
                        setSupersetSetIndex(doneCount);
                        setIsResting(true);
                        setRestSeconds(60); // Short transition rest
                    } else {
                        // Workout truly complete! Pass the pending set since state hasn't updated yet
                        handleCompleteWorkout({ exerciseIdx: exerciseIndex, reps: repCount, weight: currentWeight });
                    }
                }
            }
        }
    }, [activeExercise, activeExerciseIndex, currentExercise, exerciseIndex, currentSetIndex, totalSets, repCount, currentDay, currentWeight, planId, isResting, triggerCelebration, handleCompleteWorkout, supersetInfo, supersetPhase, supersetSetIndex]);

    const handleSkipSet = useCallback(() => {
        if (!currentExercise) return;

        // Similar to complete but without recording
        if (currentSetIndex < totalSets - 1) {
            setCurrentSetIndex(prev => prev + 1);
            // Rep count will be reset by useEffect
        } else if (currentDay && exerciseIndex < currentDay.exercises.length - 1) {
            setExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);
            // Rep count will be reset by useEffect
        }
    }, [currentExercise, currentSetIndex, totalSets, exerciseIndex, currentDay]);

    const handleSkipRest = useCallback(() => {
        setIsResting(false);
        setRestSeconds(0);
    }, []);

    const handleUndoLastSet = useCallback(() => {
        if (!lastSetAction) return;

        // Remove the last set from completedSets
        setCompletedSets(prev => {
            const key = `${lastSetAction.exerciseIndex}`;
            const newMap = new Map(prev);
            const existing = prev.get(key) || [];
            if (existing.length > 0) {
                newMap.set(key, existing.slice(0, -1));
            }
            return newMap;
        });

        // Reverse the stats
        setTotalSetsCompleted(prev => Math.max(0, prev - 1));
        setTotalRepsCompleted(prev => Math.max(0, prev - lastSetAction.reps));
        setTotalVolume(prev => Math.max(0, prev - (lastSetAction.reps * lastSetAction.weight)));

        // Navigate back to that set
        setExerciseIndex(lastSetAction.exerciseIndex);
        setCurrentSetIndex(lastSetAction.setIndex);
        setRepCount(lastSetAction.reps);
        setCurrentWeight(lastSetAction.weight);

        // Stop resting if we were
        setIsResting(false);
        setRestSeconds(0);

        // Clear the undo action
        setLastSetAction(null);

        // Haptic feedback
        Vibration.vibrate([50, 50, 50]);
    }, [lastSetAction]);

    const handleAddRep = useCallback(() => {
        setRepCount(prev => prev + 1);
        Vibration.vibrate(50);
    }, []);

    const handleRemoveRep = useCallback(() => {
        setRepCount(prev => Math.max(0, prev - 1));
    }, []);

    // Camera rep detected handler
    const handleCameraRepDetected = useCallback((detectedRepCount: number) => {
        setRepCount(detectedRepCount);
        Vibration.vibrate(50);
    }, []);

    const toggleCamera = useCallback(() => {
        setCameraEnabled(prev => !prev);
    }, []);



    const handleEndWorkout = useCallback(() => {
        Alert.alert(
            'End Workout?',
            'Are you sure you want to end this workout early?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End', style: 'destructive', onPress: () => router.back() },
            ]
        );
    }, [router]);

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading workout...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // No plan found
    if (!plan || !currentDay) {
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

    // Note: Rest is now handled inline below, not as a separate screen

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={handleEndWorkout}>
                    <Text style={styles.backBtn}>← End</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{currentDay.name}</Text>
                <View style={styles.headerRight}>
                    <Pressable
                        style={styles.headerIconBtn}
                        onPress={() => setShowNotesModal(true)}
                    >
                        <Text style={styles.headerIconText}>📝</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.cameraToggle, cameraEnabled && styles.cameraToggleActive]}
                        onPress={toggleCamera}
                    >
                        <Text style={styles.cameraToggleText}>
                            {cameraEnabled ? '📹' : '📷'}
                        </Text>
                    </Pressable>
                    <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
                </View>
            </View>

            {/* Camera View (when enabled) */}
            {cameraEnabled && (
                <View style={[styles.cameraContainer, { height: cameraHeight }]}>
                    <CameraView
                        isActive={cameraEnabled && !isResting}
                        exerciseName={currentExercise?.name || 'Exercise'}
                        autoStart={hasCompletedSet}
                        onRepDetected={handleCameraRepDetected}
                        onSetComplete={(reps) => {
                            setRepCount(reps);
                            handleCompleteSet();
                        }}
                    />
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Inline Rest Banner */}
                {isResting && (
                    <View style={styles.restBanner}>
                        <View style={styles.restBannerLeft}>
                            <Text style={styles.restBannerLabel}>REST</Text>
                            <Text style={styles.restBannerTimer}>{restSeconds}s</Text>
                        </View>
                        <Pressable style={styles.skipRestBannerButton} onPress={handleSkipRest}>
                            <Text style={styles.skipRestBannerText}>Skip →</Text>
                        </Pressable>
                    </View>
                )}

                {/* Progress */}
                <View style={styles.progressSection}>
                    <Text style={styles.progressText}>
                        Exercise {exerciseIndex + 1} of {currentDay.exercises.length}
                    </Text>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((exerciseIndex + 1) / currentDay.exercises.length) * 100}%` }
                            ]}
                        />
                    </View>
                </View>

                {/* Exercise Carousel - Current + Next */}
                <View style={styles.exerciseCarousel}>
                    {/* Superset Banner */}
                    {supersetInfo && (
                        <View style={styles.supersetBanner}>
                            <Text style={styles.supersetBannerTitle}>🔗 SUPERSET</Text>
                            <View style={styles.supersetPairRow}>
                                <View style={[styles.supersetExerciseBox, supersetPhase === 'A' && styles.supersetExerciseBoxActive]}>
                                    <Text style={styles.supersetPhaseLabel}>A</Text>
                                    <Text style={styles.supersetExerciseName} numberOfLines={1}>{currentExercise?.name}</Text>
                                </View>
                                <Text style={styles.supersetArrow}>↔</Text>
                                <View style={[styles.supersetExerciseBox, supersetPhase === 'B' && styles.supersetExerciseBoxActive]}>
                                    <Text style={styles.supersetPhaseLabel}>B</Text>
                                    <Text style={styles.supersetExerciseName} numberOfLines={1}>{supersetInfo.partnerExercise.name}</Text>
                                </View>
                            </View>
                            <Text style={styles.supersetRoundText}>
                                Round {supersetSetIndex + 1} of {currentExercise?.sets.length || 0}
                            </Text>
                        </View>
                    )}

                    {/* Current Exercise Card - Main Focus */}
                    <View style={styles.currentExerciseCard}>
                        <Text style={styles.exerciseName}>{activeExercise?.name}</Text>
                        {activeExercise?.exerciseNotes && (
                            <Text style={styles.exerciseNotes}>💡 {activeExercise.exerciseNotes}</Text>
                        )}

                        {/* Warmup Badge - above set indicator */}
                        {currentSet?.type === 'warmup' && (
                            <View style={styles.warmupBadgeAbove}>
                                <Text style={styles.warmupBadgeText}>WARMUP</Text>
                            </View>
                        )}

                        {/* Set Indicator with PREV ← SET → NEXT layout */}
                        <View style={styles.setNavRow}>
                            {/* PREV Exercise */}
                            <View style={styles.navExerciseBox}>
                                {!supersetInfo && prevExercise && (
                                    <Pressable
                                        style={styles.prevExerciseInline}
                                        onPress={() => {
                                            const newIdx = exerciseIndex - 1;
                                            setExerciseIndex(newIdx);
                                            const doneCount = (completedSets.get(`${newIdx}`) || []).length;
                                            setCurrentSetIndex(doneCount);
                                            setSupersetPhase('A');
                                            setSupersetSetIndex(doneCount);
                                        }}
                                    >
                                        <Text style={styles.prevExerciseLabel}>← PREV</Text>
                                        <Text style={styles.prevExerciseNameInline} numberOfLines={1}>
                                            {prevExercise.name}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>

                            {/* SET Indicator - Centered */}
                            <View style={styles.setIndicatorCenter}>
                                <Text style={styles.setNumber}>
                                    SET {(supersetInfo ? supersetSetIndex : currentSetIndex) + 1}
                                    <Text style={styles.setTotal}> / {activeExercise?.sets.length || totalSets}</Text>
                                </Text>
                            </View>

                            {/* NEXT Exercise */}
                            <View style={styles.navExerciseBox}>
                                {!supersetInfo && nextExercise && (
                                    <Pressable
                                        style={styles.nextExerciseInline}
                                        onPress={() => {
                                            const newIdx = exerciseIndex + 1;
                                            setExerciseIndex(newIdx);
                                            const doneCount = (completedSets.get(`${newIdx}`) || []).length;
                                            setCurrentSetIndex(doneCount);
                                            setSupersetPhase('A');
                                            setSupersetSetIndex(doneCount);
                                        }}
                                    >
                                        <Text style={styles.nextExerciseLabel}>NEXT →</Text>
                                        <Text style={styles.nextExerciseNameInline} numberOfLines={1}>
                                            {nextExercise.name}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>

                        {/* Set Progress Dots */}
                        <View style={styles.setDotsContainer}>
                            {activeExercise?.sets.map((_, idx) => {
                                const activeSetIdx = supersetInfo ? supersetSetIndex : currentSetIndex;
                                return (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.setDot,
                                            idx < activeSetIdx && styles.setDotComplete,
                                            idx === activeSetIdx && styles.setDotCurrent,
                                        ]}
                                    />
                                );
                            })}
                        </View>

                        {/* Horizontal Reps × Weight Display */}
                        <View style={styles.repsWeightRow}>
                            {/* Reps Section */}
                            <View style={styles.repsSection}>
                                <Text style={styles.sectionLabel}>REPS</Text>
                                <View style={styles.valueWithButtons}>
                                    <View style={styles.repWithTarget}>
                                        <Text style={styles.bigNumber}>{repCount}</Text>
                                        <Text style={styles.targetRepsHint}>/ {targetReps}</Text>
                                    </View>
                                    <View style={styles.verticalButtons}>
                                        <Pressable style={styles.tinyButton} onPress={handleAddRep}>
                                            <Text style={styles.tinyButtonText}>+</Text>
                                        </Pressable>
                                        <Pressable style={styles.tinyButton} onPress={handleRemoveRep}>
                                            <Text style={styles.tinyButtonText}>−</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            {/* Multiplier */}
                            <Text style={styles.multiplier}>×</Text>

                            {/* Weight Section */}
                            <View style={styles.repsSection}>
                                <Text style={styles.sectionLabel}>WEIGHT</Text>
                                <View style={styles.valueWithButtons}>
                                    <View style={styles.weightInputInline}>
                                        <TextInput
                                            style={styles.bigNumberInput}
                                            value={currentWeight > 0 ? currentWeight.toString() : ''}
                                            onChangeText={(text) => setCurrentWeight(parseFloat(text) || 0)}
                                            keyboardType="numeric"
                                            returnKeyType="done"
                                            onSubmitEditing={Keyboard.dismiss}
                                            placeholder="0"
                                            placeholderTextColor="#71717a"
                                        />
                                        <Text style={styles.lbsLabel}>lbs</Text>
                                    </View>
                                    <View style={styles.verticalButtons}>
                                        <Pressable style={styles.tinyButton} onPress={() => setCurrentWeight(prev => prev + 5)}>
                                            <Text style={styles.tinyButtonText}>+</Text>
                                        </Pressable>
                                        <Pressable style={styles.tinyButton} onPress={() => setCurrentWeight(prev => Math.max(0, prev - 5))}>
                                            <Text style={styles.tinyButtonText}>−</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Last Weight Hint */}
                        {lastWeight !== null && (
                            <Text style={styles.lastWeightHint}>Last: {lastWeight} lbs</Text>
                        )}

                        {currentSet?.notes && (
                            <Text style={styles.setNotes}>📝 {currentSet.notes}</Text>
                        )}
                    </View>
                </View>


                {/* Celebration Animation Overlay */}
                {showCelebration && (
                    <Animated.View
                        style={[
                            styles.celebrationOverlay,
                            {
                                transform: [
                                    { scale: celebrationScale },
                                    { translateY: celebrationY },
                                ],
                                opacity: celebrationOpacity,
                            },
                        ]}
                        pointerEvents="none"
                    >
                        <Text style={styles.celebrationText}>{celebrationText}</Text>
                        <Text style={styles.celebrationEmoji}>✓</Text>
                    </Animated.View>
                )}



                {/* Collapsible Workout Overview */}
                <Pressable
                    style={styles.overviewHeader}
                    onPress={() => setWorkoutOverviewExpanded(prev => !prev)}
                >
                    <Text style={styles.overviewHeaderText}>
                        {workoutOverviewExpanded ? '▼' : '▶'} FULL WORKOUT
                    </Text>
                    <Text style={styles.overviewCount}>
                        {exerciseIndex + 1}/{currentDay?.exercises.length || 0}
                    </Text>
                </Pressable>

                {workoutOverviewExpanded && currentDay && (
                    <View style={styles.overviewList}>
                        {currentDay.exercises.map((exercise, idx) => {
                            // Check if exercise has any completed sets (not just if index is lower)
                            const exerciseCompletedSets = completedSets.get(`${idx}`) || [];
                            const isCompleted = exerciseCompletedSets.length >= exercise.sets.length;
                            const hasStarted = exerciseCompletedSets.length > 0;
                            const isCurrent = idx === exerciseIndex;
                            const isExpanded = expandedExerciseIndex === idx;

                            return (
                                <View key={idx}>
                                    <View
                                        style={[
                                            styles.overviewItem,
                                            isCurrent && styles.overviewItemCurrent,
                                        ]}
                                    >
                                        {/* Tappable circle to jump to this exercise */}
                                        <Pressable
                                            style={styles.overviewJumpButton}
                                            onPress={() => {
                                                // Jump to this exercise (keep overview open)
                                                setExerciseIndex(idx);
                                                const doneCount = (completedSets.get(`${idx}`) || []).length;
                                                setCurrentSetIndex(doneCount);
                                                setSupersetPhase('A');
                                                setSupersetSetIndex(doneCount);
                                            }}
                                        >
                                            <Text style={[
                                                styles.overviewStatus,
                                                isCompleted && styles.overviewStatusDone,
                                                hasStarted && !isCompleted && styles.overviewStatusStarted,
                                                isCurrent && styles.overviewStatusCurrent,
                                            ]}>
                                                {isCompleted ? '✓' : isCurrent ? '→' : hasStarted ? '◐' : '○'}
                                            </Text>
                                        </Pressable>

                                        {/* Tappable content to expand/collapse */}
                                        <Pressable
                                            style={styles.overviewItemContentPressable}
                                            onPress={() => setExpandedExerciseIndex(isExpanded ? null : idx)}
                                        >
                                            <View style={styles.overviewItemContent}>
                                                <Text style={[
                                                    styles.overviewItemName,
                                                    isCompleted && styles.overviewItemNameDone,
                                                    isCurrent && styles.overviewItemNameCurrent,
                                                ]}>
                                                    {exercise.name}
                                                </Text>
                                                <Text style={styles.overviewItemSets}>
                                                    {exercise.sets.length} sets
                                                </Text>
                                            </View>
                                            <Text style={styles.overviewExpand}>
                                                {isExpanded ? '▼' : '▶'}
                                            </Text>
                                        </Pressable>
                                    </View>

                                    {/* Expanded Set Details */}
                                    {isExpanded && (
                                        <View style={styles.setDetailsList}>
                                            {exercise.exerciseNotes && (
                                                <Text style={styles.exerciseNotesInList}>
                                                    💡 {exercise.exerciseNotes}
                                                </Text>
                                            )}
                                            {exercise.sets.map((set, setIdx) => {
                                                const exerciseCompletedSets = completedSets.get(`${idx}`) || [];
                                                const completedSetData = exerciseCompletedSets[setIdx];
                                                const isSetCompleted = !!completedSetData;
                                                const isCurrentSet = idx === exerciseIndex && setIdx === currentSetIndex;

                                                return (
                                                    <View key={setIdx} style={[
                                                        styles.setDetailItem,
                                                        isSetCompleted && styles.setDetailItemCompleted,
                                                        isCurrentSet && styles.setDetailItemCurrent,
                                                    ]}>
                                                        <Text style={[
                                                            styles.setDetailStatus,
                                                            isSetCompleted && styles.setDetailStatusCompleted,
                                                            isCurrentSet && styles.setDetailStatusCurrent,
                                                        ]}>
                                                            {isSetCompleted ? '✓' : isCurrentSet ? '→' : '○'}
                                                        </Text>
                                                        <Text style={[
                                                            styles.setDetailNumber,
                                                            isSetCompleted && styles.setDetailNumberCompleted,
                                                        ]}>
                                                            Set {setIdx + 1}
                                                        </Text>
                                                        {isSetCompleted ? (
                                                            <Text style={styles.setDetailCompleted}>
                                                                {completedSetData.reps} × {completedSetData.weight > 0 ? `${completedSetData.weight} lbs` : 'BW'}
                                                            </Text>
                                                        ) : (
                                                            <Text style={[
                                                                styles.setDetailReps,
                                                                isCurrentSet && styles.setDetailRepsCurrent,
                                                            ]}>
                                                                {set.reps} reps
                                                            </Text>
                                                        )}
                                                        {set.type === 'warmup' && (
                                                            <View style={styles.warmupTagSmall}>
                                                                <Text style={styles.warmupTagText}>WARMUP</Text>
                                                            </View>
                                                        )}
                                                        {set.notes && (
                                                            <Text style={styles.setDetailNotes}>
                                                                📝 {set.notes}
                                                            </Text>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Fixed Bottom Action Button */}
            <View style={styles.fixedFooter}>
                <Pressable style={styles.completeButtonFull} onPress={handleCompleteSet}>
                    <Text style={styles.completeButtonText}>LOG {repCount} REPS  →</Text>
                </Pressable>
            </View>

            {/* Notes Modal - Moved to Root */}
            <Modal
                visible={showNotesModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowNotesModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Pressable
                            style={styles.modalOverlay}
                            onPress={() => setShowNotesModal(false)}
                        >
                            <Pressable
                                style={styles.modalContent}
                                onPress={e => e.stopPropagation()}
                            >
                                <Text style={styles.modalTitle}>Session Notes 📝</Text>
                                <TextInput
                                    style={styles.notesInput}
                                    value={sessionNotes}
                                    onChangeText={setSessionNotes}
                                    placeholder="How are you feeling? Any pain or adjustments?"
                                    placeholderTextColor="#71717a"
                                    multiline
                                    autoFocus
                                />
                                <Pressable
                                    style={styles.closeNotesButton}
                                    onPress={() => setShowNotesModal(false)}
                                >
                                    <Text style={styles.closeNotesButtonText}>Save Note</Text>
                                </Pressable>
                            </Pressable>
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
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
        fontSize: 18,
    },
    backButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#27272a',
        borderRadius: 12,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 16,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    backBtn: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 12,
    },
    timerText: {
        color: '#a3e635',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'monospace',
    },

    // Content
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 100,
    },

    // Fixed Footer
    fixedFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#09090b',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#27272a',
    },

    // Progress
    progressSection: {
        marginBottom: 24,
    },
    progressText: {
        color: '#71717a',
        fontSize: 14,
        marginBottom: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#27272a',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#a3e635',
        borderRadius: 2,
    },

    // Exercise Card
    exerciseCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
    },
    exerciseName: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    exerciseNotes: {
        color: '#a1a1aa',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },

    // Set Dots
    setDotsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    setDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#27272a',
    },
    setDotComplete: {
        backgroundColor: '#a3e635',
    },
    setDotCurrent: {
        backgroundColor: '#22d3ee',
    },
    setLabel: {
        color: '#71717a',
        fontSize: 14,
        marginBottom: 20,
    },

    // Rep Counter
    repCounterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    repButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#27272a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    repButtonText: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: '300',
    },
    repDisplay: {
        alignItems: 'center',
    },
    repCount: {
        color: '#ffffff',
        fontSize: 64,
        fontWeight: '800',
        lineHeight: 72,
    },
    repTarget: {
        color: '#71717a',
        fontSize: 20,
    },
    setNotes: {
        color: '#f59e0b',
        fontSize: 14,
        marginTop: 16,
        textAlign: 'center',
    },

    // Action Buttons
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    skipButton: {
        flex: 1,
        backgroundColor: '#27272a',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#a1a1aa',
        fontSize: 16,
        fontWeight: '600',
    },
    completeButton: {
        flex: 2,
        backgroundColor: '#a3e635',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    completeButtonText: {
        color: '#0a0e14',
        fontSize: 16,
        fontWeight: '700',
    },
    completeButtonFull: {
        flex: 1,
        backgroundColor: '#a3e635',
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
    },

    // Next Preview
    nextPreview: {
        backgroundColor: '#18181b',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#22d3ee',
    },
    nextLabel: {
        color: '#71717a',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 4,
    },
    nextExercise: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    nextSets: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 4,
    },

    // Rest Screen
    restContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    restLabel: {
        color: '#22d3ee',
        fontSize: 24,
        fontWeight: '600',
        letterSpacing: 4,
        marginBottom: 16,
    },
    restTimer: {
        color: '#ffffff',
        fontSize: 120,
        fontWeight: '800',
        lineHeight: 130,
    },
    restSeconds: {
        color: '#71717a',
        fontSize: 20,
        marginBottom: 48,
    },
    nextUpContainer: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 32,
    },
    nextUpLabel: {
        color: '#71717a',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
    },
    nextUpExercise: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    skipRestButton: {
        paddingHorizontal: 32,
        paddingVertical: 16,
        backgroundColor: '#27272a',
        borderRadius: 12,
    },
    skipRestButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Header right section
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    // Camera Toggle
    cameraToggle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#27272a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraToggleActive: {
        backgroundColor: '#a3e635',
    },
    cameraToggleText: {
        fontSize: 18,
    },

    // Camera Container
    cameraContainer: {
        width: '100%',
        backgroundColor: '#000000',
        position: 'relative',
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
    },
    cameraRepCount: {
        color: '#a3e635',
        fontSize: 32,
        fontWeight: '800',
    },
    cameraRepLabel: {
        color: '#71717a',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
    },
    weightSection: {
        marginTop: 16,
        marginBottom: 8,
        alignItems: 'center',
    },
    weightLabel: {
        color: '#a1a1aa',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
    },
    weightInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    weightButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(163, 230, 53, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#a3e635',
    },
    weightButtonText: {
        color: '#a3e635',
        fontSize: 24,
        fontWeight: '600',
    },
    weightDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    weightInput: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: '700',
        textAlign: 'center',
        minWidth: 60,
    },
    weightUnit: {
        color: '#71717a',
        fontSize: 16,
        fontWeight: '500',
    },
    lastWeight: {
        color: '#a3e635',
        fontSize: 12,
        marginTop: 8,
        opacity: 0.8,
    },
    // Enhanced Rest Screen
    nextExerciseCard: {
        backgroundColor: 'rgba(39, 39, 42, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginTop: 24,
        marginHorizontal: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    nextExerciseName: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 8,
        textAlign: 'center',
    },
    nextExerciseDetails: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 4,
    },
    restWeightSection: {
        marginTop: 20,
        alignItems: 'center',
        width: '100%',
    },
    restWeightLabel: {
        color: '#a1a1aa',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 12,
    },
    noWeightHint: {
        color: '#71717a',
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic',
    },
    // Inline Rest Banner
    restBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.4)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    restBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    restBannerLabel: {
        color: '#eab308',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    restBannerTimer: {
        color: '#eab308',
        fontSize: 28,
        fontWeight: '800',
    },
    skipRestBannerButton: {
        backgroundColor: 'rgba(234, 179, 8, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    skipRestBannerText: {
        color: '#eab308',
        fontSize: 14,
        fontWeight: '600',
    },
    // Exercise Carousel
    exerciseCarousel: {
        marginBottom: 16,
    },
    currentExerciseCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    // Set Indicator Row (with next exercise inline)
    setIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 8,
    },
    // Next Exercise Inline Preview
    nextExerciseInline: {
        alignItems: 'flex-end',
        opacity: 0.6,
    },
    nextExerciseLabel: {
        color: '#22d3ee',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    nextExerciseNameInline: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    // PREV ← SET → NEXT Three Column Layout
    setNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 8,
    },
    navExerciseBox: {
        flex: 1,
        minHeight: 44,
    },
    prevExerciseInline: {
        alignItems: 'flex-start',
        opacity: 0.6,
    },
    prevExerciseLabel: {
        color: '#22d3ee',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    prevExerciseNameInline: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    setIndicatorCenter: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    // Large Set Indicator
    setIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    setNumber: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 1,
    },
    setTotal: {
        color: '#71717a',
        fontSize: 28,
        fontWeight: '400',
    },
    warmupBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.4)',
    },
    warmupBadgeAbove: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.4)',
        alignSelf: 'center',
        marginBottom: 8,
    },
    warmupBadgeText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    // Horizontal Reps × Weight
    repsWeightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginTop: 16,
        paddingHorizontal: 8,
    },
    repsSection: {
        alignItems: 'center',
    },
    sectionLabel: {
        color: '#71717a',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 6,
    },
    valueWithButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    verticalButtons: {
        flexDirection: 'column',
        gap: 4,
    },
    tinyButton: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: 'rgba(163, 230, 53, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(163, 230, 53, 0.4)',
    },
    tinyButtonText: {
        color: '#a3e635',
        fontSize: 16,
        fontWeight: '700',
    },
    repsInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    smallButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(163, 230, 53, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(163, 230, 53, 0.4)',
    },
    smallButtonText: {
        color: '#a3e635',
        fontSize: 20,
        fontWeight: '600',
    },
    bigNumber: {
        color: '#ffffff',
        fontSize: 36,
        fontWeight: '800',
        minWidth: 50,
        textAlign: 'center',
    },
    repWithTarget: {
        alignItems: 'center',
    },
    targetRepsHint: {
        color: '#52525b',
        fontSize: 12,
        fontWeight: '500',
        marginTop: -4,
    },
    multiplier: {
        color: '#52525b',
        fontSize: 28,
        fontWeight: '300',
    },
    weightInputInline: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    bigNumberInput: {
        color: '#ffffff',
        fontSize: 36,
        fontWeight: '800',
        minWidth: 50,
        textAlign: 'center',
    },
    lbsLabel: {
        color: '#71717a',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 2,
    },
    lastWeightHint: {
        color: '#a3e635',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
        opacity: 0.8,
    },
    // Collapsible Workout Overview
    overviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
    },
    overviewHeaderText: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1,
    },
    overviewCount: {
        color: '#71717a',
        fontSize: 13,
        fontWeight: '500',
    },
    overviewList: {
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        marginTop: 8,
        overflow: 'hidden',
    },
    overviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    overviewItemCurrent: {
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
    },
    overviewStatus: {
        width: 24,
        fontSize: 14,
        textAlign: 'center',
        color: '#52525b',
    },
    overviewStatusDone: {
        color: '#a3e635',
    },
    overviewStatusStarted: {
        color: '#fbbf24',
    },
    overviewStatusCurrent: {
        color: '#22d3ee',
        fontWeight: '700',
    },
    overviewJumpButton: {
        padding: 8,
        marginLeft: -4,
    },
    overviewItemContentPressable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    overviewItemContent: {
        flex: 1,
        marginLeft: 8,
    },
    overviewItemName: {
        color: '#71717a',
        fontSize: 14,
        fontWeight: '500',
    },
    overviewItemNameDone: {
        color: '#52525b',
        textDecorationLine: 'line-through',
    },
    overviewItemNameCurrent: {
        color: '#ffffff',
        fontWeight: '600',
    },
    overviewItemSets: {
        color: '#52525b',
        fontSize: 12,
        marginTop: 2,
    },
    overviewExpand: {
        color: '#52525b',
        fontSize: 12,
        marginLeft: 8,
    },
    // Nested Set Details
    setDetailsList: {
        backgroundColor: '#18181b',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    exerciseNotesInList: {
        color: '#a1a1aa',
        fontSize: 12,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    setDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingLeft: 24,
        gap: 12,
    },
    setDetailNumber: {
        color: '#71717a',
        fontSize: 12,
        fontWeight: '600',
        minWidth: 45,
    },
    setDetailReps: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '500',
    },
    warmupTagSmall: {
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    warmupTagText: {
        color: '#fbbf24',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    setDetailNotes: {
        color: '#71717a',
        fontSize: 11,
        flex: 1,
    },
    // Progressive History - Completed/Current Set Styles
    setDetailItemCompleted: {
        backgroundColor: 'rgba(163, 230, 53, 0.08)',
        borderRadius: 6,
        marginVertical: 2,
    },
    setDetailItemCurrent: {
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        borderRadius: 6,
        marginVertical: 2,
    },
    setDetailStatus: {
        width: 18,
        fontSize: 12,
        textAlign: 'center',
        color: '#52525b',
    },
    setDetailStatusCompleted: {
        color: '#a3e635',
        fontWeight: '700',
    },
    setDetailStatusCurrent: {
        color: '#22d3ee',
        fontWeight: '700',
    },
    setDetailNumberCompleted: {
        color: '#a3e635',
    },
    setDetailCompleted: {
        color: '#a3e635',
        fontSize: 13,
        fontWeight: '600',
    },
    setDetailRepsCurrent: {
        color: '#22d3ee',
        fontWeight: '600',
    },
    // Undo Button
    undoButton: {
        backgroundColor: 'rgba(251, 146, 60, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(251, 146, 60, 0.4)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 16,
    },
    undoButtonText: {
        color: '#fb923c',
        fontSize: 14,
        fontWeight: '600',
    },
    // Celebration Animation
    celebrationOverlay: {
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    celebrationText: {
        color: '#a3e635',
        fontSize: 48,
        fontWeight: '800',
        textShadowColor: 'rgba(163, 230, 53, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    celebrationEmoji: {
        fontSize: 32,
        marginTop: 4,
    },

    // Superset Banner Styles
    supersetBanner: {
        backgroundColor: 'rgba(34, 211, 238, 0.15)',
        borderWidth: 2,
        borderColor: '#22d3ee',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    supersetBannerTitle: {
        color: '#5eead4',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 12,
    },
    supersetPairRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    supersetExerciseBox: {
        flex: 1,
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    supersetExerciseBoxActive: {
        backgroundColor: 'rgba(34, 211, 238, 0.3)',
        borderColor: '#22d3ee',
        borderWidth: 2,
    },
    supersetPhaseLabel: {
        color: '#22d3ee',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    supersetExerciseName: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    supersetArrow: {
        color: '#22d3ee',
        fontSize: 20,
        fontWeight: '700',
    },
    supersetRoundText: {
        color: '#71717a',
        fontSize: 13,
        marginTop: 4,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#18181b',
        borderRadius: 24,
        padding: 24,
        width: '100%',
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    notesInput: {
        backgroundColor: '#27272a',
        borderRadius: 16,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
        minHeight: 150,
        textAlignVertical: 'top',
        marginBottom: 24,
    },
    closeNotesButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    closeNotesButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 16,
    },

    headerIconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27272a',
        borderRadius: 20,
        marginRight: 8,
    },
    headerIconText: {
        fontSize: 18,
    },
});
