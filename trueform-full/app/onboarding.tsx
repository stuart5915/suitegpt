import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase, savePainContext, updateProfile } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Age ranges for selection
const AGE_RANGES = [
    { id: '18-25', label: '18-25', emoji: '🌱' },
    { id: '26-35', label: '26-35', emoji: '🌿' },
    { id: '36-45', label: '36-45', emoji: '🌳' },
    { id: '46-55', label: '46-55', emoji: '🍂' },
    { id: '56-65', label: '56-65', emoji: '🍁' },
    { id: '65+', label: '65+', emoji: '🌟' },
];

// Occupation types for personalization
const OCCUPATION_TYPES = [
    { id: 'sedentary', label: 'Desk/Office Work', emoji: '💻', description: 'Mostly sitting' },
    { id: 'active', label: 'Mixed Activity', emoji: '🚶', description: 'Some walking/standing' },
    { id: 'physical', label: 'Physical Labor', emoji: '🔧', description: 'Heavy lifting/manual work' },
];

// Body parts for pain selection
const BODY_PARTS = [
    { id: 'neck', label: 'Neck', emoji: '🦴' },
    { id: 'upper_back', label: 'Upper Back', emoji: '🔙' },
    { id: 'lower_back', label: 'Lower Back', emoji: '⬇️' },
    { id: 'left_shoulder', label: 'Left Shoulder', emoji: '💪' },
    { id: 'right_shoulder', label: 'Right Shoulder', emoji: '💪' },
    { id: 'left_hip', label: 'Left Hip', emoji: '🦵' },
    { id: 'right_hip', label: 'Right Hip', emoji: '🦵' },
    { id: 'left_knee', label: 'Left Knee', emoji: '🦿' },
    { id: 'right_knee', label: 'Right Knee', emoji: '🦿' },
    { id: 'other', label: 'Other', emoji: '📍' },
];

const DURATIONS = [
    { id: 'less_than_week', label: 'Less than a week' },
    { id: '1_4_weeks', label: '1-4 weeks' },
    { id: '1_3_months', label: '1-3 months' },
    { id: 'more_than_3_months', label: 'More than 3 months' },
];

const TRIGGERS = [
    { id: 'sitting', label: 'Sitting', emoji: '🪑' },
    { id: 'standing', label: 'Standing', emoji: '🧍' },
    { id: 'lifting', label: 'Lifting', emoji: '🏋️' },
    { id: 'sleeping', label: 'Sleeping', emoji: '😴' },
    { id: 'exercise', label: 'Exercise', emoji: '🏃' },
    { id: 'driving', label: 'Driving', emoji: '🚗' },
    { id: 'reaching', label: 'Reaching', emoji: '🙋' },
    { id: 'bending', label: 'Bending', emoji: '🙇' },
];

const GOALS = [
    { id: 'reduce_pain', label: 'Reduce pain', emoji: '🎯' },
    { id: 'improve_mobility', label: 'Improve mobility', emoji: '🤸' },
    { id: 'prevent_injury', label: 'Prevent injury', emoji: '🛡️' },
    { id: 'build_strength', label: 'Build strength', emoji: '💪' },
    { id: 'better_posture', label: 'Better posture', emoji: '🧘' },
];

