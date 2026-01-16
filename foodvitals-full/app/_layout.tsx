import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

// Wallet Connect imports (web only)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig, initWeb3Modal } from '../services/walletConnect';
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

// Create query client for wagmi
const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Initialize Web3Modal/AppKit on web
    if (Platform.OS === 'web') {
      initWeb3Modal();

      // Sync features to Supabase for admin panel (web only, upsert is safe)
      syncFeaturesToSupabase(supabase).catch(err => console.log('Feature sync:', err.message));
    }

    setLoaded(true);
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return null;
  }

  // Wrap with wallet providers on web
  if (Platform.OS === 'web') {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <ThemeProvider value={DarkTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </ThemeProvider>
          </WalletProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  // Native without wallet providers for now
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

