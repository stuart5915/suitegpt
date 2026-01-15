import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    Alert,
    Modal,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============ TYPES ============
type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type SetType = 'warmup' | 'working';
type SetTechnique = 'standard' | 'rest_pause' | 'cluster' | 'drop_set';

interface ExerciseSet {
    type: SetType;
    groupId: string; // Unique ID to group sets together
    reps: string;
    repsMin?: number;
    repsMax?: number;
    technique?: SetTechnique;
    toFailure?: boolean;
    slowNegatives?: boolean;
    backOff?: boolean;        // Back-off set (lighter weight)
    holdOnStretch?: boolean;  // Hold on stretch technique
    perArm?: boolean;         // Unilateral work notation
    notes?: string; // Coaching cues for during workout
    minRepsOnly?: number;      // For "15+" notation (minimum reps, no max)
}

interface PlanExercise {
    id: string;
    name: string;
    sets: ExerciseSet[];
    supersetWith?: string;     // ID of exercise this is supersetted with
    exerciseNotes?: string;    // Notes for the whole exercise (e.g. "Row low")
}

interface WorkoutDay {
    name: string;
    dayOfWeek: DayOfWeek | null;
    isRestDay?: boolean;       // Mark as rest day
    preNotes?: string;         // Pre-workout notes (e.g. "5 min cardio, stretch PSOAS")
    gymPreference?: string;    // Preferred gym (e.g. "Crunch", "Fuzion")
    exercises: PlanExercise[];
}

interface SavedPlan {
    id: string;
    name: string;
    days: WorkoutDay[];
    createdAt: Date;
}

// ============ CONSTANTS ============
// UUID generator for Supabase-compatible IDs
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EXERCISE_LIBRARY = [
    { category: 'Chest', exercises: ['Incline Plate Loaded Press', 'Flat Machine Press', 'Hoist Decline Press', 'High Incline Smith Press', 'Standing Cable Fly', 'Pec Dec', 'Bench Press', 'Incline DB Press', 'Cable Flyes', 'Dips', 'Push-ups'] },
    { category: 'Back', exercises: ['Straight Arm EZ Pulldowns', 'Wide Neutral Lat Pulldowns', 'Machine Lat Pulldowns', 'One Arm Plate Loaded Row', 'Chest Supported T-Bar', 'Wide Grip Cable Row', 'High Hammer Row', 'Seated Wide Grip Row', 'Pull-ups', 'Barbell Rows', 'Face Pulls', 'Rack Deads'] },
    { category: 'Shoulders', exercises: ['Standing Machine Laterals', 'Seated Machine Laterals', 'Rear Delt Machine Fly', 'OHP', 'Arnold Press', 'Front Raises', 'Lateral Raises'] },
    { category: 'Legs', exercises: ['Lying Leg Curls', 'Seated Leg Curls', 'Adductor Machine', 'Smith Machine Squats', 'Leg Extensions', 'Hack Squats', 'Bulgarian Split Squats', 'Leg Press', 'DB RDLs', 'Romanian Deadlift', 'Squats', 'Calf Raises', 'Calf Variation 1', 'Calf Variation 2'] },
    { category: 'Arms', exercises: ['Machine Overhead Triceps Ext', 'Single Pulley Pressdowns', 'EZ Bar Pressdowns', 'Rope Pressdowns', 'Tricep Pushdown', 'Skull Crushers', 'Seated Machine Curls', 'Rope Hammer Curls', 'Machine Curls', 'Barbell Curls', 'Hammer Curls', 'Preacher Curls'] },
    { category: 'Core', exercises: ['Core', 'Planks', 'Cable Crunches', 'Hanging Leg Raises', 'Russian Twists', 'Ab Wheel'] },
];

