// Home Screen - Main deal feed

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DealCard } from '../components/DealCard';
import { CategoryChip } from '../components/CategoryChip';
import { Deal } from '../types';
import { getDeals, removeDeal } from '../services/storage';
import { CATEGORIES, CATEGORY_LABELS, CategoryType } from '../constants/categories';

type RootStackParamList = {
    Home: undefined;
    AddDeal: undefined;
    Settings: undefined;
    DealDetail: { deal: Deal };
};

interface HomeScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadDeals = useCallback(async () => {
        const loadedDeals = await getDeals();
        // Sort by creation date, newest first
        const sorted = loadedDeals.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setDeals(sorted);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDeals();
        }, [loadDeals])
    );

    useEffect(() => {
        if (selectedCategory) {
            setFilteredDeals(deals.filter(d => d.category === selectedCategory));
        } else {
            setFilteredDeals(deals);
        }
    }, [deals, selectedCategory]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadDeals();
        setRefreshing(false);
    }, [loadDeals]);

    const handleDeleteDeal = async (dealId: string) => {
        await removeDeal(dealId);
        await loadDeals();
    };

    const handleDealPress = (deal: Deal) => {
        navigation.navigate('DealDetail', { deal });
    };

    const categories = [
        { key: null, label: '🏷️ All' },
        ...Object.entries(CATEGORIES).map(([_, value]) => ({
            key: value,
            label: CATEGORY_LABELS[value as CategoryType],
        })),
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Cambridge</Text>
                    <Text style={styles.title}>Deal Tracker</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Text style={styles.settingsIcon}>⚙️</Text>
                </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
            >
                {categories.map(cat => (
                    <CategoryChip
                        key={cat.key ?? 'all'}
                        label={cat.label}
                        selected={selectedCategory === cat.key}
                        onPress={() => setSelectedCategory(cat.key)}
                    />
                ))}
            </ScrollView>

            {/* Deals List */}
            {filteredDeals.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyTitle}>No deals yet</Text>
                    <Text style={styles.emptyDescription}>
                        Tap the + button to add your first deal by taking a screenshot
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDeals}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <DealCard
                            deal={item}
                            onPress={handleDealPress}
                            onDelete={handleDeleteDeal}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#FF6B35"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddDeal')}
                activeOpacity={0.8}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 16,
    },
    greeting: {
        fontSize: 14,
        color: '#8B8B9B',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1E1E2E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsIcon: {
        fontSize: 20,
    },
    filterContainer: {
        maxHeight: 70,
    },
    filterContent: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    listContent: {
        paddingBottom: 100,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 15,
        color: '#8B8B9B',
        textAlign: 'center',
        lineHeight: 22,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF6B35',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 32,
        color: '#FFFFFF',
        fontWeight: '300',
        marginTop: -2,
    },
});