export default function OnboardingScreen() {
    const { refreshProfile } = useAuth();
    const [step, setStep] = useState(0);

    // New demographic fields
    const [ageRange, setAgeRange] = useState<string>('');
    const [occupationType, setOccupationType] = useState<string>('');

    // Existing fields
    const [painAreas, setPainAreas] = useState<string[]>([]);
    const [duration, setDuration] = useState<string>('');
    const [triggers, setTriggers] = useState<string[]>([]);
    const [goals, setGoals] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleSelection = (
        item: string,
        selected: string[],
        setSelected: (items: string[]) => void
    ) => {
        if (selected.includes(item)) {
            setSelected(selected.filter((i) => i !== item));
        } else {
            setSelected([...selected, item]);
        }
    };

    // Convert age range to numeric age (midpoint) for storage
    const getNumericAge = (range: string): number | null => {
        switch (range) {
            case '18-25': return 22;
            case '26-35': return 31;
            case '36-45': return 41;
            case '46-55': return 51;
            case '56-65': return 61;
            case '65+': return 70;
            default: return null;
        }
    };

    const canContinue = () => {
        switch (step) {
            case 0: return true; // Welcome
            case 1: return ageRange !== ''; // Age
            case 2: return occupationType !== ''; // Occupation
            case 3: return painAreas.length > 0; // Pain areas
            case 4: return duration !== ''; // Duration
            case 5: return triggers.length > 0; // Triggers
            case 6: return goals.length > 0; // Goals
            default: return false;
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('[Onboarding] handleComplete - user:', user?.id);

            if (user) {
                // Save pain context
                const painResult = await savePainContext(user.id, {
                    pain_areas: painAreas,
                    pain_duration: duration,
                    pain_triggers: triggers,
                    goals: goals,
                });
                console.log('[Onboarding] Pain context saved:', !painResult?.error);

                // Update profile with demographic data and mark onboarding complete
                // NOTE: age and occupation_type columns don't exist in the profiles table yet
                // Only saving onboarding_complete for now
                console.log('[Onboarding] Saving profile with onboarding_complete: true');
                const profileResult = await updateProfile(user.id, {
                    onboarding_complete: true,
                });
                console.log('[Onboarding] Profile update result - data:', !!profileResult.data, 'error:', profileResult.error?.message || 'none');

                if (profileResult.error) {
                    console.error('[Onboarding] Failed to update profile:', profileResult.error);
                    return; // Don't navigate if update failed
                }

                // Refresh profile in AuthContext so AuthGate sees updated state
                console.log('[Onboarding] Refreshing profile in AuthContext...');
                await refreshProfile();
                console.log('[Onboarding] Profile refreshed, navigating to tabs...');
            }

            // Navigate to main app
            router.replace('/(tabs)');
        } catch (error) {
            console.error('[Onboarding] Error saving onboarding:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.emoji}>🩺</Text>
                        <Text style={styles.title}>Welcome to TrueForm AI</Text>
                        <Text style={styles.subtitle}>
                            Your personal AI physiotherapy companion. Let's learn about you to create a personalized plan.
                        </Text>
                    </View>
                );

            case 1:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>What's your age range?</Text>
                        <Text style={styles.subtitle}>This helps us personalize your exercises</Text>
                        <View style={styles.optionsGrid}>
                            {AGE_RANGES.map((range) => (
                                <TouchableOpacity
                                    key={range.id}
                                    style={[
                                        styles.option,
                                        ageRange === range.id && styles.optionSelected,
                                    ]}
                                    onPress={() => setAgeRange(range.id)}
                                >
                                    <Text style={styles.optionEmoji}>{range.emoji}</Text>
                                    <Text style={[
                                        styles.optionLabel,
                                        ageRange === range.id && styles.optionLabelSelected,
                                    ]}>
                                        {range.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>What type of work do you do?</Text>
                        <Text style={styles.subtitle}>This affects your exercise recommendations</Text>
                        <View style={styles.optionsList}>
                            {OCCUPATION_TYPES.map((occ) => (
                                <TouchableOpacity
                                    key={occ.id}
                                    style={[
                                        styles.occupationOption,
                                        occupationType === occ.id && styles.occupationOptionSelected,
                                    ]}
                                    onPress={() => setOccupationType(occ.id)}
                                >
                                    <Text style={styles.occupationEmoji}>{occ.emoji}</Text>
                                    <View style={styles.occupationText}>
                                        <Text style={[
                                            styles.occupationLabel,
                                            occupationType === occ.id && styles.occupationLabelSelected,
                                        ]}>
                                            {occ.label}
                                        </Text>
                                        <Text style={styles.occupationDesc}>{occ.description}</Text>
                                    </View>
                                    {occupationType === occ.id && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 3:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>Where do you feel pain?</Text>
                        <Text style={styles.subtitle}>Select all that apply</Text>
                        <View style={styles.optionsGrid}>
                            {BODY_PARTS.map((part) => (
                                <TouchableOpacity
                                    key={part.id}
                                    style={[
                                        styles.option,
                                        painAreas.includes(part.id) && styles.optionSelected,
                                    ]}
                                    onPress={() => toggleSelection(part.id, painAreas, setPainAreas)}
                                >
                                    <Text style={styles.optionEmoji}>{part.emoji}</Text>
                                    <Text style={[
                                        styles.optionLabel,
                                        painAreas.includes(part.id) && styles.optionLabelSelected,
                                    ]}>
                                        {part.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 4:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>How long have you had this pain?</Text>
                        <View style={styles.optionsList}>
                            {DURATIONS.map((d) => (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[
                                        styles.listOption,
                                        duration === d.id && styles.listOptionSelected,
                                    ]}
                                    onPress={() => setDuration(d.id)}
                                >
                                    <Text style={[
                                        styles.listOptionLabel,
                                        duration === d.id && styles.listOptionLabelSelected,
                                    ]}>
                                        {d.label}
                                    </Text>
                                    {duration === d.id && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 5:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>What triggers your pain?</Text>
                        <Text style={styles.subtitle}>Select all that apply</Text>
                        <View style={styles.optionsGrid}>
                            {TRIGGERS.map((t) => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        styles.option,
                                        triggers.includes(t.id) && styles.optionSelected,
                                    ]}
                                    onPress={() => toggleSelection(t.id, triggers, setTriggers)}
                                >
                                    <Text style={styles.optionEmoji}>{t.emoji}</Text>
                                    <Text style={[
                                        styles.optionLabel,
                                        triggers.includes(t.id) && styles.optionLabelSelected,
                                    ]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 6:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.title}>What are your goals?</Text>
                        <Text style={styles.subtitle}>Select all that apply</Text>
                        <View style={styles.optionsGrid}>
                            {GOALS.map((g) => (
                                <TouchableOpacity
                                    key={g.id}
                                    style={[
                                        styles.option,
                                        goals.includes(g.id) && styles.optionSelected,
                                    ]}
                                    onPress={() => toggleSelection(g.id, goals, setGoals)}
                                >
                                    <Text style={styles.optionEmoji}>{g.emoji}</Text>
                                    <Text style={[
                                        styles.optionLabel,
                                        goals.includes(g.id) && styles.optionLabelSelected,
                                    ]}>
                                        {g.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    const totalSteps = 7;

    return (
        <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((step + 1) / totalSteps) * 100}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{step + 1} of {totalSteps}</Text>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {renderStep()}
                </ScrollView>

                {/* Navigation Buttons */}
                <View style={styles.buttonContainer}>
                    {step > 0 && (
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setStep(step - 1)}
                        >
                            <Text style={styles.backButtonText}>Back</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            !canContinue() && styles.nextButtonDisabled,
                            step === 0 && styles.nextButtonFull,
                        ]}
                        onPress={() => {
                            if (step < totalSteps - 1) {
                                setStep(step + 1);
                            } else {
                                handleComplete();
                            }
                        }}
                        disabled={!canContinue() || loading}
                    >
                        <Text style={styles.nextButtonText}>
                            {loading ? 'Saving...' : step === totalSteps - 1 ? 'Get Started' : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 12,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#00BCD4',
        borderRadius: 2,
    },
    progressText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 20,
    },
    stepContent: {
        alignItems: 'center',
    },
    emoji: { fontSize: 80, marginBottom: 24 },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
    },
    option: {
        width: (width - 64) / 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionSelected: {
        backgroundColor: 'rgba(0,188,212,0.2)',
        borderColor: '#00BCD4',
    },
    optionEmoji: { fontSize: 32, marginBottom: 8 },
    optionLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    optionLabelSelected: { color: '#fff', fontWeight: '600' },
    optionsList: {
        width: '100%',
        gap: 12,
    },
    listOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    listOptionSelected: {
        backgroundColor: 'rgba(0,188,212,0.2)',
        borderColor: '#00BCD4',
    },
    listOptionLabel: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    listOptionLabelSelected: { color: '#fff', fontWeight: '600' },
    checkmark: { fontSize: 18, color: '#00BCD4' },
    // Occupation type styles
    occupationOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    occupationOptionSelected: {
        backgroundColor: 'rgba(0,188,212,0.2)',
        borderColor: '#00BCD4',
    },
    occupationEmoji: {
        fontSize: 36,
        marginRight: 16,
    },
    occupationText: {
        flex: 1,
    },
    occupationLabel: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    occupationLabelSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    occupationDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    buttonContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 12,
    },
    backButton: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    nextButton: {
        flex: 2,
        backgroundColor: '#00BCD4',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    nextButtonFull: { flex: 1 },
    nextButtonDisabled: { opacity: 0.5 },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
