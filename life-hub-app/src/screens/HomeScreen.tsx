import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';
import { LifeMemory } from '../types';
import { fetchRecentMemories } from '../lib/ai';

const APP_ICONS: Record<string, { icon: string; color: string }> = {
    trueform: { icon: 'fitness', color: '#22C55E' },
    opticrep: { icon: 'barbell', color: '#F59E0B' },
    foodvital: { icon: 'nutrition', color: '#EF4444' },
    cheshbon: { icon: 'book', color: '#A855F7' },
    remcast: { icon: 'moon', color: '#6366F1' },
    deals: { icon: 'pricetag', color: '#00D9FF' },
    cadence: { icon: 'megaphone', color: '#EC4899' },
    defi_hub: { icon: 'wallet', color: '#14B8A6' },
};

export function HomeScreen() {
    const [memories, setMemories] = useState<LifeMemory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadMemories();
    }, []);

    const loadMemories = async () => {
        setIsLoading(true);
        const data = await fetchRecentMemories(5);
        setMemories(data);
        setIsLoading(false);
    };

    const getAppIcon = (sourceApp: string) => {
        const config = APP_ICONS[sourceApp] || { icon: 'apps', color: COLORS.cyan };
        return config;
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHrs < 1) return 'Just now';
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        return `${diffDays}d ago`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good morning 👋</Text>
                    <Text style={styles.headerTitle}>Your Life Overview</Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: COLORS.purple + '20' }]}>
                        <Ionicons name="flash" size={24} color={COLORS.purple} />
                        <Text style={styles.statValue}>5</Text>
                        <Text style={styles.statLabel}>Activities Today</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: COLORS.cyan + '20' }]}>
                        <Ionicons name="apps" size={24} color={COLORS.cyan} />
                        <Text style={styles.statValue}>6</Text>
                        <Text style={styles.statLabel}>Apps Connected</Text>
                    </View>
                </View>

                {/* Recent Memories */}
                <Text style={styles.sectionTitle}>Recent Activity</Text>

                {isLoading ? (
                    <View style={styles.loadingCard}>
                        <Text style={styles.loadingText}>Loading memories...</Text>
                    </View>
                ) : (
                    memories.map((memory) => {
                        const appConfig = getAppIcon(memory.source_app);
                        return (
                            <TouchableOpacity key={memory.id} style={styles.memoryCard} activeOpacity={0.7}>
                                <View style={[styles.memoryIcon, { backgroundColor: appConfig.color + '20' }]}>
                                    <Ionicons name={appConfig.icon as any} size={20} color={appConfig.color} />
                                </View>
                                <View style={styles.memoryContent}>
                                    <View style={styles.memoryHeader}>
                                        <Text style={styles.memoryApp}>{memory.source_app}</Text>
                                        <Text style={styles.memoryTime}>{formatTimeAgo(memory.created_at)}</Text>
                                    </View>
                                    <Text style={styles.memoryText} numberOfLines={2}>
                                        {memory.content}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="chatbubble" size={24} color={COLORS.textPrimary} />
                        <Text style={styles.actionLabel}>Ask AI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="analytics" size={24} color={COLORS.textPrimary} />
                        <Text style={styles.actionLabel}>Insights</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="calendar" size={24} color={COLORS.textPrimary} />
                        <Text style={styles.actionLabel}>Weekly</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surface,
    },
    greeting: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginTop: 4,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: SPACING.md,
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.lg,
    },
    statCard: {
        flex: 1,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginTop: SPACING.sm,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
        marginTop: SPACING.sm,
    },
    loadingCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.textSecondary,
    },
    memoryCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    memoryIcon: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    memoryContent: {
        flex: 1,
    },
    memoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    memoryApp: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.cyan,
        textTransform: 'uppercase',
    },
    memoryTime: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    memoryText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    actionButton: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
        gap: SPACING.sm,
    },
    actionLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
});
