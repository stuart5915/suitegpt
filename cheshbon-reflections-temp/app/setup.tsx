import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity, Modal, LayoutAnimation, UIManager, Animated, Image } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing, BorderRadius, FontFamilies, Shadows } from '../constants/theme';
import { generateReadingPlan, calculateDailyCommitment, type PlanType } from '../services/planGenerator';
import { saveReadingPlan, getAllActivePlans, deletePlan, type ReadingPlan } from '../services/database';
import { supabase } from '../services/supabase';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Configure notification handling
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const planDescriptions: { [key: string]: { icon: string; title: string; description: string } } = {
    canonical: {
        icon: '📖',
        title: 'Canonical Order',
        description: 'Read the Bible from Genesis to Revelation in its traditional book order. Perfect for those who want to experience Scripture as it appears in most Bibles.'
    },
    chronological: {
        icon: '📅',
        title: 'Chronological Order',
        description: 'Experience the Bible in the order events actually happened. This plan weaves together books, prophecies, and psalms in historical sequence.'
    },
    nt90: {
        icon: '✨',
        title: 'New Testament',
        description: 'Focus on the New Testament - the Gospels, Acts, Paul\'s letters, and Revelation. Perfect for studying Jesus\' life and the early church.'
    },
    wisdom: {
        icon: '🕊️',
        title: 'Psalms & Proverbs',
        description: 'Immerse yourself in wisdom literature. 150 Psalms of praise and lament, plus 31 chapters of practical wisdom from Proverbs.'
    },
    jesus: {
        icon: '✝️',
        title: 'Who is Jesus?',
        description: 'A focused journey through the key passages that reveal who Jesus is - His birth, ministry, teachings, miracles, death, and resurrection. Perfect for newcomers or those wanting to know Christ more deeply.'
    }
};

