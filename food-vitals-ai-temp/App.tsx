import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useState } from 'react';

export default function App() {
  const [lastScan, setLastScan] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🥗 Food Vitals</Text>
        <Text style={styles.tagline}>AI-Powered Nutrition Scanner</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Scan Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setLastScan(new Date().toLocaleTimeString())}
        >
          <Text style={styles.scanIcon}>📷</Text>
          <Text style={styles.scanText}>Scan Food</Text>
          <Text style={styles.scanSubtext}>Take a photo to analyze nutrition</Text>
        </TouchableOpacity>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Calories Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0g</Text>
            <Text style={styles.statLabel}>Protein</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0g</Text>
            <Text style={styles.statLabel}>Carbs</Text>
          </View>
        </View>

        {/* Recent Scans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Scans</Text>
          {lastScan ? (
            <View style={styles.scanItem}>
              <Text style={styles.scanItemIcon}>🍎</Text>
              <View style={styles.scanItemContent}>
                <Text style={styles.scanItemTitle}>Sample Scan</Text>
                <Text style={styles.scanItemTime}>Scanned at {lastScan}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>No scans yet. Tap above to scan your first food!</Text>
          )}
        </View>

        {/* Daily Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Goals</Text>
          <View style={styles.goalItem}>
            <Text style={styles.goalLabel}>Calories</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.goalValue}>0 / 2000</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navLabel}>Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#10B981',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  scanButton: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanIcon: {
    fontSize: 48,
  },
  scanText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  scanSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 15,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  scanItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanItemIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  scanItemContent: {
    flex: 1,
  },
  scanItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scanItemTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
  },
  goalItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 15,
  },
  goalLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  goalValue: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'right',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingBottom: 24,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
  },
  navLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});
