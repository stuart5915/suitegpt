// Search Results Screen - Shows AI-extracted product listings

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    FlatList,
    Linking,
    RefreshControl,
    Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchLiveMarketplace, LiveListing } from '../services/gemini';
import { saveSearch } from '../services/storage';
import { Alert } from 'react-native';

type RootStackParamList = {
    Home: undefined;
    SearchResults: { query: string; maxPrice?: number };
    AddDeal: undefined;
    Settings: undefined;
    DealDetail: { deal: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'SearchResults'>;

export function SearchResultsScreen({ route, navigation }: Props) {
    const { query, maxPrice } = route.params;
    const [listings, setListings] = useState<LiveListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saved, setSaved] = useState(false);

    const fetchListings = async () => {
        setLoading(true);
        console.log('Fetching live listings for:', query);
        const results = await searchLiveMarketplace(query, maxPrice);
        console.log('Got', results.length, 'listings');
        setListings(results);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchListings();
        setRefreshing(false);
    };

    useEffect(() => {
        fetchListings();
    }, [query, maxPrice]);

    const openMarketplace = (source: 'kijiji' | 'facebook') => {
        const encodedQuery = encodeURIComponent(query);
        const url = source === 'kijiji'
            ? `https://www.kijiji.ca/b-cambridge-on/${encodedQuery}/k0l1700209`
            : `https://www.facebook.com/marketplace/cambridge/search?query=${encodedQuery}`;
        Linking.openURL(url);
    };

    const handleSaveSearch = async () => {
        await saveSearch(query, listings, maxPrice);
        setSaved(true);
        Alert.alert('✅ Saved!', 'This search has been saved. View it in your Saved Searches.');
    };

    const renderListing = ({ item, index }: { item: LiveListing; index: number }) => {
        // Debug: log if we have imageUrl
        if (index === 0) {
            console.log('First listing imageUrl:', item.imageUrl);
        }

        // Use placeholder if no image URL
        const imageSource = item.imageUrl
            ? { uri: item.imageUrl }
            : { uri: `https://placehold.co/300x200/1E1E2E/FF6B35/png?text=${encodeURIComponent(item.title.substring(0, 15))}` };

        return (
            <View style={styles.listingCard}>
                {/* Product Image */}
                <Image
                    source={imageSource}
                    style={styles.listingImage}
                    resizeMode="cover"
                    onError={() => console.log('Image failed to load:', item.imageUrl)}
                />

                {/* Source Badge */}
                <View style={styles.sourceRow}>
                    <View style={[styles.sourceBadge, item.source === 'kijiji' ? styles.kijijiBadge : styles.facebookBadge]}>
                        <Text style={styles.sourceBadgeText}>
                            {item.source === 'kijiji' ? '🟠 Kijiji' : item.source === 'facebook' ? '🔵 Facebook' : '⚪ Other'}
                        </Text>
                    </View>
                    <Text style={styles.locationText}>📍 {item.location}</Text>
                </View>

                {/* Title */}
                <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>

                {/* Description */}
                {item.description && (
                    <Text style={styles.listingDescription} numberOfLines={3}>{item.description}</Text>
                )}

                {/* Price */}
                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>
                        {item.price ? `$${item.price.toLocaleString()}` : 'Contact for price'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title} numberOfLines={1}>"{query}"</Text>
                    {maxPrice && <Text style={styles.priceFilter}>Max ${maxPrice}</Text>}
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B35" />
                    <Text style={styles.loadingText}>🔍 AI is searching marketplaces...</Text>
                    <Text style={styles.loadingSubtext}>Finding deals on Kijiji & Facebook</Text>
                </View>
            ) : listings.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                    <Text style={styles.emptyTitle}>No listings found</Text>
                    <Text style={styles.emptyText}>Try different search terms or browse directly:</Text>

                    <View style={styles.browseButtons}>
                        <TouchableOpacity
                            style={[styles.browseButton, styles.kijijiButton]}
                            onPress={() => openMarketplace('kijiji')}
                        >
                            <Text style={styles.browseButtonText}>🟠 Open Kijiji</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.browseButton, styles.facebookButton]}
                            onPress={() => openMarketplace('facebook')}
                        >
                            <Text style={styles.browseButtonText}>🔵 Open Facebook</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <>
                    {/* Results count & browse buttons */}
                    <View style={styles.resultsHeader}>
                        <Text style={styles.resultsCount}>
                            Found {listings.length} listings
                        </Text>
                        <View style={styles.browseRow}>
                            <TouchableOpacity
                                style={[styles.saveButton, saved && styles.savedButton]}
                                onPress={handleSaveSearch}
                                disabled={saved}
                            >
                                <Text style={styles.saveButtonText}>{saved ? '✓ Saved' : '💾 Save'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.smallBrowseButton}
                                onPress={() => openMarketplace('kijiji')}
                            >
                                <Text style={styles.smallBrowseText}>🟠 Kijiji</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.smallBrowseButton}
                                onPress={() => openMarketplace('facebook')}
                            >
                                <Text style={styles.smallBrowseText}>🔵 Facebook</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Listings */}
                    <FlatList
                        data={listings}
                        keyExtractor={(item, index) => `${item.title}-${index}`}
                        renderItem={renderListing}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor="#FF6B35"
                            />
                        }
                    />
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D3D',
    },
    backButton: {
        paddingRight: 12,
    },
    backText: {
        color: '#FF6B35',
        fontSize: 16,
        fontWeight: '600',
    },
    headerCenter: {
        flex: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    priceFilter: {
        color: '#4ADE80',
        fontSize: 13,
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
    },
    loadingSubtext: {
        color: '#8B8B9B',
        fontSize: 14,
        marginTop: 8,
    },
    emptyContainer: {
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
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyText: {
        color: '#8B8B9B',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    browseButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    browseButton: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
    },
    kijijiButton: {
        backgroundColor: '#FF6B35',
    },
    facebookButton: {
        backgroundColor: '#1877F2',
    },
    browseButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D3D',
    },
    resultsCount: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '600',
    },
    browseRow: {
        flexDirection: 'row',
        gap: 8,
    },
    smallBrowseButton: {
        backgroundColor: '#2D2D3D',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    saveButton: {
        backgroundColor: '#FF6B35',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    savedButton: {
        backgroundColor: '#4ADE80',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    smallBrowseText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    listContent: {
        padding: 16,
    },
    listingCard: {
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        overflow: 'hidden',
    },
    listingImage: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#2D2D3D',
    },
    sourceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sourceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    kijijiBadge: {
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
    },
    facebookBadge: {
        backgroundColor: 'rgba(24, 119, 242, 0.2)',
    },
    sourceBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    locationText: {
        fontSize: 12,
        color: '#8B8B9B',
    },
    listingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        lineHeight: 22,
    },
    listingDescription: {
        fontSize: 14,
        color: '#A0A0B0',
        marginBottom: 12,
        lineHeight: 20,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4ADE80',
    },
});
