import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { useWalletConnect, shortenAddress } from '@/context/WalletConnectContext';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

// Mock data - will be replaced with API calls
const trendingNews = [
    {
        id: '1',
        title: 'Bitcoin Surges Past $100K Milestone',
        source: 'CoinDesk',
        readTime: '3 min',
        emoji: '🚀',
    },
    {
        id: '2',
        title: 'Ethereum L2 Solutions See Record Activity',
        source: 'The Block',
        readTime: '4 min',
        emoji: '⚡',
    },
    {
        id: '3',
        title: 'DeFi TVL Reaches New All-Time High',
        source: 'DeFi Pulse',
        readTime: '2 min',
        emoji: '📈',
    },
];

const continueLesson = {
    courseName: 'DeFi 101: Understanding the Basics',
    lessonNumber: 3,
    totalLessons: 10,
    progress: 0.3,
};

export default function HomeScreen() {
    const { user, profile } = useAuth();
    const { address, isConnected, connect } = useWalletConnect();
    const [refreshing, setRefreshing] = React.useState(false);

    const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        // TODO: Fetch new content
        setTimeout(() => setRefreshing(false), 1500);
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Header */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}, {firstName} 👋</Text>
                        <Text style={styles.subGreeting}>Here&apos;s what&apos;s happening in DeFi</Text>
                    </View>
                    <View style={styles.headerButtons}>
                        {/* Wallet Connect Button */}
                        <TouchableOpacity
                            style={[
                                styles.walletBtn,
                                isConnected && styles.walletBtnConnected
                            ]}
                            onPress={connect}
                        >
                            <Ionicons
                                name={isConnected ? "wallet" : "wallet-outline"}
                                size={16}
                                color={isConnected ? "#fff" : Colors.textPrimary}
                            />
                            {isConnected && (
                                <Text style={styles.walletBtnText}>
                                    {shortenAddress(address || '')}
                                </Text>
                            )}
                        </TouchableOpacity>
                        {/* Notifications */}
                        <TouchableOpacity style={styles.notificationBtn}>
                            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Continue Learning Card */}
                <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                    <Text style={styles.sectionTitle}>📖 Continue Learning</Text>
                    <TouchableOpacity style={styles.continueCard} activeOpacity={0.8}>
                        <View style={styles.continueContent}>
                            <Text style={styles.continueCourseName}>{continueLesson.courseName}</Text>
                            <Text style={styles.continueProgress}>
                                Lesson {continueLesson.lessonNumber} of {continueLesson.totalLessons}
                            </Text>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${continueLesson.progress * 100}%` }
                                    ]}
                                />
                            </View>
                        </View>
                        <Ionicons name="play-circle" size={48} color={Colors.primary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Trending News */}
                <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                    <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
                    {trendingNews.map((item, index) => (
                        <TouchableOpacity key={item.id} style={styles.newsCard} activeOpacity={0.7}>
                            <Text style={styles.newsEmoji}>{item.emoji}</Text>
                            <View style={styles.newsContent}>
                                <Text style={styles.newsTitle}>{item.title}</Text>
                                <Text style={styles.newsMeta}>{item.source} • {item.readTime} read</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </Animated.View>

                {/* Quick Actions */}
                <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                    <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionCard}>
                            <Text style={styles.actionEmoji}>📚</Text>
                            <Text style={styles.actionTitle}>Browse Courses</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCard}>
                            <Text style={styles.actionEmoji}>🔍</Text>
                            <Text style={styles.actionTitle}>Explore Topics</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCard}>
                            <Text style={styles.actionEmoji}>💬</Text>
                            <Text style={styles.actionTitle}>Find Expert</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCard}>
                            <Text style={styles.actionEmoji}>📖</Text>
                            <Text style={styles.actionTitle}>Glossary</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: Spacing.lg,
        paddingBottom: Spacing['3xl'],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing['2xl'],
        paddingTop: Spacing.md,
    },
    greeting: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    subGreeting: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    notificationBtn: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    walletBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 32,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surface,
        gap: 4,
    },
    walletBtnConnected: {
        backgroundColor: Colors.primary,
    },
    walletBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        marginTop: Spacing.lg,
    },
    continueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    continueContent: {
        flex: 1,
        marginRight: Spacing.md,
    },
    continueCourseName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    continueProgress: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    newsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    newsEmoji: {
        fontSize: 28,
        marginRight: Spacing.md,
    },
    newsContent: {
        flex: 1,
    },
    newsTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    newsMeta: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    actionCard: {
        width: '47%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    actionEmoji: {
        fontSize: 32,
        marginBottom: Spacing.sm,
    },
    actionTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
});
