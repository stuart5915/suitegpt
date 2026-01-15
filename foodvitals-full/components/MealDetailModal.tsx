import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import {
    getFoodItems,
    FoodItem,
    FoodLogEntry,
    supabase,
    saveFavoriteFromLog,
    isMealFavoritedByLogId,
    deleteFavoriteMeal,
    saveFoodLog,
} from '../services/supabase';


interface MealDetailModalProps {
    visible: boolean;
    onClose: () => void;
    log: FoodLogEntry | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MealDetailModal({ visible, onClose, log }: MealDetailModalProps) {
    const [items, setItems] = useState<FoodItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [isFavorited, setIsFavorited] = useState(false);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [isSavingFavorite, setIsSavingFavorite] = useState(false);
    const [isAddingToday, setIsAddingToday] = useState(false);
    const [isAddedToday, setIsAddedToday] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (visible && log?.id) {
            loadItems(log.id);
            checkFavoriteStatus(log.id);
        } else {
            setItems([]);
            setIsFavorited(false);
            setFavoriteId(null);
            setIsAddedToday(false);
        }
    }, [visible, log?.id, userId]);

    const loadItems = async (logId: string) => {
        setIsLoading(true);
        const { data } = await getFoodItems(logId);
        setItems(data || []);
        setIsLoading(false);
    };

    const checkFavoriteStatus = async (logId: string) => {
        if (!userId) return;
        const { isFavorited: fav, favoriteId: favId } = await isMealFavoritedByLogId(userId, logId);
        setIsFavorited(fav);
        setFavoriteId(favId || null);
    };

    const handleToggleFavorite = async () => {
        if (!userId || !log) return;

        setIsSavingFavorite(true);

        if (isFavorited && favoriteId) {
            // Remove from favorites
            const { error } = await deleteFavoriteMeal(favoriteId);
            if (!error) {
                setIsFavorited(false);
                setFavoriteId(null);
            }
        } else {
            // Add to favorites
            const { data, error } = await saveFavoriteFromLog(userId, log);
            if (!error && data) {
                setIsFavorited(true);
                setFavoriteId(data.id);
            }
        }

        setIsSavingFavorite(false);
    };

    const handleAddToToday = async () => {
        if (!userId || !log) return;

        setIsAddingToday(true);

        const { error } = await saveFoodLog(userId, {
            raw_input: log.raw_input,
            total_calories: log.total_calories,
            total_protein_g: log.total_protein_g,
            total_carbs_g: log.total_carbs_g,
            total_fat_g: log.total_fat_g,
            total_fiber_g: log.total_fiber_g,
            meal_type: log.meal_type,
            user_verified: true,
        });

        setIsAddingToday(false);

        if (!error) {
            setIsAddedToday(true);
        }
    };

    const getMealEmoji = (mealType?: string) => {
        switch (mealType) {
            case 'breakfast': return '🌅';
            case 'lunch': return '☀️';
            case 'dinner': return '🌙';
            case 'snack': return '🍎';
            default: return '🍽️';
        }
    };

    const formatMealType = (mealType?: string) => {
        if (!mealType) return 'Meal';
        return mealType.charAt(0).toUpperCase() + mealType.slice(1);
    };

    if (!log) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.mealEmoji}>{getMealEmoji(log.meal_type)}</Text>
                        <Text style={styles.headerTitle}>{formatMealType(log.meal_type)}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={[styles.headerHeart, isFavorited && styles.headerHeartActive]}
                            onPress={handleToggleFavorite}
                            disabled={isSavingFavorite}
                        >
                            {isSavingFavorite ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                                <Ionicons
                                    name={isFavorited ? "heart" : "heart-outline"}
                                    size={22}
                                    color={isFavorited ? "#EF4444" : "#888"}
                                />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Analysis Header */}
                    <View style={styles.analysisHeader}>
                        <Text style={styles.analysisTitle}>Analysis Results</Text>
                        {log.ai_confidence && (
                            <View style={styles.confidenceBadge}>
                                <Text style={styles.confidenceText}>
                                    {Math.round(log.ai_confidence * 100)}% confident
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Totals Card */}
                    <LinearGradient
                        colors={['#1a472a', '#2d5a3d']}
                        style={styles.totalsCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.caloriesValue}>
                            {log.total_calories || 0} cal
                        </Text>
                        <View style={styles.macrosRow}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>
                                    {Math.round(log.total_protein_g || 0)}g
                                </Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>
                                    {Math.round(log.total_carbs_g || 0)}g
                                </Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>
                                    {Math.round(log.total_fat_g || 0)}g
                                </Text>
                                <Text style={styles.macroLabel}>Fat</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Meal Description (for AI-generated meals) */}
                    {log.raw_input && (
                        <View style={styles.descriptionCard}>
                            <Text style={styles.descriptionTitle}>🍳 What's in this meal</Text>
                            <Text style={styles.descriptionText}>{log.raw_input}</Text>
                        </View>
                    )}

                    {/* Items Detected - only show if there are items */}
                    {!isLoading && items.length > 0 && (
                        <>
                            <Text style={styles.itemsTitle}>Items Detected</Text>
                            {items.map((item, index) => (
                                <View key={item.id || index} style={styles.itemCard}>
                                    <View style={styles.itemHeader}>
                                        <Text style={styles.itemName}>
                                            {item.quantity} {item.unit} {item.name}
                                        </Text>
                                        <Text style={styles.itemCalories}>{item.calories} cal</Text>
                                    </View>
                                    <Text style={styles.itemMacros}>
                                        P: {Math.round(item.protein_g || 0)}g • C: {Math.round(item.carbs_g || 0)}g • F: {Math.round(item.fat_g || 0)}g
                                    </Text>
                                </View>
                            ))}
                        </>
                    )}

                    {/* Logged Time */}
                    <View style={styles.timeInfo}>
                        <Ionicons name="time-outline" size={14} color="#666" />
                        <Text style={styles.timeText}>
                            Logged {new Date(log.logged_at || '').toLocaleString()}
                        </Text>
                    </View>
                </ScrollView>

                {/* Footer with Add to Meal and Done */}
                <View style={styles.footer}>
                    <View style={styles.footerButtons}>
                        <TouchableOpacity
                            style={[styles.addToTodayButton, isAddedToday && styles.addedToTodayButton]}
                            onPress={handleAddToToday}
                            disabled={isAddingToday || isAddedToday}
                        >
                            {isAddingToday ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons
                                        name={isAddedToday ? "checkmark-circle" : "add-circle-outline"}
                                        size={18}
                                        color={isAddedToday ? "#888" : "#fff"}
                                    />
                                    <Text style={[styles.addToTodayButtonText, isAddedToday && styles.addedToTodayButtonText]}>
                                        {isAddedToday ? 'Added to Today ✓' : 'Add to Today'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A1A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerHeart: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerHeartActive: {
        backgroundColor: 'rgba(239,68,68,0.2)',
    },
    mealEmoji: {
        fontSize: 28,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    analysisHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    analysisTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    confidenceBadge: {
        backgroundColor: 'rgba(74,222,128,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    confidenceText: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '600',
    },
    totalsCard: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
    },
    caloriesValue: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    macroLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    itemsTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    loadingItems: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },
    itemCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
        marginRight: 12,
    },
    itemCalories: {
        color: '#4ADE80',
        fontSize: 15,
        fontWeight: '600',
    },
    itemMacros: {
        color: '#888',
        fontSize: 13,
        marginTop: 8,
    },
    noItems: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    noItemsText: {
        color: '#666',
        fontSize: 14,
    },
    descriptionCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
    },
    descriptionTitle: {
        color: '#4ADE80',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 10,
    },
    descriptionText: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 22,
    },
    timeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 20,
    },
    timeText: {
        color: '#666',
        fontSize: 12,
    },
    footer: {
        padding: 20,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    favoriteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    favoriteButtonActive: {
        backgroundColor: 'rgba(239,68,68,0.15)',
    },
    favoriteButtonText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600',
    },
    favoriteButtonTextActive: {
        color: '#EF4444',
    },
    addToTodayButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#4ADE80',
    },
    addedToTodayButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    addToTodayButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    addedToTodayButtonText: {
        color: '#888',
    },
    doneButton: {
        flex: 1,
        backgroundColor: '#4ADE80',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
});
