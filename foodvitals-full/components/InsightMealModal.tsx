import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MealSuggestion } from '../services/gemini';
import {
    supabase,
    saveFavoriteMeal,
    addFavoriteToToday,
    FavoriteMeal,
} from '../services/supabase';

interface InsightMealModalProps {
    visible: boolean;
    onClose: () => void;
    meal: MealSuggestion | null;
    onMealAdded?: () => void;
}

export default function InsightMealModal({
    visible,
    onClose,
    meal,
    onMealAdded,
}: InsightMealModalProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [isAdded, setIsAdded] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setIsAdded(false);
            setIsFavorited(false);
        }
    }, [visible]);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2000);
    };

    const handleAddToToday = async () => {
        if (!meal || isAdding) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('⚠️ Please sign in to log meals');
            return;
        }

        setIsAdding(true);

        const favoriteMeal: FavoriteMeal = {
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            vitamin_c_mg: meal.vitamin_c_mg,
            vitamin_d_mcg: meal.vitamin_d_mcg,
            calcium_mg: meal.calcium_mg,
            iron_mg: meal.iron_mg,
            potassium_mg: meal.potassium_mg,
            sodium_mg: meal.sodium_mg,
        };

        console.log('🔍 Adding meal with micronutrients:', {
            name: favoriteMeal.name,
            vitamin_c_mg: favoriteMeal.vitamin_c_mg,
            iron_mg: favoriteMeal.iron_mg,
            calcium_mg: favoriteMeal.calcium_mg,
            potassium_mg: favoriteMeal.potassium_mg,
            sodium_mg: favoriteMeal.sodium_mg,
        });

        const { error } = await addFavoriteToToday(user.id, favoriteMeal);
        setIsAdding(false);

        if (!error) {
            setIsAdded(true);
            showToast(`✅ Added "${meal.name}" to today!`);
            onMealAdded?.();
            // Close modal after a short delay
            setTimeout(() => onClose(), 1500);
        } else {
            showToast('⚠️ Failed to add meal');
        }
    };

    const handleFavorite = async () => {
        if (!meal || isFavorited) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('⚠️ Please sign in to save favorites');
            return;
        }

        const favoriteMeal: FavoriteMeal = {
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            source: 'ai_suggestion',
        };

        const { error } = await saveFavoriteMeal(user.id, favoriteMeal);

        if (!error) {
            setIsFavorited(true);
            showToast(`❤️ Saved to favorites!`);
        } else {
            showToast('⚠️ Failed to save favorite');
        }
    };

    // Parse ingredients from description
    const getIngredients = (description: string): string[] => {
        // Split by common separators and clean up
        const parts = description.split(/[,\n•\-]/).map(s => s.trim()).filter(s => s.length > 3);
        return parts.length > 0 ? parts : [description];
    };

    if (!meal) return null;

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
                        <Text style={styles.headerIcon}>🍽️</Text>
                        <Text style={styles.headerTitle}>AI Meal Suggestion</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#888" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    {/* Meal Card */}
                    <View style={styles.mealCard}>
                        <View style={styles.mealHeader}>
                            <Text style={styles.mealName}>{meal.name}</Text>
                            <TouchableOpacity onPress={handleFavorite} style={styles.heartButton}>
                                <Ionicons
                                    name={isFavorited ? 'heart' : 'heart-outline'}
                                    size={24}
                                    color={isFavorited ? '#EF4444' : '#888'}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Macros */}
                        <View style={styles.macros}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{meal.calories}</Text>
                                <Text style={styles.macroLabel}>cal</Text>
                            </View>
                            <View style={styles.macroDivider} />
                            <View style={styles.macroItem}>
                                <Text style={[styles.macroValue, styles.proteinColor]}>{meal.protein_g}g</Text>
                                <Text style={styles.macroLabel}>protein</Text>
                            </View>
                            <View style={styles.macroDivider} />
                            <View style={styles.macroItem}>
                                <Text style={[styles.macroValue, styles.carbsColor]}>{meal.carbs_g}g</Text>
                                <Text style={styles.macroLabel}>carbs</Text>
                            </View>
                            <View style={styles.macroDivider} />
                            <View style={styles.macroItem}>
                                <Text style={[styles.macroValue, styles.fatColor]}>{meal.fat_g}g</Text>
                                <Text style={styles.macroLabel}>fat</Text>
                            </View>
                        </View>

                        {/* Ingredients */}
                        <View style={styles.ingredientsSection}>
                            <Text style={styles.ingredientsTitle}>📝 Ingredients</Text>
                            {getIngredients(meal.description).map((ing, i) => (
                                <Text key={i} style={styles.ingredientItem}>• {ing}</Text>
                            ))}
                        </View>

                        {/* Micronutrients */}
                        {(meal.vitamin_c_mg || meal.iron_mg || meal.calcium_mg || meal.potassium_mg) && (
                            <View style={styles.microsSection}>
                                <Text style={styles.microsTitle}>💊 Micronutrients</Text>
                                <View style={styles.microsGrid}>
                                    {meal.vitamin_c_mg !== undefined && meal.vitamin_c_mg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.vitamin_c_mg}mg</Text>
                                            <Text style={styles.microLabel}>Vitamin C</Text>
                                        </View>
                                    )}
                                    {meal.vitamin_d_mcg !== undefined && meal.vitamin_d_mcg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.vitamin_d_mcg}mcg</Text>
                                            <Text style={styles.microLabel}>Vitamin D</Text>
                                        </View>
                                    )}
                                    {meal.calcium_mg !== undefined && meal.calcium_mg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.calcium_mg}mg</Text>
                                            <Text style={styles.microLabel}>Calcium</Text>
                                        </View>
                                    )}
                                    {meal.iron_mg !== undefined && meal.iron_mg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.iron_mg}mg</Text>
                                            <Text style={styles.microLabel}>Iron</Text>
                                        </View>
                                    )}
                                    {meal.potassium_mg !== undefined && meal.potassium_mg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.potassium_mg}mg</Text>
                                            <Text style={styles.microLabel}>Potassium</Text>
                                        </View>
                                    )}
                                    {meal.sodium_mg !== undefined && meal.sodium_mg > 0 && (
                                        <View style={styles.microItem}>
                                            <Text style={styles.microValue}>{meal.sodium_mg}mg</Text>
                                            <Text style={styles.microLabel}>Sodium</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Add to Today Button */}
                    <TouchableOpacity
                        style={[styles.addButton, isAdded && styles.addedButton]}
                        onPress={handleAddToToday}
                        disabled={isAdding || isAdded}
                    >
                        {isAdding ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons
                                    name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                                    size={20}
                                    color={isAdded ? '#888' : '#000'}
                                />
                                <Text style={[styles.addButtonText, isAdded && styles.addedButtonText]}>
                                    {isAdded ? 'Added to Today ✓' : 'Add to Today'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                {/* Toast */}
                {toast && (
                    <View style={styles.toast}>
                        <Text style={styles.toastText}>{toast}</Text>
                    </View>
                )}
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
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIcon: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    mealCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    mealName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
    },
    heartButton: {
        padding: 4,
    },
    macros: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    macroLabel: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    macroDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    proteinColor: {
        color: '#60A5FA',
    },
    carbsColor: {
        color: '#FBBF24',
    },
    fatColor: {
        color: '#F472B6',
    },
    ingredientsSection: {
        backgroundColor: 'rgba(74,222,128,0.08)',
        borderRadius: 12,
        padding: 16,
    },
    ingredientsTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
    },
    ingredientItem: {
        color: '#aaa',
        fontSize: 14,
        lineHeight: 24,
        marginLeft: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 10,
    },
    addedButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    addButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    addedButtonText: {
        color: '#888',
    },
    toast: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        backgroundColor: 'rgba(26,26,46,0.95)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
    },
    toastText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    microsSection: {
        backgroundColor: 'rgba(139,92,246,0.08)',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
    },
    microsTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
    },
    microsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    microItem: {
        backgroundColor: 'rgba(139,92,246,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    microValue: {
        color: '#A78BFA',
        fontSize: 14,
        fontWeight: '600',
    },
    microLabel: {
        color: '#888',
        fontSize: 10,
        marginTop: 2,
    },
});
