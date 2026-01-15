import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Share, ActivityIndicator, Alert, Platform, Modal, Image } from 'react-native';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing, FontFamilies } from '../constants/theme';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllActivePlans, saveVerseReflection, getStreak, deletePlan, type ReadingPlan } from '../services/database';
import { supabase } from '../services/supabase';
import { getTodaysVerse, refreshTodaysVerse, type DailyVerse } from '../services/verseOfDayService';
import { getPublicFeed, publishReflection, toggleLike, toggleRepost, getUserLikedReflections, getUserRepostedReflections, formatRelativeTime, deletePublicReflection, type PublicReflection } from '../services/feedService';
import { TOPICS } from '../services/edificationContent';
import { ReflectionCard } from '../components/ReflectionCard';
import { ComposeModal } from '../components/ComposeModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);

    // Core state
    const [activePlans, setActivePlans] = useState<ReadingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentStreak, setCurrentStreak] = useState(0);

    // Verse of the Day
    const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);

    // Derived state for UI consistency
    const avatarUrl = user?.user_metadata?.avatar_url;
    const [verseLoading, setVerseLoading] = useState(true);
    const [verseExpanded, setVerseExpanded] = useState(false);
    const [showReflectionInput, setShowReflectionInput] = useState(false);
    const [verseReflection, setVerseReflection] = useState('');
    const [saving, setSaving] = useState(false);
    const [sharePublicly, setSharePublicly] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);

    // Community Feed
    const [feedReflections, setFeedReflections] = useState<PublicReflection[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
    const [userReposts, setUserReposts] = useState<Set<string>>(new Set());
    const [loadingMore, setLoadingMore] = useState(false);
    const [includeReplies, setIncludeReplies] = useState(true); // Toggle for showing replies

    // Plan modal
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [planToCancel, setPlanToCancel] = useState<{ id: string; type: string } | null>(null);

    // Reflection menu dropdown
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

    // Feed tab state (removed)

    // Compose modal
    const [showComposeModal, setShowComposeModal] = useState(false);

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        loadData();
    }, []);

    // Reload feed when toggle changes
    useEffect(() => {
        loadCommunityFeed();
    }, [includeReplies]);

    // Refresh feed when returning to this screen
    useFocusEffect(
        useCallback(() => {
            loadCommunityFeed();
        }, [includeReplies])
    );

    async function loadData() {
        await Promise.all([
            loadActivePlans(),
            calculateStreak(),
            loadTodaysVerse(),
            loadCommunityFeed()
        ]);
    }

    async function calculateStreak() {
        try {
            const streak = await getStreak();
            setCurrentStreak(streak);
        } catch (error) {
            console.error('Error getting streak:', error);
        }
    }

    async function loadActivePlans() {
        try {
            const cachedPlans = await AsyncStorage.getItem('cached_active_plans');
            if (cachedPlans) {
                setActivePlans(JSON.parse(cachedPlans));
            }
            const plans = await getAllActivePlans();
            setActivePlans(plans);
            await AsyncStorage.setItem('cached_active_plans', JSON.stringify(plans));
        } catch (error) {
            console.error('Error loading plans:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadTodaysVerse() {
        try {
            setVerseLoading(true);
            const verse = await getTodaysVerse();
            setDailyVerse(verse);
        } catch (error) {
            console.error('Error loading verse:', error);
        } finally {
            setVerseLoading(false);
        }
    }

    async function loadCommunityFeed() {
        try {
            setFeedLoading(true);
            const [feed, likes, reposts] = await Promise.all([
                getPublicFeed(10, 0, includeReplies),
                getUserLikedReflections(),
                getUserRepostedReflections()
            ]);
            setFeedReflections(feed);
            setUserLikes(likes);
            setUserReposts(reposts);
        } catch (error) {
            console.error('Error loading community feed:', error);
        } finally {
            setFeedLoading(false);
        }
    }

    async function loadMoreFeed() {
        if (loadingMore) return;
        try {
            -
                setLoadingMore(true);
            const moreFeed = await getPublicFeed(10, feedReflections.length, includeReplies);
            setFeedReflections(prev => [...prev, ...moreFeed]);
        } catch (error) {
            console.error('Error loading more:', error);
        } finally {
            setLoadingMore(false);
        }
    }

    async function handleLike(reflectionId: string) {
        const wasLiked = userLikes.has(reflectionId);
        // Optimistic update
        setUserLikes(prev => {
            const newSet = new Set(prev);
            wasLiked ? newSet.delete(reflectionId) : newSet.add(reflectionId);
            return newSet;
        });
        setFeedReflections(prev => prev.map(r =>
            r.id === reflectionId ? { ...r, likes_count: r.likes_count + (wasLiked ? -1 : 1) } : r
        ));
        await toggleLike(reflectionId);
    }

    async function handleRepost(reflectionId: string) {
        const wasReposted = userReposts.has(reflectionId);
        // Optimistic update
        setUserReposts(prev => {
            const newSet = new Set(prev);
            wasReposted ? newSet.delete(reflectionId) : newSet.add(reflectionId);
            return newSet;
        });
        setFeedReflections(prev => prev.map(r =>
            r.id === reflectionId ? { ...r, repost_count: r.repost_count + (wasReposted ? -1 : 1) } : r
        ));
        try {
            await toggleRepost(reflectionId);
        } catch (error) {
            console.error('Error toggling repost:', error);
            // Revert on error
            setUserReposts(prev => {
                const newSet = new Set(prev);
                wasReposted ? newSet.add(reflectionId) : newSet.delete(reflectionId);
                return newSet;
            });
            setFeedReflections(prev => prev.map(r =>
                r.id === reflectionId ? { ...r, repost_count: r.repost_count + (wasReposted ? 1 : -1) } : r
            ));
        }
    }

    async function handleDeleteReflection(reflectionId: string) {
        setMenuOpenFor(null);
        try {
            await deletePublicReflection(reflectionId);
            setFeedReflections(prev => prev.filter(r => r.id !== reflectionId));
        } catch (error) {
            console.error('Error deleting reflection:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to delete reflection');
            } else {
                Alert.alert('Error', 'Failed to delete reflection');
            }
        }
    }

    async function handleSaveReflection() {
        if (!verseReflection.trim() || !dailyVerse) return;
        setSaving(true);
        try {
            // Save to only ONE location to avoid duplicates
            if (sharePublicly) {
                // Public only - goes to community feed
                await publishReflection(dailyVerse.verse_reference, dailyVerse.verse_text, verseReflection.trim());
                loadCommunityFeed();
            } else {
                // Private only - goes to personal journal
                await saveVerseReflection(today, dailyVerse.verse_reference, dailyVerse.verse_text, verseReflection.trim());
            }
            setVerseReflection('');
            setSharePublicly(false);
            setShowReflectionInput(false);
            setShowSavedToast(true);
            setTimeout(() => setShowSavedToast(false), 3000);
        } catch (error) {
            console.error('Error saving reflection:', error);
            Alert.alert('Error', 'Failed to save reflection');
        } finally {
            setSaving(false);
        }
    }

    function handleShare() {
        if (!dailyVerse) return;
        Share.share({
            message: `"${dailyVerse.verse_text}"\n\n— ${dailyVerse.verse_reference}`,
        });
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
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    await supabase.from('journal_entries').update({ plan_id: null }).eq('plan_id', planToCancel.id).eq('user_id', authUser.id);
                    await supabase.from('reading_plans').delete().eq('id', planToCancel.id).eq('user_id', authUser.id);
                }
            }
            loadActivePlans();
        } catch (error) {
            console.error('Error cancelling plan:', error);
        } finally {
            setShowCancelModal(false);
            setPlanToCancel(null);
        }
    }

    function handleProfilePress() {
        router.push('/profile');
    }

    return (
        <View style={styles.container}>
            {/* Cancel Plan Modal */}
            <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCancelModal(false)}>
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <Typography variant="h3" style={{ marginBottom: Spacing.md }}>Cancel Plan?</Typography>
                            <Typography variant="body" color={Colors.mediumGray} style={{ marginBottom: Spacing.lg }}>
                                Are you sure you want to cancel your {planToCancel?.type} plan?
                            </Typography>
                            <View style={{ gap: Spacing.sm }}>
                                <TouchableOpacity style={styles.modalButtonKeep} onPress={() => confirmCancelPlan(false)}>
                                    <Typography variant="body" color={Colors.darkGray}>Cancel Plan Only</Typography>
                                    <Typography variant="caption" color={Colors.mediumGray}>Keep reflections</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalButtonDelete} onPress={() => confirmCancelPlan(true)}>
                                    <Typography variant="body" color={Colors.white}>Delete Everything</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowCancelModal(false)} style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
                                    <Typography variant="body" color={Colors.gold}>Never mind</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* X-Style Fixed Header with Banner Background */}
            <View style={styles.xHeader}>
                {/* Banner Background Image */}
                <Image
                    source={require('../assets/banner_home.png')}
                    style={styles.headerBanner}
                    resizeMode="cover"
                />

                {/* Top Row: Profile | App Name */}
                <View style={styles.xHeaderTop}>
                    <TouchableOpacity onPress={handleProfilePress} style={styles.xProfileButton}>
                        <View style={styles.xProfileIcon}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            ) : (
                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 18 }}>
                                    {(firstName || 'T')[0].toUpperCase()}
                                </Typography>
                            )}
                        </View>
                    </TouchableOpacity>
                    <Typography variant="h2" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 26, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                        Cheshbon
                    </Typography>
                    <View style={{ width: 44 }} />
                </View>
            </View>

            <ScrollView ref={scrollViewRef} style={[styles.scrollView, { marginTop: 140 }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">

                {/* Welcome & Streak */}
                <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
                    <Typography variant="h2" color={Colors.darkGray}>Welcome{firstName ? `, ${firstName}` : ''}</Typography>
                    {currentStreak > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Typography variant="caption" color={Colors.gold}>🔥 {currentStreak} day streak</Typography>
                        </View>
                    )}
                </View>

                {/* Collapsible Verse of the Day */}
                {dailyVerse && (
                    <View style={[styles.verseCollapsible, { marginHorizontal: Spacing.lg }]}>
                        {/* Tappable Header Row - only this toggles collapse */}
                        <TouchableOpacity onPress={() => setVerseExpanded(!verseExpanded)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Typography variant="caption" color={Colors.gold} style={{ fontSize: 10 }}>VERSE OF THE DAY</Typography>
                                <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600', fontSize: 13 }}>{dailyVerse.verse_reference}</Typography>
                            </View>
                            <Typography variant="body" color={Colors.gold}>{verseExpanded ? '▲' : '▼'}</Typography>
                        </TouchableOpacity>

                        {verseExpanded && (
                            <View style={{ marginTop: Spacing.sm }}>
                                <Typography variant="body" color={Colors.charcoal} style={{ fontSize: 15, lineHeight: 22, fontStyle: 'italic' }}>"{dailyVerse.verse_text}"</Typography>

                                {/* Quick Actions */}
                                <View style={{ flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.md }}>
                                    <TouchableOpacity onPress={() => setShowReflectionInput(true)}>
                                        <Typography variant="caption" color={Colors.gold}>✏️ Reflect</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        const parts = dailyVerse.verse_reference.split(' ');
                                        let book = parts[0];
                                        let chapterVerse = parts[parts.length - 1];
                                        if (parts.length > 2) book = parts.slice(0, -1).join(' ');
                                        const chapter = chapterVerse.split(':')[0];
                                        router.push({ pathname: '/bible', params: { book, chapter } });
                                    }}>
                                        <Typography variant="caption" color={Colors.gold}>📖 Read</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleShare}>
                                        <Typography variant="caption" color={Colors.gold}>📤 Share</Typography>
                                    </TouchableOpacity>
                                </View>

                                {/* Reflection Input */}
                                {showReflectionInput && (
                                    <View style={{ marginTop: Spacing.sm }}>
                                        <TextInput
                                            style={styles.reflectionInput}
                                            placeholder="Write your reflection..."
                                            placeholderTextColor={Colors.mediumGray}
                                            multiline
                                            value={verseReflection}
                                            onChangeText={setVerseReflection}
                                            autoFocus
                                        />
                                        <TouchableOpacity onPress={() => setSharePublicly(!sharePublicly)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                            <View style={[styles.toggle, sharePublicly && styles.toggleOn]}>
                                                <View style={[styles.toggleThumb, sharePublicly && styles.toggleThumbOn]} />
                                            </View>
                                            <Typography variant="caption" color={Colors.charcoal} style={{ fontSize: 11 }}>Share to Community</Typography>
                                        </TouchableOpacity>
                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                            <TouchableOpacity onPress={() => setShowReflectionInput(false)}>
                                                <Typography variant="caption" color={Colors.mediumGray}>Cancel</Typography>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={handleSaveReflection} style={styles.saveButton}>
                                                <Typography variant="caption" color="#FFF" style={{ fontWeight: '600' }}>
                                                    {saving ? '...' : (sharePublicly ? 'Share' : 'Save')}
                                                </Typography>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Saved Toast */}
                {showSavedToast && (
                    <View style={styles.toast}>
                        <Typography variant="body" color="#FFF">✓ Saved to </Typography>
                        <TouchableOpacity onPress={() => { setShowSavedToast(false); router.push('/journal'); }}>
                            <Typography variant="body" color="#FFF" style={{ fontWeight: 'bold', textDecorationLine: 'underline' }}>Journal</Typography>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Community Reflections Feed - THE MAIN CONTENT */}
                <View style={{ marginTop: Spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                        <Typography variant="h3" color={Colors.darkGray}>Community Reflections</Typography>
                        <TouchableOpacity onPress={loadCommunityFeed}>
                            <Typography variant="caption" color={Colors.gold}>Refresh</Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Feed Filter Toggle */}
                    <View style={{ flexDirection: 'row', marginBottom: Spacing.sm, gap: Spacing.sm }}>
                        <TouchableOpacity
                            onPress={() => setIncludeReplies(true)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: includeReplies ? Colors.gold : 'transparent',
                                borderWidth: 1,
                                borderColor: Colors.gold
                            }}
                        >
                            <Typography variant="caption" color={includeReplies ? Colors.white : Colors.gold}>All</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIncludeReplies(false)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: !includeReplies ? Colors.gold : 'transparent',
                                borderWidth: 1,
                                borderColor: Colors.gold
                            }}
                        >
                            <Typography variant="caption" color={!includeReplies ? Colors.white : Colors.gold}>Original Only</Typography>
                        </TouchableOpacity>
                    </View>

                    {feedLoading ? (
                        <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={Colors.gold} />
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 8 }}>Loading community feed...</Typography>
                        </View>
                    ) : feedReflections.length === 0 ? (
                        <View style={styles.emptyFeed}>
                            <Typography variant="body" color={Colors.charcoal}>No reflections yet</Typography>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ textAlign: 'center', marginTop: 4 }}>
                                Be the first to share! Expand the verse above and toggle "Share to Community".
                            </Typography>
                        </View>
                    ) : (
                        <>
                            {feedReflections.map((reflection) => (
                                <ReflectionCard
                                    key={reflection.id}
                                    reflection={reflection}
                                    currentUser={user}
                                    userAvatarUrl={avatarUrl}
                                    initialLiked={userLikes.has(reflection.id)}
                                    initialReposted={userReposts.has(reflection.id)}
                                    onDelete={loadCommunityFeed}
                                />
                            ))}

                            {/* Load More */}
                            {feedReflections.length >= 10 && (
                                <TouchableOpacity onPress={loadMoreFeed} disabled={loadingMore} style={styles.loadMoreButton}>
                                    <Typography variant="caption" color={Colors.gold}>
                                        {loadingMore ? 'Loading...' : 'Load More'}
                                    </Typography>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>



                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowComposeModal(true)}
                activeOpacity={0.85}
            >
                <Ionicons name="add" size={28} color={Colors.white} />
            </TouchableOpacity>

            {/* Compose Modal */}
            <ComposeModal
                visible={showComposeModal}
                onClose={() => setShowComposeModal(false)}
                onSuccess={() => loadCommunityFeed()}
                userDisplayName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                userAvatarUrl={user?.user_metadata?.avatar_url}
            />

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.cream },
    scrollView: { flex: 1 },
    content: { padding: Spacing.lg, paddingTop: Spacing.sm },
    banner: { width: '120%', height: Platform.OS === 'ios' ? 190 : 160, marginHorizontal: -Spacing.lg, marginTop: Platform.OS === 'ios' ? -Spacing.lg - 50 : -Spacing.lg, alignSelf: 'center', marginBottom: Spacing.md },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    profileButton: { padding: 4 },
    profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brown, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.gold },
    verseCollapsible: { marginTop: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.03)', padding: Spacing.sm, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: Colors.gold },
    reflectionInput: { backgroundColor: '#FFF', borderRadius: 8, padding: Spacing.sm, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
    toggle: { width: 36, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)', padding: 2, justifyContent: 'center' },
    toggleOn: { backgroundColor: Colors.gold },
    toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', alignSelf: 'flex-start' },
    toggleThumbOn: { alignSelf: 'flex-end' },
    saveButton: { backgroundColor: Colors.charcoal, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    toast: { backgroundColor: '#2D5A3D', padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    emptyFeed: { backgroundColor: Colors.white, padding: Spacing.xl, borderRadius: 12, alignItems: 'center' },
    feedCard: { backgroundColor: Colors.white, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
    loadMoreButton: { padding: Spacing.md, alignItems: 'center' },
    planCard: { backgroundColor: Colors.white, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
    resumeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: Colors.gold },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
    modalContent: { backgroundColor: Colors.white, borderRadius: 16, padding: Spacing.xl, width: '100%', maxWidth: 340 },
    modalButtonKeep: { backgroundColor: '#F5F5F5', padding: Spacing.md, borderRadius: 8, alignItems: 'center' },
    modalButtonDelete: { backgroundColor: '#D32F2F', padding: Spacing.md, borderRadius: 8, alignItems: 'center' },
    // X-Style Header Styles
    xHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 140, // Fixed height for prominent banner
        backgroundColor: 'transparent',
        zIndex: 100,
        overflow: 'hidden',
    },
    headerBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
    },
    xHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: Platform.OS === 'ios' ? 60 : 50, // Safe area at top
        paddingBottom: Spacing.md,
    },
    xProfileButton: { padding: 4 },
    xProfileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center'
    },
    xTabRow: {
        flexDirection: 'row',
        borderBottomWidth: 0,
    },
    xTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        position: 'relative',
    },
    xTabActive: {},
    xTabIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        width: 50,
        backgroundColor: Colors.gold,
        borderRadius: 2,
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});
