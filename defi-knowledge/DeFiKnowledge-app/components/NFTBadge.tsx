// NFT Badge Component
// Beautiful animated badge display with gradient borders

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { NFTBadge as NFTBadgeType, getBadgeColor, shortenAddress } from '@/lib/wallet';

interface NFTBadgeProps {
    badge: NFTBadgeType;
    onPress?: () => void;
    size?: 'small' | 'large';
}

export function NFTBadgeCard({ badge, onPress, size = 'small' }: NFTBadgeProps) {
    const colors = getBadgeColor(badge.difficulty);
    const isSmall = size === 'small';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[styles.container, isSmall && styles.containerSmall]}
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradientBorder, isSmall && styles.gradientBorderSmall]}
            >
                <View style={[styles.inner, isSmall && styles.innerSmall]}>
                    <Text style={[styles.emoji, isSmall && styles.emojiSmall]}>
                        {badge.courseEmoji}
                    </Text>
                    {!isSmall && (
                        <>
                            <Text style={styles.courseName}>{badge.courseName}</Text>
                            <View style={styles.nftBadge}>
                                <Ionicons name="shield-checkmark" size={12} color={colors[0]} />
                                <Text style={[styles.nftLabel, { color: colors[0] }]}>NFT BADGE</Text>
                            </View>
                        </>
                    )}
                </View>
            </LinearGradient>
            <View style={styles.shimmer} />
        </TouchableOpacity>
    );
}

interface NFTBadgeDetailProps {
    badge: NFTBadgeType;
    onClose?: () => void;
}

export function NFTBadgeDetail({ badge, onClose }: NFTBadgeDetailProps) {
    const colors = getBadgeColor(badge.difficulty);
    const mintDate = new Date(badge.mintedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.detailContainer}>
            {/* Badge preview */}
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailBadge}
            >
                <View style={styles.detailBadgeInner}>
                    <Text style={styles.detailEmoji}>{badge.courseEmoji}</Text>
                    <View style={styles.detailNftBadge}>
                        <Ionicons name="shield-checkmark" size={16} color={colors[0]} />
                        <Text style={[styles.detailNftLabel, { color: colors[0] }]}>VERIFIED NFT</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Course name */}
            <Text style={styles.detailTitle}>{badge.courseName}</Text>
            <Text style={styles.detailSubtitle}>Completion Badge</Text>

            {/* Metadata */}
            <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Difficulty</Text>
                    <View style={[styles.difficultyBadge, { backgroundColor: colors[0] + '20' }]}>
                        <Text style={[styles.difficultyText, { color: colors[0] }]}>
                            {badge.difficulty.toUpperCase()}
                        </Text>
                    </View>
                </View>
                <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Minted</Text>
                    <Text style={styles.metaValue}>{mintDate}</Text>
                </View>
                {badge.tokenId && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Token ID</Text>
                        <Text style={styles.metaValue}>#{badge.tokenId}</Text>
                    </View>
                )}
                {badge.txHash && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Transaction</Text>
                        <Text style={styles.metaValueMono}>
                            {badge.txHash.slice(0, 10)}...{badge.txHash.slice(-6)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Ionicons name="share-outline" size={18} color={Colors.textPrimary} />
                    <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.textPrimary} />
                    <Text style={styles.actionText}>Certificate</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

// Claim Badge CTA for course completion
interface ClaimBadgeCTAProps {
    courseEmoji: string;
    courseName: string;
    isWalletConnected: boolean;
    onConnectWallet: () => void;
    onClaimBadge: () => void;
    isClaiming?: boolean;
}

export function ClaimBadgeCTA({
    courseEmoji,
    courseName,
    isWalletConnected,
    onConnectWallet,
    onClaimBadge,
    isClaiming,
}: ClaimBadgeCTAProps) {
    return (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.ctaContainer}>
            <LinearGradient
                colors={['#1e1e2f', '#2d2d44']}
                style={styles.ctaGradient}
            >
                <View style={styles.ctaHeader}>
                    <Text style={styles.ctaEmoji}>{courseEmoji}</Text>
                    <View style={styles.ctaBadgePreview}>
                        <Text style={styles.ctaBadgeText}>🎉 NFT BADGE UNLOCKED!</Text>
                    </View>
                </View>

                <Text style={styles.ctaTitle}>Claim Your Badge</Text>
                <Text style={styles.ctaDescription}>
                    You've completed "{courseName}"! Mint this achievement as an NFT badge to prove your knowledge.
                </Text>

                {isWalletConnected ? (
                    <TouchableOpacity onPress={onClaimBadge} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#a855f7', '#6366f1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaBtn}
                        >
                            {isClaiming ? (
                                <Text style={styles.ctaBtnText}>Minting...</Text>
                            ) : (
                                <>
                                    <Ionicons name="diamond" size={18} color="#fff" />
                                    <Text style={styles.ctaBtnText}>Mint NFT Badge</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={onConnectWallet} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#a855f7', '#6366f1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaBtn}
                        >
                            <Ionicons name="wallet" size={18} color="#fff" />
                            <Text style={styles.ctaBtnText}>Connect Wallet to Claim</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <Text style={styles.ctaNote}>Free to mint • Stored in your wallet forever</Text>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // Small badge card
    container: {
        width: 120,
    },
    containerSmall: {
        width: 90,
    },
    gradientBorder: {
        borderRadius: BorderRadius.xl,
        padding: 2,
    },
    gradientBorderSmall: {
        borderRadius: BorderRadius.lg,
    },
    inner: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl - 2,
        padding: Spacing.md,
        alignItems: 'center',
    },
    innerSmall: {
        borderRadius: BorderRadius.lg - 2,
        padding: Spacing.sm,
    },
    emoji: {
        fontSize: 36,
        marginBottom: Spacing.xs,
    },
    emojiSmall: {
        fontSize: 28,
        marginBottom: 0,
    },
    courseName: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    nftBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    nftLabel: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: BorderRadius.xl,
        opacity: 0.1,
    },

    // Detail view
    detailContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
    },
    detailBadge: {
        borderRadius: BorderRadius['2xl'],
        padding: 3,
        marginBottom: Spacing.lg,
    },
    detailBadgeInner: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius['2xl'] - 3,
        padding: Spacing.xl,
        alignItems: 'center',
    },
    detailEmoji: {
        fontSize: 64,
        marginBottom: Spacing.sm,
    },
    detailNftBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailNftLabel: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    detailTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    detailSubtitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.xl,
    },

    // Metadata
    metaSection: {
        width: '100%',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    metaValue: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
    },
    metaValueMono: {
        fontSize: Typography.fontSize.xs,
        fontFamily: 'monospace',
        color: Colors.textSecondary,
    },
    difficultyBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    difficultyText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
    },

    // Actions
    actions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.border,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    actionText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textPrimary,
    },

    // Claim CTA
    ctaContainer: {
        marginVertical: Spacing.lg,
    },
    ctaGradient: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
    },
    ctaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    ctaEmoji: {
        fontSize: 48,
    },
    ctaBadgePreview: {
        backgroundColor: Colors.success + '20',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    ctaBadgeText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        color: Colors.success,
    },
    ctaTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    ctaDescription: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.lg,
    },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    ctaBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    ctaNote: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
    },
});
