import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { parseFoodInput, analyzeFoodPhoto, ParsedMeal, ParsedFoodItem } from '../../services/gemini';
import { saveFoodLog, saveFoodItems, supabase, getFoodLogs, FoodLogEntry } from '../../services/supabase';
import { lookupBarcode } from '../../services/openFoodFacts';
import { GEMINI_MODELS, GeminiModel } from '../../config/keys';
import { usePaymentGate } from '../../components/PaymentGate';
import { trackUsage } from '../../services/suiteAuth';

type InputMode = 'text' | 'camera';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Cycling loading messages for better UX
const LOADING_MESSAGES = [
    'Analyzing your meal...',
    'Calculating macros...',
    'Identifying ingredients...',
    'Almost there...',
];

export default function LogScreen() {
    // UI State
    const [mode, setMode] = useState<InputMode>('text');
    const [mealType, setMealType] = useState<MealType>('snack');
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [parsedMeal, setParsedMeal] = useState<ParsedMeal | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [useProModel, setUseProModel] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    // Recent meals for quick re-log
    const [recentMeals, setRecentMeals] = useState<FoodLogEntry[]>([]);

    // Voice input state
    const [isListening, setIsListening] = useState(false);

    // Camera
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

    // User
    const [userId, setUserId] = useState<string | null>(null);

    // Payment gate for premium AI features
    const { requestPayment, PaymentGateModal } = usePaymentGate();

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id);
        });
    }, []);

    // Cycle through loading messages while processing
    useEffect(() => {
        if (!isProcessing) {
            setLoadingMessageIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [isProcessing]);

    // Reset form and load recent meals when screen focuses (e.g., tapping + tab again)
    useFocusEffect(
        useCallback(() => {
            // Reset to fresh state when tab is focused
            resetForm();
            if (userId) {
                loadRecentMeals(userId);
            }
        }, [userId])
    );

    const loadRecentMeals = async (uid: string) => {
        const { data } = await getFoodLogs(uid);
        if (data) {
            // Get unique meals by raw_input (dedupe similar meals)
            const seen = new Set<string>();
            const unique = data.filter(meal => {
                const key = meal.raw_input?.toLowerCase().trim() || '';
                if (key && !seen.has(key)) {
                    seen.add(key);
                    return true;
                }
                return false;
            });
            setRecentMeals(unique.slice(0, 5));
        }
    };

    // Voice input handler - requires dev build for native speech recognition
    // For now, show a message that this feature requires dev build
    const handleVoiceInput = async () => {
        Alert.alert(
            'Voice Input',
            'Voice input requires a development build. For now, please type your food description.',
            [{ text: 'OK' }]
        );
    };

    // ============================================
    // HANDLERS
    // ============================================

    const handleParseText = async () => {
        if (!textInput.trim()) {
            Alert.alert('Enter food', 'Please describe what you ate');
            return;
        }

        // Pro model requires payment
        if (useProModel) {
            const paymentResult = await requestPayment({
                featureName: 'AI Pro Analysis',
                creditCost: 10,
                appId: 'foodvitals'
            });
            if (!paymentResult) return; // Payment cancelled
        }

        setIsProcessing(true);
        try {
            const model: GeminiModel = useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH;
            const result = await parseFoodInput(textInput.trim(), model);

            // Track usage
            trackUsage('foodvitals', useProModel ? 'ai_pro_text' : 'ai_flash_text');

            if (result) {
                setParsedMeal(result);
                setShowResults(true);
            } else {
                Alert.alert('Error', 'Could not parse food input. Try being more specific.');
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTakePhoto = async () => {
        if (cameraRef.current) {
            // Capture at lower quality to save tokens
            const photo = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.4, // Lower quality = less tokens
            });
            if (photo?.base64) {
                setCapturedPhoto(photo.base64);
                setIsProcessing(true);

                try {
                    const model: GeminiModel = useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH;
                    const result = await analyzeFoodPhoto(photo.base64, textInput || undefined, model);

                    if (result) {
                        setParsedMeal(result);
                        setShowResults(true);
                    } else {
                        Alert.alert('Analysis Failed', 'Could not analyze photo. Try taking a clearer picture or use text input.');
                    }
                } catch (error) {
                    Alert.alert('Error', 'Something went wrong. Please try again.');
                } finally {
                    setIsProcessing(false);
                }
            }
        }
    };

    // Handle barcode detection from camera
    const handleBarcodeScanned = async (data: string) => {
        // Prevent duplicate scans of the same barcode
        if (data === lastScannedBarcode || isProcessing) return;

        setLastScannedBarcode(data);
        setIsProcessing(true);

        try {
            const result = await lookupBarcode(data);

            if (result.found) {
                const barcodeMeal: ParsedMeal = {
                    items: [{
                        name: result.brand ? `${result.brand} ${result.name}` : result.name || 'Product',
                        quantity: 1,
                        unit: result.servingSize || 'serving',
                        calories: result.calories || 0,
                        protein_g: result.protein_g || 0,
                        carbs_g: result.carbs_g || 0,
                        fat_g: result.fat_g || 0,
                        fiber_g: result.fiber_g || 0,
                    }],
                    totals: {
                        calories: result.calories || 0,
                        protein_g: result.protein_g || 0,
                        carbs_g: result.carbs_g || 0,
                        fat_g: result.fat_g || 0,
                        fiber_g: result.fiber_g || 0,
                    },
                    confidence: 0.95,
                    notes: `Scanned: ${data}`,
                };
                setParsedMeal(barcodeMeal);
                setTextInput(result.brand ? `${result.brand} ${result.name}` : result.name || 'Product');
                setShowResults(true);
            } else {
                Alert.alert(
                    'Product Not Found',
                    'This barcode isn\'t in our database. Try taking a photo of the food or nutrition label instead.',
                    [{ text: 'OK', onPress: () => setLastScannedBarcode(null) }]
                );
            }
        } catch (error) {
            Alert.alert('Lookup Error', 'Could not look up product. Please try again.');
            setLastScannedBarcode(null);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!parsedMeal) {
            Alert.alert('Error', 'No meal data to save.');
            return;
        }

        // Check if user is logged in
        if (!userId) {
            Alert.alert(
                'Guest Mode',
                'Meals cannot be saved in guest mode. Would you like to sign in to save your food log?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Sign In',
                        onPress: () => router.replace('/login')
                    }
                ]
            );
            return;
        }

        setIsProcessing(true);

        try {
            console.log('Saving food log for user:', userId);

            // Generate smart meal description from AI
            const mealDescription = parsedMeal.notes ||
                parsedMeal.items.map(i => i.name).slice(0, 3).join(', ') ||
                'Logged meal';

            // Save the food log with macros AND micronutrients
            const { data: logData, error: logError } = await saveFoodLog(userId, {
                meal_type: mealType,
                raw_input: textInput || mealDescription,
                total_calories: parsedMeal.totals.calories,
                total_protein_g: parsedMeal.totals.protein_g,
                total_carbs_g: parsedMeal.totals.carbs_g,
                total_fat_g: parsedMeal.totals.fat_g,
                total_fiber_g: parsedMeal.totals.fiber_g || 0,
                // Micronutrients
                total_vitamin_c_mg: parsedMeal.totals.vitamin_c_mg || 0,
                total_vitamin_d_mcg: parsedMeal.totals.vitamin_d_mcg || 0,
                total_calcium_mg: parsedMeal.totals.calcium_mg || 0,
                total_iron_mg: parsedMeal.totals.iron_mg || 0,
                total_potassium_mg: parsedMeal.totals.potassium_mg || 0,
                total_sodium_mg: parsedMeal.totals.sodium_mg || 0,
                ai_confidence: parsedMeal.confidence,
                gemini_model: useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH,
            });

            console.log('Save result:', { logData, logError });

            if (logError) {
                console.error('Database error:', logError);
                throw logError;
            }

            // Save individual food items
            if (logData?.id && parsedMeal.items.length > 0) {
                const items = parsedMeal.items.map((item: ParsedFoodItem) => ({
                    food_log_id: logData.id,
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    calories: item.calories,
                    protein_g: item.protein_g,
                    carbs_g: item.carbs_g,
                    fat_g: item.fat_g,
                    fiber_g: item.fiber_g || 0,
                }));

                const { error: itemsError } = await saveFoodItems(items);
                if (itemsError) {
                    console.error('Items save error:', itemsError);
                }
            }

            // Show success toast and navigate to home
            setShowSuccessToast(true);
            setTimeout(() => {
                setShowSuccessToast(false);
                router.replace('/(tabs)/' as any);
            }, 1500);
        } catch (error: any) {
            console.error('Save error:', error);
            const errorMessage = error?.message || 'Could not save. Please try again.';
            Alert.alert('Save Error', errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const resetForm = () => {
        setTextInput('');
        setParsedMeal(null);
        setShowResults(false);
        setCapturedPhoto(null);
        setIsSaved(false);
        setEditingItemIndex(null);
    };

    // Quick re-log a recent meal
    const handleQuickReLog = (meal: FoodLogEntry) => {
        // Convert FoodLogEntry to ParsedMeal format
        const quickMeal: ParsedMeal = {
            items: [{
                name: meal.raw_input || 'Meal',
                quantity: 1,
                unit: 'serving',
                calories: meal.total_calories || 0,
                protein_g: meal.total_protein_g || 0,
                carbs_g: meal.total_carbs_g || 0,
                fat_g: meal.total_fat_g || 0,
                fiber_g: meal.total_fiber_g || 0,
            }],
            totals: {
                calories: meal.total_calories || 0,
                protein_g: meal.total_protein_g || 0,
                carbs_g: meal.total_carbs_g || 0,
                fat_g: meal.total_fat_g || 0,
                fiber_g: meal.total_fiber_g || 0,
            },
            confidence: 1.0,
            notes: meal.raw_input,
        };
        setTextInput(meal.raw_input || '');
        setParsedMeal(quickMeal);
        setMealType((meal.meal_type as MealType) || 'snack');
        setShowResults(true);
    };

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderMealTypeSelector = () => (
        <View style={styles.mealTypeContainer}>
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
                <TouchableOpacity
                    key={type}
                    style={[styles.mealTypeButton, mealType === type && styles.mealTypeActive]}
                    onPress={() => setMealType(type)}
                >
                    <Text style={[styles.mealTypeText, mealType === type && styles.mealTypeTextActive]}>
                        {type === 'breakfast' ? '🌅' : type === 'lunch' ? '☀️' : type === 'dinner' ? '🌙' : '🍎'}
                    </Text>
                    <Text style={[styles.mealTypeLabel, mealType === type && styles.mealTypeLabelActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderTextInput = () => (
        <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>What did you eat?</Text>
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.textInputWithMic}
                    placeholder="e.g., 3 eggs, 1 slice sourdough..."
                    placeholderTextColor="#666"
                    value={textInput}
                    onChangeText={setTextInput}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[styles.micButton, isListening && styles.micButtonActive]}
                    onPress={handleVoiceInput}
                >
                    <Ionicons
                        name={isListening ? "mic" : "mic-outline"}
                        size={24}
                        color={isListening ? "#fff" : "#4ADE80"}
                    />
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.analyzeButton, !textInput.trim() && styles.buttonDisabled]}
                onPress={handleParseText}
                disabled={!textInput.trim() || isProcessing}
            >
                {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Ionicons name="sparkles" size={20} color="#fff" />
                        <Text style={styles.analyzeButtonText}>Analyze with AI</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderCamera = () => {
        if (!permission?.granted) {
            return (
                <View style={styles.cameraPermission}>
                    <Ionicons name="camera-outline" size={48} color="#666" />
                    <Text style={styles.permissionText}>Camera access needed</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Enable Camera</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.cameraContainer}>
                {/* Help text */}
                <Text style={styles.cameraHelperText}>
                    📸 Take a photo of food OR scan a barcode
                </Text>

                <View style={styles.cameraWrapper}>
                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                        }}
                        onBarcodeScanned={(result) => {
                            if (result.data) {
                                handleBarcodeScanned(result.data);
                            }
                        }}
                    />
                    <View style={styles.cameraOverlay}>
                        {isProcessing ? (
                            <View style={styles.processingOverlay}>
                                <ActivityIndicator color="#4ADE80" size="large" />
                                <Text style={styles.processingText}>{LOADING_MESSAGES[loadingMessageIndex]}</Text>
                                <Text style={styles.processingHint}>This may take a few seconds</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.cameraFrame} />
                                <TouchableOpacity
                                    style={styles.captureButton}
                                    onPress={handleTakePhoto}
                                    disabled={isProcessing}
                                >
                                    <View style={styles.captureButtonInner} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {!isProcessing && (
                    <TextInput
                        style={styles.cameraHint}
                        placeholder="Optional: Add context (e.g., 'large portion')"
                        placeholderTextColor="#888"
                        value={textInput}
                        onChangeText={setTextInput}
                        maxLength={100}
                    />
                )}
            </View>
        );
    };

    const renderResults = () => {
        if (!parsedMeal) return null;

        // Helper to update a single item's quantity and recalculate
        const handleQuantityChange = (index: number, newQuantity: number) => {
            if (!parsedMeal || newQuantity <= 0) return;
            const item = parsedMeal.items[index];
            const ratio = newQuantity / item.quantity;

            const updatedItems = [...parsedMeal.items];
            updatedItems[index] = {
                ...item,
                quantity: newQuantity,
                calories: Math.round(item.calories * ratio),
                protein_g: Math.round(item.protein_g * ratio * 10) / 10,
                carbs_g: Math.round(item.carbs_g * ratio * 10) / 10,
                fat_g: Math.round(item.fat_g * ratio * 10) / 10,
                fiber_g: item.fiber_g ? Math.round(item.fiber_g * ratio * 10) / 10 : 0,
            };

            // Recalculate totals
            const newTotals = updatedItems.reduce((acc, i) => ({
                calories: acc.calories + i.calories,
                protein_g: acc.protein_g + i.protein_g,
                carbs_g: acc.carbs_g + i.carbs_g,
                fat_g: acc.fat_g + i.fat_g,
                fiber_g: (acc.fiber_g || 0) + (i.fiber_g || 0),
            }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });

            setParsedMeal({
                ...parsedMeal,
                items: updatedItems,
                totals: { ...parsedMeal.totals, ...newTotals },
            });
        };

        return (
            <View style={styles.resultsContainer}>
                {/* Photo Preview */}
                {capturedPhoto && (
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${capturedPhoto}` }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                    />
                )}

                <View style={styles.resultsHeader}>
                    <Text style={styles.resultsTitle}>
                        {isSaved ? '✓ Meal Saved!' : 'Analysis Results'}
                    </Text>
                    <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                            {Math.round(parsedMeal.confidence * 100)}% confident
                        </Text>
                    </View>
                </View>

                {/* Totals Card */}
                <LinearGradient
                    colors={isSaved ? ['#1a3a2a', '#2d4a3d'] : ['#1a472a', '#2d5a3d']}
                    style={styles.totalsCard}
                >
                    <Text style={styles.totalsTitle}>
                        {Math.round(parsedMeal.totals.calories)} cal
                    </Text>
                    <View style={styles.macrosRow}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(parsedMeal.totals.protein_g)}g</Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(parsedMeal.totals.carbs_g)}g</Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(parsedMeal.totals.fat_g)}g</Text>
                            <Text style={styles.macroLabel}>Fat</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Individual Items - Tappable for editing */}
                <Text style={styles.itemsTitle}>Items Detected {!isSaved && '(tap to edit)'}</Text>
                {parsedMeal.items.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.itemCard,
                            editingItemIndex === index && styles.itemCardEditing
                        ]}
                        onPress={() => !isSaved && setEditingItemIndex(editingItemIndex === index ? null : index)}
                        disabled={isSaved}
                    >
                        <View style={styles.itemHeader}>
                            <Text style={styles.itemName}>{item.quantity} {item.unit} {item.name}</Text>
                            <View style={styles.itemRight}>
                                <Text style={styles.itemCalories}>{item.calories} cal</Text>
                                {!isSaved && (
                                    <Ionicons
                                        name={editingItemIndex === index ? "chevron-up" : "pencil"}
                                        size={16}
                                        color="#4ADE80"
                                        style={{ marginLeft: 8 }}
                                    />
                                )}
                            </View>
                        </View>
                        <Text style={styles.itemMacros}>
                            P: {Math.round(item.protein_g)}g • C: {Math.round(item.carbs_g)}g • F: {Math.round(item.fat_g)}g
                        </Text>

                        {/* Inline Edit UI */}
                        {editingItemIndex === index && !isSaved && (
                            <View style={styles.editRow}>
                                <Text style={styles.editLabel}>Quantity:</Text>
                                <View style={styles.quantityControls}>
                                    <TouchableOpacity
                                        style={styles.quantityBtn}
                                        onPress={() => handleQuantityChange(index, Math.max(0.5, item.quantity - 0.5))}
                                    >
                                        <Text style={styles.quantityBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                                    <TouchableOpacity
                                        style={styles.quantityBtn}
                                        onPress={() => handleQuantityChange(index, item.quantity + 0.5)}
                                    >
                                        <Text style={styles.quantityBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}

                {parsedMeal.notes && (
                    <Text style={styles.notes}>💡 {parsedMeal.notes}</Text>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    {isSaved ? (
                        <TouchableOpacity style={styles.logAnotherButton} onPress={resetForm}>
                            <Ionicons name="add-circle-outline" size={20} color="#4ADE80" />
                            <Text style={styles.logAnotherButtonText}>Log Another</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.editButton} onPress={resetForm}>
                                <Text style={styles.editButtonText}>Retake</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSave}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save Meal</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Log Food</Text>

                        {/* Model Toggle */}
                        <TouchableOpacity
                            style={[styles.modelToggle, useProModel && styles.modelToggleActive]}
                            onPress={() => setUseProModel(!useProModel)}
                        >
                            <Ionicons
                                name={useProModel ? "flash" : "flash-outline"}
                                size={16}
                                color={useProModel ? "#FFD700" : "#888"}
                            />
                            <Text style={[styles.modelToggleText, useProModel && styles.modelToggleTextActive]}>
                                {useProModel ? 'Pro' : 'Flash'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {!showResults ? (
                        <>
                            {/* Recent Meals Quick Re-log */}
                            {recentMeals.length > 0 && (
                                <View style={styles.recentSection}>
                                    <Text style={styles.recentTitle}>🕒 Recent</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.recentScroll}
                                    >
                                        {recentMeals.map((meal, index) => (
                                            <TouchableOpacity
                                                key={meal.id || index}
                                                style={styles.recentCard}
                                                onPress={() => handleQuickReLog(meal)}
                                            >
                                                <Text style={styles.recentMealName} numberOfLines={2}>
                                                    {meal.raw_input || 'Meal'}
                                                </Text>
                                                <Text style={styles.recentMealCals}>
                                                    {meal.total_calories} cal
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Mode Toggle */}
                            <View style={styles.modeToggle}>
                                <TouchableOpacity
                                    style={[styles.modeButton, mode === 'text' && styles.modeButtonActive]}
                                    onPress={() => setMode('text')}
                                >
                                    <Ionicons name="create-outline" size={20} color={mode === 'text' ? '#fff' : '#888'} />
                                    <Text style={[styles.modeButtonText, mode === 'text' && styles.modeButtonTextActive]}>
                                        Type
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modeButton, mode === 'camera' && styles.modeButtonActive]}
                                    onPress={() => setMode('camera')}
                                >
                                    <Ionicons name="camera-outline" size={20} color={mode === 'camera' ? '#fff' : '#888'} />
                                    <Text style={[styles.modeButtonText, mode === 'camera' && styles.modeButtonTextActive]}>
                                        Photo
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Input Area */}
                            {mode === 'text' ? renderTextInput() : renderCamera()}
                        </>
                    ) : (
                        renderResults()
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Success Toast */}
            {showSuccessToast && (
                <View style={styles.successToast}>
                    <View style={styles.successToastContent}>
                        <Text style={styles.successToastIcon}>✓</Text>
                        <Text style={styles.successToastText}>Meal Saved!</Text>
                    </View>
                </View>
            )}

            {/* Payment Gate Modal */}
            <PaymentGateModal />
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================

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
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    modelToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    modelToggleActive: {
        backgroundColor: 'rgba(255,215,0,0.2)',
    },
    modelToggleText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    modelToggleTextActive: {
        color: '#FFD700',
    },

    // Meal Type
    mealTypeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    mealTypeButton: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        marginHorizontal: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    mealTypeActive: {
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderColor: '#4ADE80',
    },
    mealTypeText: {
        fontSize: 20,
    },
    mealTypeLabel: {
        color: '#888',
        fontSize: 11,
        marginTop: 4,
    },
    mealTypeLabelActive: {
        color: '#4ADE80',
    },
    mealTypeTextActive: {},

    // Mode Toggle
    modeToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    modeButtonActive: {
        backgroundColor: 'rgba(74,222,128,0.2)',
    },
    modeButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    modeButtonTextActive: {
        color: '#fff',
    },

    // Text Input
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    textInputWithMic: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    micButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(74,222,128,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.3)',
        alignSelf: 'flex-start',
    },
    micButtonActive: {
        backgroundColor: '#4ADE80',
        borderColor: '#4ADE80',
    },
    analyzeButton: {
        flexDirection: 'row',
        backgroundColor: '#4ADE80',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    analyzeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },

    // Camera
    cameraContainer: {
        alignItems: 'center',
    },
    cameraHelperText: {
        color: '#aaa',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 12,
    },
    cameraWrapper: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    camera: {
        width: '100%',
        height: '100%',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
    },
    cameraFrame: {
        width: '85%',
        height: '65%',
        borderWidth: 2,
        borderColor: 'rgba(74,222,128,0.5)',
        borderRadius: 12,
    },
    processingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        width: '100%',
    },
    processingText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    processingHint: {
        color: '#888',
        fontSize: 13,
        marginTop: 8,
    },
    captureButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 4,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4ADE80',
    },
    cameraHint: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
    },
    cameraPermission: {
        alignItems: 'center',
        padding: 40,
    },
    permissionText: {
        color: '#888',
        fontSize: 16,
        marginTop: 12,
    },
    permissionButton: {
        backgroundColor: '#4ADE80',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    permissionButtonText: {
        color: '#fff',
        fontWeight: '600',
    },

    // Results
    photoPreview: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        marginBottom: 16,
    },
    resultsContainer: {
        marginTop: 10,
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    resultsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    confidenceBadge: {
        backgroundColor: 'rgba(74,222,128,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    confidenceText: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '600',
    },
    totalsCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    totalsTitle: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    macroLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    itemsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    itemCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    itemCalories: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '600',
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemMacros: {
        color: '#888',
        fontSize: 12,
        marginTop: 6,
    },
    notes: {
        color: '#888',
        fontSize: 13,
        fontStyle: 'italic',
        marginTop: 12,
        marginBottom: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    editButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4ADE80',
        alignItems: 'center',
    },
    editButtonText: {
        color: '#4ADE80',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        flex: 2,
        backgroundColor: '#4ADE80',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },

    // Success Toast
    successToast: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    successToastContent: {
        backgroundColor: '#1a472a',
        paddingHorizontal: 40,
        paddingVertical: 30,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4ADE80',
    },
    successToastIcon: {
        fontSize: 48,
        color: '#4ADE80',
        marginBottom: 12,
    },
    successToastText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },

    // Recent Meals Quick Re-log
    recentSection: {
        marginBottom: 20,
    },
    recentTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    recentScroll: {
        gap: 12,
    },
    recentCard: {
        backgroundColor: 'rgba(74,222,128,0.1)',
        borderRadius: 12,
        padding: 12,
        width: 120,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    recentMealName: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 4,
    },
    recentMealCals: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '600',
    },

    // Inline Item Editing
    itemCardEditing: {
        borderColor: '#4ADE80',
        backgroundColor: 'rgba(74,222,128,0.1)',
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    editLabel: {
        color: '#888',
        fontSize: 14,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    quantityBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(74,222,128,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityBtnText: {
        color: '#4ADE80',
        fontSize: 20,
        fontWeight: '600',
    },
    quantityValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        minWidth: 40,
        textAlign: 'center',
    },

    // Log Another Button
    logAnotherButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4ADE80',
        backgroundColor: 'rgba(74,222,128,0.1)',
    },
    logAnotherButtonText: {
        color: '#4ADE80',
        fontSize: 16,
        fontWeight: '600',
    },
});
