import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Modal,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: '🪑 Sedentary', desc: 'Little to no exercise' },
    { value: 'light', label: '🚶 Light', desc: '1-2 days/week' },
    { value: 'moderate', label: '🏃 Moderate', desc: '3-5 days/week' },
    { value: 'active', label: '🏋️ Active', desc: '6-7 days/week' },
] as const;

const MEDICAL_CONDITIONS = [
    'Diabetes',
    'Heart Condition',
    'Arthritis',
    'High Blood Pressure',
    'Osteoporosis',
    'Recent Surgery',
    'Chronic Pain',
    'None',
];

// Pain context options
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
    { id: 'none', label: 'No Pain', emoji: '✅' },
];

const PAIN_TRIGGERS = [
    { id: 'sitting', label: 'Sitting', emoji: '🪑' },
    { id: 'standing', label: 'Standing', emoji: '🧍' },
    { id: 'lifting', label: 'Lifting', emoji: '🏋️' },
    { id: 'sleeping', label: 'Sleeping', emoji: '😴' },
    { id: 'exercise', label: 'Exercise', emoji: '🏃' },
    { id: 'driving', label: 'Driving', emoji: '🚗' },
    { id: 'none', label: 'None', emoji: '✅' },
];

const GOALS = [
    { id: 'reduce_pain', label: 'Reduce pain', emoji: '🎯' },
    { id: 'improve_mobility', label: 'Improve mobility', emoji: '🤸' },
    { id: 'prevent_injury', label: 'Prevent injury', emoji: '🛡️' },
    { id: 'build_strength', label: 'Build strength', emoji: '💪' },
    { id: 'better_posture', label: 'Better posture', emoji: '🧘' },
];

interface HealthProfileWizardProps {
    visible: boolean;
    onClose: () => void;
    onComplete: (data: WizardData) => void;
    saving?: boolean;
    initialData?: WizardData;  // Pre-populate when editing existing profile
}

export interface WizardData {
    weight_lbs?: number;
    height_inches?: number;
    birth_year?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
    medical_conditions?: string[];
    health_notes?: string;
    // Pain context fields
    pain_areas?: string[];
    pain_triggers?: string[];
    goals?: string[];
}

const TOTAL_STEPS = 9;  // Increased from 6 to include pain context

