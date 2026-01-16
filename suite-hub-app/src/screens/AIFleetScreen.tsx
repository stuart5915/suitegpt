import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { fetchApps, App } from '../services/supabase';

export default function AIFleetScreen() {
  const navigation = useNavigation<any>();
  const [apps, setApps] = useState<App[]>([]);
  const [filteredApps, setFilteredApps] = useState<App[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = apps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredApps(filtered);
    } else {
      setFilteredApps(apps);
    }
  }, [searchQuery, apps]);

  async function loadApps() {
    const data = await fetchApps();
    setApps(data);
    setFilteredApps(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadApps();
    setRefreshing(false);
  }

  function openApp(app: App) {
    if (app.app_url) {
      navigation.navigate('AppWebView', { app });
    }
  }

  function renderApp({ item }: { item: App }) {
    return (
      <TouchableOpacity style={styles.appCard} onPress={() => openApp(item)}>
        <View style={styles.appIcon}>
          <Text style={styles.appIconText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{item.name}</Text>
          <Text style={styles.appTagline} numberOfLines={1}>
            {item.tagline || 'Tap to explore'}
          </Text>
          <View style={styles.appMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category || 'App'}</Text>
            </View>
            {item.status === 'featured' && (
              <View style={[styles.categoryBadge, styles.featuredBadge]}>
                <Text style={styles.featuredText}>🔥 Featured</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Fleet</Text>
        <Text style={styles.subtitle}>{apps.length} apps available</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Apps List */}
      <FlatList
        data={filteredApps}
        renderItem={renderApp}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryOrange}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No apps found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    padding: 20,
    paddingTop: 16,
  },
  searchInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconText: {
    fontSize: 24,
    color: Colors.primaryOrange,
  },
  appInfo: {
    flex: 1,
    marginLeft: 14,
  },
  appName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appTagline: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: Colors.backgroundLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  featuredBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
  },
  featuredText: {
    fontSize: 11,
    color: Colors.primaryOrange,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
