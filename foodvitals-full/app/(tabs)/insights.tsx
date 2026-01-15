import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';

import {
    supabase,
    calculateTodaysTotals,
    getNutritionGoals,
    getFoodLogs,
    FoodLogEntry,
    saveTip,
} from '../../services/supabase';
import {
    chatWithInsights,
    NutritionContext,
    MealSuggestion,
} from '../../services/gemini';
import InsightMealModal from '../../components/InsightMealModal';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    saved?: boolean; // Whether tip has been saved to profile
    parsedMeal?: MealSuggestion | null; // Parsed meal data if this is a meal suggestion
}

const DEFAULT_PROMPTS = [
    "How's my week going?",
    "What should I eat next?",
    "Am I missing any nutrients?",
    "Give me a meal idea",
];

export default function InsightsScreen() {
    const { tip } = useLocalSearchParams<{ tip?: string }>();
    const [userId, setUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [refreshing, setRefreshing] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);

    // Context data
    const [goals, setGoals] = useState<any>(null);
    const [todayTotals, setTodayTotals] = useState<any>(null);
    const [recentLogs, setRecentLogs] = useState<FoodLogEntry[]>([]);

    // Save tip feature
    const [savingTipId, setSavingTipId] = useState<string | null>(null);
    const [showSavedToast, setShowSavedToast] = useState(false);
    const [showScrollIndicator, setShowScrollIndicator] = useState(true);

    // Custom prompts from profile
    const [quickPrompts, setQuickPrompts] = useState<string[]>(DEFAULT_PROMPTS);

    // Create meal from insight feature
    const [showMealModal, setShowMealModal] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState<MealSuggestion | null>(null);

    // Handle incoming tip from home screen
    useEffect(() => {
        if (tip) {
            // Add the tip as an AI message if not already present
            const tipMessage: Message = {
                id: 'home-tip-' + Date.now(),
                text: tip,
                isUser: false,
            };
            setMessages(prev => {
                // Check if we already have this tip
                if (prev.some(m => m.text === tip && !m.isUser)) {
                    return prev;
                }
                // Replace welcome message or add after it
                const filtered = prev.filter(m => m.id !== 'welcome');
                return [...filtered, tipMessage];
            });
            // Focus input after a short delay
            setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
        }
    }, [tip]);

    useEffect(() => {
        loadUser();
        loadSavedMessages();
        loadCustomPrompts();
    }, []);

    // Load custom prompts from profile settings
    const loadCustomPrompts = async () => {
        try {
            const saved = await AsyncStorage.getItem('custom_prompts');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setQuickPrompts(parsed);
                }
            }
        } catch (e) {
            console.log('Failed to load custom prompts');
        }
    };

    // Load saved messages from storage
    const loadSavedMessages = async () => {
        try {
            const saved = await AsyncStorage.getItem('insights_chat_messages');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                }
            }
        } catch (e) {
            console.log('Failed to load chat history');
        }
    };

    // Save messages whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            AsyncStorage.setItem('insights_chat_messages', JSON.stringify(messages));
        }
    }, [messages]);

    useFocusEffect(
        useCallback(() => {
            if (userId) {
                loadData(userId);
            }
            // Reload custom prompts in case user edited them in profile
            loadCustomPrompts();
        }, [userId])
    );

    const loadUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
            loadData(user.id);
        }
    };

    const loadData = async (uid: string) => {
        // Load goals
        const { data: goalsData } = await getNutritionGoals(uid);
        if (goalsData) setGoals(goalsData);

        // Load today's totals
        const { totals } = await calculateTodaysTotals(uid);
        if (totals) setTodayTotals(totals);

        // Load recent logs
        const { data: logs } = await getFoodLogs(uid);
        if (logs) setRecentLogs(logs.slice(0, 20));

        // Reset messages with welcome
        if (messages.length === 0) {
            setMessages([
                {
                    id: 'welcome',
                    text: "Hi! I'm your nutrition assistant. Ask me anything about your meals, nutrition gaps, or get personalized advice! 🥗",
                    isUser: false,
                    saved: true, // Don't show save button for welcome message
                },
            ]);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (userId) await loadData(userId);
        await loadInsight();
        setRefreshing(false);
    };

    // Build context for AI
    const nutritionContext: NutritionContext = {
        userProfile: goals ? {
            age: goals.age,
            gender: goals.gender,
            weight_kg: goals.weight_kg,
            weight_unit: goals.weight_unit,
            goal_type: goals.goal_type,
        } : undefined,
        goals: goals ? {
            target_calories: goals.target_calories,
            target_protein_g: goals.target_protein_g,
            target_carbs_g: goals.target_carbs_g,
            target_fat_g: goals.target_fat_g,
            target_fiber_g: goals.target_fiber_g,
        } : null,
        todayTotals: todayTotals ? {
            calories: todayTotals.calories,
            protein_g: todayTotals.protein_g,
            carbs_g: todayTotals.carbs_g,
            fat_g: todayTotals.fat_g,
            fiber_g: todayTotals.fiber_g,
        } : null,
        recentMeals: recentLogs.map(log => ({
            date: new Date(log.logged_at || '').toLocaleDateString(),
            title: log.raw_input || 'Meal',
            calories: log.total_calories || 0,
            protein_g: log.total_protein_g || 0,
            carbs_g: log.total_carbs_g || 0,
            fat_g: log.total_fat_g || 0,
        })),
    };



    const handleSend = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: text.trim(),
            isUser: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await chatWithInsights(text.trim(), nutritionContext);

            // Try to parse meal data from response
            const parsedMeal = parseMealFromResponse(response);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response,
                isUser: false,
                parsedMeal,
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I couldn't process that. Please try again!",
                isUser: false,
                saved: true, // Don't show save button for error messages
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTip = async (messageId: string, content: string) => {
        if (!userId) return;
        setSavingTipId(messageId);
        const { error } = await saveTip(userId, content);
        setSavingTipId(null);

        if (!error) {
            // Mark message as saved
            setMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, saved: true } : m
            ));
            setShowSavedToast(true);
            setTimeout(() => setShowSavedToast(false), 2500);
        }
    };

    // Parse meal suggestion from AI response text
    const parseMealFromResponse = (text: string): MealSuggestion | null => {
        // Look for nutritional content pattern like "- Calories: 993" or "Calories: 500"
        const caloriesMatch = text.match(/[\-•]?\s*Calories?:?\s*(\d+)/i);
        const proteinMatch = text.match(/[\-•]?\s*Protein:?\s*(\d+)g?/i);
        const carbsMatch = text.match(/[\-•]?\s*Carb(?:ohydrate)?s?:?\s*(\d+)g?/i);
        const fatMatch = text.match(/[\-•]?\s*Fat:?\s*(\d+)g?/i);

        // Micronutrients
        const vitaminCMatch = text.match(/[\-•]?\s*Vitamin?\s*C:?\s*(\d+)\s*mg/i);
        const vitaminDMatch = text.match(/[\-•]?\s*Vitamin?\s*D:?\s*(\d+)\s*(?:mcg|µg)/i);
        const calciumMatch = text.match(/[\-•]?\s*Calcium:?\s*(\d+)\s*mg/i);
        const ironMatch = text.match(/[\-•]?\s*Iron:?\s*(\d+)\s*mg/i);
        const potassiumMatch = text.match(/[\-•]?\s*Potassium:?\s*(\d+)\s*mg/i);
        const sodiumMatch = text.match(/[\-•]?\s*Sodium:?\s*(\d+)\s*mg/i);

        // If we have at least calories and protein, it's likely a meal suggestion
        if (caloriesMatch && proteinMatch) {
            // Extract ingredients list (lines starting with - that have quantities)
            const ingredientLines = text.match(/^\s*[\-•]\s*[\d½¼¾⅓⅔]+.*$/gm);
            const description = ingredientLines
                ? ingredientLines.map(l => l.replace(/^\s*[\-•]\s*/, '').trim()).join(', ')
                : text.substring(0, 200);

            // Generate a smart name from the main ingredients
            let name = 'Balanced Meal';
            if (ingredientLines && ingredientLines.length > 0) {
                // Extract key food words from ingredient lines
                const foodWords: string[] = [];
                const foodPatterns = [
                    /chicken/i, /beef/i, /salmon/i, /fish/i, /tuna/i, /shrimp/i, /steak/i, /turkey/i, /pork/i,
                    /rice/i, /quinoa/i, /pasta/i, /bread/i, /potato/i, /sweet potato/i, /oats/i,
                    /broccoli/i, /spinach/i, /salad/i, /asparagus/i, /green beans/i, /vegetables/i,
                    /eggs?/i, /avocado/i, /tofu/i, /lentils/i, /beans/i,
                ];

                for (const line of ingredientLines) {
                    for (const pattern of foodPatterns) {
                        const match = line.match(pattern);
                        if (match && !foodWords.includes(match[0].toLowerCase())) {
                            // Capitalize first letter
                            const word = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
                            foodWords.push(word);
                            break; // Only one food word per line
                        }
                    }
                    if (foodWords.length >= 3) break; // Max 3 words in name
                }

                if (foodWords.length > 0) {
                    name = foodWords.join(' & ');
                }
            }

            return {
                name,
                description,
                calories: parseInt(caloriesMatch[1]) || 0,
                protein_g: parseInt(proteinMatch[1]) || 0,
                carbs_g: carbsMatch ? parseInt(carbsMatch[1]) || 0 : 0,
                fat_g: fatMatch ? parseInt(fatMatch[1]) || 0 : 0,
                vitamin_c_mg: vitaminCMatch ? parseInt(vitaminCMatch[1]) || 0 : undefined,
                vitamin_d_mcg: vitaminDMatch ? parseInt(vitaminDMatch[1]) || 0 : undefined,
                calcium_mg: calciumMatch ? parseInt(calciumMatch[1]) || 0 : undefined,
                iron_mg: ironMatch ? parseInt(ironMatch[1]) || 0 : undefined,
                potassium_mg: potassiumMatch ? parseInt(potassiumMatch[1]) || 0 : undefined,
                sodium_mg: sodiumMatch ? parseInt(sodiumMatch[1]) || 0 : undefined,
            };
        }

        return null;
    };

    const handleCreateMeal = (meal: MealSuggestion) => {
        setSelectedMeal(meal);
        setShowMealModal(true);
    };


    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerIcon}>✨</Text>
                    <Text style={styles.headerTitle}>Insights</Text>
                </View>



                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ADE80" />
                    }
                >
                    {messages.map((message) => (
                        <View key={message.id}>
                            <View
                                style={[
                                    styles.messageBubble,
                                    message.isUser ? styles.userBubble : styles.aiBubble,
                                ]}
                            >
                                <Text style={[
                                    styles.messageText,
                                    message.isUser ? styles.userText : styles.aiText,
                                ]}>
                                    {message.text}
                                </Text>
                            </View>

                            {/* Action buttons - show under AI messages (not welcome, not already saved) */}
                            {!message.isUser && message.id !== 'welcome' && !message.saved && (
                                <View style={styles.actionButtonsRow}>
                                    {/* Save Tip button */}
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleSaveTip(message.id, message.text)}
                                        disabled={savingTipId === message.id}
                                    >
                                        {savingTipId === message.id ? (
                                            <ActivityIndicator size="small" color="#4ADE80" />
                                        ) : (
                                            <>
                                                <Ionicons name="bookmark-outline" size={14} color="#4ADE80" />
                                                <Text style={styles.actionButtonText}>Save Tip</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {/* Create Meal button - only show if meal was detected */}
                                    {message.parsedMeal && (
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.createMealButton]}
                                            onPress={() => handleCreateMeal(message.parsedMeal!)}
                                        >
                                            <Ionicons name="restaurant-outline" size={14} color="#fff" />
                                            <Text style={styles.createMealButtonText}>Create Meal</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Show saved confirmation (not for welcome message) */}
                            {!message.isUser && message.id !== 'welcome' && message.saved && (
                                <View style={styles.savedConfirmation}>
                                    <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                                    <Text style={styles.savedConfirmationText}>Saved to profile</Text>
                                </View>
                            )}
                        </View>
                    ))}

                    {isLoading && (
                        <View style={[styles.messageBubble, styles.aiBubble]}>
                            <ActivityIndicator size="small" color="#4ADE80" />
                        </View>
                    )}
                </ScrollView>

                {/* Quick Prompts */}
                {messages.length <= 1 && (
                    <View style={styles.quickPromptsRow}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.quickPromptsContainer}
                            contentContainerStyle={styles.quickPromptsContent}
                            keyboardShouldPersistTaps="handled"
                            onScroll={(e) => {
                                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                                const isAtEnd = contentOffset.x + layoutMeasurement.width >= contentSize.width - 10;
                                setShowScrollIndicator(!isAtEnd);
                            }}
                            scrollEventThrottle={16}
                        >
                            {quickPrompts.map((prompt: string, index: number) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.quickPromptButton}
                                    onPress={() => handleSend(prompt)}
                                >
                                    <Text style={styles.quickPromptText}>{prompt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {showScrollIndicator && (
                            <View style={styles.scrollIndicator}>
                                <Text style={styles.scrollIndicatorText}>›</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Input Area */}
                <View style={styles.inputContainer}>
                    <TextInput
                        ref={inputRef}
                        style={styles.textInput}
                        placeholder="Ask about your nutrition..."
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        onSubmitEditing={() => handleSend(inputText)}
                        returnKeyType="send"
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={() => handleSend(inputText)}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Ionicons
                            name="send"
                            size={20}
                            color={inputText.trim() ? '#fff' : '#666'}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {showSavedToast && (
                <View style={styles.savedToast}>
                    <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                    <Text style={styles.savedToastText}>Tip saved to profile!</Text>
                </View>
            )}

            {/* Insight Meal Modal */}
            <InsightMealModal
                visible={showMealModal}
                onClose={() => setShowMealModal(false)}
                meal={selectedMeal}
                onMealAdded={() => {
                    if (userId) loadData(userId);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A1A',
    },
    keyboardAvoid: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 10,
    },
    headerIcon: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },

    // Insight Card
    insightCard: {
        marginHorizontal: 20,
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
        marginBottom: 12,
    },
    insightHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    insightTitle: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '600',
    },
    insightText: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
    },

    // Messages
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 18,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#4ADE80',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: '#000',
    },
    aiText: {
        color: '#fff',
    },

    // Quick Prompts
    quickPromptsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickPromptsContainer: {
        flex: 1,
        maxHeight: 50,
    },
    quickPromptsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    quickPromptButton: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickPromptText: {
        color: '#4ADE80',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    scrollIndicator: {
        paddingRight: 12,
        paddingLeft: 4,
    },
    scrollIndicatorText: {
        color: '#4ADE80',
        fontSize: 20,
        fontWeight: '300',
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
        backgroundColor: '#0A0A1A',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        gap: 12,
    },
    textInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4ADE80',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },

    // Message menu row
    messageMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        marginTop: 4,
        marginBottom: 4,
        gap: 8,
    },
    messageMenuBtn: {
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
    },
    menuDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30,30,50,0.98)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuOptionText: {
        color: '#fff',
        fontSize: 14,
    },

    // Save prompt
    savePrompt: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 16,
        marginTop: -4,
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    savePromptText: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '500',
    },

    // Action buttons row (Save Tip + Create Meal)
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 16,
        marginTop: -4,
        marginBottom: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    actionButtonText: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '500',
    },
    createMealButton: {
        backgroundColor: '#4ADE80',
        borderColor: '#4ADE80',
    },
    createMealButtonText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '600',
    },
    // Toast
    savedToast: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26,26,46,0.95)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
    },
    savedToastText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },

    // Saved confirmation (shown after saving)
    savedConfirmation: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 16,
        marginTop: 4,
        marginBottom: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    savedConfirmationText: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '500',
    },
});
