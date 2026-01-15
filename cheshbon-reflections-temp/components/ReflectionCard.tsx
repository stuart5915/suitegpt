import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';
import { useRouter } from 'expo-router';
import {
    type PublicReflection,
    toggleLike,
    toggleRepost,
    formatRelativeTime,
    deletePublicReflection,
    createQuoteReflection
} from '../services/feedService';
import { TOPICS } from '../services/edificationContent';
import { RepostMenu } from './RepostMenu';
import { QuoteReflectModal } from './QuoteReflectModal';
import { ReplyComposeModal } from './ReplyComposeModal';

interface ReflectionCardProps {
    reflection: PublicReflection;
    currentUser: any; // Supabase user object
    userAvatarUrl: string | null; // Current user's avatar (for instant updates)
    initialLiked: boolean;
    initialReposted: boolean;
    onDelete?: () => void;
    onQuoteCreated?: () => void; // Callback when quote reflection is created
    onReplyCreated?: () => void; // Callback when reply is created
}

export function ReflectionCard({
    reflection,
    currentUser,
    userAvatarUrl,
    initialLiked,
    initialReposted,
    onDelete,
    onQuoteCreated,
    onReplyCreated
}: ReflectionCardProps) {
    const router = useRouter();

    // Interaction State
    const [isLiked, setIsLiked] = useState(initialLiked);
    const [likeCount, setLikeCount] = useState(reflection.likes_count);
    const [isReposted, setIsReposted] = useState(initialReposted);
    const [repostCount, setRepostCount] = useState(reflection.repost_count);

    // Menu State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRepostMenuOpen, setIsRepostMenuOpen] = useState(false);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [replyCount, setReplyCount] = useState(reflection.reply_count);

    // Navigate to thread view (Twitter/X style)
    function goToThread() {
        router.push(`/reflection/${reflection.id}`);
    }

    // Handlers
    async function handleLike() {
        const newState = !isLiked;
        setIsLiked(newState);
        setLikeCount(c => c + (newState ? 1 : -1));
        try {
            await toggleLike(reflection.id);
        } catch (e) {
            setIsLiked(!newState);
            setLikeCount(c => c + (!newState ? 1 : -1));
        }
    }

    async function handleRepost() {
        const newState = !isReposted;
        setIsReposted(newState);
        setRepostCount(c => c + (newState ? 1 : -1));
        try {
            await toggleRepost(reflection.id);
        } catch (e) {
            setIsReposted(!newState);
            setRepostCount(c => c + (!newState ? 1 : -1));
        }
    }

    async function handleQuoteReflection(text: string) {
        await createQuoteReflection(reflection.id, text, reflection);
        if (onQuoteCreated) onQuoteCreated();
    }

    async function handleDelete() {
        Alert.alert('Delete Reflection', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deletePublicReflection(reflection.id);
                        if (onDelete) onDelete();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete reflection');
                    }
                }
            }
        ]);
        setIsMenuOpen(false);
    }

    // Navigation logic for verses (for future use if needed)
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

    const isOwner = currentUser?.id === reflection.user_id;

    return (
        <View style={styles.feedCard}>
            {/* Re-reflected indicator */}
            {isReposted && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 }}>
                    <Ionicons name="repeat" size={14} color="#00BA7C" />
                    <Typography variant="caption" color="#00BA7C" style={{ marginLeft: 6, fontSize: 12 }}>
                        You re-reflected
                    </Typography>
                </View>
            )}

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                <TouchableOpacity onPress={() => router.push(isOwner ? '/profile' : `/user/${reflection.user_id}`)}>
                    <View style={styles.avatar}>
                        {(isOwner ? userAvatarUrl : reflection.avatar_url) ? (
                            <Image
                                source={{ uri: isOwner ? userAvatarUrl! : reflection.avatar_url! }}
                                style={{ width: 36, height: 36, borderRadius: 18 }}
                            />
                        ) : (
                            <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                {(reflection.display_name?.[0] || '?').toUpperCase()}
                            </Typography>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        onPress={() => router.push(isOwner ? '/profile' : `/user/${reflection.user_id}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}
                    >
                        <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                            {reflection.display_name || 'Anonymous'}
                        </Typography>
                        {reflection.username && (
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginLeft: 4 }}>
                                @{reflection.username}
                            </Typography>
                        )}
                        <Typography variant="caption" color={Colors.mediumGray} style={{ marginLeft: 4 }}>
                            · {formatRelativeTime(reflection.created_at)}
                        </Typography>
                    </TouchableOpacity>
                </View>

                {/* Menu Trigger - Shows for all users */}
                <TouchableOpacity
                    onPress={() => setIsMenuOpen(!isMenuOpen)}
                    style={{ padding: 8, marginRight: -8 }}
                >
                    <Typography variant="body" color={Colors.mediumGray}>⋯</Typography>
                </TouchableOpacity>
            </View>

            {/* Menu Dropdown */}
            {isMenuOpen && (
                <>
                    <TouchableOpacity
                        style={styles.menuBackdrop}
                        onPress={() => setIsMenuOpen(false)}
                    />
                    <View style={styles.menuDropdown}>
                        {isOwner ? (
                            // Owner's own post - show Delete
                            <TouchableOpacity onPress={() => { setIsMenuOpen(false); handleDelete(); }} style={{ padding: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="trash-outline" size={18} color="#E0245E" />
                                    <Typography variant="body" color="#E0245E">Delete</Typography>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            // Other's post - show Report
                            <TouchableOpacity
                                onPress={() => {
                                    setIsMenuOpen(false);
                                    Alert.alert(
                                        'Report Content',
                                        'Are you sure you want to report this reflection?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Report',
                                                style: 'destructive',
                                                onPress: () => Alert.alert('Reported', 'Thank you. We will review this content.')
                                            }
                                        ]
                                    );
                                }}
                                style={{ padding: 12 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="flag-outline" size={18} color="#E0245E" />
                                    <Typography variant="body" color="#E0245E">Report</Typography>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            )}

            {/* Main Content Area - Tap anywhere to open thread */}
            <TouchableOpacity onPress={goToThread} activeOpacity={0.7}>
                {/* Verse Reference */}
                <Typography variant="caption" color={Colors.gold} style={{ marginBottom: 4 }}>
                    {reflection.verse_reference.startsWith('Edification:') ? '📚' : '📖'} {reflection.verse_reference}
                </Typography>

                {/* Content Body */}
                <Typography variant="body" color={Colors.charcoal} style={{ lineHeight: 22, marginBottom: Spacing.sm }}>{reflection.reflection}</Typography>

                {/* Quoted Reflection Preview (if this is a quote) */}
                {reflection.quoted_reflection && (
                    <View style={styles.quotedPreview}>
                        <View style={styles.quotedHeader}>
                            <View style={styles.quotedAvatar}>
                                {reflection.quoted_reflection.avatar_url ? (
                                    <Image
                                        source={{ uri: reflection.quoted_reflection.avatar_url }}
                                        style={{ width: 16, height: 16, borderRadius: 8 }}
                                    />
                                ) : (
                                    <Typography variant="caption" color={Colors.white} style={{ fontSize: 8, fontWeight: 'bold' }}>
                                        {(reflection.quoted_reflection.display_name?.[0] || '?').toUpperCase()}
                                    </Typography>
                                )}
                            </View>
                            <Typography variant="caption" color={Colors.charcoal} style={{ fontWeight: '600', fontSize: 11 }}>
                                {reflection.quoted_reflection.display_name}
                            </Typography>
                        </View>
                        <Typography variant="caption" color={Colors.charcoal} numberOfLines={2} style={{ marginTop: 4 }}>
                            {reflection.quoted_reflection.reflection}
                        </Typography>
                    </View>
                )}
            </TouchableOpacity>

            {/* Actions Bar */}
            <View style={styles.actionRow}>
                {/* Reply Button - Opens Reply Modal */}
                <TouchableOpacity onPress={() => setIsReplyModalOpen(true)} style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={18} color={Colors.mediumGray} />
                    <Typography variant="caption" color={Colors.mediumGray}>
                        {replyCount > 0 ? replyCount : ''}
                    </Typography>
                </TouchableOpacity>

                {/* Repost - Opens menu */}
                <TouchableOpacity onPress={() => setIsRepostMenuOpen(true)} style={styles.actionButton}>
                    <EvilIcons name="retweet" size={24} color={isReposted ? '#00BA7C' : Colors.mediumGray} />
                    <Typography variant="caption" color={isReposted ? '#00BA7C' : Colors.mediumGray} style={{ fontSize: 12 }}>
                        {repostCount > 0 ? repostCount : ''}
                    </Typography>
                </TouchableOpacity>

                {/* Like */}
                <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? '#F91880' : Colors.mediumGray} />
                    <Typography variant="caption" color={isLiked ? '#F91880' : Colors.mediumGray} style={{ fontSize: 12 }}>
                        {likeCount > 0 ? likeCount : ''}
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
                <TouchableOpacity onPress={() => Share.share({ message: `"${reflection.reflection}"` })}>
                    <Ionicons name="share-outline" size={18} color={Colors.mediumGray} />
                </TouchableOpacity>
            </View>

            {/* Repost Menu */}
            <RepostMenu
                visible={isRepostMenuOpen}
                onClose={() => setIsRepostMenuOpen(false)}
                onReflect={handleRepost}
                onQuoteReflect={() => setIsQuoteModalOpen(true)}
                isReposted={isReposted}
            />

            {/* Quote Reflect Modal */}
            <QuoteReflectModal
                visible={isQuoteModalOpen}
                onClose={() => setIsQuoteModalOpen(false)}
                onSubmit={handleQuoteReflection}
                quotedReflection={reflection}
            />

            {/* Reply Compose Modal */}
            <ReplyComposeModal
                visible={isReplyModalOpen}
                onClose={() => setIsReplyModalOpen(false)}
                onSuccess={(newReply) => {
                    setReplyCount(c => c + 1);
                    if (onReplyCreated) onReplyCreated();
                }}
                reflectionId={reflection.id}
                replyingTo={reflection}
                userDisplayName={currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'User'}
                userAvatarUrl={userAvatarUrl}
                isReplyToReply={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    feedCard: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        marginBottom: Spacing.sm,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.sm,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
        paddingRight: Spacing.lg,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    menuBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 998,
    },
    menuDropdown: {
        position: 'absolute',
        top: 40,
        right: 0,
        backgroundColor: Colors.cream,
        borderRadius: 12,
        minWidth: 140,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 999,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    quotedPreview: {
        backgroundColor: Colors.cream,
        borderRadius: 12,
        padding: Spacing.sm,
        marginTop: Spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    quotedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quotedAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    menuContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        minWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
});
