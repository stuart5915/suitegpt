'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTelegramAuth, TelegramLoginData } from '@/contexts/TelegramAuthContext'

interface TelegramLoginButtonProps {
  botUsername?: string
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  showUserPhoto?: boolean
  requestAccess?: 'write'
  className?: string
}

// Extend Window interface for Telegram widget callback
declare global {
  interface Window {
    TelegramLoginCallback?: (user: TelegramLoginData) => void
  }
}

export default function TelegramLoginButton({
  botUsername,
  buttonSize = 'large',
  cornerRadius = 8,
  showUserPhoto = true,
  requestAccess = 'write',
  className = '',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { login, isLoading } = useTelegramAuth()

  // Use environment variable or prop
  const telegramBotUsername = botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''

  // Callback function for Telegram widget
  const handleTelegramAuth = useCallback((user: TelegramLoginData) => {
    login(user)
  }, [login])

  useEffect(() => {
    if (!containerRef.current || !telegramBotUsername) return

    // Set global callback
    window.TelegramLoginCallback = handleTelegramAuth

    // Clear container
    containerRef.current.innerHTML = ''

    // Create script element for Telegram widget
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', telegramBotUsername)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-radius', cornerRadius.toString())
    script.setAttribute('data-request-access', requestAccess)
    script.setAttribute('data-userpic', showUserPhoto.toString())
    script.setAttribute('data-onauth', 'TelegramLoginCallback(user)')
    script.async = true

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup
      if (window.TelegramLoginCallback === handleTelegramAuth) {
        delete window.TelegramLoginCallback
      }
    }
  }, [telegramBotUsername, buttonSize, cornerRadius, showUserPhoto, requestAccess, handleTelegramAuth])

  if (!telegramBotUsername) {
    return (
      <div className="p-4 bg-red-500/10 text-red-500 rounded-lg text-sm">
        Telegram bot username not configured. Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME environment variable.
      </div>
    )
  }

  return (
    <div className={`telegram-login-container ${className}`}>
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="w-6 h-6 border-2 border-[#54a9eb]/30 border-t-[#54a9eb] rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={containerRef} className="flex items-center justify-center" />
      )}
    </div>
  )
}

// Alternative: Custom styled button that opens Telegram auth in popup
export function TelegramLoginButtonCustom({
  botUsername,
  className = '',
}: {
  botUsername?: string
  className?: string
}) {
  const { login, isLoading } = useTelegramAuth()

  const telegramBotUsername = botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''

  const handleClick = () => {
    if (!telegramBotUsername || isLoading) return

    // Generate random string for state
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${telegramBotUsername}&origin=${encodeURIComponent(window.location.origin)}&request_access=write&return_to=${encodeURIComponent(window.location.href)}`

    // Open in popup
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'TelegramAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://oauth.telegram.org') return

      if (event.data?.user) {
        login(event.data.user)
        popup?.close()
      }
    }

    window.addEventListener('message', handleMessage)

    // Cleanup when popup closes
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup)
        window.removeEventListener('message', handleMessage)
      }
    }, 500)
  }

  if (!telegramBotUsername) {
    return (
      <div className="p-4 bg-red-500/10 text-red-500 rounded-lg text-sm">
        Telegram bot username not configured
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        flex items-center justify-center gap-3 px-6 py-3
        bg-[#54a9eb] hover:bg-[#4a9de0]
        text-white font-medium rounded-xl
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Sign in with Telegram
        </>
      )}
    </button>
  )
}
