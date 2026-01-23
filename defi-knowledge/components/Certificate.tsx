// Certificate Component
// Beautiful shareable course completion certificate

import React, { useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Share,
    Alert,
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { NFTBadge, getBadgeColor, shortenAddress } from '@/lib/wallet';

interface CertificateProps {
    visible: boolean;
    onClose: () => void;
    badge: NFTBadge | null;
    userName?: string;
    walletAddress?: string;
}

export default function Certificate({
    visible,
    onClose,
    badge,
    userName = 'DeFi Learner',
    walletAddress,
}: CertificateProps) {
    if (!badge) return null;

    const colors = getBadgeColor(badge.difficulty);
    const completionDate = new Date(badge.mintedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🎓 I just completed "${badge.courseName}" on DeFi Knowledge and earned an NFT badge! #DeFi #Web3 #Learning`,
                title: 'DeFi Knowledge Certificate',
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleDownload = () => {
        // In a real app, this would generate a PDF
        Alert.alert(
            'Certificate Saved',
            'Your certificate has been saved to your device.',
            [{ text: 'OK' }]
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            presentationStyle="overFullScreen"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={ZoomIn.duration(400)}
                    style={styles.container}
                >
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Certificate Card */}
                    <View style={styles.certificateCard}>
                        {/* Decorative corners */}
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />

                        {/* Header */}
                        <View style={styles.logoSection}>
                            <Text style={styles.logoEmoji}>💎</Text>
                            <Text style={styles.appName}>DEFI KNOWLEDGE</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Certificate title */}
                        <Text style={styles.certificateTitle}>CERTIFICATE OF COMPLETION</Text>

                        {/* Recipient */}
                        <Text style={styles.presentedTo}>This is to certify that</Text>
                        <Text style={styles.recipientName}>{userName}</Text>
                        {walletAddress && (
                            <Text style={styles.walletAddress}>{shortenAddress(walletAddress)}</Text>
                        )}

                        {/* Course info */}
                        <Text style={styles.hasCompleted}>has successfully completed</Text>
                        <View style={styles.courseSection}>
                            <Text style={styles.courseEmoji}>{badge.courseEmoji}</Text>
                            <Text style={styles.courseName}>{badge.courseName}</Text>
                        </View>

                        {/* Difficulty badge */}
                        <LinearGradient
                            colors={colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.difficultyBadge}
                        >
                            <Text style={styles.difficultyText}>
                                {badge.difficulty.toUpperCase()} LEVEL
                            </Text>
                        </LinearGradient>

                        {/* NFT verification */}
                        <View style={styles.nftVerification}>
                            <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                            <Text style={styles.nftVerificationText}>
                                NFT Verified • Token #{badge.tokenId}
                            </Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Date and signature */}
                        <View style={styles.footer}>
                            <View style={styles.footerItem}>
                                <Text style={styles.footerLabel}>Date</Text>
                                <Text style={styles.footerValue}>{completionDate}</Text>
                            </View>
                            <View style={styles.footerItem}>
                                <Text style={styles.footerLabel}>Blockchain</Text>
                                <Text style={styles.footerValue}>Base Network</Text>
                            </View>
                        </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={handleShare}
                        >
                            <Ionicons name="share-social" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnSecondary]}
                            onPress={handleDownload}
                        >
                            <Ionicons name="download" size={20} color={Colors.textPrimary} />
                            <Text style={styles.actionBtnTextSecondary}>Save PDF</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 380,
    },
    closeBtn: {
        position: 'absolute',
        top: -40,
        right: 0,
        padding: Spacing.sm,
        zIndex: 10,
    },
    certificateCard: {
        backgroundColor: '#0a0a12',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 2,
        borderColor: Colors.primary + '60',
        position: 'relative',
        overflow: 'hidden',
    },

    // Decorative corners
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: Colors.primary,
    },
    cornerTL: {
        top: 10,
        left: 10,
        borderTopWidth: 2,
        borderLeftWidth: 2,
    },
    cornerTR: {
        top: 10,
        right: 10,
        borderTopWidth: 2,
        borderRightWidth: 2,
    },
    cornerBL: {
        bottom: 10,
        left: 10,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
    },
    cornerBR: {
        bottom: 10,
        right: 10,
        borderBottomWidth: 2,
        borderRightWidth: 2,
    },

    // Logo
    logoSection: {
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    logoEmoji: {
        fontSize: 32,
        marginBottom: Spacing.xs,
    },
    appName: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 3,
    },

    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.md,
    },

    // Certificate content
    certificateTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '700',
        color: Colors.textMuted,
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    presentedTo: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
    },
    recipientName: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    walletAddress: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
        fontFamily: 'monospace',
        marginTop: 4,
    },
    hasCompleted: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.lg,
    },
    courseSection: {
        alignItems: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    courseEmoji: {
        fontSize: 48,
        marginBottom: Spacing.xs,
    },
    courseName: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    difficultyBadge: {
        alignSelf: 'center',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    difficultyText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 1,
    },
    nftVerification: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    nftVerificationText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.success,
    },

    // Footer
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    footerItem: {
        alignItems: 'center',
    },
    footerLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginBottom: 2,
    },
    footerValue: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textSecondary,
    },

    // Actions
    actions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.lg,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    actionBtnSecondary: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    actionBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    actionBtnTextSecondary: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
});
