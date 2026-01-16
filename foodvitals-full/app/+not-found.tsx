import { Redirect } from 'expo-router';

export default function NotFoundScreen() {
  // Auto-redirect to scan page instead of showing error
  return <Redirect href="/(tabs)/scan" />;
}
