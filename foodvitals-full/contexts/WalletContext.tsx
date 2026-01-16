/**
 * SUITE Wallet Context
 * Provides wallet connection state throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  SuiteUser,
  initWeb3Modal,
  getCurrentUser,
  openConnectModal,
  disconnectWallet,
  tryReconnect,
  watchWalletChanges,
} from '../services/walletConnect';

interface WalletContextType {
  user: SuiteUser | null;
  isConnecting: boolean;
  isInitialized: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SuiteUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // For native, we'll handle differently later
      setIsInitialized(true);
      return;
    }

    const init = async () => {
      try {
        // Initialize Web3Modal
        initWeb3Modal();

        // Try to reconnect existing session
        const existingUser = await tryReconnect();
        if (existingUser) {
          setUser(existingUser);
        }
      } catch (error) {
        console.error('Wallet init error:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    init();

    // Watch for account changes
    const unwatch = watchWalletChanges((newUser) => {
      setUser(newUser);
      setIsConnecting(false);
    });

    return () => {
      unwatch();
    };
  }, []);

  const connect = async () => {
    if (Platform.OS !== 'web') {
      // For native, show alert or handle differently
      console.log('Native wallet connect not yet implemented');
      return;
    }

    setIsConnecting(true);
    try {
      await openConnectModal();
      // The watchWalletChanges callback will update the user state
    } catch (error) {
      console.error('Connect error:', error);
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectWallet();
      setUser(null);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const refreshUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  return (
    <WalletContext.Provider
      value={{
        user,
        isConnecting,
        isInitialized,
        connect,
        disconnect,
        refreshUser,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
