/**
 * Home Screen - REMcast Dream Feed
 * Clean, focused dream exploration
 */
import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { DreamCard } from '../components/DreamCard';
import { Colors, Spacing } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import {
    getPublicDreamFeed,
    getTrendingDreams,
    getUserLikedDreams,
    type PublicDream,
} from '../services/dreamFeed';

const MOODS = ['all', 'peaceful', 'surreal', 'lucid', 'nightmare', 'chaotic', 'prophetic'];

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();

    const [dreams, setDreams] = useState<PublicDream[]>([]);
    const [likedDreams, setLikedDreams] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMood, setSelectedMood] = useState('all');

    useEffect(() => {
        loadFeed();
        loadLikedDreams();
    }, [selectedMood]);

    useFocusEffect(
        useCallback(() => {
            loadLikedDreams();
        }, [])
    );

    async function loadFeed() {
        try {
            const data = await getPublicDreamFeed(20, 0, selectedMood === 'all' ? undefined : selectedMood);
            setDreams(data);
        } catch (error) {
            console.error('[Home] Error loading feed:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    async function loadLikedDreams() {
        const liked = await getUserLikedDreams();
        setLikedDreams(liked);
    }

    function handleRefresh() {
        setRefreshing(true);
        loadFeed();
    }

    function handleLikeToggle(dreamId: string, newLikedState: boolean) {
        setLikedDreams(prev => {
            const updated = new Set(prev);
            if (newLikedState) updated.add(dreamId);
            else updated.delete(dreamId);
            return updated;
        });
    }

    const renderHeader = () => (
        <View style={styles.headerSection}>
            {/* App Title */}
            <View style={styles.titleRow}>
                <Typography variant="h1" color={Colors.starlight} style={styles.appTitle}>
                    REMcast
                </Typography>
                <TouchableOpacity onPress={() => router.push('/profile')}>
                    <View style={styles.avatarCircle}>
                        <Ionicons name="person" size={18} color={Colors.fog} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Subtitle */}
            <Typography variant="body" color={Colors.mist} style={styles.subtitle}>
                Explore dream reels from the community
            </Typography>

            {/* Mood Filters */}
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={MOODS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.filterChip, selectedMood === item && styles.filterChipActive]}
                        onPress={() => {
                            setSelectedMood(item);
                            setLoading(true);
                        }}
                    >
                        <Typography
                            variant="caption"
                            color={selectedMood === item ? Colors.starlight : Colors.mist}
                        >
                            {item === 'all' ? '✨ All' : item.charAt(0).toUpperCase() + item.slice(1)}
                        </Typography>
                    </TouchableOpacity>
                )}
                style={styles.filterList}
            />
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Ionicons name="moon-outline" size={64} color={Colors.fog} />
            <Typography variant="body" color={Colors.mist} style={{ marginTop: Spacing.md }}>
                No dreams to explore yet
            </Typography>
            <TouchableOpacity
                style={styles.recordPrompt}
                onPress={() => router.push('/setup')}
            >
                <Ionicons name="mic" size={20} color={Colors.starlight} />
                <Typography variant="body" color={Colors.starlight} style={{ marginLeft: Spacing.xs }}>
                    Record the first dream!
                </Typography>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading && dreams.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dreamPurple} />
                </View>
            ) : (
                <FlatList
                    data={dreams}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <DreamCard
                            dream={item}
                            isLiked={likedDreams.has(item.id)}
                            onLikeToggle={handleLikeToggle}
                        />
                    )}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={Colors.dreamPurple}
                        />
                    }
                    contentContainerStyle={styles.feedContent}
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSection: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: Spacing.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.nebula,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        marginBottom: Spacing.md,
    },
    filterList: {
        marginBottom: Spacing.sm,
    },
    filterChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: 16,
        backgroundColor: Colors.nebula,
        marginRight: Spacing.sm,
    },
    filterChipActive: {
        backgroundColor: Colors.dreamPurple,
    },
    feedContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 100,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing['2xl'],
    },
    recordPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dreamPurple,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: 20,
        marginTop: Spacing.lg,
    },
});
