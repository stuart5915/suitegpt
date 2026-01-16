import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect root to tabs (scan page)
  return <Redirect href="/(tabs)" />;
}
