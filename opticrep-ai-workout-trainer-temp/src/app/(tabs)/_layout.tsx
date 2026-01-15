import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

// Simple icon components
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
    const icons: Record<string, string> = {
        home: '🏠',
        workout: '💪',
        hub: '🧠',
    };

    return (
        <View style={styles.tabIcon}>
            <Text style={styles.emoji}>{icons[name] || '•'}</Text>
            <Text style={[styles.label, focused && styles.labelFocused]}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
            </Text>
        </View>
    );
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
                tabBarActiveTintColor: '#7CFC00',
                tabBarInactiveTintColor: '#64748b',
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="workout"
                options={{
                    title: 'Workout',
                    tabBarIcon: ({ focused }) => <TabIcon name="workout" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="coach"
                options={{
                    title: 'AI Hub',
                    tabBarIcon: ({ focused }) => <TabIcon name="hub" focused={focused} />,
                }}
            />
            {/* Hide journal from tabs - Coach now handles all logging */}
            <Tabs.Screen
                name="journal"
                options={{
                    href: null, // Hide from tab bar
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0f1419',
        borderTopColor: '#1e293b',
        borderTopWidth: 1,
        height: 80,
        paddingTop: 8,
        paddingBottom: 20,
    },
    tabIcon: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 60,
    },
    emoji: {
        fontSize: 24,
    },
    label: {
        fontSize: 10,
        marginTop: 4,
        color: '#64748b',
        textAlign: 'center',
    },
    labelFocused: {
        color: '#7CFC00',
        fontWeight: '600',
    },
    sceneContainer: {
        flex: 1,
        backgroundColor: '#0a0e14',
    },
});
