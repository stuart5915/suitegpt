import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';

export default function WalletScreen() {
  const navigation = useNavigation<any>();

  // TODO: Get from auth context
  const credits = 0;
  const walletConnected = false;

  function openWalletPage() {
    navigation.navigate('AppWebView', {
      app: {
        name: 'Wallet',
        app_url: 'https://www.getsuite.app/wallet',
      },
    });
  }

  function openStaking() {
    navigation.navigate('AppWebView', {
      app: {
        name: 'Staking',
        app_url: 'https://www.getsuite.app/wallet#staking',
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>💰 Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SUITE Credits</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceIcon}>⚡</Text>
            <Text style={styles.balanceAmount}>{credits.toLocaleString()}</Text>
          </View>
          <Text style={styles.balanceUsd}>≈ ${(credits * 0.001).toFixed(2)} USD</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={openWalletPage}>
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={styles.actionText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionSecondary]} onPress={openStaking}>
            <Text style={styles.actionIcon}>📈</Text>
            <Text style={styles.actionText}>Stake</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Wallet</Text>
          {walletConnected ? (
            <View style={styles.walletCard}>
              <Text style={styles.walletAddress}>0x1a2b...3c4d</Text>
              <View style={styles.walletStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.connectButton} onPress={openWalletPage}>
              <Text style={styles.connectText}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>

          <TouchableOpacity style={styles.linkCard} onPress={openWalletPage}>
            <Text style={styles.linkIcon}>💰</Text>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Manage Wallet</Text>
              <Text style={styles.linkDesc}>Deposit, withdraw, view transactions</Text>
            </View>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkCard} onPress={openStaking}>
            <Text style={styles.linkIcon}>🥩</Text>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Staking & Rewards</Text>
              <Text style={styles.linkDesc}>Earn yield on your SUITE tokens</Text>
            </View>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() =>
              navigation.navigate('AppWebView', {
                app: { name: 'Governance', app_url: 'https://www.getsuite.app/governance' },
              })
            }
          >
            <Text style={styles.linkIcon}>🗳️</Text>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Governance</Text>
              <Text style={styles.linkDesc}>Vote on feature requests</Text>
            </View>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
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
  balanceCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryOrange,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    fontSize: 32,
    marginRight: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  balanceUsd: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryOrange,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionSecondary: {
    backgroundColor: Colors.purple,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
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
  walletCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  walletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: Colors.green,
  },
  connectButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  connectText: {
    fontSize: 16,
    color: Colors.primaryOrange,
    fontWeight: '600',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  linkDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  linkArrow: {
    fontSize: 18,
    color: Colors.textMuted,
  },
});
