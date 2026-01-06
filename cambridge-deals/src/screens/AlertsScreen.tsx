// Alerts Screen - Manage notification subscriptions with AI suggestions

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Switch,
    TextInput,
    Modal,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CategoryChip } from '../components/CategoryChip';
import { DealCard } from '../components/DealCard';
import { WatchListItem, CambridgeArea, Deal } from '../types';
import { getPreferences, savePreferences, addToWatchList, removeFromWatchList, getDeals } from '../services/storage';
import { getSearchSuggestions, searchDealsWithAI, searchLiveMarketplace, SearchSuggestion, LiveListing } from '../services/gemini';
import { CATEGORIES, CATEGORY_LABELS, CAMBRIDGE_AREAS, AREA_LABELS, CategoryType } from '../constants/categories';

export function AlertsScreen() {
    const navigation = useNavigation<any>();
    const [watchList, setWatchList] = useState<WatchListItem[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [newCategory, setNewCategory] = useState<string | null>(null);
    const [newMaxPrice, setNewMaxPrice] = useState('');
    const [selectedAreas, setSelectedAreas] = useState<CambridgeArea[]>([]);
    const [alertTime, setAlertTime] = useState('09:00');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // AI suggestions state
    const [suggestions, setSuggestions] = useState<SearchSuggestion | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const suggestionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Search results state
    const [showResults, setShowResults] = useState(false);
    const [searchResults, setSearchResults] = useState<Deal[]>([]);
    const [liveListings, setLiveListings] = useState<LiveListing[]>([]);
    const [searching, setSearching] = useState(false);

    const loadWatchList = useCallback(async () => {
        const prefs = await getPreferences();
        setWatchList(prefs.watchList);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadWatchList();
        }, [loadWatchList])
    );

    // Debounced AI suggestions
    useEffect(() => {
        if (suggestionTimeout.current) {
            clearTimeout(suggestionTimeout.current);
        }

        if (newKeyword.trim().length >= 3) {
            setLoadingSuggestions(true);
            suggestionTimeout.current = setTimeout(async () => {
                try {
                    console.log('Fetching suggestions for:', newKeyword);
                    const result = await getSearchSuggestions(newKeyword);
                    console.log('Got suggestions:', result);

                    // Only update if we got a valid result (keep previous if null)
                    if (result) {
                        setSuggestions(result);

                        // Auto-select category if suggested
                        if (result.suggestedCategory && !newCategory) {
                            setNewCategory(result.suggestedCategory);
                        }
                        // Auto-fill price if suggested
                        if (result.priceRange && !newMaxPrice) {
                            setNewMaxPrice(result.priceRange.max.toString());
                        }
                    }
                } catch (error) {
                    console.error('Suggestion fetch error:', error);
                }
                setLoadingSuggestions(false);
            }, 800); // Debounce 800ms
        } else if (newKeyword.trim().length === 0) {
            // Only clear suggestions if the input is completely empty
            setSuggestions(null);
            setLoadingSuggestions(false);
        } else {
            setLoadingSuggestions(false);
        }

        return () => {
            if (suggestionTimeout.current) {
                clearTimeout(suggestionTimeout.current);
            }
        };
    }, [newKeyword]);

    const handleToggleAlert = async (itemId: string, isActive: boolean) => {
        const prefs = await getPreferences();
        const updated = prefs.watchList.map(item =>
            item.id === itemId ? { ...item, isActive } : item
        );
        await savePreferences({ ...prefs, watchList: updated });
        setWatchList(updated);
    };

    const handleDeleteAlert = async (itemId: string) => {
        await removeFromWatchList(itemId);
        await loadWatchList();
    };

    const handleRunSearch = () => {
        const searchTerms = getSearchTerms();
        if (!searchTerms) return;

        // Navigate to dedicated search results screen with embedded browser
        const maxPrice = newMaxPrice ? parseFloat(newMaxPrice) : undefined;
        setShowAddModal(false);
        navigation.navigate('SearchResults', { query: searchTerms, maxPrice });
    };

    const handleAddAlert = async () => {
        const searchTerms = getSearchTerms();
        if (!searchTerms) return;

        const item: WatchListItem = {
            id: Date.now().toString(),
            keyword: searchTerms,
            category: newCategory || undefined,
            maxPrice: newMaxPrice ? parseFloat(newMaxPrice) : undefined,
            areas: selectedAreas.length > 0 ? selectedAreas : Object.values(CAMBRIDGE_AREAS) as CambridgeArea[],
            createdAt: new Date(),
            isActive: true,
        };

        await addToWatchList(item);
        await loadWatchList();

        // Reset form
        setNewKeyword('');
        setSelectedTags([]);
        setNewCategory(null);
        setNewMaxPrice('');
        setSelectedAreas([]);
        setSuggestions(null);
        setShowAddModal(false);
        setShowResults(false);
    };

    const handleSelectSuggestion = (term: string) => {
        if (!selectedTags.includes(term)) {
            setSelectedTags([...selectedTags, term]);
        }
        setNewKeyword(''); // Clear input after selecting
    };

    const handleRemoveTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };

    const getSearchTerms = () => {
        const terms = [...selectedTags];
        if (newKeyword.trim()) {
            terms.push(newKeyword.trim());
        }
        return terms.join(', ');
    };

    const toggleArea = (area: CambridgeArea) => {
        setSelectedAreas(prev =>
            prev.includes(area)
                ? prev.filter(a => a !== area)
                : [...prev, area]
        );
    };

    const timeOptions = ['07:00', '08:00', '09:00', '12:00', '18:00', '21:00'];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Deal Alerts</Text>
                <Text style={styles.subtitle}>
                    Get notified when deals match your criteria
                </Text>
            </View>

            {/* Alert List */}
            {watchList.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🔔</Text>
                    <Text style={styles.emptyTitle}>No alerts set up</Text>
                    <Text style={styles.emptyDescription}>
                        Create an alert to get notified when deals match your interests
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={watchList}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.alertCard}>
                            <View style={styles.alertInfo}>
                                <Text style={styles.alertKeyword}>{item.keyword}</Text>
                                <Text style={styles.alertMeta}>
                                    {item.category && `${CATEGORY_LABELS[item.category as CategoryType]} · `}
                                    {item.maxPrice && `Max $${item.maxPrice} · `}
                                    {item.areas.length === 4 ? 'All areas' : item.areas.map(a => AREA_LABELS[a]?.split(' ')[1]).join(', ')}
                                </Text>

                                {/* Run Search Button */}
                                <TouchableOpacity
                                    style={styles.alertRunButton}
                                    onPress={() => {
                                        navigation.navigate('SearchResults', {
                                            query: item.keyword,
                                            maxPrice: item.maxPrice
                                        });
                                    }}
                                >
                                    <Text style={styles.alertRunButtonText}>🔍 Run Search</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.alertActionsColumn}>
                                <Switch
                                    value={item.isActive}
                                    onValueChange={(v) => handleToggleAlert(item.id, v)}
                                    trackColor={{ false: '#3D3D4D', true: '#FF6B35' }}
                                    thumbColor="#FFFFFF"
                                />
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteAlert(item.id)}
                                >
                                    <Text style={styles.deleteText}>🗑️</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Add Alert FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowAddModal(true)}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            {/* Add Alert Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Alert</Text>
                            <TouchableOpacity onPress={() => {
                                setShowAddModal(false);
                                setShowResults(false);
                                setSuggestions(null);
                            }}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>What are you looking for?</Text>

                            {/* Selected Tags */}
                            {selectedTags.length > 0 && (
                                <View style={styles.tagsContainer}>
                                    {selectedTags.map((tag, index) => (
                                        <View key={index} style={styles.selectedTag}>
                                            <Text style={styles.selectedTagText}>{tag}</Text>
                                            <TouchableOpacity
                                                onPress={() => handleRemoveTag(tag)}
                                                style={styles.removeTagButton}
                                            >
                                                <Text style={styles.removeTagText}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <TextInput
                                style={styles.input}
                                placeholder={selectedTags.length > 0 ? "Add more terms..." : "e.g., golf clubs, iPhone, furniture"}
                                placeholderTextColor="#6B6B7B"
                                value={newKeyword}
                                onChangeText={setNewKeyword}
                            />

                            {/* AI Suggestions Panel */}
                            {(loadingSuggestions || suggestions) && (
                                <View style={styles.suggestionsPanel}>
                                    <View style={styles.suggestionHeader}>
                                        <Text style={styles.suggestionTitle}>✨ AI Suggestions</Text>
                                        {loadingSuggestions && (
                                            <ActivityIndicator size="small" color="#FF6B35" />
                                        )}
                                    </View>

                                    {suggestions && (
                                        <>
                                            {/* Related Terms */}
                                            {suggestions.relatedTerms.length > 0 && (
                                                <View style={styles.suggestionRow}>
                                                    <Text style={styles.suggestionLabel}>Related:</Text>
                                                    <View style={styles.suggestionChips}>
                                                        {suggestions.relatedTerms.slice(0, 4).map((term, i) => (
                                                            <TouchableOpacity
                                                                key={i}
                                                                style={styles.suggestionChip}
                                                                onPress={() => handleSelectSuggestion(term)}
                                                            >
                                                                <Text style={styles.suggestionChipText}>{term}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}

                                            {/* Brands */}
                                            {suggestions.brands.length > 0 && (
                                                <View style={styles.suggestionRow}>
                                                    <Text style={styles.suggestionLabel}>Brands:</Text>
                                                    <Text style={styles.suggestionValue}>
                                                        {suggestions.brands.join(' • ')}
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Price Range */}
                                            {suggestions.priceRange && (
                                                <View style={styles.suggestionRow}>
                                                    <Text style={styles.suggestionLabel}>Price:</Text>
                                                    <Text style={styles.suggestionValue}>
                                                        Usually ${suggestions.priceRange.min} - ${suggestions.priceRange.max}
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Tips */}
                                            {suggestions.tips && (
                                                <View style={styles.tipBox}>
                                                    <Text style={styles.tipText}>💡 {suggestions.tips}</Text>
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            )}

                            <Text style={styles.inputLabel}>Maximum Price (optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 500"
                                placeholderTextColor="#6B6B7B"
                                value={newMaxPrice}
                                onChangeText={setNewMaxPrice}
                                keyboardType="decimal-pad"
                            />

                            <Text style={styles.inputLabel}>Category</Text>
                            <View style={styles.chipContainer}>
                                {Object.values(CATEGORIES).map(cat => (
                                    <CategoryChip
                                        key={cat}
                                        label={CATEGORY_LABELS[cat as CategoryType]}
                                        selected={newCategory === cat}
                                        onPress={() => setNewCategory(newCategory === cat ? null : cat)}
                                    />
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Alert Time</Text>
                            <View style={styles.timeRow}>
                                {timeOptions.map(time => (
                                    <TouchableOpacity
                                        key={time}
                                        style={[styles.timeChip, alertTime === time && styles.timeChipActive]}
                                        onPress={() => setAlertTime(time)}
                                    >
                                        <Text style={[styles.timeChipText, alertTime === time && styles.timeChipTextActive]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Areas</Text>
                            <View style={styles.chipContainer}>
                                {Object.values(CAMBRIDGE_AREAS).map(area => (
                                    <CategoryChip
                                        key={area}
                                        label={AREA_LABELS[area]}
                                        selected={selectedAreas.includes(area as CambridgeArea)}
                                        onPress={() => toggleArea(area as CambridgeArea)}
                                    />
                                ))}
                            </View>

                            {/* Search Results */}
                            {showResults && (
                                <View style={styles.resultsSection}>
                                    {/* Live Marketplace Listings */}
                                    {liveListings.length > 0 && (
                                        <>
                                            <Text style={styles.resultsTitle}>
                                                🔴 {liveListings.length} Live Listings Found
                                            </Text>
                                            {liveListings.slice(0, 6).map((listing, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={styles.resultCard}
                                                    onPress={() => {
                                                        if (listing.url) {
                                                            Linking.openURL(listing.url);
                                                        }
                                                    }}
                                                >
                                                    <View style={styles.resultHeader}>
                                                        <Text style={styles.sourceTag}>
                                                            {listing.source === 'kijiji' ? '🟠 Kijiji' : listing.source === 'facebook' ? '🔵 FB' : '⚪ Other'}
                                                        </Text>
                                                        <Text style={styles.resultLocation}>{listing.location}</Text>
                                                    </View>
                                                    <Text style={styles.resultTitle} numberOfLines={2}>{listing.title}</Text>
                                                    <Text style={styles.resultPrice}>
                                                        {listing.price ? `$${listing.price}` : 'Price not listed'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}

                                    {liveListings.length === 0 && !searching && (
                                        <Text style={styles.noResultsText}>
                                            No live listings found. Try different search terms.
                                        </Text>
                                    )}

                                    {/* Saved Deals */}
                                    {searchResults.length > 0 && (
                                        <>
                                            <Text style={[styles.resultsTitle, { marginTop: 16 }]}>
                                                💾 {searchResults.length} Saved Deals
                                            </Text>
                                            {searchResults.slice(0, 3).map(deal => (
                                                <TouchableOpacity
                                                    key={deal.id}
                                                    style={styles.resultCard}
                                                    onPress={() => {
                                                        setShowAddModal(false);
                                                        navigation.navigate('DealDetail', { deal });
                                                    }}
                                                >
                                                    <Text style={styles.resultTitle}>{deal.title}</Text>
                                                    <Text style={styles.resultPrice}>
                                                        {deal.price ? `$${deal.price}` : 'Price not listed'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.runButton, (selectedTags.length === 0 && !newKeyword.trim()) && styles.buttonDisabled]}
                                    onPress={handleRunSearch}
                                    disabled={(selectedTags.length === 0 && !newKeyword.trim()) || searching}
                                >
                                    {searching ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.runButtonText}>🔍 Search Now</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveButton, (selectedTags.length === 0 && !newKeyword.trim()) && styles.buttonDisabled]}
                                    onPress={handleAddAlert}
                                    disabled={selectedTags.length === 0 && !newKeyword.trim()}
                                >
                                    <Text style={styles.saveButtonText}>🔔 Create Alert</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
        paddingBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: '#8B8B9B',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    alertCard: {
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    alertInfo: {
        flex: 1,
        marginRight: 12,
    },
    alertKeyword: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    alertMeta: {
        fontSize: 13,
        color: '#8B8B9B',
        marginBottom: 8,
    },
    alertRunButton: {
        backgroundColor: '#2D2D3D',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    alertRunButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    alertActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    alertActionsColumn: {
        alignItems: 'center',
        gap: 8,
    },
    deleteButton: {
        padding: 8,
    },
    deleteText: {
        fontSize: 18,
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E1E2E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalClose: {
        fontSize: 24,
        color: '#8B8B9B',
    },
    inputLabel: {
        fontSize: 14,
        color: '#8B8B9B',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: '#0F0F1A',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#2D2D3D',
    },
    // AI Suggestions Styles
    suggestionsPanel: {
        backgroundColor: '#252536',
        borderRadius: 12,
        padding: 14,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#3D3D4D',
    },
    suggestionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FF6B35',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    suggestionLabel: {
        fontSize: 13,
        color: '#8B8B9B',
        width: 60,
        marginTop: 4,
    },
    suggestionValue: {
        fontSize: 13,
        color: '#FFFFFF',
        flex: 1,
    },
    suggestionChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
        gap: 6,
    },
    suggestionChip: {
        backgroundColor: '#3D3D4D',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
    },
    suggestionChipText: {
        fontSize: 12,
        color: '#FFFFFF',
    },
    tipBox: {
        backgroundColor: '#1E1E2E',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
    },
    tipText: {
        fontSize: 12,
        color: '#A0A0B0',
        fontStyle: 'italic',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
    },
    timeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    timeChip: {
        backgroundColor: '#2D2D3D',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    timeChipActive: {
        backgroundColor: '#FF6B35',
    },
    timeChipText: {
        fontSize: 14,
        color: '#A0A0B0',
        fontWeight: '500',
    },
    timeChipTextActive: {
        color: '#FFFFFF',
    },
    resultsSection: {
        marginTop: 20,
        padding: 14,
        backgroundColor: '#252536',
        borderRadius: 12,
    },
    resultsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4ADE80',
        marginBottom: 12,
    },
    resultCard: {
        backgroundColor: '#1E1E2E',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    resultTitle: {
        fontSize: 14,
        color: '#FFFFFF',
        flex: 1,
        marginRight: 8,
    },
    resultPrice: {
        fontSize: 14,
        color: '#4ADE80',
        fontWeight: '600',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
        width: '100%',
    },
    sourceTag: {
        fontSize: 12,
        color: '#FF6B35',
        fontWeight: '600',
    },
    resultLocation: {
        fontSize: 11,
        color: '#8B8B9B',
    },
    noResultsText: {
        fontSize: 14,
        color: '#8B8B9B',
        textAlign: 'center',
        paddingVertical: 16,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    runButton: {
        flex: 1,
        backgroundColor: '#2D2D3D',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    runButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#FF6B35',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    // Tag styles
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
        gap: 8,
    },
    selectedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6B35',
        borderRadius: 20,
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 8,
    },
    selectedTagText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginRight: 6,
    },
    removeTagButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeTagText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});
