// WalletConnect Context Provider
// Provides real Web3 wallet connection via WalletConnect v2

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useWalletConnectModal, WalletConnectModal } from '@walletconnect/modal-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WalletModal from '@/components/WalletModal';
import SuccessToast from '@/components/SuccessToast';

// Get your project ID from https://cloud.walletconnect.com
const PROJECT_ID = '6c9d7cb5958d95d9a7e84b431ec5a41b';

const providerMetadata = {
    name: 'DeFi Knowledge',
    description: 'Learn DeFi and earn NFT badges',
    url: 'https://defiknowledge.app',
    icons: ['https://defiknowledge.app/icon.png'],
    redirect: {
        native: 'defiknowledge://',
        universal: 'https://defiknowledge.app',
    },
};

interface WalletConnectContextType {
    address: string | undefined;
    isConnected: boolean;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    showWalletModal: () => void;
    sendTransaction: (tx: TransactionRequest) => Promise<string | null>;
    provider: any;
}

interface TransactionRequest {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    chainId?: number;
}

const WalletConnectContext = createContext<WalletConnectContextType | undefined>(undefined);

interface WalletConnectProviderProps {
    children: ReactNode;
}

export function WalletConnectProvider({ children }: WalletConnectProviderProps) {
    const { open, isConnected, address, provider } = useWalletConnectModal();
    const [isConnecting, setIsConnecting] = useState(false);
    const [wasConnected, setWasConnected] = useState(false);

    // Custom UI state
    const [showModal, setShowModal] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successSubMessage, setSuccessSubMessage] = useState('');

    // Note: Stale session errors from WalletConnect are caught in sendTransaction
    // They will log to console but shouldn't crash the app

    const connect = useCallback(async () => {
        console.log('🔌 WalletConnect: connect() called');
        console.log('🔌 isConnected:', isConnected);

        if (isConnected) {
            console.log('🔌 Already connected, showing wallet modal');
            setShowModal(true);
            return;
        }

        // Try WalletConnect SDK - this shows a QR code modal that can be scanned
        // or deep links to MetaMask if on mobile
        try {
            console.log('🔌 Opening WalletConnect modal...');
            await open();
            console.log('🔌 WalletConnect modal opened successfully');
            // The SDK will handle the rest - connection will be detected by useWalletConnectModal
        } catch (error: any) {
            console.error('🔌 WalletConnect SDK error:', error?.message || error);
            // Only show manual fallback if SDK truly failed
            // Common in Expo Go where native modules aren't fully available
            console.log('🔌 Falling back to manual connection modal');
            setShowModal(true);
        }
    }, [isConnected, open]);

    const disconnect = useCallback(async () => {
        try {
            if (provider) {
                await provider.disconnect();
            }
            await AsyncStorage.removeItem('wallet_address');
        } catch (error: any) {
            console.warn('Disconnect error:', error?.message || error);
        }
    }, [provider]);

    const showWalletModal = useCallback(() => {
        if (isConnected) {
            setShowModal(true);
        } else {
            connect();
        }
    }, [isConnected, connect]);

    // Send a transaction via WalletConnect
    const sendTransaction = useCallback(async (tx: TransactionRequest): Promise<string | null> => {
        if (!provider || !address) {
            console.error('❌ Cannot send transaction: no provider or address');
            return null;
        }

        try {
            console.log('📤 Sending transaction via WalletConnect...');
            console.log('📤 TX:', tx);

            // If chainId is specified, try to switch to that chain first
            if (tx.chainId) {
                console.log('🔄 Requesting chain switch to:', tx.chainId);
                try {
                    await provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${tx.chainId.toString(16)}` }],
                    });
                    console.log('✅ Switched to chain:', tx.chainId);
                } catch (switchError: any) {
                    console.warn('⚠️ Chain switch failed (may already be on correct chain):', switchError?.message);
                    // Continue anyway - wallet may already be on the chain or user can switch manually
                }
            }

            // Request the transaction via WalletConnect
            // This will open the connected wallet for approval
            const result = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: address,
                    to: tx.to,
                    data: tx.data,
                    value: tx.value.startsWith('0x') ? tx.value : `0x${BigInt(tx.value).toString(16)}`,
                    gas: tx.gasLimit ? `0x${parseInt(tx.gasLimit).toString(16)}` : undefined,
                }],
            });

            console.log('✅ Transaction sent:', result);
            return result as string; // Returns transaction hash
        } catch (error: any) {
            console.error('❌ Transaction failed:', error);

            // Check if it's a stale session error
            if (error?.message?.includes('session topic') || error?.message?.includes('No matching key')) {
                console.error('🔄 Session expired - user needs to reconnect');
                // Session is stale, try to disconnect cleanly
                try {
                    await disconnect();
                } catch { }
            }
            throw error;
        }
    }, [provider, address, disconnect]);

    // Track connection state changes and show success toast
    useEffect(() => {
        if (isConnected && !wasConnected && address) {
            setWasConnected(true);
            // Show custom success toast
            setSuccessMessage('🎉 Wallet Connected!');
            setSuccessSubMessage(`${address.slice(0, 6)}...${address.slice(-4)}`);
            setShowSuccess(true);
        } else if (!isConnected && wasConnected) {
            setWasConnected(false);
        }
    }, [isConnected, wasConnected, address]);

    // Persist wallet connection
    useEffect(() => {
        if (address) {
            AsyncStorage.setItem('wallet_address', address).catch(() => { });
        } else {
            AsyncStorage.removeItem('wallet_address').catch(() => { });
        }
    }, [address]);

    return (
        <WalletConnectContext.Provider
            value={{
                address,
                isConnected,
                isConnecting,
                connect,
                disconnect,
                showWalletModal,
                sendTransaction,
                provider,
            }}
        >
            {children}

            {/* WalletConnect SDK Modal */}
            <WalletConnectModal
                projectId={PROJECT_ID}
                providerMetadata={providerMetadata}
            />

            {/* Custom Wallet Modal (connect + disconnect) */}
            <WalletModal
                visible={showModal}
                onClose={() => setShowModal(false)}
                address={address || ''}
                onDisconnect={disconnect}
                onConnect={(manualAddress: string) => {
                    // For manual connection, we just show success
                    // In production, this would verify the address
                    setShowModal(false);
                    setSuccessMessage('🎉 Wallet Connected!');
                    setSuccessSubMessage(`${manualAddress.slice(0, 6)}...${manualAddress.slice(-4)}`);
                    setShowSuccess(true);
                }}
            />

            {/* Custom Success Toast */}
            <SuccessToast
                visible={showSuccess}
                message={successMessage}
                subMessage={successSubMessage}
                onHide={() => setShowSuccess(false)}
            />
        </WalletConnectContext.Provider>
    );
}

export function useWalletConnect() {
    const context = useContext(WalletConnectContext);
    if (!context) {
        throw new Error('useWalletConnect must be used within WalletConnectProvider');
    }
    return context;
}

// Helper to shorten address display
export function shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
