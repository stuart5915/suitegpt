import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
    Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/context/AuthContext';
import { useWalletConnect, shortenAddress } from '@/context/WalletConnectContext';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { getSavedVideos, getSavedArticles, SavedVideo, SavedArticle, unsaveVideo, unsaveArticle } from '@/lib/savedItems';
import { useWalletStore, getBadgeColor, NFTBadge } from '@/lib/wallet';
import { NFTBadgeCard, NFTBadgeDetail } from '@/components/NFTBadge';
import Certificate from '@/components/Certificate';

// Mock stats - will be fetched from Supabase
const userStats = {
    streak: 5,
    coursesCompleted: 3,
    hoursLearned: 4.5,
    articlesRead: 12,
};

const badges = [
    { id: '1', emoji: '🎓', name: 'First Lesson', earned: true },
    { id: '2', emoji: '🔥', name: '5-Day Streak', earned: true },
    { id: '3', emoji: '📖', name: 'Avid Reader', earned: true },
    { id: '4', emoji: '🏆', name: 'Course Master', earned: false },
    { id: '5', emoji: '💎', name: 'DeFi Pro', earned: false },
];

const settingsItems = [
    { id: '1', icon: 'notifications-outline', label: 'Notifications', hasArrow: true },
    { id: '2', icon: 'heart-outline', label: 'Interests', hasArrow: true },
    { id: '4', icon: 'help-circle-outline', label: 'Help & FAQ', hasArrow: true },
    { id: '5', icon: 'information-circle-outline', label: 'About', hasArrow: true },
];

