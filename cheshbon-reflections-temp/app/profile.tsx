import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import { getStreak, getAllActivePlans, type ReadingPlan, getUsername, setUsername, checkUsernameAvailability } from '../services/database';
import { getPublicFeed, toggleLike, toggleRepost, getUserLikedReflections, getUserRepostedReflections, formatRelativeTime, upsertProfile, getUserReplies, getLikedReflectionsFull, type PublicReflection, type UserReplyWithContext } from '../services/feedService';
import { supabase } from '../services/supabase';
import { TOPICS } from '../services/edificationContent';
import { getAllUserHighlights, deleteChapterHighlights, deleteAllHighlights, type VerseHighlight } from '../services/highlightService';

type ProfileTab = 'reflections' | 'replies' | 'likes' | 'highlights';

export default function Profile() {
    const router = useRouter();
    const { user, signOut, refreshUser } = useAuth();
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<ProfileTab>('reflections');
    const [myReflections, setMyReflections] = useState<PublicReflection[]>([]);
    const [myReplies, setMyReplies] = useState<UserReplyWithContext[]>([]);
    const [likedReflections, setLikedReflections] = useState<PublicReflection[]>([]);
    const [userHighlights, setUserHighlights] = useState<VerseHighlight[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [username, setUsernameState] = useState<string | null>(null);
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const handle = username ? `@${username}` : `@${user?.email?.split('@')[0] || 'user'}`;
    const [joinDate, setJoinDate] = useState('');
    const bio = user?.user_metadata?.bio || '📖 Walking with God daily through scripture';
    const location = user?.user_metadata?.location || '';
    const website = user?.user_metadata?.website || '';
    const birthDate = user?.user_metadata?.birth_date || '';
    const avatarUrl = user?.user_metadata?.avatar_url;
    const bannerUrl = user?.user_metadata?.banner_url;

    // Edit Profile State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editWebsite, setEditWebsite] = useState('');
    const [editBirthDate, setEditBirthDate] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [editAvatar, setEditAvatar] = useState<string | null>(null);
    const [editBanner, setEditBanner] = useState<string | null>(null);
    const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
    const [userReposts, setUserReposts] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const editScrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Load user's public reflections, replies, and liked reflections
                const [feed, likes, reposts, replies, likedFull, highlights] = await Promise.all([
                    getPublicFeed(100, 0),
                    getUserLikedReflections(),
                    getUserRepostedReflections(),
                    getUserReplies(),
                    getLikedReflectionsFull(),
                    getAllUserHighlights()
                ]);

                // Filter feed for this user
                const myReflections = feed.filter(r => r.user_id === user.id);
                setMyReflections(myReflections);
                setMyReplies(replies);
                setLikedReflections(likedFull);
                setUserHighlights(highlights);
                setUserLikes(likes);
                setUserReposts(reposts);

                setJoinDate(new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

                // Load username from database
                const currentUsername = await getUsername();
                setUsernameState(currentUsername);
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleOpenEdit() {
        setEditName(displayName);
        setEditBio(bio);
        setEditLocation(location);
        setEditWebsite(website);
        setEditBirthDate(birthDate);
        setEditAvatar(avatarUrl || null);
        setEditBanner(bannerUrl || null);
        setEditUsername(username || '');
        setUsernameError(null);
        setIsEditModalVisible(true);
    }

    async function pickImage(type: 'avatar' | 'banner') {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'avatar' ? [1, 1] : [3, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (type === 'avatar') setEditAvatar(result.assets[0].uri);
            else setEditBanner(result.assets[0].uri);
        }
    }

    async function uploadImage(uri: string, bucket: 'avatars' | 'banners'): Promise<string | null> {
        try {
            // Read file as base64
            // We need to import * as FileSystem from 'expo-file-system';
            // But since I cannot easily add top-level imports in this tool call without replacing the whole file, 
            // I will use fetch to get the blob which usually works, but I'll add more logging.
            // Wait, fetch(uri).blob() IS the standard way. 
            // Let's try to debug WHY it might fail. 
            // If the user says "same thing happened" and NO ALERT appeared, then it means it didn't throw an error?
            // OR maybe it caught the error but the alert didn't show up?
            // Wait, if "same thing happened" means "it seemed to save but no image showed up", 
            // checks lines 139/147: `if (editAvatar && editAvatar !== avatarUrl && !editAvatar.startsWith('http'))`
            // If the state was lost on reload, maybe `editAvatar` was lost? No, we are in the modal.

            // Let's assume the upload is succeeding but returning a URL that is not accessible or valid?
            // or `updateUser` is failing silently?

            // Let's create a more robust upload function using ArrayBuffer
            const response = await fetch(uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
            const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, arrayBuffer, {
                    contentType: contentType,
                    upsert: true
                });

            if (error) {
                console.error('Supabase upload error:', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error(`Error uploading ${bucket}:`, error);
            throw new Error(`Failed to upload ${bucket} image. Please try again.`);
        }
    }

    async function handleSaveProfile() {
        setSaving(true);
        setUploading(true);
        try {
            let newAvatarUrl = avatarUrl;
            let newBannerUrl = bannerUrl;

            // Upload images if changed and not network URLs (meaning they are local URIs)
            if (editAvatar && editAvatar !== avatarUrl && !editAvatar.startsWith('http')) {
                try {
                    const url = await uploadImage(editAvatar, 'avatars');
                    if (url) newAvatarUrl = url;
                } catch (e) {
                    Alert.alert('Upload Failed', 'Could not upload profile picture.');
                    return; // Stop saving if upload fails
                }
            }

            if (editBanner && editBanner !== bannerUrl && !editBanner.startsWith('http')) {
                try {
                    const url = await uploadImage(editBanner, 'banners');
                    if (url) newBannerUrl = url;
                } catch (e) {
                    Alert.alert('Upload Failed', 'Could not upload banner image.');
                    return; // Stop saving
                }
            }

            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: editName,
                    bio: editBio,
                    location: editLocation,
                    website: editWebsite,
                    birth_date: editBirthDate,
                    avatar_url: newAvatarUrl,
                    banner_url: newBannerUrl
                }
            });

            if (error) throw error;

            // Save username if changed
            if (editUsername && editUsername !== username) {
                const result = await setUsername(editUsername);
                if (!result.success) {
                    Alert.alert('Username Error', result.error || 'Failed to set username');
                    return;
                }
                setUsernameState(editUsername);
            }

            // Sync with public profiles table (non-critical - auth metadata is source of truth)
            try {
                await upsertProfile({
                    display_name: editName,
                    bio: editBio,
                    location: editLocation,
                    website: editWebsite,
                    avatar_url: newAvatarUrl || null,
                    banner_url: newBannerUrl || null
                });
            } catch (syncError) {
                console.warn('Failed to sync public profile (non-critical):', syncError);
            }

            await refreshUser(); // Force update of local user state
            setIsEditModalVisible(false);
            // Alert removed as per user request
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
            setUploading(false);
        }
    }

    async function handleSignOut() {
        await signOut();
        router.replace('/login');
    }

    // Pull-to-refresh handler
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.gold}
                        colors={[Colors.gold]}
                    />
                }
            >
                {/* Banner Image */}
                <View style={styles.bannerContainer}>
                    <Image
                        source={bannerUrl ? { uri: bannerUrl } : require('../assets/banner_home.png')}
                        style={styles.banner}
                        resizeMode="cover"
                    />
                    {/* Back Button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Typography variant="h3" color={Colors.white}>←</Typography>
                    </TouchableOpacity>
                    {/* Settings Button */}
                    <TouchableOpacity style={styles.settingsButton} onPress={handleSignOut}>
                        <Typography variant="caption" color={Colors.white}>Sign Out</Typography>
                    </TouchableOpacity>
                    {/* Edit Button in Header (Moved further left) */}
                    <TouchableOpacity style={styles.headerEditButton} onPress={handleOpenEdit}>
                        <Typography variant="caption" color={Colors.white}>Edit</Typography>
                    </TouchableOpacity>
                </View>

                {/* Profile Info Section */}
                <View style={styles.profileSection}>
                    {/* Profile Picture - overlapping banner */}
                    <View style={styles.profilePicContainer}>
                        <View style={styles.profilePic}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                            ) : (
                                <Typography variant="h1" color={Colors.white}>
                                    {displayName[0].toUpperCase()}
                                </Typography>
                            )}
                        </View>
                    </View>

                    {/* Name and Handle */}
                    <Typography variant="h2" color={colors.text} style={styles.displayName}>
                        {displayName}
                    </Typography>
                    <Typography variant="body" color={Colors.mediumGray} style={styles.handle}>
                        {handle}
                    </Typography>

                    {/* Bio */}
                    <Typography variant="body" color={colors.text} style={styles.bio}>
                        {bio}
                    </Typography>

                    {/* Location & Website & Join Date */}
                    <View style={styles.metaRow}>
                        {location ? (
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginRight: 12 }}>
                                📍 {location}
                            </Typography>
                        ) : null}
                        {website ? (
                            <Typography variant="caption" color={Colors.darkGray} style={{ marginRight: 12 }}>
                                🔗 {website}
                            </Typography>
                        ) : null}
                        <Typography variant="caption" color={Colors.mediumGray}>
                            📅 Joined {joinDate}
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
                </View>

                {/* Tab Content */}
                <View style={styles.tabContent}>
                    {activeTab === 'reflections' && (
                        loading ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>Loading...</Typography>
                            </View>
                        ) : myReflections.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No reflections yet</Typography>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                    Share your first reflection from a verse or reading!
                                </Typography>
                            </View>
                        ) : (
                            myReflections.map(reflection => (
                                <View key={reflection.id} style={[styles.reflectionCard, { backgroundColor: isDarkMode ? Colors.charcoal : Colors.white }]}>
                                    {/* Author Header */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm }}>
                                            {avatarUrl ? (
                                                <Image source={{ uri: avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
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

                                    {reflection.verse_reference.includes('Personal Reflection') ? (
                                        // Non-clickable label for Personal Reflections (already includes emoji)
                                        <View>
                                            <Typography variant="caption" color={Colors.gold}>
                                                {reflection.verse_reference}
                                            </Typography>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (reflection.verse_reference.startsWith('Edification:')) {
                                                    // Extract topic title and find matching topic
                                                    const topicTitle = reflection.verse_reference.replace('Edification: ', '');
                                                    const topic = TOPICS.find(t => t.title === topicTitle);
                                                    if (topic) {
                                                        router.push(`/edification/${topic.id}`);
                                                    }
                                                } else {
                                                    // Navigate to Bible for scripture references
                                                    // Parse "Genesis 1", "John 3:16", etc.
                                                    const ref = reflection.verse_reference;
                                                    // Match book name (may include numbers like "1 John") and chapter
                                                    const match = ref.match(/^(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+)/);
                                                    if (match) {
                                                        const book = match[1].trim();
                                                        const chapter = match[2];
                                                        router.push(`/bible?book=${encodeURIComponent(book)}&chapter=${chapter}`);
                                                    } else {
                                                        // Fallback - just go to Bible tab
                                                        router.push('/bible');
                                                    }
                                                }
                                            }}
                                        >
                                            <Typography variant="caption" color={Colors.gold}>
                                                {reflection.verse_reference.startsWith('Edification:') ? '📚' : '📖'} {reflection.verse_reference}
                                            </Typography>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => router.push(`/reflection/${reflection.id}`)}>
                                        <Typography variant="body" color={colors.text} style={{ marginTop: 4 }}>
                                            {reflection.reflection}
                                        </Typography>
                                    </TouchableOpacity>
                                    {/* Actions Row - Full Tweet Style */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, paddingRight: Spacing.lg }}>
                                        {/* Reply */}
                                        <TouchableOpacity onPress={() => router.push(`/reflection/${reflection.id}`)} style={styles.actionButton}>
                                            <Ionicons name="chatbubble-outline" size={18} color={Colors.mediumGray} />
                                        </TouchableOpacity>

                                        {/* Repost */}
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const wasReposted = userReposts.has(reflection.id);
                                                // Optimistic update
                                                const newReposts = new Set(userReposts);
                                                if (wasReposted) newReposts.delete(reflection.id);
                                                else newReposts.add(reflection.id);
                                                setUserReposts(newReposts);
                                                await toggleRepost(reflection.id);
                                            }}
                                            style={styles.actionButton}
                                        >
                                            <EvilIcons name="retweet" size={24} color={userReposts.has(reflection.id) ? '#00BA7C' : Colors.mediumGray} />
                                            <Typography variant="caption" color={userReposts.has(reflection.id) ? '#00BA7C' : Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.repost_count > 0 ? reflection.repost_count : ''}
                                            </Typography>
                                        </TouchableOpacity>

                                        {/* Like */}
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const wasLiked = userLikes.has(reflection.id);
                                                // Optimistic update
                                                const newLikes = new Set(userLikes);
                                                if (wasLiked) newLikes.delete(reflection.id);
                                                else newLikes.add(reflection.id);
                                                setUserLikes(newLikes);
                                                await toggleLike(reflection.id);
                                            }}
                                            style={styles.actionButton}
                                        >
                                            <Ionicons name={userLikes.has(reflection.id) ? "heart" : "heart-outline"} size={18} color={userLikes.has(reflection.id) ? '#F91880' : Colors.mediumGray} />
                                            <Typography variant="caption" color={userLikes.has(reflection.id) ? '#F91880' : Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.likes_count > 0 ? reflection.likes_count : ''}
                                            </Typography>
                                        </TouchableOpacity>

                                        {/* Views */}
                                        <View style={styles.actionButton}>
                                            <Ionicons name="stats-chart" size={16} color={Colors.mediumGray} />
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.views_count > 0 ? reflection.views_count : ''}
                                            </Typography>
                                        </View>

                                        {/* Share */}
                                        <TouchableOpacity onPress={() => { }}>
                                            <Ionicons name="share-outline" size={18} color={Colors.mediumGray} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )
                    )}

                    {activeTab === 'replies' && (
                        loading ? (
                            <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 40 }} />
                        ) : myReplies.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No replies yet</Typography>
                            </View>
                        ) : (
                            myReplies.map((reply) => (
                                <TouchableOpacity
                                    key={reply.id}
                                    onPress={() => reply.parent_reflection && router.push(`/reflection/${reply.parent_reflection.id}`)}
                                    style={{ padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#333' : '#EEE' }}
                                >
                                    {/* Context: Replying to */}
                                    {reply.parent_reflection && (
                                        <View style={{ marginBottom: 8 }}>
                                            <Typography variant="caption" color={Colors.mediumGray}>
                                                Replying to @{reply.parent_reflection.display_name || 'user'}
                                            </Typography>
                                            <Typography variant="caption" color={Colors.gold} style={{ marginTop: 2 }}>
                                                📖 {reply.parent_reflection.verse_reference}
                                            </Typography>
                                        </View>
                                    )}

                                    {/* Reply content */}
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={styles.profilePic}>
                                            {avatarUrl ? (
                                                <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                            ) : (
                                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                                    {displayName[0]?.toUpperCase()}
                                                </Typography>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Typography variant="body" color={colors.text} style={{ fontWeight: 'bold' }}>{displayName}</Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>{handle}</Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>· {formatRelativeTime(reply.created_at)}</Typography>
                                            </View>
                                            <Typography variant="body" color={colors.text} style={{ marginTop: 4 }}>
                                                {reply.reply_text}
                                            </Typography>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )
                    )}

                    {activeTab === 'likes' && (
                        loading ? (
                            <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 40 }} />
                        ) : likedReflections.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No likes yet</Typography>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                    Reflections you like will appear here!
                                </Typography>
                            </View>
                        ) : (
                            likedReflections.map((reflection) => (
                                <View
                                    key={reflection.id}
                                    style={{ padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#333' : '#EEE' }}
                                >
                                    <TouchableOpacity
                                        onPress={() => router.push(`/reflection/${reflection.id}`)}
                                        style={{ flexDirection: 'row', gap: 12 }}
                                    >
                                        {/* Avatar */}
                                        {reflection.avatar_url ? (
                                            <Image source={{ uri: reflection.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                        ) : (
                                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                                    {reflection.display_name?.[0]?.toUpperCase() || '?'}
                                                </Typography>
                                            </View>
                                        )}

                                        {/* Content */}
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Typography variant="body" color={colors.text} style={{ fontWeight: '700' }}>
                                                    {reflection.display_name || 'Anonymous'}
                                                </Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    @{reflection.username || reflection.display_name?.toLowerCase().replace(/\s+/g, '') || 'user'}
                                                </Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    · {formatRelativeTime(reflection.created_at)}
                                                </Typography>
                                            </View>
                                            <Typography variant="caption" color={Colors.gold} style={{ marginTop: 2 }}>
                                                {reflection.verse_reference.includes('Personal Reflection') ? '' : '📖 '}{reflection.verse_reference}
                                            </Typography>
                                            <Typography variant="body" color={colors.text} style={{ marginTop: 4 }}>
                                                {reflection.reflection}
                                            </Typography>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Action row - separate from navigation */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingRight: 32, marginLeft: 52 }}>
                                        <TouchableOpacity
                                            onPress={() => router.push(`/reflection/${reflection.id}`)}
                                            style={styles.actionButton}
                                        >
                                            <Ionicons name="chatbubble-outline" size={16} color={Colors.mediumGray} />
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ fontSize: 12 }}>
                                                {reflection.reply_count > 0 ? reflection.reply_count : ''}
                                            </Typography>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={async () => {
                                                // Unlike and remove from list
                                                await toggleLike(reflection.id);
                                                setLikedReflections(prev => prev.filter(r => r.id !== reflection.id));
                                                // Also update userLikes set
                                                setUserLikes(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete(reflection.id);
                                                    return newSet;
                                                });
                                            }}
                                            style={styles.actionButton}
                                        >
                                            <Ionicons name="heart" size={18} color="#F91880" />
                                            <Typography variant="caption" color="#F91880" style={{ fontSize: 12 }}>
                                                {reflection.likes_count > 0 ? reflection.likes_count : ''}
                                            </Typography>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )
                    )}

                    {activeTab === 'highlights' && (
                        loading ? (
                            <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 40 }} />
                        ) : userHighlights.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Typography variant="body" color={Colors.mediumGray}>No highlights yet</Typography>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                    Highlight verses in the Bible tab to see them here!
                                </Typography>
                            </View>
                        ) : (
                            <>
                                {/* Clear All Button */}
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        paddingBottom: Spacing.sm,
                                        marginBottom: Spacing.sm,
                                    }}
                                    onPress={() => {
                                        Alert.alert(
                                            'Clear All Highlights',
                                            'Are you sure you want to delete all your highlights? This cannot be undone.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete All',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        const success = await deleteAllHighlights();
                                                        if (success) {
                                                            setUserHighlights([]);
                                                        }
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={16} color="#FF4444" />
                                    <Typography variant="caption" color="#FF4444" style={{ marginLeft: 4 }}>
                                        Clear All
                                    </Typography>
                                </TouchableOpacity>

                                {/* Highlight Cards */}
                                {(() => {
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
                                            <View
                                                key={location}
                                                style={[styles.reflectionCard, { backgroundColor: isDarkMode ? Colors.charcoal : Colors.white, flexDirection: 'row', alignItems: 'center' }]}
                                            >
                                                <TouchableOpacity
                                                    style={{ flex: 1 }}
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

                                                {/* Delete Button */}
                                                <TouchableOpacity
                                                    style={{ padding: Spacing.sm }}
                                                    onPress={() => {
                                                        Alert.alert(
                                                            'Delete Highlights',
                                                            `Delete all highlights from ${location}?`,
                                                            [
                                                                { text: 'Cancel', style: 'cancel' },
                                                                {
                                                                    text: 'Delete',
                                                                    style: 'destructive',
                                                                    onPress: async () => {
                                                                        const success = await deleteChapterHighlights(book, chapter);
                                                                        if (success) {
                                                                            setUserHighlights(prev => prev.filter(h => !(h.book === book && h.chapter === chapter)));
                                                                        }
                                                                    }
                                                                }
                                                            ]
                                                        );
                                                    }}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    });
                                })()}
                            </>
                        )
                    )}
                </View>

                {/* Bottom padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, backgroundColor: colors.background }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                >
                    <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
                        <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                            <Typography variant="body" color={colors.text}>Cancel</Typography>
                        </TouchableOpacity>
                        <Typography variant="h3" color={colors.text} style={{ fontWeight: 'bold' }}>Edit profile</Typography>
                        <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
                            {uploading ? (
                                <ActivityIndicator size="small" color={Colors.gold} />
                            ) : (
                                <Typography variant="body" color={colors.text} style={{ fontWeight: 'bold' }}>Save</Typography>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        ref={editScrollViewRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 300 }}
                        keyboardDismissMode="interactive"
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Banner Edit */}
                        <TouchableOpacity onPress={() => pickImage('banner')} style={styles.bannerContainer}>
                            <Image
                                source={editBanner ? { uri: editBanner } : require('../assets/banner_home.png')}
                                style={[styles.banner, { opacity: 0.6 }]}
                                resizeMode="cover"
                            />
                            <View style={styles.cameraOverlay}>
                                <Typography variant="h2" color={Colors.white}>📷</Typography>
                            </View>
                        </TouchableOpacity>

                        {/* Profile Pic Edit */}
                        <View style={[styles.profilePicContainer, { paddingHorizontal: Spacing.lg, marginTop: -40 }]}>
                            <TouchableOpacity onPress={() => pickImage('avatar')} style={[styles.profilePic, { position: 'relative' }]}>
                                {editAvatar ? (
                                    <Image source={{ uri: editAvatar }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                                ) : (
                                    <Typography variant="h1" color={Colors.white}>
                                        {displayName[0].toUpperCase()}
                                    </Typography>
                                )}
                                <View style={[styles.cameraOverlay, { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 40 }]}>
                                    <Typography variant="h3" color={Colors.white}>📷</Typography>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Name</Typography>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                    value={editName}
                                    onChangeText={setEditName}
                                    placeholder="Name"
                                    placeholderTextColor={Colors.mediumGray}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Username</Typography>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Typography variant="body" color={Colors.gold} style={{ marginRight: 4 }}>@</Typography>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderBottomColor: usernameError ? '#FF4444' : colors.border, flex: 1 }]}
                                        value={editUsername}
                                        onChangeText={(text) => {
                                            setEditUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                            setUsernameError(null);
                                        }}
                                        onBlur={async () => {
                                            if (editUsername && editUsername !== username) {
                                                const result = await checkUsernameAvailability(editUsername);
                                                if (!result.available) {
                                                    setUsernameError(result.error || 'Username not available');
                                                }
                                            }
                                        }}
                                        placeholder="your_username"
                                        placeholderTextColor={Colors.mediumGray}
                                        autoCapitalize="none"
                                        maxLength={20}
                                    />
                                </View>
                                {usernameError && (
                                    <Typography variant="caption" color="#FF4444" style={{ marginTop: 4 }}>{usernameError}</Typography>
                                )}
                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>3-20 characters, letters, numbers, underscores</Typography>
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Bio</Typography>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                    value={editBio}
                                    onChangeText={setEditBio}
                                    placeholder="Add a bio to your profile"
                                    placeholderTextColor={Colors.mediumGray}
                                    multiline
                                    onFocus={() => setTimeout(() => editScrollViewRef.current?.scrollTo({ y: 300, animated: true }), 100)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Location</Typography>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                    value={editLocation}
                                    onChangeText={setEditLocation}
                                    placeholder="Location"
                                    placeholderTextColor={Colors.mediumGray}
                                    onFocus={() => setTimeout(() => editScrollViewRef.current?.scrollTo({ y: 350, animated: true }), 100)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Website</Typography>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                    value={editWebsite}
                                    onChangeText={setEditWebsite}
                                    placeholder="Add your website"
                                    placeholderTextColor={Colors.mediumGray}
                                    autoCapitalize="none"
                                    onFocus={() => setTimeout(() => editScrollViewRef.current?.scrollTo({ y: 400, animated: true }), 100)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.mediumGray} style={styles.label}>Birth date</Typography>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                    value={editBirthDate}
                                    onChangeText={setEditBirthDate}
                                    placeholder="Add your birth date"
                                    placeholderTextColor={Colors.mediumGray}
                                    onFocus={() => setTimeout(() => editScrollViewRef.current?.scrollTo({ y: 450, animated: true }), 100)}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

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
        height: 180,
        position: 'relative',
    },
    banner: {
        width: '100%',
        height: '100%',
    },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    headerEditButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 120, // Increased spacing further
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
    editButton: {
        position: 'absolute',
        top: 10,
        right: Spacing.lg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.mediumGray,
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
        // Card styling handled inline for theme colors
    },
    // Modal Styles
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.charcoal,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
    },
    cameraOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    formContainer: {
        padding: Spacing.lg,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
    }
});
