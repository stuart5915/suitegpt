import { View, ScrollView, StyleSheet, Platform, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Share, Pressable, Keyboard } from 'react-native';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography } from '../../components/ui/Typography';
import { Colors, Spacing } from '../../constants/theme';
import { getReflectionDetails, getReplies, postReply, toggleLike, toggleRepost, incrementView, getUserLikedReflections, getUserRepostedReflections, formatRelativeTime, toggleReplyLike, getUserLikedReplies, postReplyToReply, type PublicReflection, type ReflectionReply } from '../../services/feedService';
import { TOPICS } from '../../services/edificationContent';
import { ReplyComposeModal } from '../../components/ReplyComposeModal';

export default function ReflectionThread() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const { colors, isDarkMode } = useTheme();

    const [reflection, setReflection] = useState<PublicReflection | null>(null);
    const [replies, setReplies] = useState<PublicReflection[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isReposted, setIsReposted] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [repostCount, setRepostCount] = useState(0);
    const replyInputRef = useRef<TextInput>(null);
    const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
    const [replyToReply, setReplyToReply] = useState<PublicReflection | null>(null);
    const [showReplyModal, setShowReplyModal] = useState(false);

    const reflectionId = Array.isArray(id) ? id[0] : id;

    useEffect(() => {
        if (reflectionId) {
            loadData();
        }
    }, [reflectionId]);

    async function loadData() {
        setLoading(true);
        try {
            const [refData, repliesData, userLikes, userReposts] = await Promise.all([
                getReflectionDetails(reflectionId),
                getReplies(reflectionId),
                getUserLikedReflections(),
                getUserRepostedReflections()
            ]);

            if (refData) {
                setReflection(refData);
                setLikeCount(refData.likes_count);
                setRepostCount(refData.repost_count);
                setIsLiked(userLikes.has(refData.id));
                setIsReposted(userReposts.has(refData.id));
                incrementView(refData.id); // Valid view
            }
            setReplies(repliesData);

            // Get user's liked replies
            const likedReplyIds = await getUserLikedReplies();
            setLikedReplies(likedReplyIds);
        } catch (error) {
            console.error('Error loading thread:', error);
        } finally {
            setLoading(false);
            // Auto-focus the reply input after loading is complete
            setTimeout(() => {
                replyInputRef.current?.focus();
            }, 300);
        }
    }

    async function handleLike() {
        if (!reflection) return;
        const newLikedState = !isLiked;
        setIsLiked(newLikedState);
        setLikeCount(prev => prev + (newLikedState ? 1 : -1));
        try {
            await toggleLike(reflection.id);
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert on error
            setIsLiked(!newLikedState);
            setLikeCount(prev => prev + (!newLikedState ? 1 : -1));
        }
    }

    async function handleRepost() {
        if (!reflection) return;
        const newRepostedState = !isReposted;
        setIsReposted(newRepostedState);
        setRepostCount(prev => prev + (newRepostedState ? 1 : -1));
        try {
            await toggleRepost(reflection.id);
        } catch (error) {
            console.error('Error toggling repost:', error);
            // Revert on error
            setIsReposted(!newRepostedState);
            setRepostCount(prev => prev + (!newRepostedState ? 1 : -1));
        }
    }

    async function handleSendReply() {
        if (!replyText.trim() || !reflectionId) return;
        setSending(true);
        try {
            let newReply;
            if (replyToReply) {
                // Nested reply
                newReply = await postReplyToReply(reflectionId, replyToReply.id, replyText.trim());
            } else {
                // Regular reply
                newReply = await postReply(reflectionId, replyText.trim());
            }
            if (newReply) {
                setReplies(prev => [...prev, newReply as PublicReflection]);
                setReplyText('');
                setReplyToReply(null);
                Keyboard.dismiss();

                // Optimistically update the parent's reply count
                if (!replyToReply && reflection) {
                    setReflection(prev => prev ? { ...prev, reply_count: (prev.reply_count || 0) + 1 } : prev);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to send reply');
        } finally {
            setSending(false);
        }
    }

    // Helper to handle navigation references
    function handleVersePress(ref: string) {
        if (ref.startsWith('Edification:')) {
            const topicTitle = ref.replace('Edification:', '').trim();
            const topic = TOPICS.find(t => t.title === topicTitle);
            if (topic) {
                router.push(`/edification/${topic.id}`);
            } else {
                router.push(`/edification/${topicTitle.toLowerCase().replace(/\s+/g, '-')}`);
            }
        } else {
            const parts = ref.split(' ');
            let book = parts[0];
            let chapterVerse = parts[parts.length - 1];
            if (parts.length > 2) book = parts.slice(0, -1).join(' ');
            const chapter = chapterVerse.split(':')[0];
            router.push({ pathname: '/bible', params: { book, chapter } });
        }
    }

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color={Colors.gold} />
            </View>
        );
    }

    if (!reflection) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Typography variant="body" color={Colors.mediumGray}>Reflection not found</Typography>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Typography variant="body" color={Colors.gold}>Go Back</Typography>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)' }]}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <Typography variant="h3" color={colors.text}>←</Typography>
                    </TouchableOpacity>
                    <Typography variant="h3" color={colors.text} style={{ fontWeight: 'bold' }}>Reflection</Typography>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Main Reflection Card */}
                    <View style={styles.mainCard}>
                        {/* Author Info - Clickable */}
                        <TouchableOpacity
                            onPress={() => router.push(user?.id === reflection.user_id ? '/profile' : `/user/${reflection.user_id}`)}
                            style={styles.authorRow}
                        >
                            <View style={styles.avatar}>
                                {reflection.avatar_url ? (
                                    <Image source={{ uri: reflection.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                                ) : (
                                    <Typography variant="h3" color={Colors.white}>
                                        {(reflection.display_name?.[0] || '?').toUpperCase()}
                                    </Typography>
                                )}
                            </View>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Typography variant="h3" color={colors.text} style={{ fontWeight: 'bold' }}>
                                        {reflection.display_name || 'Anonymous'}
                                    </Typography>
                                    {reflection.username && (
                                        <Typography variant="body" color={Colors.mediumGray} style={{ marginLeft: 6 }}>
                                            @{reflection.username}
                                        </Typography>
                                    )}
                                </View>
                                <Typography variant="caption" color={Colors.mediumGray}>
                                    {new Date(reflection.created_at).toLocaleString()}
                                </Typography>
                            </View>
                        </TouchableOpacity>

                        {/* Content */}
                        <Typography variant="body" color={colors.text} style={{ fontSize: 18, lineHeight: 28, marginVertical: Spacing.md }}>
                            {reflection.reflection}
                        </Typography>

                        {/* Verse Context - Only clickable for Bible/Edification references */}
                        {reflection.verse_reference?.includes('Personal Reflection') ? (
                            // Non-clickable label for Personal Reflection - navigates to journal
                            <TouchableOpacity onPress={() => router.push('/journal')} style={{ marginTop: Spacing.sm }}>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ fontStyle: 'italic' }}>
                                    💭 Personal Reflection
                                </Typography>
                            </TouchableOpacity>
                        ) : (
                            // Clickable for Bible/Edification references
                            <TouchableOpacity
                                onPress={() => handleVersePress(reflection.verse_reference)}
                                style={styles.verseContext}
                            >
                                <View style={{ width: 4, backgroundColor: Colors.gold, borderRadius: 2 }} />
                                <View style={{ paddingLeft: Spacing.md }}>
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ fontWeight: 'bold' }}>
                                        {reflection.verse_reference}
                                    </Typography>
                                    <Typography variant="caption" color={Colors.mediumGray} numberOfLines={2}>
                                        {reflection.verse_text}
                                    </Typography>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Actions Row - Full width with labels */}
                        <View style={[styles.actionRow, { borderBottomColor: isDarkMode ? '#333' : '#EEE', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.sm }]}>

                            {/* Reply */}
                            <TouchableOpacity
                                onPress={() => replyInputRef.current?.focus()}
                                style={{ alignItems: 'center' }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="chatbubble-outline" size={22} color={Colors.mediumGray} />
                                    <Typography variant="body" color={Colors.mediumGray}>{replies.length}</Typography>
                                </View>
                            </TouchableOpacity>

                            {/* Repost */}
                            <TouchableOpacity onPress={handleRepost} style={{ alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <EvilIcons name="retweet" size={30} color={isReposted ? '#00BA7C' : Colors.mediumGray} />
                                    <Typography variant="body" color={isReposted ? '#00BA7C' : Colors.mediumGray}>{repostCount}</Typography>
                                </View>
                            </TouchableOpacity>

                            {/* Like */}
                            <TouchableOpacity onPress={handleLike} style={{ alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? '#F91880' : Colors.mediumGray} />
                                    <Typography variant="body" color={isLiked ? '#F91880' : Colors.mediumGray}>{likeCount}</Typography>
                                </View>
                            </TouchableOpacity>

                            {/* Views */}
                            <View style={{ alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="stats-chart" size={20} color={Colors.mediumGray} />
                                    <Typography variant="body" color={Colors.mediumGray}>{reflection.views_count + 1}</Typography>
                                </View>
                            </View>

                            {/* Share */}
                            <TouchableOpacity onPress={() => Share.share({ message: `"${reflection.reflection}"` })} style={{ alignItems: 'center' }}>
                                <Ionicons name="share-outline" size={22} color={Colors.mediumGray} />
                            </TouchableOpacity>

                        </View>
                    </View>

                    {/* Replies List */}
                    {replies.map(reply => (
                        <View key={reply.id} style={[styles.replyCard, { borderBottomColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                            <TouchableOpacity onPress={() => router.push(user?.id === reply.user_id ? '/profile' : `/user/${reply.user_id}`)}>
                                <View style={styles.replyAvatar}>
                                    {reply.avatar_url ? (
                                        <Image source={{ uri: reply.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                    ) : (
                                        <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                            {(reply.display_name?.[0] || '?').toUpperCase()}
                                        </Typography>
                                    )}
                                </View>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <TouchableOpacity
                                    onPress={() => router.push(user?.id === reply.user_id ? '/profile' : `/user/${reply.user_id}`)}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}
                                >
                                    <Typography variant="body" color={colors.text} style={{ fontWeight: 'bold' }}>
                                        {reply.display_name}
                                    </Typography>
                                    {reply.username && (
                                        <Typography variant="caption" color={Colors.mediumGray}>
                                            @{reply.username}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        · {formatRelativeTime(reply.created_at)}
                                    </Typography>
                                </TouchableOpacity>

                                {/* Show Replying to indicator for nested replies */}
                                {reply.parent_display_name && (
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 4 }}>
                                        Replying to <Typography variant="caption" color={Colors.gold}>@{reply.parent_display_name}</Typography>
                                    </Typography>
                                )}

                                <Typography variant="body" color={colors.text}>
                                    {reply.reflection}
                                </Typography>

                                {/* Reply Actions Row */}
                                <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
                                    {/* Reply to reply - only show if this is a top-level reply (not a reply-to-reply) */}
                                    {!reply.parent_reflection_id && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setReplyToReply(reply);
                                                setShowReplyModal(true);
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                        >
                                            <Ionicons name="chatbubble-outline" size={16} color={Colors.mediumGray} />
                                        </TouchableOpacity>
                                    )}

                                    {/* Like reply */}
                                    <TouchableOpacity
                                        onPress={async () => {
                                            const wasLiked = likedReplies.has(reply.id);
                                            // Optimistic update
                                            setLikedReplies(prev => {
                                                const newSet = new Set(prev);
                                                if (wasLiked) newSet.delete(reply.id);
                                                else newSet.add(reply.id);
                                                return newSet;
                                            });
                                            setReplies(prev => prev.map(r =>
                                                r.id === reply.id
                                                    ? { ...r, likes_count: (r.likes_count || 0) + (wasLiked ? -1 : 1) }
                                                    : r
                                            ));
                                            try {
                                                await toggleReplyLike(reply.id);
                                            } catch (e) {
                                                // Revert on error
                                                setLikedReplies(prev => {
                                                    const newSet = new Set(prev);
                                                    if (wasLiked) newSet.add(reply.id);
                                                    else newSet.delete(reply.id);
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Ionicons
                                            name={likedReplies.has(reply.id) ? "heart" : "heart-outline"}
                                            size={16}
                                            color={likedReplies.has(reply.id) ? '#E91E63' : Colors.mediumGray}
                                        />
                                        {(reply.likes_count || 0) > 0 && (
                                            <Typography variant="caption" color={likedReplies.has(reply.id) ? '#E91E63' : Colors.mediumGray}>
                                                {reply.likes_count}
                                            </Typography>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* Reply Input - for main reflection replies only */}
                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: isDarkMode ? '#333' : '#EEE' }]}>
                    <TextInput
                        ref={replyInputRef}
                        style={[styles.input, { color: colors.text, backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }]}
                        placeholder="Tweet your reply"
                        placeholderTextColor={Colors.mediumGray}
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                    />
                    <Pressable
                        onPress={handleSendReply}
                        disabled={sending || !replyText.trim()}
                        style={[styles.sendButton, { opacity: !replyText.trim() ? 0.5 : 1 }]}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                            <Typography variant="caption" color={Colors.white} style={{ fontWeight: 'bold' }}>Reply</Typography>
                        )}
                    </Pressable>
                </View>
            </View >

            {/* Reply Compose Modal */}
            < ReplyComposeModal
                visible={showReplyModal}
                onClose={() => {
                    setShowReplyModal(false);
                    setReplyToReply(null);
                }
                }
                onSuccess={(newReply) => {
                    setReplies(prev => [...prev, newReply]);
                }}
                reflectionId={reflectionId || ''}
                replyingTo={replyToReply}
                userDisplayName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                userAvatarUrl={user?.user_metadata?.avatar_url}
                isReplyToReply={true}
            />
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        zIndex: 100,
    },
    mainCard: {
        padding: Spacing.lg,
    },
    authorRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verseContext: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        marginBottom: Spacing.md,
    },
    actionRow: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    replyCard: {
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.md,
        borderBottomWidth: 1,
    },
    replyAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.mediumGray,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputContainer: {
        padding: Spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 30 : Spacing.md,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
    },
    sendButton: {
        backgroundColor: Colors.gold,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    }
});
