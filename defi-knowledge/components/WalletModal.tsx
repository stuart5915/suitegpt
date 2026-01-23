// Custom Wallet Modal
// In-app styled modal for wallet actions (connect, disconnect, etc.)

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    TextInput,
    Linking,
    Alert,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

interface WalletModalProps {
    visible: boolean;
    onClose: () => void;
    address: string;
    onDisconnect: () => void;
    onConnect?: (address: string) => void;
}

export default function WalletModal({ visible, onClose, address, onDisconnect, onConnect }: WalletModalProps) {
    const [manualAddress, setManualAddress] = useState('');
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const isConnected = !!address;

    const shortenedAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : '';

    const handleDisconnect = () => {
        setShowDisconnectConfirm(false);
        onDisconnect();
        onClose();
    };

    const handleConnectManual = () => {
        if (!manualAddress.trim()) {
            // Show inline error instead of Alert - just highlight the input
            return;
        }
        if (!manualAddress.startsWith('0x') || manualAddress.length !== 42) {
            // Invalid address - show inline
            return;
        }
        onConnect?.(manualAddress.trim());
        setManualAddress('');
        onClose();
    };

    const handleOpenMetaMask = async () => {
        try {
            await Linking.openURL('metamask://');
        } catch {
            await Linking.openURL('https://metamask.io/download/');
        }
    };

    // Connected state UI
    const renderConnectedContent = () => (
        <>
            <LinearGradient
                colors={[Colors.primary, '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.walletIcon}>
                    <Ionicons name="wallet" size={32} color="#fff" />
                </View>
                <Text style={styles.title}>Wallet Connected</Text>
                <Text style={styles.address}>{shortenedAddress}</Text>
            </LinearGradient>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <Ionicons name="copy-outline" size={20} color={Colors.textPrimary} />
                    <Text style={styles.actionText}>Copy Address</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.disconnectButton]}
                    activeOpacity={0.7}
                    onPress={() => setShowDisconnectConfirm(true)}
                >
                    <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                    <Text style={[styles.actionText, styles.disconnectText]}>Disconnect Wallet</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>

            {/* Disconnect Confirmation Modal */}
            {showDisconnectConfirm && (
                <Animated.View entering={FadeIn} style={styles.confirmOverlay}>
                    <View style={styles.confirmContainer}>
                        <View style={styles.confirmIconWrap}>
                            <Ionicons name="warning" size={40} color={Colors.warning} />
                        </View>
                        <Text style={styles.confirmTitle}>Disconnect Wallet?</Text>
                        <Text style={styles.confirmMessage}>
                            You'll need to reconnect to use DeFi features
                        </Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={styles.confirmCancelBtn}
                                onPress={() => setShowDisconnectConfirm(false)}
                            >
                                <Text style={styles.confirmCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmDisconnectBtn}
                                onPress={handleDisconnect}
                            >
                                <Ionicons name="log-out-outline" size={18} color="#fff" />
                                <Text style={styles.confirmDisconnectText}>Disconnect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            )}
        </>
    );

    // Not connected state UI
    const renderConnectContent = () => (
        <>
            <View style={styles.connectHeader}>
                <View style={styles.connectIcon}>
                    <Ionicons name="wallet-outline" size={40} color={Colors.primary} />
                </View>
                <Text style={styles.connectTitle}>Connect Wallet</Text>
                <Text style={styles.connectSubtitle}>View your balances and execute swaps</Text>
            </View>

            <View style={styles.actions}>
                {/* Step 1: Open MetaMask */}
                <View style={styles.stepContainer}>
                    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                    <Text style={styles.stepText}>Copy your wallet address from MetaMask</Text>
                </View>

                <TouchableOpacity
                    style={styles.walletOption}
                    activeOpacity={0.7}
                    onPress={handleOpenMetaMask}
                >
                    <Text style={styles.walletEmoji}>🦊</Text>
                    <View style={styles.walletInfo}>
                        <Text style={styles.walletName}>Open MetaMask</Text>
                        <Text style={styles.walletDesc}>Copy your wallet address</Text>
                    </View>
                    <Ionicons name="open-outline" size={20} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* Step 2: Paste Address */}
                <View style={[styles.stepContainer, { marginTop: Spacing.lg }]}>
                    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                    <Text style={styles.stepText}>Paste your address here</Text>
                </View>

                <View style={styles.manualSection}>
                    <TextInput
                        style={styles.addressInput}
                        placeholder="0x..."
                        placeholderTextColor={Colors.textMuted}
                        value={manualAddress}
                        onChangeText={setManualAddress}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        style={[styles.connectBtn, !manualAddress && styles.connectBtnDisabled]}
                        onPress={handleConnectManual}
                        disabled={!manualAddress}
                    >
                        <Text style={styles.connectBtnText}>Connect</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
        </>
    );

    console.log('🔵 WalletModal render - visible:', visible, 'isConnected:', isConnected);

    if (!visible) return null;

    return (
        <View style={styles.fullScreenOverlay}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View
                            entering={SlideInDown.springify().damping(15)}
                            style={styles.container}
                        >
                            {isConnected ? renderConnectedContent() : renderConnectContent()}
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreenOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: BorderRadius['2xl'],
        borderTopRightRadius: BorderRadius['2xl'],
        overflow: 'hidden',
    },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing['2xl'],
        paddingHorizontal: Spacing.lg,
    },
    walletIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: '#fff',
        marginBottom: Spacing.xs,
    },
    address: {
        fontSize: Typography.fontSize.base,
        color: 'rgba(255, 255, 255, 0.8)',
        fontFamily: 'SpaceMono',
    },
    actions: {
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.md,
    },
    actionText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '500',
        color: Colors.textPrimary,
    },
    disconnectButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        marginTop: Spacing.sm,
    },
    disconnectText: {
        color: Colors.error,
    },
    closeButton: {
        backgroundColor: Colors.primary,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing['2xl'],
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    // Connect state styles
    connectHeader: {
        alignItems: 'center',
        paddingVertical: Spacing['2xl'],
        paddingHorizontal: Spacing.lg,
    },
    connectIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    connectTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    connectSubtitle: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
    },
    walletOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.md,
    },
    walletEmoji: {
        fontSize: 32,
    },
    walletInfo: {
        flex: 1,
    },
    walletName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    walletDesc: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    manualSection: {
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    manualLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    addressInput: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        fontFamily: 'SpaceMono',
    },
    connectBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    connectBtnDisabled: {
        opacity: 0.5,
    },
    connectBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    cancelButton: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing['2xl'],
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cancelButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    // Step indicator styles
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    stepText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
    },
    // Disconnect confirmation modal styles
    confirmOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    confirmContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
    },
    confirmIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.warning + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    confirmTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    confirmMessage: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    confirmButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        width: '100%',
    },
    confirmCancelBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    confirmCancelText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    confirmDisconnectBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    confirmDisconnectText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
