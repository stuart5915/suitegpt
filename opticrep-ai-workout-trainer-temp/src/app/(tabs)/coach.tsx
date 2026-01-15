import { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Modal,
    Alert,
    Animated,
    Image,
    Dimensions,
    Keyboard,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface Supplement {
    id: string;
    name: string;
    dosage?: string;
    timing?: string;
    frequency?: string;
    notes?: string;
}

interface UserGoals {
    primaryGoal: string;
    currentWeight?: number;
    targetWeight?: number;
    weeklyWorkouts: number;
    notes?: string;
}

interface WorkoutSession {
    id: string;
    day_name: string;
    plan_id?: string;
    plan_name?: string;
    duration_seconds: number;
    exercises_completed: number;
    total_sets: number;
    total_reps: number;
    total_volume: number;
    exercises_data?: { name: string; sets: { reps: number; weight: number }[] }[];
    created_at: string;
}

interface ProgressPhoto {
    id: string;
    photo_url: string;
    pose_type?: string;
    notes?: string;
    weight_at_time?: number;
    created_at: string;
}

interface DietPlan {
    id?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    notes?: string;
}

// Context card types
type ContextCardType = 'photos' | 'supplements' | 'diet' | 'goals' | 'workouts' | null;

// Predefined supplements for quick-add pills
const COMMON_SUPPLEMENTS = [
    { name: 'Vitamin D', defaultDosage: '5000 IU' },
    { name: 'Vitamin C', defaultDosage: '1000 mg' },
    { name: 'Omega-3', defaultDosage: '1000 mg' },
    { name: 'Magnesium', defaultDosage: '400 mg' },
    { name: 'Zinc', defaultDosage: '30 mg' },
    { name: 'Creatine', defaultDosage: '5 g' },
    { name: 'Vitamin B12', defaultDosage: '1000 mcg' },
    { name: 'Iron', defaultDosage: '18 mg' },
    { name: 'Calcium', defaultDosage: '500 mg' },
    { name: 'Protein', defaultDosage: '25 g' },
    { name: 'Ashwagandha', defaultDosage: '600 mg' },
    { name: 'Multivitamin', defaultDosage: '1 tablet' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CoachScreen() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content:
                "Hey! I'm your Pro-Coach, powered by Gemini. I have memory of your workout history, supplements, diet, and goals. How can I help you today?",
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const supplementsScrollRef = useRef<ScrollView>(null);

    // Context card states
    const [activeModal, setActiveModal] = useState<ContextCardType>(null);
    const [supplements, setSupplements] = useState<Supplement[]>([]);
    const [goals, setGoals] = useState<UserGoals>({ primaryGoal: '', weeklyWorkouts: 4 });
    const [supplementImportText, setSupplementImportText] = useState('');
    const [isImportingSupplements, setIsImportingSupplements] = useState(false);
    const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
    const [planIdToName, setPlanIdToName] = useState<Map<string, string>>(new Map());
    const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

    // Diet state
    const [diet, setDiet] = useState<DietPlan>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [showAdvancedDiet, setShowAdvancedDiet] = useState(false);
    const [isSavingDiet, setIsSavingDiet] = useState(false);
    const [isSavingStats, setIsSavingStats] = useState(false);

    // Progress Photos state
    const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
    const [photoViewMode, setPhotoViewMode] = useState<'gallery' | 'compare'>('gallery');
    const [comparePhoto1, setComparePhoto1] = useState<ProgressPhoto | null>(null);
    const [comparePhoto2, setComparePhoto2] = useState<ProgressPhoto | null>(null);
    const [selectedPhotoForView, setSelectedPhotoForView] = useState<ProgressPhoto | null>(null);
    const [isSavingPhoto, setIsSavingPhoto] = useState(false);

    // Manual supplement entry state
    const [showAddSupplementForm, setShowAddSupplementForm] = useState(false);
    const [newSupplementName, setNewSupplementName] = useState('');
    const [newSupplementDosage, setNewSupplementDosage] = useState('');

    // PEDs (Advanced) section state
    const [peds, setPeds] = useState<Supplement[]>([]);
    const [showPedsSection, setShowPedsSection] = useState(false);
    const [showAddPedForm, setShowAddPedForm] = useState(false);
    const [newPedName, setNewPedName] = useState('');
    const [newPedDosage, setNewPedDosage] = useState('');

    // User Notes for AI context (e.g. "lactose intolerant", "intermittent fasting")
    const [userNotes, setUserNotes] = useState<string[]>([]);
    const [newNote, setNewNote] = useState('');

    // Profile Setup Wizard state
    const [showProfileSetup, setShowProfileSetup] = useState(false);
    const [setupStep, setSetupStep] = useState(0); // 0=welcome, 1=stats, 2=diet, 3=supplements, 4=done
    const { setup } = useLocalSearchParams<{ setup?: string }>();
    const router = useRouter();
    // Inline expanded workout day in Training Log
    const [expandedDayName, setExpandedDayName] = useState<string | null>(null);
    const [showAllSessions, setShowAllSessions] = useState(true); // Expanded by default to show sessions
    const [showOverview, setShowOverview] = useState(false); // Collapsed by default (just volume trend)

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 2000);
    };

    // Export functionality state
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Export functions
    const generateExportHTML = () => {
        const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const dayGroups = Object.values(groupedSessions);

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpticRep Data Export</title>' +
            '<style>' +
            'body{font-family:-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}' +
            'h1{color:#7CFC00;border-bottom:2px solid #7CFC00;padding-bottom:10px}' +
            'h2{color:#22d3ee;margin-top:30px}' +
            '.section{margin-bottom:30px;background:#f8f9fa;padding:20px;border-radius:10px}' +
            '.stat{display:inline-block;margin-right:20px;margin-bottom:10px}' +
            '.stat-label{font-size:12px;color:#666}' +
            '.stat-value{font-size:18px;font-weight:bold}' +
            '</style></head><body>' +
            '<h1>🏋️ OpticRep Data Export</h1>' +
            '<p>Exported on ' + now + '</p>' +
            '<div class="section"><h2>🎯 Goals & Stats</h2>' +
            '<div class="stat"><div class="stat-label">Primary Goal</div><div class="stat-value">' + (goals.primaryGoal || 'Not set') + '</div></div>' +
            '<div class="stat"><div class="stat-label">Current Weight</div><div class="stat-value">' + (goals.currentWeight ? goals.currentWeight + ' lbs' : 'Not set') + '</div></div>' +
            '<div class="stat"><div class="stat-label">Target Weight</div><div class="stat-value">' + (goals.targetWeight ? goals.targetWeight + ' lbs' : 'Not set') + '</div></div>' +
            '<div class="stat"><div class="stat-label">Weekly Workouts</div><div class="stat-value">' + goals.weeklyWorkouts + 'x/week</div></div>' +
            '</div>' +
            '<div class="section"><h2>🥗 Diet & Macros</h2>' +
            '<div class="stat"><div class="stat-label">Calories</div><div class="stat-value">' + diet.calories + ' kcal</div></div>' +
            '<div class="stat"><div class="stat-label">Protein</div><div class="stat-value">' + diet.protein + 'g</div></div>' +
            '<div class="stat"><div class="stat-label">Carbs</div><div class="stat-value">' + diet.carbs + 'g</div></div>' +
            '<div class="stat"><div class="stat-label">Fat</div><div class="stat-value">' + diet.fat + 'g</div></div>' +
            '</div>' +
            '<div class="section"><h2>💊 Supplements Stack</h2>' +
            (supplements.length > 0 ? supplements.map((s: any) => '<span style="display:inline-block;background:#e0e7ff;padding:8px 16px;margin:5px;border-radius:20px">' + s.name + ' - ' + s.dosage + '</span>').join('') : '<p>No supplements added</p>') +
            '</div>' +
            '<div class="section"><h2>📊 Training Log (' + workoutSessions.length + ' sessions)</h2>' +
            (dayGroups.length > 0 ? dayGroups.map((group: any) => '<h3>' + group.dayName + '</h3><p>' + group.sessions.length + ' session(s)</p>').join('') : '<p>No workout sessions yet</p>') +
            '</div>' +
            '<p style="font-size:12px;color:#666;text-align:center;margin-top:40px">Generated by OpticRep AI Workout Trainer</p>' +
            '</body></html>';
    };

    const generateExportText = () => {
        const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        let text = `OPTICREP DATA EXPORT\n${'='.repeat(50)} \nExported: ${now} \n\n`;

        text += `GOALS & STATS\n${'-'.repeat(30)} \n`;
        text += `Primary Goal: ${goals.primaryGoal || 'Not set'} \n`;
        text += `Current Weight: ${goals.currentWeight ? `${goals.currentWeight} lbs` : 'Not set'} \n`;
        text += `Target Weight: ${goals.targetWeight ? `${goals.targetWeight} lbs` : 'Not set'} \n`;
        text += `Weekly Workouts: ${goals.weeklyWorkouts} x / week\n`;
        if (goals.notes) text += `Notes: ${goals.notes} \n`;
        text += '\n';

        text += `DIET & MACROS\n${'-'.repeat(30)} \n`;
        text += `Calories: ${diet.calories} kcal\n`;
        text += `Protein: ${diet.protein} g | Carbs: ${diet.carbs} g | Fat: ${diet.fat} g\n`;
        if (diet.notes) text += `Diet Notes: ${diet.notes} \n`;
        text += '\n';

        text += `SUPPLEMENTS STACK\n${'-'.repeat(30)} \n`;
        if (supplements.length > 0) {
            supplements.forEach(s => { text += `• ${s.name} - ${s.dosage} \n`; });
        } else {
            text += 'No supplements added\n';
        }
        text += '\n';

        text += `TRAINING LOG (${workoutSessions.length} sessions)\n${'-'.repeat(30)}\n`;
        if (workoutSessions.length > 0) {
            workoutSessions.forEach(session => {
                const date = new Date(session.created_at).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                });
                const mins = Math.floor(session.duration_seconds / 60);

                text += `\n${session.day_name || 'Workout'}${session.plan_name ? ` (${session.plan_name})` : ''}\n`;
                text += `Date: ${date} | Duration: ${mins} min | Total Volume: ${session.total_volume.toLocaleString()} lbs\n`;

                // Show detailed exercise data if available
                if (session.exercises_data && session.exercises_data.length > 0) {
                    session.exercises_data.forEach(exercise => {
                        text += `\n  ${exercise.name}\n`;
                        exercise.sets.forEach((set, idx) => {
                            text += `    Set ${idx + 1}: ${set.reps} reps × ${set.weight} lbs\n`;
                        });
                    });
                } else {
                    text += `  (${session.total_sets} sets, ${session.total_reps} reps - detailed data not available)\n`;
                }
                text += `${'-'.repeat(30)}\n`;
            });
        } else {
            text += 'No workout sessions recorded yet\n';
        }

        if (userNotes.length > 0) {
            text += `\nPERSONAL NOTES\n${'-'.repeat(30)} \n`;
            userNotes.forEach(n => { text += `• ${n} \n`; });
        }

        text += `\n${'='.repeat(50)} \nGenerated by OpticRep AI Workout Trainer`;
        return text;
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const html = generateExportHTML();
            await Share.share({
                message: html,
                title: 'OpticRep Data Export (HTML)',
            });
            setShowExportModal(false);
        } catch (error) {
            console.error('HTML export error:', error);
            Alert.alert('Export Failed', 'Could not share data. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportText = async () => {
        setIsExporting(true);
        try {
            const text = generateExportText();
            await Share.share({
                message: text,
                title: 'OpticRep Data Export',
            });
            setShowExportModal(false);
        } catch (error) {
            console.error('Text export error:', error);
            Alert.alert('Export Failed', 'Could not share data. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    // Group sessions by day_name for hierarchical view
    const groupedSessions = workoutSessions.reduce((acc, session) => {
        const dayName = session.day_name || 'Unnamed Workout';
        if (!acc[dayName]) {
            acc[dayName] = [];
        }
        acc[dayName].push(session);
        return acc;
    }, {} as Record<string, WorkoutSession[]>);

    // Get session count and last date for each day
    const dayGroups = Object.entries(groupedSessions).map(([dayName, sessions]) => {
        const sortedSessions = [...sessions].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastSession = sortedSessions[0];
        const lastDate = new Date(lastSession.created_at);
        const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        const lastDateStr = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

        return {
            dayName,
            sessionCount: sessions.length,
            lastDateStr,
            sessions: sortedSessions,
            planName: lastSession.plan_name || null, // Get plan name from most recent session
        };
    }).sort((a, b) => {
        // Sort by most recently used
        const aLatest = new Date(a.sessions[0].created_at).getTime();
        const bLatest = new Date(b.sessions[0].created_at).getTime();
        return bLatest - aLatest;
    });

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    // Load supplements and goals on mount
    useEffect(() => {
        loadUserData();
    }, []);

    // Open profile setup wizard if navigated with ?setup=1
    useEffect(() => {
        if (setup === '1') {
            setShowProfileSetup(true);
            setSetupStep(0);
            // Clear the param so it doesn't reopen on tab switch
            router.setParams({ setup: undefined });
        }
    }, [setup]);

    const loadUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load supplements
            const { data: supps } = await (supabase as any)
                .from('user_supplements')
                .select('*')
                .eq('is_active', true);
            if (supps) setSupplements(supps);

            // Load goals from profile
            const { data: profile } = await (supabase as any)
                .from('profiles')
                .select('primary_goal, current_weight, target_weight, weekly_workout_target, goal_notes, user_notes')
                .eq('id', user.id)
                .single();
            if (profile) {
                setGoals({
                    primaryGoal: profile.primary_goal || '',
                    currentWeight: profile.current_weight,
                    targetWeight: profile.target_weight,
                    weeklyWorkouts: profile.weekly_workout_target || 4,
                    notes: profile.goal_notes,
                });
                if (profile.user_notes) setUserNotes(profile.user_notes);
            }

            // Load saved workout plans for name lookup
            const { data: savedPlans } = await (supabase as any)
                .from('saved_workout_templates')
                .select('id, name')
                .eq('user_id', user.id);

            // Build plan ID to name lookup map
            const planLookup = new Map<string, string>();
            if (savedPlans) {
                savedPlans.forEach((plan: { id: string; name: string }) => {
                    planLookup.set(plan.id, plan.name);
                });
                setPlanIdToName(planLookup);
            }

            // Load workout sessions
            const { data: workouts } = await (supabase as any)
                .from('workout_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            // Enrich sessions with plan names
            if (workouts) {
                const enrichedWorkouts = workouts.map((w: WorkoutSession) => ({
                    ...w,
                    plan_name: w.plan_id ? planLookup.get(w.plan_id) : undefined
                }));
                setWorkoutSessions(enrichedWorkouts);
            }

            // Load progress photos
            const { data: photos } = await (supabase as any)
                .from('progress_photos')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (photos) setProgressPhotos(photos);

            // Load diet plan
            const { data: dietPlan } = await (supabase as any)
                .from('user_diet_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();
            if (dietPlan) {
                setDiet({
                    id: dietPlan.id,
                    calories: dietPlan.calories || 0,
                    protein: dietPlan.protein_grams || 0,
                    carbs: dietPlan.carb_grams || 0,
                    fat: dietPlan.fat_grams || 0,
                    notes: dietPlan.notes,
                });
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    };

    // Show the custom delete confirmation modal
    const showDeleteConfirm = (workoutId: string) => {
        setWorkoutToDelete(workoutId);
        setDeleteConfirmVisible(true);
    };

    // Actually perform the delete
    const confirmDelete = async () => {
        if (!workoutToDelete) return;

        try {
            const { error } = await (supabase as any)
                .from('workout_sessions')
                .delete()
                .eq('id', workoutToDelete);

            if (error) {
                console.error('Delete error:', error);
                Alert.alert('Error', 'Failed to delete workout.');
                return;
            }

            // Remove from local state
            setWorkoutSessions(prev => prev.filter(w => w.id !== workoutToDelete));
        } catch (e) {
            console.error('Delete error:', e);
            Alert.alert('Error', 'Failed to delete workout.');
        } finally {
            setDeleteConfirmVisible(false);
            setWorkoutToDelete(null);
        }
    };

    // Progress Photos - Take a new photo
    const takeProgressPhoto = async (poseType?: string) => {
        try {
            // Request camera permissions
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera access is needed to take progress photos.');
                return;
            }

            // Launch camera
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [3, 4], // Portrait aspect ratio
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const photo = result.assets[0];
            await uploadProgressPhoto(photo.uri, poseType);
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo.');
        }
    };

    // Progress Photos - Pick from gallery
    const pickProgressPhoto = async (poseType?: string) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Gallery access is needed to select photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const photo = result.assets[0];
            await uploadProgressPhoto(photo.uri, poseType);
        } catch (error) {
            console.error('Error picking photo:', error);
            Alert.alert('Error', 'Failed to select photo.');
        }
    };

    // Save photo reference (just stores the URI from user's gallery - no file copying)
    const uploadProgressPhoto = async (uri: string, poseType?: string) => {
        setIsSavingPhoto(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Not Signed In', 'Please sign in to save progress photos.');
                return;
            }

            // Just save the URI reference to database
            // The photo stays in the user's gallery, we just reference it
            if (__DEV__) console.log('[ProgressPhotos] Saving reference to:', uri.substring(0, 50) + '...');

            const { data: photoRecord, error: dbError } = await (supabase as any)
                .from('progress_photos')
                .insert({
                    user_id: user.id,
                    photo_url: uri, // Direct gallery URI
                    pose_type: poseType,
                })
                .select()
                .single();

            if (dbError) {
                console.error('[ProgressPhotos] DB error:', dbError);
                Alert.alert('Error', 'Failed to save photo reference.');
                return;
            }

            setProgressPhotos(prev => [photoRecord, ...prev]);
            Alert.alert('Success', 'Progress photo saved!');
        } catch (error) {
            console.error('[ProgressPhotos] Save photo error:', error);
            Alert.alert('Error', 'Failed to save photo.');
        } finally {
            setIsSavingPhoto(false);
        }
    };

    // Delete a progress photo
    const deleteProgressPhoto = async (photoId: string) => {
        try {
            const { error } = await (supabase as any)
                .from('progress_photos')
                .delete()
                .eq('id', photoId);

            if (error) {
                console.error('Delete photo error:', error);
                Alert.alert('Error', 'Failed to delete photo.');
                return;
            }

            setProgressPhotos(prev => prev.filter(p => p.id !== photoId));
        } catch (error) {
            console.error('Delete photo error:', error);
            Alert.alert('Error', 'Failed to delete photo.');
        }
    };

    const renderRightActions = (workoutId: string) => (
        _progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const scale = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0.5],
            extrapolate: 'clamp',
        });

        return (
            <RectButton
                style={styles.deleteAction}
                onPress={() => showDeleteConfirm(workoutId)}
            >
                <Animated.Text style={[styles.deleteActionText, { transform: [{ scale }] }]}>
                    🗑️
                </Animated.Text>
            </RectButton>
        );
    };

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const messageToSend = inputText.trim();
        setInputText('');
        setIsLoading(true);

        try {
            // Save user message to memory
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await (supabase as any).from('coach_memories').insert({
                    user_id: user.id,
                    type: 'user_message',
                    content: messageToSend,
                });
            }

            // Call Gemini with context
            const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) throw new Error('No API key');

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            // Build context
            const context = `You are Pro - Coach, a fitness AI assistant with memory.

    User's current data:
        - Goals: ${goals.primaryGoal || 'Not set'}, Current weight: ${goals.currentWeight || 'Not set'} lbs, Target weight: ${goals.targetWeight || 'Not set'} lbs, Weekly workouts: ${goals.weeklyWorkouts}
- Diet Macros: ${(diet.protein > 0 || diet.carbs > 0 || diet.fat > 0) ? `${diet.protein}g protein, ${diet.carbs}g carbs, ${diet.fat}g fat (~${(diet.protein * 4) + (diet.carbs * 4) + (diet.fat * 9)} cal/day)` : 'Not set'}
- User Notes: ${userNotes.length > 0 ? userNotes.join(', ') : 'None'}
- Supplements: ${supplements.map(s => `${s.name} (${s.dosage || 'N/A'})`).join(', ') || 'None logged'}
- Advanced / PEDs: ${peds.length > 0 ? peds.map(p => `${p.name} (${p.dosage || 'N/A'})`).join(', ') : 'None logged'}

Recent Workouts(${workoutSessions.length} logged):
${workoutSessions.slice(0, 5).map(session => {
                const date = new Date(session.created_at).toLocaleDateString();
                const exercises = session.exercises_data?.map((ex: any) => {
                    const heaviest = ex.sets?.reduce((max: number, set: any) => Math.max(max, set.weight || 0), 0);
                    return `${ex.name}: ${ex.sets?.length || 0} sets, heaviest ${heaviest}lbs`;
                }).join('; ') || 'No exercises';
                return `- ${session.day_name || 'Workout'} (${date}): ${exercises}`;
            }).join('\n') || 'No workouts logged yet'
                }

Previous messages in this conversation:
${messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

If the user logs something like "had a cheat meal" or "did extra cardio", acknowledge it and remember it.
When asked about workout history, analyze the exercises data to find heaviest weights, volume, etc.
Respond naturally and helpfully.Keep responses concise but informative.`;

            const result = await model.generateContent(`${context} \n\nUser: ${messageToSend} `);
            const responseText = result.response.text();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Save assistant response to memory
            if (user) {
                await (supabase as any).from('coach_memories').insert({
                    user_id: user.id,
                    type: 'coach_message',
                    content: responseText,
                });
            }
        } catch (error) {
            console.error('Coach error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I'm having trouble connecting. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const parseSupplementsWithAI = async () => {
        if (!supplementImportText.trim()) return;

        setIsImportingSupplements(true);
        try {
            const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) throw new Error('No API key');

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const prompt = `Parse this supplement list into JSON array.
Each item: { name, dosage, timing, frequency, notes }
Return ONLY valid JSON, no markdown.

    ${supplementImportText} `;

            const result = await model.generateContent(prompt);
            let jsonText = result.response.text().trim();
            if (jsonText.startsWith('```')) jsonText = jsonText.replace(/```json?|```/g, '').trim();

            const parsed = JSON.parse(jsonText);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            // Save to Supabase
            for (const supp of parsed) {
                await (supabase as any).from('user_supplements').insert({
                    user_id: user.id,
                    name: supp.name,
                    dosage: supp.dosage,
                    timing: supp.timing,
                    frequency: supp.frequency,
                    notes: supp.notes,
                });
            }

            setSupplementImportText('');
            loadUserData();
            Alert.alert('Success', `Imported ${parsed.length} supplements!`);
        } catch (error) {
            console.error('Supplement import error:', error);
            Alert.alert('Error', 'Failed to parse supplements. Please try again.');
        } finally {
            setIsImportingSupplements(false);
        }
    };

    // Toggle a supplement pill - add or remove from user's list
    const toggleSupplementPill = async (name: string, defaultDosage: string) => {
        // Check if already in list
        const existing = supplements.find(s => s.name.toLowerCase() === name.toLowerCase());

        if (existing) {
            // Remove it - update UI immediately
            setSupplements(prev => prev.filter(s => s.id !== existing.id));

            // Try to delete from DB in background (silent failure ok)
            try {
                await (supabase as any)
                    .from('user_supplements')
                    .delete()
                    .eq('id', existing.id);
            } catch (e) {
                if (__DEV__) console.log('[Supplements] Delete failed (offline or guest mode):', e);
            }
        } else {
            // Add it - update UI immediately with temp ID
            const tempId = `temp-${Date.now()}`;
            const newSupplement = { id: tempId, name, dosage: defaultDosage };
            setSupplements(prev => [...prev, newSupplement]);

            // Try to save to DB in background
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data, error } = await (supabase as any)
                        .from('user_supplements')
                        .insert({
                            user_id: user.id,
                            name: name,
                            dosage: defaultDosage,
                            is_active: true,
                        })
                        .select()
                        .single();

                    if (data && !error) {
                        // Replace temp ID with real ID from DB
                        setSupplements(prev => prev.map(s =>
                            s.id === tempId ? { ...s, id: data.id } : s
                        ));
                    }
                }
            } catch (e) {
                if (__DEV__) console.log('[Supplements] Save failed (offline or guest mode):', e);
            }
        }
    };

    // Delete a supplement
    const deleteSupplement = async (id: string) => {
        // Update UI immediately
        setSupplements(prev => prev.filter(s => s.id !== id));

        // Try to delete from DB in background (silent failure ok for temp IDs or offline)
        if (!id.startsWith('temp-')) {
            try {
                await (supabase as any)
                    .from('user_supplements')
                    .delete()
                    .eq('id', id);
            } catch (e) {
                if (__DEV__) console.log('[Supplements] Delete failed:', e);
            }
        }
    };

    // Update supplement dosage
    const updateSupplementDosage = async (id: string, newDosage: string) => {
        try {
            const { error } = await (supabase as any)
                .from('user_supplements')
                .update({ dosage: newDosage, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) {
                console.error('Update dosage error:', error);
                return;
            }

            setSupplements(prev => prev.map(s =>
                s.id === id ? { ...s, dosage: newDosage } : s
            ));
        } catch (error) {
            console.error('Update dosage error:', error);
        }
    };

    // Manually add a supplement
    const addManualSupplement = async () => {
        if (!newSupplementName.trim()) return;

        const tempId = `temp-${Date.now()}`;
        const newSupplement = {
            id: tempId,
            name: newSupplementName.trim(),
            dosage: newSupplementDosage.trim() || undefined
        };
        setSupplements(prev => [...prev, newSupplement]);
        setNewSupplementName('');
        setNewSupplementDosage('');
        setShowAddSupplementForm(false);

        // Try to save to DB
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await (supabase as any)
                    .from('user_supplements')
                    .insert({
                        user_id: user.id,
                        name: newSupplement.name,
                        dosage: newSupplement.dosage,
                        is_active: true,
                    })
                    .select()
                    .single();

                if (data) {
                    setSupplements(prev => prev.map(s =>
                        s.id === tempId ? { ...s, id: data.id } : s
                    ));
                }
            }
        } catch (e) {
            if (__DEV__) console.log('[Supplements] Manual add save failed:', e);
        }
    };

    // Add a PED entry
    const addPed = async () => {
        if (!newPedName.trim()) return;

        const tempId = `ped-temp-${Date.now()}`;
        const newPed = {
            id: tempId,
            name: newPedName.trim(),
            dosage: newPedDosage.trim() || undefined
        };
        setPeds(prev => [...prev, newPed]);
        setNewPedName('');
        setNewPedDosage('');
        setShowAddPedForm(false);

        // Try to save to DB (using same table with a 'type' or separate handling)
        // For now we just keep in local state - can persist later
        if (__DEV__) console.log('[PEDs] Added:', newPed);
    };

    // Delete a PED entry
    const deletePed = (id: string) => {
        setPeds(prev => prev.filter(p => p.id !== id));
    };

    const saveGoals = async (silent = false) => {
        setIsSavingStats(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await (supabase as any).from('profiles').update({
                primary_goal: goals.primaryGoal,
                current_weight: goals.currentWeight,
                target_weight: goals.targetWeight,
                weekly_workout_target: goals.weeklyWorkouts,
                goal_notes: goals.notes,
                user_notes: userNotes,
            }).eq('id', user.id);

            if (!silent) {
                showToast('✅ Stats saved!');
                setActiveModal(null);
            }
        } catch (error) {
            console.error('Save goals error:', error);
            if (!silent) Alert.alert('Error', 'Failed to save goals.');
        } finally {
            setIsSavingStats(false);
        }
    };

    const saveDiet = async (silent = false) => {
        setIsSavingDiet(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (diet.id) {
                // Update existing
                await (supabase as any).from('user_diet_plans').update({
                    calories: diet.calories,
                    protein_grams: diet.protein,
                    carb_grams: diet.carbs,
                    fat_grams: diet.fat,
                    notes: diet.notes,
                    updated_at: new Date().toISOString(),
                }).eq('id', diet.id);
            } else {
                // Insert new
                const { data } = await (supabase as any).from('user_diet_plans').insert({
                    user_id: user.id,
                    name: 'My Diet',
                    calories: diet.calories,
                    protein_grams: diet.protein,
                    carb_grams: diet.carbs,
                    fat_grams: diet.fat,
                    notes: diet.notes,
                    is_active: true,
                }).select().single();
                if (data) setDiet({ ...diet, id: data.id });
            }

            if (!silent) {
                showToast('✅ Diet saved!');
                setActiveModal(null);
            }
        } catch (error) {
            console.error('Save diet error:', error);
            if (!silent) Alert.alert('Error', 'Failed to save diet.');
        } finally {
            setIsSavingDiet(false);
        }
    };

    const contextCards = [
        { type: 'workouts' as const, icon: '🏋️', label: 'Workouts', count: workoutSessions.length, complete: false },
        { type: 'photos' as const, icon: '📸', label: 'Photos', count: progressPhotos.length, complete: false },
        { type: 'supplements' as const, icon: '💊', label: 'Supps', count: supplements.length + peds.length, complete: false },
        { type: 'diet' as const, icon: '🥗', label: 'Diet', count: diet.calories > 0 ? 1 : 0, complete: diet.protein > 0 && diet.carbs > 0 && diet.fat > 0 },
        { type: 'goals' as const, icon: '📊', label: 'Stats', count: goals.primaryGoal ? 1 : 0, complete: !!goals.primaryGoal && !!goals.currentWeight },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>AI Hub</Text>
                        <Text style={styles.headerSubtitle}>Your fitness data feeds the AI</Text>
                    </View>
                    <Pressable style={styles.exportButton} onPress={() => setShowExportModal(true)}>
                        <Text style={styles.exportButtonText}>📤</Text>
                    </Pressable>
                </View>

                {/* Data Stack Cards */}
                <View style={styles.contextCardsContainer}>
                    <Text style={styles.stackLabel}>My Stack</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextCardsScroll}>
                        {contextCards.map((card) => (
                            <Pressable
                                key={card.type}
                                style={styles.contextCard}
                                onPress={() => {
                                    // Reset workout modal state when opening workouts
                                    if (card.type === 'workouts') {
                                        setExpandedDayName(null);
                                        setShowOverview(false);
                                        setExpandedWorkoutId(null);
                                    }
                                    setActiveModal(card.type);
                                }}
                            >
                                <Text style={styles.contextCardIcon}>{card.icon}</Text>
                                <Text style={styles.contextCardLabel}>{card.label}</Text>
                                {card.complete ? (
                                    <View style={styles.contextCardCheck}>
                                        <Text style={styles.contextCardCheckText}>✓</Text>
                                    </View>
                                ) : card.count > 0 && (
                                    <View style={styles.contextCardBadge}>
                                        <Text style={styles.contextCardBadgeText}>{card.count}</Text>
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.flex}
                    contentContainerStyle={styles.messagesContent}
                >
                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageContainer,
                                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                            ]}
                        >
                            <View
                                style={[
                                    styles.messageBubble,
                                    message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                                ]}
                            >
                                <Text style={styles.messageText}>{message.content}</Text>
                            </View>
                            <Text style={styles.timestamp}>
                                {message.timestamp.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </View>
                    ))}

                    {isLoading && (
                        <View style={styles.assistantMessage}>
                            <View style={styles.assistantBubble}>
                                <Text style={styles.thinkingText}>Thinking...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* AI Suggestion Pills - Conversation Starters */}
                <View style={styles.suggestionSection}>
                    <Text style={styles.suggestionLabel}>💡 Quick questions</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
                        {[
                            "What should I eat today?",
                            "How much protein do I need?",
                            "Review my workout progress",
                            "Suggest a meal plan",
                            "Am I hitting my goals?",
                            "Tips for muscle growth",
                        ].map((question, i) => (
                            <Pressable
                                key={i}
                                style={styles.suggestionPill}
                                onPress={() => {
                                    setInputText(question);
                                }}
                            >
                                <Text style={styles.suggestionPillText}>{question}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Input */}
                <View style={styles.inputContainer}>
                    <View style={styles.inputRow}>
                        <TextInput
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Ask about training, or log something..."
                            placeholderTextColor="#71717a"
                            style={styles.textInput}
                            multiline
                            maxLength={500}
                            onSubmitEditing={handleSend}
                        />
                        <Pressable
                            onPress={handleSend}
                            disabled={!inputText.trim() || isLoading}
                            style={[
                                styles.sendButton,
                                inputText.trim() && !isLoading ? styles.sendButtonActive : styles.sendButtonInactive,
                            ]}
                        >
                            <Text style={styles.sendButtonText}>↑</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Supplements Modal */}
                <Modal visible={activeModal === 'supplements'} animationType="slide">
                    <SafeAreaView style={styles.fullScreenModal}>
                        <View style={styles.fullModalHeader}>
                            <View style={{ width: 40 }} />
                            <Text style={styles.fullModalTitle}>💊 My Supplements</Text>
                            <Pressable onPress={() => setActiveModal(null)}>
                                <Text style={styles.fullModalClose}>✕</Text>
                            </Pressable>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                        >
                            <ScrollView
                                ref={supplementsScrollRef}
                                style={styles.fullModalScroll}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}
                            >
                                {/* My Stack Section - User's active supplements */}
                                <View style={[styles.myStackSection, { marginTop: 20 }]}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text style={styles.sectionLabel}>My Stack</Text>
                                        <Pressable
                                            style={styles.addBtn}
                                            onPress={() => setShowAddSupplementForm(!showAddSupplementForm)}
                                        >
                                            <Text style={styles.addBtnText}>{showAddSupplementForm ? '−' : '+'}</Text>
                                        </Pressable>
                                    </View>

                                    {/* Manual Add Form */}
                                    {showAddSupplementForm && (
                                        <View style={styles.addFormRow}>
                                            <TextInput
                                                style={styles.addFormNameInput}
                                                placeholder="Supplement name"
                                                placeholderTextColor="#71717a"
                                                value={newSupplementName}
                                                onChangeText={setNewSupplementName}
                                            />
                                            <TextInput
                                                style={styles.addFormDosageInput}
                                                placeholder="Dosage"
                                                placeholderTextColor="#71717a"
                                                value={newSupplementDosage}
                                                onChangeText={setNewSupplementDosage}
                                            />
                                            <Pressable
                                                style={styles.addFormSubmitBtn}
                                                onPress={addManualSupplement}
                                            >
                                                <Text style={styles.addFormSubmitText}>Add</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    {supplements.length > 0 ? (
                                        supplements.map((supp) => (
                                            <View key={supp.id} style={styles.myStackItem}>
                                                <Text style={styles.myStackName}>{supp.name}</Text>
                                                <TextInput
                                                    style={styles.dosageInput}
                                                    value={supp.dosage || ''}
                                                    onChangeText={(text) => {
                                                        setSupplements(prev => prev.map(s =>
                                                            s.id === supp.id ? { ...s, dosage: text } : s
                                                        ));
                                                    }}
                                                    onBlur={() => {
                                                        if (supp.dosage) {
                                                            updateSupplementDosage(supp.id, supp.dosage);
                                                        }
                                                    }}
                                                    placeholder="Dosage"
                                                    placeholderTextColor="#71717a"
                                                />
                                                <Pressable
                                                    style={styles.deleteBtn}
                                                    onPress={() => deleteSupplement(supp.id)}
                                                >
                                                    <Text style={styles.deleteBtnText}>✕</Text>
                                                </Pressable>
                                            </View>
                                        ))
                                    ) : !showAddSupplementForm && (
                                        <Text style={styles.emptyStackText}>Tap + or a pill below to add supplements</Text>
                                    )}
                                </View>

                                {/* Quick Add Pills Section */}
                                <View style={styles.quickAddSection}>
                                    <Text style={styles.sectionLabel}>Quick Add</Text>
                                    <View style={styles.pillGrid}>
                                        {COMMON_SUPPLEMENTS.map((item) => {
                                            const isActive = supplements.some(
                                                s => s.name.toLowerCase() === item.name.toLowerCase()
                                            );
                                            return (
                                                <Pressable
                                                    key={item.name}
                                                    style={[
                                                        styles.supplementPill,
                                                        isActive && styles.supplementPillActive,
                                                    ]}
                                                    onPress={() => toggleSupplementPill(item.name, item.defaultDosage)}
                                                >
                                                    <Text style={[
                                                        styles.supplementPillText,
                                                        isActive && styles.supplementPillTextActive,
                                                    ]}>
                                                        {item.name}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Advanced (PEDs) Section - Collapsible */}
                                <View style={styles.pedsSection}>
                                    <Pressable
                                        style={styles.pedsSectionHeader}
                                        onPress={() => setShowPedsSection(!showPedsSection)}
                                    >
                                        <View style={styles.pedsTitleRow}>
                                            <Text style={styles.pedsSectionTitle}>⚡ Advanced</Text>
                                            <Text style={styles.pedsExpandIcon}>{showPedsSection ? '▼' : '▶'}</Text>
                                        </View>
                                    </Pressable>

                                    {showPedsSection && (
                                        <View style={styles.pedsContent}>
                                            <Text style={styles.pedsDisclaimer}>
                                                💉 Track compounds for personalized AI coaching advice
                                            </Text>

                                            {/* PEDs Header with Plus Button - matches My Stack style */}
                                            <View style={styles.sectionHeaderRow}>
                                                <Text style={styles.sectionLabel}>My Compounds</Text>
                                                <Pressable
                                                    style={styles.addBtn}
                                                    onPress={() => setShowAddPedForm(!showAddPedForm)}
                                                >
                                                    <Text style={styles.addBtnText}>{showAddPedForm ? '−' : '+'}</Text>
                                                </Pressable>
                                            </View>

                                            {/* Add PED Form - same style as supplements */}
                                            {showAddPedForm && (
                                                <View style={styles.addFormRow}>
                                                    <TextInput
                                                        style={styles.addFormNameInput}
                                                        placeholder="e.g. Testosterone"
                                                        placeholderTextColor="#71717a"
                                                        value={newPedName}
                                                        onChangeText={setNewPedName}
                                                    />
                                                    <TextInput
                                                        style={styles.addFormDosageInput}
                                                        placeholder="Dosage"
                                                        placeholderTextColor="#71717a"
                                                        value={newPedDosage}
                                                        onChangeText={setNewPedDosage}
                                                    />
                                                    <Pressable
                                                        style={styles.addFormSubmitBtn}
                                                        onPress={addPed}
                                                    >
                                                        <Text style={styles.addFormSubmitText}>Add</Text>
                                                    </Pressable>
                                                </View>
                                            )}

                                            {/* PEDs List */}
                                            {peds.length > 0 ? (
                                                peds.map((ped) => (
                                                    <View key={ped.id} style={styles.myStackItem}>
                                                        <Text style={styles.myStackName}>{ped.name}</Text>
                                                        <Text style={styles.pedDosageDisplay}>{ped.dosage || '-'}</Text>
                                                        <Pressable
                                                            style={styles.deleteBtn}
                                                            onPress={() => deletePed(ped.id)}
                                                        >
                                                            <Text style={styles.deleteBtnText}>✕</Text>
                                                        </Pressable>
                                                    </View>
                                                ))
                                            ) : !showAddPedForm && (
                                                <Text style={styles.emptyStackText}>Tap + to add compounds</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>

                {/* Stats Modal */}
                <Modal visible={activeModal === 'goals'} animationType="slide">
                    <SafeAreaView style={styles.fullScreenModal}>
                        <View style={styles.fullModalHeader}>
                            <View style={{ width: 40 }} />
                            <Text style={styles.fullModalTitle}>📊 My Stats</Text>
                            <Pressable onPress={() => setActiveModal(null)}>
                                <Text style={styles.fullModalClose}>✕</Text>
                            </Pressable>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                        >
                            <ScrollView style={styles.fullModalScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 20 }}>
                                <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Primary Goal</Text>
                                <View style={styles.goalOptions}>
                                    {['build_muscle', 'lose_fat', 'maintain', 'strength', 'endurance'].map((g) => (
                                        <Pressable
                                            key={g}
                                            style={[styles.goalOption, goals.primaryGoal === g && styles.goalOptionActive]}
                                            onPress={() => setGoals({ ...goals, primaryGoal: g })}
                                        >
                                            <Text style={[styles.goalOptionText, goals.primaryGoal === g && styles.goalOptionTextActive]}>
                                                {g.replace('_', ' ')}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                <Text style={styles.fieldLabel}>Workouts per Week</Text>
                                <TextInput
                                    style={styles.goalInput}
                                    value={String(goals.weeklyWorkouts)}
                                    onChangeText={(t) => setGoals({ ...goals, weeklyWorkouts: parseInt(t) || 4 })}
                                    keyboardType="number-pad"
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    placeholder="4"
                                    placeholderTextColor="#71717a"
                                />

                                <Text style={styles.fieldLabel}>Current Weight</Text>
                                <TextInput
                                    style={styles.goalInput}
                                    value={goals.currentWeight ? String(goals.currentWeight) : ''}
                                    onChangeText={(t) => setGoals({ ...goals, currentWeight: parseFloat(t) || undefined })}
                                    keyboardType="number-pad"
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    placeholder="e.g. 185"
                                    placeholderTextColor="#71717a"
                                />

                                <Text style={styles.fieldLabel}>Goal Weight (optional)</Text>
                                <TextInput
                                    style={styles.goalInput}
                                    value={goals.targetWeight ? String(goals.targetWeight) : ''}
                                    onChangeText={(t) => setGoals({ ...goals, targetWeight: parseFloat(t) || undefined })}
                                    keyboardType="number-pad"
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    placeholder="e.g. 180"
                                    placeholderTextColor="#71717a"
                                />

                                {/* Notes Section - Pills for AI Context */}
                                <View style={styles.notesSection}>
                                    <Text style={styles.notesSectionTitle}>📝 Notes for AI</Text>
                                    <Text style={styles.notesSectionHint}>Add dietary restrictions, health conditions, etc.</Text>

                                    {/* Notes Pills Grid */}
                                    {userNotes.length > 0 && (
                                        <View style={styles.notesPillGrid}>
                                            {userNotes.map((note, index) => (
                                                <View key={index} style={styles.notePill}>
                                                    <Text style={styles.notePillText}>{note}</Text>
                                                    <Pressable
                                                        style={styles.notePillRemove}
                                                        onPress={() => setUserNotes(userNotes.filter((_, i) => i !== index))}
                                                    >
                                                        <Text style={styles.notePillRemoveText}>✕</Text>
                                                    </Pressable>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Add Note Input */}
                                    <View style={styles.addNoteRow}>
                                        <TextInput
                                            style={styles.addNoteInput}
                                            value={newNote}
                                            onChangeText={setNewNote}
                                            placeholder="e.g., Lactose intolerant"
                                            placeholderTextColor="#71717a"
                                            returnKeyType="done"
                                            blurOnSubmit={true}
                                            onSubmitEditing={() => {
                                                if (newNote.trim()) {
                                                    setUserNotes([...userNotes, newNote.trim()]);
                                                    setNewNote('');
                                                }
                                            }}
                                        />
                                        <Pressable
                                            style={[styles.addNoteBtn, !newNote.trim() && styles.addNoteBtnDisabled]}
                                            onPress={() => {
                                                if (newNote.trim()) {
                                                    setUserNotes([...userNotes, newNote.trim()]);
                                                    setNewNote('');
                                                }
                                            }}
                                            disabled={!newNote.trim()}
                                        >
                                            <Text style={styles.addNoteBtnText}>+</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={{ marginTop: 24, marginBottom: 20 }}>
                                    <Pressable
                                        style={[styles.saveBtn, { marginTop: 0 }, isSavingStats && styles.saveBtnDisabled]}
                                        onPress={() => saveGoals()}
                                        disabled={isSavingStats}
                                    >
                                        <Text style={styles.saveBtnText}>
                                            {isSavingStats ? 'Saving...' : 'Save Stats'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>

                {/* Diet Modal */}
                <Modal visible={activeModal === 'diet'} animationType="slide">
                    <SafeAreaView style={styles.fullScreenModal}>
                        <View style={styles.fullModalHeader}>
                            <View style={{ width: 40 }} />
                            <Text style={styles.fullModalTitle}>🥗 My Diet</Text>
                            <Pressable onPress={() => setActiveModal(null)}>
                                <Text style={styles.fullModalClose}>✕</Text>
                            </Pressable>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                        >
                            <ScrollView style={styles.fullModalScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
                                <Text style={[styles.dietSectionTitle, { marginTop: 24 }]}>Daily Macro Targets</Text>

                                {/* Horizontal Macro Row */}
                                <View style={styles.macroRow}>
                                    <View style={styles.macroCardCompact}>
                                        <Text style={styles.macroCardLabel}>Protein</Text>
                                        <View style={styles.macroInputRow}>
                                            <TextInput
                                                style={styles.macroInput}
                                                value={diet.protein > 0 ? String(diet.protein) : ''}
                                                onChangeText={(t) => setDiet({ ...diet, protein: parseInt(t) || 0 })}
                                                keyboardType="number-pad"
                                                returnKeyType="done"
                                                blurOnSubmit={true}
                                                placeholder="0"
                                                placeholderTextColor="#52525b"
                                            />
                                            <Text style={styles.macroUnit}>g</Text>
                                        </View>
                                    </View>
                                    <View style={styles.macroCardCompact}>
                                        <Text style={styles.macroCardLabel}>Carbs</Text>
                                        <View style={styles.macroInputRow}>
                                            <TextInput
                                                style={styles.macroInput}
                                                value={diet.carbs > 0 ? String(diet.carbs) : ''}
                                                onChangeText={(t) => setDiet({ ...diet, carbs: parseInt(t) || 0 })}
                                                keyboardType="number-pad"
                                                returnKeyType="done"
                                                blurOnSubmit={true}
                                                placeholder="0"
                                                placeholderTextColor="#52525b"
                                            />
                                            <Text style={styles.macroUnit}>g</Text>
                                        </View>
                                    </View>
                                    <View style={styles.macroCardCompact}>
                                        <Text style={styles.macroCardLabel}>Fat</Text>
                                        <View style={styles.macroInputRow}>
                                            <TextInput
                                                style={styles.macroInput}
                                                value={diet.fat > 0 ? String(diet.fat) : ''}
                                                onChangeText={(t) => setDiet({ ...diet, fat: parseInt(t) || 0 })}
                                                keyboardType="number-pad"
                                                returnKeyType="done"
                                                blurOnSubmit={true}
                                                placeholder="0"
                                                placeholderTextColor="#52525b"
                                            />
                                            <Text style={styles.macroUnit}>g</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Subtle calorie estimate */}
                                <Text style={styles.calorieEstimate}>
                                    ≈ {(diet.protein * 4) + (diet.carbs * 4) + (diet.fat * 9) || 0} calories/day
                                </Text>


                                <Pressable
                                    style={[styles.saveBtn, isSavingDiet && styles.saveBtnDisabled]}
                                    onPress={() => saveDiet()}
                                    disabled={isSavingDiet}
                                >
                                    <Text style={styles.saveBtnText}>
                                        {isSavingDiet ? 'Saving...' : 'Save Diet'}
                                    </Text>
                                </Pressable>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>

                {/* Photos Modal - Full Progress Photos UI */}
                <Modal
                    visible={activeModal === 'photos'}
                    animationType="slide"
                    onRequestClose={() => {
                        if (photoViewMode === 'compare') {
                            setPhotoViewMode('gallery');
                            setComparePhoto1(null);
                            setComparePhoto2(null);
                        } else {
                            setActiveModal(null);
                        }
                    }}
                >
                    <SafeAreaView style={styles.fullScreenModal}>
                        {/* Header */}
                        <View style={styles.fullModalHeader}>
                            {photoViewMode === 'compare' ? (
                                <Pressable onPress={() => {
                                    setPhotoViewMode('gallery');
                                    setComparePhoto1(null);
                                    setComparePhoto2(null);
                                }}>
                                    <Text style={styles.backButtonText}>← Gallery</Text>
                                </Pressable>
                            ) : (
                                <View style={{ width: 40 }} />
                            )}
                            <Text style={styles.fullModalTitle}>📸 Progress Photos</Text>
                            <Pressable onPress={() => {
                                setActiveModal(null);
                                setPhotoViewMode('gallery');
                                setComparePhoto1(null);
                                setComparePhoto2(null);
                            }}>
                                <Text style={styles.fullModalClose}>✕</Text>
                            </Pressable>
                        </View>

                        <View style={{ flex: 1 }}>
                            {photoViewMode === 'gallery' ? (
                                <ScrollView
                                    style={styles.fullModalScroll}
                                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                                >
                                    {/* Saving Indicator */}
                                    {isSavingPhoto && (
                                        <View style={styles.savingIndicator}>
                                            <Text style={styles.savingIndicatorText}>💾 Saving photo...</Text>
                                        </View>
                                    )}

                                    {/* Add Photo Buttons */}
                                    <View style={styles.photoActions}>
                                        <Pressable
                                            style={[styles.photoActionBtn, isSavingPhoto && styles.photoActionBtnDisabled]}
                                            onPress={() => takeProgressPhoto()}
                                            disabled={isSavingPhoto}
                                        >
                                            <Text style={styles.photoActionIcon}>📸</Text>
                                            <Text style={styles.photoActionText}>Take Photo</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.photoActionBtn, isSavingPhoto && styles.photoActionBtnDisabled]}
                                            onPress={() => pickProgressPhoto()}
                                            disabled={isSavingPhoto}
                                        >
                                            <Text style={styles.photoActionIcon}>🖼️</Text>
                                            <Text style={styles.photoActionText}>Upload</Text>
                                        </Pressable>
                                    </View>

                                    {/* Compare Button */}
                                    {progressPhotos.length >= 2 && (
                                        <Pressable
                                            style={styles.compareModeBtn}
                                            onPress={() => setPhotoViewMode('compare')}
                                        >
                                            <Text style={styles.compareModeBtnText}>⚖️ Compare Photos</Text>
                                        </Pressable>
                                    )}

                                    {/* Photo Grid */}
                                    {progressPhotos.length > 0 ? (
                                        <View style={styles.photoGrid}>
                                            {progressPhotos.map((photo) => {
                                                const date = new Date(photo.created_at);
                                                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                return (
                                                    <Pressable
                                                        key={photo.id}
                                                        style={styles.photoGridItem}
                                                        onPress={() => {
                                                            setSelectedPhotoForView(photo);
                                                        }}
                                                        onLongPress={() => {
                                                            Alert.alert(
                                                                'Delete Photo?',
                                                                'This will permanently remove this progress photo.',
                                                                [
                                                                    { text: 'Cancel', style: 'cancel' },
                                                                    { text: 'Delete', style: 'destructive', onPress: () => deleteProgressPhoto(photo.id) }
                                                                ]
                                                            );
                                                        }}
                                                    >
                                                        <Image
                                                            source={{ uri: photo.photo_url }}
                                                            style={styles.photoGridImage}
                                                        />
                                                        {/* Delete Button Overlay */}
                                                        <Pressable
                                                            style={styles.photoDeleteBtn}
                                                            onPress={() => {
                                                                Alert.alert(
                                                                    'Delete Photo?',
                                                                    'This will permanently remove this progress photo.',
                                                                    [
                                                                        { text: 'Cancel', style: 'cancel' },
                                                                        { text: 'Delete', style: 'destructive', onPress: () => deleteProgressPhoto(photo.id) }
                                                                    ]
                                                                );
                                                            }}
                                                        >
                                                            <Text style={styles.photoDeleteBtnText}>✕</Text>
                                                        </Pressable>
                                                        <View style={styles.photoGridDate}>
                                                            <Text style={styles.photoGridDateText}>{dateStr}</Text>
                                                        </View>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View style={styles.emptyPhotos}>
                                            <Text style={styles.emptyPhotosEmoji}>📷</Text>
                                            <Text style={styles.emptyPhotosText}>No progress photos yet</Text>
                                            <Text style={styles.emptyPhotosSubtext}>Take your first photo to start tracking!</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            ) : (
                                /* Compare Mode */
                                <ScrollView
                                    style={styles.fullModalScroll}
                                    contentContainerStyle={{ padding: 20 }}
                                >
                                    <Text style={styles.compareTitle}>Select Two Photos to Compare</Text>

                                    {/* Selected Photos Preview */}
                                    <View style={styles.comparePreview}>
                                        <View style={styles.compareSlot}>
                                            {comparePhoto1 ? (
                                                <Pressable onPress={() => setComparePhoto1(null)}>
                                                    <Image source={{ uri: comparePhoto1.photo_url }} style={styles.compareSlotImage} />
                                                    <Text style={styles.compareSlotDate}>
                                                        {new Date(comparePhoto1.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </Text>
                                                </Pressable>
                                            ) : (
                                                <View style={styles.compareSlotEmpty}>
                                                    <Text style={styles.compareSlotEmptyText}>Before</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.compareVs}>VS</Text>
                                        <View style={styles.compareSlot}>
                                            {comparePhoto2 ? (
                                                <Pressable onPress={() => setComparePhoto2(null)}>
                                                    <Image source={{ uri: comparePhoto2.photo_url }} style={styles.compareSlotImage} />
                                                    <Text style={styles.compareSlotDate}>
                                                        {new Date(comparePhoto2.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </Text>
                                                </Pressable>
                                            ) : (
                                                <View style={styles.compareSlotEmpty}>
                                                    <Text style={styles.compareSlotEmptyText}>After</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Photo Selection Grid */}
                                    <Text style={styles.compareSelectLabel}>Tap a photo to select:</Text>
                                    <View style={styles.photoGrid}>
                                        {progressPhotos.map((photo) => {
                                            const isSelected = comparePhoto1?.id === photo.id || comparePhoto2?.id === photo.id;
                                            const date = new Date(photo.created_at);
                                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            return (
                                                <Pressable
                                                    key={photo.id}
                                                    style={[styles.photoGridItem, isSelected && styles.photoGridItemSelected]}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            if (comparePhoto1?.id === photo.id) setComparePhoto1(null);
                                                            if (comparePhoto2?.id === photo.id) setComparePhoto2(null);
                                                        } else if (!comparePhoto1) {
                                                            setComparePhoto1(photo);
                                                        } else if (!comparePhoto2) {
                                                            setComparePhoto2(photo);
                                                        }
                                                    }}
                                                >
                                                    <Image source={{ uri: photo.photo_url }} style={styles.photoGridImage} />
                                                    <View style={styles.photoGridDate}>
                                                        <Text style={styles.photoGridDateText}>{dateStr}</Text>
                                                    </View>
                                                    {isSelected && (
                                                        <View style={styles.photoGridCheck}>
                                                            <Text style={styles.photoGridCheckText}>✓</Text>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </SafeAreaView>

                    {/* Full Photo Viewer (Nested Modal) */}
                    {selectedPhotoForView && (
                        <Modal visible={true} animationType="fade" transparent>
                            <Pressable
                                style={styles.photoViewerOverlay}
                                onPress={() => setSelectedPhotoForView(null)}
                            >
                                <Image
                                    source={{ uri: selectedPhotoForView.photo_url }}
                                    style={styles.photoViewerImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.photoViewerDate}>
                                    {new Date(selectedPhotoForView.created_at).toLocaleDateString('en-US', {
                                        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                                    })}
                                </Text>
                            </Pressable>
                        </Modal>
                    )}
                </Modal>

                {/* Workouts Modal - Inline Expansion View */}
                <Modal visible={activeModal === 'workouts'} animationType="slide" onRequestClose={() => {
                    setExpandedDayName(null);
                    setActiveModal(null);
                }}>
                    <SafeAreaView style={styles.fullScreenModal}>
                        {/* Header */}
                        <View style={styles.fullModalHeader}>
                            <View style={{ width: 40 }} />
                            <Text style={styles.fullModalTitle}>📊 Training Log</Text>
                            <Pressable onPress={() => { setExpandedDayName(null); setActiveModal(null); }}>
                                <Text style={styles.fullModalClose}>✕</Text>
                            </Pressable>
                        </View>

                        {/* Day Groups with Inline Expansion */}
                        <ScrollView style={styles.fullModalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                            {dayGroups.length > 0 ? (
                                dayGroups.map((group) => {
                                    const isExpanded = expandedDayName === group.dayName;

                                    // Get all unique exercises across all sessions for this day
                                    const allExercises: string[] = [];
                                    group.sessions.forEach(session => {
                                        session.exercises_data?.forEach(ex => {
                                            if (!allExercises.includes(ex.name)) {
                                                allExercises.push(ex.name);
                                            }
                                        });
                                    });

                                    // Show up to 4 most recent sessions
                                    const recentSessions = group.sessions.slice(0, 4);

                                    return (
                                        <View key={group.dayName} style={{ marginBottom: 12 }}>
                                            {/* Day Group Header - Click to expand/collapse */}
                                            <Pressable
                                                style={[styles.dayGroupCard, isExpanded && { borderColor: '#a3e635', borderWidth: 1 }]}
                                                onPress={() => setExpandedDayName(isExpanded ? null : group.dayName)}
                                            >
                                                <View style={styles.dayGroupLeft}>
                                                    <Text style={styles.dayGroupName}>{group.dayName}</Text>
                                                    <Text style={styles.dayGroupMeta}>
                                                        {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''} • Last: {group.lastDateStr}
                                                    </Text>
                                                    {group.planName && (
                                                        <Text style={styles.dayGroupPlanBadge}>From: {group.planName}</Text>
                                                    )}
                                                </View>
                                                <Text style={styles.dayGroupArrow}>{isExpanded ? '▼' : '▶'}</Text>
                                            </Pressable>

                                            {/* Expanded Day Content - Shows inline below the card */}
                                            {isExpanded && (
                                                <View style={styles.expandedDayContent}>
                                                    {/* Overview Box - Collapsible */}
                                                    <Pressable
                                                        style={styles.overviewHeader}
                                                        onPress={() => setShowOverview(!showOverview)}
                                                    >
                                                        <Text style={styles.overviewTitle}>Overview</Text>
                                                        <Text style={styles.overviewToggle}>{showOverview ? '▲' : '▼'}</Text>
                                                    </Pressable>

                                                    {showOverview && (
                                                        <View style={styles.overviewBox}>
                                                            {/* Volume Summary */}
                                                            <View style={styles.volumeSummary}>
                                                                <Text style={styles.volumeSummaryLabel}>Total Volume Trend</Text>
                                                                <View style={styles.volumeRow}>
                                                                    {recentSessions.map((session, idx) => {
                                                                        const date = new Date(session.created_at);
                                                                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                        const volumeStr = session.total_volume >= 1000
                                                                            ? `${(session.total_volume / 1000).toFixed(1)}k`
                                                                            : session.total_volume.toLocaleString();
                                                                        const prevSession = recentSessions[idx + 1];
                                                                        const trend = prevSession
                                                                            ? session.total_volume > prevSession.total_volume ? '↑' : session.total_volume < prevSession.total_volume ? '↓' : '→'
                                                                            : '';
                                                                        const trendColor = trend === '↑' ? '#22c55e' : trend === '↓' ? '#ef4444' : '#71717a';
                                                                        return (
                                                                            <View key={session.id} style={styles.volumeCell}>
                                                                                <Text style={styles.volumeDate}>{dateStr}</Text>
                                                                                <Text style={styles.volumeValue}>{volumeStr}</Text>
                                                                                {trend && <Text style={[styles.volumeTrend, { color: trendColor }]}>{trend}</Text>}
                                                                            </View>
                                                                        );
                                                                    })}
                                                                </View>
                                                            </View>

                                                            {/* Exercise Comparison Grid - horizontal scroll for side-by-side comparison */}
                                                            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 16 }}>
                                                                <View style={styles.comparisonGrid}>
                                                                    {/* Header Row with dates */}
                                                                    <View style={styles.gridRow}>
                                                                        <View style={styles.gridExerciseCell}>
                                                                            <Text style={styles.gridHeaderText}>Exercise</Text>
                                                                        </View>
                                                                        {recentSessions.map((session) => {
                                                                            const date = new Date(session.created_at);
                                                                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                            return (
                                                                                <View key={session.id} style={styles.gridSessionCell}>
                                                                                    <Text style={styles.gridHeaderText}>{dateStr}</Text>
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </View>

                                                                    {/* Exercise Rows */}
                                                                    {allExercises.map((exerciseName, exIdx) => (
                                                                        <View key={exerciseName} style={[styles.gridRow, exIdx % 2 === 0 && styles.gridRowAlt]}>
                                                                            <View style={styles.gridExerciseCell}>
                                                                                <Text style={styles.gridExerciseName} numberOfLines={2}>{exerciseName}</Text>
                                                                            </View>
                                                                            {recentSessions.map((session, sessionIdx) => {
                                                                                const exerciseData = session.exercises_data?.find(e => e.name === exerciseName);
                                                                                if (!exerciseData) {
                                                                                    return (
                                                                                        <View key={session.id} style={styles.gridSessionCell}>
                                                                                            <Text style={styles.gridEmptyText}>—</Text>
                                                                                        </View>
                                                                                    );
                                                                                }

                                                                                // Get best set (highest weight × reps)
                                                                                const bestSet = exerciseData.sets.reduce((best, set) => {
                                                                                    const volume = set.reps * (set.weight || 0);
                                                                                    const bestVolume = best.reps * (best.weight || 0);
                                                                                    return volume > bestVolume ? set : best;
                                                                                }, exerciseData.sets[0]);

                                                                                // Compare with previous session
                                                                                const prevSession = recentSessions[sessionIdx + 1];
                                                                                const prevExercise = prevSession?.exercises_data?.find(e => e.name === exerciseName);
                                                                                let trend = '';
                                                                                let trendColor = '#71717a';
                                                                                if (prevExercise && prevExercise.sets.length > 0) {
                                                                                    const prevBest = prevExercise.sets.reduce((best, set) => {
                                                                                        const volume = set.reps * (set.weight || 0);
                                                                                        const bestVolume = best.reps * (best.weight || 0);
                                                                                        return volume > bestVolume ? set : best;
                                                                                    }, prevExercise.sets[0]);
                                                                                    const currVolume = bestSet.reps * (bestSet.weight || 0);
                                                                                    const prevVolume = prevBest.reps * (prevBest.weight || 0);
                                                                                    if (currVolume > prevVolume) {
                                                                                        trend = '↑';
                                                                                        trendColor = '#22c55e';
                                                                                    } else if (currVolume < prevVolume) {
                                                                                        trend = '↓';
                                                                                        trendColor = '#ef4444';
                                                                                    }
                                                                                }

                                                                                return (
                                                                                    <View key={session.id} style={styles.gridSessionCell}>
                                                                                        <Text style={styles.gridSetData}>
                                                                                            {bestSet.weight > 0 ? bestSet.weight : 'BW'}×{bestSet.reps}
                                                                                        </Text>
                                                                                        <Text style={styles.gridSetsCount}>
                                                                                            {exerciseData.sets.length} sets
                                                                                        </Text>
                                                                                        {trend && <Text style={[styles.gridTrend, { color: trendColor }]}>{trend}</Text>}
                                                                                    </View>
                                                                                );
                                                                            })}
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            </ScrollView>
                                                        </View>
                                                    )}

                                                    {/* All Sessions - Always visible when day is expanded */}
                                                    <Text style={styles.sessionListLabel}>
                                                        Sessions ({group.sessions.length})
                                                    </Text>

                                                    {group.sessions.map((workout) => {
                                                        const date = new Date(workout.created_at);
                                                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                                        const mins = Math.floor(workout.duration_seconds / 60);
                                                        const volumeStr = workout.total_volume >= 1000
                                                            ? `${(workout.total_volume / 1000).toFixed(1)}k`
                                                            : workout.total_volume.toLocaleString();
                                                        const isSessionExpanded = expandedWorkoutId === workout.id;

                                                        return (
                                                            <View key={workout.id} style={styles.sessionCard}>
                                                                <Pressable
                                                                    style={styles.sessionCardContent}
                                                                    onPress={() => setExpandedWorkoutId(isSessionExpanded ? null : workout.id)}
                                                                >
                                                                    <View style={styles.sessionCardLeft}>
                                                                        <Text style={styles.sessionDate}>{dateStr}</Text>
                                                                        <Text style={styles.sessionStats}>
                                                                            {mins}m • {workout.total_sets} sets • {volumeStr} lbs
                                                                        </Text>
                                                                    </View>
                                                                    <View style={styles.sessionCardRight}>
                                                                        <Text style={styles.sessionExpandIcon}>{isSessionExpanded ? '▲' : '▼'}</Text>
                                                                        <Pressable
                                                                            style={styles.sessionDeleteBtn}
                                                                            onPress={() => showDeleteConfirm(workout.id)}
                                                                        >
                                                                            <Text style={styles.sessionDeleteIcon}>🗑️</Text>
                                                                        </Pressable>
                                                                    </View>
                                                                </Pressable>

                                                                {/* Expanded: Show exercises and sets */}
                                                                {isSessionExpanded && workout.exercises_data && (
                                                                    <View style={styles.sessionExercisesList}>
                                                                        {workout.exercises_data.map((exercise, exIdx) => (
                                                                            <View key={exIdx} style={styles.sessionExerciseItem}>
                                                                                <Text style={styles.sessionExerciseName}>{exercise.name}</Text>
                                                                                <View style={styles.sessionSetsGrid}>
                                                                                    {exercise.sets.map((set, setIdx) => (
                                                                                        <View key={setIdx} style={styles.sessionSetChip}>
                                                                                            <Text style={styles.sessionSetText}>
                                                                                                {set.weight > 0 ? set.weight : 'BW'}×{set.reps}
                                                                                            </Text>
                                                                                        </View>
                                                                                    ))}
                                                                                </View>
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                )}
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>
                                    No workouts saved yet.{'\n'}Complete a workout and tap "Save to Hub" to see it here.
                                </Text>
                            )}
                        </ScrollView>

                        {/* Delete Confirmation Overlay - covers full modal */}
                        {deleteConfirmVisible && (
                            <Pressable
                                style={styles.deleteModalOverlay}
                                onPress={() => setDeleteConfirmVisible(false)}
                            >
                                <Pressable style={styles.deleteModalContent} onPress={() => { }}>
                                    <Text style={styles.deleteModalIcon}>🗑️</Text>
                                    <Text style={styles.deleteModalTitle}>Delete Workout?</Text>
                                    <Text style={styles.deleteModalMessage}>
                                        This will permanently remove this workout from your history. This cannot be undone.
                                    </Text>
                                    <View style={styles.deleteModalButtons}>
                                        <Pressable
                                            style={styles.deleteModalCancelBtn}
                                            onPress={() => setDeleteConfirmVisible(false)}
                                        >
                                            <Text style={styles.deleteModalCancelText}>Cancel</Text>
                                        </Pressable>
                                        <Pressable
                                            style={styles.deleteModalDeleteBtn}
                                            onPress={confirmDelete}
                                        >
                                            <Text style={styles.deleteModalDeleteText}>Delete</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            </Pressable>
                        )}
                    </SafeAreaView>
                </Modal>

                {/* Profile Setup Wizard Modal */}
                <Modal visible={showProfileSetup} animationType="fade" transparent>
                    <View style={styles.setupOverlay}>
                        <View style={styles.setupModal}>
                            {/* Close Button */}
                            <Pressable style={styles.setupCloseBtn} onPress={() => setShowProfileSetup(false)}>
                                <Text style={styles.setupCloseText}>✕</Text>
                            </Pressable>

                            {/* Step 0: Welcome */}
                            {setupStep === 0 && (
                                <View style={styles.setupContent}>
                                    <Text style={styles.setupEmoji}>🤖</Text>
                                    <Text style={styles.setupTitle}>Personalize Your Coach</Text>
                                    <Text style={styles.setupDescription}>
                                        The more your AI coach knows about you, the better advice it can give.{'\n\n'}
                                        Your data stays private and helps personalize workout tips, nutrition guidance, and supplement recommendations.
                                    </Text>
                                    <Pressable style={styles.setupPrimaryBtn} onPress={() => setSetupStep(1)}>
                                        <Text style={styles.setupPrimaryBtnText}>Let's Go →</Text>
                                    </Pressable>
                                    <Pressable style={styles.setupSkipBtn} onPress={() => setShowProfileSetup(false)}>
                                        <Text style={styles.setupSkipText}>Maybe Later</Text>
                                    </Pressable>
                                </View>
                            )}

                            {/* Step 1: Stats */}
                            {setupStep === 1 && (
                                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                                        <View style={styles.setupContent}>
                                            <Text style={styles.setupStepLabel}>Step 1 of 3</Text>
                                            <Text style={styles.setupTitle}>📊 Your Stats</Text>

                                            <Text style={styles.setupFieldLabel}>Primary Goal</Text>
                                            <View style={styles.setupGoalOptions}>
                                                {['build_muscle', 'lose_fat', 'maintain', 'strength'].map((g) => (
                                                    <Pressable
                                                        key={g}
                                                        style={[styles.setupGoalOption, goals.primaryGoal === g && styles.setupGoalActive]}
                                                        onPress={() => setGoals({ ...goals, primaryGoal: g })}
                                                    >
                                                        <Text style={[styles.setupGoalText, goals.primaryGoal === g && styles.setupGoalTextActive]}>
                                                            {g.replace('_', ' ')}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>

                                            <Text style={styles.setupFieldLabel}>Current Weight (lbs)</Text>
                                            <TextInput
                                                style={styles.setupInput}
                                                value={goals.currentWeight ? String(goals.currentWeight) : ''}
                                                onChangeText={(t) => setGoals({ ...goals, currentWeight: parseFloat(t) || undefined })}
                                                keyboardType="number-pad"
                                                returnKeyType="done"
                                                blurOnSubmit={true}
                                                placeholder="e.g. 185"
                                                placeholderTextColor="#71717a"
                                            />

                                            <Text style={styles.setupFieldLabel}>Goal Weight (optional)</Text>
                                            <TextInput
                                                style={styles.setupInput}
                                                value={goals.targetWeight ? String(goals.targetWeight) : ''}
                                                onChangeText={(t) => setGoals({ ...goals, targetWeight: parseFloat(t) || undefined })}
                                                keyboardType="number-pad"
                                                returnKeyType="done"
                                                blurOnSubmit={true}
                                                placeholder="e.g. 180"
                                                placeholderTextColor="#71717a"
                                            />


                                            <View style={styles.setupBtnRow}>
                                                <Pressable style={styles.setupSecondaryBtn} onPress={() => setSetupStep(2)}>
                                                    <Text style={styles.setupSecondaryBtnText}>Skip</Text>
                                                </Pressable>
                                                <Pressable style={styles.setupPrimaryBtn} onPress={() => {
                                                    saveGoals(true); // Save goals before moving to next step
                                                    setSetupStep(2);
                                                }}>
                                                    <Text style={styles.setupPrimaryBtnText}>Next →</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    </ScrollView>
                                </KeyboardAvoidingView>
                            )}

                            {/* Step 2: Diet */}
                            {setupStep === 2 && (
                                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                                        <View style={styles.setupContent}>
                                            <Text style={styles.setupStepLabel}>Step 2 of 3</Text>
                                            <Text style={styles.setupTitle}>🥗 Daily Macros</Text>
                                            <Text style={styles.setupDescription}>Set your daily macro targets (optional)</Text>

                                            {/* Smart Macro Suggestions based on goals */}
                                            {(goals.targetWeight || goals.currentWeight) && (
                                                <View style={styles.setupSuggestion}>
                                                    <Text style={styles.setupSuggestionTitle}>💡 AI Suggestion</Text>
                                                    <Text style={styles.setupSuggestionText}>
                                                        Based on your {goals.targetWeight ? 'goal' : 'current'} weight of {goals.targetWeight || goals.currentWeight} lbs
                                                        {goals.primaryGoal === 'build_muscle' && ' and muscle-building goal'}
                                                        {goals.primaryGoal === 'lose_fat' && ' and fat-loss goal'}
                                                        {goals.primaryGoal === 'strength' && ' and strength goal'}:
                                                    </Text>
                                                    <Text style={styles.setupSuggestionMacros}>
                                                        🥩 Protein: ~{goals.targetWeight || goals.currentWeight}g{' • '}
                                                        🍚 Carbs: ~{Math.round((goals.targetWeight || goals.currentWeight || 180) * (goals.primaryGoal === 'build_muscle' ? 2 : goals.primaryGoal === 'lose_fat' ? 1 : 1.5))}g{' • '}
                                                        🥑 Fat: ~{Math.round((goals.targetWeight || goals.currentWeight || 180) * (goals.primaryGoal === 'lose_fat' ? 0.5 : 0.4))}g
                                                    </Text>
                                                    <Pressable
                                                        style={styles.setupSuggestionBtn}
                                                        onPress={() => {
                                                            const weight = goals.targetWeight || goals.currentWeight || 180;
                                                            const carbMultiplier = goals.primaryGoal === 'build_muscle' ? 2 : goals.primaryGoal === 'lose_fat' ? 1 : 1.5;
                                                            const fatMultiplier = goals.primaryGoal === 'lose_fat' ? 0.5 : 0.4;
                                                            setDiet({
                                                                ...diet,
                                                                protein: Math.round(weight),
                                                                carbs: Math.round(weight * carbMultiplier),
                                                                fat: Math.round(weight * fatMultiplier),
                                                            });
                                                        }}
                                                    >
                                                        <Text style={styles.setupSuggestionBtnText}>Use Suggestion</Text>
                                                    </Pressable>
                                                </View>
                                            )}

                                            <View style={styles.setupMacroRow}>
                                                <View style={styles.setupMacroCard}>
                                                    <Text style={styles.setupMacroLabel}>Protein</Text>
                                                    <TextInput
                                                        style={styles.setupMacroInput}
                                                        value={diet.protein ? String(diet.protein) : ''}
                                                        onChangeText={(t) => setDiet({ ...diet, protein: parseInt(t) || 0 })}
                                                        keyboardType="number-pad"
                                                        returnKeyType="done"
                                                        blurOnSubmit={true}
                                                        placeholder="0"
                                                        placeholderTextColor="#71717a"
                                                    />
                                                    <Text style={styles.setupMacroUnit}>g</Text>
                                                </View>
                                                <View style={styles.setupMacroCard}>
                                                    <Text style={styles.setupMacroLabel}>Carbs</Text>
                                                    <TextInput
                                                        style={styles.setupMacroInput}
                                                        value={diet.carbs ? String(diet.carbs) : ''}
                                                        onChangeText={(t) => setDiet({ ...diet, carbs: parseInt(t) || 0 })}
                                                        keyboardType="number-pad"
                                                        returnKeyType="done"
                                                        blurOnSubmit={true}
                                                        placeholder="0"
                                                        placeholderTextColor="#71717a"
                                                    />
                                                    <Text style={styles.setupMacroUnit}>g</Text>
                                                </View>
                                                <View style={styles.setupMacroCard}>
                                                    <Text style={styles.setupMacroLabel}>Fat</Text>
                                                    <TextInput
                                                        style={styles.setupMacroInput}
                                                        value={diet.fat ? String(diet.fat) : ''}
                                                        onChangeText={(t) => setDiet({ ...diet, fat: parseInt(t) || 0 })}
                                                        keyboardType="number-pad"
                                                        returnKeyType="done"
                                                        blurOnSubmit={true}
                                                        placeholder="0"
                                                        placeholderTextColor="#71717a"
                                                    />
                                                    <Text style={styles.setupMacroUnit}>g</Text>
                                                </View>
                                            </View>

                                            <Text style={styles.setupCalorieText}>
                                                ≈ {(diet.protein * 4) + (diet.carbs * 4) + (diet.fat * 9)} calories/day
                                            </Text>

                                            <View style={styles.setupBtnRow}>
                                                <Pressable style={styles.setupSecondaryBtn} onPress={() => setSetupStep(1)}>
                                                    <Text style={styles.setupSecondaryBtnText}>← Back</Text>
                                                </Pressable>
                                                <Pressable style={styles.setupSecondaryBtn} onPress={() => setSetupStep(3)}>
                                                    <Text style={styles.setupSecondaryBtnText}>Skip</Text>
                                                </Pressable>
                                                <Pressable style={styles.setupPrimaryBtn} onPress={() => {
                                                    saveDiet(true); // Save diet before moving to next step
                                                    setSetupStep(3);
                                                }}>
                                                    <Text style={styles.setupPrimaryBtnText}>Next →</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    </ScrollView>
                                </KeyboardAvoidingView>
                            )}

                            {/* Step 3: Supplements */}
                            {setupStep === 3 && (
                                <ScrollView keyboardShouldPersistTaps="handled">
                                    <View style={styles.setupContent}>
                                        <Text style={styles.setupStepLabel}>Step 3 of 3</Text>
                                        <Text style={styles.setupTitle}>💊 Supplements</Text>
                                        <Text style={styles.setupDescription}>Tap to add any supplements you take</Text>

                                        <View style={styles.setupPillGrid}>
                                            {COMMON_SUPPLEMENTS.slice(0, 8).map((supp) => {
                                                const isActive = supplements.some(s => s.name === supp.name);
                                                return (
                                                    <Pressable
                                                        key={supp.name}
                                                        style={[styles.setupPill, isActive && styles.setupPillActive]}
                                                        onPress={() => toggleSupplementPill(supp.name, supp.defaultDosage)}
                                                    >
                                                        <Text style={[styles.setupPillText, isActive && styles.setupPillTextActive]}>
                                                            {supp.name}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>

                                        <Text style={styles.setupHint}>
                                            💡 You can adjust dosages and add more specific items (💉😉) in the Advanced section later!
                                        </Text>

                                        <View style={styles.setupBtnRow}>
                                            <Pressable style={styles.setupSecondaryBtn} onPress={() => setSetupStep(2)}>
                                                <Text style={styles.setupSecondaryBtnText}>← Back</Text>
                                            </Pressable>
                                            <Pressable style={styles.setupPrimaryBtn} onPress={() => setSetupStep(4)}>
                                                <Text style={styles.setupPrimaryBtnText}>Finish →</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                </ScrollView>
                            )}

                            {/* Step 4: Complete */}
                            {setupStep === 4 && (
                                <View style={styles.setupContent}>
                                    <Text style={styles.setupTitle}>You're All Set!</Text>
                                    <Text style={styles.setupDescription}>
                                        Your AI coach now knows about you. Ask questions about your training, nutrition, or supplements!
                                    </Text>
                                    <Pressable
                                        style={styles.setupPrimaryBtn}
                                        onPress={() => {
                                            saveGoals(true);
                                            saveDiet(true);
                                            setShowProfileSetup(false);
                                        }}
                                    >
                                        <Text style={styles.setupPrimaryBtnText}>Start Chatting 💬</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Export Modal */}
                <Modal visible={showExportModal} animationType="fade" transparent>
                    <Pressable style={styles.exportModalOverlay} onPress={() => setShowExportModal(false)}>
                        <Pressable style={styles.exportModalContent} onPress={() => { }}>
                            <Text style={styles.exportModalTitle}>📤 Export Data</Text>
                            <Text style={styles.exportModalSubtitle}>Choose your preferred format</Text>

                            <Pressable
                                style={[styles.exportOptionBtn, isExporting && styles.exportOptionBtnDisabled]}
                                onPress={handleExportPDF}
                                disabled={isExporting}
                            >
                                <Text style={styles.exportOptionIcon}>🌐</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.exportOptionTitle}>HTML Document</Text>
                                    <Text style={styles.exportOptionDesc}>Styled, view in browser</Text>
                                </View>
                            </Pressable>

                            <Pressable
                                style={[styles.exportOptionBtn, isExporting && styles.exportOptionBtnDisabled]}
                                onPress={handleExportText}
                                disabled={isExporting}
                            >
                                <Text style={styles.exportOptionIcon}>📝</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.exportOptionTitle}>Plain Text</Text>
                                    <Text style={styles.exportOptionDesc}>Simple text format</Text>
                                </View>
                            </Pressable>

                            {isExporting && (
                                <Text style={styles.exportingText}>Generating export...</Text>
                            )}

                            <Pressable style={styles.exportCancelBtn} onPress={() => setShowExportModal(false)}>
                                <Text style={styles.exportCancelText}>Cancel</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Toast Notification */}
                {toastMessage && (
                    <View style={styles.toast}>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0e14' },
    flex: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { color: '#94a3b8', fontSize: 14, marginTop: 2 },

    // Goals Banner - Always Visible
    goalsBanner: { backgroundColor: '#1e1b4b', marginHorizontal: 16, marginTop: 8, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#8b5cf6' },
    goalsBannerContent: { flexDirection: 'row', alignItems: 'center' },
    goalsBannerIcon: { fontSize: 28, marginRight: 12 },
    goalsBannerText: { flex: 1 },
    goalsBannerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', textTransform: 'capitalize' },
    goalsBannerDetails: { color: '#a78bfa', fontSize: 14, marginTop: 2 },
    goalsBannerEdit: { color: '#8b5cf6', fontSize: 14, fontWeight: '600' },

    // Context Cards (My Stack)
    stackLabel: { color: '#71717a', fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingTop: 16, textTransform: 'uppercase', letterSpacing: 1 },
    contextCardsContainer: { borderBottomWidth: 1, borderBottomColor: '#27272a' },
    contextCardsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
    contextCard: { backgroundColor: '#151b24', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', minWidth: 80 },
    contextCardIcon: { fontSize: 22, marginBottom: 6 },
    contextCardLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
    contextCardBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#7CFC00', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    contextCardBadgeText: { color: '#0a0e14', fontSize: 10, fontWeight: '700' },
    contextCardCheck: { position: 'absolute', top: -4, right: -4, backgroundColor: '#a3e635', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    contextCardCheckText: { color: '#0a0e14', fontSize: 12, fontWeight: '700' },

    // Messages
    messagesContent: { paddingVertical: 16, paddingHorizontal: 16 },
    messageContainer: { marginBottom: 16 },
    userMessage: { alignItems: 'flex-end' },
    assistantMessage: { alignItems: 'flex-start' },
    messageBubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
    userBubble: { backgroundColor: '#22d3ee', borderBottomRightRadius: 4 },
    assistantBubble: { backgroundColor: '#151b24', borderWidth: 1, borderColor: '#1e293b', borderBottomLeftRadius: 4 },
    messageText: { color: '#ffffff', lineHeight: 22 },
    thinkingText: { color: '#94a3b8' },
    timestamp: { color: '#64748b', fontSize: 10, marginTop: 4, paddingHorizontal: 4 },

    // Input
    inputContainer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0a0e14' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    textInput: { flex: 1, backgroundColor: '#151b24', borderWidth: 1, borderColor: '#1e293b', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 16, maxHeight: 100 },
    sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    sendButtonActive: { backgroundColor: '#22d3ee' },
    sendButtonInactive: { backgroundColor: '#1e293b' },
    sendButtonText: { color: '#ffffff', fontSize: 20 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: '#0f1419', borderRadius: 24, height: SCREEN_HEIGHT * 0.75, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
    modalClose: { color: '#64748b', fontSize: 24, padding: 4 },
    modalScroll: { flex: 1, padding: 20 },

    // Full Screen Modal (for workouts - guaranteed scrolling)
    fullScreenModal: { flex: 1, backgroundColor: '#0a0e14' },
    fullModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#0f1419' },
    fullModalTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600', flex: 1, textAlign: 'center' },
    fullModalClose: { color: '#64748b', fontSize: 24, padding: 4, width: 40, textAlign: 'right' },
    fullModalScroll: { flex: 1, backgroundColor: '#0a0e14' },

    // Comparison Grid (horizontal scrolling for session comparison)
    comparisonGrid: { paddingBottom: 8 },
    gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    gridRowAlt: { backgroundColor: 'rgba(30, 41, 59, 0.3)' },
    gridExerciseCell: { width: 140, paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'center' },
    gridSessionCell: { width: 90, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
    gridHeaderText: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    gridExerciseName: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
    gridSetData: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
    gridSetsCount: { color: '#71717a', fontSize: 10, marginTop: 2 },
    gridTrend: { fontSize: 12, marginTop: 2 },
    gridEmptyText: { color: '#52525b', fontSize: 14 },

    // Supplements
    supplementItem: { backgroundColor: '#27272a', borderRadius: 12, padding: 16, marginBottom: 12 },
    supplementName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    supplementDetails: { color: '#a1a1aa', fontSize: 14, marginTop: 4 },
    emptyText: { color: '#71717a', textAlign: 'center', paddingVertical: 40 },

    // Import
    importSection: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#27272a' },
    importLabel: { color: '#a1a1aa', fontSize: 14, marginBottom: 12 },
    importInput: { backgroundColor: '#09090b', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, padding: 16, color: '#ffffff', minHeight: 100, textAlignVertical: 'top' },
    importBtn: { backgroundColor: '#8b5cf6', borderRadius: 12, padding: 16, marginTop: 12, alignItems: 'center' },
    importBtnDisabled: { opacity: 0.5 },
    importBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

    // Quick Add Pills
    quickAddSection: { marginBottom: 24 },
    sectionLabel: { color: '#71717a', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    supplementPill: { backgroundColor: '#151b24', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#1e293b' },
    supplementPillActive: { backgroundColor: 'rgba(124, 252, 0, 0.15)', borderColor: '#7CFC00' },
    supplementPillText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
    supplementPillTextActive: { color: '#7CFC00' },

    // My Stack (editable list)
    myStackSection: { marginBottom: 24 },
    myStackItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151b24', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
    myStackName: { color: '#ffffff', fontSize: 15, fontWeight: '500', flex: 1 },
    dosageInput: { backgroundColor: '#0a0e14', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, color: '#7CFC00', fontSize: 14, fontWeight: '600', width: 90, textAlign: 'center', borderWidth: 1, borderColor: '#1e293b' },
    deleteBtn: { marginLeft: 10, padding: 6 },
    deleteBtnText: { color: '#ef4444', fontSize: 16 },
    emptyStackText: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 16 },

    // Section Header with Add Button
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    addBtn: { backgroundColor: '#7CFC00', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: '#0a0e14', fontSize: 18, fontWeight: '700', lineHeight: 20 },

    // Manual Add Form
    addFormRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    addFormNameInput: { flex: 1, backgroundColor: '#0a0e14', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: '#1e293b' },
    addFormDosageInput: { width: 80, backgroundColor: '#0a0e14', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, color: '#7CFC00', fontSize: 14, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: '#1e293b' },
    addFormSubmitBtn: { backgroundColor: '#7CFC00', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
    addFormSubmitText: { color: '#0a0e14', fontSize: 14, fontWeight: '700' },

    // PEDs (Advanced) Section
    pedsSection: { marginTop: 24, marginBottom: 24, borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 16 },
    pedsSectionHeader: { paddingVertical: 8 },
    pedsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pedsSectionTitle: { color: '#f59e0b', fontSize: 14, fontWeight: '600' },
    pedsExpandIcon: { color: '#71717a', fontSize: 10 },
    pedsContent: { marginTop: 12 },
    pedsDisclaimer: { color: '#64748b', fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
    pedDosageDisplay: { color: '#f59e0b', fontSize: 14, fontWeight: '600', marginRight: 8 },
    addPedBtn: { backgroundColor: '#151b24', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#1e293b', borderStyle: 'dashed' },
    addPedBtnText: { color: '#f59e0b', fontSize: 14, fontWeight: '500' },

    // Goals
    fieldLabel: { color: '#94a3b8', fontSize: 14, marginBottom: 8, marginTop: 16 },
    goalOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    goalOption: { backgroundColor: '#151b24', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1e293b' },
    goalOptionActive: { backgroundColor: '#7CFC00', borderColor: '#7CFC00' },
    goalOptionText: { color: '#94a3b8', fontSize: 14, textTransform: 'capitalize' },
    goalOptionTextActive: { color: '#0a0e14' },
    goalInput: { backgroundColor: '#0a0e14', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, padding: 16, color: '#ffffff', fontSize: 16 },
    saveBtn: { backgroundColor: '#7CFC00', borderRadius: 12, padding: 16, marginTop: 24, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#0a0e14', fontSize: 16, fontWeight: '700' },

    // Workout Items
    workoutItem: { backgroundColor: '#151b24', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    workoutItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' },
    workoutItemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    workoutItemDate: { color: '#22d3ee', fontSize: 12, fontWeight: '600' },
    workoutItemDuration: { color: '#64748b', fontSize: 12 },
    workoutItemName: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    workoutItemStats: { color: '#94a3b8', fontSize: 12 },
    workoutExpandIcon: { color: '#475569', fontSize: 10 },

    // Expanded Exercise Details
    exercisesList: { backgroundColor: '#0f1419', marginTop: -8, marginBottom: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, paddingTop: 16 },
    exerciseItem: { marginBottom: 12 },
    exerciseName: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
    setsContainer: { paddingLeft: 12 },
    setItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    setNumber: { color: '#64748b', fontSize: 12 },
    setData: { color: '#7CFC00', fontSize: 12, fontWeight: '600' },
    noExercisesText: { color: '#64748b', fontSize: 12, textAlign: 'center', paddingVertical: 8 },

    // Swipe to Delete
    deleteAction: {
        backgroundColor: '#dc2626',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: 12,
        marginBottom: 12,
    },
    deleteActionText: {
        fontSize: 24,
    },

    // Custom Delete Confirmation Overlay
    deleteModalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 100,
    },
    deleteModalContent: {
        backgroundColor: '#18181b',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#27272a',
    },
    deleteModalIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    deleteModalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    deleteModalMessage: {
        color: '#a1a1aa',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    deleteModalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    deleteModalCancelBtn: {
        flex: 1,
        backgroundColor: '#27272a',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteModalCancelText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    deleteModalDeleteBtn: {
        flex: 1,
        backgroundColor: '#dc2626',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteModalDeleteText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Hierarchical Workout Modal
    backButton: { paddingRight: 8 },
    backButtonText: { color: '#22d3ee', fontSize: 16, fontWeight: '500' },

    // Day Groups (Level 1)
    dayGroupCard: { backgroundColor: '#151b24', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#1e293b' },
    dayGroupLeft: { flex: 1 },
    dayGroupName: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
    dayGroupMeta: { color: '#71717a', fontSize: 13, marginTop: 4 },
    dayGroupArrow: { color: '#52525b', fontSize: 18 },
    dayGroupPlanBadge: { color: '#22d3ee', fontSize: 11, marginTop: 4, fontWeight: '500' },

    // Expanded Day Content (inline expansion)
    expandedDayContent: { backgroundColor: '#0f1419', borderRadius: 12, padding: 16, marginTop: -4, marginBottom: 4, borderWidth: 1, borderColor: '#1e293b', borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },

    // Volume Summary
    volumeSummary: { backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#4c1d95' },
    volumeSummaryLabel: { color: '#a78bfa', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    volumeRow: { flexDirection: 'row', justifyContent: 'space-around' },
    volumeCell: { alignItems: 'center' },
    volumeDate: { color: '#71717a', fontSize: 11, marginBottom: 4 },
    volumeValue: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    volumeTrend: { fontSize: 14, marginTop: 2 },

    // Session List
    sessionListLabel: { color: '#71717a', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    sessionCard: { backgroundColor: '#151b24', borderRadius: 10, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b' },
    sessionCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    sessionDate: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
    sessionStats: { color: '#71717a', fontSize: 12, marginTop: 2 },
    sessionDeleteBtn: { padding: 8 },
    sessionDeleteIcon: { fontSize: 18 },

    // Progress Photos
    photoActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    photoActionBtn: { flex: 1, backgroundColor: '#151b24', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
    photoActionBtnDisabled: { opacity: 0.5 },
    photoActionIcon: { fontSize: 28, marginBottom: 8 },
    photoActionText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
    savingIndicator: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 14, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
    savingIndicatorText: { color: '#93c5fd', fontSize: 15, fontWeight: '500' },

    compareModeBtn: { backgroundColor: '#1e1b4b', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#4c1d95' },
    compareModeBtnText: { color: '#a78bfa', fontSize: 15, fontWeight: '600' },

    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoGridItem: { width: (SCREEN_WIDTH - 72) / 3, aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    photoGridItemSelected: { borderWidth: 3, borderColor: '#7CFC00' },
    photoGridImage: { width: '100%', height: '100%' },
    photoGridDate: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: 4 },
    photoGridDateText: { color: '#ffffff', fontSize: 11, textAlign: 'center', fontWeight: '500' },
    photoGridCheck: { position: 'absolute', top: 4, right: 4, backgroundColor: '#7CFC00', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    photoGridCheckText: { color: '#0a0e14', fontSize: 14, fontWeight: '700' },

    emptyPhotos: { alignItems: 'center', paddingVertical: 60 },
    emptyPhotosEmoji: { fontSize: 64, marginBottom: 16 },
    emptyPhotosText: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptyPhotosSubtext: { color: '#71717a', fontSize: 14 },

    // Compare Mode
    compareTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
    comparePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 12 },
    compareSlot: { width: (SCREEN_WIDTH - 100) / 2, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
    compareSlotImage: { width: '100%', height: '100%' },
    compareSlotDate: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', padding: 8 },
    compareSlotEmpty: { width: '100%', height: '100%', backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#3f3f46', borderStyle: 'dashed', borderRadius: 12 },
    compareSlotEmptyText: { color: '#71717a', fontSize: 16, fontWeight: '500' },
    compareVs: { color: '#22d3ee', fontSize: 20, fontWeight: '700' },
    compareSelectLabel: { color: '#a1a1aa', fontSize: 13, marginBottom: 12 },

    // Photo Viewer
    photoViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    photoViewerImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH * 1.33, borderRadius: 12 },
    photoViewerDate: { color: '#ffffff', fontSize: 16, marginTop: 16, fontWeight: '500' },

    // Diet Modal
    dietSectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 16 },
    macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    macroCard: { width: '47%', backgroundColor: '#151b24', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
    macroCardLabel: { color: '#a1a1aa', fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    macroInputRow: { flexDirection: 'row', alignItems: 'center' },
    macroInput: { flex: 1, color: '#ffffff', fontSize: 24, fontWeight: '700', padding: 0 },
    macroUnit: { color: '#71717a', fontSize: 14, marginLeft: 4 },

    // Subtle calorie estimate
    calorieEstimate: { color: '#71717a', fontSize: 13, textAlign: 'center', marginBottom: 16 },

    // Horizontal Macro Row
    macroRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    macroCardCompact: { flex: 1, backgroundColor: '#151b24', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },

    advancedToggle: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#27272a', alignItems: 'center' },
    advancedToggleText: { color: '#22d3ee', fontSize: 14, fontWeight: '500' },
    advancedSection: { marginBottom: 20 },
    advancedInfo: { flexDirection: 'row', backgroundColor: '#1e3a5f', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#3b82f6' },
    advancedInfoIcon: { fontSize: 16, marginRight: 10 },
    advancedInfoText: { flex: 1, color: '#93c5fd', fontSize: 13, lineHeight: 18 },
    dietNotesInput: { backgroundColor: '#27272a', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 14, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3f3f46' },

    // Profile Setup Wizard
    setupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    setupModal: { backgroundColor: '#18181b', borderRadius: 24, padding: 24, maxWidth: 400, width: '100%', maxHeight: '85%', borderWidth: 1, borderColor: '#27272a' },
    setupCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 },
    setupCloseText: { color: '#71717a', fontSize: 20 },
    setupContent: { alignItems: 'center', paddingTop: 20 },
    setupEmoji: { fontSize: 64, marginBottom: 16 },
    setupTitle: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    setupDescription: { color: '#a1a1aa', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    setupStepLabel: { color: '#22d3ee', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },

    // Setup Buttons
    setupPrimaryBtn: { backgroundColor: '#7CFC00', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
    setupPrimaryBtnText: { color: '#0a0e14', fontSize: 16, fontWeight: '700' },
    setupSecondaryBtn: { backgroundColor: '#27272a', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
    setupSecondaryBtnText: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
    setupSkipBtn: { marginTop: 16, padding: 8 },
    setupSkipText: { color: '#71717a', fontSize: 14 },
    setupBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' },

    // Setup Form Fields
    setupFieldLabel: { color: '#a1a1aa', fontSize: 14, marginBottom: 8, marginTop: 16, alignSelf: 'flex-start' },
    setupInput: { backgroundColor: '#27272a', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 16, width: '100%', borderWidth: 1, borderColor: '#3f3f46' },

    // Setup Goal Options
    setupGoalOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, justifyContent: 'center' },
    setupGoalOption: { backgroundColor: '#27272a', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3f3f46' },
    setupGoalActive: { backgroundColor: '#7CFC00', borderColor: '#7CFC00' },
    setupGoalText: { color: '#94a3b8', fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
    setupGoalTextActive: { color: '#0a0e14' },

    // Setup Macros
    setupMacroRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
    setupMacroCard: { flex: 1, backgroundColor: '#27272a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46' },
    setupMacroLabel: { color: '#a1a1aa', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' },
    setupMacroInput: { color: '#ffffff', fontSize: 24, fontWeight: '700', textAlign: 'center', padding: 0, minWidth: 60 },
    setupMacroUnit: { color: '#71717a', fontSize: 12, marginTop: 4 },
    setupCalorieText: { color: '#71717a', fontSize: 13, textAlign: 'center', marginTop: 12 },

    // Setup Pills (Supplements)
    setupPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center' },
    setupPill: { backgroundColor: '#27272a', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3f3f46' },
    setupPillActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    setupPillText: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
    setupPillTextActive: { color: '#ffffff' },
    setupHint: { color: '#71717a', fontSize: 13, textAlign: 'center', marginTop: 16, fontStyle: 'italic', paddingHorizontal: 8 },

    // Setup AI Suggestion
    setupSuggestion: { backgroundColor: '#1e3a5f', borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: '#3b82f6', width: '100%' },
    setupSuggestionTitle: { color: '#60a5fa', fontSize: 14, fontWeight: '600', marginBottom: 8 },
    setupSuggestionText: { color: '#93c5fd', fontSize: 13, lineHeight: 18, marginBottom: 8 },
    setupSuggestionMacros: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    setupSuggestionBtn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'center' },
    setupSuggestionBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

    // Notes for AI Section
    notesSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#27272a' },
    notesSectionTitle: { color: '#a1a1aa', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    notesSectionHint: { color: '#71717a', fontSize: 12, marginBottom: 12 },
    notesPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    notePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', borderRadius: 16, paddingVertical: 6, paddingLeft: 12, paddingRight: 6 },
    notePillText: { color: '#ffffff', fontSize: 13, fontWeight: '500', marginRight: 6 },
    notePillRemove: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
    notePillRemoveText: { color: '#ffffff', fontSize: 10, fontWeight: '600' },
    addNoteRow: { flexDirection: 'row', gap: 8 },
    addNoteInput: { flex: 1, backgroundColor: '#27272a', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: '#3f3f46' },
    addNoteBtn: { backgroundColor: '#3b82f6', borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addNoteBtnDisabled: { backgroundColor: '#27272a' },
    addNoteBtnText: { color: '#ffffff', fontSize: 24, fontWeight: '300' },

    // AI Suggestion Pills
    suggestionSection: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#0a0e14' },
    suggestionLabel: { color: '#64748b', fontSize: 12, marginBottom: 8 },
    suggestionScroll: { flexDirection: 'row' },
    suggestionPill: { backgroundColor: '#151b24', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8, borderWidth: 1, borderColor: '#1e293b' },
    suggestionPillText: { color: '#94a3b8', fontSize: 13 },

    // Photo Delete Button
    photoDeleteBtn: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    photoDeleteBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },

    // Toast Notification
    toast: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#1e293b', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#a3e635', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    toastText: { color: '#a3e635', fontSize: 16, fontWeight: '600' },

    // Overview Box (Workout History) - Collapsible
    overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#151b24', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
    overviewToggle: { color: '#64748b', fontSize: 14 },
    overviewBox: { backgroundColor: '#151b24', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b', borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: -8 },
    overviewTitle: { color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

    // Exercise Summary (vertical list - replacing horizontal grid)
    exerciseSummarySection: { marginTop: 16 },
    exerciseSummaryTitle: { color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    exerciseSummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' },
    exerciseSummaryCardAlt: { backgroundColor: 'rgba(39, 39, 42, 0.3)' },
    exerciseSummaryLeft: { flex: 1, marginRight: 12 },
    exerciseSummaryName: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
    exerciseSummaryRight: { alignItems: 'flex-end' },
    exerciseSummaryData: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
    exerciseSummarySets: { color: '#71717a', fontSize: 11, marginTop: 2 },
    exerciseSummaryTrend: { fontSize: 14, marginTop: 2 },
    exerciseSummaryEmpty: { color: '#52525b', fontSize: 14 },

    // All Sessions Collapsible
    allSessionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#151b24', borderRadius: 12, padding: 14, marginBottom: 8 },
    allSessionsToggle: { color: '#64748b', fontSize: 14 },

    // Session Card Layout (expanded)
    sessionCardLeft: { flex: 1 },
    sessionCardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sessionExpandIcon: { color: '#64748b', fontSize: 12 },

    // Expanded Session Exercises
    sessionExercisesList: { padding: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#27272a' },
    sessionExerciseItem: { marginBottom: 12 },
    sessionExerciseName: { color: '#a1a1aa', fontSize: 13, fontWeight: '600', marginBottom: 6 },
    sessionSetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    sessionSetChip: { backgroundColor: '#27272a', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
    sessionSetText: { color: '#ffffff', fontSize: 12, fontWeight: '500' },

    // Export Button & Modal
    exportButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#151b24', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' },
    exportButtonText: { fontSize: 20 },
    exportModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    exportModalContent: { backgroundColor: '#151b24', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#1e293b' },
    exportModalTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
    exportModalSubtitle: { color: '#71717a', fontSize: 14, textAlign: 'center', marginBottom: 20 },
    exportOptionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1419', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
    exportOptionBtnDisabled: { opacity: 0.5 },
    exportOptionIcon: { fontSize: 28, marginRight: 14 },
    exportOptionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    exportOptionDesc: { color: '#71717a', fontSize: 12, marginTop: 2 },
    exportingText: { color: '#a3e635', fontSize: 14, textAlign: 'center', marginBottom: 12 },
    exportCancelBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
    exportCancelText: { color: '#71717a', fontSize: 16 },
});