export default function ProfileScreen() {
    const { user, profile, signOut, loading } = useAuth();
    const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
    const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);

    // Real WalletConnect state - use showWalletModal for the custom modal
    const { address, isConnected, connect, showWalletModal } = useWalletConnect();

    // NFT badge state (still using local store for badges)
    const { badges: nftBadges, loadBadges } = useWalletStore();
    const [selectedBadge, setSelectedBadge] = useState<NFTBadge | null>(null);
    const [showCertificate, setShowCertificate] = useState(false);

    // Load badges on mount
    useEffect(() => {
        loadBadges();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadSavedContent();
        }, [])
    );

    const loadSavedContent = async () => {
        const videos = await getSavedVideos();
        const articles = await getSavedArticles();
        setSavedVideos(videos);
        setSavedArticles(articles);
    };

    // Use custom wallet modal instead of native Alert
    const handleWalletPress = () => {
        showWalletModal();
    };

    const handleConnectWallet = async () => {
        await connect();
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]
        );
    };

    const openVideo = async (video: SavedVideo) => {
        await WebBrowser.openBrowserAsync(video.url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            controlsColor: Colors.primary,
            toolbarColor: Colors.background,
        });
    };

    const openArticle = async (article: SavedArticle) => {
        await WebBrowser.openBrowserAsync(article.url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            controlsColor: Colors.primary,
            toolbarColor: Colors.background,
        });
    };

    const removeSavedVideo = async (videoId: string) => {
        await unsaveVideo(videoId);
        setSavedVideos(prev => prev.filter(v => v.id !== videoId));
    };

    const removeSavedArticle = async (articleId: string) => {
        await unsaveArticle(articleId);
        setSavedArticles(prev => prev.filter(a => a.id !== articleId));
    };

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const email = user?.email || '';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const hasSavedContent = savedVideos.length > 0 || savedArticles.length > 0;

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.email}>{email}</Text>
                    <Text style={styles.memberSince}>
                        Member since {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                </Animated.View>

                {/* Wallet Connection */}
                <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                    {isConnected ? (
                        <TouchableOpacity
                            style={styles.walletCard}
                            onPress={handleWalletPress}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#a855f7', '#6366f1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.walletGradient}
                            >
                                <View style={styles.walletLeft}>
                                    <Ionicons name="wallet" size={20} color="#fff" />
                                    <View>
                                        <Text style={styles.walletLabel}>Wallet Connected</Text>
                                        <Text style={styles.walletAddress}>{shortenAddress(address || '')}</Text>
                                    </View>
                                </View>
                                <View style={styles.walletBadgeCount}>
                                    <Text style={styles.walletBadgeCountText}>{nftBadges.length} NFTs</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.connectWalletCard}
                            onPress={handleConnectWallet}
                            activeOpacity={0.8}
                        >
                            <View style={styles.connectWalletLeft}>
                                <View style={styles.walletIconCircle}>
                                    <Ionicons name="wallet-outline" size={22} color={Colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.connectWalletTitle}>Connect Your Wallet</Text>
                                    <Text style={styles.connectWalletSubtitle}>Claim NFT badges for completions</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* NFT Badges Gallery */}
                {nftBadges.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                        <Text style={styles.sectionTitle}>💎 NFT Badges</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.nftBadgesScroll}
                        >
                            {nftBadges.map((badge) => (
                                <NFTBadgeCard
                                    key={badge.id}
                                    badge={badge}
                                    onPress={() => {
                                        setSelectedBadge(badge);
                                    }}
                                />
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* Saved Content */}
                {hasSavedContent && (
                    <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                        <Text style={styles.sectionTitle}>🔖 Saved Content</Text>

                        {/* Saved Videos */}
                        {savedVideos.length > 0 && (
                            <>
                                <Text style={styles.subsectionTitle}>Videos ({savedVideos.length})</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.savedScroll}
                                >
                                    {savedVideos.map((video) => (
                                        <View key={video.id} style={styles.savedVideoCard}>
                                            <TouchableOpacity onPress={() => openVideo(video)} activeOpacity={0.8}>
                                                <Image
                                                    source={{ uri: video.thumbnail }}
                                                    style={styles.savedVideoThumb}
                                                />
                                                <View style={styles.playOverlay}>
                                                    <Ionicons name="play" size={16} color="#fff" />
                                                </View>
                                            </TouchableOpacity>
                                            <View style={styles.savedVideoInfo}>
                                                <Text style={styles.savedVideoTitle} numberOfLines={2}>{video.title}</Text>
                                                <Text style={styles.savedVideoCreator}>{video.creator}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.removeBtn}
                                                onPress={() => removeSavedVideo(video.id)}
                                            >
                                                <Ionicons name="close" size={14} color={Colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        {/* Saved Articles */}
                        {savedArticles.length > 0 && (
                            <>
                                <Text style={styles.subsectionTitle}>Articles ({savedArticles.length})</Text>
                                {savedArticles.slice(0, 5).map((article) => (
                                    <TouchableOpacity
                                        key={article.id}
                                        style={styles.savedArticleCard}
                                        onPress={() => openArticle(article)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.savedArticleEmoji}>{article.emoji || '📄'}</Text>
                                        <View style={styles.savedArticleContent}>
                                            <Text style={styles.savedArticleTitle} numberOfLines={2}>{article.title}</Text>
                                            <Text style={styles.savedArticleSource}>{article.source}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removeSavedArticle(article.id)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="bookmark" size={18} color={Colors.primary} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                    </Animated.View>
                )}

                {/* Stats */}
                <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                    <Text style={styles.sectionTitle}>📊 Your Progress</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>🔥 {userStats.streak}</Text>
                            <Text style={styles.statLabel}>Day Streak</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>📚 {userStats.coursesCompleted}</Text>
                            <Text style={styles.statLabel}>Courses</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>⏱️ {userStats.hoursLearned}h</Text>
                            <Text style={styles.statLabel}>Learned</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>📰 {userStats.articlesRead}</Text>
                            <Text style={styles.statLabel}>Articles</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Badges */}
                <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                    <Text style={styles.sectionTitle}>🏆 Badges</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.badgesScroll}
                    >
                        {badges.map((badge) => (
                            <View
                                key={badge.id}
                                style={[styles.badgeCard, !badge.earned && styles.badgeLocked]}
                            >
                                <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>
                                    {badge.earned ? badge.emoji : '🔒'}
                                </Text>
                                <Text style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]}>
                                    {badge.name}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Settings */}
                <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                    <Text style={styles.sectionTitle}>⚙️ Settings</Text>
                    <View style={styles.settingsCard}>
                        {settingsItems.map((item, index) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.settingsItem,
                                    index < settingsItems.length - 1 && styles.settingsItemBorder
                                ]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name={item.icon as any} size={22} color={Colors.textSecondary} />
                                <Text style={styles.settingsLabel}>{item.label}</Text>
                                {item.hasArrow && (
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>

                {/* Sign Out */}
                <Animated.View entering={FadeInDown.delay(500).duration(400)}>
                    <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* App Version */}
                <Text style={styles.version}>DeFi Knowledge v1.0.0</Text>
            </ScrollView>

            {/* WalletConnect modal is handled by the SDK provider */}
            <Modal
                visible={selectedBadge !== null}
                animationType="fade"
                presentationStyle="overFullScreen"
                transparent
                onRequestClose={() => setSelectedBadge(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setSelectedBadge(null)}
                        >
                            <Ionicons name="close" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        {selectedBadge && (
                            <>
                                <NFTBadgeDetail badge={selectedBadge} />
                                <TouchableOpacity
                                    style={styles.viewCertBtn}
                                    onPress={() => {
                                        setShowCertificate(true);
                                    }}
                                >
                                    <Text style={styles.viewCertBtnText}>View Certificate</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Certificate Modal */}
            <Certificate
                visible={showCertificate}
                onClose={() => setShowCertificate(false)}
                badge={selectedBadge}
                userName={displayName}
                walletAddress={address || undefined}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: Spacing['3xl'],
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing['2xl'],
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    avatarText: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: '#fff',
    },
    name: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    email: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    memberSince: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        marginTop: Spacing.lg,
    },
    subsectionTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },

    // Saved Content
    savedScroll: {
        gap: Spacing.md,
        paddingBottom: Spacing.md,
    },
    savedVideoCard: {
        width: 160,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    savedVideoThumb: {
        width: '100%',
        height: 90,
        backgroundColor: Colors.border,
    },
    playOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -15 }, { translateY: -15 }],
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    savedVideoInfo: {
        padding: Spacing.sm,
    },
    savedVideoTitle: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    savedVideoCreator: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    removeBtn: {
        position: 'absolute',
        top: Spacing.xs,
        right: Spacing.xs,
        backgroundColor: Colors.background + 'DD',
        borderRadius: 10,
        padding: 4,
    },
    savedArticleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
        gap: Spacing.md,
    },
    savedArticleEmoji: {
        fontSize: 24,
    },
    savedArticleContent: {
        flex: 1,
    },
    savedArticleTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    savedArticleSource: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Stats
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    statCard: {
        width: '48%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    statValue: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    statLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    badgesScroll: {
        gap: Spacing.md,
        paddingRight: Spacing.lg,
    },
    badgeCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        width: 100,
    },
    badgeLocked: {
        opacity: 0.5,
    },
    badgeEmoji: {
        fontSize: 32,
        marginBottom: Spacing.xs,
    },
    badgeEmojiLocked: {
        opacity: 0.5,
    },
    badgeName: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    badgeNameLocked: {
        color: Colors.textMuted,
    },
    settingsCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    settingsItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    settingsLabel: {
        flex: 1,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.error + '40',
        padding: Spacing.md,
        marginTop: Spacing['2xl'],
    },
    signOutText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.error,
    },
    version: {
        textAlign: 'center',
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: Spacing.xl,
    },

    // Wallet Section
    walletCard: {
        marginBottom: Spacing.md,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    walletGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    walletLabel: {
        fontSize: Typography.fontSize.xs,
        color: 'rgba(255,255,255,0.7)',
    },
    walletAddress: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    walletBadgeCount: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 4,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.sm,
    },
    walletBadgeCountText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        color: '#fff',
    },
    connectWalletCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
        marginBottom: Spacing.md,
    },
    connectWalletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    walletIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectWalletTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    connectWalletSubtitle: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // NFT Badges Gallery
    nftBadgesScroll: {
        gap: Spacing.md,
        paddingRight: Spacing.lg,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    modalCloseBtn: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        zIndex: 10,
        padding: Spacing.xs,
    },
    viewCertBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        marginTop: Spacing.lg,
        alignItems: 'center',
    },
    viewCertBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
