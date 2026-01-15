import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import { CATEGORIES, TOPICS, getTopicsByCategory, type EdificationCategory } from '../services/edificationContent';
import { getAllReflectionsFiltered } from '../services/database';
import { chatWithPastSelf, analyzeJournalThemes, type ReflectionFilter, getSessionThemesCache, setSessionThemesCache } from '../services/geminiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Edification() {
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const [readTopics, setReadTopics] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Insights state
    const [insightsExpanded, setInsightsExpanded] = useState(false);
    const [entries, setEntries] = useState<any[]>([]);
    const [themes, setThemes] = useState<string[]>([]);
    const [themesLoading, setThemesLoading] = useState(true);
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [chatting, setChatting] = useState(false);

    // Reflection filter for chat context
    const [reflectionFilter, setReflectionFilter] = useState<ReflectionFilter>('all');

    const suggestedQuestions = [
        'What was I learning about hope in the past month?',
        'How has my faith grown over time?',
        'What areas of my life need more surrender?',
    ];

    useEffect(() => {
        loadReadTopics();
    }, []);

    // Load insights data when expanded
    useEffect(() => {
        if (insightsExpanded && entries.length === 0) {
            loadInsightsData();
        }
    }, [insightsExpanded]);

    async function loadReadTopics() {
        try {
            const saved = await AsyncStorage.getItem('read_edification_topics');
            if (saved) {
                setReadTopics(new Set(JSON.parse(saved)));
            }
        } catch (error) {
            console.error('Error loading read topics:', error);
        }
    }

    async function loadInsightsData() {
        try {
            // ALWAYS load fresh entries from database first
            const allEntries = await getAllReflectionsFiltered({ type: 'all' });
            console.log('[Edification] Fresh entries from DB:', allEntries.length);
            setEntries(allEntries);

            // If no entries, clear all caches and return
            if (allEntries.length === 0) {
                console.log('[Edification] No entries, clearing stale caches');
                await AsyncStorage.removeItem('cached_insights_data');
                setThemes([]);
                setThemesLoading(false);
                return;
            }

            // Check session cache for themes
            const sessionCache = getSessionThemesCache();
            if (sessionCache) {
                console.log('📊 Using session-cached themes (edification)');
                setThemes(sessionCache);
                setThemesLoading(false);
                return;
            }

            // Check persistent cache for themes
            const cachedData = await AsyncStorage.getItem('cached_insights_data');
            if (cachedData) {
                const { entries: cachedEntries, themes: cachedThemes } = JSON.parse(cachedData);
                // Only use cached themes if entry count matches
                if (cachedEntries?.length === allEntries.length && cachedThemes?.length > 0) {
                    setThemes(cachedThemes);
                    setThemesLoading(false);
                    return;
                }
            }

            // Generate fresh themes
            const discoveredThemes = await analyzeJournalThemes(allEntries as any);
            setThemes(discoveredThemes);

            // Save to session cache
            setSessionThemesCache(discoveredThemes);

            // Save to persistent cache
            await AsyncStorage.setItem('cached_insights_data', JSON.stringify({
                entries: allEntries,
                themes: discoveredThemes,
            }));
        } catch (error) {
            console.error('Error loading insights:', error);
        } finally {
            setThemesLoading(false);
        }
    }

    // Get filtered entries based on current filter selection
    async function getFilteredEntriesForChat(): Promise<any[]> {
        const filtered = await getAllReflectionsFiltered({ type: reflectionFilter });
        return filtered;
    }

    async function handleAskQuestion() {
        if (!question.trim()) return;

        setChatting(true);
        setResponse('');

        try {
            // Get fresh filtered entries for the chat
            const filteredEntries = await getFilteredEntriesForChat();

            if (filteredEntries.length === 0) {
                setResponse(`No ${reflectionFilter === 'all' ? '' : reflectionFilter + ' '}reflections found. Start journaling to chat with your past self!`);
                return;
            }

            const answer = await chatWithPastSelf(question.trim(), filteredEntries as any, reflectionFilter);
            setResponse(answer);
        } catch (error) {
            console.error('Error asking question:', error);
            setResponse("Sorry, couldn't process that question.");
        } finally {
            setChatting(false);
        }
    }

    function handleTopicPress(topicId: string) {
        router.push({ pathname: '/edification/[topicId]', params: { topicId } });
    }

    return (
        <View style={styles.container}>
            <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                {/* Hero Banner - Edge to Edge, behind status bar */}
                <Image
                    source={require('../assets/banner_edification.png')}
                    style={{
                        width: '120%',
                        height: Platform.OS === 'ios' ? 190 : 160,
                        marginHorizontal: -Spacing.lg,
                        marginTop: Platform.OS === 'ios' ? -Spacing.lg - 50 : -Spacing.lg,
                        alignSelf: 'center',
                        marginBottom: Spacing.md,
                    }}
                    resizeMode="cover"
                />

                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h2">Edification</Typography>
                    <Typography variant="body" color={Colors.mediumGray} style={{ marginTop: Spacing.sm }}>
                        Strengthen your understanding
                    </Typography>
                </View>

                {/* Categories */}
                {CATEGORIES.map((category) => {
                    const topics = getTopicsByCategory(category.id);
                    const isInsights = category.id === 'insights';

                    return (
                        <View key={category.id} style={styles.categorySection}>
                            {/* Category Header */}
                            {isInsights ? (
                                <>
                                    {/* Insights Header - Collapsible */}
                                    <TouchableOpacity
                                        style={[styles.insightsCard, insightsExpanded && styles.insightsCardExpanded]}
                                        onPress={() => setInsightsExpanded(!insightsExpanded)}
                                    >
                                        <View style={styles.insightsContent}>
                                            <Typography variant="h3" style={styles.categoryIconLarge}>
                                                {category.icon}
                                            </Typography>
                                            <View style={{ flex: 1 }}>
                                                <Typography variant="h3">{category.name}</Typography>
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    {category.description}
                                                </Typography>
                                            </View>
                                            <Typography variant="body" color={Colors.gold}>
                                                {insightsExpanded ? '▲' : '▼'}
                                            </Typography>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Expanded Insights Content */}
                                    {insightsExpanded && (
                                        <View style={styles.insightsExpandedContent}>
                                            {/* Entry count */}
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: Spacing.md }}>
                                                {entries.length} journal entries analyzed
                                            </Typography>

                                            {/* Recurring Themes */}
                                            <Typography variant="body" style={styles.insightsSubtitle}>
                                                📊 Recurring Themes
                                            </Typography>
                                            {themesLoading ? (
                                                <ActivityIndicator size="small" color={Colors.gold} style={{ marginVertical: Spacing.sm }} />
                                            ) : themes.length > 0 ? (
                                                themes.slice(0, 3).map((theme, idx) => (
                                                    <Typography key={idx} variant="caption" color={Colors.mediumGray} style={styles.themeItem}>
                                                        • {theme}
                                                    </Typography>
                                                ))
                                            ) : (
                                                <Typography variant="caption" color={Colors.mediumGray}>
                                                    No themes found yet. Keep journaling!
                                                </Typography>
                                            )}

                                            {/* Suggested Questions */}
                                            <Typography variant="body" style={[styles.insightsSubtitle, { marginTop: Spacing.md }]}>
                                                💬 Ask Your Past Self
                                            </Typography>
                                            <View style={styles.suggestedQuestions}>
                                                {suggestedQuestions.map((q, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={styles.questionChip}
                                                        onPress={() => setQuestion(q)}
                                                    >
                                                        <Typography variant="caption" color={Colors.gold}>
                                                            "{q}"
                                                        </Typography>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {/* Reflection Filter Pills */}
                                            <View style={styles.filterSection}>
                                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: Spacing.xs }}>
                                                    Chat context:
                                                </Typography>
                                                <View style={styles.filterPills}>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.filterPill,
                                                            reflectionFilter === 'plan' && styles.filterPillActive
                                                        ]}
                                                        onPress={() => setReflectionFilter('plan')}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color={reflectionFilter === 'plan' ? Colors.white : Colors.charcoal}
                                                        >
                                                            📖 Plan Readings
                                                        </Typography>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.filterPill,
                                                            reflectionFilter === 'all' && styles.filterPillActive
                                                        ]}
                                                        onPress={() => setReflectionFilter('all')}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color={reflectionFilter === 'all' ? Colors.white : Colors.charcoal}
                                                        >
                                                            📚 All Reflections
                                                        </Typography>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Question Input */}
                                            <TextInput
                                                style={styles.questionInput}
                                                value={question}
                                                onChangeText={setQuestion}
                                                placeholder="Ask about your spiritual journey..."
                                                placeholderTextColor={Colors.mediumGray}
                                                onFocus={() => {
                                                    // Scroll to position input above keyboard
                                                    setTimeout(() => {
                                                        scrollViewRef.current?.scrollTo({ y: 400, animated: true });
                                                    }, 300);
                                                }}
                                            />
                                            <Button onPress={handleAskQuestion} disabled={chatting || !question.trim()}>
                                                {chatting ? 'Thinking...' : 'Ask'}
                                            </Button>

                                            {/* Response */}
                                            {response && (
                                                <Card style={styles.responseCard}>
                                                    <Typography variant="body">{response}</Typography>
                                                </Card>
                                            )}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Category Header - Prominent styling */}
                                    <View style={styles.categoryHeader}>
                                        <View style={styles.categoryTitleRow}>
                                            <Typography variant="body" style={styles.categoryIcon}>
                                                {category.icon}
                                            </Typography>
                                            <Typography variant="h2" color={Colors.gold}>
                                                {category.name}
                                            </Typography>
                                        </View>
                                        <Typography variant="caption" color={Colors.mediumGray} style={styles.categoryDescription}>
                                            {category.description}
                                        </Typography>
                                    </View>

                                    {/* Topic Cards - All compact style with subtitle */}
                                    {topics.length > 0 ? (
                                        <View style={styles.topicsList}>
                                            {/* Show first 2 always, rest when expanded */}
                                            {(expandedCategories.has(category.id) ? topics : topics.slice(0, 2)).map((topic) => {
                                                const isRead = readTopics.has(topic.id);
                                                return (
                                                    <TouchableOpacity
                                                        key={topic.id}
                                                        style={styles.compactTopicItem}
                                                        onPress={() => handleTopicPress(topic.id)}
                                                    >
                                                        <Typography variant="body" style={styles.compactIcon}>
                                                            {topic.icon}
                                                        </Typography>
                                                        <View style={styles.compactContent}>
                                                            <Typography variant="body" style={styles.compactTitle} numberOfLines={1}>
                                                                {topic.title}
                                                            </Typography>
                                                            <Typography variant="caption" color={Colors.mediumGray} numberOfLines={1}>
                                                                {topic.subtitle}
                                                            </Typography>
                                                        </View>
                                                        {isRead && (
                                                            <Typography variant="caption" color={Colors.gold}>✓</Typography>
                                                        )}
                                                        <Typography variant="body" color={Colors.mediumGray}>→</Typography>
                                                    </TouchableOpacity>
                                                );
                                            })}

                                            {topics.length > 2 && (
                                                <TouchableOpacity
                                                    style={styles.seeMoreButton}
                                                    onPress={() => {
                                                        const newExpanded = new Set(expandedCategories);
                                                        if (newExpanded.has(category.id)) {
                                                            newExpanded.delete(category.id);
                                                        } else {
                                                            newExpanded.add(category.id);
                                                        }
                                                        setExpandedCategories(newExpanded);
                                                    }}
                                                >
                                                    <Typography variant="body" color={Colors.gold}>
                                                        {expandedCategories.has(category.id)
                                                            ? '▲ Show less'
                                                            : `▼ See all ${topics.length}`}
                                                    </Typography>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ) : (
                                        <Card style={styles.comingSoonCard}>
                                            <Typography variant="caption" color={Colors.mediumGray}>
                                                Coming soon...
                                            </Typography>
                                        </Card>
                                    )}
                                </>
                            )}
                        </View>
                    );
                })}

                {/* Bottom padding */}
                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    categorySection: {
        marginBottom: Spacing.xl,
    },
    categoryHeader: {
        marginBottom: Spacing.md,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 2,
        borderBottomColor: Colors.gold,
    },
    categoryTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryIcon: {
        fontSize: 24,
        marginRight: Spacing.sm,
    },
    categoryDescription: {
        marginTop: 2,
        marginLeft: 32,
    },
    insightsCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.lg,
        borderWidth: 2,
        borderColor: Colors.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    insightsContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topicsList: {
        gap: Spacing.sm,
    },
    topicListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: Spacing.md,
        borderRadius: 12,
        gap: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    topicListIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: Colors.lightGray,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topicIcon: {
        fontSize: 20,
    },
    topicListContent: {
        flex: 1,
    },
    topicTitle: {
        fontWeight: '600',
        marginBottom: 2,
    },
    seeMoreButton: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    comingSoonCard: {
        padding: Spacing.lg,
        alignItems: 'center',
        backgroundColor: Colors.lightGray,
    },
    // Compact items for expanded list
    compactTopicItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    compactIcon: {
        fontSize: 18,
        width: 28,
        textAlign: 'center',
    },
    compactContent: {
        flex: 1,
    },
    compactTitle: {
        fontWeight: '500',
        fontSize: 15,
    },
    // Insights expansion styles
    insightsCardExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginBottom: 0,
    },
    categoryIconLarge: {
        fontSize: 28,
        marginRight: Spacing.md,
    },
    insightsExpandedContent: {
        backgroundColor: Colors.white,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        padding: Spacing.lg,
        paddingTop: Spacing.md,
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: Colors.gold,
    },
    insightsSubtitle: {
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    themeItem: {
        marginLeft: Spacing.sm,
        marginBottom: 4,
    },
    suggestedQuestions: {
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    questionChip: {
        backgroundColor: Colors.lightGray,
        padding: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.gold,
    },
    questionInput: {
        backgroundColor: Colors.cream,
        borderRadius: 12,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        marginBottom: Spacing.sm,
        fontSize: 14,
        color: Colors.charcoal,
    },
    responseCard: {
        marginTop: Spacing.md,
        backgroundColor: Colors.lightGray,
        padding: Spacing.md,
    },
    filterSection: {
        marginBottom: Spacing.md,
    },
    filterPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    filterPill: {
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gold,
        backgroundColor: Colors.white,
    },
    filterPillActive: {
        backgroundColor: Colors.gold,
        borderColor: Colors.gold,
    },
});
