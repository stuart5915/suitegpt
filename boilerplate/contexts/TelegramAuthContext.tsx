/**
 * SUITE Telegram Auth Context
 * Provides Telegram user state and credits throughout the app
 *
 * Copy this file to your app's contexts folder.
 * No modifications needed - works with any SUITE app.
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
  login: (telegramUser: { id: number | string; username?: string; first_name: string; photo_url?: string }) => void;
  logout: () => void;
  refreshCredits: () => Promise<void>;
}

const TelegramAuthContext = createContext<TelegramAuthContextType | undefined>(undefined);

// Supabase config (shared across all SUITE apps)
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

const STORAGE_KEY = 'suiteTelegramUser';

// Parse Telegram user from URL params (passed from SUITE Shell iframe)
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

function saveUser(user: TelegramUser) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(0);

  const login = (telegramUser: { id: number | string; username?: string; first_name: string; photo_url?: string }) => {
    const newUser: TelegramUser = {
      id: telegramUser.id.toString(),
      username: telegramUser.username || '',
      firstName: telegramUser.first_name,
      photoUrl: telegramUser.photo_url || null,
    };
    setUser(newUser);
    saveUser(newUser);
    loadCredits(newUser.id);
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlUser = getTelegramUserFromURL();
      if (urlUser) {
        setUser(urlUser);
        saveUser(urlUser);
        loadCredits(urlUser.id);
        // Clean URL params
        const url = new URL(window.location.href);
        ['tg_id', 'tg_username', 'tg_first_name', 'tg_photo'].forEach(p => url.searchParams.delete(p));
        window.history.replaceState({}, '', url.pathname);
      } else {
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          loadCredits(storedUser.id);
        }
      }
    }
    setIsLoading(false);
  }, []);

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
    <TelegramAuthContext.Provider value={{ user, isLoading, credits, login, logout, refreshCredits }}>
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
  const urlUser = getTelegramUserFromURL();
  if (urlUser) return urlUser;
  return getStoredUser();
}

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

export async function hasEnoughCredits(telegramId: string, amount: number): Promise<boolean> {
  const credits = await loadUserCredits(telegramId);
  return credits >= amount;
}

export async function deductCredits(
  telegramId: string,
  amount: number,
  featureName: string,
  appId: string
): Promise<boolean> {
  try {
    const currentBalance = await loadUserCredits(telegramId);
    if (currentBalance < amount) return false;

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
      // Log transaction
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
      }).catch(() => {});

      // Update app revenue
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_app_revenue`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_app_slug: appId, p_amount: amount })
      }).catch(() => {});
    }

    return response.ok;
  } catch (error) {
    console.error('Failed to deduct credits:', error);
    return false;
  }
}
