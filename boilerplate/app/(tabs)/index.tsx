/**
 * Home Screen
 * Your app's main dashboard
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTelegramAuth } from '../../contexts/TelegramAuthContext';
import { APP_NAME } from '../../config/features';

export default function HomeScreen() {
  const { user, credits } = useTelegramAuth();

  return (
    <LinearGradient colors={['#0A0A1A', '#1a1a2e', '#0A0A1A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{APP_NAME}</Text>
            {user && (
              <View style={styles.userBadge}>
                <Text style={styles.userName}>@{user.username || user.firstName}</Text>
                <Text style={styles.credits}>⚡ {credits.toFixed(0)}</Text>
              </View>
            )}
          </View>

          {/* Your app content goes here */}
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🚀</Text>
            <Text style={styles.placeholderTitle}>Welcome!</Text>
            <Text style={styles.placeholderText}>Start building your app here.</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { fontSize: 14, color: '#0088cc', fontWeight: '600' },
  credits: { fontSize: 14, color: '#ff9500', fontWeight: '700' },
  placeholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  placeholderEmoji: { fontSize: 64, marginBottom: 16 },
  placeholderTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  placeholderText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
