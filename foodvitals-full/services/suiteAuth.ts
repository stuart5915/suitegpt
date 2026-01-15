/**
 * SUITE Wallet Auth Service
 * Works in both browser (PWA) and React Native contexts
 */

import { Platform, Alert, Linking } from 'react-native';

const SUITE_AUTH_KEY = 'suite_wallet_address';
const SUITE_CREDITS_KEY = 'suite_credits';
const SUITE_ANON_KEY = 'suite_anonymous_id';

// Supabase connection
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY_VALUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

export interface SuiteUser {
    walletAddress: string;
    shortAddress: string;
    credits: number;
    isConnected: boolean;
}

// Check if running in browser (PWA) or native
const isWeb = Platform.OS === 'web';

// ==========================================
// STORAGE HELPERS (works in browser + native)
// ==========================================

async function getItem(key: string): Promise<string | null> {
    if (isWeb && typeof window !== 'undefined') {
        return localStorage.getItem(key);
    }
    // For native, dynamically import AsyncStorage
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await AsyncStorage.getItem(key);
    } catch {
        return null;
    }
}

async function setItem(key: string, value: string): Promise<void> {
    if (isWeb && typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return;
    }
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, value);
    } catch (e) {
        console.error('Storage error:', e);
    }
}

async function removeItem(key: string): Promise<void> {
    if (isWeb && typeof window !== 'undefined') {
        localStorage.removeItem(key);
        return;
    }
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error('Storage error:', e);
    }
}

// ==========================================
// ANONYMOUS ID (for tracking before wallet connect)
// ==========================================

export async function getAnonymousId(): Promise<string> {
    let anonId = await getItem(SUITE_ANON_KEY);
    if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        await setItem(SUITE_ANON_KEY, anonId);
    }
    return anonId;
}

// ==========================================
// WALLET FUNCTIONS
// ==========================================

export async function getSavedWallet(): Promise<string | null> {
    return await getItem(SUITE_AUTH_KEY);
}

export async function saveWallet(address: string): Promise<void> {
    await setItem(SUITE_AUTH_KEY, address.toLowerCase());
}

export async function clearWallet(): Promise<void> {
    await removeItem(SUITE_AUTH_KEY);
    await removeItem(SUITE_CREDITS_KEY);
}

export function formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ==========================================
// WALLET CONNECTION
// ==========================================

export async function connectWallet(): Promise<SuiteUser | null> {
    // Check if already connected
    const existing = await getSavedWallet();
    if (existing) {
        return getCurrentUser();
    }

    // In browser, use MetaMask
    if (isWeb && typeof window !== 'undefined') {
        const ethereum = (window as any).ethereum;

        if (!ethereum) {
            // No MetaMask - prompt to install
            const install = confirm('MetaMask is required to connect your wallet. Would you like to install it?');
            if (install) {
                window.open('https://metamask.io/download/', '_blank');
            }
            return null;
        }

        try {
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                const address = accounts[0];
                await saveWallet(address);
                return getCurrentUser();
            }
        } catch (error: any) {
            console.error('Wallet connection failed:', error);
            if (error.code === 4001) {
                alert('Connection cancelled. Please try again.');
            } else {
                alert('Failed to connect wallet: ' + (error.message || 'Unknown error'));
            }
            return null;
        }
    } else {
        // Native app - prompt for manual entry or deep link to wallet
        Alert.alert(
            '🔗 Connect Wallet',
            'Open MetaMask to connect your wallet',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open MetaMask',
                    onPress: () => {
                        Linking.openURL('metamask://');
                    }
                }
            ]
        );
        return null;
    }

    return null;
}

export async function disconnectWallet(): Promise<void> {
    await clearWallet();
}

// ==========================================
// USER STATE
// ==========================================

export async function getCurrentUser(): Promise<SuiteUser | null> {
    const walletAddress = await getSavedWallet();
    if (!walletAddress) return null;

    const credits = await loadCredits(walletAddress);

    return {
        walletAddress,
        shortAddress: formatAddress(walletAddress),
        credits,
        isConnected: true,
    };
}

// ==========================================
// CREDITS
// ==========================================

export async function loadCredits(walletAddress: string): Promise<number> {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/suite_credits?wallet_address=eq.${walletAddress.toLowerCase()}&select=balance`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY_VALUE,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY_VALUE}`
                }
            }
        );
        const data = await response.json();
        const credits = data[0]?.balance || 0;
        await setItem(SUITE_CREDITS_KEY, credits.toString());
        return credits;
    } catch (error) {
        console.error('Failed to load credits:', error);
        const cached = await getItem(SUITE_CREDITS_KEY);
        return cached ? parseInt(cached, 10) : 0;
    }
}

export async function useCredits(amount: number, featureName: string, appId?: string): Promise<boolean> {
    const wallet = await getSavedWallet();
    if (!wallet) return false;

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/deduct_suite_credits`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY_VALUE,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY_VALUE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    p_wallet: wallet.toLowerCase(),
                    p_amount: amount,
                    p_feature: featureName,
                    p_app_id: appId
                })
            }
        );
        return response.ok;
    } catch (error) {
        console.error('Failed to deduct credits:', error);
        return false;
    }
}

export async function hasCredits(amount: number): Promise<boolean> {
    const user = await getCurrentUser();
    return user ? user.credits >= amount : false;
}

// ==========================================
// TRACK USAGE (for non-premium features)
// ==========================================

export async function trackUsage(appId: string, feature: string): Promise<void> {
    const wallet = await getSavedWallet();
    const anonId = await getAnonymousId();

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/app_usage`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY_VALUE,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY_VALUE}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                app_id: appId,
                wallet_address: wallet?.toLowerCase() || null,
                anonymous_id: wallet ? null : anonId,
                feature: feature,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Failed to track usage:', error);
    }
}
