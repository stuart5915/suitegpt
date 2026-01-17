/**
 * Tab Navigator Layout
 * Customize tabs for your app
 */

import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A1A',
          borderTopColor: 'rgba(255,255,255,0.1)',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#ff9500',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
        }}
      />
      {/* Add more tabs as needed */}
    </Tabs>
  );
}
