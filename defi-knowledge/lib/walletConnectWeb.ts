// Mock WalletConnect for web platform
// The native @walletconnect/modal-react-native doesn't work on web

import React from 'react';

// Mock useWalletConnectModal hook for web
export function useWalletConnectModal() {
    return {
        open: async () => {
            console.log('WalletConnect not available on web. Use manual connection.');
        },
        isConnected: false,
        address: undefined,
        provider: null,
    };
}

// Mock WalletConnectModal component for web - renders nothing
export function WalletConnectModal(_props: any) {
    return null;
}
