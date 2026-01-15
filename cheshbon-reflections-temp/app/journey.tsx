import { Redirect, useLocalSearchParams } from 'expo-router';

// Journey tab redirects to daily.tsx with mode param
// This provides a clean /journey route while reusing the existing daily.tsx logic
export default function Journey() {
    const params = useLocalSearchParams();
    const planId = params.planId || params.id;

    // Redirect to daily with journey mode by default
    // planId passed through if available
    if (planId) {
        return <Redirect href={`/daily?id=${planId}&mode=journey`} />;
    }

    // If no plan ID, go to daily which will handle finding the active plan
    return <Redirect href="/daily?mode=journey" />;
}
