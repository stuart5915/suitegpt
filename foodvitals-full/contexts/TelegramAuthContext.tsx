/**
 * Telegram Auth Context
 * Provides Telegram user state throughout the app
 *
 * Auth sources (in priority order):
 * 1. URL params from Telegram Mini App iframe (tg_id, tg_username, etc.)
 * 2. localStorage (persisted from previous session)
 * 3. Telegram Login Widget (for direct web access)
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';

export interface TelegramUser {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string | null;
}

interface TelegramAuthContextType {
  user: TelegramUser | null;
  isLoading: boolean;
  credits: number;
  logout: () => void;
  refreshCredits: () => Promise<void>;
}

const TelegramAuthContext = createContext<TelegramAuthContextType | undefined>(undefined);

// Supabase config for credits
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MTAxOTAsImV4cCI6MjA1MDM4NjE5MH0.GRDjsDNkVBzxIlDCl9fOu0d6bfKxNbxOlS4pPXBHyhw';

const STORAGE_KEY = 'suiteTelegramUser';

// Parse Telegram user from URL params (passed from tg-app iframe)
function getTelegramUserFromURL(): TelegramUser | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const tgId = params.get('tg_id');

  if (tgId) {
    return {
      id: tgId,
      username: params.get('tg_username') || '',
      firstName: params.get('tg_first_name') || 'User',
      photoUrl: params.get('tg_photo') || null,
    };
  }
  return null;
}

// Get stored Telegram user from localStorage
function getStoredUser(): TelegramUser | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

// Save user to localStorage
function saveUser(user: TelegramUser) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(0);

  // Load user on mount - check URL params first, then localStorage
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Priority 1: URL params from Telegram iframe
      const urlUser = getTelegramUserFromURL();
      if (urlUser) {
        setUser(urlUser);
        saveUser(urlUser); // Persist for future use
        loadCredits(urlUser.id);
        // Clean URL params after reading
        const url = new URL(window.location.href);
        url.searchParams.delete('tg_id');
        url.searchParams.delete('tg_username');
        url.searchParams.delete('tg_first_name');
        url.searchParams.delete('tg_photo');
        window.history.replaceState({}, '', url.pathname);
      } else {
        // Priority 2: localStorage
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          loadCredits(storedUser.id);
        }
      }
    }
    setIsLoading(false);
  }, []);

  // Load credits from Supabase using telegram_id
  const loadCredits = async (telegramId: string) => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/user_credits?telegram_id=eq.${telegramId}&select=suite_balance`,
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
      } else {
        // User doesn't exist yet - create them with 0 credits
        await ensureUserExists(telegramId, user?.username || '');
        setCredits(0);
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
      localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
    setCredits(0);
  };

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        isLoading,
        credits,
        logout,
        refreshCredits,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export function useTelegramAuth() {
  const context = useContext(TelegramAuthContext);
  if (context === undefined) {
    throw new Error('useTelegramAuth must be used within a TelegramAuthProvider');
  }
  return context;
}

// Helper: Get current Telegram user (for use outside React components)
export function getTelegramUser(): TelegramUser | null {
  // First check URL params
  const urlUser = getTelegramUserFromURL();
  if (urlUser) return urlUser;

  // Then check localStorage
  return getStoredUser();
}

// Helper: Ensure user exists in database
async function ensureUserExists(telegramId: string, username: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_credits`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify({
        telegram_id: telegramId,
        telegram_username: username,
        suite_balance: 0,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to ensure user exists:', error);
  }
}

// Helper: Load user credits
export async function loadUserCredits(telegramId: string): Promise<number> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_credits?telegram_id=eq.${telegramId}&select=suite_balance`,
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

// Helper: Check if user has enough credits
export async function hasEnoughCredits(telegramId: string, amount: number): Promise<boolean> {
  const credits = await loadUserCredits(telegramId);
  return credits >= amount;
}

// Helper: Track app usage (for analytics)
export async function trackUsage(appId: string, feature: string): Promise<void> {
  const user = getTelegramUser();
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
        telegram_id: user?.id || null,
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
  telegramId: string,
  amount: number,
  featureName: string,
  appId: string = 'foodvitals'
): Promise<boolean> {
  try {
    // Get current balance
    const currentBalance = await loadUserCredits(telegramId);
    if (currentBalance < amount) {
      return false;
    }

    // Update balance (subtract amount)
    const newBalance = currentBalance - amount;
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_credits?telegram_id=eq.${telegramId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          suite_balance: newBalance,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (response.ok) {
      // Log the transaction
      await fetch(`${SUPABASE_URL}/rest/v1/credit_transactions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          telegram_id: telegramId,
          amount: -amount,
          feature: featureName,
          app_id: appId,
          created_at: new Date().toISOString()
        })
      }).catch(() => {}); // Don't fail if transaction logging fails
    }

    return response.ok;
  } catch (error) {
    console.error('Failed to deduct credits:', error);
    return false;
  }
}
