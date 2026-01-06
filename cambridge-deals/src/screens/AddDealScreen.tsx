// Add Deal Screen - Screenshot capture and Gemini analysis

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CategoryChip } from '../components/CategoryChip';
import { Deal, CambridgeArea } from '../types';
import { addDeal } from '../services/storage';
import { analyzeScreenshot, imageToBase64 } from '../services/gemini';
import { CATEGORIES, CATEGORY_LABELS, CAMBRIDGE_AREAS, AREA_LABELS, CategoryType } from '../constants/categories';

type RootStackParamList = {
    Home: undefined;
    AddDeal: undefined;
    Settings: undefined;
    DealDetail: { deal: Deal };
};

interface AddDealScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AddDeal'>;
}

export function AddDealScreen({ navigation }: AddDealScreenProps) {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [originalPrice, setOriginalPrice] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES.OTHER);
    const [selectedArea, setSelectedArea] = useState<CambridgeArea>(CAMBRIDGE_AREAS.GENERAL as CambridgeArea);
    const [source, setSource] = useState<'kijiji' | 'facebook' | 'manual'>('manual');

    const pickImage = async (useCamera: boolean) => {
        let result;

        if (useCamera) {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', 'Camera permission is required to take photos');
                return;
            }
            result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
        } else {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
        }

        if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            setImageUri(uri);
            await analyzeImage(uri);
        }
    };

    const analyzeImage = async (uri: string) => {
        setAnalyzing(true);
        try {
            const base64 = await imageToBase64(uri);
            const result = await analyzeScreenshot(base64);

            if (result.success && result.deal) {
                setTitle(result.deal.title);
                setDescription(result.deal.description);
                if (result.deal.price) setPrice(result.deal.price.toString());
                if (result.deal.originalPrice) setOriginalPrice(result.deal.originalPrice.toString());
                if (result.deal.category) setSelectedCategory(result.deal.category);
            } else if (result.error) {
                Alert.alert('Analysis Note', result.error);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            Alert.alert('Error', 'Failed to analyze the image. You can still enter details manually.');
        } finally {
            setAnalyzing(false);
        }
    };

    const resetForm = () => {
        setImageUri(null);
        setTitle('');
        setDescription('');
        setPrice('');
        setOriginalPrice('');
        setSelectedCategory(CATEGORIES.OTHER);
        setSelectedArea(CAMBRIDGE_AREAS.GENERAL as CambridgeArea);
        setSource('manual');
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Missing Title', 'Please enter a title for the deal');
            return;
        }

        const deal: Deal = {
            id: Date.now().toString(),
            title: title.trim(),
            description: description.trim(),
            price: price ? parseFloat(price) : undefined,
            originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
            source,
            category: selectedCategory,
            location: selectedArea,
            imageUri: imageUri || undefined,
            createdAt: new Date(),
            isActive: true,
        };

        await addDeal(deal);
        resetForm();
        Alert.alert('Success', 'Deal saved! View it in the Search tab.');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>Add Deal</Text>
                <TouchableOpacity onPress={handleSave} style={styles.saveButtonWrapper}>
                    <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
            </View>

            {/* Image Selection */}
            <View style={styles.imageSection}>
                {imageUri ? (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: imageUri }} style={styles.image} />
                        {analyzing && (
                            <View style={styles.analyzingOverlay}>
                                <ActivityIndicator size="large" color="#FF6B35" />
                                <Text style={styles.analyzingText}>Analyzing with Gemini...</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Text style={styles.placeholderIcon}>📸</Text>
                        <Text style={styles.placeholderText}>Add a screenshot</Text>
                    </View>
                )}

                <View style={styles.imageButtons}>
                    <TouchableOpacity
                        style={styles.imageButton}
                        onPress={() => pickImage(true)}
                    >
                        <Text style={styles.imageButtonText}>📷 Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.imageButton}
                        onPress={() => pickImage(false)}
                    >
                        <Text style={styles.imageButtonText}>🖼️ Gallery</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Source Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Source</Text>
                <View style={styles.sourceButtons}>
                    {(['kijiji', 'facebook', 'manual'] as const).map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.sourceButton, source === s && styles.sourceButtonActive]}
                            onPress={() => setSource(s)}
                        >
                            <Text style={[styles.sourceButtonText, source === s && styles.sourceButtonTextActive]}>
                                {s === 'kijiji' ? '🟠 Kijiji' : s === 'facebook' ? '🔵 Facebook' : '📝 Manual'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Form Fields */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Title"
                    placeholderTextColor="#6B6B7B"
                    value={title}
                    onChangeText={setTitle}
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description"
                    placeholderTextColor="#6B6B7B"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                />

                <View style={styles.priceRow}>
                    <TextInput
                        style={[styles.input, styles.priceInput]}
                        placeholder="Price"
                        placeholderTextColor="#6B6B7B"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                    />
                    <TextInput
                        style={[styles.input, styles.priceInput]}
                        placeholder="Original Price"
                        placeholderTextColor="#6B6B7B"
                        value={originalPrice}
                        onChangeText={setOriginalPrice}
                        keyboardType="decimal-pad"
                    />
                </View>
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category</Text>
                <View style={styles.chipContainer}>
                    {Object.entries(CATEGORIES).map(([_, value]) => (
                        <CategoryChip
                            key={value}
                            label={CATEGORY_LABELS[value as CategoryType]}
                            selected={selectedCategory === value}
                            onPress={() => setSelectedCategory(value)}
                        />
                    ))}
                </View>
            </View>

            {/* Area Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Area</Text>
                <View style={styles.chipContainer}>
                    {Object.entries(CAMBRIDGE_AREAS).map(([_, value]) => (
                        <CategoryChip
                            key={value}
                            label={AREA_LABELS[value]}
                            selected={selectedArea === value}
                            onPress={() => setSelectedArea(value as CambridgeArea)}
                        />
                    ))}
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    saveButtonWrapper: {
        backgroundColor: '#FF6B35',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    saveButton: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    imageSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    imageContainer: {
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 16,
    },
    analyzingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    analyzingText: {
        color: '#FFFFFF',
        marginTop: 12,
        fontSize: 14,
    },
    imagePlaceholder: {
        height: 160,
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#2D2D3D',
        borderStyle: 'dashed',
    },
    placeholderIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    placeholderText: {
        color: '#6B6B7B',
        fontSize: 16,
    },
    imageButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    imageButton: {
        flex: 1,
        backgroundColor: '#1E1E2E',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    imageButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#8B8B9B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    sourceButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceButton: {
        flex: 1,
        backgroundColor: '#1E1E2E',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2D2D3D',
    },
    sourceButtonActive: {
        backgroundColor: '#FF6B35',
        borderColor: '#FF6B35',
    },
    sourceButtonText: {
        color: '#A0A0B0',
        fontSize: 13,
        fontWeight: '500',
    },
    sourceButtonTextActive: {
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#1E1E2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2D2D3D',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    priceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInput: {
        flex: 1,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
});
