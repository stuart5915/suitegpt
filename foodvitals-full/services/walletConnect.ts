/**
 * SUITE Wallet Connect Service
 * Uses Reown AppKit (formerly Web3Modal) for mobile wallet connections
 * Works in PWA standalone mode
 *
 * NOTE: Uses lazy loading to avoid import.meta errors in non-module contexts
 */

// Type imports only (no runtime code)
import type { Config } from '@wagmi/core';

// Storage keys
const WALLET_KEY = 'suite_wallet_address';
const CREDITS_KEY = 'suite_credits';

// Supabase config for credits
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

// WalletConnect Project ID
const PROJECT_ID = '1b3422192416b1e6228b63dd9cdfad89';

export interface SuiteUser {
  walletAddress: string;
  shortAddress: string;
  credits: number;
  isConnected: boolean;
  chainId?: number;
}

// Lazy-loaded modules
let wagmiCore: typeof import('@wagmi/core') | null = null;
let appKitModule: typeof import('@reown/appkit') | null = null;
let appKitAdapter: typeof import('@reown/appkit-adapter-wagmi') | null = null;
let appKitNetworks: typeof import('@reown/appkit/networks') | null = null;

// Cached instances
let wagmiConfigInstance: Config | null = null;
let appKit: any = null;
let wagmiAdapter: any = null;

// Load wagmi modules lazily
async function loadWagmiModules() {
  if (!wagmiCore) {
    wagmiCore = await import('@wagmi/core');
  }
  return wagmiCore;
}

// Load AppKit modules lazily
async function loadAppKitModules() {
  if (!appKitModule || !appKitAdapter || !appKitNetworks) {
    [appKitModule, appKitAdapter, appKitNetworks] = await Promise.all([
      import('@reown/appkit'),
      import('@reown/appkit-adapter-wagmi'),
      import('@reown/appkit/networks'),
    ]);
  }
  return { appKitModule, appKitAdapter, appKitNetworks };
}

// Create wagmi config lazily
async function getWagmiConfig(): Promise<Config> {
  if (wagmiConfigInstance) return wagmiConfigInstance;

  const { appKitAdapter: adapterModule, appKitNetworks: networksModule } = await loadAppKitModules();

  if (!wagmiAdapter) {
    wagmiAdapter = new adapterModule.WagmiAdapter({
      networks: [networksModule.base, networksModule.mainnet],
      projectId: PROJECT_ID,
    });
  }

  wagmiConfigInstance = wagmiAdapter.wagmiConfig as Config;
  return wagmiConfigInstance;
}

// Dummy config for providers (will be replaced on init)
const dummyConfig = {
  chains: [],
  connectors: [],
  storage: null,
  state: { connections: new Map(), current: null },
} as unknown as Config;

// Export wagmi config (returns dummy until initialized)
export const wagmiConfig: Config = dummyConfig;

// Initialize AppKit (only on web)
export async function initWeb3Modal() {
  if (typeof window === 'undefined') return null;

  try {
    const { appKitModule: appKit_, appKitAdapter: adapterModule, appKitNetworks: networksModule } = await loadAppKitModules();

    // Create adapter if not exists
    if (!wagmiAdapter) {
      wagmiAdapter = new adapterModule.WagmiAdapter({
        networks: [networksModule.base, networksModule.mainnet],
        projectId: PROJECT_ID,
      });
    }

    wagmiConfigInstance = wagmiAdapter.wagmiConfig as Config;

    // Update the exported config
    Object.assign(wagmiConfig, wagmiConfigInstance);

    if (!appKit) {
      appKit = appKit_.createAppKit({
        adapters: [wagmiAdapter],
        networks: [networksModule.base, networksModule.mainnet],
        projectId: PROJECT_ID,
        metadata: {
          name: 'SUITE Apps',
          description: 'AI-powered productivity apps',
          url: 'https://getsuite.app',
          icons: ['https://getsuite.app/assets/suite-logo-new.png']
        },
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent': '#7C3AED',
          '--w3m-border-radius-master': '12px',
        },
        featuredWalletIds: [
          'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
          '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust
          'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
        ],
      });
    }

    return appKit;
  } catch (error) {
    console.error('Failed to initialize Web3Modal:', error);
    return null;
  }
}

