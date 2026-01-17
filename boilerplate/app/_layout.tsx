/**
 * Root Layout - Wraps entire app with providers
 */

import { Stack } from 'expo-router';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { TelegramAuthProvider } from '../contexts/TelegramAuthContext';

export default function RootLayout() {
  return (
    <TelegramAuthProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </TelegramAuthProvider>
  );
}
