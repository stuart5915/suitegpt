// Lending Interface Component
// Full lending experience: Supply, Borrow, Repay, Withdraw via Aave V3

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useWalletConnect } from '@/context/WalletConnectContext';
import {
    POLYGON_AAVE_TOKENS,
    getUserAccountData,
    getUserAssetPosition,
    buildSupplyTransaction,
    buildBorrowTransaction,
    buildRepayTransaction,
    buildWithdrawTransaction,
    buildApprovalTransaction,
    checkNeedsApproval,
    getTokenBalance,
    UserPosition,
    AssetPosition,
} from '@/lib/lending';

interface LendingInterfaceProps {
    visible: boolean;
    onClose: () => void;
}

type LendingAction = 'supply' | 'borrow' | 'repay' | 'withdraw';

const ACTIONS: { id: LendingAction; label: string; icon: string; color: string }[] = [
    { id: 'supply', label: 'Supply', icon: 'arrow-down-circle', color: '#22C55E' },
    { id: 'borrow', label: 'Borrow', icon: 'arrow-up-circle', color: '#3B82F6' },
    { id: 'repay', label: 'Repay', icon: 'return-down-back', color: '#F59E0B' },
    { id: 'withdraw', label: 'Withdraw', icon: 'exit-outline', color: '#EF4444' },
];

