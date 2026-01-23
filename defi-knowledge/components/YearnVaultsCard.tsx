// YearnVaultsCard Component
// Displays Yearn Finance vaults in the Command Center dashboard

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/Colors';
import { fetchTopVaults, fetchUserPositions, YearnUserPosition, YearnVault } from '@/lib/yearn';
import { RISK_COLORS } from '@/lib/yields';

interface YearnVaultsCardProps {
    walletAddress?: string;
    isWalletConnected: boolean;
}

export default function YearnVaultsCard({ walletAddress, isWalletConnected }: YearnVaultsCardProps) {
    const [vaults, setVaults] = useState<YearnVault[]>([]);
    const [userPositions, setUserPositions] = useState<YearnUserPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        loadVaults();
    }, []);

    useEffect(() => {
        if (isWalletConnected && walletAddress) {
            loadUserPositions();
        }
    }, [isWalletConnected, walletAddress]);

    const loadVaults = async () => {
        setLoading(true);
        try {
            const data = await fetchTopVaults(1, 5); // Ethereum mainnet, top 5
            setVaults(data);
        } catch (error) {
            console.error('Failed to load Yearn vaults:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserPositions = async () => {
        if (!walletAddress) return;

        try {
            const positions = await fetchUserPositions(walletAddress, 1);
            setUserPositions(positions);
        } catch (error) {
            console.error('Failed to load user positions:', error);
        }
    };

    const getUserPosition = (vaultAddress: string): YearnUserPosition | undefined => {
        return userPositions.find(p => p.vaultAddress.toLowerCase() === vaultAddress.toLowerCase());
    };

    const formatAPY = (apy: number): string => {
        return `${(apy * 100).toFixed(2)}%`;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading Yearn vaults...</Text>
            </View>
        );
    }

    return (
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            {/* Header */}
            <TouchableOpacity
                style={styles.header}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
            >
                <Text style={styles.sectionTitle}>🔵 Yearn Vaults</Text>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.textSecondary}
                />
            </TouchableOpacity>

            {/* Top Vaults Preview (always visible) */}
            <View style={styles.previewContainer}>
                {vaults.slice(0, 3).map((vault, index) => (
                    <View key={vault.address} style={styles.vaultPreviewRow}>
                        <View style={styles.vaultInfo}>
                            <Text style={styles.vaultSymbol}>{vault.token.symbol}</Text>
                            <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[vault.risk] + '20' }]}>
                                <Text style={[styles.riskText, { color: RISK_COLORS[vault.risk] }]}>
                                    {vault.risk}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.vaultMetrics}>
                            <Text style={styles.apyValue}>{formatAPY(vault.apy.net)}</Text>
                            <Text style={styles.tvlValue}>{vault.tvl.formatted} TVL</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Expanded Details */}
            {expanded && (
                <Animated.View entering={FadeInDown.duration(300)}>
                    {/* All Vaults */}
                    <View style={styles.expandedSection}>
                        <Text style={styles.subsectionTitle}>All Top Vaults</Text>
                        {vaults.map((vault) => {
                            const position = getUserPosition(vault.address);
                            return (
                                <TouchableOpacity
                                    key={vault.address}
                                    style={styles.vaultCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.vaultCardHeader}>
                                        <View style={styles.vaultCardInfo}>
                                            <Text style={styles.vaultName}>{vault.displayName}</Text>
                                            <Text style={styles.vaultTokenSymbol}>{vault.token.name}</Text>
                                        </View>
                                        <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[vault.risk] + '20' }]}>
                                            <Text style={[styles.riskText, { color: RISK_COLORS[vault.risk] }]}>
                                                {vault.risk.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.vaultCardMetrics}>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricLabel}>APY</Text>
                                            <Text style={styles.metricValue}>{formatAPY(vault.apy.net)}</Text>
                                        </View>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricLabel}>TVL</Text>
                                            <Text style={styles.metricValue}>{vault.tvl.formatted}</Text>
                                        </View>
                                    </View>

                                    {/* User Position (if wallet connected and has position) */}
                                    {position && (
                                        <View style={styles.positionBanner}>
                                            <Ionicons name="wallet" size={14} color={Colors.primary} />
                                            <Text style={styles.positionText}>
                                                Your position: ${position.balanceUSD.toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* User Positions Summary (if wallet connected) */}
                    {isWalletConnected && userPositions.length > 0 && (
                        <View style={styles.positionsSection}>
                            <Text style={styles.subsectionTitle}>💼 Your Positions</Text>
                            {userPositions.map((position, index) => {
                                const vault = vaults.find(v => v.address.toLowerCase() === position.vaultAddress.toLowerCase());
                                return (
                                    <View key={position.vaultAddress} style={styles.positionCard}>
                                        <Text style={styles.positionVaultName}>
                                            {vault?.displayName || 'Unknown Vault'}
                                        </Text>
                                        <Text style={styles.positionBalance}>
                                            ${position.balanceUSD.toFixed(2)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Call to Action */}
                    {!isWalletConnected && (
                        <View style={styles.ctaContainer}>
                            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                            <Text style={styles.ctaText}>
                                Connect wallet to view your positions
                            </Text>
                        </View>
                    )}
                </Animated.View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    loadingText: {
        marginLeft: Spacing.md,
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    previewContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    vaultPreviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    vaultInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    vaultSymbol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    riskBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    riskText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    vaultMetrics: {
        alignItems: 'flex-end',
    },
    apyValue: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: Colors.primary,
    },
    tvlValue: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    expandedSection: {
        marginTop: Spacing.lg,
    },
    subsectionTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    vaultCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    vaultCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    vaultCardInfo: {
        flex: 1,
    },
    vaultName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    vaultTokenSymbol: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    vaultCardMetrics: {
        flexDirection: 'row',
        gap: Spacing.xl,
    },
    metricItem: {
        flex: 1,
    },
    metricLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginBottom: Spacing.xs,
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    positionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    positionText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    positionsSection: {
        marginTop: Spacing.lg,
    },
    positionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    positionVaultName: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    positionBalance: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: Colors.primary,
    },
    ctaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    ctaText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
});