export default function HealthProfileWizard({ visible, onClose, onComplete, saving, initialData }: HealthProfileWizardProps) {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<WizardData>({
        medical_conditions: [],
        pain_areas: [],
        pain_triggers: [],
        goals: [],
    });

    // Individual field states for easy input handling
    const [weight, setWeight] = useState('');
    const [heightFeet, setHeightFeet] = useState('');
    const [heightInches, setHeightInches] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [healthNotes, setHealthNotes] = useState('');

    // Refs for auto-focus
    const weightRef = useRef<TextInput>(null);
    const heightFeetRef = useRef<TextInput>(null);
    const heightInchesRef = useRef<TextInput>(null);
    const birthYearRef = useRef<TextInput>(null);
    const notesRef = useRef<TextInput>(null);

    // Animation for step transitions
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Auto-focus when step changes - immediate focus
    useEffect(() => {
        const timeout = setTimeout(() => {
            switch (step) {
                case 1:
                    weightRef.current?.focus();
                    break;
                case 2:
                    heightFeetRef.current?.focus();
                    break;
                case 3:
                    birthYearRef.current?.focus();
                    break;
                // Don't auto-focus notes - let user tap to focus
            }
        }, 100); // Faster focus
        return () => clearTimeout(timeout);
    }, [step]);

    // Reset state when modal opens - use initialData if provided (editing mode)
    useEffect(() => {
        if (visible) {
            setStep(1);
            if (initialData) {
                // Editing mode - pre-populate with existing data
                setData({
                    activity_level: initialData.activity_level,
                    medical_conditions: initialData.medical_conditions || [],
                    pain_areas: initialData.pain_areas || [],
                    pain_triggers: initialData.pain_triggers || [],
                    goals: initialData.goals || [],
                });
                setWeight(initialData.weight_lbs?.toString() || '');
                if (initialData.height_inches) {
                    setHeightFeet(Math.floor(initialData.height_inches / 12).toString());
                    setHeightInches((initialData.height_inches % 12).toString());
                } else {
                    setHeightFeet('');
                    setHeightInches('');
                }
                setBirthYear(initialData.birth_year?.toString() || '');
                setHealthNotes(initialData.health_notes || '');
            } else {
                // New profile mode - start empty
                setData({
                    medical_conditions: [],
                    pain_areas: [],
                    pain_triggers: [],
                    goals: [],
                });
                setWeight('');
                setHeightFeet('');
                setHeightInches('');
                setBirthYear('');
                setHealthNotes('');
            }
        }
    }, [visible, initialData]);

    const animateToStep = (newStep: number) => {
        const direction = newStep > step ? 1 : -1;
        Animated.sequence([
            Animated.timing(slideAnim, {
                toValue: direction * -50,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
        setStep(newStep);
    };

    const goNext = () => {
        if (step < TOTAL_STEPS) {
            animateToStep(step + 1);
        } else {
            handleComplete();
        }
    };

    const goBack = () => {
        if (step > 1) {
            animateToStep(step - 1);
        }
    };

    const handleComplete = () => {
        const totalInches = (parseInt(heightFeet) || 0) * 12 + (parseInt(heightInches) || 0);
        const finalData: WizardData = {
            weight_lbs: parseInt(weight) || undefined,
            height_inches: totalInches > 0 ? totalInches : undefined,
            birth_year: parseInt(birthYear) || undefined,
            activity_level: data.activity_level,
            medical_conditions: data.medical_conditions,
            health_notes: healthNotes.trim() || undefined,
            // Pain context fields
            pain_areas: data.pain_areas,
            pain_triggers: data.pain_triggers,
            goals: data.goals,
        };
        onComplete(finalData);
    };

    const toggleCondition = (condition: string) => {
        const current = data.medical_conditions || [];
        if (condition === 'None') {
            setData({ ...data, medical_conditions: ['None'] });
        } else {
            const filtered = current.filter(c => c !== 'None');
            if (filtered.includes(condition)) {
                setData({ ...data, medical_conditions: filtered.filter(c => c !== condition) });
            } else {
                setData({ ...data, medical_conditions: [...filtered, condition] });
            }
        }
    };

    // Pain context toggle functions
    const togglePainArea = (area: string) => {
        const current = data.pain_areas || [];
        if (area === 'none') {
            setData({ ...data, pain_areas: ['none'] });
        } else {
            const filtered = current.filter(a => a !== 'none');
            if (filtered.includes(area)) {
                setData({ ...data, pain_areas: filtered.filter(a => a !== area) });
            } else {
                setData({ ...data, pain_areas: [...filtered, area] });
            }
        }
    };

    const togglePainTrigger = (trigger: string) => {
        const current = data.pain_triggers || [];
        if (trigger === 'none') {
            setData({ ...data, pain_triggers: ['none'] });
        } else {
            const filtered = current.filter(t => t !== 'none');
            if (filtered.includes(trigger)) {
                setData({ ...data, pain_triggers: filtered.filter(t => t !== trigger) });
            } else {
                setData({ ...data, pain_triggers: [...filtered, trigger] });
            }
        }
    };

    const toggleGoal = (goal: string) => {
        const current = data.goals || [];
        if (current.includes(goal)) {
            setData({ ...data, goals: current.filter(g => g !== goal) });
        } else {
            setData({ ...data, goals: [...current, goal] });
        }
    };

    const selectActivity = (level: typeof ACTIVITY_LEVELS[number]['value']) => {
        setData({ ...data, activity_level: level });
        // Auto-advance after selection
        setTimeout(() => animateToStep(5), 300);
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>⚖️</Text>
                        <Text style={styles.stepTitle}>What's your weight?</Text>
                        <Text style={styles.stepSubtitle}>This helps personalize your exercise plan</Text>
                        <View style={styles.inputRow}>
                            <TextInput
                                ref={weightRef}
                                style={styles.bigInput}
                                value={weight}
                                onChangeText={setWeight}
                                keyboardType="numeric"
                                placeholder="175"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                onSubmitEditing={goNext}
                                returnKeyType="next"
                                maxLength={3}
                            />
                            <Text style={styles.inputUnit}>lbs</Text>
                        </View>
                        <Text style={styles.enterHint}>Press Enter to continue →</Text>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>📏</Text>
                        <Text style={styles.stepTitle}>What's your height?</Text>
                        <View style={styles.heightInputRow}>
                            <TextInput
                                ref={heightFeetRef}
                                style={styles.heightInput}
                                value={heightFeet}
                                onChangeText={(text) => {
                                    setHeightFeet(text);
                                    // Auto-jump to inches after typing 1 digit
                                    if (text.length === 1) {
                                        setTimeout(() => heightInchesRef.current?.focus(), 50);
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="5"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                returnKeyType="next"
                                maxLength={1}
                            />
                            <Text style={styles.heightUnit}>ft</Text>
                            <TextInput
                                ref={heightInchesRef}
                                style={styles.heightInput}
                                value={heightInches}
                                onChangeText={setHeightInches}
                                keyboardType="numeric"
                                placeholder="10"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                onSubmitEditing={goNext}
                                returnKeyType="next"
                                maxLength={2}
                            />
                            <Text style={styles.heightUnit}>in</Text>
                        </View>
                        <Text style={styles.enterHint}>Press Enter to continue →</Text>
                    </View>
                );

            case 3:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>🎂</Text>
                        <Text style={styles.stepTitle}>What year were you born?</Text>
                        <Text style={styles.stepSubtitle}>Age helps determine safe exercise intensity</Text>
                        <TextInput
                            ref={birthYearRef}
                            style={styles.bigInput}
                            value={birthYear}
                            onChangeText={setBirthYear}
                            keyboardType="numeric"
                            placeholder="1990"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            onSubmitEditing={goNext}
                            returnKeyType="next"
                            maxLength={4}
                        />
                        <Text style={styles.enterHint}>Press Enter to continue →</Text>
                    </View>
                );

            case 4:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>🏃</Text>
                        <Text style={styles.stepTitle}>How active are you?</Text>
                        <Text style={styles.stepSubtitle}>Tap your current activity level</Text>
                        <View style={styles.activityGrid}>
                            {ACTIVITY_LEVELS.map(level => (
                                <TouchableOpacity
                                    key={level.value}
                                    style={[
                                        styles.activityCard,
                                        data.activity_level === level.value && styles.activityCardActive
                                    ]}
                                    onPress={() => selectActivity(level.value)}
                                >
                                    <Text style={styles.activityLabel}>{level.label}</Text>
                                    <Text style={styles.activityDesc}>{level.desc}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 5:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>🩺</Text>
                        <Text style={styles.stepTitle}>Any medical conditions?</Text>
                        <Text style={styles.stepSubtitle}>Select all that apply (optional)</Text>
                        <View style={styles.chipGrid}>
                            {MEDICAL_CONDITIONS.map(condition => (
                                <TouchableOpacity
                                    key={condition}
                                    style={[
                                        styles.chip,
                                        data.medical_conditions?.includes(condition) && styles.chipActive
                                    ]}
                                    onPress={() => toggleCondition(condition)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        data.medical_conditions?.includes(condition) && styles.chipTextActive
                                    ]}>
                                        {condition}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.continueBtn} onPress={goNext}>
                            <Text style={styles.continueBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 6:
                return (
                    <View style={styles.stepContainerCompact}>
                        <Text style={styles.stepEmojiSmall}>📝</Text>
                        <Text style={styles.stepTitleSmall}>Anything else we should know?</Text>
                        <Text style={styles.stepSubtitleSmall}>Previous injuries, work conditions (optional)</Text>
                        <TextInput
                            ref={notesRef}
                            style={styles.notesInputCompact}
                            value={healthNotes}
                            onChangeText={setHealthNotes}
                            placeholder="e.g. ACL surgery 2 years ago, desk job..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            multiline
                            textAlignVertical="top"
                            maxLength={500}
                            blurOnSubmit={true}
                        />
                        <TouchableOpacity style={styles.continueBtn} onPress={goNext}>
                            <Text style={styles.continueBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 7:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>🎯</Text>
                        <Text style={styles.stepTitle}>Where do you feel pain?</Text>
                        <Text style={styles.stepSubtitle}>Select all that apply</Text>
                        <View style={styles.chipGrid}>
                            {BODY_PARTS.map(part => (
                                <TouchableOpacity
                                    key={part.id}
                                    style={[
                                        styles.chip,
                                        data.pain_areas?.includes(part.id) && styles.chipActive
                                    ]}
                                    onPress={() => togglePainArea(part.id)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        data.pain_areas?.includes(part.id) && styles.chipTextActive
                                    ]}>
                                        {part.emoji} {part.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.continueBtn} onPress={goNext}>
                            <Text style={styles.continueBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 8:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>⚡</Text>
                        <Text style={styles.stepTitle}>What triggers your pain?</Text>
                        <Text style={styles.stepSubtitle}>Select all that apply</Text>
                        <View style={styles.chipGrid}>
                            {PAIN_TRIGGERS.map(trigger => (
                                <TouchableOpacity
                                    key={trigger.id}
                                    style={[
                                        styles.chip,
                                        data.pain_triggers?.includes(trigger.id) && styles.chipActive
                                    ]}
                                    onPress={() => togglePainTrigger(trigger.id)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        data.pain_triggers?.includes(trigger.id) && styles.chipTextActive
                                    ]}>
                                        {trigger.emoji} {trigger.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.continueBtn} onPress={goNext}>
                            <Text style={styles.continueBtnText}>Continue →</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 9:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepEmoji}>🏆</Text>
                        <Text style={styles.stepTitle}>What are your goals?</Text>
                        <Text style={styles.stepSubtitle}>Select all that apply</Text>
                        <View style={styles.chipGrid}>
                            {GOALS.map(goal => (
                                <TouchableOpacity
                                    key={goal.id}
                                    style={[
                                        styles.chip,
                                        data.goals?.includes(goal.id) && styles.chipActive
                                    ]}
                                    onPress={() => toggleGoal(goal.id)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        data.goals?.includes(goal.id) && styles.chipTextActive
                                    ]}>
                                        {goal.emoji} {goal.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={[styles.finishBtnCompact, saving && styles.finishBtnDisabled]}
                            onPress={handleComplete}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#0D0D1A" />
                            ) : (
                                <Text style={styles.finishBtnText}>Complete Profile ✓</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                {/* Header - outside TouchableWithoutFeedback so buttons work */}
                <View style={styles.header}>
                    {step > 1 ? (
                        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>← Back</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>← Close</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.progress}>Step {step} of {TOTAL_STEPS}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
                </View>

                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        {/* Step Content */}
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Animated.View
                                style={[
                                    styles.content,
                                    { transform: [{ translateX: slideAnim }] }
                                ]}
                            >
                                {renderStepContent()}
                            </Animated.View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0D1A',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 16,
    },
    backBtn: {
        width: 70,
    },
    backBtnText: {
        color: '#00BCD4',
        fontSize: 16,
    },
    progress: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    closeBtn: {
        width: 70,
        alignItems: 'flex-end',
    },
    closeBtnText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 20,
        padding: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 20,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#00BCD4',
        borderRadius: 2,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    scrollContent: {
        flexGrow: 1,
    },
    stepContainer: {
        alignItems: 'center',
    },
    stepEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginBottom: 32,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bigInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingVertical: 20,
        fontSize: 32,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        minWidth: 140,
        borderWidth: 2,
        borderColor: 'rgba(0,188,212,0.3)',
    },
    inputUnit: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    enterHint: {
        marginTop: 24,
        fontSize: 13,
        color: 'rgba(0,188,212,0.7)',
    },
    heightInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    heightInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 20,
        fontSize: 32,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        width: 80,
        borderWidth: 2,
        borderColor: 'rgba(0,188,212,0.3)',
    },
    heightUnit: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
        marginRight: 8,
    },
    activityGrid: {
        width: '100%',
        gap: 12,
    },
    activityCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activityCardActive: {
        backgroundColor: 'rgba(0,188,212,0.15)',
        borderColor: '#00BCD4',
    },
    activityLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    activityDesc: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 24,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    chipActive: {
        backgroundColor: 'rgba(0,188,212,0.15)',
        borderColor: '#00BCD4',
    },
    chipText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    chipTextActive: {
        color: '#00BCD4',
        fontWeight: '600',
    },
    continueBtn: {
        backgroundColor: 'rgba(0,188,212,0.2)',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#00BCD4',
    },
    continueBtnText: {
        color: '#00BCD4',
        fontSize: 16,
        fontWeight: '600',
    },
    notesInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 16,
        color: '#fff',
        width: '100%',
        minHeight: 120,
        borderWidth: 2,
        borderColor: 'rgba(0,188,212,0.3)',
        marginBottom: 24,
    },
    notesInputCompact: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#fff',
        width: '100%',
        minHeight: 80,
        maxHeight: 100,
        borderWidth: 2,
        borderColor: 'rgba(0,188,212,0.3)',
        marginBottom: 16,
    },
    finishBtn: {
        backgroundColor: '#00BCD4',
        paddingHorizontal: 40,
        paddingVertical: 18,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
    },
    finishBtnCompact: {
        backgroundColor: '#00BCD4',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    finishBtnDisabled: {
        opacity: 0.7,
    },
    finishBtnText: {
        color: '#0D0D1A',
        fontSize: 18,
        fontWeight: '700',
    },
    stepContainerCompact: {
        alignItems: 'center',
        paddingTop: 10,
    },
    stepEmojiSmall: {
        fontSize: 36,
        marginBottom: 8,
    },
    stepTitleSmall: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
    },
    stepSubtitleSmall: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginBottom: 16,
    },
});
