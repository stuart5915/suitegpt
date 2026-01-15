import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, TextInput, Modal, ActivityIndicator, Text, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontFamilies } from '../../constants/theme';
import { getTopicById } from '../../services/edificationContent';
import { fetchVerseReference } from '../../services/bibleApi';
import { publishReflection } from '../../services/feedService';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to render markdown-style bold text
function renderFormattedText(text: string, baseStyle: object) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <Text style={baseStyle}>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Bold text
                    return (
                        <Text key={index} style={{ fontWeight: 'bold' }}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
}

export default function TopicDetail() {
    const router = useRouter();
    const { topicId } = useLocalSearchParams<{ topicId: string }>();
    const topic = getTopicById(topicId || '');

    const [expandedSection, setExpandedSection] = useState<'challenge' | 'response' | 'scripture' | null>('challenge');
    const [reflection, setReflection] = useState('');
    const [saved, setSaved] = useState(false);
    const [sharePublicly, setSharePublicly] = useState(false);

    // Scripture preview modal state
    const [showScriptureModal, setShowScriptureModal] = useState(false);
    const [selectedScripture, setSelectedScripture] = useState<string>('');
    const [scriptureText, setScriptureText] = useState<string>('');
    const [loadingScripture, setLoadingScripture] = useState(false);

    useEffect(() => {
        if (topicId) {
            markAsRead();
        }
    }, [topicId]);

    // Removed loadReflection - input should always start empty per user preference

    async function markAsRead() {
        try {
            const saved = await AsyncStorage.getItem('read_edification_topics');
            const readSet = saved ? new Set(JSON.parse(saved)) : new Set();
            readSet.add(topicId);
            await AsyncStorage.setItem('read_edification_topics', JSON.stringify([...readSet]));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }

    async function saveReflection() {
        if (!reflection.trim()) return;
        try {
            await AsyncStorage.setItem(`edification_reflection_${topicId}`, reflection);

            // Always save to user's journal (verse_reflections)
            const { data: { user } } = await supabase.auth.getUser();
            if (user && topic) {
                const today = new Date().toISOString().split('T')[0];
                await supabase
                    .from('verse_reflections')
                    .insert({
                        user_id: user.id,
                        date: today,
                        verse_reference: `Edification: ${topic.title}`,
                        verse_text: topic.subtitle,
                        reflection: reflection.trim(),
                    });
            }

            // Publish to community if toggle is on
            if (sharePublicly && topic) {
                await publishReflection(
                    `Edification: ${topic.title}`,
                    topic.subtitle,
                    reflection.trim()
                );
            }

            setSaved(true);
            setSharePublicly(false);
            setReflection(''); // Clear input after save
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Error saving reflection:', error);
        }
    }

    async function handleScripturePress(reference: string) {
        setSelectedScripture(reference);
        setShowScriptureModal(true);
        setLoadingScripture(true);
        setScriptureText('');

        try {
            // Fetch specific verses using the full reference
            const passage = await fetchVerseReference(reference);

            // Clean up HTML to plain text for modal display
            const plainText = passage.html
                .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                .replace(/&nbsp;/g, ' ')    // Decode non-breaking space
                .replace(/&amp;/g, '&')     // Decode ampersand
                .replace(/&quot;/g, '"')    // Decode quotes
                .replace(/&apos;/g, "'")    // Decode apostrophe
                .replace(/&lt;/g, '<')      // Decode less than
                .replace(/&gt;/g, '>')      // Decode greater than
                .replace(/&#?\w+;/g, '')    // Remove any other HTML entities
                .replace(/\s+/g, ' ')       // Collapse whitespace
                .trim();

            setScriptureText(plainText);
        } catch (error) {
            console.error('Error fetching scripture:', error);
            setScriptureText('Unable to load scripture. Please try again.');
        } finally {
            setLoadingScripture(false);
        }
    }

    function navigateToFullChapter() {
        setShowScriptureModal(false);

        const parts = selectedScripture.split(' ');
        let book = parts[0];
        let chapterVerse = parts[1] || '1';

        if (/^\d+$/.test(parts[0])) {
            book = parts[0] + ' ' + parts[1];
            chapterVerse = parts[2] || '1';
        }

        const chapter = chapterVerse.split(':')[0];
        router.push(`/bible?book=${encodeURIComponent(book)}&chapter=${chapter}`);
    }

    if (!topic) {
        return (
            <View style={styles.container}>
                <Typography variant="body">Topic not found</Typography>
            </View>
        );
    }

    const scrollViewRef = useRef<ScrollView>(null);

    function scrollToReflection() {
        // Delay to let keyboard open
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
    }

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {/* Header with Back Button */}
                    <View style={styles.navBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Typography variant="body" color={Colors.gold}>← Back</Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Topic Header Card */}
                    <View style={styles.headerCard}>
                        <View style={styles.iconContainer}>
                            <Typography variant="h1" style={styles.topicIcon}>{topic.icon}</Typography>
                        </View>
                        <Typography variant="h2" style={styles.headerTitle}>{topic.title}</Typography>
                        <Typography variant="body" color={Colors.mediumGray} style={styles.headerSubtitle}>
                            {topic.subtitle}
                        </Typography>
                    </View>

                    {/* The Challenge */}
                    <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => setExpandedSection(expandedSection === 'challenge' ? null : 'challenge')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons
                                name={expandedSection === 'challenge' ? 'chevron-down' : 'chevron-forward'}
                                size={20}
                                color={Colors.gold}
                            />
                            <Typography variant="h3" color={Colors.gold}>The Challenge</Typography>
                        </View>
                    </TouchableOpacity>
                    {expandedSection === 'challenge' && (
                        <Card style={styles.sectionCard}>
                            <Typography variant="body" style={styles.contentText}>
                                {topic.challenge}
                            </Typography>
                        </Card>
                    )}

                    <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => setExpandedSection(expandedSection === 'response' ? null : 'response')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons
                                name={expandedSection === 'response' ? 'chevron-down' : 'chevron-forward'}
                                size={20}
                                color={Colors.gold}
                            />
                            <Typography variant="h3" color={Colors.gold}>The Response</Typography>
                        </View>
                    </TouchableOpacity>
                    {expandedSection === 'response' && (
                        <Card style={styles.sectionCard}>
                            {renderFormattedText(topic.response, styles.contentText)}
                        </Card>
                    )}

                    {/* Scripture References */}
                    <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => setExpandedSection(expandedSection === 'scripture' ? null : 'scripture')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons
                                name={expandedSection === 'scripture' ? 'chevron-down' : 'chevron-forward'}
                                size={20}
                                color={Colors.gold}
                            />
                            <Typography variant="h3" color={Colors.gold}>Scripture</Typography>
                        </View>
                    </TouchableOpacity>
                    {expandedSection === 'scripture' && (
                        <Card style={styles.sectionCard}>
                            <View style={styles.scriptureList}>
                                {topic.scriptures.map((ref, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.scriptureChip}
                                        onPress={() => handleScripturePress(ref)}
                                    >
                                        <Typography variant="body" color={Colors.gold}>
                                            📖 {ref}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Card>
                    )}

                    {/* Personal Reflection */}
                    <View style={styles.reflectionSection}>
                        <Typography variant="h3" style={styles.reflectionTitle}>
                            ✍️ Your Reflection
                        </Typography>
                        <TextInput
                            style={styles.reflectionInput}
                            value={reflection}
                            onChangeText={setReflection}
                            placeholder="What stood out to you? How does this strengthen your faith?"
                            placeholderTextColor={Colors.mediumGray}
                            multiline
                            numberOfLines={4}
                            onFocus={scrollToReflection}
                        />

                        {/* Share Toggle */}
                        <TouchableOpacity
                            onPress={() => setSharePublicly(!sharePublicly)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}
                        >
                            <View style={{
                                width: 44, height: 24, borderRadius: 12,
                                backgroundColor: sharePublicly ? Colors.gold : 'rgba(0,0,0,0.2)',
                                padding: 2, justifyContent: 'center',
                            }}>
                                <View style={{
                                    width: 20, height: 20, borderRadius: 10,
                                    backgroundColor: '#FFF',
                                    alignSelf: sharePublicly ? 'flex-end' : 'flex-start',
                                }} />
                            </View>
                            <Typography variant="caption" color={Colors.charcoal}>
                                Share to Community Feed
                            </Typography>
                        </TouchableOpacity>

                        {/* Button Row */}
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{
                                    flex: 1,
                                    paddingVertical: Spacing.md,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: Colors.gold,
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="body" color={Colors.gold}>← Return</Typography>
                            </TouchableOpacity>
                            <View style={{ flex: 2 }}>
                                <Button onPress={saveReflection}>
                                    {saved ? '✓ Saved!' : (sharePublicly ? 'Save & Share' : 'Save Reflection')}
                                </Button>
                            </View>
                        </View>
                    </View>

                    {/* Bottom padding */}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Scripture Preview Modal */}
            <Modal
                visible={showScriptureModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowScriptureModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowScriptureModal(false)}
                >
                    <View style={styles.scriptureModal}>
                        <Typography variant="h3" color={Colors.gold} style={styles.scriptureModalTitle}>
                            📖 {selectedScripture}
                        </Typography>

                        {loadingScripture ? (
                            <ActivityIndicator size="small" color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
                        ) : (
                            <ScrollView style={styles.scriptureModalScroll}>
                                <Text style={styles.scriptureModalText}>
                                    {scriptureText.split(/(\d+)/).map((part, index) => {
                                        // Check if this part is a verse number (digits at start or after space)
                                        if (/^\d+$/.test(part)) {
                                            return (
                                                <Text key={index} style={styles.verseNumber}>
                                                    {part}
                                                </Text>
                                            );
                                        }
                                        return part;
                                    })}
                                </Text>
                            </ScrollView>
                        )}

                        <View style={styles.scriptureModalButtons}>
                            <TouchableOpacity
                                style={styles.readFullButton}
                                onPress={navigateToFullChapter}
                            >
                                <Typography variant="body" color={Colors.gold}>
                                    Read Full Chapter →
                                </Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowScriptureModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray}>
                                    Close
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    navBar: {
        marginBottom: Spacing.sm,
    },
    backButton: {
        paddingVertical: Spacing.xs,
    },
    headerCard: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
        paddingVertical: Spacing.lg,
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 2,
        borderColor: Colors.gold,
        overflow: 'visible',
    },
    topicIcon: {
        fontSize: 44,
        lineHeight: 52,
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
        marginTop: 6,
    },
    headerTitle: {
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    headerSubtitle: {
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    sectionHeader: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    sectionCard: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
        padding: Spacing.lg,
    },
    contentText: {
        lineHeight: 26,
        fontFamily: FontFamilies.serif,
    },
    scriptureList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    scriptureChip: {
        backgroundColor: Colors.lightGray,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gold,
    },
    reflectionSection: {
        marginTop: Spacing.xl,
    },
    reflectionTitle: {
        marginBottom: Spacing.md,
    },
    reflectionInput: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.md,
        minHeight: 120,
        fontFamily: FontFamilies.sans,
        fontSize: 16,
        color: Colors.charcoal,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        marginBottom: Spacing.md,
        textAlignVertical: 'top',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    scriptureModal: {
        backgroundColor: Colors.cream,
        borderRadius: 16,
        padding: Spacing.lg,
        maxHeight: '70%',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    scriptureModalTitle: {
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    scriptureModalScroll: {
        maxHeight: 250,
        marginBottom: Spacing.md,
    },
    scriptureModalText: {
        lineHeight: 26,
        fontFamily: FontFamilies.serif,
        fontSize: 16,
        color: Colors.charcoal,
    },
    verseNumber: {
        fontSize: 11,
        color: Colors.mediumGray,
        lineHeight: 16,
    },
    scriptureModalButtons: {
        gap: Spacing.sm,
    },
    readFullButton: {
        backgroundColor: Colors.lightGray,
        padding: Spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.gold,
    },
    closeButton: {
        padding: Spacing.sm,
        alignItems: 'center',
    },
});