// Superset pair colors for visual distinction
const SUPERSET_COLORS = [
    { bg: '#581c87', border: '#a855f7', text: '#e9d5ff' }, // Purple
    { bg: '#164e63', border: '#22d3ee', text: '#cffafe' }, // Cyan
    { bg: '#166534', border: '#22c55e', text: '#dcfce7' }, // Green
    { bg: '#92400e', border: '#f59e0b', text: '#fef3c7' }, // Amber
    { bg: '#9f1239', border: '#f43f5e', text: '#fce7f3' }, // Rose
    { bg: '#1e3a8a', border: '#3b82f6', text: '#dbeafe' }, // Blue
];
export default function WorkoutScreen() {
    const router = useRouter();

    // Screen state
    const [screenMode, setScreenMode] = useState<'hub' | 'creating' | 'viewing'>('hub');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    // Saved plans
    const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

    // Plan creation wizard
    const [wizardStep, setWizardStep] = useState(1);
    const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
    const [planName, setPlanName] = useState('');
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    // Exercise accordion state
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [advancedSetKey, setAdvancedSetKey] = useState<string | null>(null);
    const [repsEditorKey, setRepsEditorKey] = useState<string | null>(null); // "exerciseId-setType"

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importText, setImportText] = useState(''); // For paste text option
    const [backgroundImport, setBackgroundImport] = useState<{ active: boolean; countdown: number; planName: string }>({ active: false, countdown: 0, planName: '' });

    // Note popup state (for viewing mode)
    const [visibleNote, setVisibleNote] = useState<string | null>(null);
    const [expandedViewExercise, setExpandedViewExercise] = useState<string | null>(null); // "dayIndex-exerciseIndex"
    const [supersetDropdownOpen, setSupersetDropdownOpen] = useState<string | null>(null); // "dayIndex-exerciseIndex"
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set()); // Which days are expanded
    const [deleteConfirmPlanId, setDeleteConfirmPlanId] = useState<string | null>(null); // For delete confirmation modal

    // Day picker modal state
    const [dayPickerPlanId, setDayPickerPlanId] = useState<string | null>(null);
    const [dayCompletionCounts, setDayCompletionCounts] = useState<Map<string, number>>(new Map());

    // Inline plan expansion state (for hub view)
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [expandedHubDayKey, setExpandedHubDayKey] = useState<string | null>(null); // "planId-dayName"

    // Save Success Modal State
    const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
    const [newlySavedPlanId, setNewlySavedPlanId] = useState<string | null>(null);

    // Active plan tracking
    const [activePlanId, setActivePlanId] = useState<string | null>(null);

    // Info tooltip for Step 3
    const [showStep3Info, setShowStep3Info] = useState(false);

    // Plan name editing state (for viewing mode)
    const [editingPlanName, setEditingPlanName] = useState(false);
    const [tempPlanName, setTempPlanName] = useState('');

    // Delete modal animation
    const deleteModalOpacity = useRef(new Animated.Value(0)).current;
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    // Animated dismiss for delete modal
    const showDeleteModal = useCallback((planId: string) => {
        setDeleteConfirmPlanId(planId);
        setDeleteModalVisible(true);
        Animated.timing(deleteModalOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [deleteModalOpacity]);

    const dismissDeleteModal = useCallback((onComplete?: () => void) => {
        Animated.timing(deleteModalOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setDeleteModalVisible(false);
            setDeleteConfirmPlanId(null);
            if (onComplete) onComplete();
        });
    }, [deleteModalOpacity]);

    // Navigation safety
    const isNavigatingRef = useRef(false);

    // Plan session counts (how many times each plan was used)
    const [planSessionCounts, setPlanSessionCounts] = useState<Map<string, number>>(new Map());

    useFocusEffect(
        useCallback(() => {
            if (isNavigatingRef.current) {
                isNavigatingRef.current = false;
                return;
            }
            // Reset to hub when returning to tab
            setScreenMode('hub');
            setSelectedPlanId(null);
            setWizardStep(1);
            setSelectedDays([]);
            setWorkoutDays([]);
            setPlanName('');
            setActiveDayIndex(0);
            setExpandedExerciseId(null);
            setAdvancedSetKey(null);
        }, [])
    );

    // Reset to hub when tab is pressed while already on this screen
    const navigation = useNavigation();
    useEffect(() => {
        const unsubscribe = navigation.addListener('tabPress' as any, () => {
            // Reset to hub when tapping the Workout tab
            setScreenMode('hub');
            setSelectedPlanId(null);
            setExpandedViewExercise(null);
            setSupersetDropdownOpen(null);
        });
        return unsubscribe;
    }, [navigation]);

    // Load saved plans from Supabase on mount
    useEffect(() => {
        const loadPlans = async () => {
            if (__DEV__) console.log('[Workout] loadPlans starting...');
            try {
                // First try to get from Supabase (cloud sync)
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Type cast to work around missing table types (run supabase gen types after migration)
                    const { data, error } = await (supabase as any)
                        .from('saved_workout_templates')
                        .select('*')
                        .order('updated_at', { ascending: false });

                    if (error) throw error;

                    if (data && data.length > 0) {
                        const plans: SavedPlan[] = data.map((row: any) => ({
                            id: row.id,
                            name: row.name,
                            days: row.days as WorkoutDay[],
                            createdAt: new Date(row.created_at),
                        }));
                        setSavedPlans(plans);

                        // Fetch session counts for each plan AND day completion counts
                        const { data: sessions } = await (supabase as any)
                            .from('workout_sessions')
                            .select('plan_id, day_name')
                            .eq('user_id', user.id);

                        if (sessions) {
                            // Count by plan_id
                            const planCounts = new Map<string, number>();
                            sessions.forEach((s: { plan_id: string }) => {
                                if (s.plan_id) {
                                    planCounts.set(s.plan_id, (planCounts.get(s.plan_id) || 0) + 1);
                                }
                            });
                            setPlanSessionCounts(planCounts);

                            // Count by day_name (for completion badges)
                            const dayCounts = new Map<string, number>();
                            sessions.forEach((s: { day_name: string }) => {
                                if (s.day_name) {
                                    dayCounts.set(s.day_name, (dayCounts.get(s.day_name) || 0) + 1);
                                }
                            });
                            setDayCompletionCounts(dayCounts);
                        }
                        // Don't return - continue to load active plan ID
                    }
                }

                // Fall back to local storage if not logged in or no cloud data
                const stored = await AsyncStorage.getItem('opticrep_saved_plans');
                if (stored) {
                    const plans = JSON.parse(stored);
                    setSavedPlans(plans);
                }
            } catch (error) {
                console.error('Failed to load saved plans:', error);
                // Try local storage as fallback
                try {
                    const stored = await AsyncStorage.getItem('opticrep_saved_plans');
                    if (stored) setSavedPlans(JSON.parse(stored));
                } catch (e) { }
            }

            // Load active plan ID (try Supabase first, then local)
            try {
                // Refresh session to get fresh user metadata from server
                const { data: sessionData } = await supabase.auth.refreshSession();
                const user = sessionData?.user;

                if (__DEV__) console.log('[Workout] Loading active plan, user:', user?.id);

                if (user) {
                    // Get from user metadata (should be fresh after refresh)
                    const activePlan = user.user_metadata?.active_plan_id;
                    if (__DEV__) console.log('[Workout] Supabase active_plan_id:', activePlan);
                    if (activePlan) {
                        setActivePlanId(activePlan);
                        // Also save to local storage as backup
                        await AsyncStorage.setItem('opticrep_active_plan_id', activePlan);
                        return;
                    }
                }
                // Fall back to local storage
                const storedActivePlanId = await AsyncStorage.getItem('opticrep_active_plan_id');
                if (__DEV__) console.log('[Workout] AsyncStorage active_plan_id:', storedActivePlanId);
                if (storedActivePlanId) {
                    setActivePlanId(storedActivePlanId);
                }
            } catch (e) {
                console.error('[Workout] Error loading active plan:', e);
            }
        };
        loadPlans();
    }, []);

    // Ref to track if we're doing the initial load (to avoid saving on load)
    const initialLoadRef = useRef(true);

    // Save plans to Supabase whenever they change
    useEffect(() => {
        // Skip saving during initial load
        if (initialLoadRef.current) {
            initialLoadRef.current = false;
            return;
        }

        const savePlans = async () => {
            try {
                // Always save to local storage as backup
                await AsyncStorage.setItem('opticrep_saved_plans', JSON.stringify(savedPlans));

                // Try to sync to Supabase if logged in
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // For simplicity, we'll just ensure all current plans are in Supabase
                    // More complex sync logic would handle conflicts
                    for (const plan of savedPlans) {
                        const { error } = await (supabase as any)
                            .from('saved_workout_templates')
                            .upsert({
                                id: plan.id,
                                user_id: user.id,
                                name: plan.name,
                                days: plan.days,
                            }, { onConflict: 'id' });

                        if (error) console.error('Failed to sync plan:', error);
                    }
                }
            } catch (error) {
                console.error('Failed to save plans:', error);
            }
        };

        if (savedPlans.length > 0) {
            savePlans();
        }
    }, [savedPlans]);

    // Fetch completion counts for each day in a plan
    const fetchDayCompletionCounts = async (planId: string) => {
        const plan = savedPlans.find(p => p.id === planId);
        if (!plan) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await (supabase as any)
                .from('workout_sessions')
                .select('day_name')
                .eq('user_id', user.id);

            // Count occurrences per day name
            const counts = new Map<string, number>();
            plan.days.forEach(day => counts.set(day.name, 0));
            data?.forEach((session: { day_name: string }) => {
                if (counts.has(session.day_name)) {
                    counts.set(session.day_name, (counts.get(session.day_name) || 0) + 1);
                }
            });
            setDayCompletionCounts(counts);
        } catch (error) {
            console.error('Failed to fetch completion counts:', error);
        }
    };

    // ============ HANDLERS ============
    const toggleDay = (day: DayOfWeek) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const startWizard = () => {
        isNavigatingRef.current = true;
        setScreenMode('creating');
        setWizardStep(1);
        setSelectedDays([]);
        setWorkoutDays([]);
        setPlanName('');
    };

    const goToStep2 = () => {
        if (selectedDays.length === 0) {
            Alert.alert('Select Days', 'Please select at least one workout day');
            return;
        }
        const sortedDays = DAYS_OF_WEEK.filter(d => selectedDays.includes(d));
        const defaultNames = sortedDays.length === 1 ? ['Full Body'] :
            sortedDays.length === 2 ? ['Upper Body', 'Lower Body'] :
                sortedDays.length === 3 ? ['Push', 'Pull', 'Legs'] :
                    sortedDays.length === 4 ? ['Upper 1', 'Lower 1', 'Upper 2', 'Lower 2'] :
                        sortedDays.length === 5 ? ['Chest/Tri', 'Back/Bi', 'Shoulders', 'Legs', 'Arms'] :
                            sortedDays.map((d, i) => `Day ${i + 1}`);

        setWorkoutDays(sortedDays.map((day, i) => ({
            name: defaultNames[i] || `Day ${i + 1}`,
            dayOfWeek: day,
            exercises: [],
        })));
        setWizardStep(2);
    };

    const goToStep3 = () => {
        setWizardStep(3);
        setActiveDayIndex(0);
    };

    // ============ AI WORKOUT IMPORT ============
    const parseWorkoutWithAI = async (text: string): Promise<WorkoutDay[] | null> => {
        try {
            const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                Alert.alert('Error', 'Gemini API key not configured');
                return null;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const prompt = `Parse workout plan to JSON array of days.
Day: {name: "muscle group name like Push/Pull/Legs/Back & Biceps" (NOT Monday/Tuesday), isRestDay, preNotes, exercises[]}
Exercise: {id: "ex-1", name, exerciseNotes, supersetWith: "partner id or null", sets[]}
Set: {type: "warmup"|"working", reps: "10", repsMin, repsMax, minRepsOnly, technique: null|"rest_pause"|"cluster"|"drop_set", toFailure, slowNegatives, backOff, holdOnStretch, perArm, notes}

Rules:
- "---superset---" or "Superset with" = link exercises bidirectionally via supersetWith
- "15+" = minRepsOnly:15, reps:"15"
- "8-12" = reps:"10", repsMin:8, repsMax:12
- No exercises = "Rest Day"

Return ONLY valid JSON, no markdown.

${text}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Clean up response - remove markdown code blocks if present
            let jsonText = responseText.trim();
            if (__DEV__) console.log('Raw response length:', jsonText.length);

            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.slice(7);
            }
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.slice(3);
            }
            if (jsonText.endsWith('```')) {
                jsonText = jsonText.slice(0, -3);
            }
            jsonText = jsonText.trim();

            // Try to find the JSON array even if response has extra text
            const arrayStart = jsonText.indexOf('[');
            const arrayEnd = jsonText.lastIndexOf(']');
            if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
                jsonText = jsonText.substring(arrayStart, arrayEnd + 1);
            }

            if (__DEV__) console.log('Cleaned JSON length:', jsonText.length);

            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (parseErr) {
                console.error('JSON parse failed. First 500 chars:', jsonText.substring(0, 500));
                console.error('Last 500 chars:', jsonText.substring(jsonText.length - 500));
                Alert.alert('Parse Error', 'AI returned invalid JSON. Try pasting a smaller section of your workout.');
                return null;
            }

            // Transform to our WorkoutDay format with proper IDs
            const days: WorkoutDay[] = parsed.map((day: any, dayIndex: number) => ({
                name: day.name || `Day ${dayIndex + 1}`,
                dayOfWeek: DAYS_OF_WEEK[dayIndex] || null,
                isRestDay: day.isRestDay || false,
                preNotes: day.preNotes || '',
                exercises: (day.exercises || []).map((ex: any, exIndex: number) => ({
                    // Preserve AI-generated ID for superset linking, or generate new one
                    id: ex.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: ex.name,
                    exerciseNotes: ex.exerciseNotes || '',
                    supersetWith: ex.supersetWith || undefined, // Preserve superset link
                    sets: (ex.sets || []).map((set: any, setIndex: number) => ({
                        type: set.type || 'working',
                        groupId: `g-${Date.now()}-${setIndex}`,
                        reps: set.reps || '10',
                        repsMin: set.repsMin,
                        repsMax: set.repsMax,
                        minRepsOnly: set.minRepsOnly,
                        technique: set.technique,
                        toFailure: set.toFailure,
                        slowNegatives: set.slowNegatives,
                        backOff: set.backOff,
                        holdOnStretch: set.holdOnStretch,
                        perArm: set.perArm,
                        notes: set.notes,
                    })),
                })),
            }));

            return days;
        } catch (error) {
            console.error('AI parsing error:', error);
            Alert.alert('Import Error', 'Failed to parse workout. Please try again.');
            return null;
        }
    };

    const handleImportFromText = async () => {
        if (!importText.trim()) {
            Alert.alert('Error', 'Please paste your workout plan text');
            return;
        }

        // Close modal and start background import
        const textToImport = importText;
        setShowImportModal(false);
        setImportText('');
        setScreenMode('hub');

        // Start countdown (estimate 25 seconds)
        const estimatedTime = 25;
        setBackgroundImport({ active: true, countdown: estimatedTime, planName: 'Analyzing workout...' });

        // Start countdown timer
        const countdownInterval = setInterval(() => {
            setBackgroundImport(prev => ({
                ...prev,
                countdown: Math.max(0, prev.countdown - 1)
            }));
        }, 1000);

        // Add timeout to prevent getting stuck
        const timeoutId = setTimeout(() => {
            clearInterval(countdownInterval);
            setBackgroundImport({ active: false, countdown: 0, planName: '' });
            Alert.alert('Timeout', 'AI took too long. Please try again.');
        }, 90000); // 90 second timeout

        try {
            // Run AI parsing in background
            const days = await parseWorkoutWithAI(textToImport);

            // Clear timeout and countdown
            clearTimeout(timeoutId);
            clearInterval(countdownInterval);

            if (days && days.length > 0) {
                // Auto-save the imported plan
                const defaultName = days[0]?.name?.includes('-')
                    ? days[0].name.split('-')[0].trim() + ' Program'
                    : days.length === 1 ? 'Full Body Program'
                        : `${days.length}-Day Program`;
                const newPlan: SavedPlan = {
                    id: generateUUID(),
                    name: defaultName,
                    days: days,
                    createdAt: new Date(),
                };
                setSavedPlans(prev => [...prev, newPlan]);
                setBackgroundImport({ active: false, countdown: 0, planName: '' });
            } else {
                setBackgroundImport({ active: false, countdown: 0, planName: '' });
                Alert.alert('Import Error', 'Failed to parse workout. Please try again.');
            }
        } catch (error) {
            console.error('Import error:', error);
            clearTimeout(timeoutId);
            clearInterval(countdownInterval);
            setBackgroundImport({ active: false, countdown: 0, planName: '' });
            Alert.alert('Import Error', 'Something went wrong. Please try again.');
        }
    };

    const handleImportFromCamera = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission needed', 'Camera permission is required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
            setIsImporting(true);
            // For now, use OCR via Gemini Vision
            const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
            if (apiKey) {
                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const response = await model.generateContent([
                        'Extract all text from this workout plan image. Return just the raw text.',
                        { inlineData: { mimeType: 'image/jpeg', data: result.assets[0].base64 } }
                    ]);
                    const extractedText = response.response.text();
                    const days = await parseWorkoutWithAI(extractedText);
                    setIsImporting(false);
                    if (days && days.length > 0) {
                        setWorkoutDays(days);
                        setSelectedDays(days.map((_, i) => DAYS_OF_WEEK[i]).filter((d): d is DayOfWeek => !!d));
                        setShowImportModal(false);
                        setWizardStep(3);
                        Alert.alert('Success!', `Imported ${days.length} workout days from photo`);
                    }
                } catch (e) {
                    setIsImporting(false);
                    Alert.alert('Error', 'Failed to process image');
                }
            }
        }
    };

    const handleImportFromFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/plain', 'application/pdf'],
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets[0]) {
                setIsImporting(true);
                // For text files, read content directly; for PDFs, use Gemini Vision
                const file = result.assets[0];
                if (file.mimeType === 'text/plain') {
                    const response = await fetch(file.uri);
                    const text = await response.text();
                    const days = await parseWorkoutWithAI(text);
                    setIsImporting(false);
                    if (days && days.length > 0) {
                        setWorkoutDays(days);
                        setSelectedDays(days.map((_, i) => DAYS_OF_WEEK[i]).filter((d): d is DayOfWeek => !!d));
                        setShowImportModal(false);
                        setWizardStep(3);
                        Alert.alert('Success!', `Imported ${days.length} workout days`);
                    }
                } else {
                    setIsImporting(false);
                    Alert.alert('PDF Support', 'PDF parsing coming soon! Please paste the text for now.');
                }
            }
        } catch (e) {
            setIsImporting(false);
            Alert.alert('Error', 'Failed to read file');
        }
    };

    const addExercise = (exerciseName: string) => {
        // Check if exercise already exists in current day
        const currentDay = workoutDays[activeDayIndex];
        const existingExercise = currentDay?.exercises.find(e => e.name === exerciseName);

        if (existingExercise) {
            // If exists, toggle it off (remove)
            removeExercise(existingExercise.id);
            return;
        }

        const groupId = `g-${Date.now()}`;
        const newExercise: PlanExercise = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: exerciseName,
            sets: [{ type: 'working', groupId, reps: '10' }],
        };
        setWorkoutDays(prev => prev.map((day, i) =>
            i === activeDayIndex ? { ...day, exercises: [...day.exercises, newExercise] } : day
        ));
        // Auto-expand new exercise
        setExpandedExerciseId(newExercise.id);
    };

    const removeExercise = (exerciseId: string) => {
        setWorkoutDays(prev => prev.map((day, i) =>
            i === activeDayIndex ? { ...day, exercises: day.exercises.filter(e => e.id !== exerciseId) } : day
        ));
        if (expandedExerciseId === exerciseId) setExpandedExerciseId(null);
    };

    const handleSavePlan = () => {
        const defaultName = workoutDays.length === 1 ? 'Full Body Program' :
            workoutDays.length === 2 ? 'Upper/Lower Split' :
                workoutDays.length === 3 ? 'Push Pull Legs' :
                    `${workoutDays.length}-Day Split`;

        const newPlan: SavedPlan = {
            id: generateUUID(),
            name: planName.trim() || defaultName,
            days: workoutDays,
            createdAt: new Date(),
        };
        setSavedPlans(prev => [...prev, newPlan]);
        setScreenMode('hub');
        // Trigger custom success modal instead of Alert
        setNewlySavedPlanId(newPlan.id);
        setShowSaveSuccessModal(true);
    };

    const viewPlan = (planId: string) => {
        isNavigatingRef.current = true;
        setSelectedPlanId(planId);
        setScreenMode('viewing');
    };

    const deletePlan = (planId: string) => {
        showDeleteModal(planId);
    };

    const setAsActivePlan = async (planId: string) => {
        const newActiveId = activePlanId === planId ? null : planId;
        setActivePlanId(newActiveId);

        // Save locally
        try {
            if (newActiveId) {
                await AsyncStorage.setItem('opticrep_active_plan_id', newActiveId);
                if (__DEV__) console.log('[Workout] Saved active plan to AsyncStorage:', newActiveId);
            } else {
                await AsyncStorage.removeItem('opticrep_active_plan_id');
                if (__DEV__) console.log('[Workout] Removed active plan from AsyncStorage');
            }
        } catch (e) {
            console.error('[Workout] Failed to save active plan locally:', e);
        }

        // Sync to Supabase user metadata for cross-device persistence
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase.auth.updateUser({
                    data: { active_plan_id: newActiveId }
                });
                if (error) {
                    console.error('[Workout] Supabase updateUser error:', error);
                } else {
                    if (__DEV__) console.log('[Workout] Synced active plan to Supabase:', newActiveId);
                    if (__DEV__) console.log('[Workout] Updated user metadata:', data?.user?.user_metadata);
                }
            } else {
                if (__DEV__) console.log('[Workout] No user logged in, skipping cloud sync');
            }
        } catch (e) {
            console.error('[Workout] Failed to sync active plan to cloud:', e);
        }
    };

    const confirmDelete = async () => {
        if (deleteConfirmPlanId) {
            // Delete from Supabase first
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error } = await (supabase as any)
                        .from('saved_workout_templates')
                        .delete()
                        .eq('id', deleteConfirmPlanId);
                    if (error) {
                        console.error('Supabase delete error:', error);
                    } else {
                        if (__DEV__) console.log('Successfully deleted from Supabase:', deleteConfirmPlanId);
                    }
                }
            } catch (error) {
                console.error('Failed to delete from Supabase:', error);
            }

            // Also delete from local storage
            try {
                const stored = await AsyncStorage.getItem('opticrep_saved_plans');
                if (stored) {
                    const plans = JSON.parse(stored);
                    const filtered = plans.filter((p: SavedPlan) => p.id !== deleteConfirmPlanId);
                    await AsyncStorage.setItem('opticrep_saved_plans', JSON.stringify(filtered));
                }
            } catch (error) {
                console.error('Failed to delete from AsyncStorage:', error);
            }

            // Update local state
            setSavedPlans(prev => prev.filter(p => p.id !== deleteConfirmPlanId));
            if (selectedPlanId === deleteConfirmPlanId) setScreenMode('hub');
        }
    };

    // Wrap confirmDelete to animate dismiss
    const handleConfirmDelete = () => {
        dismissDeleteModal(() => {
            confirmDelete();
        });
    };

    const handleCancelDelete = () => {
        dismissDeleteModal();
    };

    // Link or unlink superset between two exercises within a saved plan
    const linkSuperset = (planId: string, dayIndex: number, exIndex1: number, exIndex2: number | null) => {
        setSavedPlans(prev => prev.map(plan => {
            if (plan.id !== planId) return plan;

            const newDays = [...plan.days];
            const day = { ...newDays[dayIndex], exercises: [...newDays[dayIndex].exercises] };
            newDays[dayIndex] = day;

            const ex1 = { ...day.exercises[exIndex1] };
            day.exercises[exIndex1] = ex1;

            if (exIndex2 === null) {
                // Unlink - clear superset for both exercises
                if (ex1.supersetWith) {
                    const linkedIdx = day.exercises.findIndex(e => e.id === ex1.supersetWith);
                    if (linkedIdx !== -1) {
                        const linkedEx = { ...day.exercises[linkedIdx], supersetWith: undefined };
                        day.exercises[linkedIdx] = linkedEx;
                    }
                }
                ex1.supersetWith = undefined;
            } else {
                // Link the two exercises
                const ex2 = { ...day.exercises[exIndex2] };
                day.exercises[exIndex2] = ex2;
                ex1.supersetWith = ex2.id;
                ex2.supersetWith = ex1.id;
            }

            return { ...plan, days: newDays };
        }));
    };

    // Update plan name
    const updatePlanName = (planId: string, newName: string) => {
        const trimmedName = newName.trim();
        if (!trimmedName) return; // Don't allow empty names

        setSavedPlans(prev => prev.map(plan =>
            plan.id === planId ? { ...plan, name: trimmedName } : plan
        ));
        setEditingPlanName(false);
    };

    // ============ RENDER: HUB ============
    if (screenMode === 'hub') {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Workout</Text>
                        <Text style={styles.subtitle}>Your training plans</Text>
                    </View>

                    {/* Your Plans Section - Main Focus */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Plans</Text>

                        {savedPlans.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateEmoji}>🏋️</Text>
                                <Text style={styles.emptyStateText}>No plans yet</Text>
                                <Text style={styles.emptyStateHint}>Create or import your first workout plan below</Text>
                            </View>
                        ) : (
                            // Sort plans with active plan first
                            [...savedPlans].sort((a, b) => {
                                if (a.id === activePlanId) return -1;
                                if (b.id === activePlanId) return 1;
                                return 0;
                            }).map(plan => {
                                const isExpanded = expandedPlanId === plan.id;
                                const isActive = activePlanId === plan.id;
                                return (
                                    <View key={plan.id} style={[styles.planCard, isExpanded && styles.planCardExpanded, isActive && styles.planCardActive]}>
                                        <Pressable
                                            style={styles.planCardHeaderRow}
                                            onPress={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                    <Text style={styles.planCardName} numberOfLines={1}>{plan.name}</Text>
                                                    {isActive && (
                                                        <View style={styles.activeBadge}>
                                                            <Text style={styles.activeBadgeText}>⭐ ACTIVE</Text>
                                                        </View>
                                                    )}
                                                    {planSessionCounts.get(plan.id) && planSessionCounts.get(plan.id)! > 0 && (
                                                        <View style={styles.sessionCountBadge}>
                                                            <Text style={styles.sessionCountText}>
                                                                {planSessionCounts.get(plan.id)}×
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.planCardDays}>{plan.days.filter(d => !d.isRestDay).length} days • {isExpanded ? 'tap to collapse' : 'tap to expand'}</Text>
                                            </View>

                                            {/* Header Action Icons */}
                                            <View style={styles.planHeaderActions}>
                                                <Pressable
                                                    style={styles.planHeaderIcon}
                                                    onPress={(e) => { e.stopPropagation(); setAsActivePlan(plan.id); }}
                                                >
                                                    <Text style={[styles.planHeaderIconText, isActive && styles.planHeaderIconActive]}>
                                                        {isActive ? '★' : '☆'}
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    style={styles.planHeaderIcon}
                                                    onPress={(e) => { e.stopPropagation(); viewPlan(plan.id); }}
                                                >
                                                    <Text style={styles.planHeaderIconText}>⚙️</Text>
                                                </Pressable>
                                            </View>

                                            <Text style={styles.planCardToggle}>{isExpanded ? '▲' : '▼'}</Text>
                                        </Pressable>

                                        {/* Inline Day List when expanded */}
                                        {isExpanded && (
                                            <View style={styles.inlineDayList}>
                                                {plan.days
                                                    .filter(day => !day.isRestDay && day.exercises.length > 0)
                                                    .map((day, index) => {
                                                        const dayKey = `${plan.id}-${day.name}`;
                                                        const isDayExpanded = expandedHubDayKey === dayKey;
                                                        const originalIndex = plan.days.findIndex(d => d.name === day.name);

                                                        return (
                                                            <View key={index} style={[styles.inlineDayCard, isDayExpanded && styles.inlineDayCardExpanded]}>
                                                                <View style={styles.inlineDayHeader}>
                                                                    <Pressable
                                                                        style={styles.inlineDayHeaderLeft}
                                                                        onPress={() => setExpandedHubDayKey(isDayExpanded ? null : dayKey)}
                                                                    >
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                            <Text style={styles.inlineDayName}>{day.name}</Text>
                                                                            {(dayCompletionCounts.get(day.name) || 0) > 0 && (
                                                                                <View style={styles.dayCompletionBadge}>
                                                                                    <Text style={styles.dayCompletionText}>
                                                                                        ×{dayCompletionCounts.get(day.name)}
                                                                                    </Text>
                                                                                </View>
                                                                            )}
                                                                        </View>
                                                                        <Text style={styles.inlineDayInfo}>{day.exercises.length} exercises</Text>
                                                                    </Pressable>
                                                                    <Pressable
                                                                        style={styles.dayStartBtn}
                                                                        onPress={() => router.push(`/warm-up?planId=${plan.id}&dayIndex=${originalIndex}&dayName=${encodeURIComponent(day.name)}`)}
                                                                    >
                                                                        <Text style={styles.dayStartBtnText}>Start</Text>
                                                                    </Pressable>
                                                                </View>

                                                                {/* Inline exercise list when day is expanded */}
                                                                {isDayExpanded && (
                                                                    <View style={styles.inlineExerciseList}>
                                                                        {day.exercises.map((ex, exIdx) => (
                                                                            <View key={exIdx} style={styles.inlineExerciseItem}>
                                                                                <Text style={styles.inlineExerciseName}>{ex.name}</Text>
                                                                                <Text style={styles.inlineExerciseSets}>{ex.sets.length} sets</Text>
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                )}
                                                            </View>
                                                        );
                                                    })}

                                                {/* Delete option - simple text link */}
                                                <Pressable
                                                    style={styles.deleteLink}
                                                    onPress={() => deletePlan(plan.id)}
                                                >
                                                    <Text style={styles.deleteLinkText}>Delete Plan</Text>
                                                </Pressable>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* Background Import Progress Card */}
                    {
                        backgroundImport.active && (
                            <View style={styles.importProgressCard}>
                                <View style={styles.importProgressHeader}>
                                    <Text style={styles.importProgressIcon}>🔄</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.importProgressTitle}>AI Analyzing Workout</Text>
                                        <Text style={styles.importProgressSubtitle}>
                                            {backgroundImport.countdown > 0
                                                ? `~${backgroundImport.countdown}s remaining`
                                                : 'Almost done...'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.importProgressBar}>
                                    <View style={[
                                        styles.importProgressFill,
                                        { width: `${Math.max(5, 100 - (backgroundImport.countdown / 25 * 100))}%` }
                                    ]} />
                                </View>
                            </View>
                        )
                    }

                    {/* Compact Action Buttons */}
                    <View style={styles.compactActionsSection}>
                        <Text style={styles.compactActionsLabel}>Add New</Text>
                        <View style={styles.compactActionsRow}>
                            <Pressable style={styles.compactActionBtn} onPress={() => router.push('/template-selection')}>
                                <Text style={styles.compactActionIcon}>+</Text>
                                <Text style={styles.compactActionText}>Create</Text>
                            </Pressable>
                            <Pressable style={styles.compactActionBtn} onPress={() => setShowImportModal(true)}>
                                <Text style={styles.compactActionIcon}>📷</Text>
                                <Text style={styles.compactActionText}>Import</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Import Modal */}
                    <Modal visible={showImportModal} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.importModalContent}>
                                <View style={styles.importModalHeader}>
                                    <Text style={styles.importModalTitle}>Import Workout</Text>
                                    <Pressable onPress={() => setShowImportModal(false)}>
                                        <Text style={styles.importModalClose}>✕</Text>
                                    </Pressable>
                                </View>

                                {isImporting ? (
                                    <View style={styles.importLoading}>
                                        <ActivityIndicator size="large" color="#a3e635" />
                                        <Text style={styles.importLoadingText}>AI is parsing your workout...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Pressable style={styles.importOption} onPress={handleImportFromCamera}>
                                            <Text style={styles.importOptionIcon}>📷</Text>
                                            <View>
                                                <Text style={styles.importOptionTitle}>Take Photo</Text>
                                                <Text style={styles.importOptionSubtitle}>Point camera at your workout PDF</Text>
                                            </View>
                                        </Pressable>

                                        <Pressable style={styles.importOption} onPress={handleImportFromFile}>
                                            <Text style={styles.importOptionIcon}>📁</Text>
                                            <View>
                                                <Text style={styles.importOptionTitle}>Upload File</Text>
                                                <Text style={styles.importOptionSubtitle}>Select a text file</Text>
                                            </View>
                                        </Pressable>

                                        <View style={styles.importDivider}>
                                            <Text style={styles.importDividerText}>or paste text</Text>
                                        </View>

                                        <TextInput
                                            style={styles.importTextInput}
                                            placeholder="Paste your workout plan here..."
                                            placeholderTextColor="#71717a"
                                            value={importText}
                                            onChangeText={setImportText}
                                            multiline
                                            numberOfLines={6}
                                        />

                                        <Pressable style={styles.importSubmitBtn} onPress={handleImportFromText}>
                                            <Text style={styles.importSubmitBtnText}>Import from Text</Text>
                                        </Pressable>
                                    </>
                                )}
                            </View>
                        </View>
                    </Modal>
                </ScrollView >

                {/* Day Picker Modal */}
                < Modal visible={dayPickerPlanId !== null
                } transparent animationType="slide" >
                    <View style={styles.dayPickerOverlay}>
                        <View style={styles.dayPickerContent}>
                            <View style={styles.dayPickerHeader}>
                                <Text style={styles.dayPickerTitle}>Choose Your Day</Text>
                                <Pressable onPress={() => setDayPickerPlanId(null)}>
                                    <Text style={styles.dayPickerClose}>✕</Text>
                                </Pressable>
                            </View>
                            <ScrollView style={styles.dayPickerList}>
                                {(() => {
                                    const selectedPlan = savedPlans.find(p => p.id === dayPickerPlanId);
                                    if (!selectedPlan) return null;
                                    // Filter out rest days and days with no exercises
                                    return selectedPlan.days
                                        .map((day, index) => ({ day, index }))
                                        .filter(({ day }) => !day.isRestDay && day.exercises.length > 0)
                                        .map(({ day, index }) => (
                                            <Pressable
                                                key={index}
                                                style={styles.dayPickerItem}
                                                onPress={() => {
                                                    router.push(`/warm-up?planId=${dayPickerPlanId}&dayIndex=${index}&dayName=${encodeURIComponent(day.name)}`);
                                                    setDayPickerPlanId(null);
                                                }}
                                            >
                                                <View style={styles.dayPickerItemLeft}>
                                                    <Text style={styles.dayPickerItemName}>{day.name}</Text>
                                                    <Text style={styles.dayPickerItemInfo}>
                                                        {day.exercises.length} exercises
                                                    </Text>
                                                </View>
                                                <View style={styles.dayPickerItemRight}>
                                                    <Text style={styles.dayPickerCompletedCount}>
                                                        {dayCompletionCounts.get(day.name) || 0}× done
                                                    </Text>
                                                    <Text style={styles.dayPickerArrow}>→</Text>
                                                </View>
                                            </Pressable>
                                        ));
                                })()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal >

                {/* Save Success Modal */}
                < Modal
                    visible={showSaveSuccessModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowSaveSuccessModal(false)
                    }
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.successModalContent}>
                            <Text style={styles.successModalIcon}>🎉</Text>
                            <Text style={styles.successModalTitle}>Plan Created!</Text>
                            <Text style={styles.successModalMessage}>
                                Your workout has been saved successfully. What would you like to do next?
                            </Text>
                            <View style={styles.successModalButtons}>
                                <Pressable
                                    style={styles.successModalHubBtn}
                                    onPress={() => {
                                        setShowSaveSuccessModal(false);
                                        setNewlySavedPlanId(null);
                                    }}
                                >
                                    <Text style={styles.successModalHubBtnText}>Browsing</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.successModalStartBtn}
                                    onPress={() => {
                                        if (newlySavedPlanId) {
                                            setShowSaveSuccessModal(false);
                                            setDayPickerPlanId(newlySavedPlanId);
                                            fetchDayCompletionCounts(newlySavedPlanId);
                                            setNewlySavedPlanId(null);
                                        }
                                    }}
                                >
                                    <Text style={styles.successModalStartBtnText}>Start Plan</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal >
            </SafeAreaView >
        );
    }

    // ============ RENDER: VIEW PLAN ============
    if (screenMode === 'viewing' && selectedPlanId) {
        const plan = savedPlans.find(p => p.id === selectedPlanId);
        if (!plan) return null;

        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.wizardHeader}>
                    <Pressable onPress={() => {
                        setEditingPlanName(false);
                        setScreenMode('hub');
                    }}>
                        <Text style={styles.backBtn}>← Back</Text>
                    </Pressable>

                    {editingPlanName ? (
                        <View style={styles.editPlanNameRow}>
                            <TextInput
                                style={styles.editPlanNameInput}
                                value={tempPlanName}
                                onChangeText={setTempPlanName}
                                autoFocus
                                selectTextOnFocus
                                returnKeyType="done"
                                onSubmitEditing={() => updatePlanName(plan.id, tempPlanName)}
                            />
                            <Pressable
                                style={styles.editPlanNameSaveBtn}
                                onPress={() => updatePlanName(plan.id, tempPlanName)}
                            >
                                <Text style={styles.editPlanNameSaveBtnText}>Save</Text>
                            </Pressable>
                            <Pressable
                                style={styles.editPlanNameCancelBtn}
                                onPress={() => setEditingPlanName(false)}
                            >
                                <Text style={styles.editPlanNameCancelBtnText}>✕</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            style={styles.editPlanNameTappable}
                            onPress={() => {
                                setTempPlanName(plan.name);
                                setEditingPlanName(true);
                            }}
                        >
                            <Text style={styles.wizardTitle}>{plan.name}</Text>
                            <Text style={styles.editPlanNameIcon}>✏️</Text>
                        </Pressable>
                    )}
                </View>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {plan.days.map((day, dayIndex) => {
                        const isDayExpanded = expandedDays.has(dayIndex);
                        const toggleDay = () => {
                            setExpandedDays(prev => {
                                const next = new Set(prev);
                                if (next.has(dayIndex)) {
                                    next.delete(dayIndex);
                                } else {
                                    next.add(dayIndex);
                                }
                                return next;
                            });
                        };

                        return (
                            <View key={dayIndex} style={styles.viewDayCard}>
                                <Pressable style={styles.viewDayHeader} onPress={toggleDay}>
                                    <View>
                                        <Text style={styles.viewDayName}>{day.name}</Text>
                                        <Text style={styles.viewDaySchedule}>
                                            {day.dayOfWeek} • {day.exercises.length} exercises
                                        </Text>
                                    </View>
                                    <Text style={styles.viewDayToggle}>{isDayExpanded ? '▲' : '▼'}</Text>
                                </Pressable>

                                {!isDayExpanded ? null : day.exercises.length === 0 ? (
                                    <Text style={styles.viewNoExercises}>No exercises</Text>
                                ) : (() => {
                                    // Compute superset pair indices for colors
                                    const supersetPairs: { [key: string]: number } = {};
                                    let pairIndex = 0;
                                    day.exercises.forEach((ex, idx) => {
                                        if (ex.supersetWith && !supersetPairs[ex.id]) {
                                            const pairId = [ex.id, ex.supersetWith].sort().join('-');
                                            if (!supersetPairs[pairId]) {
                                                supersetPairs[pairId] = pairIndex++;
                                            }
                                            supersetPairs[ex.id] = supersetPairs[pairId];
                                            supersetPairs[ex.supersetWith] = supersetPairs[pairId];
                                        }
                                    });

                                    return day.exercises.map((ex, i) => {
                                        // Collect all notes for this exercise
                                        const allNotes: string[] = [];
                                        if (ex.exerciseNotes) allNotes.push(ex.exerciseNotes);
                                        ex.sets.forEach((s, si) => {
                                            if (s.notes) allNotes.push(`Set ${si + 1}: ${s.notes}`);
                                        });
                                        const exerciseKey = `${dayIndex}-${i}`;
                                        const hasNotes = allNotes.length > 0;
                                        const isExpanded = expandedViewExercise === exerciseKey;

                                        // Get superset color for this exercise
                                        const supersetColorIdx = ex.supersetWith ? (supersetPairs[ex.id] ?? 0) % SUPERSET_COLORS.length : -1;
                                        const supersetColor = supersetColorIdx >= 0 ? SUPERSET_COLORS[supersetColorIdx] : null;

                                        return (
                                            <Pressable
                                                key={i}
                                                style={[
                                                    styles.viewExerciseRow,
                                                    isExpanded && styles.viewExerciseRowExpanded,
                                                    supersetColor && { borderLeftWidth: 3, borderLeftColor: supersetColor.border }
                                                ]}
                                                onPress={() => setExpandedViewExercise(isExpanded ? null : exerciseKey)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                        {supersetColor && (
                                                            <View style={[styles.supersetBadge, { backgroundColor: supersetColor.bg, borderColor: supersetColor.border }]}>
                                                                <Text style={[styles.supersetBadgeText, { color: supersetColor.text }]}>SS</Text>
                                                            </View>
                                                        )}
                                                        <Text style={styles.viewExerciseName}>{ex.name}</Text>
                                                        {hasNotes && (
                                                            <Pressable onPress={(e) => { e.stopPropagation(); setVisibleNote(visibleNote === exerciseKey ? null : exerciseKey); }}>
                                                                <Text style={{ fontSize: 14 }}>📝</Text>
                                                            </Pressable>
                                                        )}
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={styles.viewExerciseSets}>
                                                            {ex.sets.length} × {(() => {
                                                                const set = ex.sets[0];
                                                                if (!set) return '10';
                                                                if (set.repsMin && set.repsMax) return `${set.repsMin}-${set.repsMax}`;
                                                                if (set.minRepsOnly) return `${set.minRepsOnly}+`;
                                                                return set.reps || '10';
                                                            })()}
                                                        </Text>
                                                        <Text style={{ color: '#71717a', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                                                    </View>
                                                </View>

                                                {/* Note popup */}
                                                {visibleNote === exerciseKey && (
                                                    <View style={styles.notePopup}>
                                                        {allNotes.map((note, ni) => (
                                                            <Text key={ni} style={styles.notePopupText}>{note}</Text>
                                                        ))}
                                                    </View>
                                                )}

                                                {/* Expanded set details - grouped by type and reps */}
                                                {isExpanded && (
                                                    <View style={styles.setDetailsList}>
                                                        {(() => {
                                                            // Group sets by type + reps + hasNotes
                                                            const groups: { type: string; reps: string; count: number; notes?: string; technique?: string; modifiers: string[] }[] = [];
                                                            ex.sets.forEach(set => {
                                                                const repDisplay = set.repsMin && set.repsMax
                                                                    ? `${set.repsMin}-${set.repsMax}`
                                                                    : set.reps;
                                                                const hasNote = !!(set.notes || set.toFailure || set.slowNegatives || set.holdOnStretch || set.technique);
                                                                const key = `${set.type}-${repDisplay}-${hasNote ? 'noted' : 'plain'}`;

                                                                const existing = groups.find(g =>
                                                                    g.type === set.type &&
                                                                    g.reps === repDisplay &&
                                                                    (hasNote ? !!g.notes : !g.notes)
                                                                );

                                                                if (existing && !hasNote) {
                                                                    existing.count++;
                                                                } else {
                                                                    const modifiers: string[] = [];
                                                                    if (set.toFailure) modifiers.push('💀');
                                                                    if (set.slowNegatives) modifiers.push('🐢');
                                                                    if (set.holdOnStretch) modifiers.push('🧘');
                                                                    groups.push({
                                                                        type: set.type || 'working',
                                                                        reps: repDisplay,
                                                                        count: 1,
                                                                        notes: set.notes,
                                                                        technique: set.technique !== 'standard' ? set.technique : undefined,
                                                                        modifiers
                                                                    });
                                                                }
                                                            });

                                                            return groups.map((group, gi) => (
                                                                <View key={gi} style={styles.setDetailRow}>
                                                                    <View style={[styles.setTypeBadge, group.type === 'warmup' ? styles.warmupBadge : styles.workingBadge]}>
                                                                        <Text style={styles.setTypeBadgeText}>
                                                                            {group.type === 'warmup' ? 'Warm' : 'Work'}
                                                                        </Text>
                                                                    </View>
                                                                    <Text style={styles.setDetailReps}>{group.count} × {group.reps}</Text>
                                                                    {group.technique && (
                                                                        <View style={styles.techniqueBadge}>
                                                                            <Text style={styles.techniqueBadgeText}>{group.technique.replace('_', ' ')}</Text>
                                                                        </View>
                                                                    )}
                                                                    {group.modifiers.map((m, mi) => <Text key={mi} style={styles.modifierIcon}>{m}</Text>)}
                                                                    {group.notes && <Text style={styles.setNote}>💬 {group.notes}</Text>}
                                                                </View>
                                                            ));
                                                        })()}
                                                    </View>
                                                )}

                                                {/* Superset linking section */}
                                                {isExpanded && (
                                                    <View style={styles.supersetSection}>
                                                        {ex.supersetWith ? (
                                                            <View style={styles.supersetLinked}>
                                                                <Text style={styles.supersetLabel}>🔗 Superset with: </Text>
                                                                <Text style={styles.supersetName}>
                                                                    {day.exercises.find(e => e.id === ex.supersetWith)?.name || 'Unknown'}
                                                                </Text>
                                                                <Pressable
                                                                    style={styles.unlinkBtn}
                                                                    onPress={(e) => { e.stopPropagation(); linkSuperset(plan.id, dayIndex, i, null); }}
                                                                >
                                                                    <Text style={styles.unlinkBtnText}>Unlink</Text>
                                                                </Pressable>
                                                            </View>
                                                        ) : supersetDropdownOpen === exerciseKey ? (
                                                            <View>
                                                                <View style={styles.supersetDropdownHeader}>
                                                                    <Text style={styles.supersetDropdownLabel}>🔗 Link superset with:</Text>
                                                                    <Pressable onPress={(e) => { e.stopPropagation(); setSupersetDropdownOpen(null); }}>
                                                                        <Text style={styles.supersetCloseBtn}>✕</Text>
                                                                    </Pressable>
                                                                </View>
                                                                <View style={styles.supersetDropdown}>
                                                                    {day.exercises.map((otherEx, oi) => {
                                                                        if (oi === i) return null;
                                                                        if (otherEx.supersetWith) return null;
                                                                        return (
                                                                            <Pressable
                                                                                key={oi}
                                                                                style={styles.supersetOption}
                                                                                onPress={(e) => { e.stopPropagation(); linkSuperset(plan.id, dayIndex, i, oi); setSupersetDropdownOpen(null); }}
                                                                            >
                                                                                <Text style={styles.supersetOptionText}>{otherEx.name}</Text>
                                                                            </Pressable>
                                                                        );
                                                                    })}
                                                                </View>
                                                            </View>
                                                        ) : (
                                                            <Pressable
                                                                style={styles.linkSupersetBtn}
                                                                onPress={(e) => { e.stopPropagation(); setSupersetDropdownOpen(exerciseKey); }}
                                                            >
                                                                <Text style={styles.linkSupersetBtnText}>🔗 Link to Superset</Text>
                                                            </Pressable>
                                                        )}
                                                    </View>
                                                )}
                                            </Pressable>
                                        );
                                    })
                                })()}
                            </View>
                        );
                    })}
                    <Pressable style={styles.deletePlanBtn} onPress={() => deletePlan(plan.id)}>
                        <Text style={styles.deletePlanBtnText}>Delete Plan</Text>
                    </Pressable>
                </ScrollView>

                {/* Delete Confirmation Modal */}
                <Modal
                    visible={deleteModalVisible}
                    transparent
                    animationType="none"
                    onRequestClose={handleCancelDelete}
                >
                    <Animated.View style={[styles.modalOverlay, { opacity: deleteModalOpacity }]}>
                        <View style={styles.deleteModalContent}>
                            <Text style={styles.deleteModalIcon}>🗑️</Text>
                            <Text style={styles.deleteModalTitle}>Delete Plan?</Text>
                            <Text style={styles.deleteModalMessage}>
                                Are you 100% sure you want to permanently delete this workout plan? This cannot be undone.
                            </Text>
                            <View style={styles.deleteModalButtons}>
                                <Pressable
                                    style={styles.deleteModalCancelBtn}
                                    onPress={handleCancelDelete}
                                >
                                    <Text style={styles.deleteModalCancelBtnText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.deleteModalDeleteBtn}
                                    onPress={handleConfirmDelete}
                                >
                                    <Text style={styles.deleteModalDeleteBtnText}>Delete</Text>
                                </Pressable>
                            </View>
                        </View>
                    </Animated.View>
                </Modal>
            </SafeAreaView>
        );
    }

    // ============ RENDER: WIZARD ============
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.wizardHeader}>
                <Pressable onPress={() => wizardStep === 1 ? setScreenMode('hub') : setWizardStep(wizardStep - 1)}>
                    <Text style={styles.backBtn}>← Back</Text>
                </Pressable>
                <View style={styles.wizardTitleRow}>
                    <Text style={styles.wizardTitle}>
                        {wizardStep === 1 ? 'Select Days' : wizardStep === 2 ? 'Name Your Days' : 'Add Exercises'}
                    </Text>
                    {wizardStep === 3 && (
                        <Pressable style={styles.headerInfoBtn} onPress={() => setShowStep3Info(true)}>
                            <Text style={styles.headerInfoIcon}>ⓘ</Text>
                        </Pressable>
                    )}
                </View>
                {wizardStep === 3 && (() => {
                    const hasAnyExercise = workoutDays.some(d => d.exercises.length > 0);
                    return (
                        <Pressable
                            style={[styles.headerSaveBtn, !hasAnyExercise && styles.headerSaveBtnDisabled]}
                            onPress={hasAnyExercise ? handleSavePlan : undefined}
                            disabled={!hasAnyExercise}
                        >
                            <Text style={[styles.headerSaveBtnText, !hasAnyExercise && styles.headerSaveBtnTextDisabled]}>Save</Text>
                        </Pressable>
                    );
                })()}
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* STEP 1: Select Days */}
                {wizardStep === 1 && (
                    <>
                        <Text style={styles.stepInstruction}>Which days will you train?</Text>
                        <View style={styles.daysGrid}>
                            {DAYS_OF_WEEK.map(day => (
                                <Pressable
                                    key={day}
                                    style={[styles.dayBtn, selectedDays.includes(day) && styles.dayBtnSelected]}
                                    onPress={() => toggleDay(day)}
                                >
                                    <Text style={[styles.dayBtnText, selectedDays.includes(day) && styles.dayBtnTextSelected]}>
                                        {day}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Pressable
                            style={[styles.nextBtn, selectedDays.length === 0 && styles.nextBtnDisabled]}
                            onPress={goToStep2}
                            disabled={selectedDays.length === 0}
                        >
                            <Text style={styles.nextBtnText}>Next</Text>
                        </Pressable>
                    </>
                )}

                {/* STEP 2: Name Days */}
                {wizardStep === 2 && (
                    <>
                        <View style={styles.planNameCard}>
                            <Text style={styles.planNameLabel}>Plan Name</Text>
                            <TextInput
                                style={styles.planNameInput}
                                value={planName}
                                onChangeText={setPlanName}
                                placeholder={workoutDays.length === 3 ? 'Push Pull Legs' : `${workoutDays.length}-Day Split`}
                                placeholderTextColor="#71717a"
                            />
                        </View>

                        {workoutDays.map((day, index) => (
                            <View key={index} style={styles.dayNameCard}>
                                <Text style={styles.dayNameLabel}>{day.dayOfWeek}</Text>
                                <TextInput
                                    style={styles.dayNameInput}
                                    value={day.name}
                                    onChangeText={(text) => setWorkoutDays(prev =>
                                        prev.map((d, i) => i === index ? { ...d, name: text } : d)
                                    )}
                                    placeholder={`Day ${index + 1}`}
                                    placeholderTextColor="#71717a"
                                />
                            </View>
                        ))}
                        <Pressable style={styles.nextBtn} onPress={goToStep3}>
                            <Text style={styles.nextBtnText}>Next</Text>
                        </Pressable>
                    </>
                )}

                {/* STEP 3: Add Exercises */}
                {wizardStep === 3 && (
                    <>
                        {/* Day Tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
                            {workoutDays.map((day, index) => (
                                <Pressable
                                    key={index}
                                    style={[styles.dayTab, activeDayIndex === index && styles.dayTabActive]}
                                    onPress={() => { setActiveDayIndex(index); setExpandedExerciseId(null); }}
                                >
                                    <Text style={[styles.dayTabText, activeDayIndex === index && styles.dayTabTextActive]}>
                                        {day.name}
                                    </Text>
                                    <Text style={styles.dayTabCount}>{day.exercises.length} exercises</Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        {/* Day Settings (pre-notes, gym, rest day) */}
                        {/* Day Settings (pre-notes) */}
                        {workoutDays[activeDayIndex] && (
                            <View style={styles.daySettingsRow}>
                                <TextInput
                                    style={styles.dayPreNotesInput}
                                    placeholder="Pre-notes (e.g. 5 min cardio, stretch PSOAS)"
                                    placeholderTextColor="#71717a"
                                    value={workoutDays[activeDayIndex].preNotes || ''}
                                    onChangeText={(text) => setWorkoutDays(prev => prev.map((d, i) => i === activeDayIndex ? { ...d, preNotes: text } : d))}
                                />
                            </View>
                        )}

                        {/* Instruction - only show when no exercises added */}
                        {workoutDays[activeDayIndex]?.exercises.length === 0 && (
                            <Text style={styles.stepInstruction}>Tap an exercise below to add it to your plan</Text>
                        )}

                        {/* Current Day Exercises */}
                        {
                            workoutDays[activeDayIndex]?.exercises.map((exercise) => {
                                const isExpanded = expandedExerciseId === exercise.id;

                                // Build detailed summary by grouping sets
                                const summaryParts: string[] = [];
                                const groupMap = new Map<string, { type: SetType; count: number; reps: string; repsMin?: number; repsMax?: number; minRepsOnly?: number; technique?: SetTechnique; notes?: string; toFailure?: boolean; slowNegatives?: boolean; backOff?: boolean; holdOnStretch?: boolean; perArm?: boolean }>();
                                exercise.sets.forEach(set => {
                                    const existing = groupMap.get(set.groupId);
                                    if (existing) {
                                        existing.count++;
                                    } else {
                                        groupMap.set(set.groupId, { type: set.type, count: 1, reps: set.reps, repsMin: set.repsMin, repsMax: set.repsMax, minRepsOnly: set.minRepsOnly, technique: set.technique, notes: set.notes, toFailure: set.toFailure, slowNegatives: set.slowNegatives, backOff: set.backOff, holdOnStretch: set.holdOnStretch, perArm: set.perArm });
                                    }
                                });
                                groupMap.forEach((g) => {
                                    const repsStr = g.minRepsOnly ? `${g.minRepsOnly}+` : (g.repsMin && g.repsMax ? `${g.repsMin}-${g.repsMax}` : g.reps);
                                    const typeLabel = g.type === 'warmup' ? 'warm' : (g.backOff ? 'back-off' : 'work');
                                    const extras: string[] = [];
                                    if (g.technique) extras.push(g.technique === 'drop_set' ? 'drop' : g.technique === 'rest_pause' ? 'r-p' : 'cluster');
                                    if (g.toFailure) extras.push('fail');
                                    if (g.slowNegatives) extras.push('slow');
                                    if (g.holdOnStretch) extras.push('stretch');
                                    if (g.perArm) extras.push('/arm');
                                    if (g.notes) extras.push('note');
                                    const extrasStr = extras.length > 0 ? ` +${extras.join('+')}` : '';
                                    summaryParts.push(`${g.count}×${repsStr} ${typeLabel}${extrasStr}`);
                                });

                                return (
                                    <View key={exercise.id} style={styles.exerciseCard}>
                                        {/* Collapsed Header */}
                                        <Pressable
                                            style={styles.exerciseCardHeader}
                                            onPress={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.exerciseCardName}>{exercise.name}</Text>
                                                <Text style={styles.exerciseCardSummary}>
                                                    {summaryParts.join(' • ')}
                                                </Text>
                                            </View>
                                            <View style={styles.exerciseCardActions}>
                                                <Text style={styles.exerciseCardArrow}>{isExpanded ? '▼' : '▶'}</Text>
                                                <Pressable onPress={() => removeExercise(exercise.id)} style={styles.exerciseRemoveBtn}>
                                                    <Text style={styles.exerciseRemoveBtnText}>✕</Text>
                                                </Pressable>
                                            </View>
                                        </Pressable>

                                        {/* Expanded Set Editor */}
                                        {isExpanded && (
                                            <View style={styles.exerciseCardBody}>
                                                {/* Grouped set editing */}
                                                {(() => {
                                                    // Group sets by groupId
                                                    const groupMap = new Map<string, { type: SetType; groupId: string; count: number; reps: string; repsMin?: number; repsMax?: number; technique?: SetTechnique; notes?: string }>();
                                                    exercise.sets.forEach(set => {
                                                        const gId = set.groupId || `legacy-${set.type}`;
                                                        if (groupMap.has(gId)) {
                                                            groupMap.get(gId)!.count++;
                                                        } else {
                                                            groupMap.set(gId, { type: set.type, groupId: gId, count: 1, reps: set.reps || '10', repsMin: set.repsMin, repsMax: set.repsMax, technique: set.technique, notes: set.notes });
                                                        }
                                                    });
                                                    let groups = Array.from(groupMap.values());
                                                    if (groups.length === 0) groups.push({ type: 'working', groupId: `g-${Date.now()}`, count: 1, reps: '10' });

                                                    return groups.map((group, gi) => {
                                                        const setKey = `${exercise.id}-${group.groupId}`;
                                                        const showAdvanced = advancedSetKey === setKey; // Each group can expand
                                                        const repsKey = `${exercise.id}-${group.groupId}-reps`;
                                                        const showRepsEditor = repsEditorKey === repsKey;
                                                        const minReps = group.repsMin ?? (parseInt(group.reps) || 10);
                                                        const maxReps = group.repsMax ?? minReps;

                                                        const updateReps = (newMin: number, newMax: number) => {
                                                            setWorkoutDays(prev => prev.map((d, di) =>
                                                                di === activeDayIndex ? {
                                                                    ...d,
                                                                    exercises: d.exercises.map(e =>
                                                                        e.id === exercise.id ? {
                                                                            ...e,
                                                                            sets: e.sets.map(s => s.groupId === group.groupId ? {
                                                                                ...s,
                                                                                reps: newMin === newMax ? `${newMin}` : `${newMin}-${newMax}`,
                                                                                repsMin: newMin,
                                                                                repsMax: newMax
                                                                            } : s)
                                                                        } : e
                                                                    )
                                                                } : d
                                                            ));
                                                        };
                                                        return (
                                                            <View key={gi}>
                                                                <View style={styles.setRow}>
                                                                    {/* First row: Segmented toggle. Others: single button */}
                                                                    {gi === 0 ? (
                                                                        <View style={styles.segmentedToggle}>
                                                                            <Pressable
                                                                                style={[styles.segmentBtn, styles.segmentBtnLeft, group.type === 'warmup' && styles.segmentBtnActiveWarmup]}
                                                                                onPress={() => {
                                                                                    if (group.type === 'warmup') return;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e => e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, type: 'warmup' as SetType } : s) } : e)
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={[styles.segmentBtnText, group.type === 'warmup' && styles.segmentBtnTextActive]}>Warm</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={[styles.segmentBtn, styles.segmentBtnRight, group.type === 'working' && styles.segmentBtnActiveWorking]}
                                                                                onPress={() => {
                                                                                    if (group.type === 'working') return;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e => {
                                                                                                if (e.id !== exercise.id) return e;
                                                                                                const updatedSets = e.sets.map(s => s.groupId === group.groupId ? { ...s, type: 'working' as SetType } : s);
                                                                                                const warmups = updatedSets.filter(s => s.type === 'warmup');
                                                                                                const working = updatedSets.filter(s => s.type !== 'warmup');
                                                                                                return { ...e, sets: [...warmups, ...working] };
                                                                                            })
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={[styles.segmentBtnText, group.type === 'working' && styles.segmentBtnTextActive]}>Work</Text>
                                                                            </Pressable>
                                                                        </View>
                                                                    ) : (
                                                                        <Pressable
                                                                            style={[styles.setTypeBtn, group.type === 'warmup' ? styles.setTypeBtnWarmup : styles.setTypeBtnWorking]}
                                                                            onPress={() => {
                                                                                // Only warmups can toggle to working
                                                                                if (group.type !== 'warmup') return;
                                                                                setWorkoutDays(prev => prev.map((d, di) =>
                                                                                    di === activeDayIndex ? {
                                                                                        ...d,
                                                                                        exercises: d.exercises.map(e => {
                                                                                            if (e.id !== exercise.id) return e;
                                                                                            const updatedSets = e.sets.map(s => s.groupId === group.groupId ? { ...s, type: 'working' as SetType } : s);
                                                                                            const warmups = updatedSets.filter(s => s.type === 'warmup');
                                                                                            const working = updatedSets.filter(s => s.type !== 'warmup');
                                                                                            return { ...e, sets: [...warmups, ...working] };
                                                                                        })
                                                                                    } : d
                                                                                ));
                                                                            }}
                                                                        >
                                                                            <Text style={styles.setTypeBtnText}>{group.type === 'warmup' ? 'Warm' : 'Work'}</Text>
                                                                        </Pressable>
                                                                    )}

                                                                    {/* Stepper for set count */}
                                                                    <Pressable style={styles.stepperBtn} onPress={() => {
                                                                        if (group.count > 1) {
                                                                            setWorkoutDays(prev => prev.map((d, di) => {
                                                                                if (di !== activeDayIndex) return d;
                                                                                return {
                                                                                    ...d,
                                                                                    exercises: d.exercises.map(e => {
                                                                                        if (e.id !== exercise.id) return e;
                                                                                        const setsOfType = e.sets.filter(s => s.type === group.type);
                                                                                        const otherSets = e.sets.filter(s => s.type !== group.type);
                                                                                        return { ...e, sets: [...otherSets, ...setsOfType.slice(0, -1)] };
                                                                                    })
                                                                                };
                                                                            }));
                                                                        }
                                                                    }}>
                                                                        <Text style={styles.stepperBtnText}>−</Text>
                                                                    </Pressable>

                                                                    <View style={styles.setCountBox}>
                                                                        <Text style={styles.setCountText}>{group.count}</Text>
                                                                    </View>

                                                                    <Pressable style={styles.stepperBtn} onPress={() => {
                                                                        setWorkoutDays(prev => prev.map((d, di) =>
                                                                            di === activeDayIndex ? {
                                                                                ...d,
                                                                                exercises: d.exercises.map(e =>
                                                                                    e.id === exercise.id ? { ...e, sets: [...e.sets, { type: group.type, groupId: group.groupId, reps: group.reps }] } : e
                                                                                )
                                                                            } : d
                                                                        ));
                                                                    }}>
                                                                        <Text style={styles.stepperBtnText}>+</Text>
                                                                    </Pressable>

                                                                    <Text style={styles.timesSymbol}>×</Text>

                                                                    {/* Tappable reps display */}
                                                                    <Pressable
                                                                        style={[styles.repsDisplay, showRepsEditor && styles.repsDisplayActive]}
                                                                        onPress={() => {
                                                                            if (showRepsEditor) {
                                                                                setRepsEditorKey(null);
                                                                            } else {
                                                                                // Auto-apply suggested range when opening (if single value)
                                                                                if (minReps === maxReps) {
                                                                                    const suggestedMin = Math.max(1, maxReps - 2);
                                                                                    updateReps(suggestedMin, maxReps);
                                                                                }
                                                                                setRepsEditorKey(repsKey);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Text style={styles.repsDisplayText}>{minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`}</Text>
                                                                        <Text style={styles.repsDisplayLabel}>reps</Text>
                                                                    </Pressable>

                                                                    {/* Quick +/- for single rep values - stacked vertically */}
                                                                    {minReps === maxReps && (
                                                                        <View style={styles.miniStepperStack}>
                                                                            <Pressable
                                                                                style={styles.miniStepperBtn}
                                                                                onPress={() => updateReps(minReps + 1, minReps + 1)}
                                                                            >
                                                                                <Text style={styles.miniStepperBtnText}>+</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={styles.miniStepperBtn}
                                                                                onPress={() => minReps > 1 && updateReps(minReps - 1, minReps - 1)}
                                                                            >
                                                                                <Text style={styles.miniStepperBtnText}>−</Text>
                                                                            </Pressable>
                                                                        </View>
                                                                    )}

                                                                    {/* Inline gear for this group's advanced options */}
                                                                    <Pressable
                                                                        style={[styles.rowGearBtn, showAdvanced && styles.rowGearBtnActive]}
                                                                        onPress={() => setAdvancedSetKey(showAdvanced ? null : setKey)}
                                                                    >
                                                                        <Text style={styles.rowGearBtnText}>⚙️</Text>
                                                                    </Pressable>

                                                                    {/* Visual indicator tags for what's configured */}
                                                                    {(() => {
                                                                        const set = exercise.sets.find(s => s.groupId === group.groupId);
                                                                        if (!set) return null;
                                                                        const tags: string[] = [];
                                                                        if (set.technique) tags.push(set.technique === 'drop_set' ? 'Drop' : set.technique === 'cluster' ? 'Cluster' : set.technique === 'rest_pause' ? 'R-P' : set.technique);
                                                                        if (set.toFailure) tags.push('Fail');
                                                                        if (set.slowNegatives) tags.push('Slow');
                                                                        if (set.backOff) tags.push('Back-off');
                                                                        if (set.holdOnStretch) tags.push('Stretch');
                                                                        if (set.perArm) tags.push('/Arm');
                                                                        if (set.notes) tags.push('Note');
                                                                        if (tags.length === 0) return null;
                                                                        return (
                                                                            <View style={styles.indicatorTags}>
                                                                                {tags.map((tag, ti) => (
                                                                                    <Text key={ti} style={styles.indicatorTag}>{tag}</Text>
                                                                                ))}
                                                                            </View>
                                                                        );
                                                                    })()}

                                                                    {groups.length > 1 && (
                                                                        <Pressable style={styles.removeGroupBtn} onPress={() => {
                                                                            setWorkoutDays(prev => prev.map((d, di) =>
                                                                                di === activeDayIndex ? {
                                                                                    ...d,
                                                                                    exercises: d.exercises.map(e =>
                                                                                        e.id === exercise.id ? { ...e, sets: e.sets.filter(s => s.groupId !== group.groupId) } : e
                                                                                    )
                                                                                } : d
                                                                            ));
                                                                        }}>
                                                                            <Text style={styles.removeGroupBtnText}>✕</Text>
                                                                        </Pressable>
                                                                    )}
                                                                </View>

                                                                {/* Reps Range Editor Panel */}
                                                                {showRepsEditor && (
                                                                    <View style={styles.repsEditorPanel}>
                                                                        {/* Header with close button */}
                                                                        <View style={styles.panelHeader}>
                                                                            <Text style={styles.panelHeaderTitle}>Rep Range</Text>
                                                                            <Pressable onPress={() => setRepsEditorKey(null)} style={styles.panelCloseBtn}>
                                                                                <Text style={styles.panelCloseBtnText}>✕</Text>
                                                                            </Pressable>
                                                                        </View>
                                                                        {/* Show current values - auto-suggest happens on open, not here */}
                                                                        {(() => {
                                                                            // Use actual stored values (auto-suggest already applied on open)
                                                                            const displayMin = minReps;
                                                                            const displayMax = maxReps;
                                                                            const hasRange = displayMin !== displayMax;

                                                                            return (
                                                                                <>
                                                                                    <View style={styles.repsEditorRow}>
                                                                                        <Text style={styles.repsEditorLabel}>Min</Text>
                                                                                        <Pressable style={styles.stepperBtn} onPress={() => displayMin > 1 && updateReps(displayMin - 1, displayMax)}>
                                                                                            <Text style={styles.stepperBtnText}>−</Text>
                                                                                        </Pressable>
                                                                                        <View style={styles.repsBox}>
                                                                                            <Text style={styles.repsBoxText}>{displayMin}</Text>
                                                                                        </View>
                                                                                        <Pressable style={styles.stepperBtn} onPress={() => {
                                                                                            const newMin = displayMin + 1;
                                                                                            // If min catches up to max, bump max up too
                                                                                            const newMax = newMin >= displayMax ? displayMax + 1 : displayMax;
                                                                                            updateReps(newMin, newMax);
                                                                                        }}>
                                                                                            <Text style={styles.stepperBtnText}>+</Text>
                                                                                        </Pressable>
                                                                                    </View>
                                                                                    <View style={styles.repsEditorRow}>
                                                                                        <Text style={styles.repsEditorLabel}>Max</Text>
                                                                                        <Pressable style={styles.stepperBtn} onPress={() => {
                                                                                            // Shift both down together to maintain the gap
                                                                                            const newMax = displayMax - 1;
                                                                                            const newMin = Math.max(1, displayMin - 1);
                                                                                            if (newMax >= 1) updateReps(newMin, newMax);
                                                                                        }}>
                                                                                            <Text style={styles.stepperBtnText}>−</Text>
                                                                                        </Pressable>
                                                                                        <View style={styles.repsBox}>
                                                                                            <Text style={styles.repsBoxText}>{displayMax}</Text>
                                                                                        </View>
                                                                                        <Pressable style={styles.stepperBtn} onPress={() => updateReps(displayMin, displayMax + 1)}>
                                                                                            <Text style={styles.stepperBtnText}>+</Text>
                                                                                        </Pressable>
                                                                                    </View>

                                                                                    {/* Remove Range button - only show if there's a range */}
                                                                                    {hasRange && (
                                                                                        <Pressable
                                                                                            style={styles.removeRangeBtn}
                                                                                            onPress={() => {
                                                                                                updateReps(displayMax, displayMax);
                                                                                                setRepsEditorKey(null);
                                                                                            }}
                                                                                        >
                                                                                            <Text style={styles.removeRangeBtnText}>✕ Remove Range</Text>
                                                                                        </Pressable>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </View>
                                                                )}

                                                                {/* Advanced Panel */}
                                                                {showAdvanced && (
                                                                    <View style={styles.advancedPanel}>
                                                                        {/* Header with close button */}
                                                                        <View style={styles.panelHeader}>
                                                                            <Text style={styles.panelHeaderTitle}>Set Technique</Text>
                                                                            <Pressable onPress={() => setAdvancedSetKey(null)} style={styles.panelCloseBtn}>
                                                                                <Text style={styles.panelCloseBtnText}>✕</Text>
                                                                            </Pressable>
                                                                        </View>
                                                                        <View style={styles.techniqueOptions}>
                                                                            {(['rest_pause', 'cluster', 'drop_set'] as SetTechnique[]).map(tech => (
                                                                                <Pressable
                                                                                    key={tech}
                                                                                    style={[styles.techniqueOption, group.technique === tech && styles.techniqueOptionActive]}
                                                                                    onPress={() => {
                                                                                        const newTechnique = group.technique === tech ? undefined : tech;
                                                                                        setWorkoutDays(prev => prev.map((d, di) =>
                                                                                            di === activeDayIndex ? {
                                                                                                ...d,
                                                                                                exercises: d.exercises.map(e =>
                                                                                                    e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, technique: newTechnique } : s) } : e
                                                                                                )
                                                                                            } : d
                                                                                        ));
                                                                                    }}
                                                                                >
                                                                                    <Text style={[styles.techniqueOptionText, group.technique === tech && styles.techniqueOptionTextActive]}>
                                                                                        {tech === 'rest_pause' ? '⏸️ Rest-Pause' : tech === 'cluster' ? '⚡ Cluster' : '⬇️ Drop Set'}
                                                                                    </Text>
                                                                                </Pressable>
                                                                            ))}
                                                                        </View>
                                                                        <Text style={[styles.advancedPanelTitle, { marginTop: 12 }]}>Modifiers</Text>
                                                                        <View style={styles.modifierOptions}>
                                                                            <Pressable
                                                                                style={[styles.modifierOption, exercise.sets.find(s => s.groupId === group.groupId)?.toFailure && styles.modifierOptionActive]}
                                                                                onPress={() => {
                                                                                    const current = exercise.sets.find(s => s.groupId === group.groupId)?.toFailure;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e =>
                                                                                                e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, toFailure: !current } : s) } : e
                                                                                            )
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={styles.modifierOptionText}>💪 To Failure</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={[styles.modifierOption, exercise.sets.find(s => s.groupId === group.groupId)?.slowNegatives && styles.modifierOptionActive]}
                                                                                onPress={() => {
                                                                                    const current = exercise.sets.find(s => s.groupId === group.groupId)?.slowNegatives;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e =>
                                                                                                e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, slowNegatives: !current } : s) } : e
                                                                                            )
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={styles.modifierOptionText}>🐢 Slow Negatives</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={[styles.modifierOption, exercise.sets.find(s => s.groupId === group.groupId)?.backOff && styles.modifierOptionActive]}
                                                                                onPress={() => {
                                                                                    const current = exercise.sets.find(s => s.groupId === group.groupId)?.backOff;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e =>
                                                                                                e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, backOff: !current } : s) } : e
                                                                                            )
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={styles.modifierOptionText}>⬇️ Back-off</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={[styles.modifierOption, exercise.sets.find(s => s.groupId === group.groupId)?.holdOnStretch && styles.modifierOptionActive]}
                                                                                onPress={() => {
                                                                                    const current = exercise.sets.find(s => s.groupId === group.groupId)?.holdOnStretch;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e =>
                                                                                                e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, holdOnStretch: !current } : s) } : e
                                                                                            )
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={styles.modifierOptionText}>🧘 Hold Stretch</Text>
                                                                            </Pressable>
                                                                            <Pressable
                                                                                style={[styles.modifierOption, exercise.sets.find(s => s.groupId === group.groupId)?.perArm && styles.modifierOptionActive]}
                                                                                onPress={() => {
                                                                                    const current = exercise.sets.find(s => s.groupId === group.groupId)?.perArm;
                                                                                    setWorkoutDays(prev => prev.map((d, di) =>
                                                                                        di === activeDayIndex ? {
                                                                                            ...d,
                                                                                            exercises: d.exercises.map(e =>
                                                                                                e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, perArm: !current } : s) } : e
                                                                                            )
                                                                                        } : d
                                                                                    ));
                                                                                }}
                                                                            >
                                                                                <Text style={styles.modifierOptionText}>💪 Per Arm</Text>
                                                                            </Pressable>
                                                                        </View>

                                                                        {/* Notes / Coaching Cues */}
                                                                        <Text style={styles.advancedPanelTitle}>Notes / Cues</Text>
                                                                        <TextInput
                                                                            style={styles.notesInput}
                                                                            placeholder="e.g. hold stretch 30s / fail / hold 30s / fail"
                                                                            placeholderTextColor="#71717a"
                                                                            value={exercise.sets.find(s => s.groupId === group.groupId)?.notes || ''}
                                                                            onChangeText={(text) => {
                                                                                setWorkoutDays(prev => prev.map((d, di) =>
                                                                                    di === activeDayIndex ? {
                                                                                        ...d,
                                                                                        exercises: d.exercises.map(e =>
                                                                                            e.id === exercise.id ? { ...e, sets: e.sets.map(s => s.groupId === group.groupId ? { ...s, notes: text } : s) } : e
                                                                                        )
                                                                                    } : d
                                                                                ));
                                                                            }}
                                                                            multiline
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                        );
                                                    });
                                                })()}

                                                {/* Add Set buttons */}
                                                <View style={styles.addSetRow}>
                                                    <Pressable style={styles.addSetBtn} onPress={() => {
                                                        setWorkoutDays(prev => prev.map((d, di) =>
                                                            di === activeDayIndex ? {
                                                                ...d,
                                                                exercises: d.exercises.map(e =>
                                                                    e.id === exercise.id ? { ...e, sets: [...e.sets, { type: 'working', groupId: `g-${Date.now()}`, reps: '10' }] } : e
                                                                )
                                                            } : d
                                                        ));
                                                    }}>
                                                        <Text style={styles.addSetBtnText}>+ Add Set</Text>
                                                    </Pressable>

                                                    {exercise.sets.every(s => s.type !== 'warmup') && (
                                                        <Pressable style={styles.addWarmupLink} onPress={() => {
                                                            setWorkoutDays(prev => prev.map((d, di) =>
                                                                di === activeDayIndex ? {
                                                                    ...d,
                                                                    exercises: d.exercises.map(e =>
                                                                        e.id === exercise.id ? { ...e, sets: [{ type: 'warmup', groupId: `g-${Date.now()}`, reps: '12' }, ...e.sets] } : e
                                                                    )
                                                                } : d
                                                            ));
                                                        }}>
                                                            <Text style={styles.addWarmupLinkText}>+ Warm-up</Text>
                                                        </Pressable>
                                                    )}

                                                    {/* Done / Confirm button - at bottom right */}
                                                    <Pressable style={styles.doneBtn} onPress={() => setExpandedExerciseId(null)}>
                                                        <Text style={styles.doneBtnText}>✓ Done</Text>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        }

                        {/* Exercise Library */}
                        <Text style={styles.libraryTitle}>Add exercise:</Text>
                        {
                            EXERCISE_LIBRARY.map(category => {
                                const isExpanded = expandedCategories.has(category.category);
                                return (
                                    <View key={category.category} style={styles.categorySection}>
                                        <Pressable
                                            style={styles.categoryHeader}
                                            onPress={() => {
                                                setExpandedCategories(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(category.category)) {
                                                        next.delete(category.category);
                                                    } else {
                                                        next.add(category.category);
                                                    }
                                                    return next;
                                                });
                                            }}
                                        >
                                            <Text style={styles.categoryName}>{category.category}</Text>
                                            <Text style={styles.categoryArrow}>{isExpanded ? '▼' : '▶'}</Text>
                                        </Pressable>
                                        {isExpanded && (
                                            <View style={styles.exerciseGrid}>
                                                {category.exercises.map(ex => {
                                                    const isSelected = workoutDays[activeDayIndex]?.exercises.some(e => e.name === ex);
                                                    return (
                                                        <Pressable
                                                            key={ex}
                                                            style={[styles.exerciseBtn, isSelected && styles.exerciseBtnSelected]}
                                                            onPress={() => addExercise(ex)}
                                                        >
                                                            <Text style={[styles.exerciseBtnText, isSelected && styles.exerciseBtnTextSelected]}>{ex}</Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        }

                        <Pressable style={styles.saveBtn} onPress={handleSavePlan}>
                            <Text style={styles.saveBtnText}>Save Plan</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>

            {/* Step 3 Info Modal */}
            <Modal
                visible={showStep3Info}
                transparent
                animationType="fade"
                onRequestClose={() => setShowStep3Info(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.infoModalContent}>
                        <Text style={styles.infoModalTitle}>Building Your Workout</Text>
                        <View style={styles.infoModalBody}>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Tap exercises</Text> from the library below to add them</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Tap again</Text> to remove an exercise</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Expand cards</Text> to customize sets, reps & ranges</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Use ⚙️</Text> for advanced options: drop sets, cluster sets, rest-pause</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Add modifiers</Text> like "to failure", slow negatives, per-arm</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Add notes</Text> for coaching cues & personal reminders</Text>
                            <Text style={styles.infoModalItem}>• <Text style={styles.infoModalBold}>Switch days</Text> using the tabs at the top</Text>
                        </View>
                        <Pressable style={styles.infoModalCloseBtn} onPress={() => setShowStep3Info(false)}>
                            <Text style={styles.infoModalCloseBtnText}>Got it!</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ============ STYLES ============
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0e14' },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },

    // Header
    header: { paddingTop: 20, paddingBottom: 24 },
    title: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
    subtitle: { fontSize: 16, color: '#94a3b8', marginTop: 4 },

    // Import Progress Card
    importProgressCard: { backgroundColor: '#1e1b4b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#8b5cf6' },
    importProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    importProgressIcon: { fontSize: 24 },
    importProgressTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
    importProgressSubtitle: { fontSize: 13, color: '#a78bfa', marginTop: 2 },
    importProgressBar: { height: 6, backgroundColor: '#3f3f46', borderRadius: 3, overflow: 'hidden' },
    importProgressFill: { height: '100%', backgroundColor: '#8b5cf6', borderRadius: 3 },

    // Quick Start
    quickStartCard: { backgroundColor: '#151b24', borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#7CFC00' },
    quickStartTitle: { fontSize: 20, fontWeight: '600', color: '#7CFC00' },
    quickStartSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

    // Import Card
    importCard: { backgroundColor: '#151b24', borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#22d3ee' },
    importCardTitle: { fontSize: 20, fontWeight: '600', color: '#22d3ee' },
    importCardSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

    // Import Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    importModalContent: { backgroundColor: '#0f1419', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
    importModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    importModalTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
    importModalClose: { fontSize: 24, color: '#64748b' },
    importLoading: { alignItems: 'center', padding: 32 },
    importLoadingText: { color: '#94a3b8', marginTop: 16, fontSize: 14 },
    importOption: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#151b24', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    importOptionIcon: { fontSize: 28 },
    importOptionTitle: { fontSize: 16, fontWeight: '500', color: '#ffffff' },
    importOptionSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
    importDivider: { alignItems: 'center', paddingVertical: 16 },
    importDividerText: { color: '#64748b', fontSize: 13 },
    importTextInput: { backgroundColor: '#151b24', borderRadius: 12, padding: 16, color: '#ffffff', fontSize: 14, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#1e293b' },
    importSubmitBtn: { backgroundColor: '#7CFC00', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    importSubmitBtnText: { color: '#0a0e14', fontSize: 16, fontWeight: '700' },

    // Section
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 12 },

    // Plan Cards
    planCard: { backgroundColor: '#151b24', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    planCardContent: { marginBottom: 12 },
    planCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    planCardName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
    sessionCountBadge: { backgroundColor: '#7CFC00', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
    sessionCountText: { color: '#0a0e14', fontSize: 11, fontWeight: '700' },
    planCardDays: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
    planCardActions: { flexDirection: 'row', gap: 12 },
    viewBtn: { flex: 1, backgroundColor: '#1e293b', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    viewBtnText: { color: '#ffffff', fontWeight: '500' },
    startBtn: { flex: 1, backgroundColor: '#7CFC00', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    startBtnText: { color: '#0a0e14', fontWeight: '700' },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#151b24', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' },
    emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
    emptyStateText: { color: '#94a3b8', fontSize: 16, textAlign: 'center', fontWeight: '500' },
    emptyStateHint: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 4 },

    // Plan Card Expanded State
    planCardExpanded: { borderColor: '#a3e635' },
    planCardActive: {
        backgroundColor: '#0d1a12',
        borderColor: '#7CFC00',
        borderWidth: 2,
        shadowColor: '#7CFC00',
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8
    },
    planCardToggle: { color: '#71717a', fontSize: 14, marginLeft: 12 },
    planCardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planCardHeaderLeft: { flex: 1 },
    planStartBtn: { backgroundColor: '#a3e635', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
    planStartBtnText: { color: '#0a0e14', fontSize: 14, fontWeight: '700' },

    // Active Plan Badge
    activeBadge: {
        backgroundColor: '#7CFC00',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginLeft: 8,
        shadowColor: '#7CFC00',
        shadowOpacity: 0.6,
        shadowRadius: 6,
        elevation: 4
    },
    activeBadgeText: { color: '#0a0e14', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    // Plan Header Action Icons
    planHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
    planHeaderIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center'
    },
    planHeaderIconText: { fontSize: 18, color: '#71717a' },
    planHeaderIconActive: { color: '#7CFC00' },

    // Delete Link (at bottom of expanded card)
    deleteLink: { alignSelf: 'center', paddingVertical: 12, marginTop: 8 },
    deleteLinkText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },

    // Inline Day List (when plan is expanded)
    inlineDayList: { borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 12, paddingTop: 12 },
    inlineDayCard: { backgroundColor: '#0d1117', borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
    inlineDayCardExpanded: { borderWidth: 1, borderColor: '#22d3ee' },
    inlineDayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
    inlineDayHeaderLeft: { flex: 1 },
    inlineDayItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#0d1117', borderRadius: 10, marginBottom: 8 },
    inlineDayLeft: { flex: 1 },
    inlineDayName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
    inlineDayInfo: { color: '#71717a', fontSize: 12, marginTop: 2 },
    inlineDayArrow: { color: '#a3e635', fontSize: 18, fontWeight: '600' },
    inlineDayExCount: { color: '#a3e635', fontSize: 14, fontWeight: '700', backgroundColor: '#1a2e1a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    dayStartBtn: { backgroundColor: '#a3e635', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
    dayStartBtnText: { color: '#0a0e14', fontSize: 13, fontWeight: '700' },

    // Inline Exercise List (when day is expanded)
    inlineExerciseList: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#1e293b' },
    inlineExerciseItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
    inlineExerciseName: { color: '#94a3b8', fontSize: 14, flex: 1 },
    inlineExerciseSets: { color: '#64748b', fontSize: 12 },

    // Inline Actions (Edit/Delete at bottom of expanded card)
    inlineActions: { flexDirection: 'row', gap: 12, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e293b' },
    editPlanBtn: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    editPlanBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
    deletePlanBtn: { backgroundColor: '#2a1a1a', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    deletePlanBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

    // Compact Action Buttons
    compactActionsSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
    compactActionsLabel: { color: '#71717a', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    compactActionsRow: { flexDirection: 'row', gap: 12 },
    compactActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#151b24', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#1e293b' },
    compactActionIcon: { fontSize: 18, color: '#a3e635' },
    compactActionText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

    // Wizard Header
    wizardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    backBtn: { color: '#22d3ee', fontSize: 16 },
    wizardTitleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, flex: 1 },
    wizardTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
    headerInfoBtn: { marginLeft: 8, padding: 4 },
    headerInfoIcon: { fontSize: 18, color: '#22d3ee' },
    headerSaveBtn: { marginLeft: 'auto', backgroundColor: '#7CFC00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    headerSaveBtnDisabled: { backgroundColor: '#1e293b' },
    headerSaveBtnText: { color: '#0a0e14', fontWeight: '700', fontSize: 14 },
    headerSaveBtnTextDisabled: { color: '#64748b' },

    // Plan Name Editing (in viewing mode)
    editPlanNameTappable: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, flex: 1, gap: 8 },
    editPlanNameIcon: { fontSize: 16, opacity: 0.6 },
    editPlanNameRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, flex: 1, gap: 8 },
    editPlanNameInput: { flex: 1, backgroundColor: '#151b24', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#a3e635' },
    editPlanNameSaveBtn: { backgroundColor: '#a3e635', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    editPlanNameSaveBtnText: { color: '#0a0e14', fontWeight: '700', fontSize: 14 },
    editPlanNameCancelBtn: { backgroundColor: '#2a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    editPlanNameCancelBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

    // Day Completion Count Badge
    dayCompletionBadge: { backgroundColor: '#164e63', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    dayCompletionText: { color: '#22d3ee', fontSize: 11, fontWeight: '700' },

    // Step 1
    stepInstruction: { color: '#94a3b8', fontSize: 16, marginBottom: 16, marginTop: 8, flex: 1 },
    step3InstructionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 },
    infoIconBtn: { padding: 8 },
    infoIconText: { fontSize: 20, color: '#22d3ee' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    dayBtn: { paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#151b24', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
    dayBtnSelected: { backgroundColor: 'rgba(124, 252, 0, 0.15)', borderColor: '#7CFC00' },
    dayBtnText: { color: '#94a3b8', fontSize: 16, fontWeight: '500' },
    dayBtnTextSelected: { color: '#7CFC00' },
    nextBtn: { backgroundColor: '#7CFC00', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
    nextBtnDisabled: { backgroundColor: '#1e293b' },
    nextBtnText: { color: '#0a0e14', fontSize: 16, fontWeight: '700' },

    // Step 2
    planNameCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, marginBottom: 16 },
    planNameLabel: { color: '#a1a1aa', fontSize: 14, marginBottom: 8 },
    planNameInput: { backgroundColor: '#27272a', borderRadius: 8, padding: 12, color: '#ffffff', fontSize: 16 },
    dayNameCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, marginBottom: 12 },
    dayNameLabel: { color: '#8b5cf6', fontSize: 14, fontWeight: '600', marginBottom: 8 },
    dayNameInput: { backgroundColor: '#27272a', borderRadius: 8, padding: 12, color: '#ffffff', fontSize: 16 },

    // Step 3 - Day Tabs
    dayTabs: { marginBottom: 16 },
    dayTab: { backgroundColor: '#18181b', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginRight: 12 },
    dayTabActive: { backgroundColor: '#4c1d95', borderWidth: 1, borderColor: '#8b5cf6' },
    dayTabText: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
    dayTabTextActive: { color: '#ffffff' },
    dayTabCount: { color: '#71717a', fontSize: 12, marginTop: 2 },

    // Day Settings Row
    daySettingsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    dayPreNotesInput: { flex: 1, backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#ffffff', fontSize: 13 },
    restDayBtn: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    restDayBtnText: { color: '#a1a1aa', fontSize: 13 },
    restDayBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e1b4b', borderRadius: 8, padding: 12, flex: 1 },
    restDayText: { color: '#a78bfa', fontSize: 14, fontWeight: '500' },
    restDayToggle: { color: '#8b5cf6', fontSize: 13 },

    // Exercise Card
    exerciseCard: { backgroundColor: '#18181b', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
    exerciseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    exerciseCardName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
    exerciseCardSummary: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },
    exerciseCardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerGearBtn: { padding: 4 },
    headerGearBtnText: { fontSize: 16 },
    exerciseCardArrow: { color: '#71717a', fontSize: 12 },
    exerciseRemoveBtn: { padding: 4 },
    exerciseRemoveBtnText: { color: '#ef4444', fontSize: 16 },
    exerciseCardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#27272a' },

    // Set Row (new grouped format)
    setRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 12, gap: 6 },
    setTypeBtn: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
    setTypeBtnWarmup: { backgroundColor: '#78350f' },
    setTypeBtnWorking: { backgroundColor: '#166534' },
    setTypeBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
    // Segmented toggle for first row
    segmentedToggle: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#3f3f46' },
    segmentBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#27272a' },
    segmentBtnLeft: { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
    segmentBtnRight: { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
    segmentBtnActiveWarmup: { backgroundColor: '#78350f' },
    segmentBtnActiveWorking: { backgroundColor: '#166534' },
    segmentBtnText: { color: '#71717a', fontSize: 13, fontWeight: '500' },
    segmentBtnTextActive: { color: '#ffffff' },
    stepperBtn: { backgroundColor: '#27272a', borderRadius: 6, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    stepperBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
    setCountBox: { backgroundColor: '#3f3f46', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, minWidth: 40, alignItems: 'center' },
    setCountText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    timesSymbol: { color: '#71717a', fontSize: 16, fontWeight: '500' },
    repsInput: { backgroundColor: '#27272a', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, color: '#ffffff', fontSize: 16, width: 50, textAlign: 'center' },
    repsBox: { backgroundColor: '#3f3f46', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, minWidth: 40, alignItems: 'center' },
    repsBoxText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    repsLabel: { color: '#71717a', fontSize: 14 },
    miniStepperBtn: { backgroundColor: '#27272a', borderRadius: 4, width: 20, height: 16, justifyContent: 'center', alignItems: 'center' },
    miniStepperBtnText: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', lineHeight: 12 },
    miniStepperStack: { flexDirection: 'column', gap: 2 },
    advancedBtn: { padding: 6 },
    advancedBtnActive: { backgroundColor: '#3f3f46', borderRadius: 6 },
    advancedBtnText: { fontSize: 16 },
    removeGroupBtn: { padding: 6 },
    removeGroupBtnText: { color: '#ef4444', fontSize: 14 },
    indicatorTags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    indicatorTag: { backgroundColor: '#3f3f46', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, color: '#a1a1aa', fontSize: 11, fontWeight: '500' },
    addWarmupBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3f3f46', borderStyle: 'dashed', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
    addWarmupBtnText: { color: '#f59e0b', fontSize: 14, fontWeight: '500' },
    addSetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
    addSetBtn: { backgroundColor: '#27272a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
    addSetBtnText: { color: '#8b5cf6', fontSize: 14, fontWeight: '600' },
    addWarmupLink: { paddingVertical: 10 },
    addWarmupLinkText: { color: '#71717a', fontSize: 14 },
    doneBtn: { marginLeft: 'auto', backgroundColor: '#166534', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 },
    doneBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

    // Reps display and editor
    repsDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
    repsDisplayActive: { backgroundColor: '#4c1d95', borderWidth: 1, borderColor: '#8b5cf6' },
    repsDisplayText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    repsDisplayLabel: { color: '#a1a1aa', fontSize: 14 },
    repsEditorPanel: { backgroundColor: '#1f1f23', borderRadius: 8, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#3f3f46' },
    panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    panelHeaderTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    panelCloseBtn: { padding: 4 },
    panelCloseBtnText: { color: '#71717a', fontSize: 14 },
    repsEditorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    repsEditorLabel: { color: '#a1a1aa', fontSize: 14, width: 32 },

    // Advanced Panel
    advancedPanel: { backgroundColor: '#1f1f23', borderRadius: 8, padding: 12, marginTop: 8 },
    advancedPanelTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    techniqueOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    techniqueOption: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#3f3f46' },
    techniqueOptionActive: { backgroundColor: '#4c1d95', borderColor: '#8b5cf6' },
    techniqueOptionText: { color: '#a1a1aa', fontSize: 13 },
    techniqueOptionTextActive: { color: '#ffffff' },
    modifierOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    modifierOption: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#3f3f46' },
    modifierOptionActive: { backgroundColor: '#166534', borderColor: '#22c55e' },
    modifierOptionText: { color: '#a1a1aa', fontSize: 13 },
    notesInput: { backgroundColor: '#27272a', borderRadius: 8, padding: 12, color: '#ffffff', fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3f3f46' },
    notesIndicator: { fontSize: 12 },
    rowGearBtn: { backgroundColor: '#3f3f46', borderRadius: 6, padding: 6, marginLeft: 4 },
    rowGearBtnActive: { backgroundColor: '#4c1d95', borderWidth: 1, borderColor: '#8b5cf6' },
    rowGearBtnText: { fontSize: 14 },
    removeRangeBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#27272a', alignSelf: 'flex-start' },
    removeRangeBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },

    // Library
    libraryTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginTop: 24, marginBottom: 12 },
    categorySection: { marginBottom: 16 },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingVertical: 8, paddingHorizontal: 4 },
    categoryName: { fontSize: 14, color: '#8b5cf6', fontWeight: '600' },
    categoryArrow: { color: '#71717a', fontSize: 12 },
    exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },


    // Save
    saveBtn: { backgroundColor: '#7CFC00', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
    saveBtnText: { color: '#0a0e14', fontSize: 16, fontWeight: '700' },

    // View Plan
    viewDayCard: { backgroundColor: '#151b24', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    viewDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    viewDayToggle: { color: '#71717a', fontSize: 16, paddingLeft: 16 },
    viewDayName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
    viewDaySchedule: { fontSize: 14, color: '#a3e635', marginTop: 2 },
    viewNoExercises: { color: '#71717a', fontStyle: 'italic', marginTop: 12 },
    viewExerciseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#27272a', marginTop: 8 },
    viewExerciseName: { color: '#ffffff', fontSize: 15 },
    viewExerciseSets: { color: '#a1a1aa', fontSize: 14 },
    viewExerciseRowExpanded: { backgroundColor: '#1f1f23', borderRadius: 8 },
    setDetailsList: { width: '100%', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#3f3f46' },
    setDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, flexWrap: 'wrap' },
    setTypeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, minWidth: 28, alignItems: 'center' },
    warmupBadge: { backgroundColor: '#422006' },
    workingBadge: { backgroundColor: '#166534' },
    setTypeBadgeText: { color: '#fcd34d', fontSize: 11, fontWeight: '600' },
    setDetailReps: { color: '#ffffff', fontSize: 14 },
    techniqueBadge: { backgroundColor: '#164e63', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    techniqueBadgeText: { color: '#22d3ee', fontSize: 11 },
    modifierIcon: { fontSize: 14 },
    setNote: { color: '#a1a1aa', fontSize: 12, flex: 1 },
    notePopup: { backgroundColor: '#3f3f46', borderRadius: 8, padding: 12, marginTop: 8, width: '100%' },
    notePopupText: { color: '#e4e4e7', fontSize: 13, marginBottom: 4 },

    // Delete Confirmation Modal
    deleteModalContent: { backgroundColor: '#18181b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
    deleteModalIcon: { fontSize: 48, marginBottom: 16 },
    deleteModalTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
    deleteModalMessage: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    deleteModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    deleteModalCancelBtn: { flex: 1, backgroundColor: '#27272a', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    deleteModalCancelBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
    deleteModalDeleteBtn: { flex: 1, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    deleteModalDeleteBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
    supersetSection: { width: '100%', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#3f3f46' },
    supersetLinked: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    supersetLabel: { color: '#22d3ee', fontSize: 13 },
    supersetName: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    unlinkBtn: { backgroundColor: '#7f1d1d', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    unlinkBtnText: { color: '#fecaca', fontSize: 12 },
    linkSupersetBtn: { backgroundColor: '#27272a', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46' },
    linkSupersetBtnText: { color: '#22d3ee', fontSize: 13 },
    supersetDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    supersetDropdownLabel: { color: '#a1a1aa', fontSize: 12 },
    supersetCloseBtn: { color: '#71717a', fontSize: 16, padding: 4 },
    supersetDropdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    supersetOption: { backgroundColor: '#27272a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
    supersetOptionText: { color: '#22d3ee', fontSize: 13 },
    supersetBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1 },
    supersetBadgeText: { fontSize: 10, fontWeight: '700' },

    // Exercise Selection
    exerciseBtn: { backgroundColor: '#27272a', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#3f3f46' },
    exerciseBtnSelected: { backgroundColor: '#4c1d95', borderColor: '#8b5cf6' },
    exerciseBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
    exerciseBtnTextSelected: { color: '#ffffff', fontWeight: 'bold' },

    // Day Picker Modal
    dayPickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
    dayPickerContent: { backgroundColor: '#18181b', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 32 },
    dayPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#27272a' },
    dayPickerTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
    dayPickerClose: { fontSize: 24, color: '#a1a1aa' },
    dayPickerList: { padding: 24 },
    dayPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#27272a', padding: 16, borderRadius: 12, marginBottom: 12 },
    dayPickerItemLeft: { flex: 1 },
    dayPickerItemName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
    dayPickerItemInfo: { fontSize: 13, color: '#a1a1aa', marginTop: 4 },
    dayPickerItemRight: { alignItems: 'flex-end' },
    dayPickerCompletedCount: { fontSize: 13, color: '#22c55e', fontWeight: '600', marginBottom: 4 },
    dayPickerArrow: { color: '#71717a', fontSize: 16 },

    // Success Modal
    successModalContent: { backgroundColor: '#18181b', borderRadius: 24, padding: 32, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
    successModalIcon: { fontSize: 48, marginBottom: 16 },
    successModalTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 12 },
    successModalMessage: { fontSize: 15, color: '#a1a1aa', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    successModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    successModalHubBtn: { flex: 1, backgroundColor: '#27272a', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    successModalHubBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    successModalStartBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    successModalStartBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

    // Info Modal
    infoModalContent: { backgroundColor: '#18181b', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#8b5cf6' },
    infoModalTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16, textAlign: 'center' },
    infoModalBody: { gap: 12 },
    infoModalItem: { fontSize: 14, color: '#a1a1aa', lineHeight: 20 },
    infoModalBold: { color: '#ffffff', fontWeight: '600' },
    infoModalCloseBtn: { backgroundColor: '#8b5cf6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    infoModalCloseBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
