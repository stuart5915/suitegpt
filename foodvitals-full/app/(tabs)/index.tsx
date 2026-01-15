import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
  calculateTodaysTotals,
  getNutritionGoals,
  getTodaysFoodLogs,
  getFoodLogs,
  deleteFoodLog,
  FoodLogEntry,
} from '../../services/supabase';
import { suggestMealsForMacros, MealSuggestion, generateQuickInsight, NutritionContext } from '../../services/gemini';
import MealDetailModal from '../../components/MealDetailModal';
import MealSuggestionsModal from '../../components/MealSuggestionsModal';
import QuickTourModal from '../../components/QuickTourModal';

// Food suggestions for each micronutrient
const MICRO_FOOD_TIPS: Record<string, string> = {
  'Calcium': 'yogurt, cheese, or spinach',
  'Iron': 'red meat, spinach, or lentils',
  'Vitamin C': 'oranges, bell peppers, or strawberries',
  'Vitamin D': 'salmon, eggs, or fortified milk',
  'Potassium': 'bananas, potatoes, or avocados',
};

interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  log_count: number;
  // Micronutrients
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  potassium_mg?: number;
  sodium_mg?: number;
}

interface NutritionGoals {
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_fiber_g: number;
  // Micronutrient targets
  target_vitamin_c_mg?: number;
  target_vitamin_d_mcg?: number;
  target_calcium_mg?: number;
  target_iron_mg?: number;
  target_potassium_mg?: number;
  target_sodium_mg?: number;
}

