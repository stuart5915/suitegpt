/**
 * SUITE Payment Gate Component
 * Shows modal when user tries to access premium features
 *
 * Usage:
 *   const { requestPayment, PaymentGateModal } = usePaymentGate();
 *   const success = await requestPayment({ featureName: 'AI Analysis', creditCost: 10, appId: 'myapp' });
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
} from 'react-native';
import { getTelegramUser, deductCredits, loadUserCredits } from '../contexts/TelegramAuthContext';

export interface PaymentConfig {
    featureName: string;
    creditCost: number;
    appId: string;
}

interface PaymentGateProps {
    visible: boolean;
    config: PaymentConfig;
    onComplete: (success: boolean) => void;
    onCancel: () => void;
}

export const PaymentGate: React.FC<PaymentGateProps> = ({ visible, config, onComplete, onCancel }) => {
    const [user, setUser] = useState<{ id: string; username: string; credits: number } | null>(null);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (visible) {
            const telegramUser = getTelegramUser();
            if (telegramUser) {
                loadUserCredits(telegramUser.id).then(credits => {
                    setUser({ id: telegramUser.id, username: telegramUser.username || telegramUser.firstName, credits });
                });
            } else {
                setUser(null);
            }
        }
    }, [visible]);

    const handleUseCredits = async () => {
        if (!user) return;
        setLoading(true);

        const freshCredits = await loadUserCredits(user.id);
        setUser(prev => prev ? { ...prev, credits: freshCredits } : null);

        if (freshCredits < config.creditCost) {
            setLoading(false);
            alert(`Not enough credits. You have ${freshCredits.toFixed(0)}, need ${config.creditCost}.`);
            return;
        }

        const success = await deductCredits(user.id, config.creditCost, config.featureName, config.appId);
        setLoading(false);
        onComplete(success);
    };

    const handleOpenTelegram = () => {
        Linking.openURL('https://t.me/SUITEHubBot');
    };

    const handleGetCredits = () => {
        Linking.openURL('https://www.getsuite.app/wallet');
        onCancel();
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.icon}>✨</Text>
                    <Text style={styles.title}>Premium Feature</Text>

                    <View style={styles.featureBox}>
                        <Text style={styles.featureName}>{config.featureName}</Text>
                        <Text style={styles.featureCost}>{config.creditCost} credits</Text>
                    </View>

                    {user ? (
                        <>
                            <View style={styles.creditsRow}>
                                <Text style={styles.creditsText}>{user.credits.toFixed(0)} credits</Text>
                                <Text style={styles.userText}>@{user.username}</Text>
                            </View>

                            {user.credits >= config.creditCost ? (
                                <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleUseCredits} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Use Credits</Text>}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={handleGetCredits}>
                                    <Text style={styles.btnText}>Get More Credits</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View style={styles.loginPrompt}>
                            <Text style={styles.loginText}>Open in Telegram to use credits</Text>
                            <TouchableOpacity style={styles.btn} onPress={handleOpenTelegram}>
                                <Text style={styles.btnText}>Open SUITE Hub</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Hook for easy usage
export function usePaymentGate() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<PaymentConfig>({ featureName: '', creditCost: 10, appId: '' });
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
        <PaymentGate visible={visible} config={config} onComplete={handleComplete} onCancel={handleCancel} />
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
    icon: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
    title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 16 },
    featureBox: {
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 0, 0.3)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    featureName: { fontSize: 16, fontWeight: '700', color: '#ff9500' },
    featureCost: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    creditsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    creditsText: { fontSize: 14, fontWeight: '700', color: '#ff9500' },
    userText: { fontSize: 12, color: '#0088cc', fontWeight: '600' },
    loginPrompt: { alignItems: 'center', marginBottom: 16 },
    loginText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
    btn: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtn: { backgroundColor: '#22c55e' },
    secondaryBtn: { backgroundColor: '#8B5CF6' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    cancelBtn: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    cancelBtnText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});

export default PaymentGate;
