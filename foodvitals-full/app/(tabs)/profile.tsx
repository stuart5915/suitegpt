import React, { useEffect, useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Switch,
    Animated,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTelegramAuth } from '../../contexts/TelegramAuthContext';
import { TelegramLoginButton } from '../../components/TelegramLoginButton';
import {
    supabase,
    getNutritionGoals,
    saveNutritionGoals,
    signOut,
    getFavoriteMeals,
    deleteFavoriteMeal,
    addFavoriteToToday,
    NutritionGoals,
    FavoriteMeal,
    getSavedTips,
    deleteSavedTip,
    SavedTip,
} from '../../services/supabase';
import { calculateRecommendedMicros, calculateRecommendedMacros, MICRO_LABELS, Gender, ActivityLevel } from '../../utils/nutrition';

// Telegram Bot for login widget
const TELEGRAM_BOT_NAME = 'SUITEHubBot';

export default function ProfileScreen() {
    const { user: telegramUser, isLoading: authLoading, credits, login, logout, refreshCredits } = useTelegramAuth();
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [aiNotificationsEnabled, setAiNotificationsEnabled] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [hasGoalsSet, setHasGoalsSet] = useState(false);
    const [showSaveToast, setShowSaveToast] = useState(false);

    // Goals
    const [goals, setGoals] = useState<Partial<NutritionGoals>>({
        age: 30,
        gender: 'male',
        weight_kg: 70,
        weight_unit: 'kg',
        goal_type: 'maintain',
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 70,
        target_fiber_g: 30,
        target_vitamin_c_mg: 90,
        target_vitamin_d_mcg: 15,
        target_calcium_mg: 1000,
        target_iron_mg: 8,
        target_potassium_mg: 3400,
        target_sodium_mg: 2300,
        diet_type: 'standard',
        activity_level: 'moderate',
    });
    const [showMicros, setShowMicros] = useState(false);

    // Favorites
    const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
    const [loadingFavorites, setLoadingFavorites] = useState(false);
    const [addingFavoriteId, setAddingFavoriteId] = useState<string | null>(null);
    const [expandedFavorite, setExpandedFavorite] = useState<string | null>(null);
    const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
    const [addedToday, setAddedToday] = useState<Set<string>>(new Set());

    // Saved Tips
    const [savedTips, setSavedTips] = useState<SavedTip[]>([]);
    const [isTipsExpanded, setIsTipsExpanded] = useState(false);
    const [deletingTipId, setDeletingTipId] = useState<string | null>(null);

    // Custom Prompts
    const DEFAULT_PROMPTS = [
        "How's my week going?",
        "What should I eat next?",
        "Am I missing any nutrients?",
        "Give me a meal idea",
    ];
    const [customPrompts, setCustomPrompts] = useState<string[]>(DEFAULT_PROMPTS);
    const [isPromptsExpanded, setIsPromptsExpanded] = useState(false);
    const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);

    // Daily Goals Section
    const [isDailyGoalsExpanded, setIsDailyGoalsExpanded] = useState(true);
    const [showNotificationInfo, setShowNotificationInfo] = useState(false);

    // Detect if mobile browser
    const isMobile = () => {
        if (typeof navigator === 'undefined') return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    // Telegram login callback for web users
    const handleTelegramAuth = (telegramUserData: { id: number | string; username?: string; first_name: string; photo_url?: string }) => {
        login(telegramUserData);
    };

    useEffect(() => {
        loadProfile();
    }, [telegramUser]);

    // Refresh favorites and tips when tab gains focus
    useFocusEffect(
        useCallback(() => {
            if (userId) {
                loadFavorites(userId);
                loadTips(userId);
                refreshCredits();
            }
        }, [userId])
    );

    const loadProfile = async () => {
        // Use Telegram user for identity
        if (telegramUser) {
            setUserId(telegramUser.id);
            setUserEmail(telegramUser.username || '');

            const { data: goalsData } = await getNutritionGoals(telegramUser.id);
            if (goalsData) {
                setGoals(goalsData);
                setHasGoalsSet(true);
            }

            // Load favorites
            await loadFavorites(telegramUser.id);

            // Load saved tips
            await loadTips(telegramUser.id);

            // Load custom prompts
            await loadCustomPrompts();

            // Load notification preference
            await loadNotificationPreference();
        }
        setIsLoading(false);
    };

    const loadFavorites = async (uid: string) => {
        console.log('Loading favorites for user:', uid);
        setLoadingFavorites(true);
        const { data, error } = await getFavoriteMeals(uid);
        console.log('Favorites loaded:', { data, error, count: data?.length });
        if (data) setFavorites(data);
        setLoadingFavorites(false);
    };

    const loadTips = async (uid: string) => {
        const { data } = await getSavedTips(uid);
        if (data) setSavedTips(data);
    };

    const loadCustomPrompts = async () => {
        try {
            const saved = await AsyncStorage.getItem('custom_prompts');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCustomPrompts(parsed);
                }
            }
        } catch (e) {
            console.log('Failed to load custom prompts');
        }
    };

    const saveCustomPrompts = async (prompts: string[]) => {
        try {
            await AsyncStorage.setItem('custom_prompts', JSON.stringify(prompts));
        } catch (e) {
            console.log('Failed to save custom prompts');
        }
    };

    const updatePrompt = (index: number, value: string) => {
        const updated = [...customPrompts];
        updated[index] = value;
        setCustomPrompts(updated);
        saveCustomPrompts(updated);
    };

    // Load notification preference from AsyncStorage
    const loadNotificationPreference = async () => {
        try {
            const saved = await AsyncStorage.getItem('ai_notifications_enabled');
            if (saved !== null) {
                setAiNotificationsEnabled(saved === 'true');
            }
        } catch (e) {
            console.log('Failed to load notification preference');
        }
    };

    // Handle notification toggle with persistence
    const handleNotificationToggle = async (enabled: boolean) => {
        setAiNotificationsEnabled(enabled);
        try {
            await AsyncStorage.setItem('ai_notifications_enabled', String(enabled));
        } catch (e) {
            console.log('Failed to save notification preference');
        }
    };

    const handleDeleteTip = async (tipId: string) => {
        setDeletingTipId(tipId);
        const { error } = await deleteSavedTip(tipId);
        if (!error) {
            setSavedTips(prev => prev.filter(t => t.id !== tipId));
        }
        setDeletingTipId(null);
    };

    const handleDeleteFavorite = async (mealId: string, mealName: string) => {
        Alert.alert(
            'Remove Favorite',
            `Remove "${mealName}" from favorites?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await deleteFavoriteMeal(mealId);
                        if (!error) {
                            setFavorites(prev => prev.filter(f => f.id !== mealId));
                        }
                    }
                },
            ]
        );
    };

    const handleQuickAdd = async (favorite: FavoriteMeal) => {
        if (!userId || !favorite.id) return;
        setAddingFavoriteId(favorite.id);
        const { error } = await addFavoriteToToday(userId, favorite);
        setAddingFavoriteId(null);
        if (!error) {
            setAddedToday(prev => new Set(prev).add(favorite.id!));
        }
    };

    const handleSaveGoals = async () => {
        if (!userId) return;

        setIsSaving(true);
        try {
            const { error } = await saveNutritionGoals(userId, goals);
            if (error) throw error;
            setHasGoalsSet(true);
            setIsEditing(false);
            // Show in-app toast instead of system alert
            setShowSaveToast(true);
            setTimeout(() => setShowSaveToast(false), 2500);
        } catch (error) {
            Alert.alert('Error', 'Could not save goals. Please try again.');
        } finally {
            setIsSaving(false);
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
                        logout(); // Telegram logout
                        router.replace('/login');
                    }
                },
            ]
        );
    };

    const updateGoal = (key: keyof NutritionGoals, value: string) => {
        const numValue = parseInt(value) || 0;
        setGoals(prev => ({ ...prev, [key]: numValue }));
    };

    if (isLoading || authLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4ADE80" />
                </View>
            </SafeAreaView>
        );
    }

    // Guest mode - show sign in prompt
    if (!telegramUser) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Profile</Text>
                    </View>

                    {/* Guest Card */}
                    <View style={styles.guestCard}>
                        <Text style={styles.guestIcon}>👤</Text>
                        <Text style={styles.guestTitle}>Guest Mode</Text>
                        <Text style={styles.guestText}>
                            Login with Telegram to save your food logs, track nutrition over time, and use SUITE credits for AI features.
                        </Text>

                        <TelegramLoginButton
                            botName={TELEGRAM_BOT_NAME}
                            onAuth={handleTelegramAuth}
                            buttonSize="large"
                            cornerRadius={10}
                        />
                    </View>

                    {/* Benefits */}
                    <View style={styles.benefitsCard}>
                        <Text style={styles.benefitsTitle}>Why login with Telegram?</Text>
                        <View style={styles.benefit}>
                            <Ionicons name="cloud-outline" size={20} color="#4ADE80" />
                            <Text style={styles.benefitText}>Save meals to the cloud</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Ionicons name="analytics-outline" size={20} color="#4ADE80" />
                            <Text style={styles.benefitText}>Track progress over time</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Ionicons name="wallet-outline" size={20} color="#ff9500" />
                            <Text style={styles.benefitText}>Use SUITE credits for AI features</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Ionicons name="bulb-outline" size={20} color="#4ADE80" />
                            <Text style={styles.benefitText}>Get personalized AI insights</Text>
                        </View>
                    </View>

                    {/* App Info */}
                    <View style={styles.appInfo}>
                        <Text style={styles.appName}>🥗 FoodVitals AI</Text>
                        <Text style={styles.appVersion}>Version 1.0.0</Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Compact Header with Telegram Profile, Credits and Sign Out */}
                <View style={styles.compactHeader}>
                    <View style={styles.profileRow}>
                        {telegramUser?.photoUrl ? (
                            <Image
                                source={{ uri: telegramUser.photoUrl }}
                                style={styles.telegramAvatarSmall}
                            />
                        ) : (
                            <View style={styles.avatarSmall}>
                                <Text style={styles.avatarTextSmall}>
                                    {telegramUser?.firstName?.charAt(0).toUpperCase() || telegramUser?.username?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userInfoColumn}>
                            <Text style={styles.userNameSmall} numberOfLines={1}>
                                {telegramUser?.username ? `@${telegramUser.username}` : telegramUser?.firstName || 'User'}
                            </Text>
                            <View style={styles.creditsRow}>
                                <Text style={styles.creditsLabel}>{credits.toFixed(0)} credits</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.signOutButtonCompact} onPress={handleSignOut}>
                        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                {/* AI Notifications - Compact Row */}
                <View style={styles.notificationRowCompact}>
                    <View style={styles.notificationLeft}>
                        <Ionicons name="notifications-outline" size={16} color="#4ADE80" />
                        <Text style={styles.notificationLabelCompact}>AI Notifications</Text>
                        <TouchableOpacity onPress={() => setShowNotificationInfo(!showNotificationInfo)}>
                            <Ionicons
                                name={showNotificationInfo ? "eye-off-outline" : "eye-outline"}
                                size={16}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>
                    <Switch
                        value={aiNotificationsEnabled}
                        onValueChange={handleNotificationToggle}
                        trackColor={{ false: '#333', true: 'rgba(74,222,128,0.4)' }}
                        thumbColor={aiNotificationsEnabled ? '#4ADE80' : '#888'}
                        style={{ transform: [{ scale: 0.8 }] }}
                    />
                </View>

                {/* AI Notifications Info - Only when eye icon clicked */}
                {showNotificationInfo && (
                    <View style={styles.notificationInfoCompact}>
                        <View style={styles.notificationInfoItem}>
                            <Text style={styles.notificationInfoIcon}>🌅</Text>
                            <Text style={styles.notificationInfoTextCompact}>Morning insights</Text>
                        </View>
                        <View style={styles.notificationInfoItem}>
                            <Text style={styles.notificationInfoIcon}>⏰</Text>
                            <Text style={styles.notificationInfoTextCompact}>Smart reminders</Text>
                        </View>
                        <View style={styles.notificationInfoItem}>
                            <Text style={styles.notificationInfoIcon}>🥗</Text>
                            <Text style={styles.notificationInfoTextCompact}>AI suggestions</Text>
                        </View>
                    </View>
                )}

                {/* Nutrition Goals */}
                <View style={styles.goalsSection}>
                    <TouchableOpacity
                        style={styles.goalsSectionHeader}
                        onPress={() => setIsDailyGoalsExpanded(!isDailyGoalsExpanded)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.sectionHeaderLeft}>
                            <Ionicons name="nutrition" size={20} color="#4ADE80" />
                            <Text style={styles.sectionTitle}>Daily Goals</Text>
                        </View>
                        <View style={styles.headerActionsRow}>
                            {hasGoalsSet && !isEditing && (
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setIsEditing(true);
                                        setIsDailyGoalsExpanded(true);
                                    }}
                                >
                                    <Ionicons name="pencil" size={16} color="#4ADE80" />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                            {isEditing && (
                                <View style={styles.headerActions}>
                                    <TouchableOpacity
                                        style={styles.cancelBtnHeader}
                                        onPress={() => setIsEditing(false)}
                                    >
                                        <Text style={styles.cancelBtnHeaderText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveBtnHeader}
                                        onPress={handleSaveGoals}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark" size={16} color="#fff" />
                                                <Text style={styles.saveBtnHeaderText}>Save</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                            <Ionicons
                                name={isDailyGoalsExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#666"
                            />
                        </View>
                    </TouchableOpacity>

                    {isDailyGoalsExpanded && (
                        <>
                            {!hasGoalsSet && !isEditing ? (
                                /* No goals set - show setup prompt */
                                <TouchableOpacity
                                    style={styles.setupGoalsCard}
                                    onPress={() => setIsEditing(true)}
                                >
                                    <Ionicons name="nutrition-outline" size={32} color="#4ADE80" />
                                    <Text style={styles.setupGoalsTitle}>Set Your Nutrition Goals</Text>
                                    <Text style={styles.setupGoalsText}>
                                        Track your daily intake with personalized targets
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                /* Current Stats - Inline Editable */
                                <View style={styles.macroDisplayCard}>
                                    <Text style={styles.currentStatsLabel}>Current Stats</Text>
                                    {/* Profile Row - Age, Gender, Weight */}
                                    <View style={styles.profileStatsRow}>
                                        {isEditing ? (
                                            <>
                                                <View style={styles.inlineEditChip}>
                                                    <Ionicons name="person" size={14} color="#4ADE80" />
                                                    <TextInput
                                                        style={styles.inlineInput}
                                                        value={String(goals.age || '')}
                                                        onChangeText={(v) => updateGoal('age', v)}
                                                        keyboardType="numeric"
                                                        placeholder="30"
                                                        placeholderTextColor="#555"
                                                        selectTextOnFocus={true}
                                                    />
                                                    <Text style={styles.inlineUnit}>y</Text>
                                                </View>
                                                <View style={styles.genderToggleInline}>
                                                    <TouchableOpacity
                                                        style={[styles.genderBtn, goals.gender === 'male' && styles.genderBtnActive]}
                                                        onPress={() => setGoals(prev => ({ ...prev, gender: 'male' }))}
                                                    >
                                                        <Text style={[styles.genderBtnText, goals.gender === 'male' && styles.genderBtnTextActive]}>♂</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.genderBtn, goals.gender === 'female' && styles.genderBtnActive]}
                                                        onPress={() => setGoals(prev => ({ ...prev, gender: 'female' }))}
                                                    >
                                                        <Text style={[styles.genderBtnText, goals.gender === 'female' && styles.genderBtnTextActive]}>♀</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.inlineEditChip}>
                                                    <Ionicons name="scale" size={14} color="#4ADE80" />
                                                    <TextInput
                                                        style={styles.inlineInput}
                                                        value={String(goals.weight_kg || '')}
                                                        onChangeText={(v) => updateGoal('weight_kg', v)}
                                                        keyboardType="numeric"
                                                        placeholder="70"
                                                        placeholderTextColor="#555"
                                                        selectTextOnFocus={true}
                                                    />
                                                    <View style={styles.unitToggle}>
                                                        <TouchableOpacity
                                                            style={[styles.unitBtn, goals.weight_unit === 'kg' && styles.unitBtnActive]}
                                                            onPress={() => setGoals(prev => ({ ...prev, weight_unit: 'kg' }))}
                                                        >
                                                            <Text style={[styles.unitBtnText, goals.weight_unit === 'kg' && styles.unitBtnTextActive]}>kg</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.unitBtn, goals.weight_unit === 'lb' && styles.unitBtnActive]}
                                                            onPress={() => setGoals(prev => ({ ...prev, weight_unit: 'lb' }))}
                                                        >
                                                            <Text style={[styles.unitBtnText, goals.weight_unit === 'lb' && styles.unitBtnTextActive]}>lb</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </>
                                        ) : (
                                            <View style={styles.profileStatChip}>
                                                <Ionicons name="person" size={14} color="#4ADE80" />
                                                <Text style={styles.profileStatText}>
                                                    {goals.age || 30}y · {goals.gender === 'female' ? '♀' : '♂'} · {goals.weight_kg || 70}{goals.weight_unit || 'kg'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Goal Type Row - Only show editor when editing */}
                                    {isEditing && (
                                        <View style={styles.goalTypeSection}>
                                            <Text style={styles.goalTypeLabel}>Your Goal</Text>
                                            <View style={styles.goalTypeButtons}>
                                                <TouchableOpacity
                                                    style={[styles.goalTypeBtn, goals.goal_type === 'weight_loss' && styles.goalTypeBtnActive]}
                                                    onPress={() => setGoals(prev => ({ ...prev, goal_type: 'weight_loss' }))}
                                                >
                                                    <Text style={styles.goalTypeIcon}>🔥</Text>
                                                    <Text style={[styles.goalTypeBtnText, goals.goal_type === 'weight_loss' && styles.goalTypeBtnTextActive]}>Lose</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.goalTypeBtn, goals.goal_type === 'maintain' && styles.goalTypeBtnActive]}
                                                    onPress={() => setGoals(prev => ({ ...prev, goal_type: 'maintain' }))}
                                                >
                                                    <Text style={styles.goalTypeIcon}>⚖️</Text>
                                                    <Text style={[styles.goalTypeBtnText, goals.goal_type === 'maintain' && styles.goalTypeBtnTextActive]}>Maintain</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.goalTypeBtn, goals.goal_type === 'weight_gain' && styles.goalTypeBtnActive]}
                                                    onPress={() => setGoals(prev => ({ ...prev, goal_type: 'weight_gain' }))}
                                                >
                                                    <Text style={styles.goalTypeIcon}>💪</Text>
                                                    <Text style={[styles.goalTypeBtnText, goals.goal_type === 'weight_gain' && styles.goalTypeBtnTextActive]}>Gain</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {/* Calories Display with Goal Badge centered above */}
                                    <View style={styles.calorieDisplay}>
                                        {/* Goal Type Badge - Centered above calories when NOT editing */}
                                        {!isEditing && (
                                            <View style={styles.goalTypeBadgeCentered}>
                                                <Text style={styles.goalTypeBadgeText}>
                                                    {goals.goal_type === 'weight_loss' && '🔥 Weight Loss'}
                                                    {goals.goal_type === 'maintain' && '⚖️ Maintain Weight'}
                                                    {goals.goal_type === 'weight_gain' && '💪 Weight Gain'}
                                                    {!goals.goal_type && '⚖️ Maintain Weight'}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.calorieValue}>{goals.target_calories}</Text>
                                        <Text style={styles.calorieLabel}>Calories / day</Text>
                                        {isEditing && (
                                            <Text style={styles.calorieHint}>
                                                Set via RDA button below
                                            </Text>
                                        )}
                                    </View>

                                    {/* Macronutrient Targets Section */}
                                    <View style={styles.macroSection}>
                                        <View style={styles.macroHeaderRow}>
                                            <Text style={styles.macroSectionTitle}>Macronutrient Targets</Text>
                                            {isEditing && (
                                                <TouchableOpacity
                                                    style={styles.resetRdaBtnSmall}
                                                    onPress={() => {
                                                        // Convert to kg if user selected lb
                                                        const weightInKg = goals.weight_unit === 'lb'
                                                            ? (goals.weight_kg || 70) / 2.205
                                                            : (goals.weight_kg || 70);
                                                        const rda = calculateRecommendedMacros(
                                                            goals.age || 30,
                                                            (goals.gender || 'male') as Gender,
                                                            weightInKg,
                                                            (goals.activity_level || 'moderate') as ActivityLevel
                                                        );
                                                        setGoals(prev => ({
                                                            ...prev,
                                                            target_calories: rda.calories,
                                                            target_protein_g: rda.protein_g,
                                                            target_carbs_g: rda.carbs_g,
                                                            target_fat_g: rda.fat_g,
                                                        }));
                                                    }}
                                                >
                                                    <Ionicons name="refresh" size={12} color="#4ADE80" />
                                                    <Text style={styles.resetRdaBtnSmallText}>RDA</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Macros Row */}
                                        <View style={styles.macroDisplayRow}>
                                            <View style={styles.macroDisplayItem}>
                                                <Text style={styles.macroLetter}>P</Text>
                                                {isEditing ? (
                                                    <View style={styles.macroInputRow}>
                                                        <TextInput
                                                            style={styles.macroInputInline}
                                                            value={String(goals.target_protein_g || '')}
                                                            onChangeText={(v) => updateGoal('target_protein_g', v)}
                                                            keyboardType="numeric"
                                                            placeholder="150"
                                                            placeholderTextColor="#555"
                                                        />
                                                        <Text style={styles.macroUnitInline}>g</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.macroDisplayValue}>{goals.target_protein_g}g</Text>
                                                )}
                                            </View>
                                            <View style={styles.macroDivider} />
                                            <View style={styles.macroDisplayItem}>
                                                <Text style={styles.macroLetter}>C</Text>
                                                {isEditing ? (
                                                    <View style={styles.macroInputRow}>
                                                        <TextInput
                                                            style={styles.macroInputInline}
                                                            value={String(goals.target_carbs_g || '')}
                                                            onChangeText={(v) => updateGoal('target_carbs_g', v)}
                                                            keyboardType="numeric"
                                                            placeholder="200"
                                                            placeholderTextColor="#555"
                                                        />
                                                        <Text style={styles.macroUnitInline}>g</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.macroDisplayValue}>{goals.target_carbs_g}g</Text>
                                                )}
                                            </View>
                                            <View style={styles.macroDivider} />
                                            <View style={styles.macroDisplayItem}>
                                                <Text style={styles.macroLetter}>F</Text>
                                                {isEditing ? (
                                                    <View style={styles.macroInputRow}>
                                                        <TextInput
                                                            style={styles.macroInputInline}
                                                            value={String(goals.target_fat_g || '')}
                                                            onChangeText={(v) => updateGoal('target_fat_g', v)}
                                                            keyboardType="numeric"
                                                            placeholder="70"
                                                            placeholderTextColor="#555"
                                                        />
                                                        <Text style={styles.macroUnitInline}>g</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.macroDisplayValue}>{goals.target_fat_g}g</Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {/* Micronutrients Grid */}
                                    <View style={styles.microDisplaySection}>
                                        <View style={styles.microHeaderRow}>
                                            <Text style={styles.microDisplayTitle}>Micronutrient Targets</Text>
                                            {isEditing && (
                                                <TouchableOpacity
                                                    style={styles.resetRdaBtnSmall}
                                                    onPress={() => {
                                                        const rda = calculateRecommendedMicros(goals.age || 30, (goals.gender || 'male') as Gender);
                                                        setGoals(prev => ({
                                                            ...prev,
                                                            target_vitamin_c_mg: rda.vitamin_c_mg,
                                                            target_vitamin_d_mcg: rda.vitamin_d_mcg,
                                                            target_calcium_mg: rda.calcium_mg,
                                                            target_iron_mg: rda.iron_mg,
                                                            target_potassium_mg: rda.potassium_mg,
                                                            target_sodium_mg: rda.sodium_mg,
                                                        }));
                                                    }}
                                                >
                                                    <Ionicons name="refresh" size={12} color="#4ADE80" />
                                                    <Text style={styles.resetRdaBtnSmallText}>RDA</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <View style={styles.microDisplayGrid}>
                                            {[
                                                { key: 'target_vitamin_c_mg', label: 'Vit C', unit: 'mg', default: 90 },
                                                { key: 'target_vitamin_d_mcg', label: 'Vit D', unit: 'mcg', default: 15 },
                                                { key: 'target_iron_mg', label: 'Iron', unit: 'mg', default: 8 },
                                                { key: 'target_calcium_mg', label: 'Calcium', unit: 'mg', default: 1000 },
                                                { key: 'target_potassium_mg', label: 'Potassium', unit: 'mg', default: 3400 },
                                                { key: 'target_sodium_mg', label: 'Sodium', unit: 'mg', default: 2300 },
                                            ].map((micro) => (
                                                <View key={micro.key} style={styles.microDisplayItem}>
                                                    <Text style={styles.microDisplayLabel}>{micro.label}</Text>
                                                    {isEditing ? (
                                                        <View style={styles.microInputRow}>
                                                            <TextInput
                                                                style={styles.microInputInline}
                                                                value={String((goals as any)[micro.key] || '')}
                                                                onChangeText={(v) => updateGoal(micro.key as keyof NutritionGoals, v)}
                                                                keyboardType="numeric"
                                                                placeholder={String(micro.default)}
                                                                placeholderTextColor="#555"
                                                            />
                                                            <Text style={styles.microUnitInline}>{micro.unit}</Text>
                                                        </View>
                                                    ) : (
                                                        <Text style={styles.microDisplayValue}>
                                                            {(goals as any)[micro.key] || micro.default}{micro.unit}
                                                        </Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Favorite Meals */}
                <View style={styles.favoritesSection}>
                    <TouchableOpacity
                        style={styles.favoritesHeader}
                        onPress={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="heart" size={22} color="#EF4444" />
                        <Text style={styles.favoritesTitle}>Favorite Meals</Text>
                        <Text style={styles.favoritesCount}>{favorites.length} saved</Text>
                        <Ionicons
                            name={isFavoritesExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#888"
                        />
                    </TouchableOpacity>

                    {isFavoritesExpanded && (
                        loadingFavorites ? (
                            <ActivityIndicator color="#4ADE80" style={{ marginVertical: 20 }} />
                        ) : favorites.length > 0 ? (
                            <View style={styles.favoritesList}>
                                {favorites.map((fav) => {
                                    const isExpanded = expandedFavorite === fav.id;
                                    return (
                                        <View key={fav.id} style={[styles.favoriteCard, isExpanded && styles.favoriteCardExpanded]}>
                                            {/* Main Row - Tappable */}
                                            <TouchableOpacity
                                                style={styles.favCardHeader}
                                                onPress={() => setExpandedFavorite(isExpanded ? null : fav.id!)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.favCardLeft}>
                                                    <Text style={styles.favCardName}>{fav.name}</Text>
                                                    <View style={styles.favMacroRow}>
                                                        <Text style={styles.favMacroPill}>{fav.calories} cal</Text>
                                                        <Text style={[styles.favMacroPill, styles.proteinPill]}>{Math.round(fav.protein_g || 0)}g P</Text>
                                                        <Text style={[styles.favMacroPill, styles.carbsPill]}>{Math.round(fav.carbs_g || 0)}g C</Text>
                                                        <Text style={[styles.favMacroPill, styles.fatPill]}>{Math.round(fav.fat_g || 0)}g F</Text>
                                                    </View>
                                                </View>
                                                <Ionicons
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={20}
                                                    color="#888"
                                                />
                                            </TouchableOpacity>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <View style={styles.favExpandedContent}>
                                                    {fav.description && (
                                                        <Text style={styles.favDescription}>{fav.description}</Text>
                                                    )}
                                                    <View style={styles.favActions}>
                                                        <TouchableOpacity
                                                            style={[styles.favAddButton, addedToday.has(fav.id!) && styles.favAddedButton]}
                                                            onPress={() => handleQuickAdd(fav)}
                                                            disabled={addingFavoriteId === fav.id || addedToday.has(fav.id!)}
                                                        >
                                                            {addingFavoriteId === fav.id ? (
                                                                <ActivityIndicator color="#fff" size="small" />
                                                            ) : (
                                                                <>
                                                                    <Ionicons
                                                                        name={addedToday.has(fav.id!) ? "checkmark-circle" : "add-circle-outline"}
                                                                        size={18}
                                                                        color={addedToday.has(fav.id!) ? "#888" : "#fff"}
                                                                    />
                                                                    <Text style={[styles.favAddButtonText, addedToday.has(fav.id!) && styles.favAddedButtonText]}>
                                                                        {addedToday.has(fav.id!) ? 'Added ✓' : 'Add to Today'}
                                                                    </Text>
                                                                </>
                                                            )}
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.favDeleteButton}
                                                            onPress={() => handleDeleteFavorite(fav.id!, fav.name)}
                                                        >
                                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.noFavorites}>
                                <Ionicons name="heart-outline" size={40} color="#333" />
                                <Text style={styles.noFavoritesText}>
                                    No favorites yet
                                </Text>
                                <Text style={styles.noFavoritesHint}>
                                    Tap the ❤️ on meals in History to save favorites!
                                </Text>
                            </View>
                        )
                    )}
                </View>

                {/* Saved Tips */}
                <View style={styles.savedTipsSection}>
                    <TouchableOpacity
                        style={styles.savedTipsHeader}
                        onPress={() => setIsTipsExpanded(!isTipsExpanded)}
                    >
                        <View style={styles.savedTipsHeaderLeft}>
                            <Ionicons name="bookmark" size={20} color="#4ADE80" />
                            <Text style={styles.savedTipsTitle}>Saved Tips</Text>
                            <Text style={styles.savedTipsCount}>{savedTips.length} saved</Text>
                        </View>
                        <Ionicons
                            name={isTipsExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#666"
                        />
                    </TouchableOpacity>

                    {isTipsExpanded && (
                        savedTips.length > 0 ? (
                            <View style={styles.savedTipsList}>
                                {savedTips.map((tip) => (
                                    <View key={tip.id} style={styles.savedTipCard}>
                                        <Text style={styles.savedTipText}>{tip.content}</Text>
                                        <View style={styles.savedTipFooter}>
                                            <Text style={styles.savedTipDate}>
                                                {new Date(tip.created_at).toLocaleDateString()}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteTip(tip.id)}
                                                disabled={deletingTipId === tip.id}
                                            >
                                                {deletingTipId === tip.id ? (
                                                    <ActivityIndicator size="small" color="#EF4444" />
                                                ) : (
                                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.noTips}>
                                <Ionicons name="bookmark-outline" size={40} color="#333" />
                                <Text style={styles.noTipsText}>No tips saved yet</Text>
                                <Text style={styles.noTipsHint}>
                                    Save AI tips from the Insights chat!
                                </Text>
                            </View>
                        )
                    )}
                </View>

            </ScrollView>

            {/* In-App Toast Notification */}
            {showSaveToast && (
                <Animated.View style={styles.saveToast}>
                    <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />
                    <Text style={styles.saveToastText}>Goals saved!</Text>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A1A',
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
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },

    // Compact Header
    compactHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#4ADE80',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarTextSmall: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    userEmailSmall: {
        color: '#888',
        fontSize: 13,
        flex: 1,
    },
    signOutButtonCompact: {
        padding: 8,
    },

    // Compact Notification Row
    notificationRowCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    notificationLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notificationLabelCompact: {
        color: '#ccc',
        fontSize: 13,
    },
    notificationInfoCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    notificationInfoTextCompact: {
        color: '#888',
        fontSize: 11,
    },

    // User Card
    userCard: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4ADE80',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    userEmail: {
        color: '#888',
        fontSize: 14,
    },
    notificationToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        width: '100%',
    },
    notificationToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notificationToggleText: {
        color: '#ccc',
        fontSize: 14,
    },

    // Section
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },

    // Goals Grid
    goalsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    goalItem: {
        width: '47%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
    },
    goalLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 8,
    },
    goalInput: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    goalUnit: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },

    // Save Button
    saveButton: {
        flexDirection: 'row',
        backgroundColor: '#4ADE80',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 32,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },

    // App Info
    appInfo: {
        alignItems: 'center',
        paddingVertical: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    appName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    appVersion: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    appDesc: {
        color: '#888',
        fontSize: 13,
        marginTop: 8,
    },

    // Sign Out
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '500',
    },

    // Guest Mode
    guestCard: {
        alignItems: 'center',
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 16,
        padding: 32,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    guestIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    guestText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    signInButton: {
        flexDirection: 'row',
        backgroundColor: '#4ADE80',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    signInButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    telegramAvatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#0088cc',
    },
    userInfoColumn: {
        flex: 1,
        marginLeft: 2,
    },
    userNameSmall: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    creditsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    creditsLabel: {
        color: '#ff9500',
        fontSize: 12,
        fontWeight: '600',
    },
    benefitsCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    benefitsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    benefit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
    },
    benefitText: {
        color: '#ccc',
        fontSize: 14,
    },

    // Notifications Toggle
    notificationsCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    notificationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    notificationsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    notificationsTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    notificationsInfo: {
        color: '#888',
        fontSize: 12,
        lineHeight: 18,
    },

    // Goals Section Redesign
    goalsSection: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    goalsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 36,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 8,
    },
    editButtonText: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '500',
    },

    // Setup Goals Card (when no goals set)
    setupGoalsCard: {
        alignItems: 'center',
        backgroundColor: 'rgba(74,222,128,0.08)',
        borderRadius: 16,
        padding: 32,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
        borderStyle: 'dashed',
    },
    setupGoalsTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    setupGoalsText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },

    // Edit Mode Styles
    editGoalsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    editGoalItem: {
        width: '47%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
    },
    editGoalLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 8,
    },
    editGoalInput: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    editGoalUnit: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    editActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    cancelButtonText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600',
    },
    saveButtonSmall: {
        flex: 1,
    },

    // Display Mode - Big P/C/F
    macroDisplayCard: {
        marginTop: 16,
    },
    calorieDisplay: {
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    calorieValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#4ADE80',
    },
    calorieLabel: {
        color: '#888',
        fontSize: 14,
        marginTop: 4,
    },
    macroDisplayRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    macroDisplayItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroLetter: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    macroDisplayValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4ADE80',
        marginTop: 4,
    },
    macroDisplayLabel: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    macroDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },

    // Favorites Section
    favoritesSection: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    favoritesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    favoritesTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    favoritesList: {
        gap: 10,
    },
    favoriteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        padding: 12,
    },
    favoriteInfo: {
        flex: 1,
    },
    favoriteName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    favoriteMacros: {
        color: '#888',
        fontSize: 13,
    },
    favoriteActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quickAddButton: {
        backgroundColor: '#4ADE80',
        borderRadius: 8,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: 8,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noFavorites: {
        padding: 30,
        alignItems: 'center',
        gap: 8,
    },
    noFavoritesText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '500',
    },
    noFavoritesHint: {
        color: '#666',
        fontSize: 13,
        textAlign: 'center',
    },

    // New Expandable Favorites
    favoritesCount: {
        color: '#888',
        fontSize: 13,
        marginLeft: 'auto',
    },
    favoriteCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    favoriteCardExpanded: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    favCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    favCardLeft: {
        flex: 1,
    },
    favCardName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
    },
    favMacroRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    favMacroPill: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        fontSize: 11,
        color: '#aaa',
        overflow: 'hidden',
    },
    proteinPill: {
        backgroundColor: 'rgba(96,165,250,0.2)',
        color: '#60A5FA',
    },
    carbsPill: {
        backgroundColor: 'rgba(251,191,36,0.2)',
        color: '#FBBF24',
    },
    fatPill: {
        backgroundColor: 'rgba(244,114,182,0.2)',
        color: '#F472B6',
    },
    favExpandedContent: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    favDescription: {
        color: '#888',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 14,
    },
    favActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    favAddButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        borderRadius: 10,
        paddingVertical: 12,
        gap: 8,
    },
    favAddButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    favAddedButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    favAddedButtonText: {
        color: '#888',
    },
    favDeleteButton: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: 10,
        padding: 12,
    },

    // Micronutrient Goals Styles
    editGoalRowHalf: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    genderToggle: {
        flexDirection: 'row',
        gap: 8,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    genderOptionActive: {
        backgroundColor: 'rgba(74,222,128,0.2)',
        borderWidth: 1,
        borderColor: '#4ADE80',
    },
    genderOptionText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    genderOptionTextActive: {
        color: '#4ADE80',
    },
    microExpandHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    microExpandTitle: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    microGoalsContainer: {
        paddingBottom: 16,
    },
    resetRdaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(74,222,128,0.1)',
        marginBottom: 16,
    },
    resetRdaText: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '500',
    },
    microGoalsGrid: {
        gap: 12,
    },

    // Profile Stats Display Styles
    profileStatsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    profileStatChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    profileStatText: {
        color: '#ccc',
        fontSize: 13,
        fontWeight: '500',
    },

    // Micronutrient Display Styles
    microDisplaySection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    microDisplayTitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 12,
    },
    microDisplayGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    microDisplayItem: {
        width: '31%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
    },
    microDisplayLabel: {
        color: '#888',
        fontSize: 11,
        marginBottom: 4,
    },
    microDisplayValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Inline Editing Styles
    inlineEditChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(74,222,128,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
    },
    inlineInput: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        minWidth: 30,
        textAlign: 'center',
    },
    inlineUnit: {
        color: '#888',
        fontSize: 12,
    },
    genderToggleInline: {
        flexDirection: 'row',
        gap: 4,
    },
    genderBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderBtnActive: {
        backgroundColor: 'rgba(74,222,128,0.2)',
        borderWidth: 1,
        borderColor: '#4ADE80',
    },
    genderBtnText: {
        fontSize: 18,
        color: '#666',
    },
    genderBtnTextActive: {
        color: '#4ADE80',
    },
    calorieValueEditable: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#4ADE80',
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(74,222,128,0.4)',
        minWidth: 120,
    },
    macroInputRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    macroInputInline: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4ADE80',
        textAlign: 'center',
        minWidth: 40,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(74,222,128,0.3)',
    },
    macroUnitInline: {
        fontSize: 12,
        color: '#888',
        marginLeft: 2,
    },
    microHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    resetRdaBtnSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(74,222,128,0.1)',
    },
    resetRdaBtnSmallText: {
        color: '#4ADE80',
        fontSize: 11,
        fontWeight: '500',
    },
    microInputRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    microInputInline: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        minWidth: 35,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.2)',
    },
    microUnitInline: {
        fontSize: 10,
        color: '#888',
        marginLeft: 1,
    },
    inlineEditActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    cancelBtnInline: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    cancelBtnText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    saveBtnInline: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#4ADE80',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Header Action Styles
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cancelBtnHeader: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    cancelBtnHeaderText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    saveBtnHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#4ADE80',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    saveBtnHeaderText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Macro Section Styles
    macroSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    macroHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    macroSectionTitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
    },
    calorieHint: {
        color: '#666',
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic',
    },
    saveToast: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26,26,46,0.95)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
    },
    saveToastText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },

    // Saved Tips Section
    savedTipsSection: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    savedTipsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    savedTipsHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    savedTipsTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    savedTipsCount: {
        color: '#666',
        fontSize: 13,
    },
    savedTipsList: {
        marginTop: 12,
        gap: 10,
    },
    savedTipCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
    },
    savedTipText: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
    },
    savedTipFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    savedTipDate: {
        color: '#666',
        fontSize: 12,
    },
    noTips: {
        alignItems: 'center',
        paddingVertical: 30,
        gap: 8,
    },
    noTipsText: {
        color: '#666',
        fontSize: 16,
        marginTop: 8,
    },
    noTipsHint: {
        color: '#444',
        fontSize: 13,
        textAlign: 'center',
    },

    // Quick Prompts Section
    quickPromptsSection: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    sectionHeaderTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeaderCount: {
        color: '#666',
        fontSize: 12,
        marginLeft: 4,
    },
    promptsList: {
        marginTop: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        padding: 16,
        gap: 10,
    },
    promptsHint: {
        color: '#666',
        fontSize: 12,
        marginBottom: 8,
    },
    promptItem: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        overflow: 'hidden',
    },
    headerActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    currentStatsLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    promptInput: {
        color: '#fff',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    resetPromptsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 10,
    },
    resetPromptsText: {
        color: '#666',
        fontSize: 12,
    },

    // Goal Type Selector
    goalTypeSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    goalTypeLabel: {
        color: '#888',
        fontSize: 13,
        marginBottom: 10,
    },
    goalTypeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    goalTypeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        paddingVertical: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    goalTypeBtnActive: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderColor: 'rgba(74,222,128,0.4)',
    },
    goalTypeIcon: {
        fontSize: 16,
    },
    goalTypeBtnText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
    },
    goalTypeBtnTextActive: {
        color: '#4ADE80',
        fontWeight: '600',
    },
    goalTypeDisplay: {
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
    },
    goalTypeDisplayText: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '500',
    },
    goalTypeBadgeCentered: {
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    goalTypeBadgeText: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '600',
    },

    // Weight Unit Toggle
    unitToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 6,
        overflow: 'hidden',
    },
    unitBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    unitBtnActive: {
        backgroundColor: 'rgba(74,222,128,0.3)',
    },
    unitBtnText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    unitBtnTextActive: {
        color: '#4ADE80',
    },

    // Notification Info Blurb
    notificationInfoBlurb: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        width: '100%',
        alignSelf: 'stretch',
    },
    notificationInfoTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    notificationInfoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 10,
    },
    notificationInfoIcon: {
        fontSize: 16,
        width: 22,
    },
    notificationInfoText: {
        flex: 1,
        color: '#999',
        fontSize: 13,
        lineHeight: 18,
    },
});
