import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

// Wallet context (works without wagmi now)
import { WalletProvider } from '../contexts/WalletContext';

// Feature sync for admin panel
import { syncFeaturesToSupabase } from '../config/features';
import { supabase } from '../services/supabase';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Sync features to Supabase for admin panel (web only, upsert is safe)
      syncFeaturesToSupabase(supabase).catch(err => console.log('Feature sync:', err.message));
    }

    setLoaded(true);
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return null;
  }

  // Simple layout without wagmi providers (wallet temporarily disabled)
  return (
    <WalletProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </WalletProvider>
  );
}
