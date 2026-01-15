import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing, BorderRadius, FontSizes, FontFamilies } from '../constants/theme';
import { getAllReflectionsFiltered } from '../services/database';
import { chatWithPastSelf, analyzeJournalThemes, type ReflectionFilter, getSessionThemesCache, setSessionThemesCache } from '../services/geminiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Analysis() {
    const router = useRouter();
    const [loading, setLoading] = useState(true); // Start true until cache check
    const [themesLoading, setThemesLoading] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);
    const [themes, setThemes] = useState<string[]>([]);
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [chatting, setChatting] = useState(false);
    const [themesExpanded, setThemesExpanded] = useState(false);
    const [reflectionFilter, setReflectionFilter] = useState<ReflectionFilter>('all');
    const [questionsExpanded, setQuestionsExpanded] = useState(false);

    const allSuggestedQuestions = [
        'What was I learning about hope in the past month?',
        'How has my faith grown over time?',
        'What are recurring struggles I\'ve journaled about?',
        'What Scripture passages have impacted me most?',
        'What has God been teaching me about patience?',
        'How have I seen God\'s faithfulness?',
        'What prayers have been answered recently?',
        'What areas of my life need more surrender?',
    ];

    const [displayedQuestions, setDisplayedQuestions] = useState<string[]>(
        allSuggestedQuestions.slice(0, 4)
    );

    function shuffleQuestions() {
        const shuffled = [...allSuggestedQuestions].sort(() => Math.random() - 0.5);
        setDisplayedQuestions(shuffled.slice(0, 4));
    }

    // Load entries on mount (cheap, just DB query)
    useEffect(() => {
        loadEntries();
    }, []);

    // Generate themes only when section is expanded (lazy loading)
    useEffect(() => {
        if (themesExpanded && entries.length > 0 && themes.length === 0 && !themesLoading) {
            generateThemes();
        }
    }, [themesExpanded, entries]);

    async function loadEntries() {
        try {
            // Always load fresh entries from database
            const allEntries = await getAllReflectionsFiltered({ type: 'all' });
            console.log('[Insights] Fresh entries from DB:', allEntries.length);

            setEntries(allEntries);
            setLoading(false);

            // Clear any stale cache if current entry count is 0
            if (allEntries.length === 0) {
                console.log('[Insights] No entries, clearing all caches');
                await AsyncStorage.removeItem('cached_insights_data');
                setThemes([]);
                setThemesLoading(false);
            }
        } catch (error) {
            console.error('Error loading journal data:', error);
            setLoading(false);
        }
    }

    async function generateThemes() {
        if (entries.length === 0) {
            setThemesLoading(false);
            return;
        }

        // Check session cache first
        const sessionCache = getSessionThemesCache();
        if (sessionCache) {
            console.log('📊 Using session-cached themes');
            setThemes(sessionCache);
            setThemesLoading(false);
            return;
        }

        setThemesLoading(true);
        try {
            const discoveredThemes = await analyzeJournalThemes(entries as any);
            setThemes(discoveredThemes);

            // Save to session cache
            setSessionThemesCache(discoveredThemes);

            // Save to persistent cache
            await AsyncStorage.setItem('cached_insights_data', JSON.stringify({
                entries,
                themes: discoveredThemes,
            }));
        } catch (error) {
            console.error('Error analyzing themes:', error);
        } finally {
            setThemesLoading(false);
        }
    }

    async function handleAskQuestion() {
        if (!question.trim()) return;

        setChatting(true);
        setResponse('');

        try {
            // Get filtered entries for chat
            const filteredEntries = await getAllReflectionsFiltered({ type: reflectionFilter });

            if (filteredEntries.length === 0) {
                setResponse(`No ${reflectionFilter === 'all' ? '' : reflectionFilter + ' '}reflections found. Start journaling to chat with your past self!`);
                return;
            }

            const answer = await chatWithPastSelf(question.trim(), filteredEntries as any, reflectionFilter);
            setResponse(answer);
        } catch (error) {
            console.error('Error asking question:', error);
            setResponse('Sorry, I couldn\'t process that question. Please try again.');
        } finally {
            setChatting(false);
        }
    }

    // Removed loading spinner - show page immediately, data loads in background
    // Also removed separate empty state - now handled inline in main layout

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h2">Cheshbon Analysis</Typography>
                    <Typography variant="body" color={Colors.mediumGray} style={{ marginTop: Spacing.sm }}>
                        Chat with your past self
                    </Typography>
                    <Typography variant="caption" style={{ marginTop: Spacing.xs }}>
                        {entries.length} journal entries analyzed
                    </Typography>
                </View>

                {/* Themes */}
                <View style={styles.themesSection}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Recurring Themes
                    </Typography>
                    {themesLoading ? (
                        <View style={styles.themesLoadingContainer}>
                            <ActivityIndicator size="small" color={Colors.gold} />
                            <Typography variant="body" color={Colors.mediumGray} style={{ marginLeft: Spacing.sm }}>
                                ✨ Analyzing your reflections...
                            </Typography>
                        </View>
                    ) : themes.length > 0 ? (
                        <>
                            {(themesExpanded ? themes : themes.slice(0, 2)).map((theme, index) => (
                                <Card key={index} style={styles.themeCard} elevated={false}>
                                    <Typography variant="body">• {theme}</Typography>
                                </Card>
                            ))}
                            {themes.length > 2 && (
                                <TouchableOpacity
                                    style={styles.expandButton}
                                    onPress={() => setThemesExpanded(!themesExpanded)}
                                >
                                    <Typography variant="caption" color={Colors.gold}>
                                        {themesExpanded ? '▲ Show less' : `▼ Show ${themes.length - 2} more`}
                                    </Typography>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <Typography variant="body" color={Colors.mediumGray}>
                            No themes found yet. Keep journaling!
                        </Typography>
                    )}
                </View>

                {/* Chat Interface */}
                <View style={styles.chatSection}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3" style={styles.sectionTitle}>
                            Ask a Question
                        </Typography>
                        <TouchableOpacity onPress={shuffleQuestions} style={styles.refreshButton}>
                            <Typography variant="body" color={Colors.gold}>🔄</Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Suggested Questions */}
                    <View style={styles.suggestions}>
                        {(questionsExpanded ? displayedQuestions : displayedQuestions.slice(0, 2)).map((q: string, index: number) => (
                            <Card
                                key={index}
                                style={styles.suggestionCard}
                            >
                                <View onTouchEnd={() => setQuestion(q)}>
                                    <Typography variant="body" color={Colors.gold}>
                                        "{q}"
                                    </Typography>
                                </View>
                            </Card>
                        ))}
                        {displayedQuestions.length > 2 && (
                            <TouchableOpacity
                                style={styles.expandButton}
                                onPress={() => setQuestionsExpanded(!questionsExpanded)}
                            >
                                <Typography variant="caption" color={Colors.gold}>
                                    {questionsExpanded ? '▲ Show less' : `▼ Show ${displayedQuestions.length - 2} more`}
                                </Typography>
                            </TouchableOpacity>
                        )}
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
                        multiline
                    />

                    <Button onPress={handleAskQuestion} disabled={!question.trim() || chatting}>
                        {chatting ? 'Analyzing...' : 'Ask'}
                    </Button>

                    {/* Response */}
                    {response && (
                        <Card style={styles.responseCard}>
                            <Typography variant="body">{response}</Typography>
                        </Card>
                    )}
                </View>

                {/* Recent Entries */}
                <View style={styles.entriesSection}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Recent Entries
                    </Typography>
                    {entries.slice(0, 5).map((entry) => (
                        <Card key={entry.id} style={styles.entryCard} elevated={false}>
                            <Typography variant="caption" color={Colors.gold}>
                                {new Date(entry.date).toLocaleDateString()} · {entry.book} {entry.chapter}
                            </Typography>
                            <Typography variant="body" style={{ marginTop: Spacing.xs }} numberOfLines={2}>
                                {entry.reflection}
                            </Typography>
                        </Card>
                    ))}
                </View>

                <Button onPress={() => router.back()} variant="secondary" style={styles.backButton}>
                    Back to Daily Reading
                </Button>

                {/* Bottom padding for navigation */}
                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Bottom Navigation */}
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
    loadingContainer: {
        flex: 1,
        backgroundColor: Colors.cream,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themesLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    expandButton: {
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    refreshButton: {
        padding: Spacing.sm,
    },
    themesSection: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        marginBottom: Spacing.md,
    },
    themeCard: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.lightGray,
    },
    chatSection: {
        marginBottom: Spacing.xl,
    },
    suggestions: {
        marginBottom: Spacing.md,
    },
    suggestionCard: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.white,
        borderColor: Colors.gold,
        borderWidth: 1,
    },
    questionInput: {
        borderWidth: 1,
        borderColor: Colors.lightGray,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.base,
        fontFamily: FontFamilies.sans,
        color: Colors.charcoal,
        marginBottom: Spacing.md,
        minHeight: 80,
        backgroundColor: Colors.white,
        textAlignVertical: 'top',
    },
    responseCard: {
        marginTop: Spacing.lg,
        backgroundColor: Colors.white,
        borderLeftWidth: 4,
        borderLeftColor: Colors.gold,
    },
    entriesSection: {
        marginBottom: Spacing.xl,
    },
    entryCard: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.white,
    },
    backButton: {
        marginBottom: Spacing['2xl'],
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
