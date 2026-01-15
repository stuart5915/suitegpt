import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Switch,
    TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { MealSuggestion, suggestMealsForMacros, MacroPreference } from '../services/gemini';
import {
    supabase,
    saveFavoriteMeal,
    addFavoriteToToday,
    FavoriteMeal,
} from '../services/supabase';

// Style options (excluding exact/under which slider handles)
type MealStyle = 'balanced' | 'micronutrient' | 'tasty';

interface MealSuggestionsModalProps {
    visible: boolean;
    onClose: () => void;
    remainingMacros: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
    };
    onMealAdded?: () => void;
}

export default function MealSuggestionsModal({
    visible,
    onClose,
    remainingMacros,
    onMealAdded,
}: MealSuggestionsModalProps) {
    // Internal state for generation
    const [phase, setPhase] = useState<'options' | 'loading' | 'results'>('options');
    const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
    const [mealCount, setMealCount] = useState<1 | 2 | 3>(2);
    const [targetPercent, setTargetPercent] = useState(50); // 50-100%
    const [prioritizeMicros, setPrioritizeMicros] = useState(false);
    const [comfortMode, setComfortMode] = useState(false);

    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [addedMeals, setAddedMeals] = useState<Set<string>>(new Set());
    const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Loading message cycling
    const loadingMessages = [
        "🍳 Cooking up ideas...",
        "🥗 Checking nutritional balance...",
        "📊 Matching your macro goals...",
        "✨ Adding some flavor...",
        "🧑‍🍳 Almost ready to serve...",
        "🍽️ Plating your options...",
    ];
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    // Cycle through loading messages
    useEffect(() => {
        if (phase === 'loading') {
            const interval = setInterval(() => {
                setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
            }, 2000);
            return () => clearInterval(interval);
        } else {
            setLoadingMessageIndex(0);
        }
    }, [phase]);

    // Custom macro inputs (editable in advanced)
    const [customProtein, setCustomProtein] = useState<string>('');
    const [customCarbs, setCustomCarbs] = useState<string>('');
    const [customFat, setCustomFat] = useState<string>('');

    // Reset when modal opens
    React.useEffect(() => {
        if (visible) {
            setPhase('options');
            setSuggestions([]);
            setAddedMeals(new Set());
            setMealCount(2);
            setTargetPercent(50);
            setPrioritizeMicros(false);
            setComfortMode(false);
            setShowAdvanced(false);
            // Reset custom macros to default 50% of remaining
            setCustomProtein(String(Math.round(remainingMacros.protein_g * 0.5)));
            setCustomCarbs(String(Math.round(remainingMacros.carbs_g * 0.5)));
            setCustomFat(String(Math.round(remainingMacros.fat_g * 0.5)));
        }
    }, [visible]);

    // Compute macros based on custom inputs or percentage
    const adjustedMacros = {
        calories: Math.round(
            ((parseInt(customProtein) || 0) * 4) +
            ((parseInt(customCarbs) || 0) * 4) +
            ((parseInt(customFat) || 0) * 9)
        ),
        protein_g: parseInt(customProtein) || Math.round(remainingMacros.protein_g * (targetPercent / 100)),
        carbs_g: parseInt(customCarbs) || Math.round(remainingMacros.carbs_g * (targetPercent / 100)),
        fat_g: parseInt(customFat) || Math.round(remainingMacros.fat_g * (targetPercent / 100)),
    };

    const handleGenerate = async () => {
        setPhase('loading');
        try {
            // Determine preference based on toggles
            let preference: MacroPreference = 'healthy'; // default balanced
            if (comfortMode) {
                preference = 'tasty';
            } else if (prioritizeMicros) {
                preference = 'micronutrient';
            }
            // Pass adjusted macros (already scaled by percentage)
            const results = await suggestMealsForMacros(adjustedMacros, preference, mealCount);
            setSuggestions(results);
            setPhase('results');
        } catch (error) {
            console.error('Failed to generate suggestions:', error);
            setSuggestions([]);
            setPhase('results');
        }
    };

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2000);
    };

    const handleFavorite = async (meal: MealSuggestion) => {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Saving favorite, user:', user?.id);

        if (!user) {
            showToast('⚠️ Please sign in to save favorites');
            return;
        }

        if (favorites.has(meal.name)) {
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

        const { data, error } = await saveFavoriteMeal(user.id, favoriteMeal);
        console.log('Save favorite result:', { data, error });

        if (!error) {
            setFavorites(prev => new Set(prev).add(meal.name));
            showToast(`❤️ Saved "${meal.name}" to favorites!`);
        } else {
            showToast('⚠️ Failed to save favorite');
            console.error('Save favorite error:', error);
        }
    };

    const handleAddToToday = async (meal: MealSuggestion) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('⚠️ Please sign in to log meals');
            return;
        }

        // Toggle - if already added, remove from set
        if (addedMeals.has(meal.name)) {
            setAddedMeals(prev => {
                const newSet = new Set(prev);
                newSet.delete(meal.name);
                return newSet;
            });
            showToast(`🗑️ Removed "${meal.name}"`);
            return;
        }

        const favoriteMeal: FavoriteMeal = {
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            // Micronutrients from AI suggestion
            vitamin_c_mg: meal.vitamin_c_mg,
            vitamin_d_mcg: meal.vitamin_d_mcg,
            calcium_mg: meal.calcium_mg,
            iron_mg: meal.iron_mg,
            potassium_mg: meal.potassium_mg,
            sodium_mg: meal.sodium_mg,
        };

        const { error } = await addFavoriteToToday(user.id, favoriteMeal);

        if (!error) {
            setAddedMeals(prev => new Set(prev).add(meal.name));
            showToast(`✅ Added "${meal.name}" to today!`);
            onMealAdded?.();
        } else {
            Alert.alert('Error', 'Failed to add meal. Please try again.');
        }
    };

    const toggleExpand = (mealName: string) => {
        setExpandedMeal(prev => prev === mealName ? null : mealName);
    };

    // Generate simple ingredient list from description
    const getIngredients = (description: string): string[] => {
        // Look for patterns like "8oz pasta", "10oz of penne pasta", "1/2 cup sauce"
        const regex = /(\d+(?:[\/.]\d+)?(?:\s*oz|lb|cup|cups|tbsp|tsp|slice|slices|strip|strips|piece|pieces|g|ml)?)\s+(?:of\s+)?([a-zA-Z][a-zA-Z\-\s]*?)(?=[,.]|(?:\d)|topped|served|and\s|$)/gi;
        const matches: string[] = [];
        let match;

        while ((match = regex.exec(description)) !== null) {
            let ingredient = `${match[1]} ${match[2].trim()}`;
            // Clean up trailing words
            ingredient = ingredient.replace(/\s+(with|and|or|the|a|an)$/i, '').trim();
            if (ingredient.length > 5 && !matches.some(m => m.toLowerCase() === ingredient.toLowerCase())) {
                matches.push(ingredient);
            }
        }

        // If no matches found, just return a simple split
        if (matches.length === 0) {
            return description.split(',').map(s => s.trim()).filter(s => s.length > 5);
        }

        return matches;
    };

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
                        <Text style={styles.headerTitle}>Meal Ideas</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#888" />
                    </TouchableOpacity>
                </View>

                {/* Remaining Macros Summary */}
                <View style={styles.macroSummary}>
                    <Text style={styles.macroSummaryTitle}>To hit your goals, you need:</Text>
                    <View style={styles.macroRow}>
                        <View style={styles.macroChip}>
                            <Text style={styles.macroChipValue}>{Math.round(remainingMacros.protein_g)}g</Text>
                            <Text style={styles.macroChipLabel}>protein</Text>
                        </View>
                        <View style={styles.macroChip}>
                            <Text style={styles.macroChipValue}>{Math.round(remainingMacros.carbs_g)}g</Text>
                            <Text style={styles.macroChipLabel}>carbs</Text>
                        </View>
                        <View style={styles.macroChip}>
                            <Text style={styles.macroChipValue}>{Math.round(remainingMacros.fat_g)}g</Text>
                            <Text style={styles.macroChipLabel}>fat</Text>
                        </View>
                    </View>
                </View>

                {/* Content */}
                {phase === 'options' ? (
                    <ScrollView style={styles.optionsContainer} contentContainerStyle={styles.optionsContent}>
                        {/* Simple intro */}
                        <Text style={styles.introText}>
                            Ready to generate a meal idea based on your remaining macros?
                        </Text>

                        {/* Macro Preview Card */}
                        <View style={styles.previewCard}>
                            <Text style={styles.previewTitle}>Your generated meal will have:</Text>
                            <View style={styles.previewMacros}>
                                <Text style={styles.previewValue}>{adjustedMacros.calories} <Text style={styles.previewUnit}>cal</Text></Text>
                                <Text style={styles.previewDivider}>•</Text>
                                <Text style={styles.previewValue}>{adjustedMacros.protein_g}g <Text style={styles.previewUnit}>P</Text></Text>
                                <Text style={styles.previewDivider}>•</Text>
                                <Text style={styles.previewValue}>{adjustedMacros.carbs_g}g <Text style={styles.previewUnit}>C</Text></Text>
                                <Text style={styles.previewDivider}>•</Text>
                                <Text style={styles.previewValue}>{adjustedMacros.fat_g}g <Text style={styles.previewUnit}>F</Text></Text>
                            </View>
                        </View>

                        {/* Advanced Options Toggle */}
                        <TouchableOpacity
                            style={styles.advancedToggle}
                            onPress={() => setShowAdvanced(!showAdvanced)}
                        >
                            <Text style={styles.advancedToggleText}>Advanced Options</Text>
                            <Ionicons
                                name={showAdvanced ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="#666"
                            />
                        </TouchableOpacity>

                        {/* Advanced Options (Collapsible) */}
                        {showAdvanced && (
                            <View style={styles.advancedSection}>
                                {/* Meal Count */}
                                <Text style={styles.sectionLabel}>How many ideas?</Text>
                                <View style={styles.mealCountRow}>
                                    {([1, 2, 3] as const).map((count) => (
                                        <TouchableOpacity
                                            key={count}
                                            style={[
                                                styles.mealCountPill,
                                                mealCount === count && styles.mealCountPillActive
                                            ]}
                                            onPress={() => setMealCount(count)}
                                        >
                                            <Text style={[
                                                styles.mealCountText,
                                                mealCount === count && styles.mealCountTextActive
                                            ]}>
                                                {count}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Custom Macros Inputs */}
                                <View style={styles.macroLabelRow}>
                                    <Text style={styles.sectionLabel}>Macros</Text>
                                    <View style={styles.percentPills}>
                                        {[50, 75, 100].map((percent) => (
                                            <TouchableOpacity
                                                key={percent}
                                                style={[
                                                    styles.percentPill,
                                                    targetPercent === percent && styles.percentPillActive
                                                ]}
                                                onPress={() => {
                                                    setTargetPercent(percent);
                                                    setCustomProtein(String(Math.round(remainingMacros.protein_g * (percent / 100))));
                                                    setCustomCarbs(String(Math.round(remainingMacros.carbs_g * (percent / 100))));
                                                    setCustomFat(String(Math.round(remainingMacros.fat_g * (percent / 100))));
                                                }}
                                            >
                                                <Text style={[
                                                    styles.percentPillText,
                                                    targetPercent === percent && styles.percentPillTextActive
                                                ]}>
                                                    {percent}%
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.macroInputRow}>
                                    <View style={styles.macroInputItem}>
                                        <Text style={styles.macroInputLabel}>Protein (g)</Text>
                                        <TextInput
                                            style={styles.macroInput}
                                            value={customProtein}
                                            onChangeText={setCustomProtein}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#666"
                                        />
                                    </View>
                                    <View style={styles.macroInputItem}>
                                        <Text style={styles.macroInputLabel}>Carbs (g)</Text>
                                        <TextInput
                                            style={styles.macroInput}
                                            value={customCarbs}
                                            onChangeText={setCustomCarbs}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#666"
                                        />
                                    </View>
                                    <View style={styles.macroInputItem}>
                                        <Text style={styles.macroInputLabel}>Fat (g)</Text>
                                        <TextInput
                                            style={styles.macroInput}
                                            value={customFat}
                                            onChangeText={setCustomFat}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#666"
                                        />
                                    </View>
                                </View>
                                <Text style={styles.macroInputCalories}>
                                    ≈ {adjustedMacros.calories} calories
                                </Text>

                                {/* Toggles */}
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={styles.toggleEmoji}>🥗</Text>
                                        <View>
                                            <Text style={styles.toggleLabel}>Fill my micronutrient gaps</Text>
                                            <Text style={styles.toggleDesc}>Include foods to hit what I'm lacking</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={prioritizeMicros}
                                        onValueChange={setPrioritizeMicros}
                                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.4)' }}
                                        thumbColor={prioritizeMicros ? '#4ADE80' : '#888'}
                                    />
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={styles.toggleEmoji}>😋</Text>
                                        <View>
                                            <Text style={styles.toggleLabel}>Make it comfort food</Text>
                                            <Text style={styles.toggleDesc}>Fun, tasty indulgences</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={comfortMode}
                                        onValueChange={setComfortMode}
                                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(251,146,60,0.4)' }}
                                        thumbColor={comfortMode ? '#FB923C' : '#888'}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Generate Button - Primary action */}
                        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                            <Ionicons name="sparkles" size={20} color="#000" />
                            <Text style={styles.generateButtonText}>Generate Meal</Text>
                        </TouchableOpacity>
                    </ScrollView>
                ) : phase === 'loading' ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4ADE80" />
                        <Text style={styles.loadingText}>{loadingMessages[loadingMessageIndex]}</Text>
                    </View>
                ) : suggestions.length > 0 ? (
                    <ScrollView style={styles.suggestionsContainer} contentContainerStyle={styles.suggestionsContent}>
                        {suggestions.map((meal, index) => {
                            const isExpanded = expandedMeal === meal.name;
                            const isAdded = addedMeals.has(meal.name);
                            const isFavorited = favorites.has(meal.name);

                            return (
                                <View key={index} style={[styles.mealCard, isExpanded && styles.mealCardExpanded]}>
                                    {/* Card Header - Tappable */}
                                    <TouchableOpacity onPress={() => toggleExpand(meal.name)} activeOpacity={0.7}>
                                        <View style={styles.mealHeader}>
                                            <Text style={styles.mealName}>{meal.name}</Text>
                                            <View style={styles.headerIcons}>
                                                <TouchableOpacity
                                                    onPress={() => handleFavorite(meal)}
                                                    style={styles.heartButton}
                                                >
                                                    <Ionicons
                                                        name={isFavorited ? 'heart' : 'heart-outline'}
                                                        size={22}
                                                        color={isFavorited ? '#EF4444' : '#888'}
                                                    />
                                                </TouchableOpacity>
                                                <Ionicons
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={20}
                                                    color="#888"
                                                />
                                            </View>
                                        </View>
                                        <Text style={styles.mealDescription}>{meal.description}</Text>
                                    </TouchableOpacity>

                                    {/* Macros */}
                                    <View style={styles.mealMacros}>
                                        <View style={styles.mealMacroItem}>
                                            <Text style={styles.mealMacroValue}>{meal.calories}</Text>
                                            <Text style={styles.mealMacroLabel}>cal</Text>
                                        </View>
                                        <View style={styles.mealMacroDivider} />
                                        <View style={styles.mealMacroItem}>
                                            <Text style={[styles.mealMacroValue, styles.proteinColor]}>{meal.protein_g}g</Text>
                                            <Text style={styles.mealMacroLabel}>P</Text>
                                        </View>
                                        <View style={styles.mealMacroDivider} />
                                        <View style={styles.mealMacroItem}>
                                            <Text style={[styles.mealMacroValue, styles.carbsColor]}>{meal.carbs_g}g</Text>
                                            <Text style={styles.mealMacroLabel}>C</Text>
                                        </View>
                                        <View style={styles.mealMacroDivider} />
                                        <View style={styles.mealMacroItem}>
                                            <Text style={[styles.mealMacroValue, styles.fatColor]}>{meal.fat_g}g</Text>
                                            <Text style={styles.mealMacroLabel}>F</Text>
                                        </View>
                                    </View>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <View style={styles.expandedContent}>
                                            <View style={styles.ingredientsSection}>
                                                <Text style={styles.ingredientsTitle}>📝 What you'll need:</Text>
                                                {getIngredients(meal.description).map((ing, i) => (
                                                    <Text key={i} style={styles.ingredientItem}>• {ing}</Text>
                                                ))}
                                            </View>
                                            <View style={styles.tipsSection}>
                                                <Text style={styles.tipsTitle}>👩‍🍳 Quick tip:</Text>
                                                <Text style={styles.tipsText}>
                                                    Season with salt, pepper, and your favorite herbs. Cook protein to safe internal temperature.
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* Add to Today Button */}
                                    <TouchableOpacity
                                        style={[styles.addButton, isAdded && styles.addedButton]}
                                        onPress={() => handleAddToToday(meal)}
                                    >
                                        <Ionicons
                                            name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                                            size={18}
                                            color={isAdded ? '#888' : '#fff'}
                                        />
                                        <Text style={[styles.addButtonText, isAdded && styles.addedButtonText]}>
                                            {isAdded ? 'Added to Today ✓' : 'Add to Today'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No suggestions available</Text>
                    </View>
                )
                }

                {/* Toast */}
                {
                    toast && (
                        <View style={styles.toast}>
                            <Text style={styles.toastText}>{toast}</Text>
                        </View>
                    )
                }
            </View >
        </Modal >
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

    // Macro Summary
    macroSummary: {
        padding: 16,
        backgroundColor: 'rgba(74,222,128,0.08)',
        margin: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    macroSummaryTitle: {
        color: '#888',
        fontSize: 13,
        marginBottom: 12,
        textAlign: 'center',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroChip: {
        alignItems: 'center',
    },
    macroChipValue: {
        color: '#4ADE80',
        fontSize: 18,
        fontWeight: 'bold',
    },
    macroChipLabel: {
        color: '#888',
        fontSize: 11,
        marginTop: 2,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },

    // Suggestions
    suggestionsContainer: {
        flex: 1,
    },
    suggestionsContent: {
        padding: 16,
        paddingTop: 0,
        gap: 12,
    },
    mealCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
    },
    mealCardExpanded: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    mealName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
        flex: 1,
    },
    heartButton: {
        padding: 4,
    },
    mealDescription: {
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    mealMacros: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    mealMacroItem: {
        alignItems: 'center',
    },
    mealMacroValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    mealMacroLabel: {
        color: '#666',
        fontSize: 11,
        marginTop: 2,
    },
    mealMacroDivider: {
        width: 1,
        height: 24,
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

    // Expanded Content
    expandedContent: {
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    ingredientsSection: {
        marginBottom: 12,
    },
    ingredientsTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    ingredientItem: {
        color: '#aaa',
        fontSize: 13,
        lineHeight: 22,
        marginLeft: 8,
    },
    tipsSection: {
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 10,
        padding: 12,
    },
    tipsTitle: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    tipsText: {
        color: '#888',
        fontSize: 12,
        lineHeight: 18,
    },

    // Add Button
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        borderRadius: 10,
        paddingVertical: 12,
        gap: 8,
    },
    addedButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    addButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    addedButtonText: {
        color: '#888',
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },

    // Toast
    toast: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    toastText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },

    // Options Phase
    optionsContainer: {
        flex: 1,
    },
    optionsContent: {
        padding: 20,
        paddingBottom: 40,
    },
    introText: {
        color: '#aaa',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    sectionLabel: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Meal Count Selector
    mealCountRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 28,
    },
    mealCountPill: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mealCountPillActive: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderColor: '#4ADE80',
    },
    mealCountText: {
        color: '#888',
        fontSize: 20,
        fontWeight: '600',
    },
    mealCountTextActive: {
        color: '#4ADE80',
    },

    // Portion Size Pills
    portionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 20,
    },
    portionPill: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    portionPillActive: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderColor: '#4ADE80',
    },
    portionEmoji: {
        fontSize: 24,
        marginBottom: 6,
    },
    portionText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    portionTextActive: {
        color: '#4ADE80',
    },
    portionCalories: {
        color: '#666',
        fontSize: 11,
    },

    // Macro Input Fields
    macroInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    macroLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    percentPills: {
        flexDirection: 'row',
        gap: 6,
    },
    percentPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    percentPillActive: {
        backgroundColor: 'rgba(74,222,128,0.2)',
    },
    percentPillText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    percentPillTextActive: {
        color: '#4ADE80',
    },
    macroInputItem: {
        flex: 1,
    },
    macroInputLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 6,
        textAlign: 'center',
    },
    macroInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    macroInputCalories: {
        color: '#4ADE80',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },

    // Slider
    sliderContainer: {
        marginBottom: 20,
    },
    sliderValue: {
        color: '#4ADE80',
        fontSize: 32,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    sliderLabelText: {
        color: '#666',
        fontSize: 12,
    },

    // Preview Card
    previewCard: {
        backgroundColor: 'rgba(74,222,128,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    previewTitle: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 8,
    },
    previewMacros: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    previewValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    previewUnit: {
        color: '#888',
        fontSize: 12,
        fontWeight: '400',
    },
    previewDivider: {
        color: '#444',
        fontSize: 12,
    },

    // Advanced Options
    advancedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginBottom: 8,
    },
    advancedToggleText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    advancedSection: {
        marginBottom: 8,
    },

    // Toggle Rows
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    toggleEmoji: {
        fontSize: 24,
    },
    toggleLabel: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    toggleDesc: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },

    // Generate Button
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        borderRadius: 14,
        paddingVertical: 16,
        gap: 10,
        marginTop: 8,
    },
    generateButtonText: {
        color: '#000',
        fontSize: 17,
        fontWeight: '700',
    },
});
