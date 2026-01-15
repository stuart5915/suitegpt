import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { BibleVersionsService, BibleVersion } from '../services/bibleVersions';
import { Spacing, Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BibleLibrary() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState('');
    const [versions, setVersions] = useState<BibleVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterAudio, setFilterAudio] = useState(false);

    // Default language is English for now
    const [selectedLanguage, setSelectedLanguage] = useState({ id: 'eng', name: 'English' });

    useEffect(() => {
        // Initial fetch
        handleSearch('');
    }, []);

    const handleSearch = useCallback(async (query: string) => {
        setLoading(true);
        try {
            const results = await BibleVersionsService.searchVersions(query, selectedLanguage.id);
            setVersions(results);
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setLoading(false);
        }
    }, [selectedLanguage]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    const filteredVersions = versions.filter(v => {
        if (filterAudio && !v.audio) return false;
        return true;
    });

    const renderItem = ({ item }: { item: BibleVersion }) => (
        <TouchableOpacity
            style={[styles.versionItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => router.push({ pathname: '/version-details', params: { id: item.id } })}
        >
            <View style={[styles.badge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#F2F2F7' }]}>
                <Text style={[styles.badgeText, { color: isDarkMode ? '#FFF' : '#000' }]}>
                    {item.abbreviation}
                </Text>
            </View>
            <View style={styles.info}>
                <Text style={[styles.versionName, { color: isDarkMode ? '#FFF' : '#000' }]} numberOfLines={2}>
                    {item.name}
                </Text>
                {item.description ? (
                    <Text style={[styles.versionDesc, { color: isDarkMode ? '#8E8E93' : '#666' }]} numberOfLines={1}>
                        {item.description}
                    </Text>
                ) : null}
            </View>
            <View style={styles.actions}>
                {item.audio && (
                    <Text style={[styles.iconText, { color: isDarkMode ? '#8E8E93' : '#666', marginRight: 10 }]}>🔊</Text>
                )}
                <Text style={[styles.iconText, { color: isDarkMode ? '#666' : '#CCC' }]}>›</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#F2F2F7', paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: isDarkMode ? '#000' : '#FFF' }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={[styles.backIcon, { color: isDarkMode ? '#FFF' : '#000' }]}>‹</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: isDarkMode ? '#8E8E93' : '#666' }]}>
                        {loading ? 'Searching...' : `${versions.length} Versions Found`}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? '#1C1C1E' : '#E5E5EA' }]}>
                    <Text style={{ fontSize: 16 }}>🔍</Text>
                    <TextInput
                        style={[styles.searchInput, { color: isDarkMode ? '#FFF' : '#000' }]}
                        placeholder="Search Versions"
                        placeholderTextColor="#8E8E93"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={{ fontSize: 16, color: '#8E8E93' }}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters */}
                <View style={styles.filtersRow}>
                    <TouchableOpacity
                        style={[styles.filterPill, !filterAudio && styles.filterPillActive, { backgroundColor: !filterAudio ? (isDarkMode ? '#FFF' : '#000') : (isDarkMode ? '#1C1C1E' : '#E5E5EA') }]}
                        onPress={() => setFilterAudio(false)}
                    >
                        <Text style={[styles.filterText, { color: !filterAudio ? (isDarkMode ? '#000' : '#FFF') : (isDarkMode ? '#FFF' : '#000') }]}>All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, filterAudio && styles.filterPillActive, { backgroundColor: filterAudio ? (isDarkMode ? '#FFF' : '#000') : (isDarkMode ? '#1C1C1E' : '#E5E5EA') }]}
                        onPress={() => setFilterAudio(true)}
                    >
                        <Text style={[styles.filterText, { color: filterAudio ? (isDarkMode ? '#000' : '#FFF') : (isDarkMode ? '#FFF' : '#000') }]}>Audio Available</Text>
                    </TouchableOpacity>
                </View>

                {/* Language Selector */}
                <TouchableOpacity style={styles.languageRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>🌐</Text>
                        <Text style={[styles.languageText, { color: isDarkMode ? '#FFF' : '#000' }]}>{selectedLanguage.name}</Text>
                        <View style={[styles.langCountBadge, { backgroundColor: isDarkMode ? '#3A3A3C' : '#E5E5EA' }]}>
                            <Text style={[styles.langCountText, { color: isDarkMode ? '#AAA' : '#666' }]}>{versions.length}</Text>
                        </View>
                    </View>
                    <Text style={[styles.iconText, { color: isDarkMode ? '#666' : '#CCC' }]}>›</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading && versions.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={isDarkMode ? '#FFF' : '#000'} />
                </View>
            ) : (
                <FlatList
                    data={filteredVersions}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: Spacing.md }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: Spacing.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        height: '100%',
    },
    filtersRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    filterPill: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    filterPillActive: {
        // Handled by inline styles for dynamic colors
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
    },
    languageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    languageText: {
        fontSize: 16,
        fontWeight: '600',
    },
    langCountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    langCountText: {
        fontSize: 12,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    versionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    badge: {
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    versionName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    versionDesc: {
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 18,
    },
    backIcon: {
        fontSize: 28,
        fontWeight: '300',
    },
});
