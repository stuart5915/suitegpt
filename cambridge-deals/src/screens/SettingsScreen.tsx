// Settings Screen - Preferences and watch list management

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    TextInput,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CategoryChip } from '../components/CategoryChip';
import { UserPreferences, WatchListItem, CambridgeArea } from '../types';
import {
    getPreferences,
    savePreferences,
    addToWatchList,
    removeFromWatchList,
} from '../services/storage';
import {
    requestNotificationPermissions,
    scheduleDailyNotification,
    cancelAllScheduledNotifications,
} from '../services/notifications';
import { CAMBRIDGE_AREAS, AREA_LABELS, CATEGORIES, CATEGORY_LABELS, CategoryType } from '../constants/categories';

type RootStackParamList = {
    Home: undefined;
    AddDeal: undefined;
    Settings: undefined;
    DealDetail: { deal: any };
};

interface SettingsScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [newKeyword, setNewKeyword] = useState('');
    const [newKeywordCategory, setNewKeywordCategory] = useState<string | null>(null);
    const [newKeywordMaxPrice, setNewKeywordMaxPrice] = useState('');

    const loadPreferences = useCallback(async () => {
        const prefs = await getPreferences();
        setPreferences(prefs);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadPreferences();
        }, [loadPreferences])
    );

    const handleNotificationToggle = async (enabled: boolean) => {
        if (!preferences) return;

        if (enabled) {
            const granted = await requestNotificationPermissions();
            if (!granted) {
                Alert.alert('Permission Denied', 'Notifications could not be enabled');
                return;
            }
            const [hours, minutes] = preferences.notificationTime.split(':').map(Number);
            await scheduleDailyNotification(hours, minutes);
        } else {
            await cancelAllScheduledNotifications();
        }

        const updated = { ...preferences, notificationsEnabled: enabled };
        setPreferences(updated);
        await savePreferences(updated);
    };

    const handleTimeChange = async (time: string) => {
        if (!preferences) return;
        const updated = { ...preferences, notificationTime: time };
        setPreferences(updated);
        await savePreferences(updated);

        if (preferences.notificationsEnabled) {
            const [hours, minutes] = time.split(':').map(Number);
            await scheduleDailyNotification(hours, minutes);
        }
    };

    const handleAreaToggle = async (area: CambridgeArea) => {
        if (!preferences) return;
        const areas = preferences.preferredAreas.includes(area)
            ? preferences.preferredAreas.filter(a => a !== area)
            : [...preferences.preferredAreas, area];

        const updated = { ...preferences, preferredAreas: areas };
        setPreferences(updated);
        await savePreferences(updated);
    };

    const handleAddToWatchList = async () => {
        if (!newKeyword.trim()) {
            Alert.alert('Missing Keyword', 'Please enter a keyword to watch');
            return;
        }

        const item: WatchListItem = {
            id: Date.now().toString(),
            keyword: newKeyword.trim(),
            category: newKeywordCategory || undefined,
            maxPrice: newKeywordMaxPrice ? parseFloat(newKeywordMaxPrice) : undefined,
            areas: preferences?.preferredAreas || [],
            createdAt: new Date(),
            isActive: true,
        };

        await addToWatchList(item);
        await loadPreferences();
        setNewKeyword('');
        setNewKeywordCategory(null);
        setNewKeywordMaxPrice('');
    };

    const handleRemoveFromWatchList = async (itemId: string) => {
        await removeFromWatchList(itemId);
        await loadPreferences();
    };

    if (!preferences) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
            </View>

            {/* Notifications */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Daily Deal Alerts</Text>
                        <Text style={styles.settingDescription}>
                            Get notified about new deals each day
                        </Text>
                    </View>
                    <Switch
                        value={preferences.notificationsEnabled}
                        onValueChange={handleNotificationToggle}
                        trackColor={{ false: '#3D3D4D', true: '#FF6B35' }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {preferences.notificationsEnabled && (
                    <View style={styles.timeSelector}>
                        <Text style={styles.settingLabel}>Notification Time</Text>
                        <View style={styles.timeButtons}>
                            {['08:00', '09:00', '12:00', '18:00'].map(time => (
                                <TouchableOpacity
                                    key={time}
                                    style={[
                                        styles.timeButton,
                                        preferences.notificationTime === time && styles.timeButtonActive,
                                    ]}
                                    onPress={() => handleTimeChange(time)}
                                >
                                    <Text
                                        style={[
                                            styles.timeButtonText,
                                            preferences.notificationTime === time && styles.timeButtonTextActive,
                                        ]}
                                    >
                                        {time}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            {/* Preferred Areas */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferred Areas</Text>
                <Text style={styles.sectionDescription}>
                    Filter deals to these Cambridge areas
                </Text>
                <View style={styles.chipContainer}>
                    {Object.values(CAMBRIDGE_AREAS).map(area => (
                        <CategoryChip
                            key={area}
                            label={AREA_LABELS[area]}
                            selected={preferences.preferredAreas.includes(area as CambridgeArea)}
                            onPress={() => handleAreaToggle(area as CambridgeArea)}
                        />
                    ))}
                </View>
            </View>

            {/* Watch List */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Watch List</Text>
                <Text style={styles.sectionDescription}>
                    Get notified when deals match these keywords
                </Text>

                {/* Add new keyword */}
                <View style={styles.addKeywordForm}>
                    <TextInput
                        style={styles.keywordInput}
                        placeholder="e.g., golf clubs, furniture"
                        placeholderTextColor="#6B6B7B"
                        value={newKeyword}
                        onChangeText={setNewKeyword}
                    />
                    <TextInput
                        style={[styles.keywordInput, styles.priceInput]}
                        placeholder="Max $"
                        placeholderTextColor="#6B6B7B"
                        value={newKeywordMaxPrice}
                        onChangeText={setNewKeywordMaxPrice}
                        keyboardType="decimal-pad"
                    />
                    <TouchableOpacity style={styles.addButton} onPress={handleAddToWatchList}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.chipContainer}>
                    {Object.entries(CATEGORIES).slice(0, 5).map(([_, value]) => (
                        <CategoryChip
                            key={value}
                            label={CATEGORY_LABELS[value as CategoryType]}
                            selected={newKeywordCategory === value}
                            onPress={() => setNewKeywordCategory(
                                newKeywordCategory === value ? null : value
                            )}
                        />
                    ))}
                </View>

                {/* Watch list items */}
                <View style={styles.watchList}>
                    {preferences.watchList.length === 0 ? (
                        <Text style={styles.emptyText}>No keywords added yet</Text>
                    ) : (
                        preferences.watchList.map(item => (
                            <View key={item.id} style={styles.watchListItem}>
                                <View style={styles.watchListInfo}>
                                    <Text style={styles.watchListKeyword}>{item.keyword}</Text>
                                    <Text style={styles.watchListMeta}>
                                        {item.category && `${CATEGORY_LABELS[item.category as CategoryType]} · `}
                                        {item.maxPrice && `Max $${item.maxPrice}`}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => handleRemoveFromWatchList(item.id)}
                                >
                                    <Text style={styles.removeButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </View>

            {/* API Key Info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Gemini API</Text>
                <View style={styles.apiInfo}>
                    <Text style={styles.apiInfoText}>
                        To enable screenshot analysis, set your API key in the environment:
                    </Text>
                    <Text style={styles.apiCode}>EXPO_PUBLIC_GEMINI_API_KEY=your_key</Text>
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
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingText: {
        color: '#A0A0B0',
        textAlign: 'center',
        marginTop: 100,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#8B8B9B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#6B6B7B',
        marginBottom: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E1E2E',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    settingLabel: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    settingDescription: {
        fontSize: 13,
        color: '#8B8B9B',
        marginTop: 4,
    },
    timeSelector: {
        backgroundColor: '#1E1E2E',
        padding: 16,
        borderRadius: 12,
    },
    timeButtons: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    timeButton: {
        flex: 1,
        backgroundColor: '#2D2D3D',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    timeButtonActive: {
        backgroundColor: '#FF6B35',
    },
    timeButtonText: {
        color: '#A0A0B0',
        fontSize: 14,
        fontWeight: '500',
    },
    timeButtonTextActive: {
        color: '#FFFFFF',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    addKeywordForm: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    keywordInput: {
        flex: 1,
        backgroundColor: '#1E1E2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#FFFFFF',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#2D2D3D',
    },
    priceInput: {
        flex: 0.4,
    },
    addButton: {
        backgroundColor: '#FF6B35',
        width: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '300',
    },
    watchList: {
        marginTop: 16,
    },
    emptyText: {
        color: '#6B6B7B',
        textAlign: 'center',
        paddingVertical: 20,
    },
    watchListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E1E2E',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    watchListInfo: {
        flex: 1,
    },
    watchListKeyword: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    watchListMeta: {
        fontSize: 13,
        color: '#8B8B9B',
        marginTop: 4,
    },
    removeButton: {
        width: 32,
        height: 32,
        backgroundColor: '#2D2D3D',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        color: '#A0A0B0',
        fontSize: 14,
    },
    apiInfo: {
        backgroundColor: '#1E1E2E',
        padding: 16,
        borderRadius: 12,
    },
    apiInfoText: {
        color: '#8B8B9B',
        fontSize: 14,
        lineHeight: 20,
    },
    apiCode: {
        color: '#4ADE80',
        fontFamily: 'monospace',
        fontSize: 12,
        marginTop: 8,
        backgroundColor: '#0F0F1A',
        padding: 10,
        borderRadius: 6,
    },
});
