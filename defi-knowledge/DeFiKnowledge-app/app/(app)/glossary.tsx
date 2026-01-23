import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useTerminologyStore } from '@/context/TerminologyContext';
import { useGlossaryProgress } from '@/lib/glossaryProgress';
import {
    TERMINOLOGY,
    CATEGORY_INFO,
    getAllCategories,
    getTermsByCategory,
    Term,
} from '@/lib/terminology';

export default function GlossaryScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const openTerm = useTerminologyStore((state) => state.openTerm);

    // Progress tracking
    const { understoodTerms, toggleTerm, getProgress } = useGlossaryProgress();
    const progress = getProgress();

    const categories = getAllCategories();

    // Toggle category expansion
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    // Get category progress
    const getCategoryProgress = (category: Term['category']) => {
        const terms = getTermsByCategory(category);
        const understood = terms.filter(t => understoodTerms.includes(t.id)).length;
        return { understood, total: terms.length };
    };

    // Filter terms based on search
    const searchResults = searchQuery.trim()
        ? TERMINOLOGY.filter(t =>
            t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.shortDef.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const isSearching = searchQuery.trim().length > 0;
    const isTermUnderstood = (termId: string) => understoodTerms.includes(termId);

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Glossary',
                    headerBackTitle: 'Back',
                    headerStyle: { backgroundColor: Colors.background },
                    headerTintColor: Colors.textPrimary,
                    headerShadowVisible: false,
                }}
            />
            <SafeAreaView style={styles.container}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Progress Card */}
                    <Animated.View entering={FadeInDown.duration(300)}>
                        <View style={styles.progressCard}>
                            <View style={styles.progressHeader}>
                                <View>
                                    <Text style={styles.progressTitle}>Your Progress</Text>
                                    <Text style={styles.progressSubtitle}>
                                        {progress.understood} of {progress.total} terms mastered
                                    </Text>
                                </View>
                                <View style={styles.progressBadge}>
                                    <Text style={styles.progressPercent}>{progress.percentage}%</Text>
                                </View>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${progress.percentage}%` }
                                    ]}
                                />
                            </View>
                            {progress.percentage === 100 && (
                                <Text style={styles.completedText}>🎉 You've mastered all terms!</Text>
                            )}
                        </View>
                    </Animated.View>

                    {/* Search Bar */}
                    <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={18} color={Colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search terms..."
                                placeholderTextColor={Colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>

                    {/* Search Results OR Category Accordions */}
                    {isSearching ? (
                        // Search Results
                        <Animated.View entering={FadeIn.duration(200)}>
                            <Text style={styles.resultCount}>
                                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                            </Text>
                            {searchResults.length === 0 ? (
                                <Text style={styles.noResults}>No terms found</Text>
                            ) : (
                                searchResults.map((term) => {
                                    const understood = isTermUnderstood(term.id);
                                    return (
                                        <TouchableOpacity
                                            key={term.id}
                                            style={styles.searchResultItem}
                                            onPress={() => openTerm(term.term)}
                                        >
                                            <View style={styles.searchResultLeft}>
                                                <TouchableOpacity
                                                    style={[styles.miniCheck, understood && styles.miniCheckActive]}
                                                    onPress={() => toggleTerm(term.id)}
                                                >
                                                    {understood && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                </TouchableOpacity>
                                                <View>
                                                    <Text style={styles.searchResultTerm}>{term.term}</Text>
                                                    <Text style={styles.searchResultDef} numberOfLines={1}>{term.shortDef}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.searchResultCategory}>
                                                {CATEGORY_INFO[term.category]?.emoji}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </Animated.View>
                    ) : (
                        // Category Accordions
                        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
                            <Text style={styles.browseHint}>Tap a category to explore terms</Text>

                            {categories.map((category, index) => {
                                const info = CATEGORY_INFO[category];
                                const terms = getTermsByCategory(category);
                                const isExpanded = expandedCategories.has(category);
                                const catProgress = getCategoryProgress(category);
                                const catPercent = Math.round((catProgress.understood / catProgress.total) * 100);

                                return (
                                    <Animated.View
                                        key={category}
                                        entering={FadeInDown.delay(100 + index * 50).duration(300)}
                                    >
                                        {/* Category Header */}
                                        <TouchableOpacity
                                            style={styles.categoryHeader}
                                            onPress={() => toggleCategory(category)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.categoryLeft}>
                                                <Text style={styles.categoryEmoji}>{info.emoji}</Text>
                                                <View>
                                                    <Text style={styles.categoryName}>{info.label}</Text>
                                                    <Text style={styles.categoryMeta}>
                                                        {catProgress.understood}/{catProgress.total} mastered
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.categoryRight}>
                                                <View style={styles.miniProgressBg}>
                                                    <View style={[styles.miniProgressFill, { width: `${catPercent}%` }]} />
                                                </View>
                                                <Ionicons
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={20}
                                                    color={Colors.textMuted}
                                                />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Expanded Terms */}
                                        {isExpanded && (
                                            <Animated.View entering={FadeIn.duration(200)} style={styles.termsList}>
                                                {terms.map((term) => {
                                                    const understood = isTermUnderstood(term.id);
                                                    return (
                                                        <View key={term.id} style={styles.termItem}>
                                                            <TouchableOpacity
                                                                style={[styles.termCheck, understood && styles.termCheckActive]}
                                                                onPress={() => toggleTerm(term.id)}
                                                            >
                                                                {understood && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.termContent}
                                                                onPress={() => openTerm(term.term)}
                                                            >
                                                                <Text style={[styles.termName, understood && styles.termNameDone]}>
                                                                    {term.term}
                                                                </Text>
                                                                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    );
                                                })}
                                            </Animated.View>
                                        )}
                                    </Animated.View>
                                );
                            })}
                        </Animated.View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: Spacing['3xl'],
    },

    // Progress Card
    progressCard: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    progressTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    progressSubtitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    progressBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    progressPercent: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: '#fff',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: Colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.success,
        borderRadius: 4,
    },
    completedText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.success,
        textAlign: 'center',
        marginTop: Spacing.md,
        fontWeight: '500',
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
    },

    // Results
    resultCount: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
    },
    noResults: {
        fontSize: Typography.fontSize.base,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.xl,
    },

    // Search Results
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchResultLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    miniCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniCheckActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    searchResultTerm: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    searchResultDef: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        maxWidth: 220,
    },
    searchResultCategory: {
        fontSize: 18,
    },

    // Browse Hint
    browseHint: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },

    // Category Accordion
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    categoryEmoji: {
        fontSize: 28,
    },
    categoryName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    categoryMeta: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    categoryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    miniProgressBg: {
        width: 50,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    miniProgressFill: {
        height: '100%',
        backgroundColor: Colors.success,
        borderRadius: 2,
    },

    // Expanded Terms List
    termsList: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        marginTop: -Spacing.xs,
        marginLeft: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    termItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    termCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    termCheckActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    termContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    termName: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textPrimary,
    },
    termNameDone: {
        color: Colors.success,
    },

    // Legacy (can be removed)
    categoryBadge: {
        backgroundColor: Colors.surfaceElevated,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    categoryBadgeText: {
        fontSize: 12,
    },
});
