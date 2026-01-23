// EcosystemOverview Component
// Educational visual diagram showing how money flows from TradFi to DeFi
// Collapsible with bidirectional arrows showing value can flow anywhere

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

// Flow nodes
const FLOW_NODES = [
    { id: 'bank', emoji: '🏦', label: 'Your Bank', description: 'USD in checking/savings' },
    { id: 'cex', emoji: '🏢', label: 'Exchange (CEX)', description: 'Coinbase, Kraken, etc.' },
    { id: 'wallet', emoji: '👛', label: 'Web3 Wallet', description: 'MetaMask, Rainbow' },
    { id: 'defi', emoji: '🌐', label: 'DeFi Protocols', description: 'Swap, Lend, Stake' },
];

// DeFi categories
const DEFI_CATEGORIES = [
    { id: 'swap', emoji: '🔄', label: 'Swap', color: '#FF6B35' },
    { id: 'lend', emoji: '💰', label: 'Lend', color: '#00B4D8' },
    { id: 'stake', emoji: '🥩', label: 'Stake', color: '#9B59B6' },
    { id: 'bridge', emoji: '🌉', label: 'Bridge', color: '#2ECC71' },
];

interface Props {
    onClose?: () => void;
    defaultExpanded?: boolean;
}

export default function EcosystemOverview({ onClose, defaultExpanded = false }: Props) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <View style={styles.container}>
            {/* Collapsible Header */}
            <TouchableOpacity
                style={styles.header}
                onPress={() => setIsExpanded(!isExpanded)}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <Text style={styles.headerEmoji}>🗺️</Text>
                    <View>
                        <Text style={styles.title}>DeFi Ecosystem Map</Text>
                        <Text style={styles.subtitle}>How value flows from bank to DeFi</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={20} color={Colors.textMuted} />
                        </TouchableOpacity>
                    )}
                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={Colors.textMuted}
                    />
                </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <Animated.View entering={FadeIn.duration(200)}>
                    {/* Flow Diagram */}
                    <View style={styles.flowContainer}>
                        {FLOW_NODES.map((node, index) => (
                            <Animated.View
                                key={node.id}
                                entering={FadeInDown.delay(index * 80).duration(200)}
                            >
                                {/* Bidirectional connector (except for first item) */}
                                {index > 0 && (
                                    <View style={styles.connector}>
                                        <View style={styles.connectorArrows}>
                                            <Ionicons name="chevron-up" size={12} color={Colors.success} />
                                            <View style={styles.connectorLine} />
                                            <Ionicons name="chevron-down" size={12} color={Colors.primary} />
                                        </View>
                                    </View>
                                )}

                                {/* Node */}
                                <View style={[
                                    styles.flowNode,
                                    node.id === 'wallet' && styles.flowNodeHighlight,
                                    node.id === 'defi' && styles.flowNodeDefi,
                                ]}>
                                    <Text style={styles.nodeEmoji}>{node.emoji}</Text>
                                    <View style={styles.nodeContent}>
                                        <Text style={styles.nodeLabel}>{node.label}</Text>
                                        <Text style={styles.nodeDesc}>{node.description}</Text>
                                    </View>
                                    {node.id === 'wallet' && (
                                        <View style={styles.keyIcon}>
                                            <Text style={{ fontSize: 12 }}>🔑</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Expanded DeFi categories */}
                                {node.id === 'defi' && (
                                    <View style={styles.defiGrid}>
                                        {DEFI_CATEGORIES.map(cat => (
                                            <View
                                                key={cat.id}
                                                style={[styles.defiChip, { borderColor: cat.color }]}
                                            >
                                                <Text style={styles.defiChipEmoji}>{cat.emoji}</Text>
                                                <Text style={[styles.defiChipLabel, { color: cat.color }]}>{cat.label}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </Animated.View>
                        ))}
                    </View>

                    {/* Key insight */}
                    <View style={styles.insightBox}>
                        <Ionicons name="bulb-outline" size={18} color={Colors.warning} />
                        <Text style={styles.insightText}>
                            <Text style={{ fontWeight: '600' }}>Key insight: </Text>
                            Value flows both ways! You can move funds up or down this chain whenever you want.
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* Collapsed Preview */}
            {!isExpanded && (
                <View style={styles.collapsedPreview}>
                    <View style={styles.collapsedFlow}>
                        {FLOW_NODES.map((node, index) => (
                            <React.Fragment key={node.id}>
                                <Text style={styles.collapsedEmoji}>{node.emoji}</Text>
                                {index < FLOW_NODES.length - 1 && (
                                    <Ionicons name="swap-horizontal" size={14} color={Colors.textMuted} />
                                )}
                            </React.Fragment>
                        ))}
                    </View>
                    <Text style={styles.collapsedHint}>Tap to explore</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    headerEmoji: {
        fontSize: 24,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    title: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    subtitle: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 1,
    },
    closeBtn: {
        padding: 4,
    },

    // Collapsed preview
    collapsedPreview: {
        marginTop: Spacing.md,
        alignItems: 'center',
    },
    collapsedFlow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    collapsedEmoji: {
        fontSize: 20,
    },
    collapsedHint: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        marginTop: Spacing.xs,
    },

    // Flow diagram
    flowContainer: {
        paddingTop: Spacing.md,
    },
    connector: {
        alignItems: 'center',
        paddingVertical: 2,
    },
    connectorArrows: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    connectorLine: {
        width: 20,
        height: 2,
        backgroundColor: Colors.border,
    },
    flowNode: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    flowNodeHighlight: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    flowNodeDefi: {
        borderColor: Colors.success,
        backgroundColor: Colors.success + '10',
    },
    nodeEmoji: {
        fontSize: 24,
    },
    nodeContent: {
        flex: 1,
    },
    nodeLabel: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    nodeDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    keyIcon: {
        backgroundColor: Colors.warning + '30',
        borderRadius: 12,
        padding: 4,
    },

    // DeFi grid
    defiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: Spacing.sm,
        paddingLeft: 36,
    },
    defiChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: Colors.background,
    },
    defiChipEmoji: {
        fontSize: 12,
    },
    defiChipLabel: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Insight box
    insightBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.warning + '10',
        borderRadius: BorderRadius.md,
    },
    insightText: {
        flex: 1,
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
});
