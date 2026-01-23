// Web platform: Use mock (real WalletConnect doesn't work on web)
// This file is automatically used on web builds instead of walletConnectImport.ts

import React from 'react';

// Mock hook that returns disconnected state
export function useWalletConnectModal() {
    return {
        open: async () => {
            console.log('WalletConnect SDK not available on web. Use manual connection.');
        },
        isConnected: false,
        address: undefined,
        provider: null,
    };
}

// Mock component that renders nothing
export function WalletConnectModal(_props: any): React.ReactElement | null {
    return null;
}
