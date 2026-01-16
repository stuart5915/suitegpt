import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { fetchApps, fetchFeaturedApp, App } from '../services/supabase';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [featuredApp, setFeaturedApp] = useState<App | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [credits, setCredits] = useState(0); // TODO: Get from auth context

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [featured, allApps] = await Promise.all([
      fetchFeaturedApp(),
      fetchApps(),
    ]);
    setFeaturedApp(featured);
    setApps(allApps.slice(0, 4)); // Show first 4
  }

  function openApp(app: App) {
    if (app.app_url) {
      navigation.navigate('AppWebView', { app });
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.title}>SUITE Hub</Text>
          </View>
          <View style={styles.creditsBox}>
            <Text style={styles.creditsIcon}>⚡</Text>
            <Text style={styles.creditsAmount}>{credits.toLocaleString()}</Text>
          </View>
        </View>

        {/* Featured App Card */}
        {featuredApp && (
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => openApp(featuredApp)}
          >
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>🔥 Featured Today</Text>
            </View>
            <View style={styles.featuredContent}>
              <View style={styles.featuredIcon}>
                <Text style={styles.featuredIconText}>
                  {featuredApp.icon_url ? '🍎' : featuredApp.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.featuredInfo}>
                <Text style={styles.featuredName}>{featuredApp.name}</Text>
                <Text style={styles.featuredTagline}>
                  {featuredApp.tagline || 'Tap to explore'}
                </Text>
              </View>
              <Text style={styles.featuredArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#1e3a5f' }]}
              onPress={() => navigation.navigate('AIFleet')}
            >
              <Text style={styles.actionIcon}>🤖</Text>
              <Text style={styles.actionLabel}>AI Fleet</Text>
              <Text style={styles.actionSub}>{apps.length} apps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#2d1f3d' }]}
              onPress={() => navigation.navigate('Wallet')}
            >
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionLabel}>Wallet</Text>
              <Text style={styles.actionSub}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#1f2d3d' }]}
              onPress={() =>
                navigation.navigate('AppWebView', {
                  app: { name: 'App Factory', app_url: 'https://www.getsuite.app/start-building' },
                })
              }
            >
              <Text style={styles.actionIcon}>🏗️</Text>
              <Text style={styles.actionLabel}>Build</Text>
              <Text style={styles.actionSub}>Create app</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#3d2d1f' }]}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.actionIcon}>👤</Text>
              <Text style={styles.actionLabel}>Profile</Text>
              <Text style={styles.actionSub}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Apps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Apps</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AIFleet')}>
              <Text style={styles.viewAll}>View all →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {apps.map((app) => (
              <TouchableOpacity
                key={app.id}
                style={styles.appCard}
                onPress={() => openApp(app)}
              >
                <View style={styles.appIcon}>
                  <Text style={styles.appIconText}>{app.name.charAt(0)}</Text>
                </View>
                <Text style={styles.appName} numberOfLines={1}>
                  {app.name}
                </Text>
                <Text style={styles.appCategory}>{app.category || 'App'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  creditsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  creditsIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  creditsAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryOrange,
  },
  featuredCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primaryOrange,
  },
  featuredBadge: {
    marginBottom: 12,
  },
  featuredBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryOrange,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredIconText: {
    fontSize: 28,
  },
  featuredInfo: {
    flex: 1,
    marginLeft: 12,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  featuredTagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  featuredArrow: {
    fontSize: 24,
    color: Colors.primaryOrange,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    color: Colors.primaryOrange,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appCard: {
    width: 100,
    marginRight: 12,
    alignItems: 'center',
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appIconText: {
    fontSize: 24,
    color: Colors.primaryOrange,
  },
  appName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  appCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
