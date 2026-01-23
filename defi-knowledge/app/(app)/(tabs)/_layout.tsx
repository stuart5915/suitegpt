import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
    return (
        <View style={styles.iconContainer}>
            <Ionicons name={name} size={24} color={color} />
            {focused && <View style={styles.activeIndicator} />}
        </View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors.tabBar.active,
                tabBarInactiveTintColor: Colors.tabBar.inactive,
                tabBarStyle: {
                    backgroundColor: Colors.tabBar.background,
                    borderTopColor: Colors.tabBar.border,
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 85 : 65,
                    paddingTop: 8,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                },
                headerStyle: {
                    backgroundColor: Colors.background,
                    borderBottomColor: Colors.border,
                    borderBottomWidth: 1,
                },
                headerTintColor: Colors.textPrimary,
                headerTitleStyle: {
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabBarIcon name="home" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="learn"
                options={{
                    title: 'Learn',
                    headerTitle: 'Learn DeFi',
                    tabBarIcon: ({ color, focused }) => (
                        <TabBarIcon name="book" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: 'Use',
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <TabBarIcon name="swap-horizontal" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="consult"
                options={{
                    title: 'Consult',
                    headerTitle: 'Expert Help',
                    tabBarIcon: ({ color, focused }) => (
                        <TabBarIcon name="chatbubbles" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    headerTitle: 'Your Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <TabBarIcon name="person" color={color} focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.primary,
    },
});