const pathCards = [
    { type: 'canonical' as PlanType, title: 'Canonical', subtitle: '~1 year · Full Bible', icon: '📖', defaultDays: 365, minDays: 7, maxDays: 730 },
    { type: 'chronological' as PlanType, title: 'Chronological', subtitle: '~1 year · Full Bible', icon: '📅', defaultDays: 365, minDays: 7, maxDays: 730 },
    { type: 'nt90' as PlanType, title: 'New Testament', subtitle: '~3 months · 260 chapters', icon: '✨', defaultDays: 90, minDays: 7, maxDays: 180 },
    { type: 'wisdom' as PlanType, title: 'Psalms & Proverbs', subtitle: '~2 months · 181 chapters', icon: '🕊️', defaultDays: 60, minDays: 7, maxDays: 120 },
    { type: 'jesus' as PlanType, title: 'Who is Jesus?', subtitle: '~30 days · Key passages', icon: '✝️', defaultDays: 30, minDays: 3, maxDays: 90 },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_OPTIONS = [
    { label: '6:00 AM', hour: 6 },
    { label: '7:00 AM', hour: 7 },
    { label: '8:00 AM', hour: 8 },
    { label: '9:00 AM', hour: 9 },
    { label: '12:00 PM', hour: 12 },
    { label: '6:00 PM', hour: 18 },
    { label: '9:00 PM', hour: 21 },
];

export default function Setup() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState<PlanType | null>('canonical');
    const [durationDays, setDurationDays] = useState(365);
    const [loading, setLoading] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [infoPlanType, setInfoPlanType] = useState<string | null>(null);
    const [activePlans, setActivePlans] = useState<ReadingPlan[]>([]);

    // Cancel plan modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [planToCancel, setPlanToCancel] = useState<{ id: string; type: string } | null>(null);

    // Edit plan modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [planToEdit, setPlanToEdit] = useState<ReadingPlan | null>(null);
    const [editNotificationsEnabled, setEditNotificationsEnabled] = useState(true);
    const [editSelectedDays, setEditSelectedDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
    const [editReminderTime, setEditReminderTime] = useState(new Date(2024, 0, 1, 7, 0));
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);

    // Notification settings (for new plans)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6])); // All days by default
    const [reminderTime, setReminderTime] = useState(new Date(2024, 0, 1, 7, 0)); // 7:00 AM default
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Pulse animation for button
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Load active plans on mount
    async function loadActivePlans() {
        try {
            const plans = await getAllActivePlans();
            setActivePlans(plans);
        } catch (error) {
            console.error('Error loading active plans:', error);
        }
    }

    useEffect(() => {
        loadActivePlans();
    }, []);

    useEffect(() => {
        if (selectedPlan) {
            // Start pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.03,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [selectedPlan]);

    // Ensure duration stays within plan's limits when plan changes
    useEffect(() => {
        if (selectedPlan) {
            const plan = pathCards.find(p => p.type === selectedPlan);
            if (plan) {
                // Clamp duration to valid range
                setDurationDays(prev => {
                    if (prev < plan.minDays) return plan.minDays;
                    if (prev > plan.maxDays) return plan.maxDays;
                    return prev;
                });
            }
        }
    }, [selectedPlan]);

    function handleSelectPlan(planType: PlanType) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        // Get the new plan's default days BEFORE setting the plan
        const plan = pathCards.find(p => p.type === planType);
        if (plan) {
            setDurationDays(plan.defaultDays);
        }
        setSelectedPlan(planType);
    }

    function showPlanInfo(planType: string) {
        setInfoPlanType(planType);
        setShowInfoModal(true);
    }

    function handleDeletePlan(planId: string, planType: string) {
        setPlanToCancel({ id: planId, type: planType });
        setShowCancelModal(true);
    }

    async function confirmCancelPlan(deleteReflections: boolean) {
        if (!planToCancel) return;

        try {
            if (deleteReflections) {
                await deletePlan(planToCancel.id);
            } else {
                // Keep reflections: first orphan the journal entries, then delete the plan
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from('journal_entries')
                        .update({ plan_id: null })
                        .eq('plan_id', planToCancel.id)
                        .eq('user_id', user.id);

                    await supabase.from('reading_plans').delete().eq('id', planToCancel.id).eq('user_id', user.id);
                }
            }
            loadActivePlans();
        } catch (error) {
            console.error('Error cancelling plan:', error);
        } finally {
            setShowCancelModal(false);
        }
    }

    // Calculate commitment based on duration
    const numberOfReadings = durationDays;
    const commitment = calculateDailyCommitment(numberOfReadings);

    // For subset plans, adjust chapter count (NT ~260 chapters, Wisdom ~181 chapters, Jesus ~45 chapters)
    const getPlanTotalChapters = () => {
        if (selectedPlan === 'nt90') return 260;
        if (selectedPlan === 'wisdom') return 181;
        if (selectedPlan === 'jesus') return 45; // ~45 chapters in curated Jesus passages
        return 1189; // Full Bible
    };
    const planChapters = getPlanTotalChapters();
    const displayChapters = Math.ceil(planChapters / numberOfReadings * 10) / 10;
    const displayMinutes = Math.ceil(displayChapters * 4);

    // Toggle a day in notification selection
    function toggleDay(day: number) {
        const newDays = new Set(selectedDays);
        if (newDays.has(day)) {
            newDays.delete(day);
        } else {
            newDays.add(day);
        }
        setSelectedDays(newDays);
    }

    // Toggle a day in EDIT modal
    function toggleEditDay(day: number) {
        const newDays = new Set(editSelectedDays);
        if (newDays.has(day)) {
            newDays.delete(day);
        } else {
            newDays.add(day);
        }
        setEditSelectedDays(newDays);
    }

    // Open edit modal for a plan
    async function openEditModal(plan: ReadingPlan) {
        setPlanToEdit(plan);
        // Load saved notification settings
        try {
            const saved = await AsyncStorage.getItem('notification_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                setEditNotificationsEnabled(settings.enabled ?? true);
                setEditSelectedDays(new Set(settings.days ?? [0, 1, 2, 3, 4, 5, 6]));
                setEditReminderTime(new Date(2024, 0, 1, settings.hour ?? 7, settings.minute ?? 0));
            }
        } catch (e) {
            console.error('Error loading notification settings:', e);
        }
        setShowEditModal(true);
    }

    // Save edited notification settings
    async function saveEditSettings() {
        try {
            const hour = editReminderTime.getHours();
            const minute = editReminderTime.getMinutes();

            // Cancel existing notifications
            await Notifications.cancelAllScheduledNotificationsAsync();

            if (editNotificationsEnabled && editSelectedDays.size > 0) {
                // Request permissions
                const { status } = await Notifications.requestPermissionsAsync();
                if (status === 'granted') {
                    // Schedule notifications for selected days
                    for (const day of editSelectedDays) {
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: '📖 Time for Scripture',
                                body: 'Your daily reading is waiting. Take a moment to grow in faith.',
                                sound: true,
                            },
                            trigger: {
                                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                                weekday: day + 1,
                                hour: hour,
                                minute: minute,
                            },
                        });
                    }
                }
            }

            // Save settings
            await AsyncStorage.setItem('notification_settings', JSON.stringify({
                enabled: editNotificationsEnabled,
                days: Array.from(editSelectedDays),
                hour: hour,
                minute: minute,
            }));

            setShowEditModal(false);
            setPlanToEdit(null);
        } catch (error) {
            console.error('Error saving notification settings:', error);
        }
    }

    // Schedule notifications for selected days
    async function scheduleNotifications() {
        if (!notificationsEnabled || selectedDays.size === 0) return;

        try {
            // Request permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Notification permission not granted');
                return;
            }

            // Cancel any existing notifications
            await Notifications.cancelAllScheduledNotificationsAsync();

            // Schedule a notification for each selected day
            const hour = reminderTime.getHours();
            const minute = reminderTime.getMinutes();

            for (const day of selectedDays) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '📖 Time for Scripture',
                        body: 'Your daily reading is waiting. Take a moment to grow in faith.',
                        sound: true,
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                        weekday: day + 1, // Expo uses 1-7 (Sunday=1)
                        hour: hour,
                        minute: minute,
                    },
                });
            }

            // Save notification preferences
            await AsyncStorage.setItem('notification_settings', JSON.stringify({
                enabled: true,
                days: Array.from(selectedDays),
                hour: hour,
                minute: minute,
            }));

            console.log('[Setup] Scheduled notifications for days:', Array.from(selectedDays), 'at', `${hour}:${minute}`);
        } catch (error) {
            console.error('Error scheduling notifications:', error);
        }
    }

    async function handleStart() {
        if (!selectedPlan) return;

        console.log('[Setup] handleStart called with plan:', selectedPlan, 'readings:', numberOfReadings);
        setLoading(true);
        try {
            const plan = generateReadingPlan(
                selectedPlan,
                numberOfReadings // Use reading sessions count, not calendar days
            );
            console.log('[Setup] Generated plan:', plan.totalDays, 'days');

            const planId = await saveReadingPlan({
                type: selectedPlan,
                duration: plan.totalDays, // This will be total reading sessions
                start_date: new Date().toISOString().split('T')[0],
                current_day: 1,
                is_active: true,
                completed: false,
            });
            console.log('[Setup] Plan saved successfully with ID:', planId);

            // Schedule notifications if enabled
            await scheduleNotifications();

            // Navigate directly to day 1 of the new plan
            router.replace(`/daily?planId=${planId}&day=1`);
        } catch (error) {
            console.error('Error creating plan:', error);
            setLoading(false);
            // Show error to user on web
            if (Platform.OS === 'web') {
                window.alert(`Failed to create plan: ${error}`);
            }
        }
    }

    return (
        <View style={styles.wrapper}>
            {/* Banner Image - Absolute at top, behind status bar */}
            <Image
                source={require('../assets/banner_plan.png')}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: Platform.OS === 'ios' ? 190 : 160,
                    zIndex: 0,
                }}
                resizeMode="cover"
            />

            {/* Fixed Summary Card at top */}
            <View style={{
                paddingHorizontal: Spacing.lg,
                paddingTop: Platform.OS === 'ios' ? 130 : 100,
                paddingBottom: Spacing.md,
                zIndex: 1,
            }}>
                {/* YOUR PLAN card */}
                <View style={{
                    backgroundColor: Colors.white,
                    borderRadius: 16,
                    padding: Spacing.md,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                    borderWidth: 2,
                    borderColor: Colors.gold,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                        <View style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: Colors.gold,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: Spacing.sm,
                        }}>
                            <Typography variant="h3" style={{ fontSize: 22 }}>
                                {pathCards.find(p => p.type === selectedPlan)?.icon || '📖'}
                            </Typography>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" style={{ fontWeight: '700' }}>
                                {pathCards.find(p => p.type === selectedPlan)?.title || 'Canonical'}
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray}>
                                {pathCards.find(p => p.type === selectedPlan)?.subtitle || '~1 year · Full Bible'}
                            </Typography>
                        </View>
                        <TouchableOpacity
                            onPress={() => showPlanInfo(selectedPlan || 'canonical')}
                            style={{ padding: 4 }}
                        >
                            <Ionicons name="information-circle-outline" size={22} color={Colors.gold} />
                        </TouchableOpacity>
                    </View>
                    {/* Details row */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingTop: Spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: Colors.lightGray
                    }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Typography variant="body" color={Colors.gold} style={{ fontWeight: '700' }}>
                                {durationDays}
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray}>days</Typography>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Typography variant="body" color={Colors.gold} style={{ fontWeight: '700' }}>
                                ~{Math.ceil(getPlanTotalChapters() / durationDays * 4)}
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray}>min/day</Typography>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Typography variant="body" color={Colors.gold} style={{ fontWeight: '700' }}>
                                {notificationsEnabled ? '🔔' : '🔕'}
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray}>{notificationsEnabled ? 'On' : 'Off'}</Typography>
                        </View>
                    </View>
                </View>

                {/* Begin Button */}
                <Animated.View style={{ transform: [{ scale: selectedPlan ? pulseAnim : 1 }], marginTop: Spacing.sm }}>
                    <TouchableOpacity
                        style={[
                            styles.beginButton,
                            !selectedPlan && styles.beginButtonDisabled,
                        ]}
                        onPress={handleStart}
                        disabled={!selectedPlan || loading}
                        activeOpacity={0.8}
                    >
                        <Typography
                            variant="h3"
                            color={selectedPlan ? Colors.white : Colors.mediumGray}
                            style={styles.beginButtonText}
                        >
                            {loading ? 'Creating...' : 'Begin Journey →'}
                        </Typography>
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Scrollable customization options */}
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100, paddingTop: Spacing.md }}>
                {/* Content with padding */}
                <View style={{ paddingHorizontal: Spacing.lg }}>
                    {/* Scroll hint */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: Spacing.md,
                        gap: 8,
                    }}>
                        <Typography variant="caption" color={Colors.mediumGray}>
                            ↓ Customize your journey below ↓
                        </Typography>
                    </View>

                    {/* Continue Your Journey - Active Plans */}
                    {activePlans.length > 0 && (
                        <View style={{ marginBottom: Spacing.xl }}>
                            {activePlans.map((plan) => {
                                const progress = Math.round((plan.current_day / plan.duration) * 100);
                                const planInfo = planDescriptions[plan.type];
                                const daysRemaining = plan.duration - plan.current_day;

                                return (
                                    <TouchableOpacity
                                        key={plan.id}
                                        style={{
                                            backgroundColor: Colors.gold,
                                            borderRadius: 20,
                                            padding: 20,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.15,
                                            shadowRadius: 12,
                                            elevation: 6,
                                        }}
                                        onPress={() => router.push(`/daily?planId=${plan.id}&day=${plan.current_day}`)}
                                        activeOpacity={0.9}
                                    >
                                        {/* Top Row: Icon + Title + Settings */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                            <View style={{
                                                backgroundColor: 'rgba(255,255,255,0.2)',
                                                width: 48,
                                                height: 48,
                                                borderRadius: 24,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginRight: 12
                                            }}>
                                                <Typography variant="h2">{planInfo?.icon || '📖'}</Typography>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Typography variant="h3" color={Colors.white} numberOfLines={1}>
                                                    {planInfo?.title || 'Reading Plan'}
                                                </Typography>
                                                <Typography variant="caption" color="rgba(255,255,255,0.8)">
                                                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                                                </Typography>
                                            </View>
                                            <TouchableOpacity
                                                style={{
                                                    padding: 8,
                                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                                    borderRadius: 20,
                                                }}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(plan);
                                                }}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.9)" />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={{ marginBottom: 16 }}>
                                            <View style={{
                                                height: 8,
                                                backgroundColor: 'rgba(255,255,255,0.25)',
                                                borderRadius: 4,
                                                overflow: 'hidden'
                                            }}>
                                                <View style={{
                                                    height: '100%',
                                                    width: `${progress}%`,
                                                    backgroundColor: Colors.white,
                                                    borderRadius: 4
                                                }} />
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                                <Typography variant="caption" color="rgba(255,255,255,0.8)">
                                                    Day {plan.current_day} of {plan.duration}
                                                </Typography>
                                                <Typography variant="caption" color={Colors.white} style={{ fontWeight: '700' }}>
                                                    {progress}%
                                                </Typography>
                                            </View>
                                        </View>

                                        {/* CTA Button */}
                                        <View style={{
                                            backgroundColor: Colors.white,
                                            borderRadius: 12,
                                            paddingVertical: 14,
                                            paddingHorizontal: 20,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Typography variant="body" color={Colors.gold} style={{ fontWeight: '700', marginRight: 8 }}>
                                                Continue Reading
                                            </Typography>
                                            <Ionicons name="arrow-forward" size={18} color={Colors.gold} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )
                    }

                    {/* Divider if has active plans */}
                    {
                        activePlans.length > 0 && (
                            <View style={{
                                marginTop: Spacing.md,
                                marginBottom: Spacing.lg,
                                paddingTop: Spacing.md,
                                borderTopWidth: 1,
                                borderTopColor: Colors.lightGray,
                            }}>
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontWeight: '500' }}>
                                    Looking for something different?
                                </Typography>
                            </View>
                        )
                    }

                    {/* Path Selection */}
                    <View style={styles.stepSection}>
                        <Typography variant="h3" style={styles.stepTitle}>
                            Reading Path
                        </Typography>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 12 }}
                        >
                            {pathCards.map((path) => {
                                const isSelected = selectedPlan === path.type;

                                return (
                                    <TouchableOpacity
                                        key={path.type}
                                        style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 16,
                                            backgroundColor: isSelected ? Colors.gold : Colors.white,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: isSelected ? 0 : 1,
                                            borderColor: Colors.lightGray,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: isSelected ? 0.15 : 0.05,
                                            shadowRadius: 4,
                                            elevation: isSelected ? 4 : 2,
                                        }}
                                        onPress={() => handleSelectPlan(path.type)}
                                        activeOpacity={0.8}
                                    >
                                        <Typography variant="h2" style={{ fontSize: 28 }}>
                                            {path.icon}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Duration */}
                    {
                        selectedPlan && (
                            <View style={styles.stepSection}>
                                <Typography variant="h3" style={styles.stepTitle}>
                                    Duration
                                </Typography>

                                <View style={{ backgroundColor: Colors.white, borderRadius: 12, padding: Spacing.md }}>
                                    {/* Compact duration display */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm }}>
                                        <Typography variant="h2" color={Colors.gold} style={{ fontWeight: '700', marginRight: 8 }}>
                                            {durationDays}
                                        </Typography>
                                        <Typography variant="body" color={Colors.mediumGray}>
                                            days
                                        </Typography>
                                    </View>

                                    {/* Slider */}
                                    {(() => {
                                        const currentPlan = pathCards.find(p => p.type === selectedPlan);
                                        const minDays = currentPlan?.minDays || 30;
                                        const maxDays = currentPlan?.maxDays || 730;

                                        return (
                                            <>
                                                <Slider
                                                    key={selectedPlan}
                                                    style={{ width: '100%', height: 40 }}
                                                    minimumValue={minDays}
                                                    maximumValue={maxDays}
                                                    step={1}
                                                    value={Math.max(minDays, Math.min(maxDays, durationDays))}
                                                    onValueChange={(value) => setDurationDays(Math.round(value))}
                                                    minimumTrackTintColor={Colors.gold}
                                                    maximumTrackTintColor={Colors.lightGray}
                                                    thumbTintColor={Colors.gold}
                                                />
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Typography variant="caption" color={Colors.mediumGray}>{minDays}d</Typography>
                                                    <Typography variant="caption" color={Colors.mediumGray}>{maxDays}d</Typography>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </View>

                                {/* Live stats */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Typography variant="h3" style={styles.statValue}>
                                            {displayChapters}
                                        </Typography>
                                        <Typography variant="caption" color={Colors.mediumGray}>
                                            chapters/read
                                        </Typography>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Typography variant="h3" style={styles.statValue}>
                                            ~{displayMinutes}
                                        </Typography>
                                        <Typography variant="caption" color={Colors.mediumGray}>
                                            min/read
                                        </Typography>
                                    </View>
                                </View>
                            </View>
                        )
                    }

                    {/* Reminders */}
                    {
                        selectedPlan && (
                            <View style={styles.stepSection}>
                                <Typography variant="h3" style={styles.stepTitle}>
                                    Reminders
                                </Typography>

                                <View style={styles.notificationCard}>
                                    {/* Enable/Disable Toggle */}
                                    <TouchableOpacity
                                        style={styles.notificationToggle}
                                        onPress={() => setNotificationsEnabled(!notificationsEnabled)}
                                    >
                                        <Typography variant="body">
                                            🔔 Reading Reminders
                                        </Typography>
                                        <View style={[
                                            styles.toggleSwitch,
                                            notificationsEnabled && styles.toggleSwitchOn
                                        ]}>
                                            <View style={[
                                                styles.toggleKnob,
                                                notificationsEnabled && styles.toggleKnobOn
                                            ]} />
                                        </View>
                                    </TouchableOpacity>

                                    {notificationsEnabled && (
                                        <>
                                            {/* Day Selection */}
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
                                                Remind me on:
                                            </Typography>
                                            <View style={styles.dayButtons}>
                                                {DAYS_OF_WEEK.map((day, index) => (
                                                    <TouchableOpacity
                                                        key={day}
                                                        style={[
                                                            styles.dayButton,
                                                            selectedDays.has(index) && styles.dayButtonSelected
                                                        ]}
                                                        onPress={() => toggleDay(index)}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color={selectedDays.has(index) ? Colors.white : Colors.mediumGray}
                                                            style={{ fontWeight: selectedDays.has(index) ? 'bold' : 'normal' }}
                                                        >
                                                            {day}
                                                        </Typography>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {/* Time Selection */}
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
                                                At:
                                            </Typography>
                                            <TouchableOpacity
                                                style={styles.timeSelector}
                                                onPress={() => setShowTimePicker(!showTimePicker)}
                                            >
                                                <Typography variant="body" color={Colors.gold}>
                                                    {reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    {showTimePicker ? '▲' : '▼'}
                                                </Typography>
                                            </TouchableOpacity>

                                            {showTimePicker && (
                                                <DateTimePicker
                                                    value={reminderTime}
                                                    mode="time"
                                                    is24Hour={false}
                                                    display="spinner"
                                                    onChange={(event, selectedDate) => {
                                                        if (selectedDate) {
                                                            setReminderTime(selectedDate);
                                                        }
                                                    }}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>
                            </View>
                        )
                    }

                    {/* Bottom padding for nav */}
                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            {/* Info Modal */}
            < Modal
                visible={showInfoModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInfoModal(false)
                }
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Typography variant="h2" style={{ marginBottom: Spacing.sm }}>
                            {infoPlanType && planDescriptions[infoPlanType]?.icon}
                        </Typography>
                        <Typography variant="h3" style={{ marginBottom: Spacing.md, textAlign: 'center' }}>
                            {infoPlanType && planDescriptions[infoPlanType]?.title}
                        </Typography>
                        <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center', lineHeight: 22 }}>
                            {infoPlanType && planDescriptions[infoPlanType]?.description}
                        </Typography>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowInfoModal(false)}
                        >
                            <Typography variant="body" color={Colors.gold}>Got it!</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* Cancel Plan Modal */}
            < Modal
                visible={showCancelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCancelModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCancelModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <TouchableOpacity
                                style={styles.modalCloseX}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontSize: 20 }}>✕</Typography>
                            </TouchableOpacity>

                            <Typography variant="h3" style={styles.modalTitle}>
                                Cancel Plan?
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray} style={styles.modalMessage}>
                                Are you sure you want to cancel your {planToCancel?.type} plan?
                            </Typography>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonKeep}
                                    onPress={() => confirmCancelPlan(false)}
                                >
                                    <Typography variant="body" color={Colors.darkGray}>
                                        Cancel Plan Only
                                    </Typography>
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        Keep reflections
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalButtonDelete}
                                    onPress={() => confirmCancelPlan(true)}
                                >
                                    <Typography variant="body" color={Colors.white}>
                                        Delete Everything
                                    </Typography>
                                    <Typography variant="caption" color="rgba(255,255,255,0.7)">
                                        Plan + reflections
                                    </Typography>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.modalButtonNevermind}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Typography variant="body" color={Colors.gold}>
                                    Never mind
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal >

            {/* Edit Plan Modal */}
            < Modal
                visible={showEditModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEditModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.modalContent, { maxHeight: 500, paddingBottom: Spacing.md }]}>
                            <TouchableOpacity
                                style={styles.modalCloseX}
                                onPress={() => setShowEditModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontSize: 20 }}>✕</Typography>
                            </TouchableOpacity>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.sm }}>
                                <Typography variant="h3" style={styles.modalTitle}>
                                    Edit Notification Settings
                                </Typography>

                                {/* Enable/Disable Toggle */}
                                <TouchableOpacity
                                    style={styles.notificationToggle}
                                    onPress={() => setEditNotificationsEnabled(!editNotificationsEnabled)}
                                >
                                    <Typography variant="body">
                                        🔔 Reading Reminders
                                    </Typography>
                                    <View style={[
                                        styles.toggleSwitch,
                                        editNotificationsEnabled && styles.toggleSwitchOn
                                    ]}>
                                        <View style={[
                                            styles.toggleKnob,
                                            editNotificationsEnabled && styles.toggleKnobOn
                                        ]} />
                                    </View>
                                </TouchableOpacity>

                                {editNotificationsEnabled && (
                                    <>
                                        {/* Day Selection */}
                                        <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
                                            Remind me on:
                                        </Typography>
                                        <View style={styles.dayButtons}>
                                            {DAYS_OF_WEEK.map((day, index) => (
                                                <TouchableOpacity
                                                    key={day}
                                                    style={[
                                                        styles.dayButton,
                                                        editSelectedDays.has(index) && styles.dayButtonSelected
                                                    ]}
                                                    onPress={() => toggleEditDay(index)}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color={editSelectedDays.has(index) ? Colors.white : Colors.mediumGray}
                                                        style={{ fontWeight: editSelectedDays.has(index) ? 'bold' : 'normal' }}
                                                    >
                                                        {day}
                                                    </Typography>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Time Selection */}
                                        <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
                                            At:
                                        </Typography>
                                        <TouchableOpacity
                                            style={styles.timeSelector}
                                            onPress={() => setShowEditTimePicker(!showEditTimePicker)}
                                        >
                                            <Typography variant="body" color={Colors.gold}>
                                                {editReminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                            </Typography>
                                            <Typography variant="caption" color={Colors.mediumGray}>
                                                {showEditTimePicker ? '▲' : '▼'}
                                            </Typography>
                                        </TouchableOpacity>

                                        {showEditTimePicker && (
                                            <DateTimePicker
                                                value={editReminderTime}
                                                mode="time"
                                                is24Hour={false}
                                                display="spinner"
                                                onChange={(event, selectedDate) => {
                                                    if (selectedDate) {
                                                        setEditReminderTime(selectedDate);
                                                    }
                                                }}
                                            />
                                        )}
                                    </>
                                )}

                                <TouchableOpacity
                                    style={[styles.beginButton, { marginTop: Spacing.lg }]}
                                    onPress={saveEditSettings}
                                >
                                    <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                        Save Settings
                                    </Typography>
                                </TouchableOpacity>

                                {/* Cancel Plan Button */}
                                <TouchableOpacity
                                    style={{ marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' }}
                                    onPress={() => {
                                        setShowEditModal(false);
                                        if (planToEdit) {
                                            handleDeletePlan(planToEdit.id, planToEdit.type || 'canonical');
                                        }
                                    }}
                                >
                                    <Typography variant="body" color="#E0245E">
                                        Cancel Plan
                                    </Typography>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal >

            <BottomNav />
        </View >
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    container: {
        flex: 1,
    },
    content: {
        padding: Spacing.xl,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing.xl,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    title: {
        marginBottom: Spacing.sm,
    },
    subtitle: {
        marginTop: Spacing.xs,
    },

    // Step sections
    stepSection: {
        marginBottom: Spacing.xl,
    },
    stepLabel: {
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: Spacing.xs,
    },
    stepTitle: {
        marginBottom: Spacing.md,
        color: Colors.darkGray,
    },

    // Path cards grid
    pathGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    pathCard: {
        width: '47%',
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.md,
        borderWidth: 3,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        position: 'relative',
    },
    pathCardSelected: {
        borderColor: Colors.gold,
    },
    pathCardFaded: {
        opacity: 0.5,
    },
    pathCardContent: {
        alignItems: 'center',
    },
    pathIcon: {
        marginBottom: Spacing.sm,
    },
    pathTitle: {
        marginBottom: Spacing.xs,
        textAlign: 'center',
        fontFamily: FontFamilies.sansBold,
    },
    pathTitleSelected: {
        color: Colors.gold,
    },
    infoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 4,
    },

    // Duration card
    durationCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    durationDisplay: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    durationNumber: {
        fontSize: 48,
        color: Colors.gold,
        fontFamily: FontFamilies.serif,
    },

    // Frequency Section
    frequencySection: {
        marginBottom: Spacing.xl,
        paddingHorizontal: Spacing.sm,
    },
    frequencyButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: Spacing.xs,
        gap: 8,
        rowGap: 8,
    },
    frequencyButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: Colors.cream,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    frequencyButtonSelected: {
        backgroundColor: Colors.gold,
        borderColor: Colors.gold,
    },

    sliderContainer: {
        marginBottom: Spacing.xl,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -Spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    statValue: {
        color: Colors.gold,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.lightGray,
    },

    // Begin button
    beginButton: {
        backgroundColor: Colors.gold,
        borderRadius: 16,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    beginButtonDisabled: {
        backgroundColor: Colors.lightGray,
        shadowOpacity: 0,
    },
    beginButtonText: {
        fontFamily: FontFamilies.sansBold,
    },
    hint: {
        textAlign: 'center',
        marginTop: Spacing.md,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: Spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
    },
    modalCloseButton: {
        marginTop: Spacing.xl,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.gold,
        borderRadius: 20,
    },
    // Active plans section styles
    activePlansList: {
        gap: Spacing.md,
    },
    activePlanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.lg,
        borderWidth: 2,
        borderColor: Colors.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    activePlanContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    activePlanText: {
        flex: 1,
    },
    planActionButtons: {
        alignItems: 'flex-end',
        gap: Spacing.sm,
    },
    resumeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.gold,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: 20,
        minWidth: 100,
        justifyContent: 'center',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        backgroundColor: Colors.cream,
    },
    cancelPlanButton: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        padding: Spacing.xs,
        zIndex: 10,
    },
    sectionDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.lightGray,
    },
    dividerText: {
        paddingHorizontal: Spacing.md,
    },
    newPlanHeader: {
        marginBottom: Spacing.lg,
        color: Colors.darkGray,
    },
    // Cancel modal styles
    modalTitle: {
        textAlign: 'center',
        marginBottom: Spacing.sm,
        color: Colors.darkGray,
    },
    modalMessage: {
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    modalButtons: {
        width: '100%',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    modalButtonKeep: {
        backgroundColor: Colors.lightGray,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonDelete: {
        backgroundColor: '#D32F2F',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonNevermind: {
        paddingVertical: Spacing.sm,
    },
    modalCloseX: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 8,
        zIndex: 10,
    },
    // Notification settings styles
    notificationCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    notificationToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.lightGray,
        padding: 2,
        justifyContent: 'center',
    },
    toggleSwitchOn: {
        backgroundColor: Colors.gold,
    },
    toggleKnob: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    toggleKnobOn: {
        alignSelf: 'flex-end',
    },
    dayButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    dayButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: 8,
        backgroundColor: Colors.cream,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    dayButtonSelected: {
        backgroundColor: Colors.gold,
        borderColor: Colors.gold,
    },
    timeSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.cream,
        padding: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    timeOptions: {
        marginTop: Spacing.sm,
        backgroundColor: Colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        overflow: 'hidden',
    },
    timeOption: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    timeOptionSelected: {
        backgroundColor: Colors.cream,
    },
});
