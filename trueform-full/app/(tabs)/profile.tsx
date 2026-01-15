import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, signOut, getHealthProfile, updateHealthProfile, savePainContext, getPainContext, updateProfile, HealthProfile } from '../../services/supabase';
import { router } from 'expo-router';
import HealthProfileWizard, { WizardData } from '../../components/HealthProfileWizard';
import { useAuth } from '../../contexts/AuthContext';

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

// Pain context options for edit modal
const BODY_PARTS = [
    { id: 'neck', label: '🦴 Neck' },
    { id: 'upper_back', label: '🔙 Upper Back' },
    { id: 'lower_back', label: '⬇️ Lower Back' },
    { id: 'left_shoulder', label: '💪 Left Shoulder' },
    { id: 'right_shoulder', label: '💪 Right Shoulder' },
    { id: 'left_hip', label: '🦵 Left Hip' },
    { id: 'right_hip', label: '🦵 Right Hip' },
    { id: 'left_knee', label: '🦿 Left Knee' },
    { id: 'right_knee', label: '🦿 Right Knee' },
    { id: 'none', label: '✅ No Pain' },
];

const PAIN_TRIGGERS = [
    { id: 'sitting', label: '🪑 Sitting' },
    { id: 'standing', label: '🧍 Standing' },
    { id: 'lifting', label: '🏋️ Lifting' },
    { id: 'sleeping', label: '😴 Sleeping' },
    { id: 'exercise', label: '🏃 Exercise' },
    { id: 'driving', label: '🚗 Driving' },
    { id: 'none', label: '✅ None' },
];

const GOALS = [
    { id: 'reduce_pain', label: '🎯 Reduce pain' },
    { id: 'improve_mobility', label: '🤸 Improve mobility' },
    { id: 'prevent_injury', label: '🛡️ Prevent injury' },
    { id: 'build_strength', label: '💪 Build strength' },
    { id: 'better_posture', label: '🧘 Better posture' },
];

