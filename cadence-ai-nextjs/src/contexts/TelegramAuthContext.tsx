'use client'

/**
 * Telegram Auth Context for Cadence AI
 * Provides Telegram user state throughout the app
 *
 * Auth sources (in priority order):
 * 1. URL params from Telegram Mini App iframe (tg_id, tg_username, etc.)
 * 2. Session cookie (persisted from previous session)
 * 3. Telegram Login Widget (for direct web access)
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface TelegramUser {
  id: string
  username: string
  firstName: string
  photoUrl: string | null
}

interface TelegramAuthContextType {
  user: TelegramUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (telegramUser: TelegramLoginData) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

// Data format from Telegram Login Widget
export interface TelegramLoginData {
  id: number | string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

const TelegramAuthContext = createContext<TelegramAuthContextType | undefined>(undefined)

const STORAGE_KEY = 'cadenceTelegramUser'

// Parse Telegram user from URL params (passed from tg-app iframe)
function getTelegramUserFromURL(): { user: TelegramUser; rawData: TelegramLoginData } | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const tgId = params.get('tg_id')

  if (tgId) {
    const user: TelegramUser = {
      id: tgId,
      username: params.get('tg_username') || '',
      firstName: params.get('tg_first_name') || 'User',
      photoUrl: params.get('tg_photo') || null,
    }

    // Construct raw data for API validation
    const rawData: TelegramLoginData = {
      id: tgId,
      first_name: params.get('tg_first_name') || 'User',
      username: params.get('tg_username') || undefined,
      photo_url: params.get('tg_photo') || undefined,
      auth_date: parseInt(params.get('tg_auth_date') || '0'),
      hash: params.get('tg_hash') || '',
    }

    return { user, rawData }
  }
  return null
}

// Get stored Telegram user from localStorage
function getStoredUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

// Save user to localStorage
function saveUser(user: TelegramUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }
}

// Clear stored user
function clearStoredUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Clean URL params after reading
function cleanUrlParams() {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('tg_id')
  url.searchParams.delete('tg_username')
  url.searchParams.delete('tg_first_name')
  url.searchParams.delete('tg_photo')
  url.searchParams.delete('tg_auth_date')
  url.searchParams.delete('tg_hash')
  window.history.replaceState({}, '', url.pathname + url.search)
}

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Authenticate with our API
  const authenticateWithApi = useCallback(async (telegramData: TelegramLoginData): Promise<TelegramUser | null> => {
    try {
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(telegramData),
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Auth API error:', errorData)
        return null
      }

      const data = await response.json()
      return data.user as TelegramUser
    } catch (error) {
      console.error('Failed to authenticate with API:', error)
      return null
    }
  }, [])

  // Login function for Telegram Login Widget callback
  const login = useCallback(async (telegramData: TelegramLoginData) => {
    setIsLoading(true)

    const authenticatedUser = await authenticateWithApi(telegramData)

    if (authenticatedUser) {
      setUser(authenticatedUser)
      saveUser(authenticatedUser)
      router.push('/dashboard')
      router.refresh()
    } else {
      console.error('Authentication failed')
    }

    setIsLoading(false)
  }, [authenticateWithApi, router])

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true)

    try {
      // Call logout API to clear session cookie
      await fetch('/api/auth/telegram/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout API error:', error)
    }

    clearStoredUser()
    setUser(null)
    setIsLoading(false)
    router.push('/login')
    router.refresh()
  }, [router])

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/telegram/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
          saveUser(data.user)
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }

      // Priority 1: URL params from Telegram iframe/mini app
      const urlData = getTelegramUserFromURL()
      if (urlData) {
        // Authenticate via API
        const authenticatedUser = await authenticateWithApi(urlData.rawData)
        if (authenticatedUser) {
          setUser(authenticatedUser)
          saveUser(authenticatedUser)
        }
        cleanUrlParams()
        setIsLoading(false)
        return
      }

      // Priority 2: Check session with API
      try {
        const response = await fetch('/api/auth/telegram/me', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUser(data.user)
            saveUser(data.user)
            setIsLoading(false)
            return
          }
        }
      } catch (error) {
        console.error('Failed to check session:', error)
      }

      // Priority 3: localStorage fallback (for quick UI while checking session)
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
      }

      setIsLoading(false)
    }

    initAuth()
  }, [authenticateWithApi])

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  )
}

export function useTelegramAuth() {
  const context = useContext(TelegramAuthContext)
  if (context === undefined) {
    throw new Error('useTelegramAuth must be used within a TelegramAuthProvider')
  }
  return context
}

// Helper: Get current Telegram user (for use outside React components)
export function getTelegramUser(): TelegramUser | null {
  // First check URL params
  const urlData = getTelegramUserFromURL()
  if (urlData) return urlData.user

  // Then check localStorage
  return getStoredUser()
}
