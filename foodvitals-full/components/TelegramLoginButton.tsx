/**
 * Telegram Login Widget for Web
 * Allows users to login with their Telegram account on web
 */

import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramAuthData) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  showUserPic?: boolean;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

export const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 10,
  showUserPic = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Set up the callback function
    window.onTelegramAuth = (user: TelegramAuthData) => {
      onAuth(user);
    };

    // Create and inject the Telegram widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    if (showUserPic) {
      script.setAttribute('data-userpic', 'true');
    }
    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      // Cleanup
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [botName, buttonSize, cornerRadius, showUserPic, onAuth]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', marginVertical: 16 }}>
      <div ref={containerRef as any} />
    </View>
  );
};

export default TelegramLoginButton;
