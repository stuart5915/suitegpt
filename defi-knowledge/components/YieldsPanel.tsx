// YieldsPanel Component
// Floating button that expands to show curated yield pools and strategies

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/Colors';
import {
    CURATED_POOLS,
    CURATED_STRATEGIES,
    RISK_COLORS,
    YieldPool,
    YieldStrategy,
    getTopVotedStrategies,
} from '@/lib/yields';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import YearnVaultsCard from './YearnVaultsCard';

type TabType = 'pools' | 'strategies' | 'top';

interface YieldsPanelProps {
    visible: boolean;
    onClose: () => void;
    inline?: boolean; // If true, renders as full-screen content without modal
}

export default function YieldsPanel({ visible, onClose, inline = false }: YieldsPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('pools');

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'pools', label: 'Simple', icon: 'cash-outline' },
        { id: 'strategies', label: 'Strategies', icon: 'git-branch-outline' },
        { id: 'top', label: 'Top Voted', icon: 'trending-up' },
    ];

    const renderPoolCard = (pool: YieldPool) => (
        <Animated.View
            key={pool.id}
            entering={FadeIn.delay(100)}
            style={styles.poolCard}
        >
            <View style={styles.poolHeader}>
                <View style={styles.poolInfo}>
                    <Text style={styles.poolEmoji}>{pool.protocolEmoji}</Text>
                    <View>
                        <Text style={styles.poolName}>{pool.name}</Text>
                        <Text style={styles.poolProtocol}>{pool.protocol} • {pool.network}</Text>
                    </View>
                </View>
                <View style={styles.apyBadge}>
                    <Text style={styles.apyText}>{pool.apy}</Text>
                    <Text style={styles.apyLabel}>APY</Text>
                </View>
            </View>

            <Text style={styles.poolDescription}>{pool.description}</Text>

            <View style={styles.poolFooter}>
                <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[pool.risk] + '20' }]}>
                    <View style={[styles.riskDot, { backgroundColor: RISK_COLORS[pool.risk] }]} />
                    <Text style={[styles.riskText, { color: RISK_COLORS[pool.risk] }]}>
                        {pool.risk.charAt(0).toUpperCase() + pool.risk.slice(1)} Risk
                    </Text>
                </View>
                <TouchableOpacity style={styles.depositBtn}>
                    <Text style={styles.depositBtnText}>Deposit {pool.depositToken}</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderStrategyCard = (strategy: YieldStrategy, showVotes: boolean = false) => (
        <Animated.View
            key={strategy.id}
            entering={FadeIn.delay(100)}
            style={styles.strategyCard}
        >
            <View style={styles.strategyHeader}>
                <View style={styles.strategyInfo}>
                    <Text style={styles.strategyName}>{strategy.name}</Text>
                    <View style={styles.strategyMeta}>
                        <Text style={styles.strategySteps}>{strategy.steps.length} steps</Text>
                        <Text style={styles.strategyNetwork}>• {strategy.network}</Text>
                    </View>
                </View>
                <View style={styles.strategyApyBadge}>
                    <Text style={styles.strategyApyText}>{strategy.totalApy}</Text>
                    {showVotes && (
                        <View style={styles.votesBadge}>
                            <Ionicons name="arrow-up" size={10} color={Colors.success} />
                            <Text style={styles.votesText}>{strategy.votes}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
                {strategy.steps.map((step, index) => (
                    <View key={step.order} style={styles.stepRow}>
                        <View style={styles.stepLine}>
                            <View style={styles.stepDot}>
                                <Text style={styles.stepNumber}>{step.order}</Text>
                            </View>
                            {index < strategy.steps.length - 1 && <View style={styles.stepConnector} />}
                        </View>
                        <View style={styles.stepContent}>
                            <View style={styles.stepHeader}>
                                <Text style={styles.stepEmoji}>{step.protocolEmoji}</Text>
                                <Text style={styles.stepAction}>{step.action}</Text>
                                <Text style={styles.stepProtocol}>{step.protocol}</Text>
                            </View>
                            <Text style={styles.stepDesc}>
                                {step.inputToken} → {step.outputToken}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.strategyFooter}>
                <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[strategy.risk] + '20' }]}>
                    <View style={[styles.riskDot, { backgroundColor: RISK_COLORS[strategy.risk] }]} />
                    <Text style={[styles.riskText, { color: RISK_COLORS[strategy.risk] }]}>
                        {strategy.risk.charAt(0).toUpperCase() + strategy.risk.slice(1)} Risk
                    </Text>
                </View>
                <TouchableOpacity style={styles.startBtn}>
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={styles.startBtnText}>Start Strategy</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    if (!visible) return null;

    // Inline content (used in sub-tabs)
    const renderInlineContent = () => (
        <View style={styles.inlineContainer}>
            {/* Tabs */}
            <View style={styles.tabs}>
                {tabs.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={16}
                            color={activeTab === tab.id ? Colors.primary : Colors.textMuted}
                        />
                        <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'pools' && (
                    <>
                        {/* Yearn Finance Vaults */}
                        <Text style={styles.sectionTitle}>🔵 Yearn Finance Vaults</Text>
                        <Text style={styles.sectionSubtitle}>
                            Auto-compounding yield aggregator with proven track record
                        </Text>
                        <YearnVaultsCard
                            walletAddress={undefined}
                            isWalletConnected={false}
                        />

                        {/* Spacer */}
                        <View style={{ height: Spacing.xl }} />

                        <Text style={styles.sectionTitle}>One-click deposits</Text>
                        <Text style={styles.sectionSubtitle}>
                            Simple pools - deposit and start earning immediately
                        </Text>
                        {CURATED_POOLS.map(pool => renderPoolCard(pool))}
                    </>
                )}

                {activeTab === 'strategies' && (
                    <>
                        <Text style={styles.sectionTitle}>Multi-step strategies</Text>
                        <Text style={styles.sectionSubtitle}>
                            Follow the steps to maximize your yield
                        </Text>
                        {CURATED_STRATEGIES.map(strategy => renderStrategyCard(strategy, false))}
                    </>
                )}

                {activeTab === 'top' && (
                    <>
                        <Text style={styles.sectionTitle}>Community favorites</Text>
                        <Text style={styles.sectionSubtitle}>
                            Top-voted strategies from the community
                        </Text>
                        {getTopVotedStrategies(5).map(strategy => renderStrategyCard(strategy, true))}
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );

    // If inline mode, render without modal
    if (inline) {
        return renderInlineContent();
    }

    // Modal mode (original behavior)
    return (
        <Modal visible={visible} transparent animationType="none">
            {/* Backdrop - dark overlay with fade */}
            <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            {/* Panel - smooth slide up (no spring bounce) */}
            <Animated.View
                entering={SlideInDown.duration(300)}
                exiting={SlideOutDown.duration(200)}
                style={styles.panel}
            >
                {/* Handle */}
                <View style={styles.handle} />

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerEmoji}>💰</Text>
                        <Text style={styles.headerTitle}>Find Yields</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={Colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabs}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={activeTab === tab.id ? Colors.primary : Colors.textMuted}
                            />
                            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'pools' && (
                        <>
                            {/* Yearn Finance Vaults */}
                            <Text style={styles.sectionTitle}>🔵 Yearn Finance Vaults</Text>
                            <Text style={styles.sectionSubtitle}>
                                Auto-compounding yield aggregator with proven track record
                            </Text>
                            <YearnVaultsCard
                                walletAddress={undefined}
                                isWalletConnected={false}
                            />

                            {/* Spacer */}
                            <View style={{ height: Spacing.xl }} />

                            <Text style={styles.sectionTitle}>One-click deposits</Text>
                            <Text style={styles.sectionSubtitle}>
                                Simple pools - deposit and start earning immediately
                            </Text>
                            {CURATED_POOLS.map(pool => renderPoolCard(pool))}
                        </>
                    )}

                    {activeTab === 'strategies' && (
                        <>
                            <Text style={styles.sectionTitle}>Multi-step strategies</Text>
                            <Text style={styles.sectionSubtitle}>
                                Follow the steps to maximize your yield
                            </Text>
                            {CURATED_STRATEGIES.map(strategy => renderStrategyCard(strategy, false))}
                        </>
                    )}

                    {activeTab === 'top' && (
                        <>
                            <Text style={styles.sectionTitle}>Community favorites</Text>
                            <Text style={styles.sectionSubtitle}>
                                Top-voted strategies from the community
                            </Text>
                            {getTopVotedStrategies(5).map(strategy => renderStrategyCard(strategy, true))}
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </Animated.View>
        </Modal>
    );
}

// Floating button component
export function YieldsFloatingButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.floatingButton} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.floatingEmoji}>💰</Text>
            <Text style={styles.floatingText}>Find Yields</Text>
            <Ionicons name="chevron-up" size={16} color="#fff" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    inlineContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    panel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '85%',
        backgroundColor: Colors.surface,
        borderTopLeftRadius: BorderRadius['2xl'],
        borderTopRightRadius: BorderRadius['2xl'],
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerEmoji: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeBtn: {
        padding: Spacing.xs,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.xs,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surfaceElevated,
    },
    tabActive: {
        backgroundColor: Colors.primary + '20',
    },
    tabText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textMuted,
    },
    tabTextActive: {
        color: Colors.primary,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    sectionSubtitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    // Pool card styles
    poolCard: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    poolHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    poolInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    poolEmoji: {
        fontSize: 28,
    },
    poolName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    poolProtocol: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    apyBadge: {
        alignItems: 'flex-end',
    },
    apyText: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.success,
    },
    apyLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    poolDescription: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
    },
    poolFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    riskBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    riskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    riskText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
    },
    depositBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    depositBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    // Strategy card styles
    strategyCard: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    strategyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    strategyInfo: {
        flex: 1,
    },
    strategyName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    strategyMeta: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    strategySteps: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    strategyNetwork: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    strategyApyBadge: {
        alignItems: 'flex-end',
    },
    strategyApyText: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.success,
    },
    votesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    votesText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.success,
        fontWeight: '500',
    },
    stepsContainer: {
        marginBottom: Spacing.md,
    },
    stepRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    stepLine: {
        alignItems: 'center',
        width: 24,
    },
    stepDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    stepConnector: {
        width: 2,
        flex: 1,
        backgroundColor: Colors.primary + '40',
        marginVertical: 2,
    },
    stepContent: {
        flex: 1,
        paddingBottom: Spacing.sm,
    },
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    stepEmoji: {
        fontSize: 14,
    },
    stepAction: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    stepProtocol: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    stepDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    strategyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    startBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    // Floating button
    floatingButton: {
        position: 'absolute',
        bottom: Spacing.lg,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    floatingEmoji: {
        fontSize: 18,
    },
    floatingText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
