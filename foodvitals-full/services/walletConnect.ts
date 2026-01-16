/**
 * SUITE Wallet Connect Service
 *
 * NOTE: Wallet functionality temporarily disabled due to @reown/appkit
 * bundler compatibility issues with Expo web. The packages use import.meta
 * which isn't supported in the current bundle output format.
 *
 * TODO: Re-enable when Expo supports ES module output or find alternative wallet lib
 */

// Type only - no runtime wallet packages imported
import type { Config } from 'wagmi';

// Storage keys
const WALLET_KEY = 'suite_wallet_address';
const CREDITS_KEY = 'suite_credits';

// Supabase config for credits
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

export interface SuiteUser {
  walletAddress: string;
  shortAddress: string;
  credits: number;
  isConnected: boolean;
  chainId?: number;
}

// Dummy wagmi config (wallet disabled)
export const wagmiConfig = {} as Config;

// Initialize - no-op for now
export function initWeb3Modal() {
  console.log('Wallet functionality temporarily disabled');
  return null;
}

// Format wallet address
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Open the wallet connection modal - disabled
export async function openConnectModal(): Promise<void> {
  console.log('Wallet connect temporarily disabled');
  if (typeof window !== 'undefined') {
    alert('Wallet connection is temporarily unavailable. Please try again later.');
  }
}

// Check current connection status - always disconnected
export function getWalletStatus(): { address: string | undefined; isConnected: boolean; chainId: number | undefined } {
  // Check for cached wallet address
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(WALLET_KEY);
    if (cached) {
      return { address: cached, isConnected: false, chainId: undefined };
    }
  }
  return { address: undefined, isConnected: false, chainId: undefined };
}

// Get current user with credits (from cache/localStorage)
export async function getCurrentUser(): Promise<SuiteUser | null> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(WALLET_KEY);
    if (cached) {
      const credits = await loadCredits(cached);
      return {
        walletAddress: cached,
        shortAddress: formatAddress(cached),
        credits,
        isConnected: false,
      };
    }
  }
  return null;
}

// Disconnect wallet
export async function disconnectWallet(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(CREDITS_KEY);
  }
}

// Try to reconnect - just return cached user
export async function tryReconnect(): Promise<SuiteUser | null> {
  return getCurrentUser();
}

// Watch for account changes - no-op
export function watchWalletChanges(callback: (user: SuiteUser | null) => void): () => void {
  return () => {}; // No-op unsubscribe
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
  const { address } = getWalletStatus();
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
  const { address } = getWalletStatus();

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
