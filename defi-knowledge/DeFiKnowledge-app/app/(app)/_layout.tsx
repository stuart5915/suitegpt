import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { TermSheet } from '@/components/TermSheet';

export default function AppLayout() {
    return (
        <>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                }}
            >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="course/[courseId]" />
                <Stack.Screen name="lesson/[lessonId]" />
                <Stack.Screen name="glossary" />
                <Stack.Screen name="video/[videoId]" />
            </Stack>
            <TermSheet />
        </>
    );
}
