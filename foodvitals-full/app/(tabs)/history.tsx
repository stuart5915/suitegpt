import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';

import {
    supabase,
    FoodLogEntry,
    FoodItem,
    getFoodItems,
    getFavoritedLogIds,
    saveFavoriteFromLog,
    deleteFavoriteMeal,
    deleteFoodLog,
    getFavoriteMeals,
    addFavoriteToToday,
    FavoriteMeal,
} from '../../services/supabase';

interface GroupedLogs {
    [date: string]: FoodLogEntry[];
}

export default function HistoryScreen() {
    const [logs, setLogs] = useState<FoodLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    // Inline expansion - track which card is expanded
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    // Map from log ID to favorite ID (for quick toggle)
    const [favoritesMap, setFavoritesMap] = useState<Record<string, string>>({});
    const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);

    // Delete functionality
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    // Add to past day modal
    const [addToDayModal, setAddToDayModal] = useState<{ visible: boolean; date: string; dateFormatted: string } | null>(null);
    const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
    const [addingFavoriteId, setAddingFavoriteId] = useState<string | null>(null);
    const [quickEntry, setQuickEntry] = useState('');
    const [isAddingQuick, setIsAddingQuick] = useState(false);

    // Expanded card food items
    const [expandedItems, setExpandedItems] = useState<FoodItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Load food items when a card is expanded
    useEffect(() => {
        if (expandedLogId) {
            loadExpandedItems(expandedLogId);
        } else {
            setExpandedItems([]);
        }
    }, [expandedLogId]);

    const loadExpandedItems = async (logId: string) => {
        setLoadingItems(true);
        const { data } = await getFoodItems(logId);
        setExpandedItems(data || []);
        setLoadingItems(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('History - User:', user?.id);

            if (user) {
                setUserId(user.id);
                // Get ALL logs (no date filter)
                const { data, error } = await supabase
                    .from('food_logs')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                console.log('History - Food logs:', data?.length || 0, 'Error:', error);

                if (data && !error) {
                    setLogs(data);
                } else if (error) {
                    console.error('History - Query error:', error);
                }

                // Load favorites map
                const { favoritesMap: fMap } = await getFavoritedLogIds(user.id);
                setFavoritesMap(fMap);
            } else {
                console.log('History - No user logged in');
                setLogs([]);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleFavorite = async (log: FoodLogEntry) => {
        if (!userId || !log.id) return;

        setTogglingFavorite(log.id);

        const existingFavoriteId = favoritesMap[log.id];

        if (existingFavoriteId) {
            // Remove from favorites
            const { error } = await deleteFavoriteMeal(existingFavoriteId);
            if (!error) {
                setFavoritesMap(prev => {
                    const updated = { ...prev };
                    delete updated[log.id!];
                    return updated;
                });
            }
        } else {
            // Add to favorites
            const { data, error } = await saveFavoriteFromLog(userId, log);
            if (!error && data) {
                setFavoritesMap(prev => ({
                    ...prev,
                    [log.id!]: data.id,
                }));
            }
        }

        setTogglingFavorite(null);
    };

    // Delete a food log
    const handleDeleteLog = (logId: string, mealName: string) => {
        setDeleteTarget({ id: logId, name: mealName });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await deleteFoodLog(deleteTarget.id);
        if (!error) {
            // Refresh the logs
            loadData();
        }
        setDeleteTarget(null);
    };

    // Open add-to-day modal
    const handleOpenAddModal = async (date: string, dateFormatted: string) => {
        if (!userId) return;
        // Load favorites for the modal
        const { data } = await getFavoriteMeals(userId);
        setFavorites(data || []);
        setAddToDayModal({ visible: true, date, dateFormatted });
    };

    // Add a favorite to a specific past day
    const handleAddFavoriteToDay = async (favorite: FavoriteMeal, targetDate: string) => {
        if (!userId || !favorite.id) return;
        setAddingFavoriteId(favorite.id);

        // Create a log entry for the past day
        const { error } = await supabase
            .from('food_logs')
            .insert({
                user_id: userId,
                raw_input: favorite.name,
                total_calories: favorite.calories || 0,
                total_protein_g: favorite.protein_g || 0,
                total_carbs_g: favorite.carbs_g || 0,
                total_fat_g: favorite.fat_g || 0,
                total_fiber_g: favorite.fiber_g || 0,
                meal_type: 'meal',
                logged_at: targetDate + 'T12:00:00', // Default to noon for past days
            });

        setAddingFavoriteId(null);
        if (!error) {
            setAddToDayModal(null);
            loadData(); // Refresh
        }
    };

    // Quick text entry for past day
    const handleQuickEntryAdd = async () => {
        if (!userId || !quickEntry.trim() || !addToDayModal) return;
        setIsAddingQuick(true);

        const { error } = await supabase
            .from('food_logs')
            .insert({
                user_id: userId,
                raw_input: quickEntry.trim(),
                total_calories: 0, // Will be updated if they scan later
                total_protein_g: 0,
                total_carbs_g: 0,
                total_fat_g: 0,
                meal_type: 'meal',
                logged_at: addToDayModal.date + 'T12:00:00',
            });

        setIsAddingQuick(false);
        if (!error) {
            setQuickEntry('');
            setAddToDayModal(null);
            loadData();
        }
    };

    // Group logs by date
    const groupedLogs: GroupedLogs = logs.reduce((acc: GroupedLogs, log) => {
        const date = new Date(log.logged_at || '').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(log);
        return acc;
    }, {});

    const getMealIcon = (mealType: string) => {
        switch (mealType) {
            case 'breakfast': return '🌅';
            case 'lunch': return '☀️';
            case 'dinner': return '🌙';
            case 'snack': return '🍎';
            default: return '🍽️';
        }
    };

    const getDayTotal = (dayLogs: FoodLogEntry[]) => {
        return dayLogs.reduce((sum, log) => sum + (log.total_calories || 0), 0);
    };

    const getDayMacros = (dayLogs: FoodLogEntry[]) => {
        return {
            protein: Math.round(dayLogs.reduce((sum, log) => sum + (log.total_protein_g || 0), 0)),
            carbs: Math.round(dayLogs.reduce((sum, log) => sum + (log.total_carbs_g || 0), 0)),
            fat: Math.round(dayLogs.reduce((sum, log) => sum + (log.total_fat_g || 0), 0)),
        };
    };

    // Parse ingredients from raw_input text for display
    const parseIngredientsFromText = (text: string): string[] => {
        if (!text) return [];
        // Look for patterns like "8oz pasta", "1 cup rice", "2 eggs"
        const regex = /(\d+(?:[\/.]?\d+)?(?:\s*(?:oz|lb|g|ml|cup|cups|tbsp|tsp|slice|slices|piece|pieces))?)\s+(?:of\s+)?([a-zA-Z][a-zA-Z\-\s]*?)(?=[,.]|(?:\d)|and\s+\d|$)/gi;
        const matches: string[] = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            let ingredient = `${match[1]} ${match[2].trim()}`;
            ingredient = ingredient.replace(/\s+(with|and|or|the|a|an)$/i, '').trim();
            if (ingredient.length > 3 && !matches.some(m => m.toLowerCase() === ingredient.toLowerCase())) {
                matches.push(ingredient);
            }
        }

        // Fallback: split by comma if no pattern matches
        if (matches.length === 0 && text.includes(',')) {
            return text.split(',').map(s => s.trim()).filter(s => s.length > 3).slice(0, 6);
        }

        return matches.slice(0, 8); // Limit to 8 items
    };



    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4ADE80" />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Food History</Text>
                <Text style={styles.subtitle}>Last 30 days</Text>

                {/* Explanation Banner */}
                <View style={styles.tipBanner}>
                    <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
                    <Text style={styles.tipText}>
                        Keep your log accurate! Tap <Text style={styles.tipBold}>[+]</Text> on any day to add missed meals,
                        or <Text style={styles.tipBold}>🗑️</Text> to remove mistakes. Your AI insights depend on this data.
                    </Text>
                </View>

                {Object.keys(groupedLogs).length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="restaurant-outline" size={64} color="#444" />
                        <Text style={styles.emptyTitle}>No meals logged yet</Text>
                        <Text style={styles.emptyText}>
                            Start logging your meals to see your history here
                        </Text>
                    </View>
                ) : (
                    Object.entries(groupedLogs).map(([date, dayLogs]) => {
                        // Get raw date from first log for add-to-day
                        const rawDate = dayLogs[0]?.logged_at?.split('T')[0] || '';

                        return (
                            <View key={date} style={styles.daySection}>
                                <View style={styles.dayHeader}>
                                    <View style={styles.dayHeaderLeft}>
                                        <Text style={styles.dayDate}>{date}</Text>
                                        <View style={styles.dayMacroRow}>
                                            <Text style={styles.dayTotal}>
                                                {getDayTotal(dayLogs)} cal
                                            </Text>
                                            <Text style={styles.dayMacroDot}>•</Text>
                                            <Text style={styles.dayMacro}>
                                                {getDayMacros(dayLogs).protein}P
                                            </Text>
                                            <Text style={styles.dayMacroDot}>•</Text>
                                            <Text style={styles.dayMacro}>
                                                {getDayMacros(dayLogs).carbs}C
                                            </Text>
                                            <Text style={styles.dayMacroDot}>•</Text>
                                            <Text style={styles.dayMacro}>
                                                {getDayMacros(dayLogs).fat}F
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.addToDayButton}
                                        onPress={() => handleOpenAddModal(rawDate, date)}
                                    >
                                        <Ionicons name="add-circle-outline" size={24} color="#4ADE80" />
                                    </TouchableOpacity>
                                </View>

                                {dayLogs.map((log) => {
                                    const isFavorited = log.id ? !!favoritesMap[log.id] : false;
                                    const isToggling = togglingFavorite === log.id;

                                    const isExpanded = expandedLogId === log.id;

                                    return (
                                        <TouchableOpacity
                                            key={log.id}
                                            style={[styles.logCard, isExpanded && styles.logCardExpanded]}
                                            onPress={() => setExpandedLogId(isExpanded ? null : log.id || null)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.logHeader}>
                                                <Text style={styles.mealIcon}>🍽️</Text>
                                                <View style={styles.logInfo}>
                                                    <Text style={styles.mealType} numberOfLines={1}>
                                                        {log.raw_input || 'Meal'}
                                                    </Text>
                                                    <Text style={styles.logTime}>
                                                        {new Date(log.logged_at || '').toLocaleTimeString('en-US', {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                        })}
                                                    </Text>
                                                </View>
                                                <View style={styles.logCaloriesContainer}>
                                                    <Text style={styles.logCalories}>
                                                        {log.total_calories || 0} cal
                                                    </Text>
                                                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-forward"} size={16} color="#666" />
                                                </View>
                                            </View>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <View style={styles.expandedSection}>
                                                    {/* What's in this meal - Bullet Points */}
                                                    <View style={styles.descriptionBox}>
                                                        <Text style={styles.descriptionLabel}>🍳 What's in this meal</Text>
                                                        {loadingItems ? (
                                                            <View style={styles.loadingItemsInline}>
                                                                <ActivityIndicator size="small" color="#4ADE80" />
                                                            </View>
                                                        ) : expandedItems.length > 0 ? (
                                                            <View style={styles.bulletList}>
                                                                {expandedItems.map((item, idx) => (
                                                                    <View key={item.id || idx} style={styles.bulletItem}>
                                                                        <Text style={styles.bulletDot}>•</Text>
                                                                        <Text style={styles.bulletText}>
                                                                            {item.quantity} {item.unit} {item.name}
                                                                        </Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        ) : parseIngredientsFromText(log.raw_input || '').length > 0 ? (
                                                            <View style={styles.bulletList}>
                                                                {parseIngredientsFromText(log.raw_input || '').map((ing, idx) => (
                                                                    <View key={idx} style={styles.bulletItem}>
                                                                        <Text style={styles.bulletDot}>•</Text>
                                                                        <Text style={styles.bulletText}>{ing}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        ) : (
                                                            <Text style={styles.descriptionText}>{log.raw_input}</Text>
                                                        )}
                                                    </View>

                                                    {/* Macro Summary Bar */}
                                                    <View style={styles.macroSummaryBar}>
                                                        <View style={styles.macroSummaryItem}>
                                                            <Text style={styles.macroSummaryValue}>{Math.round(log.total_protein_g || 0)}g</Text>
                                                            <Text style={styles.macroSummaryLabel}>Protein</Text>
                                                        </View>
                                                        <View style={styles.macroSummaryDivider} />
                                                        <View style={styles.macroSummaryItem}>
                                                            <Text style={styles.macroSummaryValue}>{Math.round(log.total_carbs_g || 0)}g</Text>
                                                            <Text style={styles.macroSummaryLabel}>Carbs</Text>
                                                        </View>
                                                        <View style={styles.macroSummaryDivider} />
                                                        <View style={styles.macroSummaryItem}>
                                                            <Text style={styles.macroSummaryValue}>{Math.round(log.total_fat_g || 0)}g</Text>
                                                            <Text style={styles.macroSummaryLabel}>Fat</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            )}

                                            <View style={styles.cardFooter}>
                                                <View style={styles.macroRow}>
                                                    <View style={styles.macroItem}>
                                                        <Text style={styles.macroValue}>{Math.round(log.total_protein_g || 0)}g</Text>
                                                        <Text style={styles.macroLabel}>Protein</Text>
                                                    </View>
                                                    <View style={styles.macroItem}>
                                                        <Text style={styles.macroValue}>{Math.round(log.total_carbs_g || 0)}g</Text>
                                                        <Text style={styles.macroLabel}>Carbs</Text>
                                                    </View>
                                                    <View style={styles.macroItem}>
                                                        <Text style={styles.macroValue}>{Math.round(log.total_fat_g || 0)}g</Text>
                                                        <Text style={styles.macroLabel}>Fat</Text>
                                                    </View>
                                                </View>

                                                <TouchableOpacity
                                                    style={[styles.favoriteButton, isFavorited && styles.favoriteButtonActive]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFavorite(log);
                                                    }}
                                                    disabled={isToggling}
                                                >
                                                    {isToggling ? (
                                                        <ActivityIndicator size="small" color="#EF4444" />
                                                    ) : (
                                                        <Ionicons
                                                            name={isFavorited ? "heart" : "heart-outline"}
                                                            size={20}
                                                            color={isFavorited ? "#EF4444" : "#888"}
                                                        />
                                                    )}
                                                </TouchableOpacity>

                                                {/* Delete Button */}
                                                <TouchableOpacity
                                                    style={styles.deleteButton}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteLog(log.id!, log.raw_input || 'Meal');
                                                    }}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#888" />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        );
                    })
                )}
            </ScrollView>



            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteTarget !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteTarget(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIcon}>
                            <Ionicons name="trash-outline" size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.modalTitle}>Delete Meal</Text>
                        <Text style={styles.modalMessage}>
                            Remove "{deleteTarget?.name}" from your history?
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelBtn]}
                                onPress={() => setDeleteTarget(null)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalDeleteBtn]}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.modalDeleteText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add to Past Day Modal */}
            <Modal
                visible={addToDayModal?.visible || false}
                transparent
                animationType="slide"
                onRequestClose={() => setAddToDayModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.addModalContent}>
                        <View style={styles.addModalHeader}>
                            <Text style={styles.addModalTitle}>
                                Add to {addToDayModal?.dateFormatted}
                            </Text>
                            <TouchableOpacity onPress={() => setAddToDayModal(null)}>
                                <Ionicons name="close" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>

                        {/* Quick Text Entry */}
                        <View style={styles.quickEntrySection}>
                            <Text style={styles.quickEntryLabel}>Quick add what you ate:</Text>
                            <View style={styles.quickEntryRow}>
                                <TextInput
                                    style={styles.quickEntryInput}
                                    value={quickEntry}
                                    onChangeText={setQuickEntry}
                                    placeholder="e.g. 2 eggs and toast"
                                    placeholderTextColor="#666"
                                />
                                <TouchableOpacity
                                    style={[styles.quickEntryBtn, !quickEntry.trim() && styles.quickEntryBtnDisabled]}
                                    onPress={handleQuickEntryAdd}
                                    disabled={!quickEntry.trim() || isAddingQuick}
                                >
                                    {isAddingQuick ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <Ionicons name="add" size={20} color="#000" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.addModalDivider}>— or —</Text>

                        <TouchableOpacity
                            style={styles.addModalOption}
                            onPress={() => {
                                setAddToDayModal(null);
                                // Navigate to scan with date parameter
                                router.push({
                                    pathname: '/(tabs)/scan',
                                    params: { targetDate: addToDayModal?.date }
                                });
                            }}
                        >
                            <Ionicons name="camera-outline" size={24} color="#4ADE80" />
                            <Text style={styles.addModalOptionText}>Scan New Meal</Text>
                            <Ionicons name="chevron-forward" size={20} color="#666" />
                        </TouchableOpacity>

                        <Text style={styles.addModalSectionTitle}>Or add from favorites:</Text>

                        <ScrollView style={styles.favoritesScroll}>
                            {favorites.length === 0 ? (
                                <Text style={styles.noFavorites}>No favorites yet</Text>
                            ) : (
                                favorites.map((fav) => (
                                    <TouchableOpacity
                                        key={fav.id}
                                        style={styles.favoriteItem}
                                        onPress={() => handleAddFavoriteToDay(fav, addToDayModal?.date || '')}
                                        disabled={addingFavoriteId === fav.id}
                                    >
                                        <View style={styles.favoriteItemInfo}>
                                            <Text style={styles.favoriteItemName}>{fav.name}</Text>
                                            <Text style={styles.favoriteItemMacros}>
                                                {fav.calories} cal • {fav.protein_g}g P
                                            </Text>
                                        </View>
                                        {addingFavoriteId === fav.id ? (
                                            <ActivityIndicator size="small" color="#4ADE80" />
                                        ) : (
                                            <Ionicons name="add-circle" size={24} color="#4ADE80" />
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#888',
        marginTop: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
        marginBottom: 24,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    },
    daySection: {
        marginBottom: 24,
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    dayDate: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    dayTotal: {
        fontSize: 14,
        color: '#4ADE80',
        fontWeight: '600',
    },
    logCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    logCardExpanded: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    mealIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    logInfo: {
        flex: 1,
    },
    mealType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    logTime: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    logCaloriesContainer: {
        alignItems: 'flex-end',
    },
    logCalories: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4ADE80',
    },
    logInput: {
        fontSize: 13,
        color: '#aaa',
        marginBottom: 12,
    },
    macroRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        padding: 10,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    macroLabel: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },

    // Card Footer with macros and favorite button
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    favoriteButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    favoriteButtonActive: {
        backgroundColor: 'rgba(239,68,68,0.15)',
    },


    // Expanded Items
    expandedItems: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
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

    // Day Header
    dayHeaderLeft: {
        flex: 1,
    },
    dayMacroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    dayMacroDot: {
        color: '#444',
        fontSize: 8,
    },
    dayMacro: {
        color: '#888',
        fontSize: 12,
    },
    addToDayButton: {
        padding: 4,
    },

    // Delete Button
    deleteButton: {
        padding: 8,
        marginLeft: 4,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        padding: 24,
        width: '85%',
        alignItems: 'center',
    },
    modalIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(239,68,68,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalMessage: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    modalDeleteBtn: {
        backgroundColor: '#EF4444',
    },
    modalCancelText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    modalDeleteText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Add Modal Styles
    addModalContent: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '70%',
        width: '100%',
        position: 'absolute',
        bottom: 0,
    },
    addModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    addModalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    addModalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74,222,128,0.1)',
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
        gap: 12,
    },
    addModalOptionText: {
        color: '#4ADE80',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    addModalSectionTitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 12,
    },
    favoritesScroll: {
        maxHeight: 300,
    },
    noFavorites: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 20,
    },
    favoriteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    favoriteItemInfo: {
        flex: 1,
    },
    favoriteItemName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 4,
    },
    favoriteItemMacros: {
        color: '#888',
        fontSize: 12,
    },

    // Tip Banner
    tipBanner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(251,191,36,0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        gap: 12,
        alignItems: 'flex-start',
    },
    tipText: {
        color: '#ccc',
        fontSize: 13,
        flex: 1,
        lineHeight: 19,
    },
    tipBold: {
        color: '#FBBF24',
        fontWeight: '600',
    },

    // Quick Entry
    quickEntrySection: {
        marginBottom: 16,
    },
    quickEntryLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 10,
    },
    quickEntryRow: {
        flexDirection: 'row',
        gap: 10,
    },
    quickEntryInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 15,
    },
    quickEntryBtn: {
        backgroundColor: '#4ADE80',
        borderRadius: 12,
        width: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickEntryBtnDisabled: {
        backgroundColor: 'rgba(74,222,128,0.3)',
    },
    addModalDivider: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        marginVertical: 16,
    },

    // Expanded Card Content
    expandedSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    descriptionBox: {
        backgroundColor: 'rgba(74,222,128,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    descriptionLabel: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    descriptionText: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 22,
    },
    loadingItemsInline: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    bulletList: {
        marginTop: 4,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    bulletDot: {
        color: '#4ADE80',
        fontSize: 14,
        marginRight: 8,
        marginTop: 1,
    },
    bulletText: {
        color: '#ccc',
        fontSize: 14,
        flex: 1,
    },
    macroSummaryBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    macroSummaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroSummaryValue: {
        color: '#4ADE80',
        fontSize: 18,
        fontWeight: '700',
    },
    macroSummaryLabel: {
        color: '#888',
        fontSize: 11,
        marginTop: 2,
    },
    macroSummaryDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    loadingItemsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 10,
    },
    loadingItemsText: {
        color: '#888',
        fontSize: 13,
    },
    ingredientsList: {
        marginTop: 4,
    },
    ingredientsTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    ingredientRow: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    ingredientInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    ingredientName: {
        color: '#fff',
        fontSize: 14,
        flex: 1,
        marginRight: 12,
    },
    ingredientCals: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '600',
    },
    ingredientMacros: {
        flexDirection: 'row',
        gap: 12,
    },
    ingredientMacro: {
        color: '#888',
        fontSize: 12,
    },
});
