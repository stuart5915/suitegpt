import { Redirect } from 'expo-router';

export default function Index() {
    // Redirect to the main tabs on app launch
    return <Redirect href="/(tabs)" />;
}
