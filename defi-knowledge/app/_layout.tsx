// Polyfill for crypto - MUST be first import
import 'react-native-get-random-values';

// Polyfill for BackHandler.removeEventListener (deprecated in RN 0.72+)
// This fixes WalletConnect modal crash
import { BackHandler, Linking } from 'react-native';
if (!(BackHandler as any).removeEventListener) {
  (BackHandler as any).removeEventListener = () => { };
}
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { WalletConnectProvider } from '@/context/WalletConnectContext';
import { Colors } from '@/constants/Colors';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading keeps expected navigation
  initialRouteName: '(app)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom dark theme matching our design system
const DeFiDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.primary,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const router = useRouter();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Handle deep link returns from wallet (e.g., MetaMask)
  useEffect(() => {
    // Listen for deep link events
    const handleUrl = (event: { url: string }) => {
      console.log('📱 Deep link received:', event.url);
      // If returning from wallet, navigate back to Use tab
      if (event.url.includes('defiknowledge://') || event.url.includes('wc')) {
        console.log('📱 Wallet return detected, navigating to Use tab');
        // Small delay to let the app settle
        setTimeout(() => {
          router.replace('/(app)/(tabs)/explore');
        }, 100);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('defiknowledge://') || url.includes('wc'))) {
        console.log('📱 App opened via wallet deep link:', url);
        setTimeout(() => {
          router.replace('/(app)/(tabs)/explore');
        }, 500);
      }
    });

    return () => subscription.remove();
  }, [router]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={DeFiDarkTheme}>
      <AuthProvider>
        <WalletConnectProvider>
          <StatusBar style="light" />
          <Slot />
        </WalletConnectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