// Format wallet address
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Open the wallet connection modal
export async function openConnectModal(): Promise<void> {
  const modal = await initWeb3Modal();
  if (modal) {
    await modal.open();
  }
}

// Check current connection status
export async function getWalletStatus(): Promise<{ address: string | undefined; isConnected: boolean; chainId: number | undefined }> {
  try {
    const wagmi = await loadWagmiModules();
    const config = await getWagmiConfig();
    const account = wagmi.getAccount(config);
    return {
      address: account.address,
      isConnected: account.isConnected,
      chainId: account.chainId,
    };
  } catch {
    return { address: undefined, isConnected: false, chainId: undefined };
  }
}

// Get current user with credits
export async function getCurrentUser(): Promise<SuiteUser | null> {
  const { address, isConnected, chainId } = await getWalletStatus();

  if (!isConnected || !address) {
    // Check localStorage for cached address
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(WALLET_KEY);
      if (cached) {
        const credits = await loadCredits(cached);
        return {
          walletAddress: cached,
          shortAddress: formatAddress(cached),
          credits,
          isConnected: false, // Cached but not actively connected
        };
      }
    }
    return null;
  }

  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(WALLET_KEY, address.toLowerCase());
  }

  const credits = await loadCredits(address);

  return {
    walletAddress: address.toLowerCase(),
    shortAddress: formatAddress(address),
    credits,
    isConnected: true,
    chainId,
  };
}

// Disconnect wallet
export async function disconnectWallet(): Promise<void> {
  try {
    const wagmi = await loadWagmiModules();
    const config = await getWagmiConfig();
    await wagmi.disconnect(config);
  } catch (error) {
    console.error('Disconnect error:', error);
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(CREDITS_KEY);
  }
}

// Try to reconnect on app start
export async function tryReconnect(): Promise<SuiteUser | null> {
  try {
    const wagmi = await loadWagmiModules();
    const config = await getWagmiConfig();
    await wagmi.reconnect(config);
    return getCurrentUser();
  } catch (error) {
    console.log('No existing connection to restore');
    return null;
  }
}

// Watch for account changes
export async function watchWalletChanges(callback: (user: SuiteUser | null) => void): Promise<() => void> {
  try {
    const wagmi = await loadWagmiModules();
    const config = await getWagmiConfig();
    return wagmi.watchAccount(config, {
      onChange: async (account) => {
        if (account.isConnected && account.address) {
          const user = await getCurrentUser();
          callback(user);
        } else {
          callback(null);
        }
      },
    });
  } catch {
    return () => {}; // No-op unsubscribe
  }
}

// Load credits from Supabase
export async function loadCredits(walletAddress: string): Promise<number> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/suite_credits?wallet_address=eq.${walletAddress.toLowerCase()}&select=balance`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const data = await response.json();
    const credits = data[0]?.balance || 0;

    if (typeof window !== 'undefined') {
      localStorage.setItem(CREDITS_KEY, credits.toString());
    }

    return credits;
  } catch (error) {
    console.error('Failed to load credits:', error);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CREDITS_KEY);
      return cached ? parseInt(cached, 10) : 0;
    }
    return 0;
  }
}

// Use credits for a feature
export async function useCredits(amount: number, featureName: string, appId?: string): Promise<boolean> {
  const { address } = await getWalletStatus();
  if (!address) return false;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/deduct_suite_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_wallet: address.toLowerCase(),
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

// Check if user has enough credits
export async function hasCredits(amount: number): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? user.credits >= amount : false;
}

// Track app usage
export async function trackUsage(appId: string, feature: string): Promise<void> {
  const { address } = await getWalletStatus();

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_usage`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        app_id: appId,
        wallet_address: address?.toLowerCase() || null,
        feature: feature,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}
