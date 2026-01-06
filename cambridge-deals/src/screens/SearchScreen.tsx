// Search Screen - AI-powered search through saved deals

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DealCard } from '../components/DealCard';
import { CategoryChip } from '../components/CategoryChip';
import { Deal } from '../types';
import { getDeals } from '../services/storage';
import { CATEGORIES, CATEGORY_LABELS, CategoryType } from '../constants/categories';

export function SearchScreen({ navigation }: any) {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    const loadDeals = useCallback(async () => {
        const loadedDeals = await getDeals();
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
        let results = deals;

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(
                d =>
                    d.title.toLowerCase().includes(query) ||
                    d.description.toLowerCase().includes(query)
            );
        }

        // Filter by category
        if (selectedCategory) {
            results = results.filter(d => d.category === selectedCategory);
        }

        // Filter by source
        if (selectedSource) {
            results = results.filter(d => d.source === selectedSource);
        }

        setFilteredDeals(results);
    }, [deals, searchQuery, selectedCategory, selectedSource]);

    const handleDealPress = (deal: Deal) => {
        navigation.navigate('DealDetail', { deal });
    };

    const sources = [
        { key: null, label: 'All Sources' },
        { key: 'kijiji', label: '🟠 Kijiji' },
        { key: 'facebook', label: '🔵 Facebook' },
        { key: 'manual', label: '📝 Manual' },
    ];

    const categories = [
        { key: null, label: 'All Categories' },
        ...Object.values(CATEGORIES).slice(0, 5).map(value => ({
            key: value,
            label: CATEGORY_LABELS[value as CategoryType],
        })),
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Search Deals</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search deals... (e.g., golf clubs)"
                    placeholderTextColor="#6B6B7B"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={Keyboard.dismiss}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setSearchQuery('')}
                    >
                        <Text style={styles.clearButtonText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Source Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterContent}
            >
                {sources.map(s => (
                    <CategoryChip
                        key={s.key ?? 'all-source'}
                        label={s.label}
                        selected={selectedSource === s.key}
                        onPress={() => setSelectedSource(s.key)}
                    />
                ))}
            </ScrollView>

            {/* Category Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterContent}
            >
                {categories.map(cat => (
                    <CategoryChip
                        key={cat.key ?? 'all-cat'}
                        label={cat.label}
                        selected={selectedCategory === cat.key}
                        onPress={() => setSelectedCategory(cat.key)}
                    />
                ))}
            </ScrollView>

            {/* Results */}
            {filteredDeals.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                    <Text style={styles.emptyTitle}>
                        {searchQuery ? 'No matching deals' : 'No deals saved yet'}
                    </Text>
                    <Text style={styles.emptyDescription}>
                        {searchQuery
                            ? 'Try a different search term or adjust filters'
                            : 'Add deals by taking screenshots from Kijiji or Facebook Marketplace'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDeals}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <DealCard deal={item} onPress={handleDealPress} />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    searchContainer: {
        marginHorizontal: 20,
        marginBottom: 12,
        position: 'relative',
    },
    searchInput: {
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#2D2D3D',
    },
    clearButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#3D3D4D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        color: '#A0A0B0',
        fontSize: 12,
    },
    filterRow: {
        maxHeight: 55,
    },
    filterContent: {
        paddingHorizontal: 16,
        paddingVertical: 6,
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
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: 15,
        color: '#8B8B9B',
        textAlign: 'center',
        lineHeight: 22,
    },
});
