/**
 * My Reels Screen (replaces Journal)
 * Shows user's own dreams with privacy controls
 */
import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Alert, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { getUserDreams, deleteDream, type ProcessedDream } from '../services/dreamProcessing';
import { toggleDreamVisibility, getMoodColor, getMoodEmoji, formatRelativeTime } from '../services/dreamFeed';
import { getUserCredits, type UserCredits } from '../services/videoGeneration';

export default function MyReels() {
    const router = useRouter();
    const { user } = useAuth();

    const [dreams, setDreams] = useState<ProcessedDream[]>([]);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDreams();
        loadCredits();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDreams();
            loadCredits();
        }, [])
    );

    async function loadDreams() {
        try {
            const data = await getUserDreams();
            setDreams(data);
        } catch (error) {
            console.error('[MyReels] Error loading dreams:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    async function loadCredits() {
        const userCredits = await getUserCredits();
        setCredits(userCredits);
    }

    function handleRefresh() {
        setRefreshing(true);
        loadDreams();
        loadCredits();
    }

    function handleRecordDream() {
        router.push('/setup');
    }

    function handleDreamPress(dreamId: string) {
        router.push({ pathname: '/dream/[id]', params: { id: dreamId } });
    }

    async function handleToggleVisibility(dream: ProcessedDream) {
        const newVisibility = await toggleDreamVisibility(dream.id);
        setDreams(prev =>
            prev.map(d => (d.id === dream.id ? { ...d, is_public: newVisibility } : d))
        );
    }

    async function handleDeleteDream(dreamId: string) {
        Alert.alert(
            'Delete Dream',
            'Are you sure you want to delete this dream? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteDream(dreamId);
                        if (success) {
                            setDreams(prev => prev.filter(d => d.id !== dreamId));
                        }
                    },
                },
            ]
        );
    }

    const renderDreamItem = ({ item }: { item: ProcessedDream }) => {
        const isComplete = item.processing_status === 'complete';
        const hasVideo = !!item.reel_url;

        return (
            <TouchableOpacity
                style={styles.dreamCard}
                onPress={() => handleDreamPress(item.id)}
                activeOpacity={0.8}
            >
                {/* Thumbnail */}
                <View style={styles.thumbnail}>
                    {hasVideo ? (
                        <View style={styles.videoThumb}>
                            <Ionicons name="play-circle" size={32} color={Colors.starlight} />
                        </View>
                    ) : (
                        <View style={styles.processingThumb}>
                            {item.processing_status === 'error' ? (
                                <Ionicons name="warning" size={24} color={Colors.nightmare} />
                            ) : item.processing_status === 'complete' ? (
                                <Ionicons name="film-outline" size={24} color={Colors.fog} />
                            ) : (
                                <ActivityIndicator size="small" color={Colors.dreamPurple} />
                            )}
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.dreamInfo}>
                    <Typography variant="body" color={Colors.starlight} style={styles.dreamTitle} numberOfLines={1}>
                        {item.title || 'Processing...'}
                    </Typography>
                    <View style={styles.dreamMeta}>
                        {item.mood && (
                            <View style={[styles.moodBadge, { backgroundColor: getMoodColor(item.mood) + '30' }]}>
                                <Typography variant="caption" color={getMoodColor(item.mood)}>
                                    {getMoodEmoji(item.mood)} {item.mood}
                                </Typography>
                            </View>
                        )}
                        <Typography variant="caption" color={Colors.fog}>
                            {formatRelativeTime(item.created_at)}
                        </Typography>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.dreamActions}>
                    {/* Visibility toggle */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => handleToggleVisibility(item)}
                    >
                        <Ionicons
                            name={item.is_public ? 'globe' : 'lock-closed'}
                            size={18}
                            color={item.is_public ? Colors.lucid : Colors.fog}
                        />
                    </TouchableOpacity>

                    {/* Delete */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => handleDeleteDream(item.id)}
                    >
                        <Ionicons name="trash-outline" size={18} color={Colors.fog} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={64} color={Colors.fog} />
            <Typography variant="body" color={Colors.mist} style={styles.emptyText}>
                No reels yet
            </Typography>
            <Typography variant="caption" color={Colors.fog} style={styles.emptySubtext}>
                Record your first dream to get started
            </Typography>
            <TouchableOpacity style={styles.recordButton} onPress={handleRecordDream}>
                <Ionicons name="mic" size={20} color={Colors.starlight} />
                <Typography variant="body" color={Colors.starlight} style={{ marginLeft: Spacing.xs, fontWeight: '600' }}>
                    Record Dream
                </Typography>
            </TouchableOpacity>
        </View>
    );

    const renderHeader = () => (
        <View style={styles.statsCard}>
            <View style={styles.statItem}>
                <Typography variant="h2" color={Colors.dreamPurple}>
                    {dreams.length}
                </Typography>
                <Typography variant="caption" color={Colors.mist}>
                    Dreams
                </Typography>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Typography variant="h2" color={Colors.cosmicCyan}>
                    {dreams.filter(d => d.reel_url).length}
                </Typography>
                <Typography variant="caption" color={Colors.mist}>
                    Reels
                </Typography>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Typography variant="h2" color={Colors.sunrise}>
                    {credits?.video_credits ?? 3}
                </Typography>
                <Typography variant="caption" color={Colors.mist}>
                    Credits
                </Typography>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Typography variant="h2" color={Colors.starlight}>
                    My Reels
                </Typography>
                <TouchableOpacity onPress={handleRecordDream} style={styles.headerButton}>
                    <Ionicons name="add-circle" size={28} color={Colors.dreamPurple} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dreamPurple} />
                </View>
            ) : (
                <FlatList
                    data={dreams}
                    keyExtractor={(item) => item.id}
                    renderItem={renderDreamItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={Colors.dreamPurple}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.midnight,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerButton: {
        padding: Spacing.xs,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 100,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: Colors.nebula,
        borderRadius: 16,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: Colors.cosmic,
    },
    dreamCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.nebula,
        borderRadius: 12,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
    },
    videoThumb: {
        flex: 1,
        backgroundColor: Colors.dreamPurple,
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingThumb: {
        flex: 1,
        backgroundColor: Colors.cosmic,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dreamInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    dreamTitle: {
        fontWeight: '600',
        marginBottom: 4,
    },
    dreamMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    moodBadge: {
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dreamActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        padding: Spacing.xs,
        marginLeft: Spacing.xs,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing['2xl'],
    },
    emptyText: {
        marginTop: Spacing.md,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: Spacing.xs,
    },
    recordButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dreamPurple,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: 20,
        marginTop: Spacing.lg,
    },
});