export default function HomeScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [totals, setTotals] = useState<NutritionTotals | null>(null);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [recentLogs, setRecentLogs] = useState<FoodLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good day');
  const [selectedLog, setSelectedLog] = useState<FoodLogEntry | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  // Meal suggestions state
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [mealSuggestions, setMealSuggestions] = useState<MealSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showMicros, setShowMicros] = useState(false);  // Collapsed by default
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Quick Tip state
  const [quickTip, setQuickTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);

  // Quick Tour state
  const [showTour, setShowTour] = useState(false);

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Get user and load data
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
    // Check if first launch
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasSeenTour = await AsyncStorage.getItem('has_seen_tour');
      if (!hasSeenTour) {
        setShowTour(true);
      }
    } catch (e) {
      console.log('Error checking tour status');
    }
  };

  const handleTourClose = async () => {
    setShowTour(false);
    try {
      await AsyncStorage.setItem('has_seen_tour', 'true');
    } catch (e) {
      console.log('Error saving tour status');
    }
  };

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadData(userId);
      }
    }, [userId])
  );

  const loadData = async (uid: string, forceRefreshTip: boolean = false) => {
    // Load totals
    const { totals: todayTotals } = await calculateTodaysTotals(uid);
    if (todayTotals) setTotals(todayTotals);

    // Load goals and check profile completeness
    const { data: goalsData } = await getNutritionGoals(uid);
    if (goalsData && goalsData.target_calories > 0) {
      setGoals(goalsData);
      setIsProfileComplete(true);
    } else {
      setGoals(null);
      setIsProfileComplete(false);
    }

    // Load today's logs
    const { data: logs } = await getTodaysFoodLogs(uid);
    if (logs) setRecentLogs(logs.slice(0, 5));

    // Load full history for AI context (last 20 meals)
    const { data: historyLogs } = await getFoodLogs(uid);
    const aiContextLogs = historyLogs && historyLogs.length > 0 ? historyLogs.slice(0, 20) : (logs || []);

    // Load quick tip if we have data (or force refresh)
    if ((!quickTip || forceRefreshTip) && todayTotals && goalsData) {
      loadQuickTip(todayTotals, goalsData, aiContextLogs);
    }
  };

  const loadQuickTip = async (currentTotals: any, currentGoals: any, logs: FoodLogEntry[]) => {
    setTipLoading(true);
    try {
      const recentMeals = logs.map(l => ({
        date: l.logged_at || new Date().toISOString(),
        title: l.raw_input || 'Meal',
        calories: l.total_calories || 0,
        protein_g: l.total_protein_g || 0,
        carbs_g: l.total_carbs_g || 0,
        fat_g: l.total_fat_g || 0,
      }));
      const context: NutritionContext = {
        goals: currentGoals,
        todayTotals: currentTotals,
        recentMeals,
      };
      const tip = await generateQuickInsight(context);
      setQuickTip(tip);
    } catch (e) {
      console.log('Failed to load tip');
      setQuickTip('Consider adding more variety to your meals for balanced nutrition.');
    }
    setTipLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (userId) await loadData(userId, true); // Force refresh tip
    setRefreshing(false);
  };

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#4ADE80';
    if (percent >= 50) return '#FBBF24';
    return '#888';
  };

  const formatMealType = (type?: string) => {
    if (!type) return '🍽️';
    switch (type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleDeleteLog = (logId: string, mealName: string) => {
    setDeleteTarget({ id: logId, name: mealName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteFoodLog(deleteTarget.id);
    if (!error && userId) {
      loadData(userId);
    }
    setDeleteTarget(null);
  };

  const calorieProgress = totals && goals
    ? getProgress(totals.calories, goals.target_calories)
    : 0;

  // Calculate remaining macros for meal suggestions
  const remainingMacros = {
    calories: Math.max(0, (goals?.target_calories || 0) - (totals?.calories || 0)),
    protein_g: Math.max(0, (goals?.target_protein_g || 0) - (totals?.protein_g || 0)),
    carbs_g: Math.max(0, (goals?.target_carbs_g || 0) - (totals?.carbs_g || 0)),
    fat_g: Math.max(0, (goals?.target_fat_g || 0) - (totals?.fat_g || 0)),
  };

  // Determine progress status
  const getProgressStatus = () => {
    if (!goals || !totals) return 'loading';
    const calPercent = (totals.calories / goals.target_calories) * 100;
    if (calPercent >= 95 && calPercent <= 105) return 'goal-reached';
    if (calPercent > 115) return 'exceeded';
    return 'in-progress';
  };
  const progressStatus = getProgressStatus();

  // Find the biggest micronutrient gap
  const getMicroGap = () => {
    if (!totals || !goals) return null;

    const micros = [
      { name: 'Calcium', current: totals.calcium_mg || 0, target: goals.target_calcium_mg || 1000 },
      { name: 'Iron', current: totals.iron_mg || 0, target: goals.target_iron_mg || 18 },
      { name: 'Vitamin C', current: totals.vitamin_c_mg || 0, target: goals.target_vitamin_c_mg || 90 },
      { name: 'Vitamin D', current: totals.vitamin_d_mcg || 0, target: goals.target_vitamin_d_mcg || 20 },
      { name: 'Potassium', current: totals.potassium_mg || 0, target: goals.target_potassium_mg || 3500 },
    ];

    // Find the one with lowest percentage
    let lowest = micros[0];
    let lowestPercent = (lowest.current / lowest.target) * 100;

    for (const m of micros) {
      const percent = (m.current / m.target) * 100;
      if (percent < lowestPercent) {
        lowest = m;
        lowestPercent = percent;
      }
    }

    // Only show tip if below 80%
    if (lowestPercent < 80) {
      return {
        name: lowest.name,
        percent: Math.round(lowestPercent),
        foods: MICRO_FOOD_TIPS[lowest.name] || 'nutrient-rich foods',
      };
    }
    return null;
  };

  const microGap = getMicroGap();

  const handleSuggestMeal = () => {
    setShowSuggestionsModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ADE80" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.subtitle}>Track what you eat today</Text>
          </View>
          <TouchableOpacity style={styles.helpButton} onPress={() => setShowTour(true)}>
            <Ionicons name="help-circle-outline" size={28} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        {/* Profile Setup Prompt - Show when profile is incomplete */}
        {isProfileComplete === false && (
          <TouchableOpacity
            style={styles.profilePrompt}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={styles.profilePromptIcon}>
              <Ionicons name="person-circle-outline" size={32} color="#4ADE80" />
            </View>
            <View style={styles.profilePromptText}>
              <Text style={styles.profilePromptTitle}>Complete Your Profile</Text>
              <Text style={styles.profilePromptSubtitle}>
                Set your nutrition goals to unlock meal suggestions and track progress
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* Quick AI Tip */}
        {quickTip && (
          <View style={styles.quickTipCard}>
            <TouchableOpacity
              style={styles.quickTipHeader}
              onPress={() => setTipExpanded(!tipExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.quickTipIcon}>
                <Text style={styles.quickTipEmoji}>✨</Text>
              </View>
              <Text
                style={styles.quickTipText}
                numberOfLines={tipExpanded ? undefined : 2}
              >
                {quickTip}
              </Text>
              <Ionicons
                name={tipExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color="#4ADE80"
              />
            </TouchableOpacity>

            {tipExpanded && (
              <TouchableOpacity
                style={styles.chatAboutTipBtn}
                onPress={() => router.push(`/(tabs)/insights?tip=${encodeURIComponent(quickTip || '')}`)}
              >
                <Ionicons name="chatbubble-outline" size={14} color="#4ADE80" />
                <Text style={styles.chatAboutTipText}>Chat with me about this</Text>
                <Ionicons name="chevron-forward" size={14} color="#4ADE80" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Today's Summary Card */}
        <LinearGradient
          colors={['#1a472a', '#2d5a3d']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today's Progress</Text>
            <Text style={styles.summaryDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>

          {/* Status Banner */}
          {progressStatus === 'goal-reached' && (
            <View style={styles.statusBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
              <Text style={styles.statusBannerText}>🎉 Great work! You've hit your daily goals!</Text>
            </View>
          )}
          {progressStatus === 'goal-reached' && microGap && (
            <View style={[styles.statusBanner, styles.microGapBanner]}>
              <Ionicons name="information-circle" size={20} color="#60A5FA" />
              <Text style={[styles.statusBannerText, styles.microGapText]}>
                💡 You're low on {microGap.name} ({microGap.percent}%) - try {microGap.foods} tomorrow!
              </Text>
            </View>
          )}
          {progressStatus === 'exceeded' && (
            <View style={[styles.statusBanner, styles.statusBannerWarning]}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={[styles.statusBannerText, styles.statusBannerTextWarning]}>
                ⚠️ You've exceeded your daily calorie goal
              </Text>
            </View>
          )}

          {/* Calorie Circle */}
          <View style={styles.calorieCircle}>
            <Text style={styles.calorieValue}>
              {totals?.calories || 0}
            </Text>
            <Text style={styles.calorieLabel}>of {goals?.target_calories || 2000} cal</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${calorieProgress}%`,
                    backgroundColor: getProgressColor(calorieProgress)
                  }
                ]}
              />
            </View>
          </View>

          {/* Macro Breakdown */}
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <View style={styles.macroProgress}>
                <Text style={styles.macroValue}>{Math.round(totals?.protein_g || 0)}g</Text>
              </View>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroTarget}>of {goals?.target_protein_g || 150}g</Text>
            </View>

            <View style={styles.macroItem}>
              <View style={styles.macroProgress}>
                <Text style={styles.macroValue}>{Math.round(totals?.carbs_g || 0)}g</Text>
              </View>
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroTarget}>of {goals?.target_carbs_g || 200}g</Text>
            </View>

            <View style={styles.macroItem}>
              <View style={styles.macroProgress}>
                <Text style={styles.macroValue}>{Math.round(totals?.fat_g || 0)}g</Text>
              </View>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroTarget}>of {goals?.target_fat_g || 70}g</Text>
            </View>
          </View>

          {/* Micronutrient Section - Expandable */}
          <TouchableOpacity
            style={styles.microHeader}
            onPress={() => setShowMicros(!showMicros)}
          >
            <Text style={styles.microHeaderLabel}>Micronutrients</Text>
            <Ionicons
              name={showMicros ? "chevron-up" : "chevron-down"}
              size={18}
              color="#888"
            />
          </TouchableOpacity>

          {showMicros && (
            <View style={styles.microGrid}>
              {[
                { key: 'Vitamin C', abbr: 'C', current: totals?.vitamin_c_mg || 0, target: goals?.target_vitamin_c_mg || 90, unit: 'mg' },
                { key: 'Vitamin D', abbr: 'D', current: totals?.vitamin_d_mcg || 0, target: goals?.target_vitamin_d_mcg || 20, unit: 'mcg' },
                { key: 'Iron', abbr: 'Fe', current: totals?.iron_mg || 0, target: goals?.target_iron_mg || 18, unit: 'mg' },
                { key: 'Calcium', abbr: 'Ca', current: totals?.calcium_mg || 0, target: goals?.target_calcium_mg || 1000, unit: 'mg' },
                { key: 'Potassium', abbr: 'K', current: totals?.potassium_mg || 0, target: goals?.target_potassium_mg || 3500, unit: 'mg' },
              ].map(({ key, current, target, unit }) => {
                const percent = Math.min((current / target) * 100, 100);
                const color = percent >= 80 ? '#4ADE80' : percent >= 50 ? '#FBBF24' : '#EF4444';
                return (
                  <View key={key} style={styles.microItem}>
                    <View style={styles.microItemHeader}>
                      <Text style={styles.microItemName}>{key}</Text>
                      <Text style={styles.microItemValue}>
                        {Math.round(current)}/{target}{unit}
                      </Text>
                    </View>
                    <View style={styles.microProgressBar}>
                      <View style={[styles.microProgressFill, { width: `${percent}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </LinearGradient>

        {/* Recent Meals */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            <Text style={styles.mealCount}>{totals?.log_count || 0} logged</Text>
          </View>
          {goals && (
            <TouchableOpacity
              style={styles.suggestPill}
              onPress={handleSuggestMeal}
            >
              <Ionicons name="sparkles" size={14} color="#4ADE80" />
              <Text style={styles.suggestPillText}>Suggest Meals</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentLogs.length > 0 ? (
          recentLogs.map((log, index) => (
            <View key={log.id || index} style={styles.mealCard}>
              <TouchableOpacity
                style={styles.mealCardContent}
                onPress={() => setSelectedLog(log)}
                activeOpacity={0.7}
              >
                <Text style={styles.mealEmoji}>🍽️</Text>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName} numberOfLines={1}>
                    {log.raw_input || 'Meal'}
                  </Text>
                  <Text style={styles.mealMacros}>
                    {log.total_calories} cal • {Math.round(log.total_protein_g || 0)}g P
                  </Text>
                </View>
                <Text style={styles.mealTime}>{formatTime(log.logged_at)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteLogButton}
                onPress={() => log.id && handleDeleteLog(log.id, log.raw_input || 'Meal')}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <TouchableOpacity
            style={styles.emptyState}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <Ionicons name="restaurant-outline" size={48} color="#333" />
            <Text style={styles.emptyTitle}>No meals logged yet</Text>
            <Text style={styles.emptySubtitle}>Tap to log your first meal</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Meal Detail Modal */}
      <MealDetailModal
        visible={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />

      {/* Meal Suggestions Modal */}
      <MealSuggestionsModal
        visible={showSuggestionsModal}
        onClose={() => setShowSuggestionsModal(false)}
        remainingMacros={remainingMacros}
        onMealAdded={() => userId && loadData(userId)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="trash-outline" size={32} color="#EF4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Meal</Text>
            <Text style={styles.deleteModalMessage}>
              Remove "{deleteTarget?.name}" from today's log?
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelBtn]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDeleteBtn]}
                onPress={confirmDelete}
              >
                <Text style={styles.deleteModalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick Tour Modal */}
      <QuickTourModal visible={showTour} onClose={handleTourClose} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginTop: 4,
  },
  quickLogButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ADE80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButton: {
    padding: 4,
  },

  // Profile Setup Prompt
  profilePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  profilePromptIcon: {
    marginRight: 14,
  },
  profilePromptText: {
    flex: 1,
  },
  profilePromptTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  profilePromptSubtitle: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },

  // Summary Card
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  summaryDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  calorieCircle: {
    alignItems: 'center',
    marginBottom: 24,
  },
  calorieValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  calorieLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroProgress: {
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  macroLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  macroTarget: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  mealCount: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  suggestPillText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },

  // Meal Cards
  mealCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteLogButton: {
    padding: 6,
    marginLeft: 8,
  },
  mealCardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  mealMacros: {
    color: '#888',
    fontSize: 12,
  },
  mealTimeContainer: {
    alignItems: 'flex-end',
  },
  mealTime: {
    color: '#666',
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 12,
  },

  // Expanded Content
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  expandedMacros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  expandedMacroItem: {
    alignItems: 'center',
  },
  expandedMacroValue: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '700',
  },
  expandedMacroLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  expandedItems: {
    marginTop: 8,
  },
  expandedItemsTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  expandedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  expandedItemName: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  expandedItemCals: {
    color: '#888',
    fontSize: 12,
    marginLeft: 12,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },

  // Quick Actions
  quickActions: {
    marginTop: 24,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Status Banners
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  statusBannerWarning: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  statusBannerText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  statusBannerTextWarning: {
    color: '#F59E0B',
  },
  microGapBanner: {
    backgroundColor: 'rgba(96,165,250,0.12)',
    marginTop: 8,
  },
  microGapText: {
    color: '#60A5FA',
  },

  // Micronutrient Section - Expandable
  microHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  microHeaderLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  microGrid: {
    marginTop: 12,
    gap: 10,
  },
  microItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
  },
  microItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  microItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  microItemValue: {
    color: '#888',
    fontSize: 12,
  },
  microProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  microProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Delete Confirmation Modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  deleteModalMessage: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteModalCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deleteModalCancelText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalDeleteBtn: {
    backgroundColor: '#EF4444',
  },
  deleteModalDeleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Quick Tip Card
  quickTipCard: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
    overflow: 'hidden',
  },
  quickTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  quickTipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTipEmoji: {
    fontSize: 14,
  },
  quickTipText: {
    flex: 1,
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  chatAboutTipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(74,222,128,0.15)',
    backgroundColor: 'rgba(74,222,128,0.05)',
  },
  chatAboutTipText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '500',
  },
});
