import { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, Alert, Share, Modal, Image, Animated, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import {
    getPlanReflections,
    getAllReflectionsFiltered,
    getAllActivePlans,
    getAllJournalEntries,
    deleteJournalEntry,
    deleteVerseReflection,
    deletePlan,
    type PlanReflection,
    type JournalEntry,
    type VerseReflection,
    type ReadingPlan,
} from '../services/database';
import { supabase } from '../services/supabase';
import { publishReflection, findPublicReflectionId, getUserPublicReflections, deletePublicReflection } from '../services/feedService';
import { saveVerseReflection } from '../services/database';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ReflectionType = 'all' | 'plan' | 'verse';

export default function Archive() {
    const { planId: paramPlanId, day: paramDay } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    // Compose state
    const [composeText, setComposeText] = useState('');
    const [shareToFeed, setShareToFeed] = useState(false);
    const [composing, setComposing] = useState(false);

    // Toast notification
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastAnim = useRef(new Animated.Value(0)).current;

    function showToast(message: string) {
        setToastMessage(message);
        Animated.sequence([
            Animated.timing(toastAnim, {
                toValue: 1, duration: 200, useNativeDriver: true
            }),
            Animated.delay(2000),
            Animated.timing(toastAnim, {
                toValue: 0, duration: 200, useNativeDriver: true
            }),
        ]).start(() => setToastMessage(null));
    }

    const [activePlans, setActivePlans] = useState<ReadingPlan[]>([]);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [planEntries, setPlanEntries] = useState<{ [planId: string]: JournalEntry[] }>({});
    const [dailyReflections, setDailyReflections] = useState<(JournalEntry | VerseReflection)[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<ReflectionType>('all');
    const [filterBook, setFilterBook] = useState<string>('');
    const [filterPlanId, setFilterPlanId] = useState<string>((paramPlanId as string) || '');
    // We need to use filterDay to filter the *display* if provided.
    const [filterDay, setFilterDay] = useState<number | null>(paramDay ? parseInt(paramDay as string, 10) : null);

    // Visibility filter: 'all' | 'public' | 'private'
    type VisibilityFilter = 'all' | 'public' | 'private';
    const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
    const [publicReflectionsMap, setPublicReflectionsMap] = useState<Map<string, string>>(new Map());

    // Cancel plan modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [planToCancel, setPlanToCancel] = useState<{ id: string; type: string } | null>(null);

    // Edit mode & multi-select state
    const [editMode, setEditMode] = useState(false);
    const [selectedReflections, setSelectedReflections] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null); // For single item delete confirmation

    // Swipe-to-reveal state
    const [revealedReflectionId, setRevealedReflectionId] = useState<string | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);

    // New: Action menu & collapsible filters state
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);

    // If paramPlanId exists, we might want to expand that plan automatically?
    useEffect(() => {
        if (paramPlanId) {
            setFilterPlanId(paramPlanId as string);
            setExpandedPlanId(paramPlanId as string);
        }
    }, [paramPlanId]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        loadDailyReflections();
    }, [filterType, filterBook, filterPlanId, filterDay]);

    // Refresh data when returning to this screen - clear cache first to ensure fresh data
    useFocusEffect(
        useCallback(() => {
            // Clear cache to ensure we get fresh data (items deleted elsewhere won't persist)
            AsyncStorage.removeItem('cached_journal_data').then(() => {
                loadDailyReflections();
                loadPublicReflections();
            });
        }, [filterType, filterBook, filterPlanId, filterDay, visibilityFilter])
    );

    async function loadPublicReflections() {
        try {
            const publicMap = await getUserPublicReflections();
            setPublicReflectionsMap(publicMap);
        } catch (error) {
            console.error('Error loading public reflections:', error);
        }
    }

    async function loadData() {
        try {
            // Try to load from cache first for instant display
            const cachedData = await AsyncStorage.getItem('cached_journal_data');
            if (cachedData) {
                const { plans, entriesMap, reflections } = JSON.parse(cachedData);
                setActivePlans(plans || []);
                setPlanEntries(entriesMap || {});
                setDailyReflections(reflections || []);
                setLoading(false);
            }

            // Then refresh from database in background
            const plans = await getAllActivePlans();
            setActivePlans(plans);

            // Load ALL journal entries
            const allEntries = await getAllJournalEntries();

            // Sort plans by duration (shortest first) for fallback assignment
            // Shorter plans (NT90=90 days) get priority over longer ones (Canonical=365 days)
            const sortedPlans = [...plans].sort((a, b) => a.duration - b.duration);

            // Track which entries have been assigned to prevent duplicates
            const assignedEntryIds = new Set<string>();

            // Group entries by plan
            const entriesMap: { [planId: string]: JournalEntry[] } = {};

            for (const plan of sortedPlans) {
                const planStartDate = new Date(plan.start_date);

                const planEntries = allEntries.filter(entry => {
                    // Skip if already assigned to another plan
                    if (assignedEntryIds.has(entry.id!)) return false;

                    // Direct match by plan_id
                    if (entry.plan_id === plan.id) {
                        assignedEntryIds.add(entry.id!);
                        return true;
                    }

                    // Fallback for entries WITHOUT plan_id: assign to matching plan by date
                    if (!entry.plan_id) {
                        const entryDate = new Date(entry.date);
                        const daysSinceStart = Math.floor(
                            (entryDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        if (daysSinceStart >= 0 && daysSinceStart < plan.duration) {
                            assignedEntryIds.add(entry.id!);
                            return true;
                        }
                    }

                    return false;
                });

                // Sort by day number or date
                planEntries.sort((a, b) => {
                    if (a.day_number && b.day_number) return a.day_number - b.day_number;
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                });

                entriesMap[plan.id!] = planEntries;
            }
            setPlanEntries(entriesMap);

            // Load daily reflections
            const reflections = await getAllReflectionsFiltered({
                type: filterType,
                book: filterBook,
                planId: filterType === 'plan' ? (filterPlanId || undefined) : undefined,
            });
            setDailyReflections(reflections);

            // Update cache for next time
            await AsyncStorage.setItem('cached_journal_data', JSON.stringify({
                plans,
                entriesMap,
                reflections,
            }));
        } catch (error) {
            console.error('Error loading archive data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadDailyReflections() {
        try {
            // Only apply planId filter when explicitly filtering by 'plan' type
            const reflections = await getAllReflectionsFiltered({
                type: filterType,
                book: filterBook,
                planId: filterType === 'plan' ? (filterPlanId || undefined) : undefined,
            });

            console.log('[Journal] loadDailyReflections returned:', reflections.length, 'entries with filter:', { filterType, filterBook, filterPlanId });

            // Filter by Day if provided (Deep Link)
            let filtered = reflections;
            if (filterDay) {
                filtered = filtered.filter(item => {
                    // Check if item is JournalEntry and has day_number
                    return (item as JournalEntry).day_number === filterDay;
                });
            }

            setDailyReflections(filtered);
        } catch (error) {
            console.error('Error loading daily reflections:', error);
        }
    }

    const handlePlanClick = (planId: string) => {
        setExpandedPlanId(expandedPlanId === planId ? null : planId);
    };

    // Helper to check if reflection is verse or journal entry
    const isVerseReflection = (item: JournalEntry | VerseReflection): item is VerseReflection => {
        return 'verse_reference' in item;
    };

    function handleDeleteEntry(entryId: string) {
        // Show custom delete confirmation modal
        setSingleDeleteId(entryId);
    }

    async function confirmSingleDelete() {
        if (!singleDeleteId) return;
        try {
            // Find the reflection to determine its type
            const reflection = dailyReflections.find(r => r.id === singleDeleteId) as any;
            if (reflection) {
                if (reflection._type === 'public_reflection') {
                    await deletePublicReflection(singleDeleteId);
                } else if (reflection._type === 'reply') {
                    await supabase.from('unified_replies').delete().eq('id', singleDeleteId);
                } else if ('verse_reference' in reflection) {
                    await deleteVerseReflection(singleDeleteId);
                } else {
                    await deleteJournalEntry(singleDeleteId);
                }
            } else {
                // Fallback for plan entries
                await deleteJournalEntry(singleDeleteId);
            }
            await AsyncStorage.removeItem('cached_journal_data');
            loadData();
        } catch (error) {
            console.error('Error deleting entry:', error);
        } finally {
            setSingleDeleteId(null);
        }
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
                    // Set plan_id to null on journal entries so they become standalone reflections
                    await supabase
                        .from('journal_entries')
                        .update({ plan_id: null })
                        .eq('plan_id', planToCancel.id)
                        .eq('user_id', user.id);

                    // Now delete the plan (won't cascade delete the entries since they're orphaned)
                    await supabase.from('reading_plans').delete().eq('id', planToCancel.id).eq('user_id', user.id);
                }
            }
            loadData();
        } catch (error) {
            console.error('Error cancelling plan:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to cancel plan.');
            } else {
                Alert.alert('Error', 'Failed to cancel plan.');
            }
        } finally {
            setShowCancelModal(false);
            setPlanToCancel(null);
        }
    }

    // Toggle selection of a reflection
    function toggleReflectionSelection(id: string) {
        setSelectedReflections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }

    // Select all reflections
    function selectAllReflections() {
        const allIds = dailyReflections.map(r => r.id!);
        setSelectedReflections(new Set(allIds));
    }

    // Bulk delete selected reflections
    async function handleBulkDelete() {
        try {
            for (const id of selectedReflections) {
                // Find the reflection to determine its type
                const reflection = dailyReflections.find(r => r.id === id) as any;
                if (reflection) {
                    // Check the _type marker for public reflections and replies
                    if (reflection._type === 'public_reflection') {
                        await deletePublicReflection(id);
                    } else if (reflection._type === 'reply') {
                        // Delete from unified_replies table directly
                        const { error } = await supabase.from('unified_replies').delete().eq('id', id);
                        if (error) throw error;
                    } else if ('verse_reference' in reflection) {
                        await deleteVerseReflection(id);
                    } else {
                        await deleteJournalEntry(id);
                    }
                }
            }
            setSelectedReflections(new Set());
            setEditMode(false);
            setShowDeleteModal(false);
            // Clear AsyncStorage cache to force reload
            await AsyncStorage.removeItem('cached_journal_data');
            loadData();
        } catch (error) {
            console.error('Error deleting reflections:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to delete reflections. Please try again.');
            } else {
                Alert.alert('Error', 'Failed to delete reflections.');
            }
        }
    }

    // Delete ALL reflections
    async function handleDeleteAll() {
        setDeletingAll(true);
        try {
            for (const reflection of dailyReflections) {
                const r = reflection as any;
                if (r._type === 'public_reflection') {
                    await deletePublicReflection(reflection.id!);
                } else if (r._type === 'reply') {
                    await supabase.from('unified_replies').delete().eq('id', reflection.id!);
                } else if ('verse_reference' in reflection) {
                    await deleteVerseReflection(reflection.id!);
                } else {
                    await deleteJournalEntry(reflection.id!);
                }
            }
            setShowDeleteAllModal(false);
            await AsyncStorage.removeItem('cached_journal_data');
            loadData();
            showToast('All reflections deleted');
        } catch (error) {
            console.error('Error deleting all reflections:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to delete reflections.');
            } else {
                Alert.alert('Error', 'Failed to delete reflections.');
            }
        } finally {
            setDeletingAll(false);
        }
    }

    async function handlePublishReflection(reflection: JournalEntry | VerseReflection) {
        const isVerse = 'verse_reference' in reflection;

        const verseRef = isVerse
            ? (reflection as VerseReflection).verse_reference
            : `${(reflection as JournalEntry).book} ${(reflection as JournalEntry).chapter}`;

        const verseText = isVerse
            ? (reflection as VerseReflection).verse_text || ''
            : `${(reflection as JournalEntry).book} ${(reflection as JournalEntry).chapter}`;

        if (!reflection.reflection) {
            Alert.alert('No reflection', 'This entry has no reflection text to share.');
            return;
        }

        try {
            setPublishingId(reflection.id!);
            await publishReflection(verseRef, verseText, reflection.reflection);
            setRevealedReflectionId(null);

            if (Platform.OS === 'web') {
                window.alert('Shared to Community Feed! 🎉');
            } else {
                Alert.alert('Shared!', 'Your reflection is now visible in the Community Feed.');
            }
        } catch (error) {
            console.error('Error publishing reflection:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to share reflection.');
            } else {
                Alert.alert('Error', 'Failed to share reflection to community.');
            }
        } finally {
            setPublishingId(null);
        }
    }

    async function handleExportReflections() {
        try {
            // Gather all reflections
            let exportText = '📖 MY SPIRITUAL REFLECTIONS\n';
            exportText += '═'.repeat(40) + '\n';
            exportText += `Exported on: ${new Date().toLocaleDateString()}\n\n`;

            // Export plan entries
            for (const plan of activePlans) {
                const entries = planEntries[plan.id!] || [];
                if (entries.length > 0) {
                    exportText += `\n📚 ${plan.type.toUpperCase()} PLAN\n`;
                    exportText += '─'.repeat(30) + '\n';
                    for (const entry of entries) {
                        exportText += `\nDay ${entry.day_number} - ${entry.book} ${entry.chapter}\n`;
                        exportText += `Date: ${new Date(entry.created_at!).toLocaleDateString()}\n`;
                        exportText += `${entry.reflection}\n`;
                    }
                }
            }

            // Export daily reflections
            if (dailyReflections.length > 0) {
                exportText += `\n\n✨ DAILY REFLECTIONS\n`;
                exportText += '─'.repeat(30) + '\n';
                for (const reflection of dailyReflections) {
                    if ('verse_reference' in reflection) {
                        exportText += `\n${reflection.verse_reference}\n`;
                        exportText += `Date: ${new Date(reflection.created_at!).toLocaleDateString()}\n`;
                        exportText += `${reflection.reflection}\n`;
                    } else {
                        exportText += `\n${reflection.book} ${reflection.chapter}\n`;
                        exportText += `Date: ${new Date(reflection.created_at!).toLocaleDateString()}\n`;
                        exportText += `${reflection.reflection}\n`;
                    }
                }
            }

            exportText += '\n\n' + '═'.repeat(40);
            exportText += '\nExported from Cheshbon Reflections';

            await Share.share({
                message: exportText,
                title: 'My Spiritual Reflections',
            });
        } catch (error) {
            console.error('Error exporting reflections:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to export reflections.');
            } else {
                Alert.alert('Error', 'Failed to export reflections.');
            }
        }
    }

    return (
        <View style={styles.container}>
            {/* Cancel Plan Modal */}
            <Modal
                visible={showCancelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCancelModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setShowCancelModal(false);
                    }}
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
            </Modal>

            {/* Single Delete Confirmation Modal */}
            <Modal
                visible={!!singleDeleteId}
                transparent
                animationType="fade"
                onRequestClose={() => setSingleDeleteId(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setSingleDeleteId(null)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <TouchableOpacity
                                style={styles.modalCloseX}
                                onPress={() => setSingleDeleteId(null)}
                            >
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontSize: 20 }}>✕</Typography>
                            </TouchableOpacity>

                            <Typography variant="h3" style={styles.modalTitle}>
                                Delete Reflection?
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray} style={styles.modalMessage}>
                                Are you sure you want to delete this reflection? This cannot be undone.
                            </Typography>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonKeep}
                                    onPress={() => setSingleDeleteId(null)}
                                >
                                    <Typography variant="body" color={Colors.darkGray}>
                                        Cancel
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalButtonDelete}
                                    onPress={confirmSingleDelete}
                                >
                                    <Typography variant="body" color={Colors.white}>
                                        🗑️ Delete
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Delete All Confirmation Modal */}
            <Modal
                visible={showDeleteAllModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteAllModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDeleteAllModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <TouchableOpacity
                                style={styles.modalCloseX}
                                onPress={() => setShowDeleteAllModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontSize: 20 }}>✕</Typography>
                            </TouchableOpacity>

                            <Typography variant="h3" style={styles.modalTitle}>
                                🗑️ Delete All Reflections?
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray} style={styles.modalMessage}>
                                This will permanently delete all {dailyReflections.length} reflections. This action cannot be undone.
                            </Typography>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonKeep}
                                    onPress={() => setShowDeleteAllModal(false)}
                                >
                                    <Typography variant="body" color={Colors.darkGray}>
                                        Cancel
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalButtonDelete, deletingAll && { opacity: 0.7 }]}
                                    onPress={handleDeleteAll}
                                    disabled={deletingAll}
                                >
                                    {deletingAll ? (
                                        <ActivityIndicator size="small" color={Colors.white} />
                                    ) : (
                                        <Typography variant="body" color={Colors.white}>
                                            Delete All
                                        </Typography>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                {/* Hero Banner - Edge to Edge, behind status bar */}
                <Image
                    source={require('../assets/banner_journal.png')}
                    style={{
                        width: '120%',
                        height: Platform.OS === 'ios' ? 190 : 160,
                        marginHorizontal: -Spacing.lg,
                        marginTop: Platform.OS === 'ios' ? -Spacing.lg - 50 : -Spacing.lg,
                        alignSelf: 'center',
                        marginBottom: Spacing.md,
                    }}
                    resizeMode="cover"
                />

                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h2">Journal</Typography>
                    <Typography variant="body" color={Colors.mediumGray} style={{ marginTop: Spacing.sm }}>
                        Your spiritual journey
                    </Typography>
                </View>

                {/* Compose Section */}
                <View style={styles.composeCard}>
                    <TextInput
                        style={styles.composeInput}
                        placeholder="What's on your heart today?"
                        placeholderTextColor={Colors.mediumGray}
                        value={composeText}
                        onChangeText={setComposeText}
                        multiline
                        numberOfLines={3}
                    />
                    <View style={styles.composeActions}>
                        <TouchableOpacity
                            onPress={() => setShareToFeed(!shareToFeed)}
                            style={styles.shareToggle}
                        >
                            <View style={{
                                width: 40, height: 22, borderRadius: 11,
                                backgroundColor: shareToFeed ? Colors.gold : 'rgba(0,0,0,0.15)',
                                padding: 2, justifyContent: 'center',
                            }}>
                                <View style={{
                                    width: 18, height: 18, borderRadius: 9,
                                    backgroundColor: '#FFF',
                                    alignSelf: shareToFeed ? 'flex-end' : 'flex-start',
                                }} />
                            </View>
                            <Typography variant="caption" color={shareToFeed ? Colors.gold : Colors.mediumGray}>
                                {shareToFeed ? '🌍 Share to Community' : '🔒 Keep Private'}
                            </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, !composeText.trim() && { opacity: 0.5 }]}
                            disabled={!composeText.trim() || composing}
                            onPress={async () => {
                                if (!composeText.trim()) return;
                                setComposing(true);
                                try {
                                    // When sharing to community, ONLY save to public (not both)
                                    if (shareToFeed) {
                                        await publishReflection(
                                            '💭 Personal Reflection',
                                            '',
                                            composeText.trim()
                                        );
                                    } else {
                                        // Private only - save to verse_reflections
                                        const now = new Date();
                                        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                        await saveVerseReflection(
                                            today,
                                            '💭 Personal Reflection',
                                            '',
                                            composeText.trim()
                                        );
                                    }

                                    setComposeText('');
                                    setShareToFeed(false);
                                    loadData();

                                    showToast(shareToFeed ? '✓ Shared to Community' : '✓ Saved to Journal');
                                } catch (error) {
                                    console.error('Error saving reflection:', error);
                                } finally {
                                    setComposing(false);
                                }
                            }}
                        >
                            {composing ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                            ) : (
                                <Typography variant="caption" color={Colors.white} style={{ fontWeight: '600' }}>
                                    {shareToFeed ? '📤 Share' : '💾 Save'}
                                </Typography>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Daily Reflections Section - Compact Redesign */}
                <View style={styles.section}>
                    {/* Header Row: Title + Count + Action Menu */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Typography variant="h3">✍️ Reflections</Typography>
                            <View style={{
                                backgroundColor: Colors.gold,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 12
                            }}>
                                <Typography variant="caption" color={Colors.white} style={{ fontWeight: '600' }}>
                                    {dailyReflections.length}
                                </Typography>
                            </View>
                        </View>

                        {/* Action Menu Button */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                                style={{
                                    padding: 8,
                                    backgroundColor: showActionMenu ? 'rgba(0,0,0,0.05)' : 'transparent',
                                    borderRadius: 20
                                }}
                                onPress={() => setShowActionMenu(!showActionMenu)}
                            >
                                <Typography variant="body" style={{ fontSize: 20 }}>⋯</Typography>
                            </TouchableOpacity>

                            {/* Dropdown Menu */}
                            {showActionMenu && (
                                <View style={{
                                    position: 'absolute',
                                    top: 40,
                                    right: 0,
                                    backgroundColor: Colors.cream,
                                    borderRadius: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 12,
                                    elevation: 8,
                                    minWidth: 180,
                                    zIndex: 100,
                                    borderWidth: 1,
                                    borderColor: 'rgba(0,0,0,0.08)',
                                }}>
                                    <TouchableOpacity
                                        style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}
                                        onPress={() => { handleExportReflections(); setShowActionMenu(false); }}
                                    >
                                        <Typography variant="body" color={Colors.charcoal}>📤 Export All</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}
                                        onPress={() => {
                                            setEditMode(true);
                                            setShowActionMenu(false);
                                        }}
                                    >
                                        <Typography variant="body" color={Colors.charcoal}>✏️ Select & Delete</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ padding: 14 }}
                                        onPress={() => {
                                            setShowDeleteAllModal(true);
                                            setShowActionMenu(false);
                                        }}
                                    >
                                        <Typography variant="body" color="#D32F2F">🗑️ Delete All</Typography>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Compact Filter Bar */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: Spacing.md,
                        flexWrap: 'wrap'
                    }}>
                        {/* Visibility Segmented Control */}
                        <View style={{
                            flexDirection: 'row',
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            borderRadius: 20,
                            padding: 3
                        }}>
                            {(['all', 'public', 'private'] as VisibilityFilter[]).map((v) => (
                                <TouchableOpacity
                                    key={v}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        backgroundColor: visibilityFilter === v ? Colors.gold : 'transparent',
                                    }}
                                    onPress={() => setVisibilityFilter(v)}
                                >
                                    <Typography
                                        variant="caption"
                                        color={visibilityFilter === v ? Colors.white : Colors.mediumGray}
                                        style={{ fontWeight: visibilityFilter === v ? '600' : '400' }}
                                    >
                                        {v === 'all' ? 'All' : v === 'public' ? '🌍' : '🔒'}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Filter Toggle */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: showFilters || filterType !== 'all' ? Colors.gold : 'rgba(0,0,0,0.05)',
                            }}
                            onPress={() => setShowFilters(!showFilters)}
                        >
                            <Typography
                                variant="caption"
                                color={showFilters || filterType !== 'all' ? Colors.white : Colors.mediumGray}
                            >
                                {filterType !== 'all' ? `🔍 ${filterType === 'plan' ? 'Plan' : 'Verse'}` : '🔍 Filter'}
                            </Typography>
                        </TouchableOpacity>

                        {/* Clear Filters (if any active) */}
                        {(visibilityFilter !== 'all' || filterType !== 'all') && (
                            <TouchableOpacity
                                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                                onPress={() => {
                                    setVisibilityFilter('all');
                                    setFilterType('all');
                                    setFilterBook('');
                                    setShowFilters(false);
                                }}
                            >
                                <Typography variant="caption" color={Colors.mediumGray}>✕ Clear</Typography>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Expanded Filter Options */}
                    {showFilters && (
                        <View style={{
                            backgroundColor: 'rgba(0,0,0,0.03)',
                            borderRadius: 12,
                            padding: Spacing.md,
                            marginBottom: Spacing.md
                        }}>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 8 }}>
                                Type
                            </Typography>
                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                {(['all', 'plan', 'verse'] as ReflectionType[]).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 16,
                                            backgroundColor: filterType === type ? Colors.gold : Colors.cream,
                                            borderWidth: 1,
                                            borderColor: filterType === type ? Colors.gold : 'rgba(0,0,0,0.1)',
                                        }}
                                        onPress={() => setFilterType(type)}
                                    >
                                        <Typography
                                            variant="caption"
                                            color={filterType === type ? Colors.white : Colors.charcoal}
                                        >
                                            {type === 'all' ? 'All Types' : type === 'plan' ? '📖 Plan' : '✨ Verse of Day'}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Edit Mode Bar */}
                    {editMode && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'rgba(166,123,91,0.1)',
                            borderRadius: 12,
                            padding: Spacing.md,
                            marginBottom: Spacing.md
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity onPress={() => {
                                    if (selectedReflections.size === dailyReflections.length) {
                                        setSelectedReflections(new Set());
                                    } else {
                                        selectAllReflections();
                                    }
                                }}>
                                    <Typography variant="body" color={Colors.gold}>
                                        {selectedReflections.size === dailyReflections.length ? '☐ Deselect' : '☑️ Select All'}
                                    </Typography>
                                </TouchableOpacity>
                                <Typography variant="caption" color={Colors.mediumGray}>
                                    ({selectedReflections.size} selected)
                                </Typography>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                {selectedReflections.size > 0 && (
                                    <TouchableOpacity onPress={() => setShowDeleteModal(true)}>
                                        <Typography variant="body" color="#D32F2F">🗑️ Delete</Typography>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => {
                                    setEditMode(false);
                                    setSelectedReflections(new Set());
                                }}>
                                    <Typography variant="body" color={Colors.gold}>Done</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Reflections List */}
                    {loading ? (
                        <Typography variant="body" color={Colors.mediumGray}>
                            Loading...
                        </Typography>
                    ) : dailyReflections.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                                No reflections found. Start your journey today!
                            </Typography>
                        </View>
                    ) : (() => {
                        // Helper to check if a reflection is public
                        const isReflectionPublic = (reflection: JournalEntry | VerseReflection): boolean => {
                            // If it came from public_reflections or unified_replies, it's public
                            const anyReflection = reflection as any;
                            if (anyReflection._type === 'public_reflection' || anyReflection._type === 'reply') {
                                return true;
                            }
                            // Otherwise check the publicReflectionsMap for verse reflections
                            const isVerse = 'verse_reference' in reflection;
                            const verseRef = isVerse
                                ? (reflection as VerseReflection).verse_reference
                                : `${(reflection as JournalEntry).book} ${(reflection as JournalEntry).chapter}`;
                            const key = `${verseRef}|${reflection.reflection || ''}`;
                            return publicReflectionsMap.has(key);
                        };

                        // Apply visibility filter
                        const filteredReflections = dailyReflections.filter(reflection => {
                            if (visibilityFilter === 'all') return true;
                            const isPublic = isReflectionPublic(reflection);
                            return visibilityFilter === 'public' ? isPublic : !isPublic;
                        });

                        if (filteredReflections.length === 0) {
                            return (
                                <View style={styles.emptyState}>
                                    <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                                        No {visibilityFilter} reflections found.
                                    </Typography>
                                </View>
                            );
                        }

                        return (
                            <View style={styles.reflectionsList}>
                                {filteredReflections.map((reflection) => {
                                    const isVerse = isVerseReflection(reflection);
                                    const plan = !isVerse && 'plan_id' in reflection ? activePlans.find(p => p.id === (reflection as JournalEntry).plan_id) : null;
                                    const planName = plan ? `${plan.type.charAt(0).toUpperCase() + plan.type.slice(1)} Plan` : null;
                                    const isSelected = selectedReflections.has(reflection.id!);
                                    const isPublic = isReflectionPublic(reflection);

                                    return (
                                        <View key={reflection.id} style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: Spacing.sm }}>
                                            {editMode && (
                                                <TouchableOpacity
                                                    onPress={() => toggleReflectionSelection(reflection.id!)}
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: 14,
                                                        borderWidth: 2,
                                                        borderColor: isSelected ? Colors.gold : Colors.mediumGray,
                                                        backgroundColor: isSelected ? Colors.gold : 'transparent',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        marginRight: 12,
                                                        marginTop: 16,
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <Typography variant="caption" color={Colors.white} style={{ fontSize: 14, fontWeight: 'bold' }}>✓</Typography>
                                                    )}
                                                </TouchableOpacity>
                                            )}

                                            {/* Main card - tap to open thread view (only for public) */}
                                            <TouchableOpacity
                                                style={{ flex: 1 }}
                                                activeOpacity={isPublic ? 0.95 : 1}
                                                onPress={async () => {
                                                    if (editMode) return;

                                                    // Private reflections - no action on tap
                                                    if (!isPublic) return;

                                                    // Build the verse reference for lookup
                                                    const isVerse = 'verse_reference' in reflection;
                                                    const verseRef = isVerse
                                                        ? (reflection as VerseReflection).verse_reference
                                                        : `${(reflection as JournalEntry).book} ${(reflection as JournalEntry).chapter}`;

                                                    // Try to find the public reflection ID
                                                    const publicId = await findPublicReflectionId(verseRef, reflection.reflection || '');

                                                    if (publicId) {
                                                        // Navigate to thread view
                                                        router.push(`/reflection/${publicId}`);
                                                    }
                                                }}
                                            >
                                                <Card style={styles.reflectionCard}>
                                                    <View style={styles.reflectionHeader}>
                                                        <Typography variant="caption" color={Colors.gold}>
                                                            {(() => {
                                                                // Parse as local date to avoid timezone issues
                                                                const [year, month, day] = reflection.date.split('-').map(Number);
                                                                const localDate = new Date(year, month - 1, day);
                                                                return localDate.toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                });
                                                            })()}
                                                        </Typography>
                                                        {/* Verse reference - clickable only for actual scripture */}
                                                        {(() => {
                                                            const refText = isVerse
                                                                ? (reflection as VerseReflection).verse_reference
                                                                : `${(reflection as JournalEntry).book} ${(reflection as JournalEntry).chapter}`;

                                                            // Check if this is a personal reflection (not a scripture reference)
                                                            const isPersonalReflection = refText.includes('Personal Reflection');

                                                            if (isPersonalReflection) {
                                                                // Just show text, not clickable
                                                                return (
                                                                    <Typography variant="caption" color={Colors.gold}>
                                                                        💭 Personal Reflection
                                                                    </Typography>
                                                                );
                                                            }

                                                            // Clickable scripture reference
                                                            return (
                                                                <TouchableOpacity
                                                                    onPress={() => {
                                                                        // Parse scripture reference and navigate to Bible
                                                                        let book: string;
                                                                        let chapter: string;

                                                                        if (isVerse) {
                                                                            const ref = (reflection as VerseReflection).verse_reference;
                                                                            // Handle formats like "1 Corinthians 13:4" or "Matthew 1:5"
                                                                            const parts = ref.split(' ');
                                                                            const lastPart = parts[parts.length - 1];
                                                                            chapter = lastPart.split(':')[0];
                                                                            book = parts.slice(0, -1).join(' ');
                                                                        } else {
                                                                            book = (reflection as JournalEntry).book;
                                                                            chapter = String((reflection as JournalEntry).chapter);
                                                                        }

                                                                        router.push(`/bible?book=${encodeURIComponent(book)}&chapter=${chapter}`);
                                                                    }}
                                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                                >
                                                                    <Typography variant="caption" color={Colors.gold}>
                                                                        {refText}
                                                                    </Typography>
                                                                    <Typography variant="caption" color={Colors.gold} style={{ fontSize: 10 }}>→</Typography>
                                                                </TouchableOpacity>
                                                            );
                                                        })()}
                                                    </View>

                                                    {planName && (
                                                        <View style={{ marginBottom: 8, flexDirection: 'row' }}>
                                                            <View style={{ backgroundColor: 'rgba(0,0,0,0.03)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
                                                                <Typography variant="caption" color={Colors.mediumGray} style={{ fontSize: 10, fontWeight: '600' }}>
                                                                    🏷️ {planName}
                                                                </Typography>
                                                            </View>
                                                        </View>
                                                    )}

                                                    <Typography variant="body" style={styles.reflectionText}>
                                                        {reflection.reflection
                                                            ? reflection.reflection.length > 200
                                                                ? reflection.reflection.substring(0, 200) + '...'
                                                                : reflection.reflection
                                                            : ''}
                                                    </Typography>

                                                    {/* Bottom row: Action hint (for public) + Public/Private Badge */}
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                        {isPublic ? (
                                                            <Typography variant="caption" color={Colors.mediumGray} style={{ fontSize: 10, opacity: 0.6 }}>
                                                                Tap to see replies
                                                            </Typography>
                                                        ) : (
                                                            <View />
                                                        )}
                                                        {/* Public/Private Badge */}
                                                        <View style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            backgroundColor: isPublic ? 'rgba(76, 175, 80, 0.15)' : 'rgba(158, 158, 158, 0.15)',
                                                            paddingHorizontal: 6,
                                                            paddingVertical: 2,
                                                            borderRadius: 10,
                                                        }}>
                                                            <Typography variant="caption" style={{ fontSize: 10 }}>
                                                                {isPublic ? '🌍' : '🔒'}
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                color={isPublic ? '#4CAF50' : Colors.mediumGray}
                                                                style={{ fontSize: 9, marginLeft: 2, fontWeight: '600' }}
                                                            >
                                                                {isPublic ? 'Public' : 'Private'}
                                                            </Typography>
                                                        </View>
                                                    </View>
                                                </Card>
                                            </TouchableOpacity>

                                            {/* Revealed Action Buttons */}
                                            {revealedReflectionId === reflection.id && !editMode && (
                                                <View style={{
                                                    flexDirection: 'column',
                                                    marginLeft: 8,
                                                    gap: 8,
                                                }}>
                                                    {/* Share to Community Button */}
                                                    <TouchableOpacity
                                                        onPress={() => handlePublishReflection(reflection)}
                                                        disabled={publishingId === reflection.id}
                                                        style={{
                                                            backgroundColor: Colors.gold,
                                                            width: 50,
                                                            flex: 1,
                                                            borderRadius: 8,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity: publishingId === reflection.id ? 0.6 : 1,
                                                        }}
                                                    >
                                                        <Typography variant="body" color={Colors.white} style={{ fontSize: 20 }}>
                                                            {publishingId === reflection.id ? '⏳' : '📤'}
                                                        </Typography>
                                                        <Typography variant="caption" color={Colors.white} style={{ fontSize: 9 }}>
                                                            Share
                                                        </Typography>
                                                    </TouchableOpacity>

                                                    {/* Delete Button */}
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            if (isVerse) {
                                                                deleteVerseReflection(reflection.id!).then(() => {
                                                                    setRevealedReflectionId(null);
                                                                    loadData();
                                                                });
                                                            } else {
                                                                handleDeleteEntry(reflection.id!);
                                                            }
                                                        }}
                                                        style={{
                                                            backgroundColor: '#D32F2F',
                                                            width: 50,
                                                            flex: 1,
                                                            borderRadius: 8,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        <Typography variant="body" color={Colors.white} style={{ fontSize: 20 }}>
                                                            🗑️
                                                        </Typography>
                                                        <Typography variant="caption" color={Colors.white} style={{ fontSize: 9 }}>
                                                            Delete
                                                        </Typography>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })()}
                </View>

                {/* Bottom padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Delete Bar - Shows when in edit mode with selections */}
            {
                editMode && selectedReflections.size > 0 && (
                    <View style={styles.floatingDeleteBar}>
                        <TouchableOpacity onPress={selectAllReflections}>
                            <Typography variant="caption" color={Colors.gold} style={{ textDecorationLine: 'underline' }}>
                                Select All ({dailyReflections.length})
                            </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.deleteSelectedButton}
                            onPress={() => setShowDeleteModal(true)}
                        >
                            <Typography variant="body" color={Colors.white}>
                                🗑️ Delete {selectedReflections.size} Selected
                            </Typography>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDeleteModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <TouchableOpacity
                                style={styles.modalCloseX}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray} style={{ fontSize: 20 }}>✕</Typography>
                            </TouchableOpacity>

                            <Typography variant="h3" style={styles.modalTitle}>
                                Delete Reflections?
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray} style={styles.modalMessage}>
                                Are you sure you want to delete {selectedReflections.size} reflection{selectedReflections.size > 1 ? 's' : ''}? This cannot be undone.
                            </Typography>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonKeep}
                                    onPress={() => setShowDeleteModal(false)}
                                >
                                    <Typography variant="body" color={Colors.darkGray}>
                                        Cancel
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalButtonDelete}
                                    onPress={handleBulkDelete}
                                >
                                    <Typography variant="body" color={Colors.white}>
                                        🗑️ Delete
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Toast Notification */}
            {
                toastMessage && (
                    <Animated.View
                        style={[
                            styles.toast,
                            {
                                opacity: toastAnim,
                                transform: [{
                                    translateY: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [50, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <Typography variant="body" color={Colors.white}>{toastMessage}</Typography>
                    </Animated.View>
                )
            }

            <BottomNav />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.xl,
    },
    exportButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.gold,
        borderRadius: 8,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        marginBottom: Spacing.md,
        color: Colors.darkGray,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    divider: {
        height: 2,
        backgroundColor: Colors.lightGray,
        marginVertical: Spacing.xl,
    },
    emptyState: {
        padding: Spacing.xl,
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        alignItems: 'center',
    },
    plansList: {
        gap: Spacing.md,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: Spacing.lg,
        borderRadius: 12,
        marginBottom: 1,
        position: 'relative',
    },
    cancelPlanButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
        zIndex: 10,
    },
    planHeaderContent: {
        flex: 1,
    },
    planTitle: {
        marginBottom: Spacing.xs,
        color: Colors.darkGray,
    },
    planEntriesList: {
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    noEntries: {
        textAlign: 'center',
        fontStyle: 'italic',
        padding: Spacing.md,
    },
    entryCard: {
        backgroundColor: Colors.lightGray,
        padding: Spacing.md,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    entryText: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.darkGray,
    },
    filters: {
        marginBottom: Spacing.lg,
    },
    filterGroup: {
        marginBottom: Spacing.md,
    },
    filterLabel: {
        marginBottom: Spacing.xs,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        flexWrap: 'wrap',
    },
    filterButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        backgroundColor: Colors.white,
    },
    filterButtonActive: {
        backgroundColor: Colors.gold,
        borderColor: Colors.gold,
    },
    reflectionsList: {
        gap: Spacing.md,
    },
    reflectionCard: {
        backgroundColor: Colors.white,
    },
    reflectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    reflectionText: {
        lineHeight: 22,
        color: Colors.darkGray,
    },
    startPlanCTA: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.xl,
        marginBottom: 0,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.gold,
        borderStyle: 'dashed',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    ctaTitle: {
        marginBottom: Spacing.xs,
        color: Colors.darkGray,
        textAlign: 'center',
    },
    ctaSubtitle: {
        textAlign: 'center',
    },
    // Modal styles
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
    floatingDeleteBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 80,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    deleteSelectedButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: 20,
    },
    compactButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gold,
        backgroundColor: 'transparent',
    },
    composeCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    composeInput: {
        fontSize: 16,
        color: Colors.charcoal,
        minHeight: 80,
        textAlignVertical: 'top',
        padding: Spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 8,
        marginBottom: Spacing.sm,
    },
    composeActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    shareToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    saveButton: {
        backgroundColor: Colors.gold,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    toast: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: '#2D5A3D',
        padding: Spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
});
