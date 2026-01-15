import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { user, healthProfile, loading: authLoading } = useAuth();

  // Use healthProfile from AuthContext - this is where health_profile_complete lives
  const profileComplete = healthProfile?.health_profile_complete ?? false;

  const handleBeginPress = () => {
    if (!profileComplete) {
      // Profile not complete - take user to profile tab for onboarding
      router.push('/(tabs)/profile');
    } else {
      // Profile complete - proceed to scan
      router.push('/(tabs)/scan');
    }
  };

  // Show loading only while AuthContext is loading
  const isLoading = authLoading || !user;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TrueForm AI</Text>
          <Text style={styles.subtitle}>Your AI Physio Companion</Text>
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How it works</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📸</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>1. Record Your Movement</Text>
            <Text style={styles.featureDesc}>
              Use the AI-guided diagnostic scan to capture your movement in 6 quick phases
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>🔍</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>2. Get AI Analysis</Text>
            <Text style={styles.featureDesc}>
              Receive a detailed movement assessment with pain point mapping and insights
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📋</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>3. Generate Rehab Plan</Text>
            <Text style={styles.featureDesc}>
              AI creates a personalized 2-6 week progressive exercise program
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>✅</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>4. Track Daily Exercises</Text>
            <Text style={styles.featureDesc}>
              Complete your exercises each day and watch your progress over time
            </Text>
          </View>
        </View>

        {/* Begin Button */}
        <TouchableOpacity
          style={[styles.beginButton, isLoading && styles.beginButtonLoading]}
          onPress={handleBeginPress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#0D0D1A" size="small" />
          ) : !profileComplete ? (
            <Text style={styles.beginButtonText}>Complete Profile to Begin</Text>
          ) : (
            <Text style={styles.beginButtonText}>Begin</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  featureDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    lineHeight: 18,
  },
  beginButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  beginButtonLoading: {
    opacity: 0.7,
  },
  beginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D0D1A',
  },
});
