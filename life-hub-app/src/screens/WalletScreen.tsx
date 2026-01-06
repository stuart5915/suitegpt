import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

export function WalletScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>$SUITE Wallet</Text>
                <Text style={styles.headerSubtitle}>Manage your tokens</Text>
            </View>

            <View style={styles.content}>
                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                        <Ionicons name="wallet" size={32} color={COLORS.cyan} />
                        <Text style={styles.balanceLabel}>Available Balance</Text>
                    </View>
                    <Text style={styles.balanceValue}>0.00</Text>
                    <Text style={styles.balanceToken}>$SUITE</Text>

                    <View style={styles.balanceActions}>
                        <TouchableOpacity style={styles.balanceButton}>
                            <Ionicons name="add" size={20} color={COLORS.background} />
                            <Text style={styles.balanceButtonText}>Buy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.balanceButton, styles.balanceButtonOutline]}>
                            <Ionicons name="send" size={20} color={COLORS.cyan} />
                            <Text style={[styles.balanceButtonText, styles.balanceButtonTextOutline]}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Usage Stats */}
                <Text style={styles.sectionTitle}>Usage This Month</Text>
                <View style={styles.usageCard}>
                    <View style={styles.usageRow}>
                        <Text style={styles.usageLabel}>AI Queries</Text>
                        <Text style={styles.usageValue}>23</Text>
                    </View>
                    <View style={styles.usageRow}>
                        <Text style={styles.usageLabel}>$SUITE Spent</Text>
                        <Text style={styles.usageValue}>0.00</Text>
                    </View>
                    <View style={styles.usageDivider} />
                    <Text style={styles.usageNote}>
                        ✨ Currently in free tier - all queries are free!
                    </Text>
                </View>

                {/* Coming Soon */}
                <View style={styles.comingSoon}>
                    <Ionicons name="rocket" size={48} color={COLORS.purple} />
                    <Text style={styles.comingSoonTitle}>$SUITE Integration Coming Soon</Text>
                    <Text style={styles.comingSoonText}>
                        Token micropayments for premium AI queries will be enabled in a future update.
                    </Text>
                </View>
            </View>
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
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    content: {
        flex: 1,
        padding: SPACING.md,
    },
    balanceCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cyan + '30',
    },
    balanceHeader: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    balanceLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
    },
    balanceValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    balanceToken: {
        fontSize: 18,
        color: COLORS.cyan,
        fontWeight: '600',
    },
    balanceActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.lg,
    },
    balanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.cyan,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 4,
        borderRadius: BORDER_RADIUS.full,
    },
    balanceButtonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.cyan,
    },
    balanceButtonText: {
        color: COLORS.background,
        fontWeight: '600',
    },
    balanceButtonTextOutline: {
        color: COLORS.cyan,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: SPACING.lg,
        marginBottom: SPACING.md,
    },
    usageCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
    },
    usageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },
    usageLabel: {
        color: COLORS.textSecondary,
    },
    usageValue: {
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    usageDivider: {
        height: 1,
        backgroundColor: COLORS.surfaceLight,
        marginVertical: SPACING.sm,
    },
    usageNote: {
        color: COLORS.cyan,
        fontSize: 13,
        textAlign: 'center',
        paddingTop: SPACING.sm,
    },
    comingSoon: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    comingSoonTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
        textAlign: 'center',
    },
    comingSoonText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.sm,
        lineHeight: 20,
    },
});
