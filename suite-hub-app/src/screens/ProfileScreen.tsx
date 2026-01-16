import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/colors';

// Discord OAuth config
const DISCORD_CLIENT_ID = '1457474266390986865';
const REDIRECT_URI = 'https://www.getsuite.app/oauth/callback';

export default function ProfileScreen() {
  const [user, setUser] = useState<{
    id: string;
    username: string;
    avatar: string;
  } | null>(null);

  async function loginWithDiscord() {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        // Parse the token from the URL
        const url = new URL(result.url);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (accessToken) {
          // Fetch user info
          const response = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userData = await response.json();
          setUser({
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar,
          });
        }
      }
    } catch (error) {
      console.error('Discord login error:', error);
      Alert.alert('Error', 'Failed to login with Discord');
    }
  }

  function logout() {
    setUser(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>👤 Profile</Text>
        </View>

        {/* Profile Card */}
        {user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.username}>@{user.username}</Text>
            <View style={styles.discordBadge}>
              <Text style={styles.discordIcon}>🎮</Text>
              <Text style={styles.discordText}>Discord Connected</Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginCard}>
            <Text style={styles.loginIcon}>🔐</Text>
            <Text style={styles.loginTitle}>Sign In Required</Text>
            <Text style={styles.loginDesc}>
              Connect your Discord account to track credits across all SUITE apps
            </Text>
            <TouchableOpacity style={styles.discordButton} onPress={loginWithDiscord}>
              <Text style={styles.discordButtonIcon}>🎮</Text>
              <Text style={styles.discordButtonText}>Login with Discord</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>🔔</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingDesc}>New apps, rewards alerts</Text>
            </View>
            <Text style={styles.settingArrow}>→</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>🎨</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Appearance</Text>
              <Text style={styles.settingDesc}>Dark mode enabled</Text>
            </View>
            <Text style={styles.settingArrow}>→</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>🔒</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Privacy</Text>
              <Text style={styles.settingDesc}>Data and security</Text>
            </View>
            <Text style={styles.settingArrow}>→</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>📖</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Documentation</Text>
              <Text style={styles.settingDesc}>Learn about SUITE</Text>
            </View>
            <Text style={styles.settingArrow}>→</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>💬</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Discord Community</Text>
              <Text style={styles.settingDesc}>Join 5,000+ members</Text>
            </View>
            <Text style={styles.settingArrow}>→</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>ℹ️</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>App Version</Text>
              <Text style={styles.settingDesc}>1.0.0</Text>
            </View>
          </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  profileCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  discordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.discord,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  discordIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  discordText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  logoutButton: {
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  loginCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loginIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  loginDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.discord,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  discordButtonIcon: {
    fontSize: 18,
  },
  discordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 18,
    color: Colors.textMuted,
  },
});