export default function LendingInterface({ visible, onClose }: LendingInterfaceProps) {
    const { address, isConnected, sendTransaction } = useWalletConnect();

    // Ref for scrolling input into view
    const scrollViewRef = useRef<ScrollView>(null);

    // UI State
    const [selectedAction, setSelectedAction] = useState<LendingAction>('supply');
    const [selectedAsset, setSelectedAsset] = useState(POLYGON_AAVE_TOKENS.MATIC);
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [showAssetPicker, setShowAssetPicker] = useState(false);

    // Position Data
    const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
    const [assetPosition, setAssetPosition] = useState<AssetPosition | null>(null);
    const [walletBalance, setWalletBalance] = useState('0');

    // Result modal
    const [showResult, setShowResult] = useState(false);
    const [resultSuccess, setResultSuccess] = useState(false);
    const [resultMessage, setResultMessage] = useState('');

    // Fetch user data
    const fetchUserData = useCallback(async () => {
        if (!address || !isConnected) return;

        setIsFetchingData(true);
        try {
            const [position, assetPos, balance] = await Promise.all([
                getUserAccountData(address),
                getUserAssetPosition(address, selectedAsset.address),
                getTokenBalance(selectedAsset.address, address, selectedAsset.decimals),
            ]);

            setUserPosition(position);
            setAssetPosition(assetPos);
            setWalletBalance(balance);
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setIsFetchingData(false);
        }
    }, [address, isConnected, selectedAsset]);

    // Fetch data when modal opens or asset changes
    useEffect(() => {
        if (visible && isConnected) {
            fetchUserData();
        }
    }, [visible, isConnected, selectedAsset, fetchUserData]);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setAmount('');
            setShowResult(false);
        }
    }, [visible]);

    // Get max amount based on action
    const getMaxAmount = (): string => {
        switch (selectedAction) {
            case 'supply':
                return walletBalance;
            case 'borrow':
                return userPosition?.availableBorrowsUSD || '0';
            case 'repay':
                return assetPosition?.borrowed || '0';
            case 'withdraw':
                return assetPosition?.supplied || '0';
            default:
                return '0';
        }
    };

    // Handle max button
    const handleMax = () => {
        const max = getMaxAmount();
        // Leave a small buffer for gas on supply
        if (selectedAction === 'supply' && selectedAsset.symbol === 'MATIC') {
            const maxNum = parseFloat(max);
            const buffered = Math.max(0, maxNum - 0.1).toFixed(4);
            setAmount(buffered);
        } else {
            setAmount(parseFloat(max).toFixed(6));
        }
    };

    // Execute lending action
    const handleExecute = async () => {
        if (!address || !amount || parseFloat(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            let tx: { to: string; data: string; value: string };

            // Check if approval is needed for supply/repay
            if (selectedAction === 'supply' || selectedAction === 'repay') {
                const needsApproval = await checkNeedsApproval(
                    selectedAsset.address,
                    address,
                    amount,
                    selectedAsset.decimals
                );

                if (needsApproval) {
                    console.log('🔐 Approval needed, requesting...');
                    const approvalTx = await buildApprovalTransaction(
                        selectedAsset.address,
                        amount,
                        selectedAsset.decimals
                    );

                    const approvalHash = await sendTransaction({
                        ...approvalTx,
                        chainId: 137,
                    });

                    if (!approvalHash) {
                        throw new Error('Approval transaction failed');
                    }

                    console.log('✅ Approval tx:', approvalHash);
                    // Wait a bit for approval to confirm
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            // Build the main transaction
            switch (selectedAction) {
                case 'supply':
                    tx = await buildSupplyTransaction(
                        selectedAsset.address,
                        amount,
                        selectedAsset.decimals,
                        address
                    );
                    break;
                case 'borrow':
                    tx = await buildBorrowTransaction(
                        selectedAsset.address,
                        amount,
                        selectedAsset.decimals,
                        address
                    );
                    break;
                case 'repay':
                    tx = await buildRepayTransaction(
                        selectedAsset.address,
                        amount,
                        selectedAsset.decimals,
                        address
                    );
                    break;
                case 'withdraw':
                    tx = await buildWithdrawTransaction(
                        selectedAsset.address,
                        amount,
                        selectedAsset.decimals,
                        address
                    );
                    break;
            }

            console.log(`📤 Sending ${selectedAction} transaction...`);
            const txHash = await sendTransaction({
                ...tx,
                chainId: 137,
            });

            if (txHash) {
                setResultSuccess(true);
                setResultMessage(`${selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)} successful!\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`);
                setShowResult(true);
                // Refresh data
                setTimeout(fetchUserData, 5000);
            } else {
                throw new Error('Transaction failed or was rejected');
            }
        } catch (error: any) {
            console.error('Lending error:', error);
            setResultSuccess(false);
            setResultMessage(error?.message || 'Transaction failed');
            setShowResult(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Get action description
    const getActionDescription = (): string => {
        switch (selectedAction) {
            case 'supply':
                return 'Deposit assets as collateral to earn interest';
            case 'borrow':
                return 'Borrow against your supplied collateral';
            case 'repay':
                return 'Pay back borrowed assets to reduce debt';
            case 'withdraw':
                return 'Remove supplied assets from the pool';
            default:
                return '';
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                style={styles.modalContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <Animated.View entering={FadeIn.duration(200)} style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <Ionicons name="business" size={24} color={Colors.primary} />
                            <Text style={styles.headerTitle}>Lending</Text>
                            <View style={styles.protocolBadge}>
                                <Text style={styles.protocolText}>Aave V3</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                            <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.scrollContent}
                        contentContainerStyle={styles.scrollContentContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onContentSizeChange={() => {
                            // Auto-scroll when content changes (e.g., keyboard appears)
                        }}
                    >
                        {/* Account Overview */}
                        {userPosition && (
                            <Animated.View entering={FadeInDown.delay(100)} style={styles.positionCard}>
                                <Text style={styles.positionTitle}>Your Position</Text>
                                <View style={styles.positionGrid}>
                                    <View style={styles.positionItem}>
                                        <Text style={styles.positionLabel}>Collateral</Text>
                                        <Text style={styles.positionValue}>${parseFloat(userPosition.totalCollateralUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={styles.positionItem}>
                                        <Text style={styles.positionLabel}>Debt</Text>
                                        <Text style={[styles.positionValue, styles.debtValue]}>${parseFloat(userPosition.totalDebtUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={styles.positionItem}>
                                        <Text style={styles.positionLabel}>Available</Text>
                                        <Text style={styles.positionValue}>${parseFloat(userPosition.availableBorrowsUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={styles.positionItem}>
                                        <Text style={styles.positionLabel}>Health</Text>
                                        <Text style={[styles.positionValue, parseFloat(userPosition.healthFactor) > 2 ? styles.healthGood : styles.healthWarning]}>
                                            {userPosition.healthFactor}
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>
                        )}

                        {/* Action Selector */}
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.actionSelector}>
                            {ACTIONS.map(action => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={[
                                        styles.actionButton,
                                        selectedAction === action.id && { backgroundColor: action.color + '20', borderColor: action.color },
                                    ]}
                                    onPress={() => setSelectedAction(action.id)}
                                >
                                    <Ionicons
                                        name={action.icon as any}
                                        size={20}
                                        color={selectedAction === action.id ? action.color : Colors.textMuted}
                                    />
                                    <Text style={[
                                        styles.actionButtonText,
                                        selectedAction === action.id && { color: action.color },
                                    ]}>
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </Animated.View>

                        {/* Action Description */}
                        <Text style={styles.actionDescription}>{getActionDescription()}</Text>

                        {/* Asset Selector */}
                        <Animated.View entering={FadeInDown.delay(300)}>
                            <TouchableOpacity
                                style={styles.assetSelector}
                                onPress={() => setShowAssetPicker(true)}
                            >
                                <View style={styles.assetInfo}>
                                    <View style={styles.assetIcon}>
                                        <Text style={{ fontSize: 20 }}>{selectedAsset.symbol === 'MATIC' ? '🟣' : '🪙'}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.assetSymbol}>{selectedAsset.symbol}</Text>
                                        {assetPosition && (
                                            <Text style={styles.assetBalance}>
                                                {selectedAction === 'supply' || selectedAction === 'repay'
                                                    ? `Wallet: ${parseFloat(walletBalance).toFixed(4)}`
                                                    : selectedAction === 'withdraw'
                                                        ? `Supplied: ${parseFloat(assetPosition.supplied).toFixed(4)}`
                                                        : `Borrowed: ${parseFloat(assetPosition.borrowed).toFixed(4)}`
                                                }
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Amount Input */}
                        <Animated.View entering={FadeInDown.delay(400)} style={styles.inputContainer}>
                            <View style={styles.inputHeader}>
                                <Text style={styles.inputLabel}>Amount</Text>
                                <TouchableOpacity onPress={handleMax}>
                                    <Text style={styles.maxButton}>MAX</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="0.00"
                                    placeholderTextColor={Colors.textMuted}
                                    keyboardType="decimal-pad"
                                    editable={!isLoading}
                                    onFocus={() => {
                                        // Scroll to make sure execute button is visible above keyboard
                                        setTimeout(() => {
                                            scrollViewRef.current?.scrollToEnd({ animated: true });
                                        }, 150);
                                    }}
                                />
                                <Text style={styles.inputSuffix}>{selectedAsset.symbol}</Text>
                            </View>
                        </Animated.View>

                        {/* APY Info */}
                        {assetPosition && (
                            <Animated.View entering={FadeInDown.delay(500)} style={styles.apyRow}>
                                {(selectedAction === 'supply' || selectedAction === 'withdraw') && (
                                    <View style={styles.apyItem}>
                                        <Text style={styles.apyLabel}>Supply APY</Text>
                                        <Text style={[styles.apyValue, styles.apyPositive]}>{assetPosition.supplyAPY}</Text>
                                    </View>
                                )}
                                {(selectedAction === 'borrow' || selectedAction === 'repay') && (
                                    <View style={styles.apyItem}>
                                        <Text style={styles.apyLabel}>Borrow APY</Text>
                                        <Text style={[styles.apyValue, styles.apyNegative]}>{assetPosition.borrowAPY}</Text>
                                    </View>
                                )}
                            </Animated.View>
                        )}

                        {/* Execute Button */}
                        <TouchableOpacity
                            style={[
                                styles.executeButton,
                                { backgroundColor: ACTIONS.find(a => a.id === selectedAction)?.color || Colors.primary },
                                (!amount || parseFloat(amount) <= 0 || isLoading) && styles.executeButtonDisabled,
                            ]}
                            onPress={handleExecute}
                            disabled={!amount || parseFloat(amount) <= 0 || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons
                                        name={ACTIONS.find(a => a.id === selectedAction)?.icon as any}
                                        size={20}
                                        color="#fff"
                                    />
                                    <Text style={styles.executeButtonText}>
                                        {selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)} {selectedAsset.symbol}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Warning for borrowing */}
                        {selectedAction === 'borrow' && (
                            <View style={styles.warningBox}>
                                <Ionicons name="warning" size={16} color="#F59E0B" />
                                <Text style={styles.warningText}>
                                    Borrowing increases your debt. If your health factor drops below 1, your collateral may be liquidated.
                                </Text>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>

                    {/* Asset Picker Modal */}
                    <Modal visible={showAssetPicker} animationType="fade" transparent>
                        <View style={styles.pickerOverlay}>
                            <View style={styles.pickerContent}>
                                <View style={styles.pickerHeader}>
                                    <Text style={styles.pickerTitle}>Select Asset</Text>
                                    <TouchableOpacity onPress={() => setShowAssetPicker(false)}>
                                        <Ionicons name="close" size={24} color={Colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                                {Object.values(POLYGON_AAVE_TOKENS).map(token => (
                                    <TouchableOpacity
                                        key={token.symbol}
                                        style={[
                                            styles.pickerItem,
                                            selectedAsset.symbol === token.symbol && styles.pickerItemSelected,
                                        ]}
                                        onPress={() => {
                                            setSelectedAsset(token);
                                            setShowAssetPicker(false);
                                            setAmount('');
                                        }}
                                    >
                                        <Text style={{ fontSize: 24, marginRight: 12 }}>
                                            {token.symbol === 'MATIC' ? '🟣' : token.symbol === 'WETH' ? '💎' : token.symbol === 'WBTC' ? '🟠' : '💵'}
                                        </Text>
                                        <Text style={styles.pickerItemText}>{token.symbol}</Text>
                                        {selectedAsset.symbol === token.symbol && (
                                            <Ionicons name="checkmark" size={20} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </Modal>

                    {/* Result Modal */}
                    <Modal visible={showResult} animationType="fade" transparent>
                        <View style={styles.resultOverlay}>
                            <View style={styles.resultContent}>
                                <View style={[styles.resultIcon, resultSuccess ? styles.resultSuccess : styles.resultError]}>
                                    <Ionicons
                                        name={resultSuccess ? 'checkmark-circle' : 'close-circle'}
                                        size={48}
                                        color={resultSuccess ? '#22C55E' : '#EF4444'}
                                    />
                                </View>
                                <Text style={styles.resultTitle}>{resultSuccess ? 'Success!' : 'Error'}</Text>
                                <Text style={styles.resultMessage}>{resultMessage}</Text>
                                <TouchableOpacity
                                    style={styles.resultButton}
                                    onPress={() => {
                                        setShowResult(false);
                                        if (resultSuccess) {
                                            setAmount('');
                                        }
                                    }}
                                >
                                    <Text style={styles.resultButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingTop: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    protocolBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    protocolText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        color: Colors.primary,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
    },
    scrollContentContainer: {
        paddingTop: Spacing.md,
        paddingBottom: 100, // Extra padding for keyboard
    },

    // Position Card
    positionCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    positionTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textMuted,
        marginBottom: Spacing.sm,
    },
    positionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    positionItem: {
        width: '50%',
        paddingVertical: Spacing.xs,
    },
    positionLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    positionValue: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    debtValue: {
        color: '#EF4444',
    },
    healthGood: {
        color: '#22C55E',
    },
    healthWarning: {
        color: '#F59E0B',
    },

    // Action Selector
    actionSelector: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    actionButtonText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        color: Colors.textMuted,
    },
    actionDescription: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },

    // Asset Selector
    assetSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    assetInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    assetIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assetSymbol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    assetBalance: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Input
    inputContainer: {
        marginBottom: Spacing.md,
    },
    inputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    inputLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    maxButton: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        paddingRight: Spacing.md,
    },
    input: {
        flex: 1,
        fontSize: Typography.fontSize.xl,
        fontWeight: '600',
        color: Colors.textPrimary,
        padding: Spacing.md,
    },
    inputSuffix: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textMuted,
    },

    // APY
    apyRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    apyItem: {
        alignItems: 'center',
    },
    apyLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    apyValue: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
    },
    apyPositive: {
        color: '#22C55E',
    },
    apyNegative: {
        color: '#EF4444',
    },

    // Execute Button
    executeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 16,
        borderRadius: BorderRadius.lg,
    },
    executeButtonDisabled: {
        opacity: 0.5,
    },
    executeButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Warning
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: '#F59E0B20',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    warningText: {
        flex: 1,
        fontSize: Typography.fontSize.xs,
        color: '#F59E0B',
        lineHeight: 18,
    },

    // Asset Picker Modal
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    pickerContent: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    pickerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    pickerItemSelected: {
        backgroundColor: Colors.primary + '10',
        marginHorizontal: -Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    pickerItemText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '500',
        color: Colors.textPrimary,
    },

    // Result Modal
    resultOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    resultContent: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    resultIcon: {
        marginBottom: Spacing.md,
    },
    resultSuccess: {},
    resultError: {},
    resultTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    resultMessage: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    resultButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.md,
    },
    resultButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
});
