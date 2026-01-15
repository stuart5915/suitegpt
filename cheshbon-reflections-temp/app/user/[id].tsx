import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, Platform } from 'react-native';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography } from '../../components/ui/Typography';
import { BottomNav } from '../../components/ui/BottomNav';
import { Colors, Spacing } from '../../constants/theme';
import { getPublicFeed, getUserLikedReflections, getPublicProfile, getUserRepostedReflections, formatRelativeTime, deletePublicReflection, type PublicReflection, type UserProfile } from '../../services/feedService';
import { supabase } from '../../services/supabase';
import { getUserHighlightsById, type VerseHighlight } from '../../services/highlightService';

type ProfileTab = 'reflections' | 'replies' | 'highlights' | 'likes';

export default function PublicProfile() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth(); // Current logged in user
    const { colors, isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<ProfileTab>('reflections');

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userReflections, setUserReflections] = useState<PublicReflection[]>([]);
    const [userReplies, setUserReplies] = useState<PublicReflection[]>([]);
    const [loading, setLoading] = useState(true);

    // Interaction state for the *viewing* user
    const [viewerLikes, setViewerLikes] = useState<Set<string>>(new Set());

    // Highlights (publicly visible on any profile)
    const [userHighlights, setUserHighlights] = useState<VerseHighlight[]>([]);
    const isOwnProfile = user?.id === id;
    const [viewerReposts, setViewerReposts] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (id) {
            loadProfileData(id as string);
        }
    }, [id]);

    async function loadProfileData(userId: string) {
        setLoading(true);
        try {
            // 1. Fetch Profile Details
            // 2. Fetch User's Reflections
            // 3. Fetch Viewer's Interactions (to show checked states)
            // 4. Fetch Highlights (only for own profile)

            const [profileData, feed, likes, reposts] = await Promise.all([
                getPublicProfile(userId),
                getPublicFeed(100, 0), // Filter later, or optimize API to filter by user_id
                getUserLikedReflections(),
                getUserRepostedReflections()
            ]);

            setProfile(profileData);

            // Filter feed for this user's top-level reflections only
            const usersReflections = feed.filter(r => r.user_id === userId && !r.parent_reflection_id);
            setUserReflections(usersReflections);

            // Fetch replies directly from database for this user
            const { data: repliesData } = await supabase
                .from('public_reflections')
                .select('*')
                .eq('user_id', userId)
                .not('parent_reflection_id', 'is', null)
                .order('created_at', { ascending: false });
            setUserReplies(repliesData || []);

            setViewerLikes(likes);
            setViewerReposts(reposts);

            // Load highlights for this user's profile (publicly visible)
            console.log('[Profile] Loading highlights for userId:', userId);
            const highlights = await getUserHighlightsById(userId);
            console.log('[Profile] Loaded highlights:', highlights.length);
            setUserHighlights(highlights);
        } catch (error) {
            console.error('Error loading public profile:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteReflection(reflectionId: string, isReply: boolean = false) {
        const confirmDelete = () => {
            deletePublicReflection(reflectionId)
                .then(() => {
                    if (isReply) {
                        setUserReplies(prev => prev.filter(r => r.id !== reflectionId));
                    } else {
                        setUserReflections(prev => prev.filter(r => r.id !== reflectionId));
                    }
                })
                .catch(error => {
                    console.error('Error deleting:', error);
                    if (Platform.OS === 'web') {
                        window.alert('Failed to delete');
                    } else {
                        Alert.alert('Error', 'Failed to delete');
                    }
                });
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Delete this post? This cannot be undone.')) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Delete Post',
                'Are you sure you want to delete this? This cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: confirmDelete }
                ]
            );
        }
    }

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.gold} />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                <Typography variant="h3" color={colors.text}>User not found</Typography>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Typography variant="body" color={Colors.gold}>Go Back</Typography>
                </TouchableOpacity>
            </View>
        );
    }

    const displayName = profile.display_name || 'Anonymous';
    const handle = `@${displayName.replace(/\s+/g, '').toLowerCase()}`; // Generate pseudo-handle if not real

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Banner Image */}
                <View style={styles.bannerContainer}>
                    <Image
                        source={profile.banner_url ? { uri: profile.banner_url } : require('../../assets/banner_home.png')}
                        style={styles.banner}
                        resizeMode="cover"
                    />
                    {/* Back Button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Typography variant="h3" color={Colors.white}>←</Typography>
                    </TouchableOpacity>
                </View>

                {/* Profile Info Section */}
                <View style={styles.profileSection}>
                    {/* Profile Picture - overlapping banner */}
                    <View style={styles.profilePicContainer}>
                        <View style={styles.profilePic}>
                            {profile.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                            ) : (
                                <Typography variant="h1" color={Colors.white}>
                                    {displayName[0].toUpperCase()}
                                </Typography>
                            )}
                        </View>
                    </View>

                    {/* Follow Button (Placeholder for now) */}
                    <TouchableOpacity style={styles.followButton}>
                        <Typography variant="caption" color={Colors.white} style={{ fontWeight: 'bold' }}>
                            Follow
                        </Typography>
                    </TouchableOpacity>

                    {/* Name and Handle */}
                    <Typography variant="h2" color={colors.text} style={styles.displayName}>
                        {displayName}
                    </Typography>
                    <Typography variant="body" color={Colors.mediumGray} style={styles.handle}>
                        {handle}
                    </Typography>

                    {/* Bio */}
                    <Typography variant="body" color={colors.text} style={styles.bio}>
                        {profile.bio || 'No bio yet.'}
                    </Typography>

                    {/* Location & Website & Join Date */}
                    <View style={styles.metaRow}>
                        {profile.location ? (
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginRight: 12 }}>
                                📍 {profile.location}
                            </Typography>
                        ) : null}
                        {profile.website ? (
                            <Typography variant="caption" color={Colors.darkGray} style={{ marginRight: 12 }}>
                                🔗 {profile.website}
                            </Typography>
                        ) : null}
                        <Typography variant="caption" color={Colors.mediumGray}>
                            📅 Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </Typography>
                    </View>

                    {/* Following / Followers */}
                    <View style={styles.statsRow}>
                        <TouchableOpacity style={styles.statItem}>
                            <Typography variant="body" color={colors.text} style={{ fontWeight: 'bold' }}>
                                0
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray}> Following</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.statItem, { marginLeft: Spacing.lg }]}>
                            <Typography variant="body" color={colors.text} style={{ fontWeight: 'bold' }}>
                                0
                            </Typography>
                            <Typography variant="body" color={Colors.mediumGray}> Followers</Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'reflections' && styles.tabActive]}
                        onPress={() => setActiveTab('reflections')}
                    >
                        <Typography
                            variant="body"
                            color={activeTab === 'reflections' ? colors.text : Colors.mediumGray}
                            style={{ fontWeight: activeTab === 'reflections' ? '700' : '400' }}
                        >
                            Reflections
                        </Typography>
                        {activeTab === 'reflections' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'replies' && styles.tabActive]}
                        onPress={() => setActiveTab('replies')}
                    >
                        <Typography
                            variant="body"
                            color={activeTab === 'replies' ? colors.text : Colors.mediumGray}
                            style={{ fontWeight: activeTab === 'replies' ? '700' : '400' }}
                        >
                            Replies
                        </Typography>
                        {activeTab === 'replies' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>

                    {/* Highlights Tab - Publicly visible */}
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'highlights' && styles.tabActive]}
                        onPress={() => setActiveTab('highlights')}
                    >
                        <Typography
                            variant="body"
                            color={activeTab === 'highlights' ? colors.text : Colors.mediumGray}
                            style={{ fontWeight: activeTab === 'highlights' ? '700' : '400' }}
                        >
                            Highlights
                        </Typography>
                        {activeTab === 'highlights' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
                        onPress={() => setActiveTab('likes')}
                    >
                        <Typography
                            variant="body"
                            color={activeTab === 'likes' ? colors.text : Colors.mediumGray}
                            style={{ fontWeight: activeTab === 'likes' ? '700' : '400' }}
                        >
                            Likes
                        </Typography>
                        {activeTab === 'likes' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <View style={styles.tabContent}>
                    {activeTab === 'reflections' && (
                        userReflections.filter(r => !r.parent_reflection_id).length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No reflections yet</Typography>
                            </View>
                        ) : (
                            userReflections.map(reflection => (
                                <TouchableOpacity
                                    key={reflection.id}
                                    style={[styles.reflectionCard, { backgroundColor: isDarkMode ? Colors.charcoal : Colors.white }]}
                                    onPress={() => router.push(`/reflection/${reflection.id}`)}
                                    activeOpacity={0.7}
                                >
                                    {/* Author Header */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm }}>
                                            {profile.avatar_url ? (
                                                <Image source={{ uri: profile.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                            ) : (
                                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                                    {displayName[0].toUpperCase()}
                                                </Typography>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" color={colors.text} style={{ fontWeight: '600' }}>{displayName}</Typography>
                                            <Typography variant="caption" color={Colors.mediumGray}>{formatRelativeTime(reflection.created_at)}</Typography>
                                        </View>
                                    </View>

                                    <Typography variant="caption" color={Colors.gold}>{reflection.verse_reference}</Typography>
                                    <Typography variant="body" color={colors.text} style={{ marginTop: 4 }}>
                                        {reflection.reflection}
                                    </Typography>
                                    {/* Actions Row */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, paddingRight: Spacing.lg }}>
                                        <View style={styles.actionButton}>
                                            <Ionicons name="chatbubble-outline" size={18} color={Colors.mediumGray} />
                                        </View>

                                        <View style={styles.actionButton}>
                                            <EvilIcons name="retweet" size={24} color={viewerReposts.has(reflection.id) ? '#00BA7C' : Colors.mediumGray} />
                                            <Typography variant="caption" color={viewerReposts.has(reflection.id) ? '#00BA7C' : Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.repost_count > 0 ? reflection.repost_count : ''}
                                            </Typography>
                                        </View>

                                        <View style={styles.actionButton}>
                                            <Ionicons name={viewerLikes.has(reflection.id) ? "heart" : "heart-outline"} size={18} color={viewerLikes.has(reflection.id) ? '#F91880' : Colors.mediumGray} />
                                            <Typography variant="caption" color={viewerLikes.has(reflection.id) ? '#F91880' : Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.likes_count > 0 ? reflection.likes_count : ''}
                                            </Typography>
                                        </View>

                                        <View style={styles.actionButton}>
                                            <Ionicons name="stats-chart" size={16} color={Colors.mediumGray} />
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.views_count > 0 ? reflection.views_count : ''}
                                            </Typography>
                                        </View>

                                        {/* Delete button - only show on own profile */}
                                        {isOwnProfile && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteReflection(reflection.id);
                                                }}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )
                    )}

                    {activeTab === 'replies' && (
                        userReplies.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No replies yet</Typography>
                            </View>
                        ) : (
                            userReplies.map(reply => (
                                <TouchableOpacity
                                    key={reply.id}
                                    style={[styles.reflectionCard, { backgroundColor: isDarkMode ? Colors.charcoal : Colors.white }]}
                                    onPress={() => router.push(`/reflection/${reply.parent_reflection_id}`)}
                                    activeOpacity={0.7}
                                >
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 4 }}>
                                        Replying to {reply.parent_display_name || 'someone'}
                                    </Typography>
                                    <Typography variant="body" color={colors.text}>
                                        {reply.reflection}
                                    </Typography>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm }}>
                                        <Typography variant="caption" color={Colors.mediumGray}>
                                            {formatRelativeTime(reply.created_at)}
                                        </Typography>
                                        {/* Delete button - only show on own profile */}
                                        {isOwnProfile && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteReflection(reply.id, true);
                                                }}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )
                    )}

                    {activeTab === 'highlights' && (
                        userHighlights.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No highlights yet</Typography>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                    Select verses in the Bible tab to highlight them
                                </Typography>
                            </View>
                        ) : (
                            (() => {
                                // Group highlights by book + chapter
                                const grouped = userHighlights.reduce((acc, h) => {
                                    const key = `${h.book} ${h.chapter}`;
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(h);
                                    return acc;
                                }, {} as Record<string, typeof userHighlights>);

                                return Object.entries(grouped).map(([location, highlights]) => {
                                    const [book, chapter] = [highlights[0].book, highlights[0].chapter];
                                    const verses = highlights.map(h => h.verse).sort((a, b) => a - b);
                                    const verseText = verses.length > 3
                                        ? `v${verses[0]}-${verses[verses.length - 1]}`
                                        : verses.map(v => `v${v}`).join(', ');

                                    return (
                                        <TouchableOpacity
                                            key={location}
                                            style={[styles.reflectionCard, { backgroundColor: isDarkMode ? Colors.charcoal : Colors.white }]}
                                            onPress={() => router.push(`/bible?book=${encodeURIComponent(book)}&chapter=${chapter}`)}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: highlights[0].color || Colors.gold,
                                                }} />
                                                <Typography variant="body" color={colors.text} style={{ fontWeight: '600' }}>
                                                    {location}
                                                </Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    {verseText}
                                                </Typography>
                                            </View>
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4, marginLeft: 16 }}>
                                                {highlights.length} verse{highlights.length > 1 ? 's' : ''} highlighted
                                            </Typography>
                                        </TouchableOpacity>
                                    );
                                });
                            })()
                        )
                    )}

                    {activeTab === 'likes' && (
                        <View style={styles.emptyState}>
                            <Typography variant="body" color={Colors.mediumGray}>
                                Likes are private
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                Only you can see what you've liked
                            </Typography>
                        </View>
                    )}
                </View>

                {/* Bottom padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomNav />
        </View>
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
    bannerContainer: {
        height: 150,
        position: 'relative',
    },
    banner: {
        width: '100%',
        height: '100%',
    },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileSection: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    profilePicContainer: {
        marginTop: -40,
        marginBottom: Spacing.sm,
    },
    profilePic: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.gold,
        borderWidth: 4,
        borderColor: Colors.cream,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followButton: {
        position: 'absolute',
        top: 10,
        right: Spacing.lg,
        backgroundColor: Colors.charcoal,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    displayName: {
        fontWeight: 'bold',
    },
    handle: {
        marginTop: 2,
    },
    bio: {
        marginTop: Spacing.sm,
        lineHeight: 22,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: Spacing.md,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        position: 'relative',
    },
    tabActive: {},
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        width: 60,
        backgroundColor: Colors.gold,
        borderRadius: 2,
    },
    tabContent: {
        padding: Spacing.lg,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    reflectionCard: {
        borderRadius: 12,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
});
