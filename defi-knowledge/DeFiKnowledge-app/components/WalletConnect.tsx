// Wallet Connection Component
// Beautiful UI for connecting Web3 wallets with guided onboarding

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Linking,
    Alert,
    Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useWalletStore, shortenAddress } from '@/lib/wallet';

interface WalletConnectProps {
    visible: boolean;
    onClose: () => void;
    onConnect?: () => void;
}

const WALLET_OPTIONS = [
    {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        description: 'Popular browser wallet',
        deepLink: 'https://metamask.app.link/dapp/',
        downloadUrl: 'https://metamask.io/download/',
    },
    {
        id: 'rainbow',
        name: 'Rainbow',
        icon: '🌈',
        description: 'Mobile-first wallet',
        deepLink: 'rainbow://',
        downloadUrl: 'https://rainbow.me/',
    },
    {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: '🔵',
        description: 'Easy for beginners',
        deepLink: 'cbwallet://',
        downloadUrl: 'https://www.coinbase.com/wallet',
    },
    {
        id: 'trust',
        name: 'Trust Wallet',
        icon: '🛡️',
        description: 'Multi-chain support',
        deepLink: 'trust://',
        downloadUrl: 'https://trustwallet.com/',
    },
];

type Step = 'choose' | 'download' | 'connect' | 'success';

