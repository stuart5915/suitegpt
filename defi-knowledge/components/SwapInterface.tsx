// SwapInterface Component
// Token swap UI with quote display and execution
// Integrates with wallet store and 1inch swap API

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    ScrollView,
    Pressable,
    Alert,
    Keyboard,
    Platform,
    InputAccessoryView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useWalletStore, TokenInfo, COMMON_TOKENS, shortenAddress, getChainById } from '@/lib/wallet';
import { getSwapQuote, SwapQuote, formatTokenAmount } from '@/lib/swap';
import { useWalletConnect } from '@/context/WalletConnectContext';

interface Props {
    visible: boolean;
    chainId: number;
    protocolName?: string;
    onClose: () => void;
    inline?: boolean; // When true, renders as a regular View instead of Modal
    onInputFocus?: () => void; // Called when input is focused, parent can scroll
}

export default function SwapInterface({ visible, chainId, protocolName, onClose, inline = false, onInputFocus }: Props) {
    const { address, isConnected, balances, isLoadingBalances, fetchBalances, setChainId } = useWalletStore();
    const { sendTransaction } = useWalletConnect();
    const chain = getChainById(chainId);
    const tokens = COMMON_TOKENS[chainId] || [];

    const [fromToken, setFromToken] = useState<TokenInfo | null>(tokens[0] || null);
    const [toToken, setToToken] = useState<TokenInfo | null>(tokens[1] || null);
    const [fromAmount, setFromAmount] = useState('');
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [showTokenPicker, setShowTokenPicker] = useState<'from' | 'to' | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Custom modal states (to replace system Alert)
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null);
    const [pendingSwapResolve, setPendingSwapResolve] = useState<((value: boolean) => void) | null>(null);

    // Pending transaction state - for showing processing indicator
    const [pendingTx, setPendingTx] = useState<{
        txHash: string;
        fromSymbol: string;
        toSymbol: string;
        amount: string;
        initialToBalance: string;
    } | null>(null);

    // Update tokens and fetch fresh balances when chain changes or modal opens
    useEffect(() => {
        const chainTokens = COMMON_TOKENS[chainId] || [];
        console.log('🔄 SwapInterface: chain changed to', chainId, 'tokens:', chainTokens.map(t => t.symbol));
        setFromToken(chainTokens[0] || null);
        setToToken(chainTokens[1] || null);
        setQuote(null);
        setFromAmount('');

        // Ensure we're fetching balances for the correct chain
        if (visible && isConnected) {
            console.log('🔄 SwapInterface: triggering balance fetch for chain', chainId);
            setChainId(chainId);
        }
    }, [chainId, visible, isConnected]);

    // Fetch quote when amount changes
    useEffect(() => {
        const fetchQuote = async () => {
            if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
                setQuote(null);
                return;
            }

            setIsLoadingQuote(true);
            setError(null);

            try {
                const result = await getSwapQuote(chainId, fromToken, toToken, fromAmount);
                setQuote(result);
            } catch (e) {
                setError('Failed to get quote');
                setQuote(null);
            } finally {
                setIsLoadingQuote(false);
            }
        };

        const debounce = setTimeout(fetchQuote, 500);
        return () => clearTimeout(debounce);
    }, [fromToken, toToken, fromAmount, chainId]);

    // Poll for balance changes when there's a pending tx
    useEffect(() => {
        if (!pendingTx) return;

        console.log('⏳ Pending tx detected, starting balance polling...');
        let pollCount = 0;
        const maxPolls = 20; // Poll for ~30 seconds

        const pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`⏳ Polling balances (${pollCount}/${maxPolls})...`);
            await fetchBalances();

            // Check if balance changed
            const newBalance = balances.find(b => b.token.symbol === pendingTx.toSymbol);
            if (newBalance && newBalance.formattedBalance !== pendingTx.initialToBalance) {
                console.log('✅ Balance changed! Tx confirmed:', pendingTx.initialToBalance, '->', newBalance.formattedBalance);
                setPendingTx(null);
                clearInterval(pollInterval);
            } else if (pollCount >= maxPolls) {
                console.log('⚠️ Polling timeout - tx may still be pending');
                setPendingTx(null);
                clearInterval(pollInterval);
            }
        }, 1500);

        return () => clearInterval(pollInterval);
    }, [pendingTx, balances, fetchBalances]);

    const handleSwapTokens = () => {
        const temp = fromToken;
        setFromToken(toToken);
        setToToken(temp);
        setQuote(null);
    };

    const handleSelectToken = (token: TokenInfo) => {
        if (showTokenPicker === 'from') {
            if (token.address === toToken?.address) {
                // Swap positions
                setToToken(fromToken);
            }
            setFromToken(token);
        } else {
            if (token.address === fromToken?.address) {
                setFromToken(toToken);
            }
            setToToken(token);
        }
        setShowTokenPicker(null);
        setQuote(null);
    };

    const handleMaxAmount = () => {
        console.log('📊 Max clicked - fromToken:', fromToken?.symbol);
        console.log('📊 Balances:', balances);
        if (!fromToken) return;
        const balance = balances.find(b => b.token.address.toLowerCase() === fromToken.address.toLowerCase());
        console.log('📊 Found balance:', balance);
        if (balance) {
            // Leave a tiny amount for gas if native token
            // Gas is very cheap now (~1-2 cents), so only reserve 0.00001 native token
            const isNative = fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
            const balanceNum = parseFloat(balance.formattedBalance);
            const gasBuffer = isNative ? 0.00001 : 0; // ~$0.02-0.03 buffer for gas
            const maxAmount = Math.max(0, balanceNum - gasBuffer);
            console.log('📊 Setting amount to:', maxAmount);
            setFromAmount(maxAmount > 0 ? maxAmount.toFixed(6) : '');
        }
    };

    const handleSwap = async () => {
        if (!quote || !isConnected || !address) return;

        // Show custom confirmation modal
        const confirmed = await new Promise<boolean>((resolve) => {
            setPendingSwapResolve(() => resolve);
            setShowConfirmModal(true);
        });

        if (!confirmed) return;

        try {
            setIsLoadingQuote(true);
            setError(null);

            // Build the swap transaction
            const { buildSwapTransaction } = await import('@/lib/swap');
            const tx = await buildSwapTransaction(chainId, fromToken!, toToken!, fromAmount, address, 1);

            if (!tx) {
                setShowResultModal({
                    type: 'error',
                    title: 'Swap Error',
                    message: 'Failed to build swap transaction. The swap may not be available for this pair.'
                });
                setIsLoadingQuote(false);
                return;
            }

            // Actually send the transaction via WalletConnect!
            // This will open the wallet app for approval
            console.log('📤 Sending swap transaction on chain:', chainId);
            const txHash = await sendTransaction({
                to: tx.to,
                data: tx.data,
                value: tx.value,
                gasLimit: tx.gasLimit,
                chainId: chainId, // Tell wallet to switch to this chain
            });

            if (txHash) {
                // Transaction was sent successfully - dismiss keyboard
                Keyboard.dismiss();

                // Get current toToken balance before it changes
                const currentToBalance = balances.find(b => b.token.symbol === toToken!.symbol)?.formattedBalance || '0';

                setShowResultModal({
                    type: 'success',
                    title: 'Transaction Sent',
                    message: `Your ${fromToken!.symbol} → ${toToken!.symbol} swap is processing.\n\nBalances will update automatically when confirmed.`
                });

                // Set pending tx to trigger balance polling
                setPendingTx({
                    txHash,
                    fromSymbol: fromToken!.symbol,
                    toSymbol: toToken!.symbol,
                    amount: fromAmount,
                    initialToBalance: currentToBalance,
                });

                // Clear inputs
                setFromAmount('');
                setQuote(null);
                // Initial balance refresh
                setTimeout(() => fetchBalances(), 3000);
            } else {
                // txHash is null - might be user cancelled or error
                // Don't show error if component is still mounted - transaction might have been sent
                setShowResultModal({
                    type: 'error',
                    title: 'Transaction Not Confirmed',
                    message: 'Could not confirm the transaction was sent. Check your wallet activity to see if it went through, and refresh balances.'
                });
                // Refresh balances anyway in case it did go through
                setTimeout(() => fetchBalances(), 2000);
            }

            setIsLoadingQuote(false);
        } catch (err: any) {
            console.error('Swap error:', err);

            // Check if error is from user rejection
            const errorMsg = err?.message?.toLowerCase() || '';
            const isUserRejected = errorMsg.includes('reject') || errorMsg.includes('denied') || errorMsg.includes('cancel');

            if (isUserRejected) {
                setShowResultModal({
                    type: 'error',
                    title: 'Transaction Cancelled',
                    message: 'You cancelled the transaction in your wallet.'
                });
            } else {
                // For other errors, the transaction might have actually succeeded
                // if we got disconnected during confirmation
                setShowResultModal({
                    type: 'error',
                    title: 'Transaction Status Unknown',
                    message: 'Could not confirm transaction status. Please check your wallet activity and refresh balances.'
                });
                // Refresh balances in case it went through
                setTimeout(() => fetchBalances(), 2000);
            }
            setIsLoadingQuote(false);
        }
    };

    const handleConfirmSwap = () => {
        setShowConfirmModal(false);
        pendingSwapResolve?.(true);
        setPendingSwapResolve(null);
    };

    const handleCancelSwap = () => {
        setShowConfirmModal(false);
        pendingSwapResolve?.(false);
        setPendingSwapResolve(null);
    };

    const getTokenBalance = (token: TokenInfo | null): string => {
        if (!token) return '0';
        console.log('💵 Looking for balance of', token.symbol, token.address);
        console.log('💵 Available balances:', balances.map(b => `${b.token.symbol}(${b.token.address.slice(0, 10)}...): ${b.formattedBalance}`));
        const balance = balances.find(b => b.token.address.toLowerCase() === token.address.toLowerCase());
        console.log('💵 Found:', balance?.formattedBalance || '0');
        return balance?.formattedBalance || '0';
    };

    const renderTokenPicker = () => (
        <Modal visible={showTokenPicker !== null} transparent animationType="fade">
            <Pressable style={styles.pickerOverlay} onPress={() => setShowTokenPicker(null)}>
                <Pressable style={styles.pickerModal} onPress={() => { }}>
                    <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>Select Token</Text>
                        <TouchableOpacity onPress={() => setShowTokenPicker(null)}>
                            <Ionicons name="close" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView>
                        {tokens.map(token => {
                            const balance = balances.find(b => b.token.address === token.address);
                            return (
                                <TouchableOpacity
                                    key={token.address}
                                    style={styles.tokenOption}
                                    onPress={() => handleSelectToken(token)}
                                >
                                    <View style={styles.tokenOptionLeft}>
                                        <View style={styles.tokenIcon}>
                                            <Text style={styles.tokenIconText}>{token.symbol.slice(0, 2)}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                                            <Text style={styles.tokenName}>{token.name}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.tokenBalance}>
                                        {balance?.formattedBalance || '0'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Shared swap UI content
    const swapContent = (
        <>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={inline ? styles.inlineTitle : styles.title}>🔄 Swap</Text>
                    {protocolName && (
                        <Text style={styles.subtitle}>via {protocolName}</Text>
                    )}
                </View>
                {!inline && (
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Pending Transaction Banner */}
            {pendingTx && (
                <Animated.View entering={FadeIn} style={styles.pendingBanner}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <View style={styles.pendingBannerText}>
                        <Text style={styles.pendingBannerTitle}>
                            Processing {pendingTx.fromSymbol} → {pendingTx.toSymbol}
                        </Text>
                        <Text style={styles.pendingBannerSub}>
                            Waiting for confirmation...
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* From token */}
            <View style={styles.tokenBox}>
                <View style={styles.tokenBoxHeader}>
                    <Text style={styles.tokenBoxLabel}>From</Text>
                    <TouchableOpacity onPress={handleMaxAmount}>
                        <Text style={styles.balanceText}>
                            Balance: {getTokenBalance(fromToken)} <Text style={styles.maxBtn}>MAX</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.tokenBoxRow}>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0.0"
                        placeholderTextColor={Colors.textMuted}
                        value={fromAmount}
                        onChangeText={setFromAmount}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        onFocus={onInputFocus}
                        inputAccessoryViewID={Platform.OS === 'ios' ? 'swapAccessory' : undefined}
                    />
                    <TouchableOpacity
                        style={styles.tokenSelector}
                        onPress={() => setShowTokenPicker('from')}
                    >
                        {fromToken ? (
                            <>
                                <Text style={styles.tokenSelectorSymbol}>{fromToken.symbol}</Text>
                                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                            </>
                        ) : (
                            <Text style={styles.tokenSelectorPlaceholder}>Select</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Swap direction button */}
            <TouchableOpacity style={styles.swapButton} onPress={handleSwapTokens}>
                <Ionicons name="swap-vertical" size={20} color={Colors.primary} />
            </TouchableOpacity>

            {/* To token */}
            <View style={styles.tokenBox}>
                <View style={styles.tokenBoxHeader}>
                    <Text style={styles.tokenBoxLabel}>To</Text>
                    <Text style={styles.balanceText}>
                        Balance: {getTokenBalance(toToken)}
                    </Text>
                </View>
                <View style={styles.tokenBoxRow}>
                    <Text style={styles.outputAmount}>
                        {isLoadingQuote ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : quote ? (
                            formatTokenAmount(quote.toAmountFormatted, toToken?.decimals || 18)
                        ) : (
                            '0.0'
                        )}
                    </Text>
                    <TouchableOpacity
                        style={styles.tokenSelector}
                        onPress={() => setShowTokenPicker('to')}
                    >
                        {toToken ? (
                            <>
                                <Text style={styles.tokenSelectorSymbol}>{toToken.symbol}</Text>
                                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                            </>
                        ) : (
                            <Text style={styles.tokenSelectorPlaceholder}>Select</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quote details */}
            {quote && (
                <View style={styles.quoteDetails}>
                    <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>Rate</Text>
                        <Text style={styles.quoteValue}>
                            1 {fromToken?.symbol} = {(parseFloat(quote.toAmountFormatted) / parseFloat(quote.fromAmount)).toFixed(6)} {toToken?.symbol}
                        </Text>
                    </View>
                    <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>Price Impact</Text>
                        <Text style={[styles.quoteValue, { color: Colors.success }]}>{quote.priceImpact}</Text>
                    </View>
                </View>
            )}

            {/* Error message */}
            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Swap button */}
            <TouchableOpacity
                style={[
                    styles.swapActionButton,
                    (!quote || !isConnected) && styles.swapActionButtonDisabled
                ]}
                onPress={handleSwap}
                disabled={!quote || !isConnected}
            >
                <Text style={styles.swapActionButtonText}>
                    {!isConnected ? 'Connect Wallet' : quote ? 'Swap' : 'Enter Amount'}
                </Text>
            </TouchableOpacity>

            {/* Token picker modal - always show as modal */}
            {renderTokenPicker()}

            {/* Custom Confirmation Modal */}
            <Modal visible={showConfirmModal} transparent animationType="fade">
                <Pressable style={styles.confirmOverlay} onPress={handleCancelSwap}>
                    <Pressable style={styles.confirmContainer}>
                        <View style={styles.confirmHeader}>
                            <Text style={styles.confirmEmoji}>🔄</Text>
                            <Text style={styles.confirmTitle}>Confirm Swap</Text>
                        </View>

                        <View style={styles.confirmDetails}>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>From</Text>
                                <Text style={styles.confirmValue}>{quote?.fromAmount} {quote?.fromToken.symbol}</Text>
                            </View>
                            <View style={styles.confirmArrow}>
                                <Ionicons name="arrow-down" size={20} color={Colors.textMuted} />
                            </View>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>To</Text>
                                <Text style={[styles.confirmValue, { color: Colors.success }]}>~{quote?.toAmountFormatted} {quote?.toToken.symbol}</Text>
                            </View>
                            <View style={styles.confirmDivider} />
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>Rate</Text>
                                <Text style={styles.confirmSmall}>1 {quote?.fromToken.symbol} = {quote ? (parseFloat(quote.toAmountFormatted) / parseFloat(quote.fromAmount)).toFixed(6) : '0'} {quote?.toToken.symbol}</Text>
                            </View>
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmLabel}>Price Impact</Text>
                                <Text style={[styles.confirmSmall, { color: Colors.success }]}>{quote?.priceImpact || '0%'}</Text>
                            </View>
                        </View>

                        <View style={styles.confirmButtons}>
                            <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleCancelSwap}>
                                <Text style={styles.confirmCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmSwapBtn} onPress={handleConfirmSwap}>
                                <Ionicons name="swap-horizontal" size={18} color="#fff" />
                                <Text style={styles.confirmSwapText}>Confirm Swap</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Custom Result Modal */}
            <Modal visible={!!showResultModal} transparent animationType="fade">
                <View style={styles.confirmOverlay}>
                    <Pressable style={styles.confirmOverlay} onPress={() => setShowResultModal(null)}>
                        <View />
                    </Pressable>
                    <View style={[styles.confirmContainer, styles.resultModalContainer]}>
                        <View style={styles.resultIconContainer}>
                            <Ionicons
                                name={showResultModal?.type === 'success' ? 'checkmark-circle' : 'close-circle'}
                                size={56}
                                color={showResultModal?.type === 'success' ? Colors.success : Colors.error}
                            />
                        </View>
                        <Text style={styles.resultTitle}>{showResultModal?.title}</Text>
                        <Text style={styles.resultMessage}>{showResultModal?.message}</Text>
                        <TouchableOpacity
                            style={[styles.resultOkBtn, showResultModal?.type === 'success' && { backgroundColor: Colors.success }]}
                            onPress={() => setShowResultModal(null)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.resultOkText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );

    // Keyboard accessory for iOS - shows quote preview and done button
    const keyboardAccessory = Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID="swapAccessory">
            <View style={styles.keyboardAccessory}>
                {quote ? (
                    <Text style={styles.accessoryQuote}>
                        → {quote.toAmountFormatted} {toToken?.symbol}
                    </Text>
                ) : (
                    <Text style={styles.accessoryHint}>Enter amount above</Text>
                )}
                <TouchableOpacity
                    style={styles.accessoryDoneBtn}
                    onPress={() => Keyboard.dismiss()}
                >
                    <Text style={styles.accessoryDoneBtnText}>Done</Text>
                </TouchableOpacity>
            </View>
        </InputAccessoryView>
    ) : null;

    // Inline mode - render directly in place
    if (inline) {
        if (!visible) return null;
        return (
            <>
                <Animated.View entering={FadeIn.duration(200)} style={styles.inlineContainer}>
                    {swapContent}
                </Animated.View>
                {keyboardAccessory}
            </>
        );
    }

    // Modal mode - render as overlay
    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }}>
                <Pressable style={styles.container} onPress={() => Keyboard.dismiss()}>
                    <Animated.View entering={FadeIn.duration(200)}>
                        {swapContent}
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    container: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    subtitle: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    // Inline mode styles
    inlineContainer: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    inlineTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    // Keyboard accessory styles
    keyboardAccessory: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    accessoryQuote: {
        fontSize: Typography.fontSize.sm,
        color: Colors.success,
        fontWeight: '600',
    },
    accessoryHint: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    accessoryDoneBtn: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    accessoryDoneBtnText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: Typography.fontSize.base,
    },
    chainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
    },
    chainEmoji: { fontSize: 16 },
    chainName: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

    // Token boxes
    tokenBox: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.xs,
    },
    tokenBoxHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    tokenBoxLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    balanceText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    maxBtn: {
        color: Colors.primary,
        fontWeight: '600',
    },
    tokenBoxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    amountInput: {
        flex: 1,
        fontSize: 28,
        fontWeight: '600',
        color: Colors.textPrimary,
        padding: 0,
    },
    outputAmount: {
        flex: 1,
        fontSize: 28,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tokenSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.surface,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.full,
    },
    tokenSelectorSymbol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tokenSelectorPlaceholder: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },

    // Swap button
    swapButton: {
        alignSelf: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.sm,
        borderRadius: BorderRadius.full,
        marginVertical: -Spacing.sm,
        zIndex: 1,
        borderWidth: 3,
        borderColor: Colors.background,
    },

    // Quote details
    quoteDetails: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginTop: Spacing.md,
        gap: Spacing.xs,
    },
    quoteRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quoteLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    quoteValue: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
        fontWeight: '500',
    },

    // Error
    errorText: {
        color: Colors.error,
        fontSize: Typography.fontSize.sm,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    // Action button
    swapActionButton: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    swapActionButtonDisabled: {
        backgroundColor: Colors.border,
    },
    swapActionButtonText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Wallet status
    walletStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: Spacing.md,
    },
    walletAddress: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Token picker
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerModal: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        maxHeight: '60%',
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    pickerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tokenOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tokenOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tokenIconText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    tokenSymbol: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tokenName: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    tokenBalance: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },

    // Confirmation Modal Styles
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    confirmContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    confirmHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    confirmEmoji: {
        fontSize: 28,
    },
    confirmTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    confirmDetails: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    confirmLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    confirmValue: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    confirmSmall: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
    },
    confirmArrow: {
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    confirmDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.sm,
    },
    confirmButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    confirmCancelBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        alignItems: 'center',
    },
    confirmCancelText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textMuted,
    },
    confirmSwapBtn: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    confirmSwapText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: '#fff',
    },
    resultModalContainer: {
        position: 'absolute',
        alignSelf: 'center',
    },
    resultIconContainer: {
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    resultTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    resultMessage: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    resultOkBtn: {
        width: '100%',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultOkText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: '#fff',
    },
    pendingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
    },
    pendingBannerText: {
        flex: 1,
    },
    pendingBannerTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    pendingBannerSub: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
});
