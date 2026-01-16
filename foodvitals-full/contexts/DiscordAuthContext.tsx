/**
 * Discord Auth Context
 * Provides Discord user state throughout the app
 * Uses localStorage (suiteDev) for persistence - same as wallet.html
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  email?: string;
}

interface DiscordAuthContextType {
  user: DiscordUser | null;
  isLoading: boolean;
  credits: number;
  logout: () => void;
  refreshCredits: () => Promise<void>;
}

const DiscordAuthContext = createContext<DiscordAuthContextType | undefined>(undefined);

// Supabase config for credits
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

export function DiscordAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(0);

  // Load user from localStorage on mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const stored = localStorage.getItem('suiteDev');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            setUser(parsed);
            // Load credits for this user
            loadCredits(parsed.id);
          }
        } catch (e) {
          console.error('Failed to parse stored Discord user:', e);
        }
      }
    }
    setIsLoading(false);
  }, []);

  // Load credits from Supabase
  const loadCredits = async (discordId: string) => {
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
        setCredits(parseFloat(data[0].suite_balance) || 0);
      }
    } catch (error) {
      console.error('Failed to load credits:', error);
    }
  };

  const refreshCredits = async () => {
    if (user?.id) {
      await loadCredits(user.id);
    }
  };

  const logout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.removeItem('suiteDev');
    }
    setUser(null);
    setCredits(0);
  };

  return (
    <DiscordAuthContext.Provider
      value={{
        user,
        isLoading,
        credits,
        logout,
        refreshCredits,
      }}
    >
      {children}
    </DiscordAuthContext.Provider>
  );
}

export function useDiscordAuth() {
  const context = useContext(DiscordAuthContext);
  if (context === undefined) {
    throw new Error('useDiscordAuth must be used within a DiscordAuthProvider');
  }
  return context;
}

// Helper: Get current Discord user (for use outside React components)
export function getDiscordUser(): DiscordUser | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const stored = localStorage.getItem('suiteDev');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Helper: Check if user has enough credits
export async function hasEnoughCredits(discordId: string, amount: number): Promise<boolean> {
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
      return (parseFloat(data[0].suite_balance) || 0) >= amount;
    }
    return false;
  } catch {
    return false;
  }
}

// Helper: Track app usage (for analytics)
export async function trackUsage(appId: string, feature: string): Promise<void> {
  const user = getDiscordUser();
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
        discord_id: user?.id || null,
        feature: feature,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}

// Helper: Deduct credits for a feature
export async function deductCredits(
  discordId: string,
  amount: number,
  featureName: string,
  appId: string = 'foodvitals'
): Promise<boolean> {
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
          p_discord_id: discordId,
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