export default function WalletConnect({ visible, onClose, onConnect }: WalletConnectProps) {
    const [step, setStep] = useState<Step>('choose');
    const [selectedWallet, setSelectedWallet] = useState(WALLET_OPTIONS[0]);
    const [manualAddress, setManualAddress] = useState('');
    const { connectWallet, isConnected, address } = useWalletStore();

    useEffect(() => {
        if (visible) {
            setStep('choose');
            setManualAddress('');
        }
    }, [visible]);

    const handleWalletSelect = (wallet: typeof WALLET_OPTIONS[0]) => {
        setSelectedWallet(wallet);
        setStep('download');
    };

    const handleOpenWallet = async () => {
        try {
            // Try to open the wallet app
            const supported = await Linking.canOpenURL(selectedWallet.deepLink);
            if (supported) {
                await Linking.openURL(selectedWallet.deepLink);
            } else {
                // Open download page if wallet not installed
                await Linking.openURL(selectedWallet.downloadUrl);
            }
        } catch (e) {
            // Fallback to download page
            await Linking.openURL(selectedWallet.downloadUrl);
        }
    };

    const handleConnect = async () => {
        if (!manualAddress.trim()) {
            Alert.alert('Enter Address', 'Please paste your wallet address');
            return;
        }

        // Basic validation
        if (!manualAddress.startsWith('0x') || manualAddress.length !== 42) {
            Alert.alert('Invalid Address', 'Please enter a valid Ethereum address (starts with 0x, 42 characters)');
            return;
        }

        await connectWallet(manualAddress.trim());
        setStep('success');

        setTimeout(() => {
            onConnect?.();
            onClose();
        }, 2000);
    };

    const renderChooseStep = () => (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose Your Wallet</Text>
            <Text style={styles.stepDescription}>
                Connect a Web3 wallet to claim your NFT badges after completing courses
            </Text>

            <View style={styles.walletList}>
                {WALLET_OPTIONS.map((wallet, index) => (
                    <Animated.View
                        key={wallet.id}
                        entering={FadeInDown.delay(index * 100).duration(300)}
                    >
                        <TouchableOpacity
                            style={styles.walletOption}
                            onPress={() => handleWalletSelect(wallet)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.walletIcon}>{wallet.icon}</Text>
                            <View style={styles.walletInfo}>
                                <Text style={styles.walletName}>{wallet.name}</Text>
                                <Text style={styles.walletDesc}>{wallet.description}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </View>

            <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipText}>I'll do this later</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderDownloadStep = () => (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
            <Text style={styles.bigEmoji}>{selectedWallet.icon}</Text>
            <Text style={styles.stepTitle}>Get {selectedWallet.name}</Text>
            <Text style={styles.stepDescription}>
                Download and set up your wallet first. This is where you'll store your NFT badges!
            </Text>

            <View style={styles.instructionList}>
                <View style={styles.instruction}>
                    <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>Download {selectedWallet.name}</Text>
                </View>
                <View style={styles.instruction}>
                    <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>Create your wallet & save seed phrase</Text>
                </View>
                <View style={styles.instruction}>
                    <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>Copy your wallet address</Text>
                </View>
            </View>

            <TouchableOpacity onPress={handleOpenWallet} activeOpacity={0.8}>
                <LinearGradient
                    colors={['#a855f7', '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                >
                    <Ionicons name="download" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Download {selectedWallet.name}</Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep('connect')}
            >
                <Text style={styles.secondaryBtnText}>I already have it →</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('choose')}>
                <Text style={styles.backText}>← Choose different wallet</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderConnectStep = () => (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect Your Wallet</Text>
            <Text style={styles.stepDescription}>
                Paste your {selectedWallet.name} address below to connect
            </Text>

            <View style={styles.addressInputContainer}>
                <TextInput
                    style={styles.addressInput}
                    placeholder="0x..."
                    placeholderTextColor={Colors.textMuted}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={false}
                />
            </View>

            <View style={styles.tipBox}>
                <Ionicons name="information-circle" size={18} color={Colors.info} />
                <Text style={styles.tipText}>
                    Find your address in {selectedWallet.name} by tapping your wallet icon at the top
                </Text>
            </View>

            <TouchableOpacity onPress={handleConnect} activeOpacity={0.8}>
                <LinearGradient
                    colors={['#a855f7', '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                >
                    <Ionicons name="wallet" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Connect Wallet</Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('download')}>
                <Text style={styles.backText}>← Back to setup</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderSuccessStep = () => (
        <Animated.View entering={ZoomIn.duration(400)} style={styles.stepContent}>
            <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Wallet Connected!</Text>
            <Text style={styles.successAddress}>{shortenAddress(address || '')}</Text>
            <Text style={styles.stepDescription}>
                You can now claim NFT badges when you complete courses 🎉
            </Text>
        </Animated.View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Connect Wallet</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {step === 'choose' && renderChooseStep()}
                    {step === 'download' && renderDownloadStep()}
                    {step === 'connect' && renderConnectStep()}
                    {step === 'success' && renderSuccessStep()}
                </View>

                {/* Progress dots */}
                {step !== 'success' && (
                    <View style={styles.progressDots}>
                        {['choose', 'download', 'connect'].map((s, i) => (
                            <View
                                key={s}
                                style={[
                                    styles.dot,
                                    (step === s ||
                                        (step === 'download' && s === 'choose') ||
                                        (step === 'connect' && s !== 'connect')
                                    ) && styles.dotActive
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    closeBtn: {
        padding: Spacing.xs,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    stepContent: {
        flex: 1,
        paddingTop: Spacing['2xl'],
    },
    stepTitle: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    stepDescription: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.xl,
    },
    bigEmoji: {
        fontSize: 64,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },

    // Wallet list
    walletList: {
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    walletOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    walletIcon: {
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
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },

    // Instructions
    instructionList: {
        gap: Spacing.md,
        marginBottom: Spacing['2xl'],
    },
    instruction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    instructionNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary + '30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructionNumberText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    instructionText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
    },

    // Buttons
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    primaryBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    secondaryBtn: {
        alignItems: 'center',
        padding: Spacing.md,
    },
    secondaryBtnText: {
        fontSize: Typography.fontSize.base,
        color: Colors.primary,
        fontWeight: '500',
    },
    skipBtn: {
        alignItems: 'center',
        padding: Spacing.md,
        marginTop: 'auto',
    },
    skipText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    backText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.md,
    },

    // Address input
    addressInputContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.md,
    },
    addressInput: {
        padding: Spacing.md,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // Tip box
    tipBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: Colors.info + '15',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.xl,
    },
    tipText: {
        flex: 1,
        fontSize: Typography.fontSize.sm,
        color: Colors.info,
        lineHeight: 20,
    },

    // Success
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    successTitle: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.success,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    successAddress: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: Spacing.lg,
    },

    // Progress dots
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingBottom: Spacing['2xl'],
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.border,
    },
    dotActive: {
        backgroundColor: Colors.primary,
    },
});
