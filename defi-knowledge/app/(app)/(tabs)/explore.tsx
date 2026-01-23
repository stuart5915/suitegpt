// Use Tab - DeFi Command Center
// Sub-tabs for quick DeFi action switching: Overview | Swap | Yields

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import ValueFlowMap from '@/components/ValueFlowMap';
import SwapInterface from '@/components/SwapInterface';
import YieldsPanel from '@/components/YieldsPanel';
import { useWalletConnect } from '@/context/WalletConnectContext';
import { useWalletStore, SUPPORTED_CHAINS } from '@/lib/wallet';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 24;

type SubTab = 'overview' | 'swap' | 'yields';

interface TabConfig {
    id: SubTab;
    label: string;
    icon: string;
}

const TABS: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: 'apps-outline' },
    { id: 'swap', label: 'Swap', icon: 'swap-horizontal' },
    { id: 'yields', label: 'Yields', icon: 'trending-up' },
];

export default function ExploreScreen() {
    const [activeTab, setActiveTab] = useState<SubTab>('overview');
    const { isConnected, address } = useWalletConnect();
    const { chainId } = useWalletStore();

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return <ValueFlowMap />;
            case 'swap':
                return (
                    <View style={styles.contentContainer}>
                        {isConnected ? (
                            <SwapInterface
                                visible={true}
                                chainId={chainId || 1}
                                protocolName="DEX"
                                onClose={() => setActiveTab('overview')}
                            />
                        ) : (
                            <View style={styles.connectPrompt}>
                                <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
                                <Text style={styles.connectPromptTitle}>Connect Wallet</Text>
                                <Text style={styles.connectPromptText}>
                                    Go to Overview and connect your wallet to start swapping
                                </Text>
                                <TouchableOpacity
                                    style={styles.goToOverviewBtn}
                                    onPress={() => setActiveTab('overview')}
                                >
                                    <Text style={styles.goToOverviewText}>Go to Overview</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            case 'yields':
                return (
                    <YieldsPanel visible={true} onClose={() => setActiveTab('overview')} inline={true} />
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Sub-tab navigation */}
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={18}
                            color={activeTab === tab.id ? Colors.primary : Colors.textMuted}
                        />
                        <Text style={[
                            styles.tabLabel,
                            activeTab === tab.id && styles.tabLabelActive
                        ]}>
                            {tab.label}
                        </Text>
                        {activeTab === tab.id && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <Animated.View
                key={activeTab}
                entering={FadeIn.duration(200)}
                style={styles.content}
            >
                {renderContent()}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    tabBar: {
        flexDirection: 'row',
        paddingTop: STATUS_BAR_HEIGHT,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        gap: 4,
        position: 'relative',
    },
    tabActive: {},
    tabLabel: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.textMuted,
    },
    tabLabelActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: -Spacing.sm,
        left: '20%',
        right: '20%',
        height: 2,
        backgroundColor: Colors.primary,
        borderRadius: 1,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
    },
    connectPrompt: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
        gap: Spacing.md,
    },
    connectPromptTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    connectPromptText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    goToOverviewBtn: {
        marginTop: Spacing.md,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    goToOverviewText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
