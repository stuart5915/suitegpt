/**
 * SUITE Payment Gate Component for React Native
 * Shows a modal when user tries to access premium features
 * Uses Discord auth for identity and credits
 */

import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Linking,
    Platform,
} from 'react-native';
import { getDiscordUser, deductCredits, hasEnoughCredits, DiscordUser } from '../contexts/DiscordAuthContext';

export interface PaymentConfig {
    featureName: string;
    creditCost: number;
    appId?: string;
}

interface DiscordUserWithCredits {
    id: string;
    username: string;
    credits: number;
}

interface PaymentGateProps {
    visible: boolean;
    config: PaymentConfig;
    onComplete: (success: boolean) => void;
    onCancel: () => void;
}

// Supabase config for credits
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

async function loadUserCredits(discordId: string): Promise<number> {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/user_credits?discord_id=eq.${discordId}&select=suite_balance`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return parseFloat(data[0].suite_balance) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Failed to load credits:', error);
        return 0;
    }
}

export const PaymentGate: React.FC<PaymentGateProps> = ({
    visible,
    config,
    onComplete,
    onCancel,
}) => {
    const [user, setUser] = useState<DiscordUserWithCredits | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAd, setShowAd] = useState(false);
    const [adSeconds, setAdSeconds] = useState(30);

    React.useEffect(() => {
        if (visible) {
            // Load Discord user and credits
            const discordUser = getDiscordUser();
            if (discordUser) {
                loadUserCredits(discordUser.id).then(credits => {
                    setUser({
                        id: discordUser.id,
                        username: discordUser.username,
                        credits,
                    });
                });
            } else {
                setUser(null);
            }
        }
    }, [visible]);

    const handleUseCredits = async () => {
        if (!user) return;

        setLoading(true);

        // Always refresh credits from server before deducting (prevents stale balance issues)
        const freshCredits = await loadUserCredits(user.id);
        setUser(prev => prev ? { ...prev, credits: freshCredits } : null);

        if (freshCredits < config.creditCost) {
            setLoading(false);
            alert(`Not enough credits. You have ${freshCredits.toFixed(0)}, need ${config.creditCost}.`);
            return;
        }

        const success = await deductCredits(
            user.id,
            config.creditCost,
            config.featureName,
            config.appId || 'foodvitals'
        );
        setLoading(false);
        onComplete(success);
    };

    const handleWatchAd = () => {
        setShowAd(true);
        setAdSeconds(30);

        const timer = setInterval(() => {
            setAdSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setShowAd(false);
                    // Award 2 credits (in real app, verify with backend)
                    onComplete(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleStakeLP = () => {
        Linking.openURL('https://stuarthollinger.com/wallet.html#staking');
        onCancel(); // Close modal, user will stake and come back
    };

    const handleLoginDiscord = () => {
        // Redirect to login
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    };

    const handlePayCard = () => {
        // TODO: Integrate Stripe
        alert('Card payments coming soon!');
    };

    const handlePayCrypto = () => {
        // TODO: Integrate crypto payments
        alert('Crypto payments coming soon!');
    };

    if (showAd) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <Text style={styles.title}>Watch to Earn</Text>
                        <View style={styles.adContainer}>
                            <Text style={styles.adTimer}>{adSeconds}s</Text>
                            <Text style={styles.adPlaceholder}>Ad playing...</Text>
                        </View>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.icon}>✨</Text>
                    <Text style={styles.title}>Premium Feature</Text>
                    <Text style={styles.subtitle}>Choose how to unlock</Text>

                    <View style={styles.featureBox}>
                        <Text style={styles.featureName}>{config.featureName}</Text>
                        <Text style={styles.featureCost}>
                            {config.creditCost} credits • ~${(config.creditCost * 0.001).toFixed(3)}
                        </Text>
                    </View>

                    {user ? (
                        <View style={styles.creditsRow}>
                            <Text style={styles.creditsText}>{user.credits.toFixed(0)} credits</Text>
                            <Text style={styles.userText}>@{user.username}</Text>
                        </View>
                    ) : (
                        <View style={styles.loginPrompt}>
                            <Text style={styles.loginText}>Login with Discord to use credits</Text>
                            <TouchableOpacity style={styles.loginBtn} onPress={handleLoginDiscord}>
                                <Text style={styles.loginBtnText}>Login with Discord</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.options}>
                        {/* Show Use Credits if user has enough */}
                        {user && user.credits >= config.creditCost && (
                            <TouchableOpacity
                                style={[styles.optionBtn, styles.primaryBtn]}
                                onPress={handleUseCredits}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.optionIcon}>✓</Text>
                                        <View style={styles.optionContent}>
                                            <Text style={styles.optionTitle}>Use Credits</Text>
                                            <Text style={styles.optionDesc}>
                                                Deduct {config.creditCost} from balance
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Stake LP - Primary option for zero-credit users */}
                        <TouchableOpacity style={[styles.optionBtn, styles.stakingBtn]} onPress={handleStakeLP}>
                            <Text style={styles.optionIcon}>~</Text>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>Stake LP Tokens</Text>
                                <Text style={styles.optionDesc}>Earn credits from DeFi yield</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Watch Ad - Quick free option */}
                        <TouchableOpacity style={styles.optionBtn} onPress={handleWatchAd}>
                            <Text style={styles.optionIcon}>▶</Text>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>Watch an Ad</Text>
                                <Text style={styles.optionDesc}>Free! Earn 2 credits</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Pay with Fiat */}
                        <TouchableOpacity style={styles.optionBtn} onPress={handlePayCard}>
                            <Text style={styles.optionIcon}>$</Text>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>Pay with Card</Text>
                                <Text style={styles.optionDesc}>One-time via Stripe</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Pay with Crypto */}
                        <TouchableOpacity style={styles.optionBtn} onPress={handlePayCrypto}>
                            <Text style={styles.optionIcon}>◆</Text>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>Pay with Crypto</Text>
                                <Text style={styles.optionDesc}>SUITE, ETH, or USDC</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Hook for using payment gate
export function usePaymentGate() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<PaymentConfig>({ featureName: '', creditCost: 10 });
    const [resolver, setResolver] = useState<((success: boolean) => void) | null>(null);

    const requestPayment = (paymentConfig: PaymentConfig): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfig(paymentConfig);
            setResolver(() => resolve);
            setVisible(true);
        });
    };

    const handleComplete = (success: boolean) => {
        setVisible(false);
        resolver?.(success);
    };

    const handleCancel = () => {
        setVisible(false);
        resolver?.(false);
    };

    const PaymentGateModal = () => (
        <PaymentGate
            visible={visible}
            config={config}
            onComplete={handleComplete}
            onCancel={handleCancel}
        />
    );

    return { requestPayment, PaymentGateModal };
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: '#1a1a2e',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    icon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 20,
    },
    featureBox: {
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 0, 0.3)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    featureName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ff9500',
    },
    featureCost: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    creditsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    creditsText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ff9500',
    },
    userText: {
        fontSize: 12,
        color: '#5865F2',
        fontWeight: '600',
    },
    loginPrompt: {
        alignItems: 'center',
        marginBottom: 16,
        padding: 12,
        backgroundColor: 'rgba(88, 101, 242, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(88, 101, 242, 0.3)',
    },
    loginText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 12,
    },
    loginBtn: {
        backgroundColor: '#5865F2',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    loginBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    options: {
        gap: 12,
        marginBottom: 16,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    primaryBtn: {
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    stakingBtn: {
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    optionIcon: {
        fontSize: 28,
        marginRight: 16,
        color: '#fff',
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    optionDesc: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    cancelBtn: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    adContainer: {
        backgroundColor: '#000',
        borderRadius: 16,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 20,
    },
    adTimer: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        fontSize: 14,
        fontWeight: '600',
    },
    adPlaceholder: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 16,
    },
});

export default PaymentGate;
