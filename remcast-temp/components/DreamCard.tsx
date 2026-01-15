/**
 * Dream Card Component
 * Displays a single dream in the feed with video thumbnail, metadata, and social actions
 */
import { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Pressable } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';
import { type PublicDream, toggleDreamLike, formatRelativeTime, getMoodColor, getMoodEmoji } from '../services/dreamFeed';

interface DreamCardProps {
    dream: PublicDream;
    isLiked: boolean;
    onLikeToggle: (dreamId: string, newLikedState: boolean) => void;
}

export function DreamCard({ dream, isLiked, onLikeToggle }: DreamCardProps) {
    const router = useRouter();
    const [liked, setLiked] = useState(isLiked);
    const [likesCount, setLikesCount] = useState(dream.likes_count);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<Video>(null);
    const heartAnim = useRef(new Animated.Value(0)).current;
    const lastTap = useRef<number>(0);

    const handleDoubleTap = useCallback(async () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap - like
            if (!liked) {
                setLiked(true);
                setLikesCount(prev => prev + 1);
                onLikeToggle(dream.id, true);
                await toggleDreamLike(dream.id);

                // Animate heart
                heartAnim.setValue(0);
                Animated.sequence([
                    Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true }),
                    Animated.delay(500),
                    Animated.timing(heartAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                ]).start();
            }
        }
        lastTap.current = now;
    }, [liked, dream.id, onLikeToggle]);

    const handleLikePress = async () => {
        const newLiked = !liked;
        setLiked(newLiked);
        setLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
        onLikeToggle(dream.id, newLiked);
        await toggleDreamLike(dream.id);
    };

    const handleVideoPress = () => {
        if (isPlaying) {
            videoRef.current?.pauseAsync();
            setIsPlaying(false);
        } else {
            videoRef.current?.playAsync();
            setIsPlaying(true);
        }
    };

    const handleCardPress = () => {
        router.push({ pathname: '/dream/[id]', params: { id: dream.id } });
    };

    const handleUserPress = () => {
        // Navigate to user profile - future feature
    };

    return (
        <View style={styles.card}>
            {/* Header */}
            <TouchableOpacity style={styles.header} onPress={handleUserPress} activeOpacity={0.8}>
                <View style={styles.avatar}>
                    {dream.avatar_url ? (
                        <Image source={{ uri: dream.avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <Ionicons name="person" size={20} color={Colors.fog} />
                    )}
                </View>
                <View style={styles.headerText}>
                    <Typography variant="body" color={Colors.starlight} style={styles.displayName}>
                        {dream.display_name || dream.username || 'Dreamer'}
                    </Typography>
                    <Typography variant="caption" color={Colors.fog}>
                        {formatRelativeTime(dream.created_at)}
                    </Typography>
                </View>
                {dream.mood && (
                    <View style={[styles.moodBadge, { backgroundColor: getMoodColor(dream.mood) + '30' }]}>
                        <Typography variant="caption" color={getMoodColor(dream.mood)}>
                            {getMoodEmoji(dream.mood)}
                        </Typography>
                    </View>
                )}
            </TouchableOpacity>

            {/* Video/Thumbnail */}
            <Pressable onPress={handleDoubleTap} style={styles.videoContainer}>
                {dream.reel_url ? (
                    <>
                        <Video
                            ref={videoRef}
                            source={{ uri: dream.reel_url }}
                            style={styles.video}
                            resizeMode={ResizeMode.COVER}
                            isLooping
                            isMuted
                            shouldPlay={false}
                        />
                        {!isPlaying && (
                            <TouchableOpacity style={styles.playOverlay} onPress={handleVideoPress}>
                                <Ionicons name="play-circle" size={60} color="rgba(255,255,255,0.9)" />
                            </TouchableOpacity>
                        )}
                        {isPlaying && (
                            <TouchableOpacity style={styles.playOverlay} onPress={handleVideoPress}>
                                <View style={styles.pauseHint} />
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="film-outline" size={40} color={Colors.fog} />
                        <Typography variant="caption" color={Colors.fog} style={{ marginTop: Spacing.xs }}>
                            No video yet
                        </Typography>
                    </View>
                )}

                {/* Heart animation overlay */}
                <Animated.View
                    style={[
                        styles.heartOverlay,
                        {
                            opacity: heartAnim,
                            transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
                        },
                    ]}
                >
                    <Ionicons name="heart" size={80} color={Colors.nightmare} />
                </Animated.View>
            </Pressable>

            {/* Title */}
            <TouchableOpacity onPress={handleCardPress} activeOpacity={0.8}>
                <Typography variant="body" color={Colors.starlight} style={styles.title} numberOfLines={2}>
                    {dream.title || 'Untitled Dream'}
                </Typography>
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={24}
                        color={liked ? Colors.nightmare : Colors.mist}
                    />
                    {likesCount > 0 && (
                        <Typography variant="caption" color={Colors.mist} style={styles.actionCount}>
                            {likesCount}
                        </Typography>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleCardPress}>
                    <Ionicons name="chatbubble-outline" size={22} color={Colors.mist} />
                    {dream.comments_count > 0 && (
                        <Typography variant="caption" color={Colors.mist} style={styles.actionCount}>
                            {dream.comments_count}
                        </Typography>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-outline" size={22} color={Colors.mist} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="bookmark-outline" size={22} color={Colors.mist} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.nebula,
        borderRadius: 16,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.cosmic,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 40,
        height: 40,
    },
    headerText: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    displayName: {
        fontWeight: '600',
    },
    moodBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: 8,
    },
    videoContainer: {
        aspectRatio: 16 / 9,
        backgroundColor: Colors.void,
    },
    video: {
        flex: 1,
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    pauseHint: {
        width: 60,
        height: 60,
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -40,
        marginLeft: -40,
    },
    title: {
        fontWeight: '600',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: Spacing.lg,
    },
    actionCount: {
        marginLeft: 4,
    },
});