export default function ProfileScreen() {
    // Use AuthContext for ALL data - no separate queries!
    const { user, healthProfile: authHealthProfile, painContext: authPainContext, loading: authLoading, refreshProfile } = useAuth();

    const [saving, setSaving] = useState(false);
    const [showHealthModal, setShowHealthModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const modalScrollRef = useRef<ScrollView>(null);

    // Local state for editing (initialized from AuthContext data)
    const [healthProfile, setHealthProfile] = useState<HealthProfile>({
        weight_lbs: undefined,
        height_inches: undefined,
        birth_year: undefined,
        activity_level: undefined,
        medical_conditions: [],
        health_notes: '',
    });
    const [heightFeet, setHeightFeet] = useState('');
    const [heightInches, setHeightInches] = useState('');

    // Pain context state for edit modal
    const [painAreas, setPainAreas] = useState<string[]>([]);
    const [painTriggers, setPainTriggers] = useState<string[]>([]);
    const [goals, setGoals] = useState<string[]>([]);

    // Sync local state with AuthContext data when it changes
    useEffect(() => {
        if (authHealthProfile) {
            setHealthProfile(authHealthProfile);
            if (authHealthProfile.height_inches) {
                setHeightFeet(Math.floor(authHealthProfile.height_inches / 12).toString());
                setHeightInches((authHealthProfile.height_inches % 12).toString());
            }
        }
    }, [authHealthProfile]);

    useEffect(() => {
        if (authPainContext) {
            setPainAreas(authPainContext.pain_areas || []);
            setPainTriggers(authPainContext.pain_triggers || []);
            setGoals(authPainContext.goals || []);
        }
    }, [authPainContext]);

    const handleSaveHealth = async () => {
        if (!user) return;
        setSaving(true);

        try {
            // Convert feet/inches to total inches
            const totalInches = (parseInt(heightFeet) || 0) * 12 + (parseInt(heightInches) || 0);

            const { error } = await updateHealthProfile(user.id, {
                ...healthProfile,
                height_inches: totalInches > 0 ? totalInches : undefined,
            });

            if (error) {
                console.error('[Profile] Error saving health profile:', error);
                Alert.alert('Error', 'Failed to save health profile');
                return;
            }

            // Also save pain context if any selections were made
            if (painAreas.length > 0 || painTriggers.length > 0 || goals.length > 0) {
                try {
                    await savePainContext(user.id, {
                        pain_areas: painAreas,
                        pain_duration: 'not_specified',
                        pain_triggers: painTriggers,
                        goals: goals,
                    });
                } catch (painError) {
                    console.error('[Profile] Error saving pain context:', painError);
                    // Don't block on pain context error
                }
            }

            setShowHealthModal(false);
            // Show custom success toast
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 2500);
        } catch (error) {
            console.error('[Profile] Exception in handleSaveHealth:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleWizardComplete = async (wizardData: WizardData) => {
        if (!user) return;
        setSaving(true);
        console.log('[Profile] handleWizardComplete called');

        try {
            // Save health profile data
            console.log('[Profile] Saving health profile...');
            const { error: healthError, data: healthData } = await updateHealthProfile(user.id, {
                weight_lbs: wizardData.weight_lbs,
                height_inches: wizardData.height_inches,
                birth_year: wizardData.birth_year,
                activity_level: wizardData.activity_level,
                medical_conditions: wizardData.medical_conditions,
                health_notes: wizardData.health_notes,
            });
            console.log('[Profile] Health profile save result:', healthError ? 'ERROR' : 'OK');

            if (healthError) {
                console.error('[Profile] Error saving health profile:', healthError);
                Alert.alert('Error', 'Failed to save health profile');
                return;
            }

            // Save pain context data if provided
            if (wizardData.pain_areas?.length || wizardData.pain_triggers?.length || wizardData.goals?.length) {
                console.log('[Profile] Saving pain context...');
                const { error: painError } = await savePainContext(user.id, {
                    pain_areas: wizardData.pain_areas || [],
                    pain_duration: 'not_specified', // Default value since wizard doesn't ask duration
                    pain_triggers: wizardData.pain_triggers || [],
                    goals: wizardData.goals || [],
                });
                console.log('[Profile] Pain context save result:', painError ? 'ERROR' : 'OK');

                if (painError) {
                    console.error('[Profile] Error saving pain context:', painError);
                    // Don't block on pain context error, profile is more important
                }
            }

            // Mark onboarding complete since user filled out their profile
            console.log('[Profile] Updating onboarding complete...');
            await updateProfile(user.id, { onboarding_complete: true });
            console.log('[Profile] Onboarding marked complete');

            // CRITICAL: Refresh AuthContext data so the app has the updated profile
            console.log('[Profile] Refreshing AuthContext profile...');
            await refreshProfile();
            console.log('[Profile] AuthContext refreshed');

            // Update local state as backup
            if (healthData) {
                setHealthProfile(healthData);
                if (healthData.height_inches) {
                    setHeightFeet(Math.floor(healthData.height_inches / 12).toString());
                    setHeightInches((healthData.height_inches % 12).toString());
                }
            }

            // Show custom success toast
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 2500);
            console.log('[Profile] Wizard complete flow finished');
        } catch (error) {
            console.error('[Profile] Exception in handleWizardComplete:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setSaving(false);
            setShowWizard(false);
        }
    };

    const toggleCondition = (condition: string) => {
        const current = healthProfile.medical_conditions || [];
        if (condition === 'None') {
            setHealthProfile({ ...healthProfile, medical_conditions: ['None'] });
        } else {
            const filtered = current.filter(c => c !== 'None');
            if (filtered.includes(condition)) {
                setHealthProfile({ ...healthProfile, medical_conditions: filtered.filter(c => c !== condition) });
            } else {
                setHealthProfile({ ...healthProfile, medical_conditions: [...filtered, condition] });
            }
        }
    };

    // Pain context toggle functions for edit modal
    const togglePainArea = (area: string) => {
        if (area === 'none') {
            setPainAreas(['none']);
        } else {
            const filtered = painAreas.filter(a => a !== 'none');
            if (filtered.includes(area)) {
                setPainAreas(filtered.filter(a => a !== area));
            } else {
                setPainAreas([...filtered, area]);
            }
        }
    };

    const togglePainTrigger = (trigger: string) => {
        if (trigger === 'none') {
            setPainTriggers(['none']);
        } else {
            const filtered = painTriggers.filter(t => t !== 'none');
            if (filtered.includes(trigger)) {
                setPainTriggers(filtered.filter(t => t !== trigger));
            } else {
                setPainTriggers([...filtered, trigger]);
            }
        }
    };

    const toggleGoal = (goal: string) => {
        if (goals.includes(goal)) {
            setGoals(goals.filter(g => g !== goal));
        } else {
            setGoals([...goals, goal]);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await signOut();
                        if (!error) {
                            router.replace('/login');
                        }
                    }
                }
            ]
        );
    };

    const isProfileComplete = healthProfile.health_profile_complete;
    const currentAge = healthProfile.birth_year
        ? new Date().getFullYear() - healthProfile.birth_year
        : null;

    if (authLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00BCD4" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Header */}
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.name}>
                        {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
                    </Text>
                    <Text style={styles.email}>{user?.email || 'Not logged in'}</Text>
                </View>

                {/* Health Profile Card */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>Health Profile</Text>

                    <TouchableOpacity
                        style={[styles.healthCard, !isProfileComplete && styles.healthCardIncomplete]}
                        onPress={() => isProfileComplete ? setShowHealthModal(true) : setShowWizard(true)}
                    >
                        {isProfileComplete ? (
                            <>
                                <View style={styles.healthRow}>
                                    <View style={styles.healthItem}>
                                        <Text style={styles.healthLabel}>Weight</Text>
                                        <Text style={styles.healthValue}>{healthProfile.weight_lbs} lbs</Text>
                                    </View>
                                    <View style={styles.healthItem}>
                                        <Text style={styles.healthLabel}>Height</Text>
                                        <Text style={styles.healthValue}>{heightFeet}'{heightInches}"</Text>
                                    </View>
                                    <View style={styles.healthItem}>
                                        <Text style={styles.healthLabel}>Age</Text>
                                        <Text style={styles.healthValue}>{currentAge} yrs</Text>
                                    </View>
                                </View>
                                <View style={styles.healthRow}>
                                    <View style={styles.healthItemFull}>
                                        <Text style={styles.healthLabel}>Activity</Text>
                                        <Text style={styles.healthValue}>
                                            {ACTIVITY_LEVELS.find(a => a.value === healthProfile.activity_level)?.label || '-'}
                                        </Text>
                                    </View>
                                </View>
                                {healthProfile.medical_conditions && healthProfile.medical_conditions.length > 0 && (
                                    <View style={styles.healthRow}>
                                        <View style={styles.healthItemFull}>
                                            <Text style={styles.healthLabel}>Conditions</Text>
                                            <Text style={styles.healthValue}>
                                                {healthProfile.medical_conditions.join(', ')}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {healthProfile.health_notes && healthProfile.health_notes.trim() && (
                                    <View style={styles.healthRow}>
                                        <View style={styles.healthItemFull}>
                                            <Text style={styles.healthLabel}>Notes</Text>
                                            <Text style={styles.healthNotes} numberOfLines={2}>
                                                {healthProfile.health_notes}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {painAreas.length > 0 && !painAreas.includes('none') && (
                                    <View style={styles.healthRow}>
                                        <View style={styles.healthItemFull}>
                                            <Text style={styles.healthLabel}>Pain Areas</Text>
                                            <Text style={styles.healthValue}>
                                                {painAreas.map(id => BODY_PARTS.find(p => p.id === id)?.label.replace(/^[^\s]+\s/, '') || id).join(', ')}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {painTriggers.length > 0 && !painTriggers.includes('none') && (
                                    <View style={styles.healthRow}>
                                        <View style={styles.healthItemFull}>
                                            <Text style={styles.healthLabel}>Pain Triggers</Text>
                                            <Text style={styles.healthValue}>
                                                {painTriggers.map(id => PAIN_TRIGGERS.find(t => t.id === id)?.label.replace(/^[^\s]+\s/, '') || id).join(', ')}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {goals.length > 0 && (
                                    <View style={styles.healthRow}>
                                        <View style={styles.healthItemFull}>
                                            <Text style={styles.healthLabel}>Goals</Text>
                                            <Text style={styles.healthValue}>
                                                {goals.map(id => GOALS.find(g => g.id === id)?.label.replace(/^[^\s]+\s/, '') || id).join(', ')}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                <Text style={styles.editHint}>Tap to edit →</Text>
                            </>
                        ) : (
                            <View style={styles.incompletePrompt}>
                                <Text style={styles.incompleteIcon}>📋</Text>
                                <Text style={styles.incompleteTitle}>Complete Your Health Profile</Text>
                                <Text style={styles.incompleteDesc}>
                                    Get personalized exercise recommendations based on your body and fitness level
                                </Text>
                                <View style={styles.completeBtn}>
                                    <Text style={styles.completeBtnText}>Fill Out Profile →</Text>
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Quick Access */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>Quick Access</Text>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/(tabs)/reports')}
                    >
                        <Text style={styles.menuIcon}>📊</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>View Reports</Text>
                            <Text style={styles.menuDesc}>See your movement analysis and rehab plans</Text>
                        </View>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/(tabs)/scan')}
                    >
                        <Text style={styles.menuIcon}>📸</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>New Scan</Text>
                            <Text style={styles.menuDesc}>Start a new diagnostic movement scan</Text>
                        </View>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>Account</Text>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleSignOut}
                    >
                        <Text style={styles.menuIcon}>🚪</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: '#F44336' }]}>Sign Out</Text>
                            <Text style={styles.menuDesc}>Log out of your account</Text>
                        </View>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appName}>TrueForm AI</Text>
                    <Text style={styles.appVersion}>Version 1.0.0</Text>
                </View>
            </ScrollView>

            <Modal
                visible={showHealthModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowHealthModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Health Profile</Text>
                                <TouchableOpacity onPress={() => setShowHealthModal(false)}>
                                    <Text style={styles.modalClose}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                ref={modalScrollRef}
                                style={styles.modalContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={true}
                            >
                                {/* Weight */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Weight (lbs)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={healthProfile.weight_lbs?.toString() || ''}
                                        onChangeText={t => setHealthProfile({ ...healthProfile, weight_lbs: parseInt(t) || undefined })}
                                        keyboardType="numeric"
                                        placeholder="e.g. 175"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />
                                </View>

                                {/* Height */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Height</Text>
                                    <View style={styles.heightRow}>
                                        <TextInput
                                            style={[styles.textInput, styles.heightInput]}
                                            value={heightFeet}
                                            onChangeText={setHeightFeet}
                                            keyboardType="numeric"
                                            placeholder="5"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                        />
                                        <Text style={styles.heightUnit}>ft</Text>
                                        <TextInput
                                            style={[styles.textInput, styles.heightInput]}
                                            value={heightInches}
                                            onChangeText={setHeightInches}
                                            keyboardType="numeric"
                                            placeholder="10"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                        />
                                        <Text style={styles.heightUnit}>in</Text>
                                    </View>
                                </View>

                                {/* Birth Year */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Birth Year</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={healthProfile.birth_year?.toString() || ''}
                                        onChangeText={t => setHealthProfile({ ...healthProfile, birth_year: parseInt(t) || undefined })}
                                        keyboardType="numeric"
                                        placeholder="e.g. 1985"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />
                                </View>

                                {/* Activity Level */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Activity Level</Text>
                                    <View style={styles.optionGrid}>
                                        {ACTIVITY_LEVELS.map(level => (
                                            <TouchableOpacity
                                                key={level.value}
                                                style={[
                                                    styles.optionBtn,
                                                    healthProfile.activity_level === level.value && styles.optionBtnActive
                                                ]}
                                                onPress={() => setHealthProfile({ ...healthProfile, activity_level: level.value })}
                                            >
                                                <Text style={styles.optionLabel}>{level.label}</Text>
                                                <Text style={styles.optionDesc}>{level.desc}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Medical Conditions */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Medical Conditions (select all that apply)</Text>
                                    <View style={styles.chipGrid}>
                                        {MEDICAL_CONDITIONS.map(condition => (
                                            <TouchableOpacity
                                                key={condition}
                                                style={[
                                                    styles.chip,
                                                    healthProfile.medical_conditions?.includes(condition) && styles.chipActive
                                                ]}
                                                onPress={() => toggleCondition(condition)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    healthProfile.medical_conditions?.includes(condition) && styles.chipTextActive
                                                ]}>
                                                    {condition}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Pain Areas */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Pain Areas (select all that apply)</Text>
                                    <View style={styles.chipGrid}>
                                        {BODY_PARTS.map(part => (
                                            <TouchableOpacity
                                                key={part.id}
                                                style={[
                                                    styles.chip,
                                                    painAreas.includes(part.id) && styles.chipActive
                                                ]}
                                                onPress={() => togglePainArea(part.id)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    painAreas.includes(part.id) && styles.chipTextActive
                                                ]}>
                                                    {part.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Pain Triggers */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Pain Triggers (select all that apply)</Text>
                                    <View style={styles.chipGrid}>
                                        {PAIN_TRIGGERS.map(trigger => (
                                            <TouchableOpacity
                                                key={trigger.id}
                                                style={[
                                                    styles.chip,
                                                    painTriggers.includes(trigger.id) && styles.chipActive
                                                ]}
                                                onPress={() => togglePainTrigger(trigger.id)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    painTriggers.includes(trigger.id) && styles.chipTextActive
                                                ]}>
                                                    {trigger.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Goals */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Your Goals (select all that apply)</Text>
                                    <View style={styles.chipGrid}>
                                        {GOALS.map(goal => (
                                            <TouchableOpacity
                                                key={goal.id}
                                                style={[
                                                    styles.chip,
                                                    goals.includes(goal.id) && styles.chipActive
                                                ]}
                                                onPress={() => toggleGoal(goal.id)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    goals.includes(goal.id) && styles.chipTextActive
                                                ]}>
                                                    {goal.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Additional Notes - at the bottom */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Additional Notes (optional)</Text>
                                    <Text style={styles.inputHint}>Include any relevant history, injuries, work conditions, or preferences</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        value={healthProfile.health_notes || ''}
                                        onChangeText={t => setHealthProfile({ ...healthProfile, health_notes: t })}
                                        placeholder="e.g. Had ACL surgery 2 years ago, work at desk 10+ hours daily..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        multiline={true}
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                        returnKeyType="done"
                                        blurOnSubmit={true}
                                        onFocus={() => {
                                            // Scroll to bottom to show notes field above keyboard
                                            setTimeout(() => {
                                                modalScrollRef.current?.scrollToEnd({ animated: true });
                                            }, 100);
                                        }}
                                    />
                                </View>

                                <View style={{ height: 20 }} />
                            </ScrollView>

                            {/* Save Button - always visible above keyboard */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={handleSaveHealth}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#0D0D1A" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>Save Health Profile</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </SafeAreaView>
            </Modal>

            {/* Health Profile Wizard (for setup and editing) */}
            <HealthProfileWizard
                visible={showWizard}
                onClose={() => setShowWizard(false)}
                onComplete={handleWizardComplete}
                saving={saving}
                initialData={isProfileComplete ? healthProfile : undefined}
            />

            {/* Success Toast */}
            {showSuccessToast && (
                <View style={styles.toastContainer}>
                    <View style={styles.toast}>
                        <Text style={styles.toastEmoji}>🎉</Text>
                        <View style={styles.toastContent}>
                            <Text style={styles.toastTitle}>Profile Complete!</Text>
                            <Text style={styles.toastMessage}>Your health profile has been saved</Text>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0D1A',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#00BCD4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#1A1A2E',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    menuSection: {
        marginBottom: 24,
    },
    menuSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    healthCard: {
        backgroundColor: 'rgba(0,188,212,0.1)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,188,212,0.3)',
    },
    healthCardIncomplete: {
        borderColor: 'rgba(255,193,7,0.5)',
        backgroundColor: 'rgba(255,193,7,0.1)',
    },
    healthRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    healthItem: {
        flex: 1,
    },
    healthItemFull: {
        flex: 1,
    },
    healthLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    healthValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    healthNotes: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        fontStyle: 'italic',
    },
    editHint: {
        fontSize: 12,
        color: '#00BCD4',
        textAlign: 'right',
        marginTop: 8,
    },
    incompletePrompt: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    incompleteIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    incompleteTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFC107',
        marginBottom: 4,
    },
    incompleteDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 12,
    },
    completeBtn: {
        backgroundColor: '#FFC107',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    completeBtnText: {
        color: '#0D0D1A',
        fontWeight: '600',
        fontSize: 14,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    menuIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    menuDesc: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    menuArrow: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.3)',
    },
    appInfo: {
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    appName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#00BCD4',
    },
    appVersion: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#0D0D1A',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    modalClose: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.5)',
        padding: 8,
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textArea: {
        minHeight: 100,
        paddingTop: 14,
    },
    inputHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 8,
    },
    heightRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heightInput: {
        flex: 1,
        marginRight: 8,
    },
    heightUnit: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginRight: 16,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionBtn: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionBtnActive: {
        backgroundColor: 'rgba(0,188,212,0.15)',
        borderColor: '#00BCD4',
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    optionDesc: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipActive: {
        backgroundColor: 'rgba(0,188,212,0.15)',
        borderColor: '#00BCD4',
    },
    chipText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
    },
    chipTextActive: {
        color: '#00BCD4',
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    saveBtn: {
        backgroundColor: '#00BCD4',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0D0D1A',
    },
    // Success Toast styles
    toastContainer: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 1000,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 188, 212, 0.95)',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        shadowColor: '#00BCD4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    toastEmoji: {
        fontSize: 28,
        marginRight: 12,
    },
    toastContent: {
        flex: 1,
    },
    toastTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0D0D1A',
        marginBottom: 2,
    },
    toastMessage: {
        fontSize: 13,
        color: 'rgba(13, 13, 26, 0.7)',
    },
});
