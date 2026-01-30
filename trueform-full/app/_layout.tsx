import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../contexts/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      // No session — skip login, go straight to app
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    } else if (profile && !profile.onboarding_complete) {
      // Logged in but hasn't completed onboarding
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else if (session && (inAuthGroup || inOnboarding)) {
      // Logged in and completed onboarding, go to main app
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  // Skip custom font loading for web compatibility - use system fonts
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return null;
  }


  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="review"
              options={{
                presentation: 'containedModal',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthGate>
      </ThemeProvider>
    </AuthProvider>
  );
}
